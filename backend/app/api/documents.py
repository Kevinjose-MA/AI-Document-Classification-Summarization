import os
import asyncio
import imaplib
import email
from email import policy
from email.header import decode_header
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Depends, BackgroundTasks, HTTPException
from fastapi.security import HTTPBearer
from fastapi.responses import Response
import jwt
from bson import ObjectId

from app.models.models import DocumentModel, EmailCredentialModel, AuditLogModel
from app.services.ingestion import ingest_upload, ingest_bytes
from app.services import storage as gridfs_storage
from app.core.config import SECRET_KEY
from app.api.auth import get_current_user_id

router    = APIRouter()
security  = HTTPBearer()

SUPPORTED_EXTS = {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".png", ".jpg", ".jpeg"}


# ── Auth ───────────────────────────────────────────────────────────────────────
def get_current_user(token=Depends(security)):
    try:
        payload = jwt.decode(token.credentials, SECRET_KEY, algorithms=["HS256"])
        return {"user_id": payload.get("user_id"), "role": payload.get("role", "user")}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def _log(document_id, filename, event, detail, agent="system",
         from_status=None, to_status=None, user_id=None, metadata=None):
    try:
        AuditLogModel(
            document_id=str(document_id), filename=filename, event=event,
            detail=detail, agent=agent, from_status=from_status,
            to_status=to_status, user_id=user_id, metadata=metadata or {},
        ).save()
    except Exception:
        pass


# ── Manual upload ──────────────────────────────────────────────────────────────
@router.post("/documents/upload")
async def upload_document(file: UploadFile = File(...), user=Depends(get_current_user)):
    result = await ingest_upload(file, user_id=str(user["user_id"]), purpose="Manual Upload")
    return result


# ── List documents — server-side pagination + RBAC ────────────────────────────
@router.get("/documents")
async def list_documents(
    user=Depends(get_current_user),
    page:      int = 1,
    per_page:  int = 15,
    dept:      str = None,
    status:    str = None,
    source:    str = None,
    search:    str = None,
    date_from: str = None,
    date_to:   str = None,
):
    def _query():
        from mongoengine.queryset.visitor import Q
        from datetime import datetime as dt

        role = user["role"].lower()
        if role == "admin":
            qs = DocumentModel.objects()
        elif role in ("engineering","finance","legal","hr","operations","compliance","general"):
            qs = DocumentModel.objects(Q(user_id=str(user["user_id"])) | Q(department=role))
        else:
            qs = DocumentModel.objects(user_id=str(user["user_id"]))

        if dept:
            qs = qs.filter(department__icontains=dept)
        if status:
            qs = qs.filter(routing_status=status)
        if source:
            qs = qs.filter(source=source)
        if search:
            qs = qs.filter(Q(filename__icontains=search) | Q(purpose__icontains=search))
        if date_from:
            try: qs = qs.filter(received_at__gte=dt.fromisoformat(date_from))
            except ValueError: pass
        if date_to:
            try: qs = qs.filter(received_at__lte=dt.fromisoformat(date_to))
            except ValueError: pass

        total  = qs.count()
        offset = (page - 1) * per_page
        docs   = list(qs.order_by("-received_at").skip(offset).limit(per_page))
        return docs, total

    docs, total = await asyncio.to_thread(_query)
    pages = max(1, -(-total // per_page))

    return {
        "total": total, "page": page, "per_page": per_page, "pages": pages,
        "results": [
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
                "source":         getattr(d, "source", "manual"),
                "document_type":  getattr(d, "document_type", None),
                "risk_level":     getattr(d, "risk_level", None),
                "language":       getattr(d, "language", None),
                "confidence":     getattr(d, "confidence", None),
                "uploaded_by":    d.user_id,
            }
            for d in docs
        ],
    }


# ── Single document ────────────────────────────────────────────────────────────
@router.get("/documents/{doc_id}")
async def get_document(doc_id: str, user=Depends(get_current_user)):
    doc = await asyncio.to_thread(lambda: DocumentModel.objects(id=doc_id).first())
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    role = user["role"].lower()
    if role != "admin":
        owns = str(doc.user_id) == str(user["user_id"])
        dept_match = doc.department and doc.department.lower() == role
        if not owns and not dept_match:
            raise HTTPException(status_code=403, detail="Access denied")

    return {
        "id":                str(doc.id),
        "filename":          doc.filename,
        "purpose":           doc.purpose,
        "received_at":       doc.received_at,
        "status":            doc.status,
        "summary":           doc.summary,
        "department":        doc.department,
        "sensitivity":       doc.sensitivity,
        "routing_status":    doc.routing_status,
        "clauses":           doc.clauses,
        "uploaded_by":       doc.user_id,
        "source":            doc.source,
        "document_type":     getattr(doc, "document_type", None),
        "risk_level":        getattr(doc, "risk_level", None),
        "language":          getattr(doc, "language", None),
        "confidence":        getattr(doc, "confidence", None),
        "encrypted_external": doc.encrypted_external,
        "file_id":           doc.file_id,
    }


# ── Preview (inline) ──────────────────────────────────────────────────────────
@router.get("/documents/{doc_id}/preview")
async def preview_document(doc_id: str, user=Depends(get_current_user)):
    doc = await asyncio.to_thread(lambda: DocumentModel.objects(id=doc_id).first())
    if not doc:
        raise HTTPException(404, "Document not found")

    file_bytes, content_type = await _load_file(doc)
    return Response(
        content=file_bytes,
        media_type=content_type,
        headers={"Content-Disposition": f'inline; filename="{doc.filename}"'},
    )


# ── Download ──────────────────────────────────────────────────────────────────
@router.get("/documents/{doc_id}/download")
async def download_document(doc_id: str, password: str = None, user=Depends(get_current_user)):
    doc = await asyncio.to_thread(lambda: DocumentModel.objects(id=doc_id).first())
    if not doc:
        raise HTTPException(404, "Document not found")

    file_bytes, content_type = await _load_file(doc)

    # Password-protected PDF unlock
    if password and doc.filename.lower().endswith(".pdf"):
        try:
            import pikepdf
            import io as _io
            pdf = pikepdf.open(_io.BytesIO(file_bytes), password=password)
            buf = _io.BytesIO()
            pdf.save(buf)
            file_bytes = buf.getvalue()
        except pikepdf.PasswordError:
            raise HTTPException(403, "Incorrect password")

    return Response(
        content=file_bytes,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{doc.filename}"'},
    )


async def _load_file(doc) -> tuple:
    """Load file bytes from GridFS (new) or local disk (legacy)."""
    # Try GridFS first
    if doc.file_id:
        try:
            file_bytes, content_type = await asyncio.to_thread(
                gridfs_storage.load, doc.file_id
            )
            return file_bytes, content_type
        except FileNotFoundError:
            pass

    # Fall back to local disk for old documents
    if doc.storage_path and os.path.exists(doc.storage_path):
        with open(doc.storage_path, "rb") as f:
            return f.read(), doc.content_type or "application/octet-stream"

    raise HTTPException(404, "File not found. It may have been stored on another machine. Migrate to GridFS.")


# ── Patch document (routing_status, department, etc.) ─────────────────────────
@router.patch("/documents/{doc_id}")
async def patch_document(doc_id: str, body: dict, user=Depends(get_current_user)):
    doc = await asyncio.to_thread(lambda: DocumentModel.objects(id=doc_id).first())
    if not doc:
        raise HTTPException(404, "Document not found")

    old_status = doc.routing_status
    allowed = {"routing_status", "status", "department", "sensitivity"}
    for k, v in body.items():
        if k in allowed:
            setattr(doc, k, v)

    if "routing_status" in body and body["routing_status"] == "ready":
        doc.reviewed_at = datetime.utcnow()
        doc.reviewed_by = str(user["user_id"])

    await asyncio.to_thread(doc.save)

    if "routing_status" in body:
        _log(doc_id, doc.filename, "reviewed",
             f"Status changed to '{body['routing_status']}' by user.",
             agent="human", from_status=old_status,
             to_status=body["routing_status"], user_id=str(user["user_id"]))

    return {"message": "Updated", "id": doc_id}


# ── Audit log for a document ───────────────────────────────────────────────────
@router.get("/documents/{doc_id}/audit")
async def get_audit_log(doc_id: str, user=Depends(get_current_user)):
    logs = await asyncio.to_thread(
        lambda: list(AuditLogModel.objects(document_id=doc_id).order_by("-timestamp"))
    )
    return [
        {
            "event":       l.event,
            "detail":      l.detail,
            "agent":       l.agent,
            "from_status": l.from_status,
            "to_status":   l.to_status,
            "user_id":     l.user_id,
            "metadata":    l.metadata,
            "timestamp":   l.timestamp,
        }
        for l in logs
    ]


# ── Org-wide audit log (admin) ────────────────────────────────────────────────
@router.get("/audit-log")
async def get_audit_log_all(
    user=Depends(get_current_user),
    page:     int = 1,
    per_page: int = 25,
    event:    str = None,   # filter by event type
    dept:     str = None,   # filter by department
):
    """
    Returns paginated audit log across all documents.
    Admin sees everything. Dept users see only their dept's documents.
    """
    def _query():
        role    = user["role"].lower()
        user_id = str(user["user_id"])

        if role == "admin":
            # Get all doc IDs — no restriction
            doc_ids = None
        else:
            # Get only doc IDs belonging to this user's department
            dept_filter = dept or role
            docs = DocumentModel.objects(department=dept_filter).only("id")
            doc_ids = [str(d.id) for d in docs]

        qs = AuditLogModel.objects()
        if doc_ids is not None:
            qs = qs.filter(document_id__in=doc_ids)
        if event:
            qs = qs.filter(event=event)

        total  = qs.count()
        offset = (page - 1) * per_page
        logs   = list(qs.order_by("-timestamp").skip(offset).limit(per_page))
        return logs, total

    logs, total = await asyncio.to_thread(_query)
    pages = max(1, -(-total // per_page))

    return {
        "total":   total,
        "page":    page,
        "pages":   pages,
        "results": [
            {
                "id":          str(l.id),
                "document_id": l.document_id,
                "filename":    l.filename,
                "event":       l.event,
                "detail":      l.detail,
                "agent":       l.agent,
                "from_status": l.from_status,
                "to_status":   l.to_status,
                "user_id":     l.user_id,
                "metadata":    l.metadata,
                "timestamp":   l.timestamp.isoformat() if l.timestamp else None,
            }
            for l in logs
        ],
    }


# ── Delete document ────────────────────────────────────────────────────────────
@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, user=Depends(get_current_user)):
    doc = await asyncio.to_thread(lambda: DocumentModel.objects(id=doc_id).first())
    if not doc:
        raise HTTPException(404, "Document not found")
    if user["role"].lower() != "admin" and str(doc.user_id) != str(user["user_id"]):
        raise HTTPException(403, "Access denied")

    # Delete from GridFS too
    if doc.file_id:
        try:
            await asyncio.to_thread(gridfs_storage.delete, doc.file_id)
        except Exception:
            pass

    await asyncio.to_thread(doc.delete)
    return {"message": "Document deleted"}


# ── Email credential management ────────────────────────────────────────────────
from pydantic import BaseModel

class EmailCredentialSchema(BaseModel):
    imap_host:      str = "imap.gmail.com"
    imap_port:      int = 993
    email_address:  str
    email_password: str


@router.post("/email/connect")
async def connect_email(data: EmailCredentialSchema, user=Depends(get_current_user)):
    # Test connection first
    try:
        mail = imaplib.IMAP4_SSL(data.imap_host, data.imap_port)
        mail.login(data.email_address, data.email_password)
        mail.logout()
    except imaplib.IMAP4.error as e:
        raise HTTPException(400, f"Invalid email credentials: {e}")
    except Exception as e:
        raise HTTPException(400, f"Could not connect to mail server: {e}")

    cred = await asyncio.to_thread(
        lambda: EmailCredentialModel.objects(user_id=str(user["user_id"])).first()
    )
    if cred:
        cred.imap_host = data.imap_host; cred.imap_port = data.imap_port
        cred.email_address = data.email_address; cred.email_password = data.email_password
        cred.is_active = True; cred.connected_at = datetime.utcnow()
    else:
        cred = EmailCredentialModel(
            user_id=str(user["user_id"]), imap_host=data.imap_host,
            imap_port=data.imap_port, email_address=data.email_address,
            email_password=data.email_password,
        )
    await asyncio.to_thread(cred.save)
    return {"message": "Email connected", "email": data.email_address}


@router.get("/email/status")
async def email_status(user=Depends(get_current_user)):
    cred = await asyncio.to_thread(
        lambda: EmailCredentialModel.objects(user_id=str(user["user_id"])).first()
    )
    if not cred:
        return {"connected": False}
    return {"connected": cred.is_active, "email": cred.email_address,
            "imap_host": cred.imap_host, "imap_port": cred.imap_port,
            "last_synced_at": cred.last_synced_at}


@router.delete("/email/disconnect")
async def disconnect_email(user=Depends(get_current_user)):
    cred = await asyncio.to_thread(
        lambda: EmailCredentialModel.objects(user_id=str(user["user_id"])).first()
    )
    if not cred:
        raise HTTPException(404, "No email connected")
    cred.is_active = False
    await asyncio.to_thread(cred.save)
    return {"message": "Email disconnected"}


# ── Email ingestion trigger ────────────────────────────────────────────────────
@router.post("/documents/ingest-email")
def ingest_email(background_tasks: BackgroundTasks, user=Depends(get_current_user)):
    cred = EmailCredentialModel.objects(user_id=str(user["user_id"]), is_active=True).first()
    if not cred:
        raise HTTPException(400, "No email inbox connected.")
    background_tasks.add_task(fetch_email_attachments_for_user, str(user["user_id"]), cred)
    return {"message": f"Email ingestion started for {cred.email_address}"}


def _decode_header_str(raw) -> str:
    parts = decode_header(raw or "")
    return "".join(
        p.decode(enc or "utf-8") if isinstance(p, bytes) else p
        for p, enc in parts
    )


def _extract_email_body(msg) -> str:
    plain, html = [], []
    for part in msg.walk():
        ct = part.get_content_type()
        if part.get_content_maintype() == "multipart":
            continue
        try:
            if ct == "text/plain":
                payload = part.get_payload(decode=True)
                if payload: plain.append(payload.decode(errors="ignore"))
            elif ct == "text/html":
                payload = part.get_payload(decode=True)
                if payload:
                    from bs4 import BeautifulSoup
                    html.append(BeautifulSoup(payload.decode(errors="ignore"), "html.parser").get_text(" "))
        except Exception:
            pass
    return (" ".join(plain) if plain else " ".join(html)).strip()[:2000]


def fetch_email_attachments_for_user(user_id: str, cred: EmailCredentialModel):
    """
    Fetches UNSEEN emails that have attachments.
    CRITICAL: Only marks an email as Seen if at least one attachment was ingested.
    Conversation-only emails are never touched — they stay unread.
    """
    try:
        # Decrypt password before use — it is stored encrypted in MongoDB
        from app.core.encryption import decrypt_password, is_encrypted
        imap_password = decrypt_password(cred.email_password) if is_encrypted(cred.email_password) else cred.email_password

        mail = imaplib.IMAP4_SSL(cred.imap_host, cred.imap_port)
        mail.login(cred.email_address, imap_password)
        mail.select("INBOX")

        # Gmail: use server-side filter to pre-select only emails with attachments
        status, att_ids = mail.search(None, "UNSEEN", "X-GM-RAW", "has:attachment")
        if status != "OK" or not att_ids[0]:
            # Non-Gmail fallback: fetch all UNSEEN, filter at parse time
            status, att_ids = mail.search(None, "UNSEEN")
            if status != "OK" or not att_ids[0]:
                mail.logout()
                return

        for msg_id in att_ids[0].split():
            try:
                # Peek at headers only first — does NOT change read/unread status
                _, hdr_data = mail.fetch(msg_id, "(BODY.PEEK[HEADER.FIELDS (SUBJECT FROM CONTENT-TYPE)])")
                hdr_text = hdr_data[0][1].decode(errors="replace") if hdr_data and hdr_data[0] else ""

                # Skip non-multipart emails — they cannot have file attachments
                # Email stays UNREAD — sender/recipient won't miss it
                if "multipart" not in hdr_text.lower():
                    continue

                # Full fetch only for multipart emails
                _, msg_data = mail.fetch(msg_id, "(RFC822)")
                msg = email.message_from_bytes(msg_data[0][1], policy=policy.default)

                subject = _decode_header_str(msg.get("Subject", "No Subject"))
                sender  = msg.get("from", "Unknown")
                body    = _extract_email_body(msg)

                email_context = {"subject": subject, "from": sender, "body": body}
                ingested_this_email = 0

                for part in msg.walk():
                    if part.get_content_maintype() == "multipart":
                        continue
                    if "attachment" not in (part.get("Content-Disposition") or ""):
                        continue
                    raw_fname = part.get_filename()
                    if not raw_fname:
                        continue
                    filename = _decode_header_str(raw_fname)
                    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
                    if ext not in SUPPORTED_EXTS:
                        continue

                    file_bytes_data = part.get_payload(decode=True)
                    if not file_bytes_data:
                        continue

                    try:
                        ingest_bytes(
                            file_bytes    = file_bytes_data,
                            filename      = filename,
                            user_id       = user_id,
                            purpose       = f"Email: {subject}",
                            content_type  = part.get_content_type(),
                            source        = "email",
                            email_context = email_context,
                        )
                        ingested_this_email += 1
                    except Exception as e:
                        # Duplicate or processing error — don't mark Seen, don't crash
                        print(f"[EMAIL] Skipped {filename}: {e}")

                # ── ONLY mark as Seen if we ingested at least one attachment ──
                # Conversation emails, unsupported-extension-only emails → stay UNREAD
                if ingested_this_email > 0:
                    mail.store(msg_id, "+FLAGS", "\\Seen")

            except Exception as e:
                print(f"[EMAIL] Error processing msg {msg_id}: {e}")
                continue

        cred.last_synced_at = datetime.utcnow()
        cred.save()
        mail.logout()

    except Exception as e:
        print(f"[EMAIL] Sync failed for user {user_id}: {e}")