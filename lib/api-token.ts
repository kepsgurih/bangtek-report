import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function hashApiToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function safeTokenMatch(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export function createApiToken() {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashApiToken(token) };
}
