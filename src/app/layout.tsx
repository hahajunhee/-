import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "거래관리 시스템 - 굿푸드시스템",
  description: "거래명세서 관리 및 자동 생성 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="h-full">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
