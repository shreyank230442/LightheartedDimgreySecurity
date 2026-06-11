"""
AVIS Computer Vision Service
Real CV pipeline: OpenCV HOG person detection + MOG2 background subtraction + centroid tracking
No external model downloads required.
"""
import os
import json
import uuid
import traceback
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict, List, Tuple
import numpy as np
import cv2
import psycopg2
import psycopg2.extras
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, BackgroundTasks
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

PORT = int(os.environ.get("PORT", "8000"))
DATABASE_URL = os.environ.get("DATABASE_URL", "")

UPLOAD_DIR = Path("/tmp/avis_uploads")
FRAMES_DIR = Path("/tmp/avis_frames")
EVIDENCE_DIR = Path("/tmp/avis_evidence")

for _d in [UPLOAD_DIR, FRAMES_DIR, EVIDENCE_DIR]:
    _d.mkdir(parents=True, exist_ok=True)

# HOG person detector — built into OpenCV, no model download
_hog: Optional[cv2.HOGDescriptor] = None


def get_hog() -> cv2.HOGDescriptor:
    global _hog
    if _hog is None:
        _hog = cv2.HOGDescriptor()
        _hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
        logger.info("HOG person detector initialised")
    return _hog


app = FastAPI(title="AVIS CV Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def get_db():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


# ──────────────────────────────────────────────
# Health
# ──────────────────────────────────────────────

@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "avis-cv", "detector": "HOG+MOG2"}


# ──────────────────────────────────────────────
# Upload
# ──────────────────────────────────────────────

@app.post("/upload")
async def upload_video(file: UploadFile = File(...), camera_name: str = Form(...)):
    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty file")

    suffix = (Path(file.filename or "video").suffix or ".mp4").lower()
    if suffix not in (".mp4", ".avi", ".mov"):
        suffix = ".mp4"

    uid = uuid.uuid4().hex
    save_path = UPLOAD_DIR / f"{uid}{suffix}"
    save_path.write_bytes(content)

    cap = cv2.VideoCapture(str(save_path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = int(total_frames / fps) if fps > 0 else 0

    thumb_name = None
    cap.set(cv2.CAP_PROP_POS_FRAMES, max(1, total_frames // 10))
    ret, thumb = cap.read()
    cap.release()
    if ret and thumb is not None:
        thumb_name = f"thumb_{uid}.jpg"
        cv2.imwrite(str(FRAMES_DIR / thumb_name), cv2.resize(thumb, (320, 180)))

    thumbnail_url = f"/api/pipeline/thumbnail/{thumb_name}" if thumb_name else None

    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO videos
                 (file_name, camera_name, status, duration_seconds, frame_count, file_path, thumbnail_url)
               VALUES (%s, %s, 'pending', %s, %s, %s, %s)
               RETURNING id, file_name, camera_name, status, duration_seconds, frame_count,
                         thumbnail_url, upload_time, processed_at""",
            (file.filename, camera_name, duration, total_frames, str(save_path), thumbnail_url),
        )
        row = dict(cur.fetchone())
        conn.commit()
    finally:
        conn.close()

    return {
        "id": row["id"],
        "fileName": row["file_name"],
        "cameraName": row["camera_name"],
        "status": row["status"],
        "uploadTime": row["upload_time"].isoformat(),
        "processedAt": None,
        "durationSeconds": row["duration_seconds"],
        "frameCount": row["frame_count"],
        "thumbnailUrl": row["thumbnail_url"],
        "filePath": None,
    }


# ──────────────────────────────────────────────
# Process
# ──────────────────────────────────────────────

@app.post("/process/{video_id}")
async def process_video(video_id: int, background_tasks: BackgroundTasks):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM videos WHERE id = %s", (video_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Video not found")
        video = dict(row)
        cur.execute("UPDATE videos SET status = 'processing' WHERE id = %s", (video_id,))
        conn.commit()
    finally:
        conn.close()

    background_tasks.add_task(_run_pipeline, video_id, video)
    return {"status": "processing", "videoId": video_id}


# ──────────────────────────────────────────────
# Pipeline stage images
# ──────────────────────────────────────────────

VALID_STAGES = {"original", "blur", "contrast", "edges", "motion", "detection"}


@app.get("/pipeline/{video_id}/{stage}")
def get_pipeline_image(video_id: int, stage: str):
    if stage not in VALID_STAGES:
        raise HTTPException(400, f"Stage must be one of {sorted(VALID_STAGES)}")
    img_path = FRAMES_DIR / str(video_id) / f"{stage}.jpg"
    if img_path.exists():
        return Response(img_path.read_bytes(), media_type="image/jpeg")
    return _placeholder(f"[{stage.upper()}]  Processing...")


@app.get("/thumbnail/{filename}")
def get_thumbnail(filename: str):
    path = FRAMES_DIR / filename
    if path.exists():
        return Response(path.read_bytes(), media_type="image/jpeg")
    return _placeholder("No thumbnail")


# ──────────────────────────────────────────────
# Evidence images
# ──────────────────────────────────────────────

@app.get("/evidence/{event_id}")
def get_evidence(event_id: int):
    path = EVIDENCE_DIR / f"{event_id}.jpg"
    if path.exists():
        return Response(path.read_bytes(), media_type="image/jpeg")
    return _placeholder(f"Evidence #{event_id} — frame not captured")


# ──────────────────────────────────────────────
# Utility
# ──────────────────────────────────────────────

def _placeholder(text: str) -> Response:
    img = np.zeros((225, 400, 3), dtype=np.uint8)
    cv2.putText(img, text, (16, 112), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (65, 65, 65), 1)
    _, buf = cv2.imencode(".jpg", img)
    return Response(bytes(buf), media_type="image/jpeg")


def _resize_for_detection(frame: np.ndarray, max_width: int = 640) -> Tuple[np.ndarray, float]:
    """Resize frame to max_width for faster processing, return (resized, scale)."""
    h, w = frame.shape[:2]
    if w <= max_width:
        return frame, 1.0
    scale = max_width / w
    return cv2.resize(frame, (max_width, int(h * scale))), scale


# ──────────────────────────────────────────────
# Centroid Tracker
# ──────────────────────────────────────────────

class CentroidTracker:
    def __init__(self, max_distance: float = 130, max_disappeared: int = 20):
        self.next_id = 1
        self.objects: Dict[int, Tuple[float, float]] = {}
        self.disappeared: Dict[int, int] = {}
        self.max_distance = max_distance
        self.max_disappeared = max_disappeared

    def update(self, centroids: List[Tuple[float, float]]) -> Dict[int, Tuple[float, float]]:
        if not centroids:
            for oid in list(self.disappeared):
                self.disappeared[oid] += 1
                if self.disappeared[oid] > self.max_disappeared:
                    del self.objects[oid]
                    del self.disappeared[oid]
            return dict(self.objects)

        if not self.objects:
            for c in centroids:
                self.objects[self.next_id] = c
                self.disappeared[self.next_id] = 0
                self.next_id += 1
            return dict(self.objects)

        obj_ids = list(self.objects)
        obj_pts = np.array(list(self.objects.values()), dtype=float)
        inp_pts = np.array(centroids, dtype=float)
        diff = obj_pts[:, np.newaxis, :] - inp_pts[np.newaxis, :, :]
        D = np.sqrt((diff ** 2).sum(axis=2))

        used_rows, used_cols = set(), set()
        for row in D.min(axis=1).argsort():
            col = int(D[row].argmin())
            if row in used_rows or col in used_cols:
                continue
            if D[row, col] > self.max_distance:
                continue
            oid = obj_ids[row]
            self.objects[oid] = centroids[col]
            self.disappeared[oid] = 0
            used_rows.add(row)
            used_cols.add(col)

        for row in range(len(obj_ids)):
            if row not in used_rows:
                oid = obj_ids[row]
                self.disappeared[oid] += 1
                if self.disappeared[oid] > self.max_disappeared:
                    del self.objects[oid]
                    del self.disappeared[oid]

        for col in range(len(centroids)):
            if col not in used_cols:
                self.objects[self.next_id] = centroids[col]
                self.disappeared[self.next_id] = 0
                self.next_id += 1

        return dict(self.objects)


# ──────────────────────────────────────────────
# Detection helpers
# ──────────────────────────────────────────────

def _detect_persons_hog(frame: np.ndarray) -> List[Dict]:
    """Run HOG person detector on a frame. Returns list of detection dicts."""
    small, scale = _resize_for_detection(frame, max_width=640)
    hog = get_hog()
    rects, weights = hog.detectMultiScale(
        small,
        winStride=(8, 8),
        padding=(4, 4),
        scale=1.05,
    )
    detections = []
    if len(rects):
        for (x, y, w, h), conf in zip(rects, weights.flatten()):
            # Scale back to original frame coords
            x1 = int(x / scale)
            y1 = int(y / scale)
            w_orig = int(w / scale)
            h_orig = int(h / scale)
            detections.append({
                "object_type": "person",
                "confidence": float(min(conf, 1.0)),
                "x1": x1, "y1": y1,
                "x2": x1 + w_orig, "y2": y1 + h_orig,
                "cx": x1 + w_orig / 2,
                "cy": y1 + h_orig / 2,
                "bounding_box": json.dumps({"x": x1, "y": y1, "w": w_orig, "h": h_orig}),
            })
    return detections


def _detect_objects_mog(fg_mask: np.ndarray, frame_h: int, frame_w: int) -> List[Dict]:
    """Find non-person objects from foreground mask blobs."""
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    clean = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel)
    clean = cv2.dilate(clean, kernel, iterations=2)
    contours, _ = cv2.findContours(clean, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    objects = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 800:  # skip small noise
            continue
        x, y, w, h = cv2.boundingRect(cnt)
        ar = h / max(w, 1)
        cx, cy = x + w / 2, y + h / 2

        # Classify by size/shape
        if area > 20000:
            obj_type = "vehicle"
        elif ar > 1.5 and h > 60:
            obj_type = "person"  # may have been missed by HOG
        elif area < 3000:
            # Small carried objects classified as bag-type
            obj_type = "backpack"
        else:
            continue  # skip ambiguous medium blobs

        objects.append({
            "object_type": obj_type,
            "confidence": round(min(0.6 + area / 50000, 0.92), 3),
            "x1": x, "y1": y, "x2": x + w, "y2": y + h,
            "cx": cx, "cy": cy,
            "bounding_box": json.dumps({"x": x, "y": y, "w": w, "h": h}),
        })
    return objects


# ──────────────────────────────────────────────
# Pipeline stage image generation
# ──────────────────────────────────────────────

def _gen_pipeline_images(
    frame: np.ndarray,
    prev_frame: Optional[np.ndarray],
    fg_mask: Optional[np.ndarray],
    detections: list,
    out_dir: Path,
):
    # 1 Original
    cv2.imwrite(str(out_dir / "original.jpg"), frame)

    # 2 Gaussian blur
    blurred = cv2.GaussianBlur(frame, (15, 15), 0)
    cv2.imwrite(str(out_dir / "blur.jpg"), blurred)

    # 3 CLAHE contrast enhancement
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = cv2.cvtColor(clahe.apply(gray), cv2.COLOR_GRAY2BGR)
    cv2.imwrite(str(out_dir / "contrast.jpg"), enhanced)

    # 4 Canny edge detection
    edges = cv2.Canny(cv2.cvtColor(blurred, cv2.COLOR_BGR2GRAY), 50, 150)
    cv2.imwrite(str(out_dir / "edges.jpg"), cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR))

    # 5 MOG2 background subtraction / motion
    if fg_mask is not None:
        motion_img = np.zeros_like(frame)
        motion_img[fg_mask > 0] = [200, 80, 40]
        contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(motion_img, contours, -1, (100, 200, 255), 2)
    elif prev_frame is not None and prev_frame.shape == frame.shape:
        g1 = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY)
        g2 = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        diff = cv2.absdiff(g1, g2)
        _, mask = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
        motion_img = np.zeros_like(frame)
        motion_img[mask > 0] = [200, 80, 40]
    else:
        hf = np.clip(np.abs(np.float32(gray) - cv2.GaussianBlur(np.float32(gray), (21, 21), 0)) * 8, 0, 255).astype(np.uint8)
        motion_img = np.zeros_like(frame)
        motion_img[:, :, 0] = hf
    cv2.imwrite(str(out_dir / "motion.jpg"), motion_img)

    # 6 Detection output
    cv2.imwrite(str(out_dir / "detection.jpg"), _draw_detections(frame, detections))


def _draw_detections(frame: np.ndarray, dets: list) -> np.ndarray:
    result = frame.copy()
    colors = {
        "person": (255, 90, 30),
        "vehicle": (30, 180, 255),
        "backpack": (0, 210, 90),
    }
    for det in dets:
        try:
            bb = json.loads(det["bounding_box"]) if isinstance(det["bounding_box"], str) else det["bounding_box"]
            x, y, w, h = int(bb["x"]), int(bb["y"]), int(bb["w"]), int(bb["h"])
        except Exception:
            continue
        color = colors.get(det["object_type"], (0, 210, 90))
        cv2.rectangle(result, (x, y), (x + w, y + h), color, 2)
        conf = det.get("confidence", 0)
        lbl = f"{det['object_type']} {conf:.2f}"
        lw = len(lbl) * 8 + 4
        cv2.rectangle(result, (x, y - 18), (x + lw, y), color, -1)
        cv2.putText(result, lbl, (x + 2, y - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)
    return result


def _draw_evidence(frame: np.ndarray, path: list, track_id: str, event_type: str) -> np.ndarray:
    result = frame.copy()
    pts = [(int(p["x"]), int(p["y"])) for p in path if "x" in p]
    for i in range(1, len(pts)):
        a = i / max(len(pts), 1)
        cv2.line(result, pts[i - 1], pts[i], (int(60 * a), int(255 * a), int(60 * a)), 2)
    if pts:
        cv2.circle(result, pts[-1], 8, (0, 0, 255), -1)
    overlay = result.copy()
    cv2.rectangle(overlay, (0, 0), (result.shape[1], 34), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.65, result, 0.35, 0, result)
    cv2.putText(result, f"[INCIDENT] {event_type.upper()}  |  {track_id}",
                (8, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (40, 80, 255), 1)
    return result


# ──────────────────────────────────────────────
# Incident detection rules
# ──────────────────────────────────────────────

def _detect_incidents(
    detections: list,
    tracking_paths: Dict[str, list],
    camera: str,
    fps: float,
    frames_dict: Dict[int, np.ndarray],
    rep_frame: np.ndarray,
) -> list:
    incidents = []

    def nearest(fn: int) -> np.ndarray:
        if not frames_dict:
            return rep_frame
        return frames_dict[min(frames_dict, key=lambda k: abs(k - fn))]

    # 1. Loitering — stays in small area for > 20 s
    for tid, path in tracking_paths.items():
        if len(path) < 5:
            continue
        dur = path[-1]["t"] - path[0]["t"]
        if dur < 20:
            continue
        xs, ys = [p["x"] for p in path], [p["y"] for p in path]
        spread = float(np.sqrt((max(xs) - min(xs)) ** 2 + (max(ys) - min(ys)) ** 2))
        if spread < 120:
            fn = int(path[len(path) // 2]["t"] * fps)
            incidents.append({
                "event_type": "loitering",
                "risk_score": min(95, 40 + int(dur / 8)),
                "severity": "high" if dur > 60 else "medium",
                "description": f"{tid} remained stationary in the same region for {int(dur)} seconds",
                "timestamp": datetime.now(timezone.utc),
                "frame_number": fn,
                "metadata": json.dumps({"person_id": tid, "duration_seconds": round(dur, 1)}),
                "evidence_frame": _draw_evidence(nearest(fn), path, tid, "loitering"),
            })

    # 2. Running — high centroid velocity
    for tid, path in tracking_paths.items():
        if len(path) < 4:
            continue
        velocities = []
        for i in range(1, len(path)):
            dt = path[i]["t"] - path[i - 1]["t"]
            if dt <= 0:
                continue
            dx, dy = path[i]["x"] - path[i - 1]["x"], path[i]["y"] - path[i - 1]["y"]
            velocities.append(float(np.sqrt(dx ** 2 + dy ** 2)) / dt)
        if not velocities:
            continue
        max_v = max(velocities)
        if max_v > 60:
            peak = velocities.index(max_v) + 1
            fn = int(path[min(peak, len(path) - 1)]["t"] * fps)
            incidents.append({
                "event_type": "running",
                "risk_score": 55,
                "severity": "medium",
                "description": f"{tid} detected moving at high velocity ({int(max_v)} px/s — running/sprinting)",
                "timestamp": datetime.now(timezone.utc),
                "frame_number": fn,
                "metadata": json.dumps({"person_id": tid, "max_velocity_px_s": round(max_v, 1)}),
                "evidence_frame": _draw_evidence(nearest(fn), path, tid, "running"),
            })

    # 3. Crowd — ≥3 persons in same frame
    frame_person_count: Dict[int, int] = {}
    for det in detections:
        if det["object_type"] == "person":
            frame_person_count[det["frame_number"]] = frame_person_count.get(det["frame_number"], 0) + 1
    if frame_person_count:
        peak_fn = max(frame_person_count, key=frame_person_count.get)
        count = frame_person_count[peak_fn]
        if count >= 3:
            crowd_dets = [d for d in detections if d["frame_number"] == peak_fn and d["object_type"] == "person"]
            incidents.append({
                "event_type": "crowd_formation",
                "risk_score": min(85, 35 + count * 10),
                "severity": "high" if count >= 5 else "medium",
                "description": f"{count} persons detected simultaneously in {camera} view",
                "timestamp": datetime.now(timezone.utc),
                "frame_number": peak_fn,
                "metadata": json.dumps({"person_count": count}),
                "evidence_frame": _draw_detections(nearest(peak_fn),
                                                    [d for d in detections if d["frame_number"] == peak_fn]),
            })

    # 4. Suspicious movement — back-and-forth reversals
    for tid, path in tracking_paths.items():
        if len(path) < 10:
            continue
        xs = [p["x"] for p in path]
        reversals = sum(
            1 for i in range(1, len(xs) - 1)
            if (xs[i] - xs[i - 1]) * (xs[i + 1] - xs[i]) < -60
        )
        if reversals >= 3:
            fn = int(path[len(path) // 2]["t"] * fps)
            incidents.append({
                "event_type": "suspicious_movement",
                "risk_score": 65,
                "severity": "high",
                "description": f"{tid} exhibited back-and-forth movement pattern ({reversals} reversals)",
                "timestamp": datetime.now(timezone.utc),
                "frame_number": fn,
                "metadata": json.dumps({"person_id": tid, "direction_changes": reversals}),
                "evidence_frame": _draw_evidence(nearest(fn), path, tid, "suspicious_movement"),
            })

    # 5. Abandoned object — backpack blob persists across many frames
    obj_frames: Dict[str, list] = {}
    for det in detections:
        if det["object_type"] == "backpack":
            obj_frames.setdefault("backpack", []).append(det)
    for obj_type, dets in obj_frames.items():
        if len(dets) >= 5:
            mid = dets[len(dets) // 2]
            fn = mid["frame_number"]
            incidents.append({
                "event_type": "abandoned_object",
                "risk_score": 90,
                "severity": "critical",
                "description": f"Unattended {obj_type} detected across {len(dets)} frames — possible threat",
                "timestamp": datetime.now(timezone.utc),
                "frame_number": fn,
                "metadata": json.dumps({"object_type": obj_type, "frame_count": len(dets)}),
                "evidence_frame": _draw_detections(nearest(fn), [mid]),
            })

    return incidents


# ──────────────────────────────────────────────
# Main pipeline
# ──────────────────────────────────────────────

def _run_pipeline(video_id: int, video: dict):
    try:
        file_path = video.get("file_path")
        camera = video.get("camera_name", "UNKNOWN")

        if not file_path or not Path(file_path).exists():
            raise ValueError(f"Video file not found: {file_path}")

        logger.info(f"Pipeline start  video_id={video_id}  path={file_path}")

        cap = cv2.VideoCapture(file_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps > 0 else 0

        # Sample at most 60 frames (HOG is ~5× slower than YOLO)
        sample_interval = max(1, total_frames // 60)
        sampled: List[Tuple[int, np.ndarray]] = []
        frame_idx = 0
        while cap.isOpened() and len(sampled) < 60:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % sample_interval == 0:
                sampled.append((frame_idx, frame.copy()))
            frame_idx += 1
        cap.release()

        if not sampled:
            raise ValueError("No frames could be extracted")

        logger.info(f"Extracted {len(sampled)} sampled frames  interval={sample_interval}")

        out_dir = FRAMES_DIR / str(video_id)
        out_dir.mkdir(parents=True, exist_ok=True)

        # MOG2 background subtractor trained on all sampled frames
        mog2 = cv2.createBackgroundSubtractorMOG2(history=100, varThreshold=40, detectShadows=False)
        fg_masks: Dict[int, np.ndarray] = {}
        for fn, fr in sampled:
            small, _ = _resize_for_detection(fr, 640)
            mask = mog2.apply(small)
            # Scale mask back to original
            fg_masks[fn] = cv2.resize(mask, (fr.shape[1], fr.shape[0]))

        # Representative frame (middle)
        rep_idx = len(sampled) // 2
        rep_fn, rep_frame = sampled[rep_idx]
        prev_frame = sampled[max(0, rep_idx - 1)][1] if rep_idx > 0 else None
        rep_fg = fg_masks.get(rep_fn)

        # Sparse dict for evidence capture (every 2nd sampled frame)
        frames_dict = {fn: fr for fn, fr in sampled[::2]}

        # ── HOG Detection on all frames ──
        all_detections: list = []
        tracker = CentroidTracker()
        tracking_paths: Dict[int, list] = {}
        track_id_names: Dict[int, str] = {}

        for frame_num, frame in sampled:
            # HOG person detection
            dets = _detect_persons_hog(frame)
            # MOG2 object detection
            fg = fg_masks.get(frame_num, np.zeros(frame.shape[:2], dtype=np.uint8))
            obj_dets = _detect_objects_mog(fg, frame.shape[0], frame.shape[1])

            # Merge (deduplicate persons already found by HOG)
            hog_areas = set()
            for d in dets:
                hog_areas.add((d["x1"] // 40, d["y1"] // 40))

            for od in obj_dets:
                if od["object_type"] == "person":
                    key = (od["x1"] // 40, od["y1"] // 40)
                    if key in hog_areas:
                        continue
                dets.append(od)

            secs = frame_num / fps
            ts = f"{int(secs // 3600):02d}:{int((secs % 3600) // 60):02d}:{int(secs % 60):02d}"
            for det in dets:
                det["video_id"] = video_id
                det["frame_number"] = frame_num
                det["timestamp"] = ts
                all_detections.append(det)

            # Track persons
            person_centroids = [(d["cx"], d["cy"]) for d in dets if d["object_type"] == "person"]
            tracked = tracker.update(person_centroids)
            for tid, (tx, ty) in tracked.items():
                if tid not in track_id_names:
                    track_id_names[tid] = f"Person #{tid}"
                tracking_paths.setdefault(tid, []).append({"x": tx, "y": ty, "t": frame_num / fps})

        logger.info(f"Detection complete: {len(all_detections)} detections, {len(tracking_paths)} tracks")

        # Generate pipeline images using rep frame + its MOG2 mask + rep frame detections
        rep_dets = [d for d in all_detections if d["frame_number"] == rep_fn]
        _gen_pipeline_images(rep_frame, prev_frame, rep_fg, rep_dets, out_dir)

        named_paths = {track_id_names.get(tid, f"Person #{tid}"): path
                       for tid, path in tracking_paths.items()}

        # ── Incident detection ──
        incidents = _detect_incidents(all_detections, named_paths, camera, fps, frames_dict, rep_frame)
        logger.info(f"Incidents: {len(incidents)}")

        # ── Persist to DB ──
        conn = get_db()
        try:
            cur = conn.cursor()

            for det in all_detections:
                cur.execute(
                    """INSERT INTO detections
                         (video_id, object_type, confidence, frame_number, timestamp, bounding_box)
                       VALUES (%s, %s, %s, %s, %s, %s)""",
                    (det["video_id"], det["object_type"], det["confidence"],
                     det["frame_number"], det["timestamp"], det["bounding_box"]),
                )

            for tid, path in tracking_paths.items():
                if len(path) < 2:
                    continue
                name = track_id_names.get(tid, f"Person #{tid}")
                dur = int(path[-1]["t"] - path[0]["t"]) + 1
                cur.execute(
                    """INSERT INTO tracking (video_id, person_id, camera, path, duration_seconds)
                       VALUES (%s, %s, %s, %s, %s)""",
                    (video_id, name, camera, json.dumps(path), dur),
                )

            for inc in incidents:
                ev_frame = inc.pop("evidence_frame", None)
                cur.execute(
                    """INSERT INTO events
                         (video_id, event_type, risk_score, severity, description,
                          timestamp, camera, frame_number, metadata)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                       RETURNING id""",
                    (video_id, inc["event_type"], inc["risk_score"], inc["severity"],
                     inc["description"], inc["timestamp"], camera,
                     inc.get("frame_number"), inc.get("metadata")),
                )
                event_id = cur.fetchone()["id"]
                if ev_frame is not None:
                    cv2.imwrite(str(EVIDENCE_DIR / f"{event_id}.jpg"), ev_frame)

            cur.execute(
                """UPDATE videos SET status = 'processed', processed_at = NOW(),
                          frame_count = %s, duration_seconds = %s
                   WHERE id = %s""",
                (total_frames, int(duration), video_id),
            )
            conn.commit()
            logger.info(f"Pipeline complete  video_id={video_id}")
        finally:
            conn.close()

    except Exception as e:
        logger.error(f"Pipeline FAILED  video_id={video_id}: {e}")
        traceback.print_exc()
        try:
            conn = get_db()
            cur = conn.cursor()
            cur.execute("UPDATE videos SET status = 'failed' WHERE id = %s", (video_id,))
            conn.commit()
            conn.close()
        except Exception:
            pass


# ──────────────────────────────────────────────
# Entrypoint
# ──────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
