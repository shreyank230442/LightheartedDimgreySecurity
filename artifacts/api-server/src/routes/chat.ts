import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages, eventsTable, detectionsTable, videosTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateConversationBody, SendMessageBody, SendMessageParams, ListMessagesParams } from "@workspace/api-zod";
import { ai } from "@workspace/integrations-gemini-ai";

const router = Router();

function fmtConversation(c: typeof conversations.$inferSelect) {
  return { ...c, createdAt: c.createdAt.toISOString() };
}
function fmtMessage(m: typeof messages.$inferSelect) {
  return { ...m, conversationId: m.conversationId, createdAt: m.createdAt.toISOString() };
}

router.get("/chat/conversations", async (_req, res) => {
  const convs = await db.select().from(conversations).orderBy(desc(conversations.createdAt));
  res.json(convs.map(fmtConversation));
});

router.post("/chat/conversations", async (req, res) => {
  const body = CreateConversationBody.parse(req.body);
  const [conv] = await db.insert(conversations).values({ title: body.title }).returning();
  res.status(201).json(fmtConversation(conv));
});

router.get("/chat/conversations/:id/messages", async (req, res) => {
  const { id } = ListMessagesParams.parse({ id: Number(req.params.id) });
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt);
  res.json(msgs.map(fmtMessage));
});

router.post("/chat/conversations/:id/messages", async (req, res) => {
  const { id } = SendMessageParams.parse({ id: Number(req.params.id) });
  const body = SendMessageBody.parse(req.body);

  await db.insert(messages).values({ conversationId: id, role: "user", content: body.content });

  const allMsgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt);

  const recentEvents = await db.select().from(eventsTable).orderBy(desc(eventsTable.timestamp)).limit(20);
  const recentDetections = await db.select().from(detectionsTable).limit(30);
  const recentVideos = await db.select().from(videosTable).limit(10);

  const contextDoc = `
SURVEILLANCE SYSTEM CONTEXT (use this to answer questions):

Videos uploaded: ${recentVideos.map(v => `${v.cameraName} (${v.fileName}, status: ${v.status})`).join("; ")}

Recent detections: ${recentDetections.map(d => `${d.objectType} at frame ${d.frameNumber} (confidence: ${Math.round(d.confidence * 100)}%)`).join("; ")}

Detected incidents:
${recentEvents.map(e => `- [${e.severity.toUpperCase()} risk:${e.riskScore}] ${e.eventType} on ${e.camera} at ${new Date(e.timestamp).toLocaleTimeString()}: ${e.description}`).join("\n")}

You are AVIS — the Agentic Visual Incident Investigation System AI assistant. Answer questions about the surveillance incidents based on the context above. Be concise and security-focused.
`.trim();

  const chatHistory = allMsgs.slice(0, -1).map(m => ({
    role: m.role === "assistant" ? "model" as const : "user" as const,
    parts: [{ text: m.content }],
  }));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: contextDoc }] },
        { role: "model", parts: [{ text: "Understood. I have the surveillance context and I'm ready to assist with the investigation." }] },
        ...chatHistory,
        { role: "user", parts: [{ text: body.content }] },
      ],
      config: { maxOutputTokens: 8192 },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }
  } catch (err) {
    fullResponse = "I encountered an error processing your request. Please check that your Gemini API key is valid and try again.";
    res.write(`data: ${JSON.stringify({ content: fullResponse })}\n\n`);
  }

  await db.insert(messages).values({ conversationId: id, role: "assistant", content: fullResponse });
  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
