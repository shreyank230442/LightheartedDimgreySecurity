import { db } from "@workspace/db";
import { detectionsTable, trackingTable, eventsTable } from "@workspace/db";

const OBJECT_TYPES = ["person", "bag", "vehicle", "bicycle", "motorcycle"];
const EVENT_TYPES = [
  { type: "loitering", riskScore: 40, severity: "medium" },
  { type: "crowd_formation", riskScore: 55, severity: "medium" },
  { type: "running", riskScore: 35, severity: "low" },
  { type: "restricted_area_intrusion", riskScore: 80, severity: "high" },
  { type: "abandoned_object", riskScore: 95, severity: "critical" },
  { type: "suspicious_movement", riskScore: 60, severity: "high" },
];

export async function generateMockDetections(videoId: number, camera: string) {
  const count = Math.floor(Math.random() * 30) + 10;
  const detections = [];
  for (let i = 0; i < count; i++) {
    const frameNumber = Math.floor(Math.random() * 1800) + 1;
    const seconds = Math.floor(frameNumber / 30);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    detections.push({
      videoId,
      objectType: OBJECT_TYPES[Math.floor(Math.random() * OBJECT_TYPES.length)],
      confidence: Math.round((0.6 + Math.random() * 0.39) * 100) / 100,
      frameNumber,
      timestamp: `${String(Math.floor(Math.random() * 3) + 15).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
      boundingBox: JSON.stringify({
        x: Math.floor(Math.random() * 600),
        y: Math.floor(Math.random() * 400),
        w: Math.floor(Math.random() * 150) + 50,
        h: Math.floor(Math.random() * 200) + 80,
      }),
    });
  }
  await db.insert(detectionsTable).values(detections);
}

export async function generateMockTracking(videoId: number, camera: string) {
  const count = Math.floor(Math.random() * 8) + 3;
  const tracking = [];
  for (let i = 0; i < count; i++) {
    const personId = `Person #${Math.floor(Math.random() * 90) + 10}`;
    const duration = Math.floor(Math.random() * 600) + 30;
    tracking.push({
      videoId,
      personId,
      camera,
      durationSeconds: duration,
      path: JSON.stringify([
        { x: Math.floor(Math.random() * 800), y: Math.floor(Math.random() * 600), t: 0 },
        { x: Math.floor(Math.random() * 800), y: Math.floor(Math.random() * 600), t: duration / 2 },
        { x: Math.floor(Math.random() * 800), y: Math.floor(Math.random() * 600), t: duration },
      ]),
    });
  }
  await db.insert(trackingTable).values(tracking);
}

export async function generateMockEvents(videoId: number, camera: string) {
  const count = Math.floor(Math.random() * 4) + 1;
  const events = [];
  const baseTime = new Date();
  baseTime.setHours(baseTime.getHours() - Math.floor(Math.random() * 6));

  for (let i = 0; i < count; i++) {
    const evtTemplate = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
    const evtTime = new Date(baseTime.getTime() + i * 3 * 60 * 1000);
    const descriptions: Record<string, string> = {
      loitering: "Person remained stationary in the same region for extended period",
      crowd_formation: "Multiple individuals gathered in a confined area",
      running: "Subject detected moving at high velocity",
      restricted_area_intrusion: "Unauthorized entry into restricted zone detected",
      abandoned_object: "Unattended bag/object detected after owner departed",
      suspicious_movement: "Repeated back-and-forth movement pattern observed",
    };
    events.push({
      videoId,
      eventType: evtTemplate.type,
      riskScore: evtTemplate.riskScore,
      severity: evtTemplate.severity,
      description: descriptions[evtTemplate.type] ?? evtTemplate.type,
      timestamp: evtTime,
      camera,
      frameNumber: Math.floor(Math.random() * 1800) + 1,
      metadata: JSON.stringify({ personId: `Person #${Math.floor(Math.random() * 90) + 10}` }),
    });
  }
  await db.insert(eventsTable).values(events);
}
