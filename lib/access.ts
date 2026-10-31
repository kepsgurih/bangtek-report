import "server-only";
import { eq } from "drizzle-orm";
import { getSession } from "./auth";
import { db } from "./db";
import { adminAccess, owner } from "./db/schema";

export async function getAccess() {
  const session = await getSession();
  if (!session) return null;
  const [access, owners] = await Promise.all([
    db.select().from(adminAccess).where(eq(adminAccess.userId, session.user.id)).limit(1),
    db.select().from(owner).limit(1),
  ]);
  return { user: { id: session.user.id, name: session.user.name, email: session.user.email }, approved: access[0]?.approved ?? false, isOwner: owners[0]?.userId === session.user.id };
}
