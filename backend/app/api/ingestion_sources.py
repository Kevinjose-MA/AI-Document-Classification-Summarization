# backend/routers/ingestion_sources.py
# ────────────────────────────────────────────────────────────
# NEW FILE — mount at: app.include_router(ingestion_router, prefix="/api/v1")
# Does NOT modify existing /documents endpoints.
# ────────────────────────────────────────────────────────────

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import asyncio

from app.models.ingestion_source import IngestionSourceModel, SourceStatus, SourceType
# Reuse your existing auth dependency and ingest functions:
from app.api.auth import get_current_user_id   # adjust import to match your project
from app.services.ingestion import ingest_bytes 
from app.api.auth import get_current_user         
router = APIRouter(prefix="/ingestion-sources", tags=["Ingestion Sources"])


# ── Pydantic schemas ──────────────────────────────────────
class CreateSourceRequest(BaseModel):
    type:        str
    label:       str
    department:  str
    config_hint: Optional[str] = ""


class UpdateStatusRequest(BaseModel):
    status:        str
    error_message: Optional[str] = ""


# ── RBAC helper ───────────────────────────────────────────
def _check_dept_access(user: dict, department: str):
    """Non-admins may only access their own department's sources."""
    if user.get("role") == "admin":
        return
    if user.get("role", "").lower() != department.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: this ingestion source belongs to a different department."
        )


# ── LIST ─────────────────────────────────────────────────
@router.get("/")
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
    user: dict = Depends(get_current_user_id)
):
    """
    Any authenticated user can create a source for their own dept.
    Admins can create for any dept.
    """
    if user.get("role") != "admin":
        # force department to match user's role
        body.department = user.get("role", "general").lower()

    # Determine capabilities by type
    auto_sync  = body.type in (SourceType.EMAIL, SourceType.SHAREPOINT)
    is_manual  = body.type in (SourceType.MAXIMO, SourceType.WHATSAPP, SourceType.SCAN, SourceType.CLOUD_LINK)

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
async def get_source(source_id: str, user: dict = Depends(get_current_user_id)):
    src = await asyncio.to_thread(IngestionSourceModel.objects(pk=source_id).first)
    if not src:
        raise HTTPException(404, "Ingestion source not found")
    _check_dept_access(user, src.department)
    return src.to_dict()


# ── DELETE ────────────────────────────────────────────────
@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source(source_id: str, user: dict = Depends(get_current_user_id)):
    src = await asyncio.to_thread(IngestionSourceModel.objects(pk=source_id).first)
    if not src:
        raise HTTPException(404, "Source not found")
    _check_dept_access(user, src.department)
    await asyncio.to_thread(src.delete)


# ── MANUAL UPLOAD (Maximo / WhatsApp / Scan) ─────────────
@router.post("/{source_id}/upload")
async def upload_to_source(
    source_id: str,
    file: UploadFile = File(...),
    user: dict       = Depends(get_current_user_id)
):
    """
    Triggers the EXISTING ingestion pipeline.
    Attaches source metadata to the document after processing.
    """
    src = await asyncio.to_thread(IngestionSourceModel.objects(pk=source_id).first)
    if not src:
        raise HTTPException(404, "Source not found")
    _check_dept_access(user, src.department)
    if not src.is_manual:
        raise HTTPException(400, "This source does not support manual upload")

    # Update status to syncing
    await asyncio.to_thread(_mark_syncing, src)

    file_bytes = await file.read()

    try:
        # ── Reuse your existing ingestion function ────────────
        # Adjust call signature to match your implementation.
        # Your existing function should accept bytes + filename + user context.
        result = await asyncio.to_thread(
            ingest_bytes,          # your existing function
            file_bytes,
            file.filename,
            str(user.get("user_id", "")),
            src.department,             # pass department from source
        )

        # Mark success
        await asyncio.to_thread(_mark_success, src)
        return {
            "message":   "File ingested successfully via " + src.type,
            "source_id": source_id,
            "document":  result,
        }

    except Exception as e:
        await asyncio.to_thread(_mark_error, src, str(e))
        raise HTTPException(500, f"Ingestion failed: {str(e)}")


# ── CLOUD LINK INGEST ─────────────────────────────────────
@router.post("/{source_id}/ingest-link")
async def ingest_cloud_link(
    source_id: str,
    url: str = Form(...),
    user: dict = Depends(get_current_user_id)
):
    """
    For cloud_link type sources.
    Downloads the file and pushes through existing pipeline.
    """
    src = await asyncio.to_thread(IngestionSourceModel.objects(pk=source_id).first)
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
        file_bytes = resp.content
        filename   = url.split("/")[-1].split("?")[0] or "cloud_document"

        result = await asyncio.to_thread(
            ingest_bytes,
            file_bytes,
            filename,
            str(user.get("user_id", "")),
            src.department,
        )
        await asyncio.to_thread(_mark_success, src)
        return {"message": "Cloud link ingested", "document": result}
    except Exception as e:
        await asyncio.to_thread(_mark_error, src, str(e))
        raise HTTPException(500, f"Cloud link ingestion failed: {str(e)}")


# ── TRIGGER SYNC (email / SharePoint stubs) ───────────────
@router.post("/{source_id}/sync")
async def trigger_sync(source_id: str, user: dict = Depends(get_current_user_id)):
    """
    For auto-sync sources (email, SharePoint).
    Currently returns a stub response.
    Wire to your email ingestion or SharePoint client when ready.
    """
    src = await asyncio.to_thread(IngestionSourceModel.objects(pk=source_id).first)
    if not src:
        raise HTTPException(404, "Source not found")
    _check_dept_access(user, src.department)

    if src.type == SourceType.EMAIL:
        # TODO: call your existing email ingestion logic here
        # e.g. await ingest_email_folder(src.config_hint)
        await asyncio.to_thread(_mark_success, src)
        return {"message": "Email sync triggered (stub — wire to email ingestion)"}

    if src.type == SourceType.SHAREPOINT:
        # TODO: implement SharePoint OAuth + folder scan
        await asyncio.to_thread(_mark_syncing, src)
        return {"message": "SharePoint sync queued (not yet implemented — design placeholder)"}

    raise HTTPException(400, "This source type does not support sync triggering")


# ── Internal helpers ──────────────────────────────────────
def _mark_syncing(src):
    src.status     = SourceStatus.SYNCING
    src.updated_at = datetime.now(timezone.utc)
    src.save()

def _mark_success(src):
    src.status        = SourceStatus.CONNECTED
    src.last_sync     = datetime.now(timezone.utc)
    src.error_message = ""
    src.updated_at    = datetime.now(timezone.utc)
    src.save()

def _mark_error(src, msg: str):
    src.status        = SourceStatus.ERROR
    src.error_message = msg
    src.updated_at    = datetime.now(timezone.utc)
    src.save()