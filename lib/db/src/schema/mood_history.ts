import { pgTable, serial, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const moodHistoryTable = pgTable("mood_history", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 50 }).notNull().default("neutral"),
  happy: integer("happy").notNull().default(5),
  sad: integer("sad").notNull().default(5),
  stress: integer("stress").notNull().default(5),
  fatigue: integer("fatigue").notNull().default(5),
  energy: integer("energy").notNull().default(5),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MoodHistory = typeof moodHistoryTable.$inferSelect;
export type InsertMoodHistory = typeof moodHistoryTable.$inferInsert;
