import json
import os
import faiss
import numpy as np
from app.services.embeddings import encode_texts

# Paths for storage
CLAUSE_FILE = "app/data/clauses.json"
INDEX_FILE = "app/data/faiss.index"

class ClauseRetriever:
    def __init__(self):
        self.clauses = self._load_clauses()
        self.index, _ = self._load_or_build_index()

    def _load_clauses(self):
        """
        Load clauses from the stored JSON file.
        Returns:
            List of clauses with 'clause' key.
        """
        try:
            with open(CLAUSE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            valid_clauses = [c for c in data if "clause" in c and c["clause"].strip()]
            print(f"✅ Loaded {len(valid_clauses)} clauses.")
            return valid_clauses
        except Exception as e:
            print(f"❌ Error loading clauses: {e}")
            return []

    def _load_or_build_index(self):
        """
        Load existing FAISS index or build a new one.
        """
        texts = [c["clause"] for c in self.clauses]
        if not texts:
            print("⚠️ No clauses found to build index.")
            return None, None

        if os.path.exists(INDEX_FILE):
            try:
                index = faiss.read_index(INDEX_FILE)
                print("✅ Loaded FAISS index from disk.")
                return index, None
            except Exception as e:
                print(f"⚠️ Failed to load FAISS index from disk: {e}. Rebuilding...")

        # Build new index
        embeddings = encode_texts(texts, convert_to_numpy=True).astype("float32")
        dim = embeddings.shape[1]
        index = faiss.IndexFlatL2(dim)
        index.add(embeddings)

        # Save index
        os.makedirs(os.path.dirname(INDEX_FILE), exist_ok=True)
        faiss.write_index(index, INDEX_FILE)
        print(f"✅ FAISS index built and saved with {len(texts)} clauses.")

        return index, embeddings

    def search(self, query: str, top_k: int = 5):
        """
        Search top_k most relevant clauses for a given query.
        Returns:
            List of top matching clauses.
        """
        if not self.index or not self.clauses:
            print("⚠️ Search failed: index or clauses not available.")
            return []

        query = query.strip().lower()
        query_embedding = np.array(
            encode_texts([query], convert_to_numpy=True), dtype=np.float32
        )
        D, I = self.index.search(query_embedding, top_k)

        return [self.clauses[i] for i in I[0] if 0 <= i < len(self.clauses)]

    def warmup(self):
        """
        Perform a warmup to load the model into memory.
        """
        print("🚀 Warming up embedding model...")
        _ = encode_texts(["warmup query"], convert_to_numpy=True)
        print("✅ Model warmup complete.")
