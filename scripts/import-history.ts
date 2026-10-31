import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { historyData } from "./history-data";
import { sprints, tasks } from "../lib/db/schema";

// Reviewed local Git metadata. Version-to-sprint mapping is an estimate, not a recorded sprint boundary.
const laterReleases = [
  {
    number: 16,
    title: "Penyegaran tampilan dan performa",
    date: "2026-10-26",
    source: "client v1.16.0 · 1ce1b25; core · f2f28c4 (26 Oktober 2026)",
    items: [
      [
        "Tampilan Bangtek diperbarui",
        "Penyegaran branding dan tampilan aplikasi agar navigasi lebih konsisten.",
        "Tampilan",
      ],
      [
        "Performa aplikasi ditingkatkan",
        "Perubahan performa aplikasi dicatat bersama rilis client v1.16.0.",
        "Performa",
      ],
    ],
  },
  {
    number: 17,
    title: "Percakapan Image Prompt",
    date: "2026-10-27",
    source: "client v1.17.0 · 77bd3d9; core · 66b2e8c (27 Oktober 2026)",
    items: [
      [
        "Percakapan untuk membuat prompt gambar",
        "Pengguna dapat melakukan percakapan Image Prompt melalui aplikasi.",
        "AI tools",
      ],
      [
        "Percakapan gambar terhubung ke alur kerja",
        "Backend mencatat percakapan Image Prompt privat dan integrasinya dengan workflow.",
        "Alur kerja",
      ],
    ],
  },
  {
    number: 18,
    title: "Pengelolaan profil pengguna",
    date: "2026-10-27",
    source: "client v1.18.0 · a92b5d4 (27 Oktober 2026)",
    items: [
      [
        "Informasi profil lebih mudah diperbarui",
        "Tampilan pengelolaan profil diperbarui dengan validasi input yang lebih jelas.",
        "Profil",
      ],
      [
        "Unggah foto profil lebih nyaman",
        "Pengalaman mengunggah avatar diperbaiki pada halaman profil pengguna.",
        "Profil",
      ],
    ],
  },
];
const releases = [
  ...historyData,
  ...laterReleases.filter((release) => release.number > 16),
];
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 15000,
});
const db = drizzle(pool);
try {
  let imported = 0,
    addedTasks = 0;
  for (const release of releases) {
    await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: sprints.id })
        .from(sprints)
        .where(eq(sprints.number, release.number))
        .limit(1);
      let sprintId = existing[0]?.id;
      if (!sprintId) {
        const reconstructed =
          release.number < 10
            ? "Versi 1.1–1.9 tidak tercatat di package.json. Sprint ini merupakan pengelompokan milestone berdasarkan tanggal commit."
            : "Nomor sprint diperkirakan dari versi minor package.json; periode dikelompokkan berdasarkan tanggal commit.";
        const taskSources = release.items
          .map((item) => `${item[0]}: ${item[3] || release.source}`)
          .join("\n");
        const [sprint] = await tx
          .insert(sprints)
          .values({
            number: release.number,
            title: release.title,
            startDate:
              "startDate" in release
                ? (release.startDate as string)
                : release.date,
            endDate: release.date,
            status: "completed",
            published: true,
            source: release.source,
            notes: `${reconstructed}\nSelesai berarti implementasi tercatat di Git, bukan konfirmasi pengujian atau rilis produksi. Task dirangkum dari pesan commit dan daftar file yang berubah.\n\nSumber tiap task:\n${taskSources}`,
          })
          .returning();
        sprintId = sprint.id;
        imported++;
      }
      const existingTasks = await tx
        .select({ title: tasks.title })
        .from(tasks)
        .where(eq(tasks.sprintId, sprintId));
      const titles = new Set(existingTasks.map((task) => task.title));
      const missing = release.items.filter((item) => !titles.has(item[0]));
      if (missing.length) {
        await tx.insert(tasks).values(
          missing.map(([title, description, category]) => ({
            sprintId,
            title,
            description,
            category,
            priority: "medium" as const,
            status: "done" as const,
            steps: [
              { title: "Perubahan diimplementasikan dalam kode", done: true },
              { title: "Perubahan tersimpan di riwayat repo", done: true },
            ],
          })),
        );
        addedTasks += missing.length;
      }
    });
  }
  const allSprints = await db.select().from(sprints);
  const allTasks = await db.select({ sprintId: tasks.sprintId }).from(tasks);
  for (let number = 1; number <= 16; number++) {
    const sprint = allSprints.find((value) => value.number === number);
    const count = allTasks.filter(
      (task) => task.sprintId === sprint?.id,
    ).length;
    if (!sprint || count < 5) throw new Error("INCOMPLETE_HISTORY");
  }
  console.log(
    `Imported ${imported} reports and ${addedTasks} tasks. Sprint 1–16 each have at least 5 tasks. Existing report metadata and tasks were preserved.`,
  );
} catch {
  console.error("History import failed. Check PostgreSQL connectivity.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
