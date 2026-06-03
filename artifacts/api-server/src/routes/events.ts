import { Router } from "express";
import { db } from "@workspace/db";
import { eventsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { CreateEventBody, ListEventsQueryParams, GetEventParams } from "@workspace/api-zod";

const router = Router();

router.get("/events", async (req, res) => {
  const params = ListEventsQueryParams.parse({
    videoId: req.query.videoId ? Number(req.query.videoId) : undefined,
    severity: req.query.severity as string | undefined,
    eventType: req.query.eventType as string | undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });

  const conditions = [];
  if (params.videoId) conditions.push(eq(eventsTable.videoId, params.videoId));
  if (params.severity) conditions.push(eq(eventsTable.severity, params.severity));
  if (params.eventType) conditions.push(eq(eventsTable.eventType, params.eventType));

  const results = conditions.length
    ? await db.select().from(eventsTable).where(and(...conditions)).orderBy(desc(eventsTable.timestamp)).limit(params.limit ?? 100)
    : await db.select().from(eventsTable).orderBy(desc(eventsTable.timestamp)).limit(params.limit ?? 100);

  res.json(results.map(e => ({
    ...e,
    timestamp: e.timestamp.toISOString(),
    createdAt: e.createdAt.toISOString(),
  })));
});

router.post("/events", async (req, res) => {
  const body = CreateEventBody.parse(req.body);
  const [evt] = await db.insert(eventsTable).values({
    ...body,
    timestamp: new Date(body.timestamp),
  }).returning();
  res.status(201).json({
    ...evt,
    timestamp: evt.timestamp.toISOString(),
    createdAt: evt.createdAt.toISOString(),
  });
});

router.get("/events/:id", async (req, res) => {
  const { id } = GetEventParams.parse({ id: Number(req.params.id) });
  const [evt] = await db.select().from(eventsTable).where(eq(eventsTable.id, id));
  if (!evt) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.json({
    ...evt,
    timestamp: evt.timestamp.toISOString(),
    createdAt: evt.createdAt.toISOString(),
  });
});

export default router;
