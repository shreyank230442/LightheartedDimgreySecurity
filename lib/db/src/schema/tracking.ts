import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const trackingTable = pgTable("tracking", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").notNull(),
  personId: text("person_id").notNull(),
  path: text("path"),
  camera: text("camera").notNull(),
  durationSeconds: integer("duration_seconds"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTrackingSchema = createInsertSchema(trackingTable).omit({ id: true, createdAt: true });
export type InsertTracking = z.infer<typeof insertTrackingSchema>;
export type TrackingRecord = typeof trackingTable.$inferSelect;
