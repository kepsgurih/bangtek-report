import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";
import { Admin } from "./workspace";
async function ProtectedAdmin() {
  const access = await getAccess();
  if (!access) redirect("/login");
  return <Admin access={access}/>;
}
export default function AdminPage() { return <Suspense fallback={<main className="auth-page">Memuat workspace…</main>}><ProtectedAdmin/></Suspense>; }
