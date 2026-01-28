# app/services/summarizer.py

from typing import List, Dict
import re
from app.services.llm import generate_text_completion

def generate_document_summary(clauses: List[Dict], max_words: int = 150) -> str:
    """
    Generate a concise summary from document clauses using LLM.
    """
    full_text = " ".join([c["clause"] for c in clauses])
    text_to_summarize = full_text[:3000]  # limit to first 3000 chars

    prompt = (
        f"Summarize the following document clearly and concisely "
        f"(max {max_words} words):\n{text_to_summarize}"
    )

    summary = generate_text_completion(prompt)
    summary = re.sub(r"\s+", " ", summary).strip()
    return summary
