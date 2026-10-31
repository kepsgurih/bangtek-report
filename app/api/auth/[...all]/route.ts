import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { user, owner, adminAccess, session } from "@/lib/db/schema";
import { SESSION_COOKIE, SESSION_AGE, cookieOptions, newSession, getSession, consumeLimit, tokenHash } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { allowedOrigin } from "@/lib/origin";

const credentials = z.object({ email: z.email().max(254).transform(value => value.toLowerCase()), password: z.string().min(1).max(128) });
const registration = credentials.extend({ name: z.string().trim().min(2).max(100), password: z.string().min(10).max(128) });
const dummyHash = "scrypt$32768$8$3$" + "0".repeat(48) + "$" + "0".repeat(128);
function reply(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } }); }
function loginResponse(person: { id: string; name: string; email: string }, token: string) {
  const response = reply({ user: person });
  response.cookies.set(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_AGE });
  return response;
}
export async function GET(request: Request, context: { params: Promise<{ all: string[] }> }) {
  const path = (await context.params).all.join("/");
  if (path !== "get-session") return reply({ error: "Tidak ditemukan." }, 404);
  try { return reply(await getSession()); } catch { return reply({ error: "Sesi belum bisa diperiksa." }, 503); }
}
export async function POST(request: Request, context: { params: Promise<{ all: string[] }> }) {
  if (!allowedOrigin(request)) return reply({ error: "Origin tidak diizinkan." }, 403);
  const path = (await context.params).all.join("/");
  try {
    if (path === "sign-out") {
      const token = request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
      if (token && /^[a-f0-9]{64}$/.test(token)) await db.delete(session).where(eq(session.token, tokenHash(token)));
      const response = reply({ ok: true }); response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 }); return response;
    }
    if (path !== "sign-up/email" && path !== "sign-in/email") return reply({ error: "Tidak ditemukan." }, 404);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return reply({ error: "Format tidak valid." }, 415);
    const body = await request.text();
    if (Buffer.byteLength(body) > 16384) return reply({ error: "Data terlalu besar." }, 413);
    let input: unknown; try { input = JSON.parse(body); } catch { return reply({ error: "Data tidak valid." }, 400); }
    const signup = path === "sign-up/email";
    const parsed = (signup ? registration : credentials).safeParse(input);
    if (!parsed.success) return reply({ error: "Periksa email, nama, dan panjang password." }, 400);
    const { email, password } = parsed.data;
    if (!await consumeLimit(signup ? "register-global" : "login-global", signup ? 30 : 200) || !await consumeLimit(`${signup ? "register" : "login"}:${tokenHash(email)}`, signup ? 5 : 8)) {
      const response = reply({ error: "Terlalu banyak percobaan. Coba lagi dalam satu menit." }, 429); response.headers.set("Retry-After", "60"); return response;
    }
    if (signup) {
      const values = registration.parse(input);
      const id = randomUUID(); const issued = newSession(id); const passwordHash = await hashPassword(password);
      const person = { id, name: values.name, email };
      try {
        await db.transaction(async tx => {
          await tx.insert(user).values({ ...person, passwordHash });
          const claim = await tx.insert(owner).values({ id: 1, userId: id }).onConflictDoNothing().returning();
          await tx.insert(adminAccess).values({ userId: id, approved: claim.length > 0 });
          await tx.insert(session).values(issued.row);
        });
      } catch { return reply({ error: "Pendaftaran belum berhasil. Gunakan email lain atau coba masuk." }, 400); }
      return loginResponse(person, issued.token);
    }
    const [person] = await db.select({ id: user.id, name: user.name, email: user.email, passwordHash: user.passwordHash }).from(user).where(eq(user.email, email)).limit(1);
    const valid = await verifyPassword(password, person?.passwordHash || dummyHash);
    if (!person || !valid) return reply({ error: "Email atau password tidak cocok." }, 401);
    const issued = newSession(person.id);
    await db.transaction(async tx => {
      if (person.passwordHash?.includes(":")) await tx.update(user).set({ passwordHash: await hashPassword(password), updatedAt: new Date() }).where(and(eq(user.id, person.id), eq(user.passwordHash, person.passwordHash)));
      // Rotate the browser's previous session on every successful login.
      const oldToken = request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
      if (oldToken && /^[a-f0-9]{64}$/.test(oldToken)) await tx.delete(session).where(eq(session.token, tokenHash(oldToken)));
      await tx.insert(session).values(issued.row);
    });
    return loginResponse({ id: person.id, name: person.name, email: person.email }, issued.token);
  } catch { return reply({ error: "Layanan akun belum tersedia. Coba lagi sebentar." }, 503); }
}
