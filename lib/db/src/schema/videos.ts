import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const videosTable = pgTable("videos", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  cameraName: text("camera_name").notNull(),
  status: text("status").notNull().default("pending"),
  durationSeconds: integer("duration_seconds"),
  frameCount: integer("frame_count"),
  thumbnailUrl: text("thumbnail_url"),
  uploadTime: timestamp("upload_time", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

export const insertVideoSchema = createInsertSchema(videosTable).omit({ id: true, uploadTime: true });
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videosTable.$inferSelect;
