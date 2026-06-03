import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reportsTable = pgTable("reports", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id"),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  findings: text("findings").notNull(),
  recommendations: text("recommendations").notNull(),
  severity: text("severity").notNull(),
  riskScore: integer("risk_score").notNull(),
  timeline: text("timeline"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReportSchema = createInsertSchema(reportsTable).omit({ id: true, createdAt: true });
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reportsTable.$inferSelect;
