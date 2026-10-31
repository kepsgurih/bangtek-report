"use client";
export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <main className="auth-page">
      <h1>Workspace belum bisa dimuat</h1>
      <p>Periksa koneksi database lalu coba lagi.</p>
      <button className="admin-primary" onClick={reset}>
        Coba lagi
      </button>
    </main>
  );
}
