import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
function derive(password: string, salt: string, legacy = false): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password.normalize("NFKC"), salt, 64, { N: legacy ? 16384 : 32768, r: legacy ? 16 : 8, p: legacy ? 1 : 3, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
}
export async function hashPassword(password: string) {
  const salt = randomBytes(24).toString("hex");
  return `scrypt$32768$8$3$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  let salt: string, hex: string, legacy = false;
  if (/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored)) { [salt, hex] = stored.split(":"); legacy = true; }
  else {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts.slice(0,4).join("$") !== "scrypt$32768$8$3" || !/^[a-f0-9]{48}$/.test(parts[4]) || !/^[a-f0-9]{128}$/.test(parts[5])) return false;
    [, , , , salt, hex] = parts;
  }
  const actual = await derive(password, salt, legacy);
  return timingSafeEqual(actual, Buffer.from(hex, "hex"));
}
