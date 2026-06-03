import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const detectionsTable = pgTable("detections", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").notNull(),
  objectType: text("object_type").notNull(),
  confidence: real("confidence").notNull(),
  frameNumber: integer("frame_number").notNull(),
  timestamp: text("timestamp").notNull(),
  boundingBox: text("bounding_box"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDetectionSchema = createInsertSchema(detectionsTable).omit({ id: true, createdAt: true });
export type InsertDetection = z.infer<typeof insertDetectionSchema>;
export type Detection = typeof detectionsTable.$inferSelect;
