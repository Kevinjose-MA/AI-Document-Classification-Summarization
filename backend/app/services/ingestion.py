import os
import io
import hashlib
from datetime import datetime
from fastapi import UploadFile
from app.models.models import DocumentModel
from app.services.extractor import extract_clauses

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
    return ingest_file(
        file_bytes=file_bytes,
        filename=file.filename,
        user_id=user_id,
        purpose=purpose,
        content_type=file.content_type,
        source="manual"
    )


# -------------------------
# Bytes ingestion (Email / WhatsApp)
# -------------------------
def ingest_bytes(file_bytes: bytes, filename: str, user_id: str, purpose: str,
                 content_type: str = None, source: str = "email"):
    return ingest_file(
        file_bytes=file_bytes,
        filename=filename,
        user_id=user_id,
        purpose=purpose,
        content_type=content_type,
        source=source
    )


# -------------------------
# Common ingestion logic
# -------------------------
def ingest_file(file_bytes: bytes, filename: str, user_id: str, purpose: str,
                content_type: str = None, source: str = "manual"):

    file_hash = compute_file_hash(file_bytes)

    # ---- Dedup ----
    existing = DocumentModel.objects(file_hash=file_hash, user_id=str(user_id)).first()
    if existing:
        return {
            "status": "duplicate",
            "document_id": str(existing.id),
            "filename": existing.filename
        }

    # ---- External encryption detection ----
    encrypted_external = False
    if filename.lower().endswith(".pdf"):
        encrypted_external = is_encrypted_pdf(file_bytes)

    # ---- Extraction / metadata ----
    if encrypted_external:
        metadata = {
            "department": "General",
            "sensitivity": "high",
            "routing_status": "locked",
            "summary": "Encrypted document"
        }
        clauses = []
    else:
        # temporary save for extraction
        temp_path = save_file(file_bytes, filename, department="__temp__")
        enriched = extract_clauses(temp_path, enrich=True)
        metadata = enriched.get("metadata", {})
        clauses = enriched.get("clauses", [])
        os.remove(temp_path)

    department = metadata.get("department", "General")

    # ---- Final save (department-based) ----
    file_path = save_file(file_bytes, filename, department=department)

    doc = DocumentModel(
        user_id=str(user_id),
        filename=os.path.basename(file_path),
        storage_path=file_path,
        encrypted_external=encrypted_external,
        file_hash=file_hash,
        file_size=len(file_bytes),
        content_type=content_type,
        version=1,
        source=source,
        purpose=purpose,
        received_at=datetime.utcnow(),
        clauses=clauses,
        summary=metadata.get("summary", "Auto-generated summary"),
        department=department,
        sensitivity=metadata.get("sensitivity", "medium"),
        routing_status=metadata.get("routing_status", "review"),
        status="locked" if encrypted_external else "ready"
    )
    doc.save()

    return {
        "status": "created",
        "document_id": str(doc.id),
        "filename": doc.filename,
        "summary": doc.summary,
        "department": doc.department,
        "sensitivity": doc.sensitivity
    }
