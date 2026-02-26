import os
import asyncio
import imaplib
import email
from email import policy
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form, Depends, BackgroundTasks, HTTPException
from fastapi.security import HTTPBearer
import jwt
from fastapi.responses import FileResponse
from bson import ObjectId

from app.models.models import DocumentModel, EmailCredentialModel
from app.services.ingestion import ingest_upload, ingest_bytes
from app.core.config import SECRET_KEY
from app.api.auth import get_current_user_id


router = APIRouter()
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

security = HTTPBearer()


def get_current_user(token=Depends(security)):
    try:
        payload = jwt.decode(token.credentials, SECRET_KEY, algorithms=["HS256"])
        return {"user_id": payload.get("user_id"), "role": payload.get("role", "user")}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/documents/ingest-email")
def ingest_email(background_tasks: BackgroundTasks, user=Depends(get_current_user)):
    cred = EmailCredentialModel.objects(user_id=str(user["user_id"]), is_active=True).first()
    if not cred:
        raise HTTPException(
            status_code=400,
            detail="No email inbox connected. Use POST /api/v1/email/connect first."
        )
    background_tasks.add_task(fetch_email_attachments_for_user, str(user["user_id"]), cred)
    return {"message": f"Email ingestion started for {cred.email_address}"}




# -------------------------
# Manual Upload
# -------------------------
@router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    user=Depends(get_current_user)
):
    result = await ingest_upload(file, user_id=str(user["user_id"]), purpose="Manual Upload")
    return result


# -------------------------
# List documents with RBAC
# -------------------------
@router.get("/documents")
async def list_documents(user=Depends(get_current_user)):
    def _query():
        if user["role"].lower() == "admin":
            return list(DocumentModel.objects())
        return list(DocumentModel.objects(user_id=str(user["user_id"])))

    docs = await asyncio.to_thread(_query)

    return [
        {
            "id":             str(d.id),
            "filename":       d.filename,
            "purpose":        d.purpose,
            "received_at":    d.received_at,
            "status":         d.status,
            "summary":        d.summary,
            "department":     d.department,
            "sensitivity":    d.sensitivity,
            "routing_status": d.routing_status,
            "uploaded_by":    d.user_id,
            "source":         d.source,
        }
        for d in docs
    ]


# -------------------------
# Get single document by ID
# -------------------------
@router.get("/documents/{doc_id}")
async def get_document(doc_id: str, user=Depends(get_current_user)):
    doc = await asyncio.to_thread(lambda: DocumentModel.objects(id=doc_id).first())

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if user["role"].lower() != "admin" and str(doc.user_id) != str(user["user_id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    return {
        "id":             str(doc.id),
        "filename":       doc.filename,
        "purpose":        doc.purpose,
        "received_at":    doc.received_at,
        "status":         doc.status,
        "summary":        doc.summary,
        "department":     doc.department,
        "sensitivity":    doc.sensitivity,
        "routing_status": doc.routing_status,
        "clauses":        doc.clauses,
        "uploaded_by":    doc.user_id,
        "source":         doc.source,
    }


# ============================================================
# Email Credential Management
# ============================================================

from pydantic import BaseModel

class EmailCredentialSchema(BaseModel):
    imap_host: str = "imap.gmail.com"
    imap_port: int = 993
    email_address: str
    email_password: str


@router.post("/email/connect")
async def connect_email(data: EmailCredentialSchema, user=Depends(get_current_user)):
    try:
        mail = imaplib.IMAP4_SSL(data.imap_host, data.imap_port)
        mail.login(data.email_address, data.email_password)
        mail.logout()
    except imaplib.IMAP4.error as e:
        raise HTTPException(status_code=400, detail=f"Invalid email credentials: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not connect to mail server: {str(e)}")

    cred = EmailCredentialModel.objects(user_id=str(user["user_id"])).first()
    if cred:
        cred.imap_host = data.imap_host
        cred.imap_port = data.imap_port
        cred.email_address = data.email_address
        cred.email_password = data.email_password
        cred.is_active = True
        cred.connected_at = datetime.utcnow()
    else:
        cred = EmailCredentialModel(
            user_id=str(user["user_id"]),
            imap_host=data.imap_host,
            imap_port=data.imap_port,
            email_address=data.email_address,
            email_password=data.email_password,
        )
    cred.save()
    return {"message": "Email connected successfully", "email": data.email_address}


@router.get("/email/status")
async def email_status(user=Depends(get_current_user)):
    cred = await asyncio.to_thread(
        lambda: EmailCredentialModel.objects(user_id=str(user["user_id"])).first()
    )
    if not cred:
        return {"connected": False}
    return {
        "connected": cred.is_active,
        "email": cred.email_address,
        "last_synced_at": cred.last_synced_at,
    }


@router.delete("/email/disconnect")
async def disconnect_email(user=Depends(get_current_user)):
    cred = await asyncio.to_thread(
        lambda: EmailCredentialModel.objects(user_id=str(user["user_id"])).first()
    )
    if not cred:
        raise HTTPException(status_code=404, detail="No email connected")
    cred.is_active = False
    await asyncio.to_thread(cred.save)
    return {"message": "Email disconnected"}


# -------------------------
# Email body extraction helper
# -------------------------
def _extract_email_body(msg) -> str:
    """Extract plain text body from an email message, falling back to stripped HTML."""
    plain_parts = []
    html_parts = []

    for part in msg.walk():
        ct = part.get_content_type()
        if part.get_content_maintype() == "multipart":
            continue
        try:
            if ct == "text/plain":
                payload = part.get_payload(decode=True)
                if payload:
                    plain_parts.append(payload.decode(errors="ignore"))
            elif ct == "text/html":
                payload = part.get_payload(decode=True)
                if payload:
                    from bs4 import BeautifulSoup
                    html_parts.append(
                        BeautifulSoup(payload.decode(errors="ignore"), "html.parser").get_text(separator=" ")
                    )
        except Exception:
            pass

    body = " ".join(plain_parts) if plain_parts else " ".join(html_parts)
    # Trim to 2000 chars — enough context without bloating the LLM prompt
    return body.strip()[:2000]


# -------------------------
# Per-user email ingestion
# -------------------------
def fetch_email_attachments_for_user(user_id: str, cred: EmailCredentialModel):
    try:
        mail = imaplib.IMAP4_SSL(cred.imap_host, cred.imap_port)
        mail.login(cred.email_address, cred.email_password)

        typ, folders = mail.list()
        if typ != "OK":
            print(f"[ERROR] Failed to list folders for user {user_id}")
            return

        folders = [f.decode().split(' "/" ')[1].strip('"') for f in folders]
        ingested_email_ids = set()

        for folder in folders:
            try:
                typ, _ = mail.select(folder)
                if typ != "OK":
                    continue
            except Exception:
                continue

            typ, data = mail.search(None, "UNSEEN")
            if typ != "OK":
                continue

            for num in data[0].split():
                if num in ingested_email_ids:
                    continue
                try:
                    typ, msg_data = mail.fetch(num, "(RFC822)")
                    if typ != "OK":
                        continue

                    for response_part in msg_data:
                        if not isinstance(response_part, tuple):
                            continue

                        msg = email.message_from_bytes(response_part[1], policy=policy.default)
                        subject = msg["subject"] or "No Subject"
                        sender  = msg["from"] or "Unknown Sender"

                        # ── Extract email body for context-aware routing ──
                        body = _extract_email_body(msg)

                        email_context = {
                            "subject": subject,
                            "from":    sender,
                            "body":    body,
                        }

                        for part in msg.walk():
                            if part.get_content_maintype() == "multipart":
                                continue
                            if part.get("Content-Disposition") is None:
                                continue

                            filename = part.get_filename()
                            if filename:
                                file_bytes = part.get_payload(decode=True)
                                ingest_bytes(
                                    file_bytes=file_bytes,
                                    filename=filename,
                                    user_id=user_id,
                                    purpose=f"Email: {subject}",
                                    content_type=part.get_content_type(),
                                    source="email",
                                    email_context=email_context,  # ← passed through
                                )

                    mail.store(num, "+FLAGS", "\\Seen")
                    ingested_email_ids.add(num)

                except Exception as e:
                    print(f"[ERROR] Failed processing email {num} for user {user_id}: {e}")
                    continue

        cred.last_synced_at = datetime.utcnow()
        cred.save()
        mail.logout()
        print(f"[INFO] Email sync completed for user {user_id} ({cred.email_address})")

    except Exception as e:
        print(f"[ERROR] Email ingestion failed for user {user_id}: {e}")


# -------------------------
# Download / View file
# -------------------------
@router.get("/documents/{document_id}/file")
async def get_document_file(document_id: str, user=Depends(get_current_user)):
    if not ObjectId.is_valid(document_id):
        raise HTTPException(status_code=400, detail="Invalid document ID")

    doc = await asyncio.to_thread(
        lambda: DocumentModel.objects(id=document_id).first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if user["role"].lower() != "admin" and str(doc.user_id) != str(user["user_id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    file_path = os.path.abspath(doc.storage_path)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=file_path,
        media_type=doc.content_type or "application/octet-stream",
        filename=doc.filename,
        headers={
            "Content-Disposition": f'inline; filename="{doc.filename}"',
            "Accept-Ranges": "bytes",
        },
    )


# -------------------------
# Delete Document
# -------------------------
@router.delete("/documents/{document_id}")
async def delete_document(document_id: str, user_id: str = Depends(get_current_user_id)):
    document = await asyncio.to_thread(
        lambda: DocumentModel.objects(id=document_id, user_id=str(user_id)).first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    await asyncio.to_thread(document.delete)
    return {"message": "Document deleted successfully"}