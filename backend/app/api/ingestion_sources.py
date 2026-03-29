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
    user_id = str(user.get("user_id", ""))
    role    = user.get("role", "").lower()

    if role == "admin":
        # Admin sees all NON-email sources org-wide.
        # Email sources are personal — admin cannot see other users' inboxes.
        non_email = list(IngestionSourceModel.objects(
            type__ne=SourceType.EMAIL
        ).order_by("-created_at"))
        # Admin can still see their OWN email source if they have one
        own_email = list(IngestionSourceModel.objects(
            type=SourceType.EMAIL,
            created_by=user_id,
        ).order_by("-created_at"))
        sources = own_email + non_email
    else:
        # Dept users see their dept's non-email sources + their own email source
        dept_sources = list(IngestionSourceModel.objects(
            department=role,
            type__ne=SourceType.EMAIL,
        ).order_by("-created_at"))
        own_email = list(IngestionSourceModel.objects(
            type=SourceType.EMAIL,
            created_by=user_id,
        ).order_by("-created_at"))
        sources = own_email + dept_sources

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

    # SECURITY: Only the creator of an email source can delete it.
    # Admin cannot delete another user's email source.
    if src.type == SourceType.EMAIL:
        user_id = str(user.get("user_id", ""))
        if src.created_by != user_id:
            raise HTTPException(
                403,
                "Access denied. You can only delete your own email ingestion source."
            )
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
        user_id = str(user.get("user_id", ""))

        # SECURITY: Only the user who created this email source can sync it.
        # No one else — including admin — can trigger another user's email sync.
        if src.created_by != user_id:
            raise HTTPException(
                403,
                "Access denied. You can only sync your own email ingestion source."
            )

        # Verify source is still active
        if src.status == SourceStatus.DISABLED:
            raise HTTPException(400, "This ingestion source is disabled.")

        # Fetch credentials — must belong to the same user
        from app.models.models import EmailCredentialModel
        cred = await asyncio.to_thread(
            lambda: EmailCredentialModel.objects(user_id=user_id, is_active=True).first()
        )
        if not cred:
            raise HTTPException(400, "No email credentials configured. Add IMAP credentials first.")

        # Verify credentials are still linked to an active source
        active_email_source = await asyncio.to_thread(
            lambda: IngestionSourceModel.objects(
                type=SourceType.EMAIL,
                created_by=user_id,
            ).first()
        )
        if not active_email_source:
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

    # Decrypt password before use — stored encrypted in MongoDB
    from app.core.encryption import decrypt_password, is_encrypted
    imap_password = decrypt_password(cred.email_password) if is_encrypted(cred.email_password) else cred.email_password

    mail = imaplib.IMAP4_SSL(cred.imap_host, cred.imap_port)
    mail.login(cred.email_address, imap_password)
    mail.select("INBOX")

    status, message_ids = mail.search(None, "UNSEEN")
    if status != "OK" or not message_ids[0]:
        mail.logout()
        return 0

    # Use IMAP SEARCH to pre-filter — only fetch emails that have attachments.
    # X-GM-RAW is Gmail-specific and most reliable; fall back to generic search.
    # This means pure conversation emails are never fetched or touched at all.
    status2, att_ids = mail.search(None, "UNSEEN", "X-GM-RAW", "has:attachment")
    if status2 != "OK" or not att_ids[0]:
        # Gmail X-GM-RAW not supported (non-Gmail IMAP) — fall back: fetch all
        # UNSEEN but skip at parse time if no attachments found (don't mark Seen)
        att_ids = message_ids

    for msg_id in att_ids[0].split():
        try:
            # Peek at headers only first — avoids downloading full email body
            # if there are no attachments at all (cheap pre-check)
            _, hdr_data = mail.fetch(msg_id, "(BODY.PEEK[HEADER.FIELDS (SUBJECT FROM CONTENT-TYPE)])")
            hdr_text = hdr_data[0][1].decode(errors="replace") if hdr_data and hdr_data[0] else ""

            # Quick pre-filter: if "multipart" not in headers, this email has no attachments
            # Skip entirely — do NOT mark as Seen, do NOT download body
            if "multipart" not in hdr_text.lower():
                continue

            # Full fetch only for multipart emails
            _, msg_data = mail.fetch(msg_id, "(RFC822)")
            msg = email_lib.message_from_bytes(msg_data[0][1])

            raw_subj = msg.get("Subject", "Email attachment")
            subject = "".join(
                p.decode(enc or "utf-8") if isinstance(p, bytes) else p
                for p, enc in decode_header(raw_subj)
            )
            sender = msg.get("From", "unknown")

            # Count attachments ingested from THIS email
            ingested_this_email = 0

            for part in msg.walk():
                content_disposition = part.get("Content-Disposition", "")
                # Only process actual attachments — skip inline images, text bodies, HTML parts
                if "attachment" not in content_disposition:
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

                file_bytes_data = part.get_payload(decode=True)
                if not file_bytes_data:
                    continue

                ingest_bytes(
                    file_bytes    = file_bytes_data,
                    filename      = filename,
                    user_id       = user_id,
                    purpose       = f"Email attachment: {subject}",
                    content_type  = part.get_content_type() or "application/octet-stream",
                    source        = "email",
                    email_context = {"subject": subject, "sender": sender, "msg_id": msg_id.decode()},
                )
                ingested_this_email += 1
                ingested += 1

            # CRITICAL: Only mark as Seen if we actually ingested something.
            # Pure conversation emails (no attachments / unsupported extensions)
            # are left UNREAD so the sender doesn't miss them in their inbox.
            if ingested_this_email > 0:
                mail.store(msg_id, "+FLAGS", "\\Seen")

        except Exception:
            continue  # skip individual failures — never crash the whole sync

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