import os
import io
import asyncio
import hashlib
from datetime import datetime
from fastapi import UploadFile, HTTPException
from app.models.models import DocumentModel
from app.services.extractor import extract_clauses_from_bytes
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


def save_file(file_bytes: bytes, filename: str, department: str) -> str:
    safe_name = sanitize_filename(filename)
    dept_dir = os.path.join(UPLOAD_DIR, department)
    os.makedirs(dept_dir, exist_ok=True)
    path = os.path.join(dept_dir, safe_name)

    counter = 1
    while os.path.exists(path):
        name, ext = os.path.splitext(safe_name)
        path = os.path.join(dept_dir, f"{name}_{counter}{ext}")
        counter += 1

    with open(path, "wb") as f:
        f.write(file_bytes)

    return path


# -------------------------
# Manual Upload
# -------------------------
async def ingest_upload(file: UploadFile, user_id: str, purpose: str = "Manual Upload"):
    file_bytes = await file.read()
    return await asyncio.to_thread(
        ingest_file,
        file_bytes=file_bytes,
        filename=file.filename,
        user_id=user_id,
        purpose=purpose,
        content_type=file.content_type,
        source="manual",
        email_context=None,
    )


# -------------------------
# Bytes ingestion  (called by email pipeline)
# -------------------------
def ingest_bytes(file_bytes: bytes, filename: str, user_id: str, purpose: str,
                 content_type: str = None, source: str = "email",
                 email_context: dict = None):
    return ingest_file(
        file_bytes=file_bytes,
        filename=filename,
        user_id=user_id,
        purpose=purpose,
        content_type=content_type,
        source=source,
        email_context=email_context,
    )


# -------------------------
# Core ingestion logic
# -------------------------
def ingest_file(file_bytes: bytes, filename: str, user_id: str, purpose: str,
                content_type: str = None, source: str = "manual",
                email_context: dict = None):

    logger.info(f"[INGEST] Ingestion started | file={filename} | source={source} | user={user_id}")

    if email_context:
        logger.info(f"[INGEST] Email context | subject={email_context.get('subject')} | from={email_context.get('from')}")

    file_hash = compute_file_hash(file_bytes)

    # ── Deduplication ─────────────────────────────────────────────────────────
    existing = DocumentModel.objects(file_hash=file_hash, user_id=str(user_id)).first()
    if existing:
        logger.info(f"[INGEST] Duplicate detected | file={filename} | document_id={existing.id}")
        raise HTTPException(
            status_code=409,
            detail={
                "status": "duplicate",
                "document_id": str(existing.id),
                "filename": existing.filename,
            }
        )

    # ── Encryption check ──────────────────────────────────────────────────────
    encrypted_external = False
    if filename.lower().endswith(".pdf"):
        encrypted_external = is_encrypted_pdf(file_bytes)
        if encrypted_external:
            logger.info(f"[INGEST] Encrypted PDF detected | file={filename}")

    # ── Extraction / enrichment ───────────────────────────────────────────────
    if encrypted_external:
        metadata = {
            "department":     "General",
            "sensitivity":    "high",
            "routing_status": "locked",
            "summary":        "Encrypted document — content cannot be extracted.",
        }
        clauses = []
    else:
        logger.info(f"[INGEST] Clause extraction started | file={filename}")
        enriched = extract_clauses_from_bytes(
            file_bytes,
            filename,
            enrich=True,
            email_context=email_context,   # ← passed to extractor
        )
        metadata = enriched.get("metadata", {})
        clauses = enriched.get("clauses", [])
        logger.info(f"[INGEST] Clause extraction completed | clauses={len(clauses)}")

    department = metadata.get("department", "general").strip().lower()
    logger.info(f"[INGEST] Routed to department: {department}")

    # ── Persist file ──────────────────────────────────────────────────────────
    file_path = save_file(file_bytes, filename, department=department)
    logger.info(f"[INGEST] File saved | path={file_path}")

    # ── Persist to MongoDB ────────────────────────────────────────────────────
    doc = DocumentModel(
        user_id=str(user_id),
        filename=os.path.basename(file_path),
        storage_path=file_path,
        encrypted_external=encrypted_external,
        file_hash=file_hash,
        file_size=len(file_bytes),
        content_type=content_type,
        version=1,
        source=source.strip().lower(),
        purpose=purpose,
        received_at=datetime.utcnow(),
        clauses=clauses,
        summary=metadata.get("summary", {}),
        department=department,
        sensitivity=metadata.get("sensitivity", "medium").strip().lower(),
        routing_status=metadata.get("routing_status", "review").strip().lower(),
        status="locked" if encrypted_external else "ready",
    )
    logger.info("[INGEST] Persisting document to MongoDB")
    doc.save()

    logger.info(f"[INGEST] Ingestion completed successfully | document_id={doc.id}")

    return {
        "status":      "created",
        "document_id": str(doc.id),
        "filename":    doc.filename,
        "summary":     doc.summary,
        "department":  doc.department,
        "sensitivity": doc.sensitivity,
    }