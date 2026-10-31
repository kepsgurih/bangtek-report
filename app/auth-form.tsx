"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authRequest } from "@/lib/auth-client";
export function AuthForm({ register = false }: { register?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const email = String(form.get("email")).trim();
      const password = String(form.get("password"));
      await authRequest(register ? "sign-up/email" : "sign-in/email", { ...(register ? { name: String(form.get("name")).trim() } : {}), email, password });

      router.replace("/admin"); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Tidak dapat terhubung. Coba lagi sebentar."); }
    finally { setPending(false); }
  }
  return <main className="auth-page"><Link href="/" className="auth-brand">bangtek.</Link><section className="auth-card"><span className="admin-eyebrow">PROJECT WORKSPACE</span><h1>{register ? "Buat akun" : "Masuk ke admin"}</h1><p>{register ? "Akun pertama menjadi admin utama. Akun berikutnya perlu persetujuan admin." : "Kelola sprint, pekerjaan, dan laporan dari satu tempat."}</p><form onSubmit={submit}>{register && <label>Nama<input name="name" autoComplete="name" required minLength={2} maxLength={100}/></label>}<label>Email<input name="email" type="email" autoComplete="email" required maxLength={254}/></label><label>Password<input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} required minLength={register ? 10 : 1} maxLength={128}/>{register && <small>Minimal 10 karakter.</small>}</label>{error && <p className="admin-error" role="alert">{error}</p>}<button className="admin-primary" disabled={pending}>{pending ? "Memproses…" : register ? "Daftar" : "Masuk"}</button></form><p className="auth-switch">{register ? "Sudah punya akun?" : "Belum punya akun?"} <Link href={register ? "/login" : "/register"}>{register ? "Masuk" : "Daftar"}</Link></p></section><Link href="/" className="auth-back">← Kembali ke laporan</Link></main>;
}
