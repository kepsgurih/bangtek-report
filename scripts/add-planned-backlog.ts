import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { inArray, sql } from "drizzle-orm";
import { tasks } from "../lib/db/schema";
import { taskInput } from "../lib/validation";

const plans = [
  {
    title: "Cek harga SKU dari beberapa sumber secara realtime",
    description:
      "Masukkan SKU untuk membandingkan harga, stok, dan waktu pembaruan dari beberapa sumber dalam satu halaman.",
    category: "Harga & SKU",
    priority: "medium",
    blocker: "",
    steps: [
      "Tentukan sumber harga, izin akses, dan target jeda pembaruan",
      "Samakan identitas SKU dan varian produk di setiap sumber",
      "Hubungkan pengambilan harga dan stok dari sumber yang disepakati",
      "Samakan format harga, mata uang, stok, dan waktu pembaruan",
      "Atur cache, batas request, retry, dan penanganan sumber offline",
      "Tampilkan perbandingan harga dan pembaruan otomatis di halaman",
      "Uji perubahan harga, SKU tidak ditemukan, dan data kedaluwarsa",
    ],
  },
  {
    title: "Masukkan data dari AI Bangtek ke OnglaiRepair",
    description:
      "AI Bangtek membantu menyiapkan data untuk OnglaiRepair, lalu pengguna memeriksa dan mengirimnya. Kendala yang perlu diselesaikan terlebih dahulu adalah storage.",
    category: "Integrasi AI",
    priority: "high",
    blocker:
      "Kendala awal: alur storage untuk pertukaran data dan lampiran antara AI Bangtek dan OnglaiRepair belum terselesaikan.",
    steps: [
      "Audit kendala storage: akses, kapasitas, format file, dan umur lampiran",
      "Sepakati field data dan autentikasi integrasi OnglaiRepair",
      "Siapkan alur penyimpanan serta pemindahan lampiran yang aman",
      "Buat form input teks dan dokumen melalui AI Bangtek",
      "Ekstrak data dengan AI dan validasi sesuai format OnglaiRepair",
      "Tampilkan hasil untuk diperiksa dan dikoreksi sebelum dikirim",
      "Kirim data dengan pencegahan duplikasi dan penanganan kirim ulang",
      "Uji alur lengkap, file gagal tersimpan, dan respons OnglaiRepair",
    ],
  },
  {
    title: "Upscale gambar dengan AI di bangtek.org",
    description:
      "Pengguna dapat memperbesar resolusi gambar dengan AI, membandingkan hasilnya, dan mengunduh gambar yang sudah ditingkatkan.",
    category: "AI gambar",
    priority: "medium",
    blocker: "",
    steps: [
      "Tentukan pilihan skala, batas resolusi, dan format gambar",
      "Pilih layanan atau model AI berdasarkan kualitas, biaya, dan waktu proses",
      "Buat upload gambar dengan validasi ukuran serta format",
      "Hubungkan proses upscale sebagai pekerjaan latar dengan status progres",
      "Atur storage gambar asli, hasil, kuota, dan waktu penyimpanan",
      "Tampilkan perbandingan sebelum-sesudah dan unduhan hasil",
      "Uji kualitas hasil, gambar terlalu besar, timeout, dan percobaan ulang",
    ],
  },
  {
    title: "Buat video dengan AI dari prompt",
    description:
      "Pengguna dapat membuat video dari deskripsi, memantau proses pembuatan, lalu melihat dan mengunduh hasilnya.",
    category: "AI video",
    priority: "medium",
    blocker: "",
    steps: [
      "Sepakati jenis video, durasi, rasio, resolusi, dan batas biaya",
      "Pilih layanan AI dan periksa kemampuan serta batas penggunaannya",
      "Buat form prompt dan pilihan gambar referensi jika didukung",
      "Hubungkan antrean pembuatan video dan pelacakan status proses",
      "Siapkan storage hasil video, batas ukuran, dan masa penyimpanan",
      "Tampilkan progres, preview, dan unduhan video yang selesai",
      "Tangani proses gagal, timeout, percobaan ulang, dan pembatalan",
      "Uji alur lengkap, durasi proses, kualitas hasil, dan penggunaan kuota",
    ],
  },
];
const records = plans.map((plan) =>
  taskInput.parse({
    ...plan,
    sprintId: null,
    status: "todo",
    steps: plan.steps.map((title) => ({ title, done: false })),
  }),
);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 15000,
});
const db = drizzle(pool);
try {
  const inserted = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('bangtek-planned-backlog'))`,
    );
    const existing = await tx
      .select({ title: tasks.title })
      .from(tasks)
      .where(
        inArray(
          tasks.title,
          records.map((task) => task.title),
        ),
      );
    const titles = new Set(existing.map((task) => task.title));
    const missing = records.filter((task) => !titles.has(task.title));
    return missing.length
      ? tx
          .insert(tasks)
          .values(missing)
          .returning({ id: tasks.id, title: tasks.title })
      : [];
  });
  const verified = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      steps: tasks.steps,
      sprintId: tasks.sprintId,
      status: tasks.status,
    })
    .from(tasks)
    .where(
      inArray(
        tasks.title,
        records.map((task) => task.title),
      ),
    );
  console.log(
    JSON.stringify({
      added: inserted.length,
      backlog: verified.map((task) => ({
        id: `TASK-${task.id}`,
        title: task.title,
        steps: task.steps.length,
        status: task.status,
        sprintId: task.sprintId,
      })),
    }),
  );
} catch {
  console.error("Backlog import failed. Check PostgreSQL connectivity.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
