# app/api/documents.py

import os
import imaplib
import email
from email import policy
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form, Depends, BackgroundTasks, HTTPException
from fastapi.security import HTTPBearer
import jwt
from fastapi.responses import FileResponse
from fastapi import Response
from bson import ObjectId

from app.models.models import DocumentModel
from app.services.ingestion import ingest_upload, ingest_bytes
from app.core.config import EMAIL_USER, EMAIL_PASS, SECRET_KEY
from app.api.auth import get_current_user_id


# -------------------------
# Router & Upload Directory
# -------------------------
router = APIRouter()
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# -------------------------
# Authentication (JWT-only)
# -------------------------
security = HTTPBearer()


def get_current_user(token=Depends(security)):
    try:
        payload = jwt.decode(token.credentials, SECRET_KEY, algorithms=["HS256"])
        return {"user_id": payload.get("user_id"), "role": payload.get("role", "user")}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


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
def list_documents(user=Depends(get_current_user)):
    all_docs = DocumentModel.objects()
    if user["role"].lower() != "admin":
        all_docs = all_docs.filter(user_id=str(user["user_id"]))
    return [
        {
            "id": str(d.id),
            "filename": d.filename,
            "purpose": d.purpose,
            "received_at": d.received_at,
            "status": d.status,
            "summary": d.summary,
            "department": d.department,
            "sensitivity": d.sensitivity,
            "routing_status": d.routing_status
        } for d in all_docs
    ]


# -------------------------
# Get single document by ID with RBAC
# -------------------------
@router.get("/documents/{doc_id}")
def get_document(doc_id: str, user=Depends(get_current_user)):
    doc = DocumentModel.objects(id=doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if user["role"].lower() != "admin" and str(doc.user_id) != str(user["user_id"]):
        raise HTTPException(status_code=403, detail="Access denied")
    return {
        "id": str(doc.id),
        "filename": doc.filename,
        "purpose": doc.purpose,
        "received_at": doc.received_at,
        "status": doc.status,
        "summary": doc.summary,
        "department": doc.department,
        "sensitivity": doc.sensitivity,
        "routing_status": doc.routing_status,
        "clauses": doc.clauses
    }


# -------------------------
# Email ingestion (background)
# -------------------------
def fetch_email_attachments(user_id: str):
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(EMAIL_USER, EMAIL_PASS)

        typ, folders = mail.list()
        if typ != "OK":
            print("[ERROR] Failed to list email folders")
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

            mail_ids = data[0].split()
            for num in mail_ids:
                if num in ingested_email_ids:
                    continue
                try:
                    typ, msg_data = mail.fetch(num, "(RFC822)")
                    if typ != "OK":
                        continue

                    for response_part in msg_data:
                        if isinstance(response_part, tuple):
                            msg = email.message_from_bytes(response_part[1], policy=policy.default)
                            subject = msg["subject"] or "No Subject"

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
                                        source="email"
                                    )

                    mail.store(num, "+FLAGS", "\\Seen")
                    ingested_email_ids.add(num)

                except Exception as e:
                    print(f"[ERROR] Failed processing email {num}: {e}")
                    continue

        mail.logout()
        print(f"[INFO] Finished fetching email attachments for user {user_id}")

    except Exception as e:
        print(f"[ERROR] Email ingestion failed: {e}")


@router.post("/documents/ingest-email")
def ingest_email(background_tasks: BackgroundTasks, user=Depends(get_current_user)):
    background_tasks.add_task(fetch_email_attachments, str(user["user_id"]))
    return {"message": "Email ingestion started in background"}


# -------------------------
# Optional: Direct Email Upload
# -------------------------
@router.post("/documents/ingest-email-file")
async def ingest_email_file(
    file: UploadFile = File(...),
    purpose: str = Form("Email Upload"),
    user=Depends(get_current_user)
):
    file_bytes = await file.read()
    return ingest_bytes(
        file_bytes=file_bytes,
        filename=file.filename,
        user_id=str(user["user_id"]),
        purpose=purpose,
        content_type=file.content_type,
        source="email"
    )


# -------------------------
# Download / View file
# -------------------------
@router.get("/documents/{document_id}/file")
def get_document_file(document_id: str):
    if not ObjectId.is_valid(document_id):
        raise HTTPException(status_code=400, detail="Invalid document ID")

    doc = DocumentModel.objects(id=document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = os.path.abspath(doc.storage_path)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=doc.filename,
        headers={
            "Content-Disposition": f'inline; filename="{doc.filename}"',
            "Accept-Ranges": "bytes",
        },
    )

# -------------------------
# Delete File
# -------------------------

@router.delete("/documents/{document_id}")
def delete_document(document_id: str, user_id: str = Depends(get_current_user_id)):

    document = DocumentModel.objects(
        id=document_id,
        user_id=str(user_id)
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    document.delete()

    return {"message": "Document deleted successfully"}