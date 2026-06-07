#!/usr/bin/env python3
import argparse
import json
import logging
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

try:
    import pytesseract
except Exception:
    pytesseract = None

try:
    from app.services.extractor import _preprocess_pil_image, _ocr_fallback_engines, _assess_ocr_confidence
except Exception as exc:
    raise RuntimeError(
        f"Unable to import extractor module. Run from backend root or install dependencies. Error: {exc}"
    )

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("ocr_test_harness")

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".tiff", ".bmp"}


def discover_images(source_dir: Path, max_images: int):
    files = [p for p in sorted(source_dir.rglob("*")) if p.suffix.lower() in IMAGE_EXTENSIONS]
    return files[:max_images]


def write_text(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text or "", encoding="utf-8")


def process_image(image_path: Path, output_dir: Path):
    logger.info(f"Processing image: {image_path}")
    img = Image.open(image_path).convert("RGB")

    baseline_text = ""
    if pytesseract:
        try:
            baseline_text = pytesseract.image_to_string(img, lang="eng")
        except Exception as exc:
            logger.warning(f"Baseline Tesseract failed on {image_path}: {exc}")
    else:
        logger.warning("pytesseract is not installed; skipping raw baseline extraction")

    baseline_conf = _assess_ocr_confidence(baseline_text)
    processed_img = _preprocess_pil_image(img, upscale=True)
    after = _ocr_fallback_engines(processed_img)

    stem = image_path.stem.replace(" ", "_")
    base = output_dir / stem
    write_text(base.with_name(base.name + "_before.txt"), baseline_text)
    write_text(base.with_name(base.name + "_after.txt"), after.get("text", ""))
    meta = {
        "image": str(image_path.relative_to(ROOT)),
        "baseline_confidence": baseline_conf,
        "ocr_confidence": after.get("confidence"),
        "sources": after.get("sources"),
        "warnings": after.get("warnings"),
    }
    (output_dir / f"{base.name}_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    if "table" in after.get("sources", []) or ("\n" in after.get("text", "") and "," in after.get("text", "")):
        write_text(base.with_name(base.name + "_table.csv"), after.get("text", ""))

    logger.info(
        f"{image_path.name}: baseline_conf={baseline_conf:.2f}, ocr_conf={after.get('confidence',0):.2f}, sources={after.get('sources')}"
    )
    return meta


def main():
    parser = argparse.ArgumentParser(description="OCR test harness for backend/uploads images")
    parser.add_argument("--input-dir", default=ROOT / "uploads", type=Path, help="Folder containing test images")
    parser.add_argument("--output-dir", default=ROOT / "ocr_test_results", type=Path, help="Folder to save extracted outputs")
    parser.add_argument("--max-images", default=20, type=int, help="Max number of images to process")
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    images = discover_images(args.input_dir, args.max_images)
    if not images:
        logger.error("No images found in %s", args.input_dir)
        raise SystemExit(1)

    results = []
    for image_path in images:
        try:
            results.append(process_image(image_path, args.output_dir))
        except Exception as exc:
            logger.exception("Failed to process %s: %s", image_path, exc)

    summary_file = args.output_dir / "summary.json"
    summary_file.write_text(json.dumps(results, indent=2), encoding="utf-8")
    logger.info("OCR test harness finished. Results in %s", args.output_dir)


if __name__ == "__main__":
    main()
