#!/usr/bin/env python3
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

try:
    import pytesseract
except Exception as exc:
    print(f"ERROR: pytesseract import failed: {exc}", file=sys.stderr)
    sys.exit(1)

try:
    from app.services.extractor import _ocr_fallback_engines
except Exception as exc:
    print(f"ERROR: failed to import extractor module: {exc}", file=sys.stderr)
    sys.exit(1)

try:
    from paddleocr import PaddleOCR  # noqa: F401
except Exception as exc:
    print(f"ERROR: paddleocr import failed: {exc}", file=sys.stderr)
    sys.exit(1)


def check_command(command):
    try:
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        return result.stdout.decode("utf-8", errors="ignore")
    except Exception as exc:
        print(f"ERROR: command {' '.join(command)} failed: {exc}", file=sys.stderr)
        sys.exit(1)


def main():
    check_command(["tesseract", "--version"])
    print("Tesseract available")

    test_img = Image.new("RGB", (320, 80), "white")
    result = _ocr_fallback_engines(test_img)
    if not isinstance(result, dict) or "confidence" not in result:
        print("ERROR: OCR fallback did not return valid result", file=sys.stderr)
        sys.exit(1)
    print("OCR health check passed", result)


if __name__ == "__main__":
    from PIL import Image
    main()
