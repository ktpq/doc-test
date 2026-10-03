import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "Docx → Form → Docx demo",
  description: "เดโม flow แปลง Word template เป็นฟอร์มออนไลน์แล้ว merge กลับ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <main>
          <nav className="row muted" style={{ marginBottom: "1.5rem" }}>
            <Link href="/">หน้าแรก</Link>
            <span>·</span>
            <Link href="/admin/upload">1. อัพโหลด</Link>
            <span>·</span>
            <Link href="/admin/build-form">2. ตั้งค่าฟอร์ม</Link>
            <span>·</span>
            <Link href="/student/fill">3. กรอกฟอร์ม</Link>
          </nav>
          {children}
        </main>
      </body>
    </html>
  );
}
