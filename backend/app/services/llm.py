# app/llm.py

import os
import json
import asyncio
import threading
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from dotenv import load_dotenv
import google.generativeai as genai

from app.services.prompts import MISTRAL_SYSTEM_PROMPT_TEMPLATE, build_mistral_prompt, build_batch_prompt

# Load environment
load_dotenv()

# ── API Key Rotation & Fallback System ──────────────────────────────────────
class APIKeyManager:
    """Thread-safe API key manager with fallback and cooldown tracking."""
    
    def __init__(self):
        self.keys = self._load_api_keys()
        self.current_key_index = 0
        self.key_cooldowns = {}  # Track cooldowns per key
        self.lock = threading.Lock()
        self.logger_prefix = "[APIKeyManager]"
    
    def _load_api_keys(self) -> List[str]:
        """Load API keys from environment (GEMINI_API, GEMINI_API_1, GEMINI_API_2, ..., GEMINI_API_5)."""
        keys = []
        # Primary key
        primary = os.getenv("GEMINI_API", "").strip()
        if primary:
            keys.append(primary)
        # Fallback keys
        for i in range(1, 6):
            key = os.getenv(f"GEMINI_API_{i}", "").strip()
            if key:
                keys.append(key)
        return keys if keys else [os.getenv("GEMINI_API", "")]  # Fallback to single key
    
    def get_available_key(self) -> Optional[str]:
        """Get next available API key, respecting cooldowns."""
        with self.lock:
            if not self.keys:
                print(f"{self.logger_prefix} No API keys available")
                return None
            
            now = datetime.now()
            # Try current key first
            for _ in range(len(self.keys)):
                key = self.keys[self.current_key_index]
                cooldown_until = self.key_cooldowns.get(key)
                
                if cooldown_until is None or now >= cooldown_until:
                    return key
                
                # Move to next key
                self.current_key_index = (self.current_key_index + 1) % len(self.keys)
            
            # All keys on cooldown, return the one with earliest cooldown
            earliest_key = min(self.key_cooldowns.items(), key=lambda x: x[1])[0]
            print(f"{self.logger_prefix} All keys on cooldown, using {earliest_key[:20]}...")
            return earliest_key
    
    def mark_quota_exceeded(self, key: str, cooldown_minutes: int = 60):
        """Mark a key as quota-exceeded for a period."""
        with self.lock:
            cooldown_until = datetime.now() + timedelta(minutes=cooldown_minutes)
            self.key_cooldowns[key] = cooldown_until
            print(f"{self.logger_prefix} Key {key[:20]}... on cooldown until {cooldown_until}")
    
    def rotate_key(self):
        """Move to next available key."""
        with self.lock:
            self.current_key_index = (self.current_key_index + 1) % len(self.keys)


api_key_manager = APIKeyManager()
genai_models = {}  # Cache models per key
model_lock = threading.Lock()


def get_genai_model():
    """Get or create GenAI model for the current available API key."""
    global genai_models
    
    key = api_key_manager.get_available_key()
    if not key:
        raise ValueError("No API keys available")
    
    if key not in genai_models:
        with model_lock:
            if key not in genai_models:  # Double-check after lock
                genai.configure(api_key=key)
                genai_models[key] = genai.GenerativeModel("models/gemini-2.5-flash")
    
    return genai_models[key], key


def _sanitize_llm_output(raw: str) -> str:
    """
    Strips codeblock wrappers, whitespace, and markdown formatting.
    """
    raw = raw.strip()
    if raw.startswith("```json"):
        raw = raw[7:]
    elif raw.startswith("```"):
        raw = raw[3:]
    return raw.strip("`").strip()


def query_mistral_with_clauses(question: str, clauses: list) -> dict:
    prompt = build_mistral_prompt(question, clauses)

    try:
        model, _ = get_genai_model()
        response = model.generate_content(
            contents=[{"role": "user", "parts": [prompt]}],
            generation_config={
                "temperature": 0.2,
                "top_p": 0.7,
                "max_output_tokens": 150
            }
        )
        clean = _sanitize_llm_output(response.text)
        return json.loads(clean)

    except json.JSONDecodeError:
        return {
            "answer": "The document does not contain a clear or relevant clause to address this query.",
            "supporting_clause": "None",
            "explanation": "Gemini could not return valid JSON."
        }

    except Exception as e:
        print(f"❌ LLM Error (single): {e}")
        return {
            "answer": "LLM processing error. Please try again.",
            "supporting_clause": "None",
            "explanation": str(e)
        }


def query_mistral_batch(questions: list, clauses: list) -> dict:
    prompt = build_batch_prompt(questions, clauses)

    try:
        model, _ = get_genai_model()
        response = model.generate_content(
            contents=[{"role": "user", "parts": [prompt]}],
            generation_config={
                "temperature": 0.2,
                "top_p": 0.7,
                "max_output_tokens": 300
            }
        )
        clean = _sanitize_llm_output(response.text)
        parsed = json.loads(clean)

        if isinstance(parsed, dict) and all(k.startswith("Q") for k in parsed.keys()):
            return parsed
        else:
            raise ValueError("Unexpected response format")

    except json.JSONDecodeError:
        return {f"Q{i+1}": "Invalid or incomplete answer." for i in range(len(questions))}

    except Exception as e:
        print(f"❌ LLM Error (batch): {e}")
        return {f"Q{i+1}": "LLM processing error." for i in range(len(questions))}


async def warmup_llm():
    try:
        prompt = """
        You are a helpful assistant. Answer clearly.
        Format:
        {
          "Q1": { "answer": "Sample answer", "clauses": "Relevant clauses here" }
        }
        """
        response = await asyncio.to_thread(
            get_genai_model().generate_content,
            contents=[{"role": "user", "parts": [prompt]}],
            generation_config={"response_mime_type": "application/json"},
        )
        print("✅ Gemini warmup successful.")
        if hasattr(response, "usage_metadata"):
            print(f"🔢 Warmup token usage: {response.usage_metadata.total_token_count}")
    except Exception as e:
        print(f"❌ Gemini warmup failed: {e}")


async def call_llm_batch(prompts: List[str]) -> Dict[str, Dict[str, str]]:
    results = {}

    for offset, prompt in enumerate(prompts):
        try:
            response = await asyncio.to_thread(
                get_genai_model().generate_content,
                contents=[{"role": "user", "parts": [prompt]}],
                generation_config={"response_mime_type": "application/json"},
            )
            content = getattr(response, "text", None) or response.candidates[0].content.parts[0].text
            content = _sanitize_llm_output(content)
            parsed = json.loads(content)

            for i in range(1, 100):
                q_key = f"Q{i}"
                if q_key not in parsed:
                    break
                # ✅ Fix: Check if parsed[q_key] is a dict before calling .get()
                if isinstance(parsed[q_key], dict):
                    answer = parsed[q_key].get("answer", "").strip()
                else:
                    answer = str(parsed[q_key]).strip()

                if answer and len(answer) > 5:
                    results[q_key] = {"answer": answer}
                else:
                    results[q_key] = {"answer": "No matching clause found."}

            if hasattr(response, "usage_metadata"):
                print(f"🔢 Tokens used in batch {offset + 1}: {response.usage_metadata.total_token_count}")

        except Exception as e:
            print(f"❌ Gemini batch {offset + 1} failed:", e)
            for i in range(len(prompts)):
                results[f"Q{offset + i + 1}"] = {"answer": "An error occurred while generating the answer."}

    return results


def generate_text_completion(
    prompt: str,
    max_tokens: int = 500,
    image_b64: str | None = None,
    image_mime: str = "image/png",
    response_mime_type: str | None = None,
    max_retries: int = 2,
) -> str:
    """
    Wrapper for text or vision completion with automatic fallback on quota exhaustion.
    Retries with different API keys if one hits quota limits.
    """
    last_error = None
    
    for attempt in range(max_retries):
        try:
            model, current_key = get_genai_model()
            
            if image_b64:
                import base64
                from PIL import Image
                from io import BytesIO
                img_bytes = base64.b64decode(image_b64)
                pil_image = Image.open(BytesIO(img_bytes))
                contents = [pil_image, prompt]
            else:
                contents = [{"role": "user", "parts": [prompt]}]

            generation_config = {
                "temperature": 0.1,
                "top_p": 0.7,
                "max_output_tokens": max_tokens,
            }
            if response_mime_type:
                generation_config["response_mime_type"] = response_mime_type

            response = model.generate_content(
                contents=contents,
                generation_config=generation_config,
            )

            text = None
            if hasattr(response, "text") and response.text:
                text = response.text
            elif hasattr(response, "candidates") and response.candidates:
                parts = response.candidates[0].content.parts
                if parts and hasattr(parts[0], "text"):
                    text = parts[0].text

            if not text or not text.strip():
                print("⚠️ Empty LLM summary response")
                return ""

            return _sanitize_llm_output(text)

        except Exception as e:
            error_str = str(e).lower()
            last_error = e
            
            # Check for quota/rate limit errors
            if any(term in error_str for term in ["quota", "rate limit", "429", "resource exhausted"]):
                current_key = api_key_manager.get_available_key()
                print(f"⚠️ Quota exhausted on current key, marking cooldown (attempt {attempt+1}/{max_retries})")
                api_key_manager.mark_quota_exceeded(current_key, cooldown_minutes=60)
                
                # Try next key
                if attempt < max_retries - 1:
                    api_key_manager.rotate_key()
                    continue
            
            print(f"❌ LLM error in generate_text_completion (attempt {attempt+1}/{max_retries}): {e}")
            
            if attempt < max_retries - 1:
                import time
                time.sleep(0.5)  # Brief delay before retry
                continue
    
    print(f"❌ All retries exhausted. Last error: {last_error}")
    return ""
