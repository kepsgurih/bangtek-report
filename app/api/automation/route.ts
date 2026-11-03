import { revalidatePath, revalidateTag } from "next/cache";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { PUBLIC_REPORT_TAG } from "@/lib/cache-keys";
import { db } from "@/lib/db";
import { sprints, tasks } from "@/lib/db/schema";
import { authenticateApiToken } from "@/lib/api-token-server";
import { apiRequestInput } from "@/lib/api-validation";
import { taskInput } from "@/lib/validation";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function invalidateReport() {
  revalidateTag(PUBLIC_REPORT_TAG, { expire: 0 });
  revalidatePath("/");
}

async function sprintId(reference: number | "active" | "backlog") {
  if (reference === "backlog") return null;
  if (reference === "active") {
    const [row] = await db.select({ id: sprints.id }).from(sprints).where(eq(sprints.status, "active")).limit(1);
    return row?.id ?? null;
  }
  const [row] = await db.select({ id: sprints.id }).from(sprints).where(eq(sprints.number, reference)).limit(1);
  return row?.id ?? null;
}

async function sprintByNumber(number: number) {
  const [row] = await db.select().from(sprints).where(eq(sprints.number, number)).limit(1);
  return row ?? null;
}

function normalizeTask(task: typeof tasks.$inferSelect) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    category: task.category,
    priority: task.priority,
    status: task.status,
    blocker: task.blocker,
    sprintId: task.sprintId,
    steps: task.steps,
    version: task.version,
    updatedAt: task.updatedAt.toISOString(),
  };
}

function normalizeSprint(sprint: typeof sprints.$inferSelect) {
  return {
    id: sprint.id,
    number: sprint.number,
    title: sprint.title,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    status: sprint.status,
    published: sprint.published,
    notes: sprint.notes,
    source: sprint.source,
    version: sprint.version,
    updatedAt: sprint.updatedAt.toISOString(),
  };
}

export async function POST(request: Request) {
  const auth = await authenticateApiToken(request);
  if (!auth) return json({ error: "Token API tidak valid." }, 401);
  const parsed = apiRequestInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Input tidak valid." }, 400);
  const input = parsed.data;

  try {
    if (input.action === "tasks.list") {
      const sprint = input.sprint;
      const sprintIdValue = sprint === undefined ? undefined : await sprintId(sprint);
      const rows = await db
        .select()
        .from(tasks)
        .where(
          sprintIdValue === undefined
            ? undefined
            : sprintIdValue === null
              ? isNull(tasks.sprintId)
              : eq(tasks.sprintId, sprintIdValue),
        )
        .orderBy(tasks.id);
      const filtered = rows.filter(
        (task) =>
          (!input.status || task.status === input.status) &&
          (!input.search || task.title.toLowerCase().includes(input.search.toLowerCase())),
      );
      return json({ tasks: filtered.map(normalizeTask) });
    }

    if (input.action === "tasks.get") {
      const [row] = await db.select().from(tasks).where(eq(tasks.id, input.id)).limit(1);
      if (!row) return json({ error: "Task tidak ditemukan." }, 404);
      return json({ task: normalizeTask(row) });
    }

    if (input.action === "tasks.create") {
      const sprintIdValue = await sprintId(input.sprint);
      if (input.sprint !== "backlog" && sprintIdValue === null)
        return json({ error: "Sprint tujuan tidak ditemukan atau belum aktif." }, 404);
      const parsed = taskInput.safeParse({
        sprintId: sprintIdValue,
        title: input.title,
        description: input.description,
        category: input.category,
        priority: input.priority,
        status: "todo",
        blocker: "",
        steps: input.steps,
      });
      if (!parsed.success)
        return json({ error: parsed.error.issues[0]?.message ?? "Task tidak valid." }, 400);
      const [row] = await db
        .insert(tasks)
        .values({
          sprintId: sprintIdValue,
          title: input.title,
          description: input.description,
          category: input.category,
          priority: input.priority,
          status: "todo",
          steps: input.steps,
        })
        .returning();
      invalidateReport();
      return json({ task: normalizeTask(row) }, 201);
    }

    if (input.action === "tasks.update") {
      const [current] = await db.select().from(tasks).where(eq(tasks.id, input.id)).limit(1);
      if (!current) return json({ error: "Task tidak ditemukan." }, 404);
      if (input.expectedVersion && input.expectedVersion !== current.version)
        return json({ error: "Task telah berubah. Ambil data terbaru lalu ulangi." }, 409);
      const nextSprintId = input.sprint === undefined ? current.sprintId : await sprintId(input.sprint);
      let status = input.status ?? current.status;
      let steps = input.steps ?? current.steps;
      // Mirror the admin UI: finishing a task completes every stage, starting over
      // clears them, and ticking a stage moves the task to "dikerjakan".
      if (status === "done") steps = steps.map((step) => ({ ...step, done: true }));
      else if (status === "todo" && input.steps === undefined)
        steps = steps.map((step) => ({ ...step, done: false }));
      else if (steps.some((step) => step.done) && steps.every((step) => step.done)) status = "done";
      else if (steps.some((step) => step.done) && status === "todo") status = "in_progress";
      const candidate = {
        sprintId: nextSprintId,
        title: input.title ?? current.title,
        description: input.description ?? current.description,
        category: input.category ?? current.category,
        priority: input.priority ?? current.priority,
        status,
        blocker: input.blocker ?? current.blocker,
        steps,
      };
      // Reuse the admin UI rules so automation cannot create records the UI forbids.
      const parsed = taskInput.safeParse(candidate);
      if (!parsed.success)
        return json({ error: parsed.error.issues[0]?.message ?? "Task tidak valid." }, 400);
      const [row] = await db
        .update(tasks)
        .set({
          sprintId: nextSprintId,
          title: candidate.title,
          description: candidate.description,
          category: candidate.category,
          priority: candidate.priority,
          status,
          blocker: candidate.blocker,
          steps,
          version: sql`${tasks.version} + 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(tasks.id, input.id), eq(tasks.version, current.version)))
        .returning();
      if (!row) return json({ error: "Task berubah saat disimpan. Coba lagi." }, 409);
      invalidateReport();
      return json({ task: normalizeTask(row) });
    }

    if (input.action === "tasks.delete") {
      const rows = await db.delete(tasks).where(eq(tasks.id, input.id)).returning({ id: tasks.id });
      if (!rows.length) return json({ error: "Task tidak ditemukan." }, 404);
      invalidateReport();
      return json({ ok: true, id: input.id });
    }

    if (input.action === "sprints.create") {
      const [latest] = await db.select({ number: sprints.number }).from(sprints).orderBy(desc(sprints.number)).limit(1);
      const number = input.number ?? (latest?.number ?? 0) + 1;
      if (input.endDate < input.startDate)
        return json({ error: "Tanggal akhir sprint tidak boleh sebelum tanggal mulai." }, 400);
      const [row] = await db
        .insert(sprints)
        .values({
          number,
          title: input.title,
          startDate: input.startDate,
          endDate: input.endDate,
          status: input.status,
          published: input.published,
          notes: input.notes,
          source: input.source,
        })
        .returning();
      invalidateReport();
      return json({ sprint: normalizeSprint(row) }, 201);
    }

    if (input.action === "sprints.update") {
      const current = await sprintByNumber(input.number);
      if (!current) return json({ error: "Sprint tidak ditemukan." }, 404);
      if (input.expectedVersion && input.expectedVersion !== current.version)
        return json({ error: "Sprint telah berubah. Ambil data terbaru lalu ulangi." }, 409);
      const startDate = input.startDate ?? current.startDate;
      const endDate = input.endDate ?? current.endDate;
      if (endDate < startDate)
        return json({ error: "Tanggal akhir sprint tidak boleh sebelum tanggal mulai." }, 400);
      const [row] = await db
        .update(sprints)
        .set({
          title: input.title ?? current.title,
          startDate,
          endDate,
          status: input.status ?? current.status,
          published: input.published ?? current.published,
          notes: input.notes ?? current.notes,
          source: input.source ?? current.source,
          version: sql`${sprints.version} + 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(sprints.id, current.id), eq(sprints.version, current.version)))
        .returning();
      if (!row) return json({ error: "Sprint berubah saat disimpan. Coba lagi." }, 409);
      invalidateReport();
      return json({ sprint: normalizeSprint(row) });
    }

    const sprint = await sprintByNumber(input.number);
    if (!sprint) return json({ error: "Sprint tidak ditemukan." }, 404);
    const attached = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.sprintId, sprint.id)).limit(1);
    if (attached.length)
      return json({ error: "Pindahkan seluruh task sebelum menghapus sprint." }, 409);
    const rows = await db.delete(sprints).where(eq(sprints.id, sprint.id)).returning({ id: sprints.id });
    if (!rows.length) return json({ error: "Sprint tidak ditemukan." }, 404);
    invalidateReport();
    return json({ ok: true, number: input.number });
  } catch (error) {
    let cause: unknown = error;
    for (let index = 0; index < 4 && cause && typeof cause === "object"; index++) {
      const value = cause as { code?: string; cause?: unknown };
      if (String(value.code) === "23505")
        return json({ error: "Nomor sprint sudah digunakan atau masih ada sprint aktif." }, 409);
      cause = value.cause;
    }
    return json({ error: "Perubahan belum tersimpan. Coba lagi." }, 500);
  }
}
