---
name: AVIS persistent storage
description: Why .avis_data/ is used instead of /tmp for all CV service file storage
---

**Rule:** All AVIS file storage (uploads, pipeline frames, evidence images, processed videos) lives at `/home/runner/workspace/.avis_data/{uploads,frames,evidence,processed}/` — never in `/tmp`.

**Why:** `/tmp` is cleared when the CV service restarts (or the container restarts). Uploaded video files at `/tmp/avis_uploads/` disappear, causing pipeline to fail with "Video file not found" even though the DB record still points to the old path. This was a recurring failure mode.

**How to apply:** Any new file storage in `main.py` must use `_BASE = Path("/home/runner/workspace/.avis_data")` as the root. The `.avis_data/` directory is gitignored. Never add new `Path("/tmp/...")` storage dirs to the CV service.
