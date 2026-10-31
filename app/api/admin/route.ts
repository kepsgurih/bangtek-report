import { revalidateTag, revalidatePath } from "next/cache";
import { PUBLIC_REPORT_TAG } from "@/lib/cache-keys";
import { and, eq, desc, sql } from "drizzle-orm";
import { allowedOrigin } from "@/lib/origin";
import { db } from "@/lib/db";
import { adminAccess, sprints, tasks, user } from "@/lib/db/schema";
import { getAccess } from "@/lib/access";
import { getReportData } from "@/lib/data";
import { mutationInput, deletionInput } from "@/lib/validation";

function failure(error: unknown) {
  let cause: unknown = error;
  for (let i = 0; i < 4 && cause && typeof cause === "object"; i++) {
    const value = cause as { code?: string; cause?: unknown };
    if (String(value.code) === "23505")
      return Response.json(
        {
          error:
            "Nomor sprint sudah digunakan atau masih ada sprint aktif. Selesaikan sprint aktif lebih dahulu.",
        },
        { status: 409 },
      );
    if (String(value.code) === "23503")
      return Response.json(
        {
          error:
            "Data masih digunakan. Pindahkan task sebelum menghapus sprint.",
        },
        { status: 409 },
      );
    cause = value.cause;
  }
  return Response.json(
    { error: "Perubahan belum tersimpan. Coba lagi." },
    { status: 500 },
  );
}
export async function GET() {
  try {
    const access = await getAccess();
    if (!access)
      return Response.json({ error: "Silakan login." }, { status: 401 });
    if (!access.approved)
      return Response.json(
        { error: "Akun menunggu persetujuan admin." },
        { status: 403 },
      );
    const data = await getReportData(true);
    const users = access.isOwner
      ? await db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            approved: adminAccess.approved,
          })
          .from(user)
          .leftJoin(adminAccess, eq(adminAccess.userId, user.id))
          .orderBy(desc(user.createdAt))
      : [];
    return Response.json(
      { ...data, users, access },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  if (!allowedOrigin(request))
    return Response.json({ error: "Origin tidak diizinkan." }, { status: 403 });
  try {
    const access = await getAccess();
    if (!access?.approved)
      return Response.json(
        { error: "Akses admin diperlukan." },
        { status: access ? 403 : 401 },
      );
    const result = mutationInput.safeParse(
      await request.json().catch(() => null),
    );
    if (!result.success)
      return Response.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    const input = result.data;
    if (input.resource === "access") {
      if (!access.isOwner || input.data.userId === access.user.id)
        return Response.json(
          { error: "Hanya admin utama dapat mengelola akses akun lain." },
          { status: 403 },
        );
      const exists = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, input.data.userId))
        .limit(1);
      if (!exists.length)
        return Response.json(
          { error: "Akun tidak ditemukan." },
          { status: 404 },
        );
      await db
        .insert(adminAccess)
        .values(input.data)
        .onConflictDoUpdate({
          target: adminAccess.userId,
          set: { approved: input.data.approved },
        });
    } else if (input.resource === "sprint") {
      const { id, version, ...values } = input.data;
      if (id) {
        const rows = await db
          .update(sprints)
          .set({
            ...values,
            version: sql`${sprints.version} + 1`,
            updatedAt: new Date(),
          })
          .where(and(eq(sprints.id, id), eq(sprints.version, version ?? 0)))
          .returning({ id: sprints.id });
        if (!rows.length)
          return Response.json(
            { error: "Sprint telah berubah. Muat ulang sebelum menyimpan." },
            { status: 409 },
          );
      } else await db.insert(sprints).values(values);
    } else {
      const { id, version, ...values } = input.data;
      if (id) {
        const rows = await db
          .update(tasks)
          .set({
            ...values,
            version: sql`${tasks.version} + 1`,
            updatedAt: new Date(),
          })
          .where(and(eq(tasks.id, id), eq(tasks.version, version ?? 0)))
          .returning({ id: tasks.id });
        if (!rows.length)
          return Response.json(
            { error: "Task telah berubah. Muat ulang sebelum menyimpan." },
            { status: 409 },
          );
      } else await db.insert(tasks).values(values);
    }
    if (input.resource !== "access") {
      revalidateTag(PUBLIC_REPORT_TAG, { expire: 0 });
      revalidatePath("/");
    }
    return Response.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  if (!allowedOrigin(request))
    return Response.json({ error: "Origin tidak diizinkan." }, { status: 403 });
  try {
    const access = await getAccess();
    if (!access?.approved)
      return Response.json(
        { error: "Akses admin diperlukan." },
        { status: access ? 403 : 401 },
      );
    const input = deletionInput.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success)
      return Response.json({ error: "Data tidak valid." }, { status: 400 });
    const { resource, id, version } = input.data;
    if (resource === "sprint") {
      const attached = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(eq(tasks.sprintId, id))
        .limit(1);
      if (attached.length)
        return Response.json(
          { error: "Pindahkan seluruh task sebelum menghapus sprint." },
          { status: 409 },
        );
    }
    const rows =
      resource === "sprint"
        ? await db
            .delete(sprints)
            .where(and(eq(sprints.id, id), eq(sprints.version, version)))
            .returning({ id: sprints.id })
        : await db
            .delete(tasks)
            .where(and(eq(tasks.id, id), eq(tasks.version, version)))
            .returning({ id: tasks.id });
    if (!rows.length)
      return Response.json(
        { error: "Data telah berubah atau dihapus. Muat ulang daftar." },
        { status: 409 },
      );
    revalidateTag(PUBLIC_REPORT_TAG, { expire: 0 });
    revalidatePath("/");
    return Response.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
