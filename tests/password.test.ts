import { expect, test } from "bun:test";
import { scrypt } from "node:crypto";
import { hashPassword, verifyPassword } from "../lib/password";
import { allowedOrigin } from "../lib/origin";
test("salted passwords verify without storing plaintext", async () => {
  const password = "correct horse battery staple";
  const a = await hashPassword(password); const b = await hashPassword(password);
  expect(a).not.toBe(b); expect(a).not.toContain(password);
  expect(await verifyPassword(password, a)).toBe(true);
  expect(await verifyPassword("wrong password", a)).toBe(false);
});
test("malformed hashes are rejected", async () => {
  expect(await verifyPassword("password", "invalid")).toBe(false);
  expect(await verifyPassword("password", "scrypt$999999999$8$3$bad$bad")).toBe(false);
});
test("existing legacy account hashes remain usable", async () => {
  const salt = "0123456789abcdef0123456789abcdef";
  const key = await new Promise<Buffer>((resolve, reject) => scrypt("legacy password", salt, 64, { N: 16384, r: 16, p: 1, maxmem: 64 * 1024 * 1024 }, (error, result) => error ? reject(error) : resolve(result)));
  expect(await verifyPassword("legacy password", `${salt}:${key.toString("hex")}`)).toBe(true);
});
test("mutations require an explicit matching origin", () => {
  const origin = process.env.APP_URL || "http://localhost:3000";
  expect(allowedOrigin(new Request(origin, { headers: { origin } }))).toBe(true);
  expect(allowedOrigin(new Request(origin))).toBe(false);
  expect(allowedOrigin(new Request(origin, { headers: { origin: "https://untrusted.example" } }))).toBe(false);
});
