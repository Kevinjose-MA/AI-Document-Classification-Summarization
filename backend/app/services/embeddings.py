from functools import lru_cache

from sentence_transformers import SentenceTransformer
from transformers import AutoTokenizer


EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L12-v2"


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    """Load the embedding model only when retrieval actually needs it."""
    return SentenceTransformer(EMBEDDING_MODEL_NAME)


@lru_cache(maxsize=1)
def get_tokenizer():
    """Load the tokenizer lazily for prompt/context trimming."""
    return AutoTokenizer.from_pretrained(EMBEDDING_MODEL_NAME)


def encode_texts(texts, **kwargs):
    return get_embedding_model().encode(texts, **kwargs)


def count_tokens(text: str) -> int:
    return len(get_tokenizer().tokenize(text))
