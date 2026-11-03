import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { apiToken } from "./db/schema";
import { hashApiToken, safeTokenMatch } from "./api-token";

export async function authenticateApiToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const tokenHash = hashApiToken(token);
  const [row] = await db
    .select({ id: apiToken.id, name: apiToken.name, tokenHash: apiToken.tokenHash })
    .from(apiToken)
    .where(eq(apiToken.tokenHash, tokenHash))
    .limit(1);
  if (!row || !safeTokenMatch(row.tokenHash, tokenHash)) return null;
  await db
    .update(apiToken)
    .set({ lastUsedAt: new Date() })
    .where(and(eq(apiToken.id, row.id), eq(apiToken.tokenHash, tokenHash)));
  return row;
}
