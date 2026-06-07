# Use slim Python base image for Ubuntu-compatible deployment
FROM python:3.11-slim

# Prevent Python from creating .pyc files and buffering output
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV PYTHONPATH=/app

# Set working directory
WORKDIR /app

# Install only required system dependencies for OCR and OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
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
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Preinstall pip requirements
COPY backend/requirements.txt .
RUN pip install --upgrade pip setuptools wheel \
 && pip install -r requirements.txt

# Copy application code after dependencies for better caching
COPY backend /app

# Health check validates OCR runtime and dependency imports
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["python", "tools/ocr_healthcheck.py"]

# Expose app port
EXPOSE 8000

# Start FastAPI
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
