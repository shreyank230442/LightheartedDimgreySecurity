import { Router } from "express";
import { db } from "@workspace/db";
import { detectionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateDetectionBody, ListDetectionsQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/detections", async (req, res) => {
  const params = ListDetectionsQueryParams.parse({
    videoId: req.query.videoId ? Number(req.query.videoId) : undefined,
    objectType: req.query.objectType as string | undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });

  let query = db.select().from(detectionsTable);
  const conditions = [];
  if (params.videoId) conditions.push(eq(detectionsTable.videoId, params.videoId));
  if (params.objectType) conditions.push(eq(detectionsTable.objectType, params.objectType));

  const results = conditions.length
    ? await db.select().from(detectionsTable).where(and(...conditions)).limit(params.limit ?? 100)
    : await db.select().from(detectionsTable).limit(params.limit ?? 100);

  res.json(results.map(d => ({ ...d, createdAt: d.createdAt.toISOString() })));
});

router.post("/detections", async (req, res) => {
  const body = CreateDetectionBody.parse(req.body);
  const [det] = await db.insert(detectionsTable).values(body).returning();
  res.status(201).json({ ...det, createdAt: det.createdAt.toISOString() });
});

export default router;
