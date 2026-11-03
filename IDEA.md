# Bangtek — ide dan rencana pengembangan

Tanggal: 3 November 2026. Dokumen awal untuk konteks project dan perencanaan kerja di Hermes/Codex.

## Arah produk

Bangtek dikembangkan sebagai platform kerja untuk mengelola konten, alat AI, dan campaign dalam satu workspace. Pengguna dapat menyiapkan materi, memprosesnya, melihat hasil serta riwayat, lalu melanjutkan pekerjaan tanpa berpindah-pindah alat. Situs publik menyajikan konten dan kegiatan; aplikasi progress membantu stakeholder mengikuti perkembangan implementasi.

Arah ini dirumuskan dari struktur kode dan dokumentasi lokal. Prioritas di bawah adalah usulan, bukan komitmen tanggal rilis atau hasil wawancara pengguna.

## Peta project

Root lokal: `/Users/kepsgurih/Code/Bangtek`.

| Repo | Peran | Referensi awal |
| --- | --- | --- |
| `client` | Website publik dan workspace pengguna; React, TypeScript, Vite | `docs/frontend-architecture.md`, `src/features/`, `src/services/` |
| `core` | API Go/Gin, autentikasi, permission, data, storage, dan integrasi pemrosesan | `internal/features/`, `internal/database/migrations/`, `docs/feature-workflow-playbook.md` |
| `project-bangtek` | Laporan sprint, backlog, dan pengelolaan progress; Next.js, PostgreSQL, Drizzle | `README.md`, `lib/db/schema.ts`, `app/admin/workspace.tsx` |
| `cicd-blueprints` | Template GitLab CI/CD untuk build, staging, dan production | `README.md`, `templates/`, `jobs/`, `tests/` |

Keempatnya repo terpisah. Periksa status Git dan `AGENTS.md` masing-masing sebelum bekerja; jangan menganggap perubahan di satu repo otomatis memperbarui repo lain.

## Fondasi yang sudah ada di checkout

- Workspace dengan menu dari API, pencarian modul, permission, dan tema terang/gelap.
- Modul konten publik, termasuk artikel, event, dan galeri.
- Alat AI untuk gambar, termasuk Image Prompt dengan edit lanjutan dan Image Upscale.
- Item dan Social Flow, dengan scheduler serta checkpoint untuk mempertahankan progres penjadwalan setelah restart.
- Implementasi chat OpenClaw di frontend dan backend; kelengkapan alur langsung masih perlu diperiksa.
- Laporan sprint publik serta admin untuk sprint, task, backlog, tahapan, dan akses akun.
- Blueprint build/deploy bersama, konfigurasi runtime frontend, dan panduan rollout staging sebelum production.

Keberadaan implementasi tidak membuktikan semua fitur sudah dirilis atau berjalan di production. Status tersebut harus ditentukan dari pengujian dan deployment yang benar-benar diperiksa.

## Pengguna dan alur utama

1. **Pengguna workspace:** masuk → pilih modul → beri input → jalankan proses → lihat status → buka atau unduh hasil → lanjutkan pekerjaan.
2. **Operator campaign:** siapkan item → pilih Social Flow → jalankan penjadwalan → periksa status dan kegagalan pengiriman.
3. **Admin:** kelola konten serta akses pengguna melalui mekanisme permission yang tersedia.
4. **Stakeholder:** buka laporan sprint yang diterbitkan → lihat task, tahapan, dan backlog tanpa melihat data internal yang belum dipublikasikan.

## Rencana bertahap

### Tahap 1 — pastikan alur yang ada dapat dipercaya

Tujuan: pekerjaan pengguna selesai dengan hasil yang jelas, termasuk saat input salah, pemrosesan gagal, atau layanan restart.

- Verifikasi alur Image Prompt: upload → hasil pertama → edit lanjutan → reload → unduh.
- Verifikasi Image Upscale dari upload sampai hasil tersimpan dan dapat diunduh.
- Periksa ownership dan permission pada daftar, detail, proses lanjutan, serta unduhan. Pengguna lain tidak boleh mengakses hasil pribadi.
- Periksa status pekerjaan, callback duplikat, timeout, dan pekerjaan yang tertinggal setelah restart. Tambahkan rekonsiliasi hanya pada alur yang terbukti memerlukannya.
- Tinjau celah duplikasi SKU pada request bersamaan. Jika satu SKU per Social Flow menjadi aturan produk, terapkan jaminan database setelah meninjau data lama dan perilaku penghapusan.

**Selesai bila:** alur sukses dan gagal teruji; hasil tidak tertukar antaruser; UI memberi tindakan berikutnya yang sesuai; tidak ada status sukses hanya karena dispatch diterima.

### Tahap 2 — rapikan pengalaman kerja harian

Tujuan: pengguna tahu harus mulai dari mana dan dapat menemukan pekerjaan sebelumnya.

- Audit konsistensi input, loading, error, hasil, dan unduhan di modul AI yang ada; pakai komponen serta pola repo yang sesuai.
- Pertahankan percakapan atau pekerjaan melalui ID di URL jika fitur memang memiliki riwayat tersebut.
- Perbaiki empty state dan pencarian modul berdasarkan menu API, tanpa menambah daftar menu atau aturan akses kedua di frontend.
- Uji navigasi dan formulir di layar kecil, keyboard, tema terang/gelap, dan pengaturan reduced motion.
- Tampilkan penghitung hanya jika sumber datanya tersedia. Label pengiriman item tetap **Campaign Terkirim**; jangan menyamakannya dengan hasil publikasi downstream tanpa bukti.

**Selesai bila:** pengguna dapat memulai, menemukan kembali, dan menyelesaikan pekerjaan pada modul prioritas tanpa kehilangan konteks setelah reload.

### Tahap 3 — kuatkan alur campaign dan bantuan chat

Tujuan: operator dapat membedakan penjadwalan, penerimaan request, dan hasil pemrosesan.

- Dokumentasikan status campaign sesuai bukti yang tersedia dari API dan workflow. Checkpoint scheduler bukan jaminan pengiriman tepat satu kali.
- Verifikasi rotasi item, cooldown, dan pemulihan deadline setelah restart dengan satu instance scheduler yang didukung saat ini.
- Jika pengiriman ulang diperlukan, rancang idempotensi bersama penerima sebelum menambah retry otomatis.
- Verifikasi alur chat OpenClaw yang sudah ada: autentikasi, streaming, kegagalan koneksi, pembatalan, dan pembatasan data pengguna.
- Integrasi WhatsApp ke produk menjadi pekerjaan terpisah jika diminta. Script kontak/grup Hermes yang dibuat pada sesi ini adalah alat lokal operator, bukan fitur Bangtek yang sudah diimplementasikan.

**Selesai bila:** status operasional tidak menyesatkan dan tindakan ulang tidak menambah risiko pengiriman ganda yang tidak terkendali.

### Tahap 4 — hubungkan progress dengan bukti rilis

Tujuan: stakeholder memahami apa yang dikerjakan, apa yang teruji, dan apa yang sudah dirilis.

- Buat task dari kebutuhan nyata dengan tujuan, batas cakupan, dan kriteria selesai; gunakan sprint draft sebelum diterbitkan.
- Bedakan bukti commit, pengujian lokal, staging, dan production dalam deskripsi/tahapan yang sudah tersedia, sebelum menambah skema baru.
- Pertahankan penanda bahwa sprint historis adalah rekonstruksi; commit tidak otomatis berarti rilis production.
- Pin blueprint CI/CD ke revisi yang ditinjau, jalankan CI Lint pada konfigurasi gabungan, lalu validasi staging sebelum persetujuan production.
- Periksa konfigurasi runtime frontend dan alur aplikasi setelah deployment; pipeline hijau saja belum cukup.

**Selesai bila:** setiap pekerjaan yang dilaporkan selesai memiliki bukti sesuai klaimnya dan draft tidak bocor ke laporan publik.

## Cara mengerjakan setiap fitur

Ikuti `core/docs/feature-workflow-playbook.md`: tulis tujuan, input beserta batasnya, interaksi, output/riwayat, akses, dan kriteria selesai sebelum implementasi.

Tetapkan kontrak frontend → API → workflow → callback → storage/status. Backend menjadi sumber kebenaran untuk validasi, ownership, dan status. Secret serta nama layanan integrasi internal tidak muncul di UI atau bundle browser.

Pilih perubahan terkecil yang menyelesaikan kebutuhan; gunakan pola dan dependency yang sudah ada. Jika kontrak berubah, perbarui caller, migrasi, permission/menu, workflow, dan dokumentasi yang terdampak. Migrasi yang sudah diterapkan tidak diedit ulang.

Untuk frontend `client`, pemeriksaan yang terdokumentasi adalah lint, typecheck, tes navigasi/tema, dan build. Untuk laporan progress, gunakan tes aturan serta tes integrasi pada database pengembangan/test. Untuk CI/CD, gunakan `ruby tests/blueprints_test.rb` lalu validasi GitLab dan staging sesuai cakupan. Tambahkan pengujian backend dan browser yang relevan dengan perubahan; jangan mengklaim alur langsung dari mock saja.

## Pekerjaan pertama yang disarankan

Mulai dengan satu task: **verifikasi alur Image Prompt dari upload sampai edit lanjutan dan unduhan**. Catat kondisi awal, jalankan skenario sukses dan gagal, perbaiki gap yang ditemukan, lalu laporkan bukti. Setelah itu gunakan pola yang sudah terbukti untuk Image Upscale dan alur campaign.

Tidak ada estimasi kalender sebelum kondisi lingkungan, akses layanan, dan hasil verifikasi awal diketahui.

## Di luar cakupan awal

- Menulis ulang frontend/backend atau mengganti stack.
- Menambah microservices, scheduler terdistribusi, billing, atau orkestrasi multi-agent tanpa kebutuhan yang disepakati.
- Mengimpor kontak WhatsApp pribadi menjadi database produk.
- Mengirim pesan, mengubah data production, melakukan push, atau merilis perubahan hanya karena tercantum di roadmap ini.

## Dasar penyusunan dan batas verifikasi

Dokumen dirangkum dari README empat repo, `client/docs/frontend-architecture.md`, `core/docs/feature-workflow-playbook.md`, `core/docs/item-sku-validation.md`, daftar modul, dan riwayat commit terbaru yang diperiksa pada tanggal di atas. Tidak membaca secret, tidak menjalankan aplikasi, dan tidak memverifikasi deployment atau workflow langsung saat menyusun dokumen ini. Urutan prioritas perlu disesuaikan jika tujuan bisnis atau masalah pengguna berbeda.
