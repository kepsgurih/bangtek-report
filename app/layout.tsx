import type { Metadata } from "next";
import "./globals.css";
import "./admin/admin.css";
import "./dark.css";

export const metadata: Metadata = {
  title: "Bangtek Progress — Laporan Sprint",
  description: "Lihat fokus sprint, progres pekerjaan, dan rencana berikutnya dalam bahasa yang mudah dipahami.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      data-scroll-behavior="smooth"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
