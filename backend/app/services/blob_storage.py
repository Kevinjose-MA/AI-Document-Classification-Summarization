import os
import io
import requests
from typing import Optional
from app.core.config import (
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
    CLOUDINARY_UPLOAD_FOLDER,
)

try:
    import cloudinary
    import cloudinary.uploader as cloudinary_uploader
except ImportError:
    cloudinary = None
    cloudinary_uploader = None


def is_configured() -> bool:
    return bool(
        CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET
        and cloudinary is not None
        and cloudinary_uploader is not None
    )


def _init_cloudinary() -> None:
    if not is_configured():
        raise RuntimeError("Cloudinary is not configured.")
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
        secure=True,
    )


def save(file_bytes: bytes, filename: str, content_type: str = "application/octet-stream", public_id: Optional[str] = None) -> dict:
    """Upload raw bytes to Cloudinary and return metadata."""
    if not is_configured():
        raise RuntimeError("Cloudinary is not configured.")

    _init_cloudinary()
    payload = io.BytesIO(file_bytes)
    payload.name = filename

    if not public_id:
        public_id = os.path.splitext(filename)[0]

    upload_options = {
        "resource_type": "auto",
        "public_id": public_id,
        "overwrite": False,
        "unique_filename": False,
        "folder": CLOUDINARY_UPLOAD_FOLDER,
    }
    result = cloudinary_uploader.upload(payload, **upload_options)
    return {
        "public_id": result.get("public_id"),
        "url": result.get("secure_url") or result.get("url"),
        "resource_type": result.get("resource_type"),
        "format": result.get("format"),
    }


def load(url: str) -> tuple[bytes, str]:
    """Fetch bytes from an externally hosted file URL."""
    if not url:
        raise FileNotFoundError("No remote file URL available.")

    response = requests.get(url, timeout=30)
    if response.status_code != 200:
        raise FileNotFoundError(f"Unable to load remote file from {url}: {response.status_code}")

    content_type = response.headers.get("Content-Type", "application/octet-stream")
    return response.content, content_type


def delete(public_id: str) -> None:
    """Delete a Cloudinary asset by public ID."""
    if not is_configured() or not public_id:
        return

    _init_cloudinary()
    try:
        cloudinary_uploader.destroy(public_id, resource_type="auto")
    except Exception:
        pass
