# 🚀 AI Document Intelligence SaaS

AI-powered SaaS platform for intelligent document classification, semantic search, and AI-assisted document querying.

Built to demonstrate production-grade AI architecture using LLMs, vector search, and scalable backend design.

---

## 💡 Why This Project Matters

Organizations handle thousands of unstructured documents daily — contracts, policies, reports, compliance files, and more. Manual processing is slow, error-prone, and expensive.

This platform demonstrates how Large Language Models + vector databases can automate document understanding, classification, and question answering at scale.

---

## ✨ Core Features

* 📄 Secure document upload (PDF, images, etc.)
* 🧠 AI-based document classification
* 🔎 Semantic clause retrieval using vector search (FAISS)
* 💬 AI-powered question answering on documents
* 🔁 Duplicate detection using SHA256 hashing
* 📦 Document version control per user
* ⚡ Optimized LLM batching for reduced latency & cost

---

## 🏗️ System Architecture

User → FastAPI Backend → AI Processing Layer → FAISS Vector Index → MongoDB

**Processing Flow:**

1. Document uploaded
2. File hash generated for deduplication
3. Content extracted and split into clauses
4. Clauses indexed into FAISS
5. LLM classifies document type
6. User can query document using semantic + AI retrieval

---

## 🛠️ Tech Stack

**Frontend**

* React.js
* Tailwind CSS

**Backend**

* FastAPI
* Python 3.11+

**AI & Retrieval**

* Google Gemini (LLM-based classification & Q&A)
* FAISS (Vector similarity search)

**Database**

* MongoDB (Document metadata & versioning)

**Deployment**

* Docker
* Cloud Deployment Ready

---

## 📂 Project Structure (Not fully updated)

```
app/
 ├── main.py                    # FastAPI application entry point
 ├── config.py                  # Environment & configuration management
 ├── database.py                # MongoDB connection setup
 ├── models/
 │     ├── document_model.py    # Document schema & versioning
 │     └── user_model.py        # User schema (if applicable)
 ├── services/
 │     ├── ingestion_service.py # Document upload & processing pipeline
 │     ├── classification_service.py  # LLM-based document classification
 │     ├── qa_service.py        # Question answering logic
 │     ├── vector_service.py    # FAISS indexing & retrieval
 │     └── cache_service.py     # Clause & response caching
 ├── utils/
 │     ├── hash_utils.py        # SHA256 duplicate detection
 │     ├── text_processing.py   # Clause splitting & cleaning
 │     └── prompt_builder.py    # Structured LLM prompts
 ├── clause_cache/              # Stored clause vector indices
 ├── qa_cache.json              # Cached question-answer pairs
 └── requirements.txt
```

````

---

## ⚙️ Installation

### 1️⃣ Clone Repository

```bash
git clone https://github.com/Kevinjose-MA/AI-Document-Classification-Summarization.git
cd https://github.com/Kevinjose-MA/AI-Document-Classification-Summarization.git
````

### 2️⃣ Create Virtual Environment

```bash
python -m venv venv
source venv/bin/activate   # macOS/Linux
venv\Scripts\activate      # Windows
```

### 3️⃣ Install Dependencies

```bash
pip install -r requirements.txt
```

### 4️⃣ Setup Environment Variables

Create a `.env` file:

```
GEMINI_API_KEY=your_api_key
MONGODB_URI=your_mongodb_connection
```

### 5️⃣ Run Application

```bash
uvicorn app.main:app --reload
```

---

## 📈 Engineering Highlights

* Hybrid retrieval (Vector + keyword fallback)
* Parallel clause search for faster responses
* Token trimming to reduce LLM costs
* Structured JSON prompts for stable AI output
* Cached clause indices loaded at startup

---

## 🔮 Future Improvements

* Multi-tenant SaaS billing system
* Role-based access control
* Admin analytics dashboard
* Real-time streaming responses
* Domain fine-tuned models

---

## 👨‍💻 Author

Kevin Jose
AI Engineer | Full-Stack Developer
Building scalable AI SaaS systems.

---

## 📜 License

MIT License

