"use client";
export async function authRequest(path: "sign-up/email" | "sign-in/email" | "sign-out", body: unknown = {}) {
  const response = await fetch(`/api/auth/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Permintaan akun gagal.");
  return result;
}
