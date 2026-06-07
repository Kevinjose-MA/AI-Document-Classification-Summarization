#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

python3 tools/ocr_healthcheck.py
python3 tools/ocr_test_harness.py --input-dir uploads --output-dir ocr_test_results --max-images 10
python3 tools/ocr_validation.py --input-dir uploads --output-dir ocr_validation_results --max-images 10

echo "CI OCR validation complete."
