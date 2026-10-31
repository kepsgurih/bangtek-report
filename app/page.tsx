import { Suspense } from "react";
import { connection } from "next/server";
import { getReportData } from "@/lib/data";
import Report from "./report";
async function PublicReport() {
  await connection();
  const data = await getReportData();
  return <Report data={data} />;
}
export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="report-main" role="status">
          Memuat laporan…
        </main>
      }
    >
      <PublicReport />
    </Suspense>
  );
}
