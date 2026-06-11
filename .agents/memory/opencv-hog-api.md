---
name: OpenCV 4.13 HOG API and torch install limits
description: HOGDescriptor.detectMultiScale() dropped finalThreshold kwarg; torch too large to pip-install within 120s bash timeout
---

**OpenCV 4.13.0:** `HOGDescriptor.detectMultiScale()` does NOT accept a `finalThreshold` keyword argument. It raises `cv2.error: (-5) 'finalThreshold' is an invalid keyword argument`. Remove it — the default threshold is fine for surveillance use.

**Why:** The OpenCV Python bindings changed between versions; this kwarg was present in older docs but removed in 4.x.

**Torch install timeout:** `pip install torch` (CPU-only, ~230MB) consistently times out within the 120-second bash tool limit. Use `onnxruntime` (~30MB, installs in seconds) as the inference backend instead. Pre-converted ONNX models for YOLOv8n are NOT available on GitHub releases; use OpenCV HOG + MOG2 background subtraction as the CV backend — no external model downloads needed.

**Python binary:** `python3.11` is in PATH. Use `python3.11 -m pip`, not `pip3` (not in PATH).
