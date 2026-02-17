import mimetypes
import fitz
import docx
import email
from PIL import Image
import pytesseract
from email import policy
from bs4 import BeautifulSoup
from io import BytesIO
import re
import os
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS
from app.services.llm import generate_text_completion


# -------------------------
# Text extraction
# -------------------------
def extract_text_from_pdf(file_bytes: bytes) -> str:
    text = []
    with fitz.open(stream=file_bytes, filetype="pdf") as doc:
        for page in doc:
            text.append(page.get_text())
    return "\n".join(text)


def extract_text_from_docx(file_bytes: bytes) -> str:
    doc = docx.Document(BytesIO(file_bytes))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


def extract_text_from_txt(file_bytes: bytes) -> str:
    return file_bytes.decode("utf-8", errors="ignore")


def extract_text_from_eml(file_bytes: bytes) -> str:
    msg = email.message_from_bytes(file_bytes, policy=policy.default)
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                return part.get_content()
            if part.get_content_type() == "text/html":
                return BeautifulSoup(part.get_content(), "html.parser").get_text()
    return msg.get_content()

# -------------------------
# Text extraction from image
# -------------------------

def extract_text_from_image(file_bytes: bytes) -> str:
    try:
        image = Image.open(BytesIO(file_bytes))
        text = pytesseract.image_to_string(image)
        return text
    except Exception:
        return ""



# -------------------------
# Department detection  ✅ NEW
# -------------------------
DEPARTMENT_KEYWORDS = {
    "hr": [
        "resume", "cv", "curriculum vitae", "experience", "education",
        "skills", "employment", "designation", "worked at"
    ],
    "finance": [
        "invoice", "payment", "salary", "payslip", "bank", "gst",
        "amount", "tax", "financial", "balance sheet"
    ],
    "legal": [
        "agreement", "contract", "nda", "terms and conditions",
        "legal", "liability", "clause", "jurisdiction"
    ],
    "engineering": [
        "architecture", "system design", "api", "database",
        "implementation", "code", "specification"
    ]
}


def detect_department(text: str, filename: str) -> str:
    haystack = f"{filename} {text}".lower()

    for dept, keywords in DEPARTMENT_KEYWORDS.items():
        for kw in keywords:
            if kw in haystack:
                return dept.capitalize()

    return "General"


# -------------------------
# Clause logic
# -------------------------
SECTION_KEYWORDS = [
    "exclusions", "inclusions", "coverage", "benefits", "definitions",
    "terms", "conditions", "waiting period", "claim process"
]

def is_heading(line: str) -> bool:
    line = line.lower().strip()
    return len(line) < 120 and any(k in line for k in SECTION_KEYWORDS)

def extract_tags(text: str):
    words = re.findall(r"\w+", text.lower())
    return list(set(w for w in words if len(w) > 3 and w not in ENGLISH_STOP_WORDS))

def split_into_clauses(text: str):
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    clauses, buffer, section = [], "", "General"

    for line in lines:
        if is_heading(line):
            if buffer:
                clauses.append({
                    "clause": buffer.strip(),
                    "section": section,
                    "tags": extract_tags(buffer)
                })
                buffer = ""
            section = line
        else:
            buffer += " " + line

    if buffer.strip():
        clauses.append({
            "clause": buffer.strip(),
            "section": section,
            "tags": extract_tags(buffer)
        })

    return clauses


# -------------------------
# Summary generation
# -------------------------
def generate_summary(text: str) -> dict:
    if not text or len(text.strip()) < 50:
        return {
            "purpose": "Insufficient content available.",
            "key_points": [],
            "risks_or_implications": ""
        }

    prompt = f"""
You are an enterprise document analyst.

Analyze the document and return ONLY valid JSON:

{{
  "purpose": "...",
  "key_points": ["...", "..."],
  "risks_or_implications": "..."
}}

Do not include explanations.
Return strictly valid JSON.

Document:
{text[:8000]}
"""

    response = generate_text_completion(prompt, max_tokens=300)

    try:
        return json.loads(response)
    except Exception:
        # fallback protection
        return {
            "purpose": response.strip(),
            "key_points": [],
            "risks_or_implications": ""
        }


# -------------------------
# Main entry
# -------------------------
def extract_clauses(file_path: str, enrich=True):
    ext = os.path.splitext(file_path)[1].lower()

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    # -------- Text Extraction --------
    if ext == ".pdf":
        raw_text = extract_text_from_pdf(file_bytes)
    elif ext in [".doc", ".docx"]:
        raw_text = extract_text_from_docx(file_bytes)
    elif ext == ".txt":
        raw_text = extract_text_from_txt(file_bytes)
    elif ext == ".eml":
        raw_text = extract_text_from_eml(file_bytes)
    elif ext in [".png", ".jpg", ".jpeg"]:
        raw_text = extract_text_from_image(file_bytes)
    else:
        raw_text = extract_text_from_pdf(file_bytes)  # fallback

    # -------- Clause Splitting --------
    clauses = split_into_clauses(raw_text)

    metadata = {}

    if enrich:
        def clause_to_text(c):
            if isinstance(c, str):
                return c
            if isinstance(c, dict):
                return (
                    c.get("text")
                    or c.get("content")
                    or c.get("clause")
                    or ""
                )
            return ""

        summary_source = "\n".join(
            clause_to_text(c)
            for c in clauses[:40]
            if clause_to_text(c)
        )

        metadata["summary"] = generate_summary(summary_source)
        metadata["department"] = detect_department(raw_text, os.path.basename(file_path))
        metadata["sensitivity"] = "medium"
        metadata["routing_status"] = "review"

    return {
        "clauses": clauses,
        "metadata": metadata
    }
