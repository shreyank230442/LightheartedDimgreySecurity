import { Router } from "express";

const CV_PORT = process.env["CV_SERVICE_PORT"] ?? "8000";
const CV_URL  = `http://localhost:${CV_PORT}`;

const router = Router();

async function proxyImage(url: string, res: import("express").Response, cacheSeconds = 3600) {
  let cvRes: Response;
  try { cvRes = await fetch(url); }
  catch { res.status(502).json({ error: "CV service unavailable" }); return; }
  const buf = await cvRes.arrayBuffer();
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", `public, max-age=${cacheSeconds}`);
  res.send(Buffer.from(buf));
}

// Pipeline stage static images (representative frame)
router.get("/pipeline/frames/:videoId/:stage", async (req, res) => {
  const { videoId, stage } = req.params;
  await proxyImage(`${CV_URL}/pipeline/${videoId}/${stage}`, res);
});

// Pipeline stage VIDEOS — streaming proxy with Range-request support for seeking
router.get("/pipeline/video/:videoId/:stage", async (req, res) => {
  const { videoId, stage } = req.params;
  const rangeHeader = req.headers["range"] as string | undefined;

  let cvRes: Response;
  try {
    cvRes = await fetch(`${CV_URL}/pipeline_video/${videoId}/${stage}`, {
      headers: rangeHeader ? { Range: rangeHeader } : {},
    });
  } catch {
    res.status(502).json({ error: "CV service unavailable" });
    return;
  }

  if (!cvRes.ok) {
    res.status(cvRes.status).json({ error: "Video not available" });
    return;
  }

  res.status(cvRes.status);
  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Accept-Ranges", "bytes");
  const cl = cvRes.headers.get("content-length");  if (cl) res.setHeader("Content-Length", cl);
  const cr = cvRes.headers.get("content-range");   if (cr) res.setHeader("Content-Range", cr);

  if (!cvRes.body) { res.end(); return; }

  const reader = cvRes.body.getReader();
  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { res.end(); break; }
        res.write(Buffer.from(value));
      }
    } catch { res.end(); }
  })();
});

// Thumbnail images
router.get("/pipeline/thumbnail/:filename", async (req, res) => {
  const { filename } = req.params;
  await proxyImage(`${CV_URL}/thumbnail/${encodeURIComponent(filename)}`, res, 86400);
});

// Evidence frame images
router.get("/evidence/:eventId", async (req, res) => {
  const { eventId } = req.params;
  await proxyImage(`${CV_URL}/evidence/${eventId}`, res);
});

export default router;
