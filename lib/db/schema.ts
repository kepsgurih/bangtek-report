import { pgTable, text, timestamp, boolean, integer, bigint, serial, date, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();
export const user = pgTable("bangtek_user", {
  id: text("id").primaryKey(), name: text("name").notNull(), email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  emailVerified: boolean("email_verified").default(false).notNull(), image: text("image"), createdAt: createdAt(), updatedAt: updatedAt(),
});
export const session = pgTable("bangtek_session", {
  id: text("id").primaryKey(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), token: text("token").notNull().unique(),
  createdAt: createdAt(), updatedAt: updatedAt(), ipAddress: text("ip_address"), userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, table => [index("bangtek_session_user_idx").on(table.userId)]);
export const account = pgTable("bangtek_account", {
  id: text("id").primaryKey(), accountId: text("account_id").notNull(), providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }), accessToken: text("access_token"), refreshToken: text("refresh_token"), idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }), refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"), password: text("password"), createdAt: createdAt(), updatedAt: updatedAt(),
}, table => [index("bangtek_account_user_idx").on(table.userId)]);
export const verification = pgTable("bangtek_verification", { id: text("id").primaryKey(), identifier: text("identifier").notNull(), value: text("value").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), createdAt: createdAt(), updatedAt: updatedAt() });
export const rateLimit = pgTable("bangtek_rate_limit", { id: text("id").primaryKey(), key: text("key").notNull().unique(), count: integer("count").notNull(), lastRequest: bigint("last_request", { mode: "number" }).notNull() });
export const owner = pgTable("bangtek_owner", { id: integer("id").primaryKey(), userId: text("user_id").notNull().references(() => user.id, { onDelete: "restrict" }) });
export const adminAccess = pgTable("bangtek_admin_access", { userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }), approved: boolean("approved").default(false).notNull() });
export const apiToken = pgTable("bangtek_api_token", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: createdAt(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});
export const sprints = pgTable("bangtek_sprint", {
  id: serial("id").primaryKey(), number: integer("number").notNull().unique(), title: text("title").notNull(),
  startDate: date("start_date").notNull(), endDate: date("end_date").notNull(),
  status: text("status", { enum: ["planned", "active", "completed"] }).default("planned").notNull(),
  published: boolean("published").default(false).notNull(), notes: text("notes").default("").notNull(), source: text("source").default("").notNull(),
  version: integer("version").default(1).notNull(), createdAt: createdAt(), updatedAt: updatedAt(),
}, table => [uniqueIndex("bangtek_one_active_sprint").on(table.status).where(requireActive())]);
// A partial unique index keeps concurrent edits from activating two sprints.
import { sql } from "drizzle-orm";
function requireActive() { return sql`status = 'active'`; }
export type TaskStep = { title: string; done: boolean };
export const tasks = pgTable("bangtek_task", {
  id: serial("id").primaryKey(), sprintId: integer("sprint_id").references(() => sprints.id, { onDelete: "restrict" }),
  title: text("title").notNull(), description: text("description").default("").notNull(), category: text("category").default("").notNull(),
  priority: text("priority", { enum: ["high", "medium", "low"] }).default("medium").notNull(),
  status: text("status", { enum: ["todo", "in_progress", "blocked", "done"] }).default("todo").notNull(),
  blocker: text("blocker").default("").notNull(), steps: jsonb("steps").$type<TaskStep[]>().default([]).notNull(),
  version: integer("version").default(1).notNull(), createdAt: createdAt(), updatedAt: updatedAt(),
}, table => [index("bangtek_task_sprint_idx").on(table.sprintId)]);
