import gridfs
from bson import ObjectId
from pymongo import MongoClient
from app.core.config import MONGO_URI, DB_NAME   # your existing config vars

# ── Singleton connection ───────────────────────────────────────────────────────
_client = None
_fs     = None

def _get_fs() -> gridfs.GridFS:
    global _client, _fs
    if _fs is None:
        _client = MongoClient(MONGO_URI)
        db  = _client[DB_NAME]
        _fs = gridfs.GridFS(db, collection="document_files")
    return _fs


def save(file_bytes: bytes, filename: str, content_type: str = "application/octet-stream") -> str:
    """Store file in GridFS. Returns the file_id string."""
    fs = _get_fs()
    file_id = fs.put(
        file_bytes,
        filename=filename,
        content_type=content_type,
    )
    return str(file_id)


def load(file_id: str) -> tuple[bytes, str]:
    """Retrieve file bytes and content_type from GridFS."""
    fs = _get_fs()
    try:
        grid_out = fs.get(ObjectId(file_id))
        return grid_out.read(), grid_out.content_type or "application/octet-stream"
    except gridfs.errors.NoFile:
        raise FileNotFoundError(f"File {file_id} not found in GridFS")


def delete(file_id: str) -> None:
    """Delete a file from GridFS."""
    fs = _get_fs()
    try:
        fs.delete(ObjectId(file_id))
    except Exception:
        pass  # already deleted or never existed

