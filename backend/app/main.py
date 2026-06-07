from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Union, Dict
from fastapi.middleware.cors import CORSMiddleware

from app.services.extractor import extract_clauses
from app.api.ingestion_sources import router as ingestion_router
from app.services.parser import extract_dynamic_keywords_from_clauses, parse_query_with_dynamic_map
from app.services.embeddings import count_tokens, encode_texts
import faiss
import numpy as np
import google.generativeai as genai
from dotenv import load_dotenv
import os
import json
import re
import asyncio
import hashlib
import time
import logging

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import requests
from fastapi import HTTPException
from bs4 import BeautifulSoup
from urllib.parse import urlparse

from app.api.documents import router as documents_router
from app.core.config import init_db
from app.api.auth import router as auth_router
from app.models.models import DocumentModel

from apscheduler.schedulers.background import BackgroundScheduler
from app.services.escalation import run_escalation_check
 

# Initialize MongoDB
init_db()

# Load env vars
load_dotenv()
api_key = os.getenv("GEMINI_API")

# FastAPI app
app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1", tags=["Auth"])
app.include_router(documents_router, prefix="/api/v1", tags=["Documents"])
app.include_router(ingestion_router, prefix="/api/v1")

# Embedding model and tokenizer
genai_model = None


def get_genai_model():
    global genai_model
    if genai_model is None:
        if not api_key:
            raise ValueError("GEMINI_API key not set in environment")
        genai.configure(api_key=api_key)
        genai_model = genai.GenerativeModel("models/gemini-2.5-flash")
    return genai_model

QA_CACHE_FILE = "qa_cache.json"
FAISS_CACHE_DIR = Path("faiss_cache")
qa_cache = {}
if os.path.exists(QA_CACHE_FILE):
    with open(QA_CACHE_FILE, "r", encoding="utf-8") as f:
        try:
            qa_cache = json.load(f)
            print(f"✅ Loaded QA cache with {len(qa_cache)} entries")
        except json.JSONDecodeError:
            print("⚠ QA cache corrupted. Starting fresh.")
            qa_cache = {}


class HackRxRequest(BaseModel):
    documents: Union[str, List[str]]
    questions: List[str]
    
scheduler = BackgroundScheduler(timezone="UTC")


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger(__name__)


def format_hackrx_answer(answer_type: str, value: str) -> str:
    formats = {
        "secret_token": f"Your secret token is {value}"
    }
    return formats.get(answer_type, value)


def is_document_url(url: str) -> bool:
    path = urlparse(url).path.lower()
    return path.endswith((".pdf", ".docx", ".doc", ".txt"))


def detect_input_language(text: str) -> str:
    if re.search(r'[\u0D00-\u0D7F]', text):
        return "mal"
    return "eng"


def handle_dynamic_get_requests(answer_text: str) -> str:
    whitelist = ["hackrx.in"]
    urls = re.findall(r"https?://\S+", str(answer_text))

    def find_key_recursive(obj, keys):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k in keys:
                    return v
                result = find_key_recursive(v, keys)
                if result is not None:
                    return result
        elif isinstance(obj, list):
            for item in obj:
                result = find_key_recursive(item, keys)
                if result is not None:
                    return result
        return None

    for url in urls:
        if any(domain in url for domain in whitelist):
            try:
                resp = requests.get(url, timeout=10, allow_redirects=True)
                if resp.status_code == 200:
                    try:
                        data = resp.json()
                        if isinstance(data, dict):
                            if "data" in data and isinstance(data["data"], dict):
                                for key in ["token", "secret", "city"]:
                                    if key in data["data"]:
                                        if key in ["token", "secret"]:
                                            return format_hackrx_answer("secret_token", str(data["data"][key]).strip())
                                        return str(data["data"][key]).strip()
                            for key in ["token", "secret", "city"]:
                                if key in data:
                                    if key in ["token", "secret"]:
                                        return format_hackrx_answer("secret_token", str(data[key]).strip())
                                    return str(data[key]).strip()
                        value = find_key_recursive(data, ["token", "secret", "city"])
                        if value is not None:
                            return str(value).strip()
                        return json.dumps(data, ensure_ascii=False)
                    except ValueError:
                        return resp.text.strip()
            except Exception as e:
                print(f"Error fetching {url}: {e}")
                continue
    return str(answer_text)


def url_hash(url: str) -> str:
    return hashlib.md5(url.encode()).hexdigest()


def score_clause_hybrid(clause, embedding_score, keywords, tags):
    keyword_score = sum(1 for k in clause.lower().split() if k in keywords)
    tag_score = sum(1 for t in clause.lower().split() if t in tags)
    return embedding_score + 0.2 * keyword_score + 0.5 * tag_score


def save_clause_cache(url: str, clauses: List[Dict[str, str]]):
    os.makedirs("clause_cache", exist_ok=True)
    with open(f"clause_cache/{url_hash(url)}.json", "w", encoding="utf-8") as f:
        json.dump(clauses, f, indent=2, ensure_ascii=False)


def extract_keywords(question: str) -> List[str]:
    tokens = re.findall(r'\b\w+\b', question.lower())
    stopwords = {
        "what", "is", "the", "of", "under", "a", "an", "how", "for", "and", "in", "on",
        "to", "does", "do", "are", "this", "that", "it", "if", "any", "cover", "covered"
    }
    return [t for t in tokens if t not in stopwords and len(t) > 2]


def extract_tags(text):
    words = re.findall(r'\w+', text.lower())
    stopwords = {
        "the", "and", "for", "that", "with", "from", "this", "will", "which",
        "are", "you", "not", "but", "all", "any", "your", "has", "have"
    }
    return list(set(w for w in words if len(w) > 3 and w not in stopwords))


def extract_section_from_clause(clause_text):
    for line in clause_text.split('\n'):
        line = line.strip()
        if line.isupper() and len(line.split()) <= 10:
            return line
        if re.match(r"^\d+[\.\)]\s", line):
            return line
    return "Unknown"


def normalize_clause_items(raw_clauses: List) -> List[Dict[str, str]]:
    valid_clauses = []
    for item in raw_clauses:
        if isinstance(item, dict):
            clause_text = item.get("clause", "").strip()
            section = item.get("section") or extract_section_from_clause(clause_text)
            tags = item.get("tags") or extract_tags(clause_text)
        elif isinstance(item, str):
            clause_text = item.strip()
            section = extract_section_from_clause(clause_text)
            tags = extract_tags(clause_text)
        else:
            continue

        if clause_text:
            valid_clauses.append({
                "clause": clause_text,
                "section": section,
                "tags": tags,
            })
    return valid_clauses


def build_faiss_index(clauses: List[Dict]) -> tuple:
    texts = [c["clause"] for c in clauses]
    vectors = encode_texts(texts)
    index = faiss.IndexFlatL2(vectors.shape[1])
    index.add(np.array(vectors).astype(np.float32))
    return index, texts


def load_or_build_faiss_index(cache_key: str, clauses: List[Dict]) -> tuple:
    FAISS_CACHE_DIR.mkdir(exist_ok=True)
    index_path = FAISS_CACHE_DIR / f"{cache_key}.index"
    clauses_path = FAISS_CACHE_DIR / f"{cache_key}.clauses.json"

    if index_path.exists() and clauses_path.exists():
        try:
            index = faiss.read_index(str(index_path))
            with clauses_path.open("r", encoding="utf-8") as f:
                cached_clauses = normalize_clause_items(json.load(f))
            if cached_clauses and index.ntotal == len(cached_clauses):
                return index, cached_clauses
        except Exception as e:
            logger.warning(f"[FAISS] Failed to load persisted index {cache_key}: {e}. Rebuilding.")

    valid_clauses = normalize_clause_items(clauses)
    if not valid_clauses:
        raise ValueError("No valid clauses available for FAISS indexing")

    index, _ = build_faiss_index(valid_clauses)
    faiss.write_index(index, str(index_path))
    with clauses_path.open("w", encoding="utf-8") as f:
        json.dump(valid_clauses, f, ensure_ascii=False)
    return index, valid_clauses


def trim_clauses(clauses: List[Dict[str, str]], max_tokens: int = 2000) -> List[Dict[str, str]]:
    result = []
    total = 0
    for clause_obj in clauses:
        clause = clause_obj["clause"]
        tokens = count_tokens(clause)
        if total + tokens > max_tokens:
            break
        result.append({"clause": clause})
        total += tokens
    return result


dynamic_keyword_map = {}


def split_compound_question(question: str) -> List[str]:
    if any(word in question.lower() for word in ["rs", "claim", "settle", "reimburse", "amount", "treatment"]):
        return [question.strip()]
    return [
        part.strip().capitalize()
        for part in re.split(r"\b(?:and|also|then|while|meanwhile|simultaneously|additionally|,)\b", question)
        if len(part.strip()) > 10
    ]


def get_top_clauses(question: str, index, clause_texts: List[str]) -> List[str]:
    question_embedding = encode_texts([question])
    _, indices = index.search(np.array(question_embedding).astype(np.float32), k=50)
    top_faiss_clauses = [clause_texts[i] for i in indices[0]]

    keywords = extract_keywords(question)
    keyword_scores = {
        clause: sum(k in clause.lower() for k in keywords)
        for clause in clause_texts
    }
    top_keyword_clauses = sorted(keyword_scores.items(), key=lambda x: x[1], reverse=True)[:20]
    keyword_clauses = [c for c, _ in top_keyword_clauses]

    parsed = parse_query_with_dynamic_map(question, dynamic_keyword_map)
    tags = parsed.get("tags", [])
    tag_matched = [c for c in clause_texts if any(tag in c.lower() for tag in tags)]

    combined = list(dict.fromkeys(tag_matched + top_faiss_clauses + keyword_clauses))
    return combined[:12]


async def retrieve_clauses_parallel(questions, index, clause_texts):
    loop = asyncio.get_event_loop()
    question_clause_map = {}

    clause_lookup = {
        c["clause"]: {
            "section": c.get("section", "Unknown"),
            "tags": c.get("tags", extract_tags(c["clause"]))
        }
        for c in clause_texts
        if c.get("clause")
    }

    def process(q):
        MIN_SIMILARITY = 0.50
        question_embedding = encode_texts([q], convert_to_numpy=True)
        D, I = index.search(np.array(question_embedding).astype(np.float32), k=50)
        faiss_matches = []
        for idx, dist in zip(I[0], D[0]):
            if idx < len(clause_texts):
                score = 1 - (dist / 2)
                if score >= MIN_SIMILARITY:
                    faiss_matches.append((clause_texts[idx]["clause"], score))

        keywords = extract_keywords(q)
        parsed = parse_query_with_dynamic_map(q, dynamic_keyword_map)
        tags = parsed.get("tags", [])

        all_candidates = []
        for clause, score in faiss_matches:
            hybrid = score_clause_hybrid(clause, score, keywords, tags)
            all_candidates.append((clause, hybrid))

        sorted_clauses = [c for c, _ in sorted(all_candidates, key=lambda x: x[1], reverse=True)]

        if len(sorted_clauses) < 5 and tags:
            fallback_matches = [
                c["clause"] for c in clause_texts
                if any(t in c["clause"].lower() for t in tags)
            ]
            sorted_clauses += [c for c in fallback_matches if c not in sorted_clauses]

        if len(sorted_clauses) < 5:
            fallback = [
                c["clause"] for c in clause_texts
                if any(k in c["clause"].lower() for k in keywords)
            ]
            sorted_clauses += [c for c in fallback if c not in sorted_clauses]

        if not sorted_clauses:
            sorted_clauses = [c["clause"] for c in clause_texts[:5]]

        top_trimmed = sorted_clauses[:15]
        per_question_token_limit = min(2500, max(30000 // max(len(questions), 1), 800))

        trimmed = trim_clauses(
            [{"clause": c} for c in top_trimmed],
            max_tokens=per_question_token_limit
        )

        enriched = []
        for clause_obj in trimmed:
            text = clause_obj["clause"]
            meta = clause_lookup.get(text, {})
            enriched.append({
                "clause": text,
                "section": meta.get("section", "Unknown"),
                "tags": meta.get("tags", extract_tags(text))
            })

        return q, enriched or []

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [loop.run_in_executor(executor, process, q) for q in questions]
        results = await asyncio.gather(*futures)

    for question, enriched_clauses in results:
        question_clause_map[question] = enriched_clauses or []

    return question_clause_map


def build_prompt_batch(question_clause_map: Dict[str, List[Dict[str, str]]]) -> str:
    prompt_entries = []

    for i, (question, clauses) in enumerate(question_clause_map.items(), start=1):
        lang = detect_input_language(question)
        lang_hint = "Malayalam" if lang == "mal" else "English"

        clause_blocks = []
        for c in clauses:
            section = c.get("section", "Unknown").strip().replace('"', "'")
            tags = ", ".join(c.get("tags", []))
            text = c.get("clause", "").strip().replace('"', "'")
            clause_blocks.append(f"Section: {section}\nTags: {tags}\nClause: {text}")

        joined_clauses = "\n\n".join(clause_blocks)
        prompt_entries.append(
            f'"Q{i}": {{"question": "{question}", "language": "{lang_hint}", "clauses": "{joined_clauses}"}}'
        )

    entries = ",\n".join(prompt_entries)

    full_prompt = f"""
You are a reliable assistant.

Your job is to answer each user question using only the provided document clauses. Do not use any external knowledge or assumptions. If no clause answers the question clearly, say: "No matching clause found."

Return answers in valid JSON format:
{{
  "Q1": {{"answer": "..." }},
  "Q2": {{"answer": "..." }},
  ...
}}

Instructions:
- Use only the clause content.
- If multiple clauses help, summarize them.
- Use the Section to understand context.
- Tags are just helpful hints.
- Be concise. Max 25 words.
- Language: Respect the input language for each question.

Question-Clause Mapping:
{{
{entries}
}}
""".strip()
    return full_prompt


async def call_llm(prompt: str, offset: int, batch_size: int) -> Dict[str, Dict[str, str]]:
    try:
        response = await asyncio.to_thread(
            get_genai_model().generate_content,
            contents=[{"role": "user", "parts": [prompt]}],
            generation_config={"response_mime_type": "application/json"},
        )
        content = None
        try:
            content = getattr(response, "text", None) or response.candidates[0].content.parts[0].text
        except Exception:
            content = str(response)

        content = (content or "").strip()
        try:
            parsed = json.loads(content)
        except Exception:
            m = re.search(r'(\{[\s\S]*\})', content)
            parsed = json.loads(m.group(1)) if m else {}

        validated = {}
        for i in range(batch_size):
            q_key = f"Q{i + 1}"
            full_key = f"Q{offset + i + 1}"
            answer = parsed.get(q_key, {}).get("answer", "").strip() if isinstance(parsed, dict) else ""
            if isinstance(answer, str) and answer.lower().strip() in ["no matching clause found.", "no clause found"]:
                validated[full_key] = {"answer": "No matching clause found."}
            elif answer:
                validated[full_key] = {"answer": answer}
            else:
                validated[full_key] = {"answer": "No matching clause found."}
        return validated

    except Exception as e:
        print("❌ LLM Error:", e)
        return {
            f"Q{offset + i + 1}": {"answer": "An error occurred while generating the answer."}
            for i in range(batch_size)
        }


def extract_best_sentence(question: str, clauses: List[Dict[str, str]]) -> str:
    keywords = extract_keywords(question)
    best_sentence = None
    best_score = 0

    for clause_obj in clauses:
        clause_text = clause_obj.get("clause", "")
        sentences = re.split(r'(?<=[.!?])\s+', clause_text)
        for sentence in sentences:
            sentence_lower = sentence.lower()
            score = sum(1 for kw in keywords if kw in sentence_lower)
            if score and all(kw in sentence_lower for kw in keywords):
                score += 1
            if score > best_score:
                best_score = score
                best_sentence = sentence.strip()

    return best_sentence if best_sentence else None


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/api/v1/hackrx/run")
async def hackrx_run(req: HackRxRequest):
    global qa_cache, dynamic_keyword_map
    start_time = time.time()

    doc_urls = req.documents if isinstance(req.documents, list) else [req.documents]
    all_clauses = []
    secret_token_result = None

    # ── Pass 1: load document clauses from cache or extract ──────────────────
    for url in doc_urls:
        try:
            if is_document_url(url):
                cache_path = f"clause_cache/{url_hash(url)}.json"
                if Path(cache_path).exists():
                    with open(cache_path, "r", encoding="utf-8") as f:
                        clauses = json.load(f)
                else:
                    clauses = extract_clauses(url)
                    if clauses:
                        save_clause_cache(url, clauses)
                    else:
                        continue
                all_clauses.extend(clauses)
        except Exception as e:
            print(f"❌ Failed to process {url}: {e}")

    # ── Check for embedded hackrx.in API URLs inside clauses ─────────────────
    for clause_obj in all_clauses:
        urls = re.findall(r"https?://\S+", clause_obj.get("clause", ""))
        for u in urls:
            if "hackrx.in" in u:
                try:
                    resp = requests.get(u, timeout=10)
                    if resp.status_code == 200:
                        try:
                            data = resp.json()
                        except ValueError:
                            data = None
                        if isinstance(data, dict):
                            if "data" in data and isinstance(data["data"], dict):
                                if "token" in data["data"] or "secret" in data["data"]:
                                    secret_token_result = str(
                                        data["data"].get("token") or data["data"].get("secret")
                                    ).strip()
                            if "token" in data or "secret" in data:
                                secret_token_result = str(
                                    data.get("token") or data.get("secret")
                                ).strip()
                except Exception as e:
                    print(f"❌ Failed API fetch for clause URL {u}: {e}")

    if secret_token_result:
        return {"answers": [format_hackrx_answer("secret_token", secret_token_result)]}

    # ── Handle whitelisted non-document URLs directly ─────────────────────────
    whitelist = ["hackrx.in", "example.com"]
    for url in doc_urls:
        if any(domain in url for domain in whitelist) and not is_document_url(url):
            try:
                resp = requests.get(url, timeout=10)
                if resp.status_code == 200:
                    content_type = resp.headers.get("Content-Type", "")
                    if "application/json" in content_type:
                        try:
                            data = resp.json()
                            for key in ["token", "secret"]:
                                if "data" in data and isinstance(data["data"], dict) and key in data["data"]:
                                    return {"answers": [format_hackrx_answer("secret_token", str(data["data"][key]))]}
                                if key in data:
                                    return {"answers": [format_hackrx_answer("secret_token", str(data[key]))]}
                        except Exception:
                            pass
                    elif "text/html" in content_type:
                        soup = BeautifulSoup(resp.text, "html.parser")
                        token_div = soup.find(id="token")
                        if token_div:
                            return {"answers": [format_hackrx_answer("secret_token", token_div.get_text(strip=True))]}
                    else:
                        value = resp.text.strip()
                        if re.fullmatch(r"[0-9a-fA-F]{64}", value):
                            return {"answers": [format_hackrx_answer("secret_token", value)]}
            except Exception as e:
                print(f"❌ Error fetching {url}: {e}")
            return {"answers": ["Failed to fetch content from non-document URL."]}

    # ── Pass 2: full clause extraction (including non-document URLs) ──────────
    for url in doc_urls:
        try:
            if not is_document_url(url):
                try:
                    resp = requests.get(url, timeout=5)
                    if resp.status_code == 200:
                        all_clauses.extend([{"clause": resp.text.strip()}])
                    continue
                except Exception as e:
                    print(f"❌ Error fetching non-document URL: {e}")
                    continue

            cache_path = f"clause_cache/{url_hash(url)}.json"
            if Path(cache_path).exists():
                with open(cache_path, "r", encoding="utf-8") as f:
                    clauses = json.load(f)
            else:
                clauses = extract_clauses(url)
                if clauses:
                    save_clause_cache(url, clauses)
                else:
                    continue
            all_clauses.extend(clauses)
        except Exception as e:
            print(f"❌ Failed to extract from URL {url}:", e)

    if not all_clauses:
        return {"answers": ["No valid clauses found in provided documents."] * len(req.questions)}

    # ── Check hackrx.in URLs embedded in clause text ─────────────────────────
    whitelist = ["hackrx.in"]
    for clause_obj in all_clauses:
        clause_text = clause_obj.get("clause", "")
        urls_in_clause = re.findall(r"https?://\S+", clause_text)
        for u in urls_in_clause:
            if any(domain in u for domain in whitelist):
                try:
                    resp = requests.get(u, timeout=10)
                    if resp.status_code == 200:
                        try:
                            data = resp.json()
                            for key in ["token", "secret", "city"]:
                                if key in data:
                                    return {"answers": [str(data[key]).strip()]}
                            if "data" in data and isinstance(data["data"], dict):
                                for key in ["token", "secret", "city"]:
                                    if key in data["data"]:
                                        return {"answers": [str(data["data"][key]).strip()]}
                            return {"answers": [json.dumps(data, ensure_ascii=False)]}
                        except Exception:
                            return {"answers": [str(resp.text).strip()]}
                except Exception as e:
                    print(f"❌ Error fetching direct API from clause: {e}")

    # ── Build / load FAISS index ──────────────────────────────────────────────
    dynamic_keyword_map = extract_dynamic_keywords_from_clauses(all_clauses)

    cache_key = url_hash("|".join(sorted(doc_urls)))
    if not hasattr(app.state, "cache_indices"):
        app.state.cache_indices = {}

    if cache_key in app.state.cache_indices:
        index = app.state.cache_indices[cache_key]["index"]
        clause_texts = app.state.cache_indices[cache_key]["clauses"]
    else:
        index, clause_texts = load_or_build_faiss_index(cache_key, all_clauses)
        app.state.cache_indices[cache_key] = {"index": index, "clauses": clause_texts}

    # ── Question splitting + cache lookup ─────────────────────────────────────
    split_questions = []
    original_map = {}
    for q in req.questions:
        parts = split_compound_question(q)
        for part in parts:
            original_map[part] = q
            split_questions.append(part)

    uncached_questions = [q for q in split_questions if q not in qa_cache]
    question_clause_map = await retrieve_clauses_parallel(uncached_questions, index, clause_texts)

    for q in uncached_questions:
        best_sentence = extract_best_sentence(q, question_clause_map.get(q, []))
        qa_cache[q] = best_sentence if best_sentence else "No matching clause found"

    # ── Batch LLM calls ───────────────────────────────────────────────────────
    batch_size = 15
    batches = [list(question_clause_map.items())[i:i + batch_size] for i in range(0, len(uncached_questions), batch_size)]
    prompts = [build_prompt_batch(dict(batch)) for batch in batches]
    tasks = [call_llm(prompt, i * batch_size, len(batch)) for i, (prompt, batch) in enumerate(zip(prompts, batches))]
    results = await asyncio.gather(*tasks)

    merged = {}
    for result in results:
        merged.update(result)

    for i, question in enumerate(uncached_questions):
        answer = merged.get(f"Q{i+1}", {}).get("answer", "No answer found.")
        qa_cache[question] = answer

    with open(QA_CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(qa_cache, f, indent=2, ensure_ascii=False)

    # ── Assemble final answers ────────────────────────────────────────────────
    answers_map = {}
    for sq, orig_q in original_map.items():
        answers_map.setdefault(orig_q, []).append(qa_cache.get(sq, "No answer found."))

    final_answers = [" ".join(answers_map.get(q, ["No answer found."])) for q in req.questions]

    processed_final_answers = []
    for ans in final_answers:
        handled = handle_dynamic_get_requests(ans)
        if isinstance(handled, dict):
            handled = json.dumps(handled, ensure_ascii=False)
        processed_final_answers.append(str(handled))

    print(f"✅ Total /run latency: {time.time() - start_time:.2f} seconds")
    return {"answers": processed_final_answers}


# ─────────────────────────────────────────────────────────────────────────────
# Startup — FAISS warmup only.
# Email ingestion is NOT run at startup.
# Each user triggers their own sync via POST /api/v1/documents/ingest-email
# ─────────────────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def warmup_model():
    logger.info("[INGEST] Application startup triggered")
    app.state.cache_indices = {}
    os.makedirs("clause_cache", exist_ok=True)
    FAISS_CACHE_DIR.mkdir(exist_ok=True)

    if os.getenv("ENABLE_ESCALATION_SCHEDULER", "false").lower() == "true":
        scheduler.add_job(
            run_escalation_check,
            trigger="interval",
            minutes=30,
            id="escalation_check",
            replace_existing=True,
            max_instances=1,
        )
        scheduler.start()
        logging.getLogger("ESCALATION").info(
            "Escalation scheduler started - checking every 30 minutes. "
            "SLA thresholds: high=2h, medium=24h, low=72h"
        )

    logger.info("[INGEST] Startup completed without model or FAISS warmup")

@app.on_event("shutdown")
async def shutdown_event():
    if scheduler.running:
        scheduler.shutdown(wait=False)
