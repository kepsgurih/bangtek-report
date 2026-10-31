# Bangtek Progress

Laporan sprint sederhana untuk stakeholder dan dashboard admin untuk mengelola isinya.

## Stack

Next.js App Router, TypeScript, **PostgreSQL**, **Drizzle ORM**, dan autentikasi manual (Node.js `scrypt` + sesi PostgreSQL). Driver database menggunakan `pg`; aplikasi tidak bergantung pada SDK penyedia PostgreSQL tertentu.

## Menjalankan

1. `bun install`
2. Salin `.env.example` ke `.env.local`, lalu isi `DATABASE_URL` dan `APP_URL`.
3. Jangan commit `.env.local`. Session token dibangkitkan secara acak dan hanya hash token disimpan di database.
4. `bun run db:migrate`
5. `bun dev`

`APP_URL` harus sama dengan origin aplikasi, termasuk port. Gunakan URL HTTPS sebenarnya saat production. Semua environment database dan auth hanya dipakai di server.

## Akun dan admin

- `/register`: buat akun. **Akun pertama menjadi admin utama**; daftarkan akun pemilik sebelum membuka aplikasi kepada orang lain.
- `/login`: masuk dengan email/password, minimal password baru 10 karakter.
- `/admin`: dashboard untuk sprint, task, backlog, dan tahapan.
- Akun selanjutnya menunggu persetujuan melalui menu **Akses akun**, yang hanya tersedia untuk admin utama.
- Admin utama dapat menyetujui atau mencabut akses. Pencabutan berlaku pada request berikutnya, termasuk sesi yang sudah login.
- Password di-hash dengan `scrypt` (salt acak, perbandingan constant-time). Token sesi 256-bit disimpan sebagai SHA-256 dalam PostgreSQL, berlaku 7 hari, dengan cookie HTTP-only/SameSite=Lax dan Secure saat production. Rate limit login/register juga disimpan dalam database.
- Penghapusan sprint ditolak selama masih ada task di dalamnya. Hapus/mutasi memerlukan sesi admin valid, origin yang sesuai, input tervalidasi, dan versi data terbaru.

## Laporan publik

`/` menampilkan sprint aktif yang sudah diterbitkan, atau arsip terbaru jika belum ada sprint aktif. Sprint **draft** beserta task di dalamnya tidak tampil di publik. Menu backlog menampilkan task yang belum dimasukkan ke sprint; task backlog wajib berstatus belum dimulai.

Pilih sprint melalui menu atau buka `/?sprint=18`. Backlog tersedia di `/?view=backlog`. Setiap task memiliki nomor, prioritas, deskripsi Show more/Show less, serta tahapan. Tahap selesai dicoret dan rincian task pertama terbuka otomatis. Data publik menggunakan cache bawaan Next.js (`use cache`, `cacheLife`, `cacheTag`): `stale`, `revalidate`, dan `expire` bernilai `Infinity`, sehingga tidak ada revalidasi berkala berdasarkan waktu. Cache hanya diinvalidasi saat ada perubahan data melalui admin; cache yang kosong akibat restart/deploy tetap dibangun dari PostgreSQL. Penyimpanan/penghapusan sprint atau task menginvalidasi tag publik dan route `/` secara langsung. Data admin, sesi, dan izin tidak di-cache. Pemilihan sprint dan perpindahan menu laporan/backlog memakai Native History API yang terintegrasi dengan Next.js, sehingga tidak membutuhkan request server baru setelah data awal dimuat. Laporan yang sudah terbuka perlu dimuat ulang untuk mengambil perubahan admin terbaru.

## Riwayat repo

`bun run db:import-history` mengimpor arsip 1–18 dari riwayat lokal `client` dan `core` yang sudah ditinjau. Script mempertahankan metadata sprint yang sudah ada dan hanya menambahkan judul task yang belum tersedia pada sprint tersebut. Sprint 1–16 memiliki sedikitnya lima task. Sumber commit dicatat di laporan.

**Nomor sprint adalah rekonstruksi, bukan batas sprint yang terverifikasi.** Versi 1.1–1.9 tidak tercatat di package history; Sprint 1–9 dikelompokkan dari milestone commit secara kronologis. Sprint 10–18 mengikuti versi minor dan perubahan di periode terkait. Tanggal menggunakan commit yang diperiksa. Status selesai berarti perubahan masuk riwayat Git, bukan bukti pengujian atau rilis produksi. Judul, tanggal, task, dan sumber dapat dikoreksi melalui admin.

## Database dan pemeriksaan

- `bun run db:generate`: menghasilkan migrasi SQL dari schema Drizzle.
- `bun run db:migrate`: menerapkan migrasi. Tabel aplikasi memakai awalan `bangtek_`.
- `bun test tests`: validasi aturan sprint/task.
- `bun run test:integration`: jalankan dengan server lokal aktif; menguji registrasi, sesi, izin, CRUD, konflik edit, serta publikasi melalui HTTP dan PostgreSQL. Membuat akun/data sementara lalu membersihkan ID milik tes tersebut. Jalankan di database pengembangan/test.
- `bun run build`: build produksi.

Schema: `lib/db/schema.ts`. API pengelolaan: `app/api/admin/route.ts`. UI admin: `app/admin/workspace.tsx`. UI laporan: `app/report.tsx`.

## Tema dan animasi

Tema dark memakai CSS dengan aksen cyan. Animasi masuk hanya memakai transform/opacity dan berjalan sekali. Background publik memiliki maksimal dua glow CSS kecil (320px/220px), satu glow 240px pada mobile, bergerak hanya lewat transform. Tidak ada library animasi, canvas, interval, atau particle engine. `prefers-reduced-motion` menonaktifkan animasi dan transisi.

Migrasi auth manual mempertahankan akun lama dan menyalin hash password untuk kompatibilitas; sesi lama perlu login ulang. Tabel account/verification lama dipertahankan sebagai data legacy, tidak dipakai oleh runtime auth manual.
