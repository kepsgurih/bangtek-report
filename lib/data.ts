import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { PUBLIC_REPORT_TAG } from "./cache-keys";
import { desc, eq, isNull, or, inArray } from "drizzle-orm";
import { db } from "./db";
import { sprints, tasks } from "./db/schema";

async function readReportData(admin: boolean) {
  const sprintRows = await db.select().from(sprints).where(admin ? undefined : eq(sprints.published, true)).orderBy(desc(sprints.number));
  const ids = sprintRows.map(sprint => sprint.id);
  const taskRows = await db.select().from(tasks).where(admin ? undefined : or(isNull(tasks.sprintId), ids.length ? inArray(tasks.sprintId, ids) : undefined)).orderBy(tasks.id);
  return { sprints: sprintRows.map(row => ({ ...row, updatedAt: row.updatedAt.toISOString() })), tasks: taskRows.map(row => ({ ...row, updatedAt: row.updatedAt.toISOString() })) };
}

async function getPublicReportData() {
  "use cache";
  cacheTag(PUBLIC_REPORT_TAG);
  cacheLife({ stale: Infinity, revalidate: Infinity, expire: Infinity });
  return readReportData(false);
}

export async function getReportData(admin = false) {
  // Authentication, permissions and admin data never enter the public cache.
  return admin ? readReportData(true) : getPublicReportData();
}
