# app/api/documents.py

from fastapi import APIRouter, UploadFile, File, Depends, BackgroundTasks, HTTPException
from typing import List
from datetime import datetime
import os
import imaplib
import email

from app.models.models import DocumentModel, UserModel
from app.services.extractor import extract_clauses
from app.services.summarizer import generate_document_summary
from app.core.config import EMAIL_USER, EMAIL_PASS, SECRET_KEY
from fastapi.security import HTTPBearer
import jwt

# -------------------------
# Router and directories
# -------------------------
router = APIRouter()
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# -------------------------
# Authentication
# -------------------------
security = HTTPBearer()

def get_current_user(token=Depends(security)):
    try:
        payload = jwt.decode(token.credentials, SECRET_KEY, algorithms=["HS256"])
        user = UserModel.objects(id=payload["user_id"]).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except:
        raise HTTPException(status_code=401, detail="Invalid token")


# -------------------------
# Helper functions
# -------------------------
def sanitize_filename(filename: str) -> str:
    """
    Remove unsafe characters from filename
    """
    return "".join(c for c in filename if c.isalnum() or c in (" ", ".", "_", "-")).strip()

def get_unique_filepath(original_name: str) -> str:
    """
    Save file with original name; append _1, _2 if collision
    """
    safe_name = sanitize_filename(original_name)
    file_path = os.path.join(UPLOAD_DIR, safe_name)

    counter = 1
    while os.path.exists(file_path):
        name, ext = os.path.splitext(safe_name)
        file_path = os.path.join(UPLOAD_DIR, f"{name}_{counter}{ext}")
        counter += 1

    return file_path

def process_file(file_path: str, user_id: str, purpose: str):
    """
    Unified processing for any document: manual upload or email attachment.
    Extract clauses, generate summary, save to DB.
    """
    try:
        clauses = extract_clauses(file_path)
        summary = generate_document_summary(clauses)

        doc = DocumentModel(
            user_id=str(user_id),  # ✅ ensure string
            filename=os.path.basename(file_path),
            purpose=purpose,
            received_at=datetime.utcnow(),
            clauses=clauses,
            summary=summary,
            status="ready"
        )
        doc.save()
        print(f"Processed document {file_path} for user {user_id} with summary")
    except Exception as e:
        print(f"[ERROR] Failed processing file {file_path}: {e}")


# -------------------------
# Manual Upload
# -------------------------
@router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    user=Depends(get_current_user)
):
    file_path = get_unique_filepath(file.filename)  # ✅ preserve original name
    with open(file_path, "wb") as f:
        f.write(await file.read())

    background_tasks.add_task(
        process_file,
        file_path,
        str(user.id),
        "Manual Upload"
    )

    return {"filename": os.path.basename(file_path), "status": "processing"}


# -------------------------
# List user documents
# -------------------------
@router.get("/documents")
def list_documents(user=Depends(get_current_user)):
    docs = DocumentModel.objects(user_id=str(user.id))
    return [
        {
            "id": str(d.id),
            "filename": d.filename,
            "purpose": d.purpose,
            "received_at": d.received_at,
            "status": d.status,
            "summary": d.summary
        } for d in docs
    ]


# -------------------------
# Email ingestion
# -------------------------
def fetch_email_attachments(user_id: str):
    """
    Fetch all unread emails from all folders, process attachments,
    mark emails as read, and handle problematic files.
    """
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(EMAIL_USER, EMAIL_PASS)

        # List all folders dynamically
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
                    print(f"[WARNING] Could not select folder {folder}, skipping...")
                    continue
            except Exception as e:
                print(f"[WARNING] Could not select folder {folder}: {e}")
                continue

            typ, data = mail.search(None, 'UNSEEN')
            if typ != "OK":
                print(f"[WARNING] SEARCH failed in folder {folder}, skipping...")
                continue

            mail_ids = data[0].split()
            for num in mail_ids:
                if num in ingested_email_ids:
                    continue

                try:
                    typ, msg_data = mail.fetch(num, '(RFC822)')
                    if typ != "OK":
                        print(f"[WARNING] FETCH failed for email ID {num}")
                        continue

                    for response_part in msg_data:
                        if isinstance(response_part, tuple):
                            msg = email.message_from_bytes(response_part[1])
                            subject = msg["subject"] or "No Subject"

                            for part in msg.walk():
                                if part.get_content_maintype() == "multipart":
                                    continue
                                if part.get("Content-Disposition") is None:
                                    continue

                                filename = part.get_filename()
                                if filename:
                                    file_path = get_unique_filepath(filename)
                                    with open(file_path, "wb") as f:
                                        f.write(part.get_payload(decode=True))

                                    process_file(
                                        file_path,
                                        str(user_id),
                                        purpose=f"Email: {subject}"
                                    )

                            # Mark email as read
                            mail.store(num, '+FLAGS', '\\Seen')
                            ingested_email_ids.add(num)

                except Exception as e:
                    print(f"[ERROR] Failed to process email ID {num}: {e}")
                    continue

        mail.logout()
        print(f"[INFO] Finished fetching email attachments for user {user_id}")

    except Exception as e:
        print(f"[ERROR] Email ingestion failed: {e}")


@router.post("/documents/ingest-email")
def ingest_email(
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user)
):
    """
    Trigger background email ingestion for the logged-in user
    """
    background_tasks.add_task(fetch_email_attachments, str(user.id))
    return {"message": "Email ingestion started in background"}
