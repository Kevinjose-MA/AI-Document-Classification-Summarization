#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if command -v apt-get >/dev/null 2>&1; then
  echo "Installing system dependencies for OCR..."
  sudo apt-get update
  sudo apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libgl1 \
    libglib2.0-0 \
    poppler-utils \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    gcc \
    libffi-dev \
    libpq-dev \
    curl
  sudo rm -rf /var/lib/apt/lists/*
else
  echo "Warning: apt-get not available. Please install system deps manually: tesseract-ocr, libgl1, libglib2.0-0, poppler-utils, libsm6, libxext6, libxrender1, libgomp1." >&2
fi

echo "Installing Python dependencies from backend/requirements.txt..."
python3 -m pip install --upgrade pip setuptools wheel
python3 -m pip install -r backend/requirements.txt

echo "OCR environment setup complete."
