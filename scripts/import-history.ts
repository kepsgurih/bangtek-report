import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { sprints, tasks } from "../lib/db/schema";

// Reviewed local Git metadata. Version-to-sprint mapping is an estimate, not a recorded sprint boundary.
const releases = [
  { number: 16, title: "Penyegaran tampilan dan performa", date: "2026-10-26", source: "client v1.16.0 · 1ce1b25; core · f2f28c4 (26 Oktober 2026)", items: [
    ["Tampilan Bangtek diperbarui", "Penyegaran branding dan tampilan aplikasi agar navigasi lebih konsisten.", "Tampilan"],
    ["Performa aplikasi ditingkatkan", "Perubahan performa aplikasi dicatat bersama rilis client v1.16.0.", "Performa"],
  ] },
  { number: 17, title: "Percakapan Image Prompt", date: "2026-10-27", source: "client v1.17.0 · 77bd3d9; core · 66b2e8c (27 Oktober 2026)", items: [
    ["Percakapan untuk membuat prompt gambar", "Pengguna dapat melakukan percakapan Image Prompt melalui aplikasi.", "AI tools"],
    ["Percakapan gambar terhubung ke alur kerja", "Backend mencatat percakapan Image Prompt privat dan integrasinya dengan workflow.", "Alur kerja"],
  ] },
  { number: 18, title: "Pengelolaan profil pengguna", date: "2026-10-27", source: "client v1.18.0 · a92b5d4 (27 Oktober 2026)", items: [
    ["Informasi profil lebih mudah diperbarui", "Tampilan pengelolaan profil diperbarui dengan validasi input yang lebih jelas.", "Profil"],
    ["Unggah foto profil lebih nyaman", "Pengalaman mengunggah avatar diperbaiki pada halaman profil pengguna.", "Profil"],
  ] },
];
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 15000 });
const db = drizzle(pool);
try {
  let imported = 0;
  for (const release of releases) {
    await db.transaction(async tx => {
      const existing = await tx.select({ id: sprints.id }).from(sprints).where(eq(sprints.number, release.number)).limit(1);
      if (existing.length) return;
      const [sprint] = await tx.insert(sprints).values({ number: release.number, title: release.title, startDate: release.date, endDate: release.date, status: "completed", published: true, source: release.source, notes: "Dirangkum dari versi package.json dan pesan commit lokal. Nomor sprint diperkirakan dari versi minor, dan periode menggunakan tanggal commit versi. Selesai berarti perubahan tercatat di Git, bukan konfirmasi pengujian atau rilis produksi. Silakan koreksi lewat admin." }).returning();
      for (const [title, description, category] of release.items) await tx.insert(tasks).values({ sprintId: sprint.id, title, description, category, priority: "medium", status: "done", steps: [{ title: "Perubahan diimplementasikan dalam kode", done: true }, { title: "Perubahan tersimpan di riwayat repo", done: true }] });
      imported++;
    });
  }
  console.log(`Imported ${imported} historical reports. Existing sprint data was preserved.`);
} catch { console.error("History import failed. Check PostgreSQL connectivity."); process.exitCode = 1; }
finally { await pool.end(); }
