import { Router } from "express";
import { db } from "@workspace/db";
import { videosTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  UploadVideoBody,
  GetVideoParams,
  DeleteVideoParams,
  ProcessVideoParams,
} from "@workspace/api-zod";
import { generateMockDetections, generateMockEvents, generateMockTracking } from "./pipeline.js";

const router = Router();

router.get("/videos", async (req, res) => {
  const videos = await db.select().from(videosTable).orderBy(videosTable.uploadTime);
  res.json(videos.map(v => ({
    ...v,
    uploadTime: v.uploadTime.toISOString(),
    processedAt: v.processedAt?.toISOString() ?? null,
  })));
});

router.post("/videos", async (req, res) => {
  const body = UploadVideoBody.parse(req.body);
  const [video] = await db.insert(videosTable).values({
    fileName: body.fileName,
    cameraName: body.cameraName,
    durationSeconds: body.durationSeconds ?? null,
    status: "pending",
  }).returning();
  res.status(201).json({
    ...video,
    uploadTime: video.uploadTime.toISOString(),
    processedAt: video.processedAt?.toISOString() ?? null,
  });
});

router.get("/videos/:id", async (req, res) => {
  const { id } = GetVideoParams.parse({ id: Number(req.params.id) });
  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, id));
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }
  res.json({
    ...video,
    uploadTime: video.uploadTime.toISOString(),
    processedAt: video.processedAt?.toISOString() ?? null,
  });
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

router.post("/videos/:id/process", async (req, res) => {
  const { id } = ProcessVideoParams.parse({ id: Number(req.params.id) });
  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, id));
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }

  await db.update(videosTable).set({ status: "processing" }).where(eq(videosTable.id, id));

  setImmediate(async () => {
    try {
      await generateMockDetections(id, video.cameraName);
      await generateMockTracking(id, video.cameraName);
      await generateMockEvents(id, video.cameraName);
      const frameCount = Math.floor(Math.random() * 2000) + 500;
      await db.update(videosTable).set({
        status: "processed",
        processedAt: new Date(),
        frameCount,
        durationSeconds: video.durationSeconds ?? Math.floor(frameCount / 30),
      }).where(eq(videosTable.id, id));
    } catch (e) {
      await db.update(videosTable).set({ status: "failed" }).where(eq(videosTable.id, id));
    }
  });

  const [updated] = await db.select().from(videosTable).where(eq(videosTable.id, id));
  res.json({
    ...updated,
    uploadTime: updated.uploadTime.toISOString(),
    processedAt: updated.processedAt?.toISOString() ?? null,
  });
});

export default router;
