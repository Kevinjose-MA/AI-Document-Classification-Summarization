import mimetypes
import fitz
import docx
import email
import math
import re
import json
import logging
import os
from PIL import Image
import pytesseract
from email import policy
from bs4 import BeautifulSoup
from io import BytesIO
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS
from app.services.llm import generate_text_completion

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Pipeline constants
# ─────────────────────────────────────────────────────────────────────────────

_CHUNK_TOKENS_TARGET   = 1_500   # ~1,100 words — safe below 200K context window
_CHUNK_OVERLAP_TOKENS  = 150     # carry-forward for cross-boundary context
_MIN_CHUNK_TOKENS      = 200     # merge undersized tail chunks
_MAP_MAX_TOKENS        = 600     # per-chunk summary — kept tight
_REDUCE_MAX_TOKENS     = 2_000   # final consolidation
_MAX_CONCURRENT_CALLS  = 8       # ThreadPoolExecutor max workers


# -------------------------
# Text extraction
# -------------------------

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    PDFs have an embedded text layer — OCR is not needed.
    Extracts text preserving reading order via block layout mode.
    """
    pages = []
    with fitz.open(stream=file_bytes, filetype="pdf") as doc:
        for page_num, page in enumerate(doc):
            # sort=True preserves reading order across columns/tables
            blocks = page.get_text("blocks", sort=True)
            page_text = "\n".join(
                b[4] for b in blocks if isinstance(b[4], str)
            ).strip()
            if page_text:
                pages.append(page_text)
    return "\n".join(pages)


def extract_text_from_docx(file_bytes: bytes) -> str:
    """
    Extracts text from paragraphs AND tables.
    Original only read paragraphs, silently dropping all table content.
    """
    doc = docx.Document(BytesIO(file_bytes))
    parts = []
    for element in doc.element.body:
        tag = element.tag.split("}")[-1]
        if tag == "p":
            text = "".join(n.text or "" for n in element.iter() if hasattr(n, "text"))
            if text.strip():
                parts.append(text.strip())
        elif tag == "tbl":
            ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            for row in element.findall(f".//{{{ns}}}tr"):
                cells = row.findall(f".//{{{ns}}}tc")
                row_text = " | ".join(
                    "".join(n.text or "" for n in c.iter() if hasattr(n, "text")).strip()
                    for c in cells
                )
                if row_text.strip():
                    parts.append(row_text)
    return "\n".join(parts)


def extract_text_from_txt(file_bytes: bytes) -> str:
    return file_bytes.decode("utf-8", errors="ignore")


def extract_text_from_eml(file_bytes: bytes) -> str:
    """
    Collects ALL readable parts from multipart emails.
    Original returned on first match, silently dropping the rest.
    Prefers plain text; falls back to stripped HTML only if no plain text found.
    """
    msg = email.message_from_bytes(file_bytes, policy=policy.default)
    plain_parts = []
    html_parts = []

    for part in msg.walk():
        ct = part.get_content_type()
        try:
            if ct == "text/plain":
                plain_parts.append(part.get_content())
            elif ct == "text/html":
                html_parts.append(
                    BeautifulSoup(part.get_content(), "html.parser").get_text(separator="\n")
                )
        except Exception:
            pass

    if plain_parts:
        return "\n\n".join(plain_parts)
    return "\n\n".join(html_parts)


# -------------------------
# Text extraction from image
# -------------------------

def _summarize_image_with_vision(file_bytes: bytes, filename: str) -> dict:
    """
    Uses Claude vision to extract and summarize image content directly.
    Handles screenshots, diagrams, flowcharts, scanned forms — anything
    Tesseract would struggle with. Returns the same dict shape as generate_summary.
    """
    import base64

    # Detect mime type from image header bytes
    mime = "image/png"
    if file_bytes[:3] == b"\xff\xd8\xff":
        mime = "image/jpeg"
    elif file_bytes[:4] == b"\x89PNG":
        mime = "image/png"
    elif file_bytes[:4] in (b"GIF8", b"GIF9"):
        mime = "image/gif"
    elif file_bytes[:4] == b"RIFF" and file_bytes[8:12] == b"WEBP":
        mime = "image/webp"

    b64 = base64.standard_b64encode(file_bytes).decode("utf-8")

    prompt = (
        "Analyze this image thoroughly.\n\n"
        "Return a JSON object with these exact keys:\n"
        "{\n"
        '  "purpose": "2-4 sentences describing what this image shows and its intent",\n'
        '  "key_points": ["specific observation 1", "specific observation 2"],\n'
        '  "risks_or_implications": "any actions, decisions, or implications visible",\n'
        '  "image_type": "screenshot | diagram | flowchart | chart | photo | document | other"\n'
        "}\n\n"
        "Rules: Output only the JSON. No markdown. No text before or after."
    )

    try:
        raw = generate_text_completion(
            prompt=prompt,
            max_tokens=800,
            image_b64=b64,
            image_mime=mime,
        )
        result = _parse_json(raw)
        return {
            "purpose":               result.get("purpose", ""),
            "key_points":            result.get("key_points", []),
            "risks_or_implications": result.get("risks_or_implications", ""),
        }
    except Exception as e:
        logger.error(f"Vision summarization failed for {filename}: {e}")
        return {
            "purpose": "Image could not be analyzed.",
            "key_points": [],
            "risks_or_implications": "",
        }


def extract_text_from_image(file_bytes: bytes) -> str:
    """
    Kept for interface compatibility but images are handled via vision in
    extract_clauses — this is only called if something routes here directly.
    Returns empty string since text extraction from images requires OCR or vision.
    """
    return ""


# -------------------------
# OCR noise cleaning (internal)
# -------------------------

def _char_entropy(s: str) -> float:
    if not s:
        return 0.0
    freq: dict = {}
    for c in s:
        freq[c] = freq.get(c, 0) + 1
    n = len(s)
    return -sum((v / n) * math.log2(v / n) for v in freq.values())


def _is_garbage_line(line: str) -> bool:
    if len(line) < 3:
        return True
    alnum_ratio = sum(c.isalnum() for c in line) / len(line)
    if alnum_ratio < 0.4:
        return True
    # Very low entropy = repeated noise characters
    if _char_entropy(line) < 2.0 and len(line) > 20:
        return True
    return False


def _clean_extracted_text(text: str) -> str:
    """Strip OCR artefacts and garbage lines before any LLM call."""
    import unicodedata
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    clean_lines = [
        line.strip()
        for line in text.splitlines()
        if line.strip() and not _is_garbage_line(line.strip())
    ]
    return "\n".join(clean_lines).strip()


# -------------------------
# Department detection  ✅ PRESERVED
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
    """
    Signature preserved. Now uses frequency scoring instead of returning
    on first keyword match — prevents a single mention of 'api' from
    misclassifying a finance doc as Engineering.
    """
    haystack = f"{filename} {text}".lower()
    scores: dict = {}

    for dept, keywords in DEPARTMENT_KEYWORDS.items():
        score = sum(haystack.count(kw) for kw in keywords)
        if score > 0:
            scores[dept] = score

    if not scores:
        return "General"

    return max(scores, key=lambda d: scores[d]).capitalize()


# -------------------------
# Chunking (internal)
# -------------------------

def _estimate_tokens(text: str) -> int:
    return max(1, int(len(text.split()) / 0.75))


def _chunk_text(text: str) -> list:
    """
    Split cleaned text into overlapping chunks at sentence boundaries.
    Replaces the old text[:4000] slice — ensures the full document is processed.
    """
    sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z])", text.strip())
    sentences = [s.strip() for s in sentences if s.strip()]

    chunks = []
    current_words = []
    current_tokens = 0

    for sent in sentences:
        sent_tokens = _estimate_tokens(sent)
        if current_tokens + sent_tokens > _CHUNK_TOKENS_TARGET and current_words:
            chunks.append(" ".join(current_words))
            overlap_word_count = _CHUNK_OVERLAP_TOKENS * 3 // 4
            current_words = current_words[-overlap_word_count:]
            current_tokens = _estimate_tokens(" ".join(current_words))
        current_words.extend(sent.split())
        current_tokens += sent_tokens

    if current_words:
        leftover = " ".join(current_words)
        if _estimate_tokens(leftover) < _MIN_CHUNK_TOKENS and chunks:
            chunks[-1] += " " + leftover
        else:
            chunks.append(leftover)

    return [
        {"chunk_id": i, "text": c, "token_estimate": _estimate_tokens(c)}
        for i, c in enumerate(chunks)
    ]


# -------------------------
# Clause logic              ✅ PRESERVED
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
    """
    Preserved exactly. Added paragraph fallback so non-insurance docs
    don't return a single giant clause blob.
    """
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    clauses, buffer, section = [], "", "General"
    found_heading = False

    for line in lines:
        if is_heading(line):
            found_heading = True
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

    # Fallback: no headings found → split by paragraphs
    if not found_heading or not clauses:
        paragraphs = re.split(r"\n{2,}", text.strip())
        clauses = [
            {"clause": p.strip(), "section": "General", "tags": extract_tags(p)}
            for p in paragraphs
            if p.strip() and len(p.strip()) > 50
        ]

    return clauses


# -------------------------
# Map-reduce internals
# -------------------------

_MAP_SYSTEM = (
    "You are an expert document analyst. Extract structured information from document "
    "segments with precision. Never use vague language. Ground every claim in the text. "
    "Respond ONLY with valid JSON — no markdown fences, no preamble."
)

def _map_prompt(chunk: dict, total_chunks: int) -> str:
    """
    Uses a plain labelled-line format instead of JSON template.
    Embedding document text inside a JSON template causes parse failures
    whenever the text contains quotes, backslashes, or newlines.
    Plain text output is parsed in Python — the LLM never has to produce JSON
    while also seeing arbitrary document content.
    """
    cid = chunk["chunk_id"]
    position = "opening" if cid == 0 else ("closing" if cid == total_chunks - 1 else "middle")
    return (
        f"Segment: {cid + 1} of {total_chunks} ({position})\n\n"
        f"---BEGIN SEGMENT---\n{chunk['text']}\n---END SEGMENT---\n\n"
        "Analyze this segment. Respond using EXACTLY this labelled format — "
        "no JSON, no markdown, no extra text:\n\n"
        "SUMMARY: <2-4 sentences summarizing this segment specifically>\n"
        "POINTS:\n- <specific factual point>\n- <specific factual point>\n"
        "PEOPLE: <comma-separated names or NONE>\n"
        "ORGS: <comma-separated organization names or NONE>\n"
        "DATES: <comma-separated dates/deadlines or NONE>\n"
        "FIGURES: <comma-separated numbers/amounts or NONE>\n"
        "ACTIONS: <comma-separated action items or NONE>"
    )


def _parse_map_response(raw: str, chunk_id: int) -> dict:
    """
    Parse the labelled-line map response into a structured dict.
    This format is robust to document content containing quotes or special chars.
    """
    def extract_label(text: str, label: str) -> str:
        m = re.search(rf"^{label}:\s*(.+?)(?=\n[A-Z]+:|$)", text, re.MULTILINE | re.DOTALL)
        return m.group(1).strip() if m else ""

    def split_csv(val: str) -> list:
        if not val or val.upper() == "NONE":
            return []
        return [v.strip() for v in val.split(",") if v.strip() and v.strip().upper() != "NONE"]

    # Extract POINTS block as bullet list
    points_match = re.search(r"^POINTS:\n(.*?)(?=\n[A-Z]+:|$)", raw, re.MULTILINE | re.DOTALL)
    points_raw = points_match.group(1) if points_match else ""
    key_points = [
        line.lstrip("-• ").strip()
        for line in points_raw.splitlines()
        if line.strip().lstrip("-• ").strip()
    ]

    return {
        "chunk_id":           chunk_id,
        "local_summary":      extract_label(raw, "SUMMARY"),
        "key_points":         key_points,
        "entities": {
            "people":        split_csv(extract_label(raw, "PEOPLE")),
            "organizations": split_csv(extract_label(raw, "ORGS")),
            "dates":         split_csv(extract_label(raw, "DATES")),
            "figures":       split_csv(extract_label(raw, "FIGURES")),
            "locations":     [],
        },
        "decisions_or_actions": split_csv(extract_label(raw, "ACTIONS")),
        "quality_flags":      ["none"],
        "degraded":           False,
    }


def _reduce_prompt(chunk_results: list, filename: str) -> str:
    """
    Reduce prompt also avoids embedding structured data inside a JSON template.
    Summaries are passed as plain labelled blocks; JSON is requested separately
    at the end where the model only needs to produce JSON, not read it.
    """
    segments_text = "\n\n".join(
        f"[Segment {r['chunk_id'] + 1}{'  DEGRADED' if r.get('degraded') else ''}]\n"
        f"{r.get('local_summary', '[unavailable]')}"
        for r in chunk_results
    )
    # Merge and deduplicate entities in Python
    merged: dict = {"people": [], "organizations": [], "dates": [], "figures": [], "locations": []}
    for r in chunk_results:
        for key in merged:
            merged[key].extend(r.get("entities", {}).get(key, []))
    for key in merged:
        seen: set = set()
        deduped = []
        for v in merged[key]:
            norm = v.lower().strip()
            if norm not in seen:
                seen.add(norm)
                deduped.append(v)
        merged[key] = deduped

    entity_lines = "\n".join(
        f"{k.upper()}: {', '.join(v) if v else 'none'}"
        for k, v in merged.items()
    )

    return (
        f"Document: {filename}\n"
        f"Segments analyzed: {len(chunk_results)} | "
        f"Degraded: {sum(1 for r in chunk_results if r.get('degraded'))}\n\n"
        f"ENTITIES FOUND:\n{entity_lines}\n\n"
        f"SEGMENT SUMMARIES:\n{segments_text}\n\n"
        "Based on the above, produce a JSON object with these exact keys. "
        "Values must be plain strings or arrays of strings — no nested objects, "
        "no special characters that would break JSON parsing:\n"
        '{\n'
        '  "purpose": "3-5 sentence overview of why this document exists",\n'
        '  "key_points": ["finding 1", "finding 2", "finding 3"],\n'
        '  "risks_or_implications": "obligations or risks in one paragraph",\n'
        '  "data_quality_notes": "any extraction issues or none identified",\n'
        '  "confidence_score": 0.9\n'
        '}\n\n'
        "Rules: Output only the JSON object. No markdown. No text before or after. "
        "Use only straight double quotes. Escape any quotes inside string values with backslash."
    )


def _parse_json(raw: str) -> dict:
    """
    Robust JSON parser with multiple fallback strategies:
    1. Strip markdown fences
    2. Extract first {...} block if there is surrounding text
    3. Fix common LLM JSON mistakes (trailing commas, single quotes)
    """
    clean = raw.strip()

    # Strip markdown fences
    clean = re.sub(r"^```(?:json)?\s*", "", clean, flags=re.MULTILINE)
    clean = re.sub(r"```\s*$", "", clean, flags=re.MULTILINE)
    clean = clean.strip()

    # Try direct parse first
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        pass

    # Extract first complete {...} block — handles models that add preamble text
    brace_match = re.search(r"\{[\s\S]*\}", clean)
    if brace_match:
        candidate = brace_match.group(0)
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

        # Fix trailing commas before } or ]
        fixed = re.sub(r",\s*([}\]])", r"\1", candidate)
        try:
            return json.loads(fixed)
        except json.JSONDecodeError:
            pass

    # Last resort: raise with the cleaned content for logging
    raise json.JSONDecodeError(f"Could not parse JSON from response", clean, 0)


def _summarize_chunk_sync(chunk: dict, total_chunks: int) -> dict:
    """Sync per-chunk call with 3x exponential backoff. Never raises — degrades gracefully."""
    import time
    last_error = None
    for attempt in range(3):
        try:
            raw = generate_text_completion(_map_prompt(chunk, total_chunks), max_tokens=_MAP_MAX_TOKENS)
            parsed = _parse_map_response(raw, chunk["chunk_id"])
            return parsed
        except Exception as e:
            last_error = e
            logger.warning(f"Chunk {chunk['chunk_id']} attempt {attempt + 1} failed: {e}")
            time.sleep(2 ** attempt)

    logger.error(f"Chunk {chunk['chunk_id']} permanently failed: {last_error}")
    return {
        "chunk_id": chunk["chunk_id"],
        "key_points": [],
        "entities": {"people": [], "organizations": [], "dates": [], "figures": [], "locations": []},
        "decisions_or_actions": [],
        "local_summary": "[Extraction failed for this segment]",
        "quality_flags": ["extraction_failed"],
        "degraded": True,
    }


def _run_map_phase(chunks: list) -> list:
    """Concurrent chunk summarization via ThreadPoolExecutor."""
    from concurrent.futures import ThreadPoolExecutor, as_completed
    total = len(chunks)
    results = [None] * total

    with ThreadPoolExecutor(max_workers=_MAX_CONCURRENT_CALLS) as executor:
        future_to_idx = {
            executor.submit(_summarize_chunk_sync, chunk, total): i
            for i, chunk in enumerate(chunks)
        }
        for future in as_completed(future_to_idx):
            idx = future_to_idx[future]
            results[idx] = future.result()

    return results


# -------------------------
# Summary generation        ✅ SIGNATURE PRESERVED
# -------------------------

def generate_summary(text: str) -> dict:
    """
    Signature preserved exactly:
        generate_summary(text: str) -> {"purpose": str, "key_points": list, "risks_or_implications": str}

    Internals replaced: now runs full map-reduce pipeline instead of
    truncating to text[:4000] in a single LLM call.
    """
    if not text or len(text.strip()) < 50:
        return {
            "purpose": "Insufficient content available.",
            "key_points": [],
            "risks_or_implications": ""
        }

    clean = _clean_extracted_text(text)
    chunks = _chunk_text(clean)

    # Single-chunk shortcut — skip map phase for small documents
    if len(chunks) == 1:
        chunk_results = [_summarize_chunk_sync(chunks[0], 1)]
    else:
        chunk_results = _run_map_phase(chunks)

    # Reduce phase with one repair attempt on JSON failure
    prompt = _reduce_prompt(chunk_results, filename="document")
    for attempt in range(2):
        try:
            raw = generate_text_completion(prompt, max_tokens=_REDUCE_MAX_TOKENS)
            result = _parse_json(raw)
            return {
                "purpose":               result.get("purpose", ""),
                "key_points":            result.get("key_points", []),
                "risks_or_implications": result.get("risks_or_implications", ""),
            }
        except (json.JSONDecodeError, Exception) as e:
            if attempt == 0:
                logger.warning(f"Consolidation parse failed: {e}. Attempting repair.")
                prompt += (
                    f"\n\nYour previous response was not valid JSON. Error: {e}. "
                    "Return ONLY the corrected JSON object, no other text."
                )
            else:
                logger.error("Consolidation repair pass also failed.")
                return {
                    "purpose": "Summary generation failed after retries.",
                    "key_points": [],
                    "risks_or_implications": ""
                }


# -------------------------
# Main entry                ✅ SIGNATURE PRESERVED
# -------------------------

def extract_clauses_from_bytes(file_bytes: bytes, filename: str, enrich=True):
    """
    Primary entry point — works directly on in-memory bytes.
    No temp files, no disk I/O. Called by ingestion service.
    """
    ext = os.path.splitext(filename)[1].lower()

    # ── Text Extraction ───────────────────────────────────────────────────────
    if ext == ".pdf":
        raw_text = extract_text_from_pdf(file_bytes)
    elif ext in [".doc", ".docx"]:
        raw_text = extract_text_from_docx(file_bytes)
    elif ext == ".txt":
        raw_text = extract_text_from_txt(file_bytes)
    elif ext == ".eml":
        raw_text = extract_text_from_eml(file_bytes)
    elif ext in [".png", ".jpg", ".jpeg"]:
        # Images handled entirely via vision — skip text pipeline
        if enrich:
            vision_summary = _summarize_image_with_vision(file_bytes, filename)
            return {
                "clauses": [],
                "metadata": {
                    "summary":        vision_summary,
                    "department":     "General",
                    "sensitivity":    "medium",
                    "routing_status": "review",
                }
            }
        return {"clauses": [], "metadata": {}}
    else:
        raw_text = extract_text_from_pdf(file_bytes)

    # ── OCR Cleaning ──────────────────────────────────────────────────────────
    raw_text = _clean_extracted_text(raw_text)

    # ── Clause Splitting ──────────────────────────────────────────────────────
    clauses = split_into_clauses(raw_text)

    metadata = {}

    if enrich:
        metadata["summary"]        = generate_summary(raw_text)
        metadata["department"]     = detect_department(raw_text, filename)
        metadata["sensitivity"]    = "medium"
        metadata["routing_status"] = "review"

    return {
        "clauses": clauses,
        "metadata": metadata
    }


def extract_clauses(file_path: str, enrich=True):
    """
    Legacy entry point — reads file from disk then delegates to extract_clauses_from_bytes.
    Kept so any callers outside ingestion still work without changes.
    """
    with open(file_path, "rb") as f:
        file_bytes = f.read()
    filename = os.path.basename(file_path)
    return extract_clauses_from_bytes(file_bytes, filename, enrich=enrich)