import { Router } from "express";
import { db } from "@workspace/db";
import { trackingTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateTrackingBody, ListTrackingQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/tracking", async (req, res) => {
  const params = ListTrackingQueryParams.parse({
    videoId: req.query.videoId ? Number(req.query.videoId) : undefined,
    personId: req.query.personId as string | undefined,
  });

  const conditions = [];
  if (params.videoId) conditions.push(eq(trackingTable.videoId, params.videoId));
  if (params.personId) conditions.push(eq(trackingTable.personId, params.personId));

  const results = conditions.length
    ? await db.select().from(trackingTable).where(and(...conditions))
    : await db.select().from(trackingTable);

  res.json(results.map(t => ({ ...t, createdAt: t.createdAt.toISOString() })));
});

router.post("/tracking", async (req, res) => {
  const body = CreateTrackingBody.parse(req.body);
  const [tr] = await db.insert(trackingTable).values(body).returning();
  res.status(201).json({ ...tr, createdAt: tr.createdAt.toISOString() });
});

export default router;
