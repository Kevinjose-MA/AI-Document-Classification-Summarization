#!/usr/bin/env python3
import argparse
import json
import logging
import math
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

try:
    import pytesseract
except Exception:
    pytesseract = None

try:
    from paddleocr import PaddleOCR
except Exception:
    PaddleOCR = None

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("ocr_validation")

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".tiff", ".bmp"}
VARIANTS = [
    "raw",
    "grayscale",
    "adaptive_threshold",
    "denoise",
    "upscale",
    "sharpen",
    "contrast",
    "full_pipeline",
]


def discover_images(source_dir: Path, max_images: int):
    files = [p for p in sorted(source_dir.rglob("*")) if p.suffix.lower() in IMAGE_EXTENSIONS]
    return files[:max_images]


def to_grayscale(img: Image.Image) -> Image.Image:
    return img.convert("L")


def apply_denoise(img: Image.Image) -> Image.Image:
    arr = cv2.cvtColor(np.array(img.convert("RGB")), cv2.COLOR_RGB2GRAY)
    denoised = cv2.fastNlMeansDenoising(arr, None, h=14, templateWindowSize=7, searchWindowSize=21)
    return Image.fromarray(denoised)


def apply_adaptive_threshold(img: Image.Image) -> Image.Image:
    gray = img.convert("L")
    arr = np.array(gray)
    th = cv2.adaptiveThreshold(arr, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 8)
    return Image.fromarray(th)


def apply_upscale(img: Image.Image) -> Image.Image:
    arr = np.array(img.convert("RGB"))
    h, w = arr.shape[:2]
    scale = 1.0
    if max(h, w) < 1200:
        scale = 3.0
    elif max(h, w) < 2400:
        scale = 2.0
    elif max(h, w) < 3600:
        scale = 1.5
    if scale == 1.0:
        return img
    up = cv2.resize(arr, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    return Image.fromarray(up)


def apply_sharpen(img: Image.Image) -> Image.Image:
    return img.filter(ImageFilter.UnsharpMask(radius=1, percent=200, threshold=1))


def apply_contrast(img: Image.Image) -> Image.Image:
    enhancer = ImageEnhance.Contrast(img)
    return enhancer.enhance(1.5)


def apply_full_pipeline(img: Image.Image) -> Image.Image:
    img = to_grayscale(img)
    arr = np.array(img)
    denoised = cv2.fastNlMeansDenoising(arr, None, h=14, templateWindowSize=7, searchWindowSize=21)
    th = cv2.adaptiveThreshold(denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 8)
    proc = Image.fromarray(th)
    proc = apply_upscale(proc)
    proc = apply_sharpen(proc)
    proc = apply_contrast(proc)
    return proc


def run_paddle_primary(img: Image.Image):
    if PaddleOCR is None:
        return None
    try:
        ocr = PaddleOCR(use_angle_cls=True, lang="en")
        arr = np.array(img.convert("RGB"))
        raw = ocr.ocr(arr, cls=True)
        texts = []
        confs = []
        for line in raw:
            for seg in line:
                txt = seg[1][0]
                try:
                    confs.append(float(seg[1][1]))
                except Exception:
                    pass
                texts.append(txt)
        text = "\n".join(t for t in texts if t.strip())
        confidence = float(np.mean(confs)) if confs else 0.0
        return {"text": text, "confidence": confidence, "source": "paddleocr"}
    except Exception as exc:
        logger.warning("PaddleOCR primary extraction failed: %s", exc)
        return None


def run_tesseract_fallback(img: Image.Image):
    if pytesseract is None:
        return {"text": "", "confidence": 0.0, "source": "missing_tesseract"}
    try:
        text = pytesseract.image_to_string(img, lang="eng", config="--psm 6")
        confidence = 0.0
        return {"text": text, "confidence": confidence, "source": "tesseract"}
    except Exception as exc:
        logger.warning("Tesseract fallback failed: %s", exc)
        return {"text": "", "confidence": 0.0, "source": "tesseract_error"}


def assess_text(text: str):
    words = [w for w in text.split() if w.strip()]
    char_count = len(text)
    return {
        "char_count": char_count,
        "word_count": len(words),
        "has_text": bool(text.strip()),
    }


def safe_save(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content or "", encoding="utf-8")


def process_variant(image_path: Path, variant_name: str, image: Image.Image, output_dir: Path):
    if variant_name == "raw":
        proc = image
    elif variant_name == "grayscale":
        proc = to_grayscale(image)
    elif variant_name == "adaptive_threshold":
        proc = apply_adaptive_threshold(image)
    elif variant_name == "denoise":
        proc = apply_denoise(image)
    elif variant_name == "upscale":
        proc = apply_upscale(image)
    elif variant_name == "sharpen":
        proc = apply_sharpen(image)
    elif variant_name == "contrast":
        proc = apply_contrast(image)
    elif variant_name == "full_pipeline":
        proc = apply_full_pipeline(image)
    else:
        raise ValueError(f"Unknown variant: {variant_name}")

    result = run_paddle_primary(proc)
    if not result or not result["text"].strip():
        fallback = run_tesseract_fallback(proc)
        result = fallback if fallback["text"].strip() else result or fallback
    metrics = assess_text(result.get("text", ""))
    score = result.get("confidence", 0.0) * math.log1p(metrics["char_count"])
    stem = image_path.stem.replace(" ", "_")
    safe_save(output_dir / f"{stem}_{variant_name}.txt", result.get("text", ""))
    meta = {
        "image": str(image_path.relative_to(ROOT)),
        "variant": variant_name,
        "source": result.get("source"),
        "confidence": result.get("confidence", 0.0),
        "score": round(score, 4),
        **metrics,
    }
    safe_save(output_dir / f"{stem}_{variant_name}_meta.json", json.dumps(meta, indent=2))
    return meta


def main():
    parser = argparse.ArgumentParser(description="OCR validation script with preprocessing variant comparisons")
    parser.add_argument("--input-dir", default=ROOT / "uploads", type=Path, help="Folder containing test images")
    parser.add_argument("--output-dir", default=ROOT / "ocr_validation_results", type=Path, help="Folder to save validation outputs")
    parser.add_argument("--max-images", default=20, type=int, help="Max number of images to validate")
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    images = discover_images(args.input_dir, args.max_images)
    if not images:
        logger.error("No test images found in %s", args.input_dir)
        raise SystemExit(1)

    overall = []
    for image_path in images:
        image = Image.open(image_path).convert("RGB")
        for variant in VARIANTS:
            try:
                meta = process_variant(image_path, variant, image, args.output_dir)
                overall.append(meta)
                logger.info("%s (%s): source=%s confidence=%.2f char_count=%d", image_path.name, variant, meta["source"], meta["confidence"], meta["char_count"])
            except Exception as exc:
                logger.exception("Variant failed for %s %s: %s", image_path, variant, exc)

    summary_file = args.output_dir / "comparison_report.json"
    summary_file.write_text(json.dumps(overall, indent=2), encoding="utf-8")
    logger.info("OCR validation complete. Results saved to %s", summary_file)


if __name__ == "__main__":
    main()
