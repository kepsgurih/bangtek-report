import { Suspense } from "react";
import { getReportData } from "@/lib/data";
import Report from "./report";
async function PublicReport() {
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
