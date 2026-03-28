# app/api/ingestion_sources.py
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import asyncio

from app.models.ingestion_source import IngestionSourceModel, SourceStatus, SourceType
from app.api.auth import get_current_user          # ← single import, returns dict
from app.services.ingestion import ingest_bytes

router = APIRouter(prefix="/ingestion-sources", tags=["Ingestion Sources"])


# ── Schemas ───────────────────────────────────────────────
class CreateSourceRequest(BaseModel):
    type:        str
    label:       str
    department:  str
    config_hint: Optional[str] = ""


# ── RBAC helper ───────────────────────────────────────────
def _check_dept_access(user: dict, department: str):
    if user.get("role") == "admin":
        return
    if user.get("role", "").lower() != department.lower():
        raise HTTPException(status_code=403, detail="Access denied: different department.")


# ── LIST ──────────────────────────────────────────────────
def _do_list_sources(user: dict):
    if user.get("role") == "admin":
        sources = IngestionSourceModel.objects().order_by("-created_at")
    else:
        dept = user.get("role", "").lower()
        sources = IngestionSourceModel.objects(department=dept).order_by("-created_at")
    return [s.to_dict() for s in sources]

@router.get("/")
async def list_sources(user: dict = Depends(get_current_user)):
    return await asyncio.to_thread(_do_list_sources, user)


# ── CREATE ────────────────────────────────────────────────
@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_source(
    body: CreateSourceRequest,
    user: dict = Depends(get_current_user),          # ← dict, not str
):
    if user.get("role") != "admin":
        body.department = user.get("role", "general").lower()

    auto_sync = body.type in (SourceType.EMAIL, SourceType.SHAREPOINT)
    is_manual = body.type in (SourceType.MAXIMO, SourceType.WHATSAPP, SourceType.SCAN, SourceType.CLOUD_LINK)

    src = IngestionSourceModel(
        type               = body.type,
        label              = body.label,
        department         = body.department.lower(),
        config_hint        = body.config_hint or "",
        created_by         = str(user.get("user_id") or user.get("sub", "")),
        status             = SourceStatus.PENDING,
        supports_auto_sync = auto_sync,
        is_manual          = is_manual,
    )
    await asyncio.to_thread(src.save)
    return src.to_dict()


# ── GET ONE ───────────────────────────────────────────────
@router.get("/{source_id}")
async def get_source(source_id: str, user: dict = Depends(get_current_user)):
    src = await asyncio.to_thread(lambda: IngestionSourceModel.objects(pk=source_id).first())
    if not src:
        raise HTTPException(404, "Ingestion source not found")
    _check_dept_access(user, src.department)
    return src.to_dict()


# ── DELETE ────────────────────────────────────────────────
@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source(source_id: str, user: dict = Depends(get_current_user)):
    src = await asyncio.to_thread(lambda: IngestionSourceModel.objects(pk=source_id).first())
    if not src:
        raise HTTPException(404, "Source not found")
    _check_dept_access(user, src.department)

    # Cascade: if this was an email source, deactivate + delete its credentials
    if src.type == SourceType.EMAIL:
        user_id = str(user.get("user_id", ""))
        await asyncio.to_thread(_delete_email_credentials, user_id)

    await asyncio.to_thread(src.delete)


def _delete_email_credentials(user_id: str):
    """Deactivate and remove email credentials for a user when their email source is deleted."""
    from app.models.models import EmailCredentialModel
    cred = EmailCredentialModel.objects(user_id=user_id).first()
    if cred:
        cred.is_active = False
        cred.save()
        # Hard delete so sync can never pick it up again
        cred.delete()


# ── MANUAL UPLOAD ─────────────────────────────────────────
@router.post("/{source_id}/upload")
async def upload_to_source(
    source_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    src = await asyncio.to_thread(lambda: IngestionSourceModel.objects(pk=source_id).first())
    if not src:
        raise HTTPException(404, "Source not found")
    _check_dept_access(user, src.department)
    if not src.is_manual:
        raise HTTPException(400, "This source does not support manual upload")

    await asyncio.to_thread(_mark_syncing, src)
    file_bytes = await file.read()

    # Map source type to a human-readable purpose
    PURPOSE_MAP = {
        "maximo":     "Maximo export document",
        "whatsapp":   "Document received via WhatsApp",
        "scan":       "Scanned hard-copy document",
        "cloud_link": "Document from cloud link",
    }
    purpose = PURPOSE_MAP.get(src.type, f"Document from {src.type}")

    try:
        result = await asyncio.to_thread(
            ingest_bytes,
            file_bytes,                          # file_bytes
            file.filename,                       # filename
            str(user.get("user_id", "")),        # user_id
            purpose,                             # purpose  ← was incorrectly passing department
            file.content_type or "application/octet-stream",  # content_type
            src.type,                            # source   ← maximo / whatsapp / scan etc.
        )
        await asyncio.to_thread(_mark_success, src)
        return {"message": "File ingested via " + src.type, "source_id": source_id, "document": result}
    except Exception as e:
        await asyncio.to_thread(_mark_error, src, str(e))
        raise HTTPException(500, f"Ingestion failed: {str(e)}")


# ── CLOUD LINK ────────────────────────────────────────────
@router.post("/{source_id}/ingest-link")
async def ingest_cloud_link(
    source_id: str,
    url: str = Form(...),
    user: dict = Depends(get_current_user),
):
    src = await asyncio.to_thread(lambda: IngestionSourceModel.objects(pk=source_id).first())
    if not src:
        raise HTTPException(404, "Source not found")
    if src.type != SourceType.CLOUD_LINK:
        raise HTTPException(400, "This source is not a cloud link type")
    _check_dept_access(user, src.department)

    import httpx
    await asyncio.to_thread(_mark_syncing, src)
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url)
            resp.raise_for_status()
        filename = url.split("/")[-1].split("?")[0] or "cloud_document"
        result = await asyncio.to_thread(
            ingest_bytes,
            resp.content,
            filename,
            str(user.get("user_id", "")),
            f"Document from cloud link: {url}",
            content_type,
            "cloud_link",
        )
        await asyncio.to_thread(_mark_success, src)
        return {"message": "Cloud link ingested", "document": result}
    except Exception as e:
        await asyncio.to_thread(_mark_error, src, str(e))
        raise HTTPException(500, f"Cloud link ingestion failed: {str(e)}")


# ── TRIGGER SYNC ──────────────────────────────────────────
@router.post("/{source_id}/sync")
async def trigger_sync(source_id: str, user: dict = Depends(get_current_user)):
    src = await asyncio.to_thread(lambda: IngestionSourceModel.objects(pk=source_id).first())
    if not src:
        raise HTTPException(404, "Source not found")
    _check_dept_access(user, src.department)

    if src.type == SourceType.EMAIL:
        # Verify source is still active (not soft-deleted or disabled)
        if src.status == SourceStatus.DISABLED:
            raise HTTPException(400, "This ingestion source is disabled.")

        # Fetch stored credentials for this user
        from app.models.models import EmailCredentialModel
        user_id = str(user.get("user_id", ""))
        cred = await asyncio.to_thread(
            lambda: EmailCredentialModel.objects(user_id=user_id, is_active=True).first()
        )
        if not cred:
            raise HTTPException(400, "No email credentials configured. Add IMAP credentials first.")

        # Double-check: credentials must belong to an active source
        active_email_source = await asyncio.to_thread(
            lambda: IngestionSourceModel.objects(
                type=SourceType.EMAIL,
                department=src.department,
            ).first()
        )
        if not active_email_source:
            # Source was deleted but cred still exists — clean up and block
            await asyncio.to_thread(_delete_email_credentials, user_id)
            raise HTTPException(400, "Email source no longer exists. Please re-add it.")

        await asyncio.to_thread(_mark_syncing, src)
        try:
            ingested = await asyncio.to_thread(
                _run_imap_sync, cred, user_id, src
            )
            await asyncio.to_thread(_mark_success, src)
            return {"message": f"Email sync complete. {ingested} new document(s) ingested.", "count": ingested}
        except Exception as e:
            await asyncio.to_thread(_mark_error, src, str(e))
            raise HTTPException(500, f"Email sync failed: {str(e)}")

    if src.type == SourceType.SHAREPOINT:
        await asyncio.to_thread(_mark_syncing, src)
        return {"message": "SharePoint sync queued (not yet implemented)"}

    raise HTTPException(400, "This source type does not support sync")



# ── IMAP sync helper ──────────────────────────────────────
def _run_imap_sync(cred, user_id: str, src) -> int:
    """Connect to IMAP, fetch UNSEEN emails, ingest attachments. Returns count."""
    import imaplib
    import email as email_lib
    from email.header import decode_header

    SUPPORTED_EXTS = {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".png", ".jpg", ".jpeg"}
    ingested = 0

    # Final safety check — bail if credential was deactivated between trigger and execution
    if not cred.is_active:
        return 0

    mail = imaplib.IMAP4_SSL(cred.imap_host, cred.imap_port)
    mail.login(cred.email_address, cred.email_password)
    mail.select("INBOX")

    status, message_ids = mail.search(None, "UNSEEN")
    if status != "OK" or not message_ids[0]:
        mail.logout()
        return 0

    for msg_id in message_ids[0].split():
        try:
            _, msg_data = mail.fetch(msg_id, "(RFC822)")
            msg = email_lib.message_from_bytes(msg_data[0][1])
            raw_subj = msg.get("Subject", "Email attachment")
            subject = "".join(
                p.decode(enc or "utf-8") if isinstance(p, bytes) else p
                for p, enc in decode_header(raw_subj)
            )
            sender = msg.get("From", "unknown")

            for part in msg.walk():
                if "attachment" not in part.get("Content-Disposition", ""):
                    continue
                raw_fname = part.get_filename()
                if not raw_fname:
                    continue
                filename = "".join(
                    p.decode(enc or "utf-8") if isinstance(p, bytes) else p
                    for p, enc in decode_header(raw_fname)
                )
                ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
                if ext not in SUPPORTED_EXTS:
                    continue
                ingest_bytes(
                    file_bytes    = part.get_payload(decode=True),
                    filename      = filename,
                    user_id       = user_id,
                    purpose       = f"Email attachment: {subject}",
                    content_type  = part.get_content_type() or "application/octet-stream",
                    source        = "email",
                    email_context = {"subject": subject, "sender": sender, "msg_id": msg_id.decode()},
                )
                ingested += 1

            mail.store(msg_id, "+FLAGS", "\\Seen")
        except Exception:
            continue  # skip individual failures

    cred.last_synced_at = datetime.now(timezone.utc)
    cred.save()
    mail.logout()
    return ingested


# ── Helpers ───────────────────────────────────────────────
def _mark_syncing(src):
    src.status = SourceStatus.SYNCING
    src.updated_at = datetime.now(timezone.utc)
    src.save()

def _mark_success(src):
    src.status = SourceStatus.CONNECTED
    src.last_sync = datetime.now(timezone.utc)
    src.error_message = ""
    src.updated_at = datetime.now(timezone.utc)
    src.save()

def _mark_error(src, msg: str):
    src.status = SourceStatus.ERROR
    src.error_message = msg
    src.updated_at = datetime.now(timezone.utc)
    src.save()