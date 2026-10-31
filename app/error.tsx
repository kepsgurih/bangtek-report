"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="report-main public-empty"><h1>Laporan belum bisa dimuat</h1><p>Koneksi sedang bermasalah. Silakan coba lagi.</p><button className="share-report" onClick={reset}>Coba lagi</button></main>; }
