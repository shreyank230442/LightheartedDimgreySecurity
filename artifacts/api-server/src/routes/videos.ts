import { Router } from "express";
import { db } from "@workspace/db";
import { videosTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetVideoParams, DeleteVideoParams, ProcessVideoParams } from "@workspace/api-zod";

const CV_PORT = process.env["CV_SERVICE_PORT"] ?? "8000";
const CV_URL = `http://localhost:${CV_PORT}`;

const router = Router();

function fmtVideo(v: typeof videosTable.$inferSelect) {
  return {
    ...v,
    uploadTime: v.uploadTime.toISOString(),
    processedAt: v.processedAt?.toISOString() ?? null,
  };
}

router.get("/videos", async (_req, res) => {
  const videos = await db.select().from(videosTable).orderBy(videosTable.uploadTime);
  res.json(videos.map(fmtVideo));
});

router.get("/videos/:id", async (req, res) => {
  const { id } = GetVideoParams.parse({ id: Number(req.params.id) });
  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, id));
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }
  res.json(fmtVideo(video));
});

router.delete("/videos/:id", async (req, res) => {
  const { id } = DeleteVideoParams.parse({ id: Number(req.params.id) });
  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, id));
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }
  await db.delete(videosTable).where(eq(videosTable.id, id));
  res.status(204).send();
});

// Real file upload — proxy multipart body directly to Python CV service
router.post("/videos/upload", async (req, res) => {
  const contentType = req.headers["content-type"] ?? "";
  if (!contentType.includes("multipart/form-data")) {
    res.status(400).json({ error: "Expected multipart/form-data" });
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    chunks.push(Buffer.from(chunk));
  }
  const rawBody = Buffer.concat(chunks);

  let cvResponse: Response;
  try {
    cvResponse = await fetch(`${CV_URL}/upload`, {
      method: "POST",
      headers: { "content-type": contentType },
      body: rawBody,
    });
  } catch {
    res.status(502).json({ error: "CV service unavailable — is it running?" });
    return;
  }

  const data = await cvResponse.json();
  res.status(cvResponse.ok ? 201 : cvResponse.status).json(data);
});

// Trigger CV pipeline processing for an uploaded video
router.post("/videos/:id/process", async (req, res) => {
  const { id } = ProcessVideoParams.parse({ id: Number(req.params.id) });
  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, id));
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }

  try {
    const cvResponse = await fetch(`${CV_URL}/process/${id}`, { method: "POST" });
    if (!cvResponse.ok) {
      const errText = await cvResponse.text();
      req.log.warn({ errText }, "CV service process returned error");
    } else {
      await cvResponse.json();
    }
  } catch (err) {
    req.log.error({ err }, "CV service unreachable for process");
    await db.update(videosTable).set({ status: "failed" }).where(eq(videosTable.id, id));
    res.status(502).json({ error: "CV service unavailable" });
    return;
  }

  const [updated] = await db.select().from(videosTable).where(eq(videosTable.id, id));
  res.json(fmtVideo(updated));
});

export default router;
