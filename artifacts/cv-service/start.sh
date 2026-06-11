#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "[CV Service] Checking Python dependencies..."
python3.11 -m pip install -q --break-system-packages \
  fastapi "uvicorn[standard]" opencv-python-headless \
  psycopg2-binary python-multipart pillow onnxruntime
echo "[CV Service] Starting AVIS CV Service on port ${PORT:-8000}..."
exec python3.11 main.py
