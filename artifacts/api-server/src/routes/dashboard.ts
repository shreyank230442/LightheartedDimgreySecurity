import { Router } from "express";
import { db } from "@workspace/db";
import { videosTable, detectionsTable, eventsTable, reportsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();

router.get("/dashboard/stats", async (_req, res) => {
  const [videoStats] = await db.select({
    total: sql<number>`count(*)`.mapWith(Number),
    processed: sql<number>`count(*) filter (where status = 'processed')`.mapWith(Number),
  }).from(videosTable);

  const [detectionCount] = await db.select({
    total: sql<number>`count(*)`.mapWith(Number),
  }).from(detectionsTable);

  const [activeIncidents] = await db.select({
    total: sql<number>`count(*)`.mapWith(Number),
  }).from(eventsTable).where(sql`severity in ('high', 'critical')`);

  const [criticalIncidents] = await db.select({
    total: sql<number>`count(*)`.mapWith(Number),
  }).from(eventsTable).where(eq(eventsTable.severity, "critical"));

  const [reportCount] = await db.select({
    total: sql<number>`count(*)`.mapWith(Number),
  }).from(reportsTable);

  res.json({
    totalVideos: videoStats?.total ?? 0,
    totalDetections: detectionCount?.total ?? 0,
    activeIncidents: activeIncidents?.total ?? 0,
    criticalIncidents: criticalIncidents?.total ?? 0,
    totalReports: reportCount?.total ?? 0,
    processedVideos: videoStats?.processed ?? 0,
  });
});

router.get("/dashboard/timeline", async (_req, res) => {
  const events = await db.select().from(eventsTable).orderBy(desc(eventsTable.timestamp)).limit(20);
  res.json(events.map(e => ({
    id: e.id,
    timestamp: e.timestamp.toISOString(),
    eventType: e.eventType,
    description: e.description,
    severity: e.severity,
    camera: e.camera,
    riskScore: e.riskScore,
  })));
});

router.get("/dashboard/risk-breakdown", async (_req, res) => {
  const breakdown = await db.select({
    severity: eventsTable.severity,
    count: sql<number>`count(*)`.mapWith(Number),
  }).from(eventsTable).groupBy(eventsTable.severity);

  res.json(breakdown);
});

export default router;
