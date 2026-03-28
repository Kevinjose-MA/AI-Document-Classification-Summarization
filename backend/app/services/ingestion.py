import os
import io
import asyncio
import hashlib
from datetime import datetime
from fastapi import UploadFile, HTTPException
from app.models.models import DocumentModel, AuditLogModel
from app.services.extractor import extract_clauses_from_bytes
from app.services import storage   # ← GridFS storage service
import logging

logger = logging.getLogger("INGEST")

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def sanitize_filename(filename: str) -> str:
    return "".join(c for c in filename if c.isalnum() or c in (" ", ".", "_", "-")).strip()


def compute_file_hash(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()


def is_encrypted_pdf(file_bytes: bytes) -> bool:
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        return reader.is_encrypted
    except Exception:
        return False


def _log(document_id: str, filename: str, event: str, detail: str,
         agent: str = "system", from_status: str = None, to_status: str = None,
         user_id: str = None, metadata: dict = None):
    """Write an entry to the audit log."""
    try:
        AuditLogModel(
            document_id = str(document_id),
            filename    = filename,
            event       = event,
            detail      = detail,
            agent       = agent,
            from_status = from_status,
            to_status   = to_status,
            user_id     = user_id,
            metadata    = metadata or {},
        ).save()
    except Exception as e:
        logger.warning(f"[AUDIT] Failed to write audit log: {e}")


# ── Manual upload ──────────────────────────────────────────────────────────────
async def ingest_upload(file: UploadFile, user_id: str, purpose: str = "Manual Upload"):
    file_bytes = await file.read()
    return await asyncio.to_thread(
        ingest_file,
        file_bytes   = file_bytes,
        filename     = file.filename,
        user_id      = user_id,
        purpose      = purpose,
        content_type = file.content_type,
        source       = "manual",
        email_context = None,
    )


# ── Bytes ingestion (called by email / ingestion sources pipeline) ─────────────
def ingest_bytes(file_bytes: bytes, filename: str, user_id: str, purpose: str,
                 content_type: str = None, source: str = "email",
                 email_context: dict = None):
    return ingest_file(
        file_bytes    = file_bytes,
        filename      = filename,
        user_id       = user_id,
        purpose       = purpose,
        content_type  = content_type,
        source        = source,
        email_context = email_context,
    )


# ── Core ingestion ─────────────────────────────────────────────────────────────
def ingest_file(file_bytes: bytes, filename: str, user_id: str, purpose: str,
                content_type: str = None, source: str = "manual",
                email_context: dict = None):

    logger.info(f"[INGEST] Started | file={filename} | source={source} | user={user_id}")

    file_hash = compute_file_hash(file_bytes)

    # ── Deduplication ──────────────────────────────────────────────────────────
    existing = DocumentModel.objects(file_hash=file_hash, user_id=str(user_id)).first()
    if existing:
        logger.info(f"[INGEST] Duplicate | file={filename} | doc_id={existing.id}")
        raise HTTPException(status_code=409, detail={
            "status": "duplicate",
            "document_id": str(existing.id),
            "filename": existing.filename,
        })

    # ── Encryption check ───────────────────────────────────────────────────────
    encrypted_external = False
    if filename.lower().endswith(".pdf"):
        encrypted_external = is_encrypted_pdf(file_bytes)
        if encrypted_external:
            logger.info(f"[INGEST] Encrypted PDF | file={filename}")

    # ── Extraction / AI enrichment ─────────────────────────────────────────────
    if encrypted_external:
        metadata = {
            "department":     "general",
            "sensitivity":    "high",
            "routing_status": "locked",
            "summary":        "Encrypted document — content cannot be extracted.",
        }
        clauses = []
    else:
        logger.info(f"[INGEST] Extracting | file={filename}")
        enriched = extract_clauses_from_bytes(
            file_bytes,
            filename,
            enrich=True,
            email_context=email_context,
        )
        metadata = enriched.get("metadata", {})
        clauses  = enriched.get("clauses", [])
        logger.info(f"[INGEST] Extracted | clauses={len(clauses)}")

    department     = metadata.get("department", "general").strip().lower()
    routing_status = metadata.get("routing_status", "review").strip().lower()
    sensitivity    = metadata.get("sensitivity", "medium").strip().lower()

    # ── Save to GridFS (cloud — accessible from any machine) ───────────────────
    safe_name = sanitize_filename(filename)
    file_id   = None
    storage_path = None

    try:
        file_id = storage.save(file_bytes, safe_name, content_type or "application/octet-stream")
        logger.info(f"[INGEST] Saved to GridFS | file_id={file_id}")
    except Exception as e:
        # GridFS failed — fall back to local disk so ingestion doesn't hard-fail
        logger.warning(f"[INGEST] GridFS save failed, falling back to disk: {e}")
        dept_dir = os.path.join(UPLOAD_DIR, department)
        os.makedirs(dept_dir, exist_ok=True)
        storage_path = os.path.join(dept_dir, safe_name)
        counter = 1
        while os.path.exists(storage_path):
            name, ext = os.path.splitext(safe_name)
            storage_path = os.path.join(dept_dir, f"{name}_{counter}{ext}")
            counter += 1
        with open(storage_path, "wb") as f:
            f.write(file_bytes)

    # ── Persist document record ────────────────────────────────────────────────
    doc = DocumentModel(
        user_id            = str(user_id),
        filename           = safe_name,
        file_id            = file_id,        # GridFS ID (None if fell back to disk)
        storage_path       = storage_path,   # local path (None if GridFS succeeded)
        encrypted_external = encrypted_external,
        file_hash          = file_hash,
        file_size          = len(file_bytes),
        content_type       = content_type,
        version            = 1,
        source             = source.strip().lower(),
        purpose            = purpose,
        received_at        = datetime.utcnow(),
        clauses            = clauses,
        summary            = metadata.get("summary", {}),
        department         = department,
        sensitivity        = sensitivity,
        routing_status     = routing_status,
        status             = "locked" if encrypted_external else "ready",
        document_type      = metadata.get("document_type"),
        risk_level         = metadata.get("risk_level"),
        language           = metadata.get("language"),
        confidence         = str(metadata.get("confidence", "")),
    )
    doc.save()
    logger.info(f"[INGEST] Saved to MongoDB | doc_id={doc.id}")

    # ── Write audit log ────────────────────────────────────────────────────────
    _log(
        document_id = doc.id,
        filename    = safe_name,
        event       = "ingested",
        detail      = f"Document ingested via {source}. Routed to {department} as '{routing_status}'.",
        agent       = "ingestion-pipeline",
        from_status = None,
        to_status   = routing_status,
        user_id     = str(user_id),
        metadata    = {
            "department":  department,
            "sensitivity": sensitivity,
            "confidence":  metadata.get("confidence"),
            "source":      source,
            "storage":     "gridfs" if file_id else "local",
        },
    )

    return {
        "status":      "created",
        "document_id": str(doc.id),
        "filename":    safe_name,
        "summary":     doc.summary,
        "department":  department,
        "sensitivity": sensitivity,
    }