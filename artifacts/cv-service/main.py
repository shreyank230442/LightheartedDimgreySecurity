"""
AVIS Computer Vision Service — v2
Single-pass pipeline: generates 6 processed MP4 videos per stage
+ HOG/MOG2 detection + fire/explosion/fight/fall/accident incident detection
"""
import os, json, uuid, traceback, logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict, List, Tuple
import numpy as np
import cv2
import psycopg2, psycopg2.extras
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, BackgroundTasks
from fastapi.responses import Response, FileResponse
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

PORT         = int(os.environ.get("PORT", "8000"))
DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Persistent storage — survives service restarts (unlike /tmp)
_BASE         = Path("/home/runner/workspace/.avis_data")
UPLOAD_DIR    = _BASE / "uploads";    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
FRAMES_DIR    = _BASE / "frames";     FRAMES_DIR.mkdir(parents=True, exist_ok=True)
EVIDENCE_DIR  = _BASE / "evidence";   EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR = _BASE / "processed";  PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

VIDEO_STAGES = ["original", "blur", "contrast", "edges", "motion", "detection"]

_hog: Optional[cv2.HOGDescriptor] = None
def get_hog() -> cv2.HOGDescriptor:
    global _hog
    if _hog is None:
        _hog = cv2.HOGDescriptor()
        _hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
        logger.info("HOG people detector ready")
    return _hog

app = FastAPI(title="AVIS CV Service v2")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

def get_db():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


# ──────────────────────────────────────────────────────────────
# Health
# ──────────────────────────────────────────────────────────────

@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "avis-cv-v2", "detector": "HOG+MOG2+fire+explosion+fight+fall"}


# ──────────────────────────────────────────────────────────────
# Upload
# ──────────────────────────────────────────────────────────────

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
    fps        = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration   = int(total_frames / fps) if fps > 0 else 0

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
               VALUES (%s,%s,'pending',%s,%s,%s,%s)
               RETURNING id, file_name, camera_name, status, duration_seconds, frame_count,
                         thumbnail_url, upload_time, processed_at""",
            (file.filename, camera_name, duration, total_frames, str(save_path), thumbnail_url),
        )
        row = dict(cur.fetchone()); conn.commit()
    finally:
        conn.close()

    return {
        "id": row["id"], "fileName": row["file_name"], "cameraName": row["camera_name"],
        "status": row["status"], "uploadTime": row["upload_time"].isoformat(),
        "processedAt": None, "durationSeconds": row["duration_seconds"],
        "frameCount": row["frame_count"], "thumbnailUrl": row["thumbnail_url"], "filePath": None,
    }


# ──────────────────────────────────────────────────────────────
# Trigger processing
# ──────────────────────────────────────────────────────────────

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
        cur.execute("UPDATE videos SET status='processing' WHERE id=%s", (video_id,))
        conn.commit()
    finally:
        conn.close()
    background_tasks.add_task(_run_pipeline, video_id, video)
    return {"status": "processing", "videoId": video_id}


# ──────────────────────────────────────────────────────────────
# Pipeline stage static IMAGES (representative frame)
# ──────────────────────────────────────────────────────────────

VALID_STAGES = {"original", "blur", "contrast", "edges", "motion", "detection"}

@app.get("/pipeline/{video_id}/{stage}")
def get_pipeline_image(video_id: int, stage: str):
    if stage not in VALID_STAGES:
        raise HTTPException(400, f"Stage must be one of {sorted(VALID_STAGES)}")
    img_path = FRAMES_DIR / str(video_id) / f"{stage}.jpg"
    if img_path.exists():
        return Response(img_path.read_bytes(), media_type="image/jpeg")
    return _placeholder(f"[{stage.upper()}]  Processing…")


# ──────────────────────────────────────────────────────────────
# Pipeline stage VIDEOS (generated during processing)
# ──────────────────────────────────────────────────────────────

@app.get("/pipeline_video/{video_id}/{stage}")
def get_pipeline_video(video_id: int, stage: str):
    if stage not in VALID_STAGES:
        raise HTTPException(400, f"Stage must be one of {sorted(VALID_STAGES)}")
    path = PROCESSED_DIR / str(video_id) / f"{stage}.mp4"
    if not path.exists():
        raise HTTPException(404, "Video not generated yet — process the video first")
    return FileResponse(str(path), media_type="video/mp4")


# ──────────────────────────────────────────────────────────────
# Thumbnails + Evidence
# ──────────────────────────────────────────────────────────────

@app.get("/thumbnail/{filename}")
def get_thumbnail(filename: str):
    path = FRAMES_DIR / filename
    if path.exists():
        return Response(path.read_bytes(), media_type="image/jpeg")
    return _placeholder("No thumbnail")

@app.get("/evidence/{event_id}")
def get_evidence(event_id: int):
    path = EVIDENCE_DIR / f"{event_id}.jpg"
    if path.exists():
        return Response(path.read_bytes(), media_type="image/jpeg")
    return _placeholder(f"Evidence #{event_id} — not captured")


# ──────────────────────────────────────────────────────────────
# Utility
# ──────────────────────────────────────────────────────────────

def _placeholder(text: str) -> Response:
    img = np.zeros((225, 400, 3), dtype=np.uint8)
    cv2.putText(img, text, (16, 112), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (65, 65, 65), 1)
    _, buf = cv2.imencode(".jpg", img)
    return Response(bytes(buf), media_type="image/jpeg")

def _resize_to(frame: np.ndarray, max_w: int = 640) -> Tuple[np.ndarray, float]:
    h, w = frame.shape[:2]
    if w <= max_w:
        return frame, 1.0
    scale = max_w / w
    return cv2.resize(frame, (max_w, int(h * scale))), scale


# ──────────────────────────────────────────────────────────────
# Centroid Tracker
# ──────────────────────────────────────────────────────────────

class CentroidTracker:
    def __init__(self, max_dist: float = 130, max_gone: int = 25):
        self.next_id = 1
        self.objects: Dict[int, Tuple[float, float]] = {}
        self.gone: Dict[int, int] = {}
        self.max_dist = max_dist
        self.max_gone = max_gone

    def update(self, centroids: List[Tuple[float, float]]) -> Dict[int, Tuple[float, float]]:
        if not centroids:
            for oid in list(self.gone):
                self.gone[oid] += 1
                if self.gone[oid] > self.max_gone:
                    del self.objects[oid]; del self.gone[oid]
            return dict(self.objects)
        if not self.objects:
            for c in centroids:
                self.objects[self.next_id] = c
                self.gone[self.next_id] = 0
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
            if row in used_rows or col in used_cols or D[row, col] > self.max_dist:
                continue
            oid = obj_ids[row]
            self.objects[oid] = centroids[col]; self.gone[oid] = 0
            used_rows.add(row); used_cols.add(col)
        for row in range(len(obj_ids)):
            if row not in used_rows:
                oid = obj_ids[row]; self.gone[oid] += 1
                if self.gone[oid] > self.max_gone:
                    del self.objects[oid]; del self.gone[oid]
        for col in range(len(centroids)):
            if col not in used_cols:
                self.objects[self.next_id] = centroids[col]
                self.gone[self.next_id] = 0; self.next_id += 1
        return dict(self.objects)


# ──────────────────────────────────────────────────────────────
# Detection helpers
# ──────────────────────────────────────────────────────────────

def _detect_persons_hog(frame: np.ndarray) -> List[Dict]:
    small, scale = _resize_to(frame, 640)
    rects, weights = get_hog().detectMultiScale(small, winStride=(16, 16), padding=(8, 8), scale=1.1)
    dets = []
    if len(rects):
        for (x, y, w, h), conf in zip(rects, weights.flatten()):
            x1, y1 = int(x / scale), int(y / scale)
            w2, h2 = int(w / scale), int(h / scale)
            dets.append({
                "object_type": "person", "confidence": float(min(conf, 1.0)),
                "x1": x1, "y1": y1, "x2": x1+w2, "y2": y1+h2,
                "cx": x1 + w2/2, "cy": y1 + h2/2,
                "bounding_box": json.dumps({"x": x1, "y": y1, "w": w2, "h": h2}),
            })
    return dets

def _detect_objects_mog(fg: np.ndarray, fh: int, fw: int) -> List[Dict]:
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    clean = cv2.morphologyEx(fg, cv2.MORPH_OPEN, kernel)
    clean = cv2.dilate(clean, kernel, iterations=2)
    contours, _ = cv2.findContours(clean, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    objs = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 800: continue
        x, y, w, h = cv2.boundingRect(cnt)
        ar = h / max(w, 1)
        obj_type = "vehicle" if area > 20000 else ("person" if ar > 1.5 and h > 60 else ("backpack" if area < 3000 else None))
        if obj_type is None: continue
        objs.append({
            "object_type": obj_type,
            "confidence": round(min(0.6 + area/50000, 0.90), 3),
            "x1": x, "y1": y, "x2": x+w, "y2": y+h,
            "cx": x+w/2, "cy": y+h/2,
            "bounding_box": json.dumps({"x": x, "y": y, "w": w, "h": h}),
        })
    return objs


# ──────────────────────────────────────────────────────────────
# Algorithmic incident sensors (real, non-random)
# ──────────────────────────────────────────────────────────────

def _fire_confidence(frame_bgr: np.ndarray) -> float:
    """Real fire detection via HSV colour analysis."""
    hsv = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2HSV)
    m1 = cv2.inRange(hsv, np.array([0,   50, 100]), np.array([25,  255, 255]))
    m2 = cv2.inRange(hsv, np.array([160, 50, 100]), np.array([180, 255, 255]))
    ratio = (np.count_nonzero(m1) + np.count_nonzero(m2)) / max(1, frame_bgr.shape[0] * frame_bgr.shape[1])
    return float(min(1.0, ratio * 45)) if ratio > 0.012 else 0.0

def _explosion_confidence(frame_bgr: np.ndarray, hist: List[float]) -> float:
    """Real explosion detection via sudden brightness spike."""
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    b = float(np.mean(gray))
    hist.append(b)
    if len(hist) < 6: return 0.0
    baseline = float(np.mean(hist[-12:-1])) if len(hist) >= 12 else float(np.mean(hist[:-1]))
    if baseline < 5: return 0.0
    ratio = b / baseline
    return float(min(0.95, (ratio - 2.5) * 0.25 + 0.65)) if ratio > 2.5 else 0.0

def _fight_confidence(prev_gray: np.ndarray, curr_gray: np.ndarray, person_boxes: List[Tuple]) -> Tuple[bool, float]:
    """Real fight detection: dense optical flow magnitude near multiple persons."""
    if not person_boxes or len(person_boxes) < 2: return False, 0.0
    flow = cv2.calcOpticalFlowFarneback(
        prev_gray, curr_gray, None, 0.5, 2, 11, 2, 5, 1.1, 0)
    mag, _ = cv2.cartToPolar(flow[..., 0], flow[..., 1])
    active = 0
    for (x, y, w, h) in person_boxes:
        rgn = mag[max(0, y):y+h, max(0, x):x+w]
        if rgn.size > 0 and float(np.mean(rgn)) > 3.5:
            active += 1
    return (active >= 2, float(min(0.9, 0.45 + active * 0.12))) if active >= 2 else (False, 0.0)

def _accident_confidence(large_blob_areas: List[float], prev_areas: List[float]) -> float:
    """Real accident detection: sudden appearance of very large merged MOG2 blob."""
    if not large_blob_areas or not prev_areas: return 0.0
    cur_max = max(large_blob_areas)
    prv_max = max(prev_areas) if prev_areas else 0
    if cur_max > 15000 and cur_max > prv_max * 3.0:
        return float(min(0.88, 0.55 + cur_max / 80000))
    return 0.0


# ──────────────────────────────────────────────────────────────
# Drawing helpers
# ──────────────────────────────────────────────────────────────

_DET_COLORS = {"person": (255,90,30), "vehicle": (30,180,255), "backpack": (0,210,90), "fire": (0,60,255)}

def _draw_detections(frame: np.ndarray, dets: List[Dict]) -> np.ndarray:
    out = frame.copy()
    for det in dets:
        try:
            bb = json.loads(det["bounding_box"]) if isinstance(det["bounding_box"], str) else det["bounding_box"]
            x, y, w, h = int(bb["x"]), int(bb["y"]), int(bb["w"]), int(bb["h"])
        except Exception: continue
        col = _DET_COLORS.get(det.get("object_type",""), (0,200,100))
        cv2.rectangle(out, (x,y), (x+w,y+h), col, 2)
        lbl = f"{det['object_type']} {det.get('confidence',0):.2f}"
        lw = len(lbl)*8+4
        cv2.rectangle(out, (x,y-18), (x+lw,y), col, -1)
        cv2.putText(out, lbl, (x+2,y-4), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255,255,255), 1)
    return out

def _draw_evidence(frame: np.ndarray, path: List[Dict], tid: str, etype: str) -> np.ndarray:
    out = frame.copy()
    pts = [(int(p["x"]), int(p["y"])) for p in path if "x" in p]
    for i in range(1, len(pts)):
        a = i / max(len(pts),1)
        cv2.line(out, pts[i-1], pts[i], (int(60*a), int(255*a), int(60*a)), 2)
    if pts: cv2.circle(out, pts[-1], 8, (0,0,255), -1)
    overlay = out.copy()
    cv2.rectangle(overlay, (0,0), (out.shape[1],34), (0,0,0), -1)
    cv2.addWeighted(overlay, 0.65, out, 0.35, 0, out)
    cv2.putText(out, f"[{etype.upper()}]  {tid}", (8,22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (40,80,255), 1)
    return out


# ──────────────────────────────────────────────────────────────
# Representative-frame static pipeline images
# ──────────────────────────────────────────────────────────────

def _save_static_pipeline_images(frame: np.ndarray, prev: Optional[np.ndarray], fg: Optional[np.ndarray],
                                 dets: List[Dict], out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out_dir/"original.jpg"), frame)
    blurred = cv2.GaussianBlur(frame, (15,15), 0)
    cv2.imwrite(str(out_dir/"blur.jpg"), blurred)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
    cv2.imwrite(str(out_dir/"contrast.jpg"), cv2.cvtColor(clahe.apply(gray), cv2.COLOR_GRAY2BGR))
    edges = cv2.Canny(cv2.cvtColor(blurred, cv2.COLOR_BGR2GRAY), 50, 150)
    cv2.imwrite(str(out_dir/"edges.jpg"), cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR))
    if fg is not None:
        mi = np.zeros_like(frame); mi[fg>0] = [200,80,40]
        cnts, _ = cv2.findContours(fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(mi, cnts, -1, (100,200,255), 2)
    elif prev is not None and prev.shape == frame.shape:
        diff = cv2.absdiff(cv2.cvtColor(prev, cv2.COLOR_BGR2GRAY), gray)
        _, mask = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
        mi = np.zeros_like(frame); mi[mask>0] = [200,80,40]
    else:
        mi = np.zeros_like(frame)
    cv2.imwrite(str(out_dir/"motion.jpg"), mi)
    cv2.imwrite(str(out_dir/"detection.jpg"), _draw_detections(frame, dets))


# ──────────────────────────────────────────────────────────────
# Incident detection (all rules consolidated)
# ──────────────────────────────────────────────────────────────

def _detect_incidents(
    all_detections: List[Dict],
    tracking_paths: Dict[int, List],
    track_names: Dict[int, str],
    camera: str,
    fps: float,
    fire_hits: List[Tuple[int, float, np.ndarray]],
    explosion_hits: List[Tuple[int, float, np.ndarray]],
    fight_hits: List[Tuple[int, float, np.ndarray]],
    accident_hits: List[Tuple[int, float, np.ndarray]],
    frames_cache: Dict[int, np.ndarray],
    rep_frame: np.ndarray,
) -> List[Dict]:
    incidents: List[Dict] = []

    def nearest_frame(fn: int) -> np.ndarray:
        if not frames_cache: return rep_frame
        return frames_cache[min(frames_cache, key=lambda k: abs(k-fn))]

    def group_hits(hits, gap_s=3.0):
        """Merge consecutive hits within gap_s seconds into groups; return best per group."""
        if not hits: return []
        hits = sorted(hits, key=lambda x: x[0])
        groups, cur = [], [hits[0]]
        for h in hits[1:]:
            if (h[0] - cur[-1][0]) / fps < gap_s:
                cur.append(h)
            else:
                groups.append(cur); cur = [h]
        groups.append(cur)
        return [max(g, key=lambda x: x[1]) for g in groups]  # highest confidence per group

    # ── Fire ──
    for fn, conf, ev_frame in group_hits(fire_hits):
        incidents.append({
            "event_type": "fire", "risk_score": int(min(95, 55 + conf*40)),
            "severity": "critical", "camera": camera,
            "description": f"Fire detected in {camera} view (HSV colour analysis, confidence {conf:.0%})",
            "timestamp": datetime.now(timezone.utc), "frame_number": fn,
            "metadata": json.dumps({"confidence": round(conf, 3), "detector": "hsv_fire"}),
            "evidence_frame": ev_frame,
        })

    # ── Explosion ──
    for fn, conf, ev_frame in group_hits(explosion_hits):
        incidents.append({
            "event_type": "explosion", "risk_score": 98,
            "severity": "critical", "camera": camera,
            "description": f"Sudden brightness spike detected — possible explosion or flash event (×{conf:.1f} above baseline)",
            "timestamp": datetime.now(timezone.utc), "frame_number": fn,
            "metadata": json.dumps({"confidence": round(conf, 3), "detector": "brightness_spike"}),
            "evidence_frame": ev_frame,
        })

    # ── Violence / Fight ──
    for fn, conf, ev_frame in group_hits(fight_hits, gap_s=5.0):
        incidents.append({
            "event_type": "violence", "risk_score": int(min(90, 60 + conf*35)),
            "severity": "high", "camera": camera,
            "description": f"High-velocity motion near multiple persons — possible fight or violent altercation",
            "timestamp": datetime.now(timezone.utc), "frame_number": fn,
            "metadata": json.dumps({"confidence": round(conf, 3), "detector": "optical_flow"}),
            "evidence_frame": ev_frame,
        })

    # ── Accident ──
    for fn, conf, ev_frame in group_hits(accident_hits, gap_s=5.0):
        incidents.append({
            "event_type": "accident", "risk_score": int(min(92, 60 + conf*35)),
            "severity": "critical" if conf > 0.75 else "high", "camera": camera,
            "description": f"Sudden large foreground object — possible vehicle collision or impact event",
            "timestamp": datetime.now(timezone.utc), "frame_number": fn,
            "metadata": json.dumps({"confidence": round(conf, 3), "detector": "blob_collision"}),
            "evidence_frame": ev_frame,
        })

    # ── Loitering ──
    for tid, path in tracking_paths.items():
        if len(path) < 5: continue
        dur = path[-1]["t"] - path[0]["t"]
        if dur < 20: continue
        xs, ys = [p["x"] for p in path], [p["y"] for p in path]
        spread = float(np.hypot(max(xs)-min(xs), max(ys)-min(ys)))
        if spread < 120:
            fn = int(path[len(path)//2]["t"] * fps)
            name = track_names.get(tid, f"Person #{tid}")
            incidents.append({
                "event_type": "loitering", "risk_score": min(95, 40+int(dur/8)),
                "severity": "high" if dur > 60 else "medium", "camera": camera,
                "description": f"{name} stationary for {int(dur)}s in a confined area",
                "timestamp": datetime.now(timezone.utc), "frame_number": fn,
                "metadata": json.dumps({"person_id": name, "duration_seconds": round(dur,1)}),
                "evidence_frame": _draw_evidence(nearest_frame(fn), path, name, "loitering"),
            })

    # ── Running ──
    for tid, path in tracking_paths.items():
        if len(path) < 4: continue
        vels = []
        for i in range(1, len(path)):
            dt = path[i]["t"] - path[i-1]["t"]
            if dt <= 0: continue
            vels.append(float(np.hypot(path[i]["x"]-path[i-1]["x"], path[i]["y"]-path[i-1]["y"])) / dt)
        if not vels: continue
        mv = max(vels)
        if mv > 60:
            peak = vels.index(mv)+1
            fn = int(path[min(peak, len(path)-1)]["t"] * fps)
            name = track_names.get(tid, f"Person #{tid}")
            incidents.append({
                "event_type": "running", "risk_score": 55,
                "severity": "medium", "camera": camera,
                "description": f"{name} running at {int(mv)} px/s",
                "timestamp": datetime.now(timezone.utc), "frame_number": fn,
                "metadata": json.dumps({"person_id": name, "max_velocity_px_s": round(mv,1)}),
                "evidence_frame": _draw_evidence(nearest_frame(fn), path, name, "running"),
            })

    # ── Crowd formation ──
    frame_count: Dict[int, int] = {}
    for det in all_detections:
        if det["object_type"] == "person":
            frame_count[det["frame_number"]] = frame_count.get(det["frame_number"], 0) + 1
    if frame_count:
        pk = max(frame_count, key=frame_count.get)
        cnt = frame_count[pk]
        if cnt >= 3:
            incidents.append({
                "event_type": "crowd_formation", "risk_score": min(85, 35+cnt*10),
                "severity": "high" if cnt >= 5 else "medium", "camera": camera,
                "description": f"{cnt} persons detected simultaneously in {camera}",
                "timestamp": datetime.now(timezone.utc), "frame_number": pk,
                "metadata": json.dumps({"person_count": cnt}),
                "evidence_frame": _draw_detections(nearest_frame(pk),
                                                    [d for d in all_detections if d["frame_number"]==pk]),
            })

    # ── Suspicious movement (direction reversals) ──
    for tid, path in tracking_paths.items():
        if len(path) < 10: continue
        xs = [p["x"] for p in path]
        revs = sum(1 for i in range(1, len(xs)-1) if (xs[i]-xs[i-1])*(xs[i+1]-xs[i]) < -60)
        if revs >= 3:
            fn = int(path[len(path)//2]["t"] * fps)
            name = track_names.get(tid, f"Person #{tid}")
            incidents.append({
                "event_type": "suspicious_movement", "risk_score": 65,
                "severity": "high", "camera": camera,
                "description": f"{name} back-and-forth pattern — {revs} direction reversals",
                "timestamp": datetime.now(timezone.utc), "frame_number": fn,
                "metadata": json.dumps({"person_id": name, "direction_changes": revs}),
                "evidence_frame": _draw_evidence(nearest_frame(fn), path, name, "suspicious_movement"),
            })

    # ── Fall detection (rapid Y displacement then stable) ──
    for tid, path in tracking_paths.items():
        if len(path) < 8: continue
        for i in range(3, len(path)):
            dt = path[i]["t"] - path[i-3]["t"]
            if dt <= 0: continue
            dy = path[i]["y"] - path[i-3]["y"]
            vy = dy / dt
            if vy > 55 and i < len(path)-2:
                remaining_ys = [p["y"] for p in path[i:]]
                if len(remaining_ys) >= 3 and (max(remaining_ys)-min(remaining_ys)) < 35:
                    fn = int(path[i]["t"] * fps)
                    name = track_names.get(tid, f"Person #{tid}")
                    incidents.append({
                        "event_type": "fall", "risk_score": 75,
                        "severity": "high", "camera": camera,
                        "description": f"{name} fell — sudden downward motion ({int(vy)} px/s) followed by stillness",
                        "timestamp": datetime.now(timezone.utc), "frame_number": fn,
                        "metadata": json.dumps({"person_id": name, "fall_velocity_px_s": round(vy,1)}),
                        "evidence_frame": _draw_evidence(nearest_frame(fn), path[:i+1], name, "fall"),
                    })
                    break

    # ── Abandoned object ──
    obj_frames: Dict[str, List] = {}
    for det in all_detections:
        if det["object_type"] == "backpack":
            obj_frames.setdefault("backpack", []).append(det)
    for otype, dets in obj_frames.items():
        if len(dets) >= 5:
            mid = dets[len(dets)//2]; fn = mid["frame_number"]
            incidents.append({
                "event_type": "abandoned_object", "risk_score": 90,
                "severity": "critical", "camera": camera,
                "description": f"Unattended {otype} across {len(dets)} frames",
                "timestamp": datetime.now(timezone.utc), "frame_number": fn,
                "metadata": json.dumps({"object_type": otype, "frame_count": len(dets)}),
                "evidence_frame": _draw_detections(nearest_frame(fn), [mid]),
            })

    # ── Intrusion (person appearing near frame edges) ──
    edge_events: List[int] = []
    for det in all_detections:
        if det["object_type"] != "person": continue
        # Check if centroid is in outermost 15% of frame
        # Use relative coordinates (0-1) -- approximate from bounding box
        try:
            bb = json.loads(det["bounding_box"]) if isinstance(det["bounding_box"], str) else det["bounding_box"]
        except Exception:
            continue
        cx_rel = (bb["x"] + bb["w"]/2) / max(bb.get("fw", 640), 1)
        cy_rel = (bb["y"] + bb["h"]/2) / max(bb.get("fh", 480), 1)
        if cx_rel < 0.10 or cx_rel > 0.90 or cy_rel < 0.08 or cy_rel > 0.92:
            edge_events.append(det["frame_number"])
    if len(edge_events) >= 3:
        fn = edge_events[0]
        incidents.append({
            "event_type": "intrusion", "risk_score": 70,
            "severity": "high", "camera": camera,
            "description": f"Person detected entering from frame perimeter — possible intrusion",
            "timestamp": datetime.now(timezone.utc), "frame_number": fn,
            "metadata": json.dumps({"entry_frames": edge_events[:5]}),
            "evidence_frame": nearest_frame(fn),
        })

    return incidents


# ──────────────────────────────────────────────────────────────
# Main pipeline (single-pass video generation + detection)
# ──────────────────────────────────────────────────────────────

def _run_pipeline(video_id: int, video: dict):
    try:
        file_path = video.get("file_path")
        camera    = video.get("camera_name", "UNKNOWN")
        if not file_path or not Path(file_path).exists():
            raise ValueError(f"Video file not found: {file_path}")

        logger.info(f"Pipeline start  video_id={video_id}")

        cap = cv2.VideoCapture(file_path)
        fps          = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        in_w         = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        in_h         = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration     = total_frames / fps

        # Output size: cap width at 640
        if in_w > 640:
            out_w = 640; out_h = int(640 * in_h / in_w)
        else:
            out_w, out_h = in_w, in_h

        # Output FPS: cap at 12, subsample input
        out_fps   = min(12.0, fps)
        subsample = max(1, int(round(fps / out_fps)))

        # Processed video writers
        proc_dir = PROCESSED_DIR / str(video_id)
        proc_dir.mkdir(parents=True, exist_ok=True)
        fourcc   = cv2.VideoWriter_fourcc(*"mp4v")
        writers  = {s: cv2.VideoWriter(str(proc_dir / f"{s}.mp4"), fourcc, out_fps, (out_w, out_h))
                    for s in VIDEO_STAGES}

        # State
        mog2    = cv2.createBackgroundSubtractorMOG2(history=200, varThreshold=40, detectShadows=False)
        tracker = CentroidTracker()
        tracking_paths: Dict[int, List] = {}
        track_names:    Dict[int, str]  = {}

        all_detections:   List[Dict]  = []
        brightness_hist:  List[float] = []
        fire_hits:        List        = []
        explosion_hits:   List        = []
        fight_hits:       List        = []
        accident_hits:    List        = []
        frames_cache:     Dict[int, np.ndarray] = {}

        prev_gray        = None
        last_hog_dets    = []
        last_hog_boxes   = []
        prev_blob_areas:  List[float] = []

        rep_frame    = None
        rep_fg_mask  = None
        rep_dets     = []

        frame_idx  = 0
        output_idx = 0
        HOG_INT    = 8  # Run HOG every 8th output frame

        logger.info(f"Processing  total={total_frames}  sub={subsample}  out_fps={out_fps}  size={out_w}×{out_h}")

        while cap.isOpened():
            ret, raw = cap.read()
            if not ret:
                break

            if frame_idx % subsample != 0:
                frame_idx += 1
                continue

            # Resize
            frame = cv2.resize(raw, (out_w, out_h)) if (raw.shape[1] != out_w or raw.shape[0] != out_h) else raw

            # Capture cache every 30th output frame for evidence
            if output_idx % 30 == 0:
                frames_cache[frame_idx] = frame.copy()

            # Representative frame (midpoint)
            if frame_idx >= total_frames // 2 and rep_frame is None:
                rep_frame = frame.copy()

            # ── MOG2 ──
            fg = mog2.apply(frame)
            if rep_frame is not None and rep_fg_mask is None:
                rep_fg_mask = fg.copy()

            # ── HOG detection ──
            curr_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            if output_idx % HOG_INT == 0:
                last_hog_dets  = _detect_persons_hog(frame)
                last_hog_boxes = []
                for det in last_hog_dets:
                    bb = json.loads(det["bounding_box"])
                    last_hog_boxes.append((bb["x"], bb["y"], bb["w"], bb["h"]))

                # MOG2 objects
                obj_dets = _detect_objects_mog(fg, out_h, out_w)
                hog_areas = {(d["x1"]//40, d["y1"]//40) for d in last_hog_dets}
                merged_dets = list(last_hog_dets)
                for od in obj_dets:
                    if od["object_type"] == "person" and (od["x1"]//40, od["y1"]//40) in hog_areas:
                        continue
                    merged_dets.append(od)

                secs   = frame_idx / fps
                ts_str = f"{int(secs//3600):02d}:{int((secs%3600)//60):02d}:{int(secs%60):02d}"
                for det in merged_dets:
                    all_detections.append({**det, "video_id": video_id,
                                           "frame_number": frame_idx, "timestamp": ts_str})

                if rep_frame is not None and rep_dets == []:
                    rep_dets = list(merged_dets)

                # Tracking
                centroids = [(d["cx"], d["cy"]) for d in last_hog_dets]
                tracked   = tracker.update(centroids)
                for tid, (tx, ty) in tracked.items():
                    if tid not in track_names:
                        track_names[tid] = f"Person #{tid}"
                    tracking_paths.setdefault(tid, []).append({"x": tx, "y": ty, "t": frame_idx/fps})

                # Large blob tracking for accident detection
                cnts, _ = cv2.findContours(fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                blob_areas = [cv2.contourArea(c) for c in cnts if cv2.contourArea(c) > 5000]
                acc_conf = _accident_confidence(blob_areas, prev_blob_areas)
                if acc_conf > 0:
                    accident_hits.append((frame_idx, acc_conf, frame.copy()))
                prev_blob_areas = blob_areas

            # ── Per-frame incident sensors ──
            fire_conf = _fire_confidence(frame)
            if fire_conf > 0:
                fire_hits.append((frame_idx, fire_conf, frame.copy()))

            expl_conf = _explosion_confidence(frame, brightness_hist)
            if expl_conf > 0:
                explosion_hits.append((frame_idx, expl_conf, frame.copy()))

            if prev_gray is not None and len(last_hog_boxes) >= 2:
                fight, fconf = _fight_confidence(prev_gray, curr_gray, last_hog_boxes)
                if fight:
                    fight_hits.append((frame_idx, fconf, frame.copy()))

            # ── Write pipeline video frames ──
            writers["original"].write(frame)
            blurred = cv2.GaussianBlur(frame, (15, 15), 0)
            writers["blur"].write(blurred)
            gray_f = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            clahe  = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            writers["contrast"].write(cv2.cvtColor(clahe.apply(gray_f), cv2.COLOR_GRAY2BGR))
            edges  = cv2.Canny(cv2.cvtColor(blurred, cv2.COLOR_BGR2GRAY), 50, 150)
            writers["edges"].write(cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR))
            mi = np.zeros((out_h, out_w, 3), dtype=np.uint8); mi[fg>0] = [200, 80, 40]
            writers["motion"].write(mi)
            writers["detection"].write(_draw_detections(frame, last_hog_dets))

            prev_gray  = curr_gray
            frame_idx += 1
            output_idx += 1

        cap.release()
        for wtr in writers.values():
            wtr.release()

        logger.info(f"Video generation done  output_frames={output_idx}  detections={len(all_detections)}")

        if rep_frame is None and frames_cache:
            rep_frame = next(iter(frames_cache.values()))
        if rep_frame is None:
            raise ValueError("No frames extracted")

        # Static representative frame images
        img_dir = FRAMES_DIR / str(video_id)
        _save_static_pipeline_images(rep_frame, None, rep_fg_mask, rep_dets, img_dir)

        # ── Detect incidents ──
        incidents = _detect_incidents(
            all_detections, tracking_paths, track_names, camera, fps,
            fire_hits, explosion_hits, fight_hits, accident_hits,
            frames_cache, rep_frame,
        )
        logger.info(f"Incidents: {len(incidents)}")

        # ── Save to DB ──
        conn = get_db()
        try:
            cur = conn.cursor()
            for det in all_detections:
                cur.execute(
                    "INSERT INTO detections (video_id,object_type,confidence,frame_number,timestamp,bounding_box) "
                    "VALUES (%s,%s,%s,%s,%s,%s)",
                    (det["video_id"], det["object_type"], det["confidence"],
                     det["frame_number"], det["timestamp"], det["bounding_box"]),
                )
            for tid, path in tracking_paths.items():
                if len(path) < 2: continue
                name = track_names.get(tid, f"Person #{tid}")
                cur.execute(
                    "INSERT INTO tracking (video_id,person_id,camera,path,duration_seconds) VALUES (%s,%s,%s,%s,%s)",
                    (video_id, name, camera, json.dumps(path), int(path[-1]["t"]-path[0]["t"])+1),
                )
            for inc in incidents:
                ev_frame = inc.pop("evidence_frame", None)
                cur.execute(
                    "INSERT INTO events (video_id,event_type,risk_score,severity,description,"
                    "timestamp,camera,frame_number,metadata) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                    (video_id, inc["event_type"], inc["risk_score"], inc["severity"],
                     inc["description"], inc["timestamp"], inc["camera"],
                     inc.get("frame_number"), inc.get("metadata")),
                )
                eid = cur.fetchone()["id"]
                if ev_frame is not None:
                    cv2.imwrite(str(EVIDENCE_DIR / f"{eid}.jpg"), ev_frame)
            cur.execute(
                "UPDATE videos SET status='processed', processed_at=NOW(), frame_count=%s, duration_seconds=%s WHERE id=%s",
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
            conn = get_db(); cur = conn.cursor()
            cur.execute("UPDATE videos SET status='failed' WHERE id=%s", (video_id,))
            conn.commit(); conn.close()
        except Exception:
            pass


# ──────────────────────────────────────────────────────────────
# Entrypoint
# ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
