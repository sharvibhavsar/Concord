import { pgTable, varchar, integer, timestamp, boolean, pgEnum, text, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const genderEnum = pgEnum("gender", ["female", "male", "other", "prefer_not_to_say"]);

export const userProfilesTable = pgTable("user_profiles", {
  userId: varchar("user_id").primaryKey(),
  displayName: varchar("display_name", { length: 100 }),
  gender: genderEnum("gender"),
  // Cycle tracking — only relevant when gender = 'female'
  lastPeriodDate: timestamp("last_period_date", { withTimezone: true }),
  cycleLength: integer("cycle_length").notNull().default(28),
  lutealPhaseLength: integer("luteal_phase_length").notNull().default(14),
  lastPeriodUpdatedAt: timestamp("last_period_updated_at", { withTimezone: true }),
  profileCompleted: boolean("profile_completed").notNull().default(false),
  weekendAvailable: boolean("weekend_available").notNull().default(false),
  // Productivity preferences
  productiveTimeStart: varchar("productive_time_start", { length: 8 }), // e.g. "09:00"
  productiveTimeEnd: varchar("productive_time_end", { length: 8 }),     // e.g. "17:00"
  priorityOrder: text("priority_order").array(),                         // e.g. ['health','study','work']
  // Theme preferences
  themePreference: varchar("theme_preference", { length: 10 }).default("light"), // 'light' | 'dark'
  analyticsTheme: varchar("analytics_theme", { length: 20 }).default("cool"),    // 'pink' | 'warm' | 'cool' | 'custom'
  customThemeColors: jsonb("custom_theme_colors"),                                // { colors: string[] }
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserProfileSchema = createInsertSchema(userProfilesTable).omit({ createdAt: true, updatedAt: true });
export const selectUserProfileSchema = createSelectSchema(userProfilesTable);

export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfilesTable.$inferSelect;
