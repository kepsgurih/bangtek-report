import "server-only";
import { desc, eq, isNull, or, inArray } from "drizzle-orm";
import { db } from "./db";
import { sprints, tasks } from "./db/schema";

export async function getReportData(admin = false) {
  const sprintRows = await db.select().from(sprints).where(admin ? undefined : eq(sprints.published, true)).orderBy(desc(sprints.number));
  const ids = sprintRows.map(sprint => sprint.id);
  const taskRows = await db.select().from(tasks).where(admin ? undefined : or(isNull(tasks.sprintId), ids.length ? inArray(tasks.sprintId, ids) : undefined)).orderBy(tasks.id);
  return { sprints: sprintRows.map(row => ({ ...row, updatedAt: row.updatedAt.toISOString() })), tasks: taskRows.map(row => ({ ...row, updatedAt: row.updatedAt.toISOString() })) };
}
