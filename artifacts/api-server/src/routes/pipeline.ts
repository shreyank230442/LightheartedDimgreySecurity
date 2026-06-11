import { Router } from "express";

const CV_PORT = process.env["CV_SERVICE_PORT"] ?? "8000";
const CV_URL = `http://localhost:${CV_PORT}`;

const router = Router();

async function proxyImage(url: string, res: import("express").Response, cacheSeconds = 3600) {
  let cvRes: Response;
  try {
    cvRes = await fetch(url);
  } catch {
    res.status(502).json({ error: "CV service unavailable" });
    return;
  }
  const buf = await cvRes.arrayBuffer();
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", `public, max-age=${cacheSeconds}`);
  res.send(Buffer.from(buf));
}

// Pipeline stage images — stages: original | blur | contrast | edges | motion | detection
router.get("/pipeline/frames/:videoId/:stage", async (req, res) => {
  const { videoId, stage } = req.params;
  await proxyImage(`${CV_URL}/pipeline/${videoId}/${stage}`, res);
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
