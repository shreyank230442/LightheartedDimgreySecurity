import { Router } from "express";
import { db } from "@workspace/db";
import { reportsTable, eventsTable, detectionsTable, videosTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateReportBody, GetReportParams, DeleteReportParams } from "@workspace/api-zod";
import { ai } from "@workspace/integrations-gemini-ai";

const router = Router();

function fmtReport(r: typeof reportsTable.$inferSelect) {
  return {
    ...r,
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/reports", async (_req, res) => {
  const reports = await db.select().from(reportsTable).orderBy(desc(reportsTable.createdAt));
  res.json(reports.map(fmtReport));
});

router.get("/reports/:id", async (req, res) => {
  const { id } = GetReportParams.parse({ id: Number(req.params.id) });
  const [report] = await db.select().from(reportsTable).where(eq(reportsTable.id, id));
  if (!report) { res.status(404).json({ error: "Report not found" }); return; }
  res.json(fmtReport(report));
});

router.delete("/reports/:id", async (req, res) => {
  const { id } = DeleteReportParams.parse({ id: Number(req.params.id) });
  const [report] = await db.select().from(reportsTable).where(eq(reportsTable.id, id));
  if (!report) { res.status(404).json({ error: "Report not found" }); return; }
  await db.delete(reportsTable).where(eq(reportsTable.id, id));
  res.status(204).send();
});

router.post("/reports", async (req, res) => {
  const body = CreateReportBody.parse(req.body);

  let eventsData: typeof eventsTable.$inferSelect[] = [];
  let detectionsData: typeof detectionsTable.$inferSelect[] = [];
  let videoName = "Unknown Camera";

  if (body.videoId) {
    const [video] = await db.select().from(videosTable).where(eq(videosTable.id, body.videoId));
    if (video) videoName = video.cameraName;
    eventsData = await db.select().from(eventsTable).where(eq(eventsTable.videoId, body.videoId));
    detectionsData = await db.select().from(detectionsTable).where(eq(detectionsTable.videoId, body.videoId));
  } else {
    eventsData = await db.select().from(eventsTable).orderBy(desc(eventsTable.timestamp)).limit(20);
    detectionsData = await db.select().from(detectionsTable).limit(30);
  }

  const maxRisk = eventsData.reduce((m, e) => Math.max(m, e.riskScore), 0);
  const severity = maxRisk >= 80 ? "critical" : maxRisk >= 60 ? "high" : maxRisk >= 40 ? "medium" : "low";

  const eventSummary = eventsData.map(e =>
    `- [${e.severity.toUpperCase()}] ${e.eventType} at ${e.camera}: ${e.description} (risk: ${e.riskScore})`
  ).join("\n") || "No events detected.";

  const detectionSummary = `${detectionsData.length} objects detected including ${
    [...new Set(detectionsData.map(d => d.objectType))].join(", ")
  }`;

  let aiSummary = "";
  let aiFindings = "";
  let aiRecommendations = "";
  let aiTimeline = "";

  try {
    const prompt = `You are an AI-powered security investigation system. Generate a professional incident investigation report based on the following surveillance data.

Camera: ${videoName}
Detections: ${detectionSummary}
Events:
${eventSummary}

Generate a JSON response with these fields:
- summary: 2-3 sentence executive summary of the incident
- findings: detailed findings paragraph (3-4 sentences) covering what was detected, behavioral patterns, and risk assessment
- recommendations: 3-4 actionable security recommendations as a paragraph
- timeline: brief chronological narrative of events

Respond ONLY with valid JSON, no markdown.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 8192 },
    });

    const text = response.text ?? "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    aiSummary = parsed.summary ?? "";
    aiFindings = parsed.findings ?? "";
    aiRecommendations = parsed.recommendations ?? "";
    aiTimeline = parsed.timeline ?? "";
  } catch {
    aiSummary = `Investigation report for ${videoName}. ${eventsData.length} incidents detected with maximum risk score of ${maxRisk}.`;
    aiFindings = `Analysis of surveillance footage revealed ${detectionsData.length} object detections across ${eventsData.length} distinct incidents. ${eventSummary}`;
    aiRecommendations = "Increase surveillance coverage in flagged areas. Review access control policies. Alert security personnel to high-risk events. Schedule follow-up investigation.";
    aiTimeline = eventsData.map(e => `${new Date(e.timestamp).toLocaleTimeString()}: ${e.description}`).join(". ");
  }

  const [report] = await db.insert(reportsTable).values({
    videoId: body.videoId ?? null,
    title: body.title,
    summary: aiSummary,
    findings: aiFindings,
    recommendations: aiRecommendations,
    severity,
    riskScore: maxRisk,
    timeline: aiTimeline,
  }).returning();

  res.status(201).json(fmtReport(report));
});

export default router;
