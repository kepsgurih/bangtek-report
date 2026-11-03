import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { io } from "next/cache";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "./db";
import { session, user, rateLimit } from "./db/schema";
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-bangtek_session" : "bangtek_session";
export const SESSION_AGE = 60 * 60 * 24 * 7;
export const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
export function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function newSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  return { token, row: { id: randomUUID(), userId, token: tokenHash(token), expiresAt: new Date(Date.now() + SESSION_AGE * 1000) } };
}
export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  // `new Date()` below is not render-predictable; `io()` keeps the query
  // (and its timestamp) out of the prerendered static shell.
  await io();
  const [row] = await db.select({ id: session.id, user: { id: user.id, name: user.name, email: user.email } }).from(session).innerJoin(user, eq(user.id, session.userId)).where(and(eq(session.token, tokenHash(token)), gt(session.expiresAt, new Date()))).limit(1);
  return row ?? null;
}
export async function consumeLimit(key: string, max: number) {
  const now = Date.now(); const cutoff = now - 60000;
  const [row] = await db.insert(rateLimit).values({ id: randomUUID(), key: `manual:${key}`, count: 1, lastRequest: now }).onConflictDoUpdate({ target: rateLimit.key, set: {
    count: sql`case when ${rateLimit.lastRequest} <= ${cutoff} then 1 else ${rateLimit.count} + 1 end`,
    lastRequest: sql`case when ${rateLimit.lastRequest} <= ${cutoff} then ${now} else ${rateLimit.lastRequest} end`,
  } }).returning({ count: rateLimit.count });
  return row.count <= max;
}
