import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "주식 대시보드", description: "실시간 주식 대시보드 + AI 분석" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-[#0f1117] text-[#e1e5ea] antialiased">{children}</body>
    </html>
  );
}
