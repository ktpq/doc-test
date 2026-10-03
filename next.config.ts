import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // docxtemplater/pizzip เป็น CommonJS ฝั่ง Node ล้วน — กันไม่ให้ bundler พยายาม bundle เข้าไป
  serverExternalPackages: ["docxtemplater", "pizzip"],
  // ปักหมุด root ไว้ที่โปรเจกต์ ไม่งั้น Turbopack ไล่หา lockfile ขึ้นไปจนถึง home directory
  turbopack: { root: path.dirname(fileURLToPath(import.meta.url)) },
  // เผื่อเปิด tunnel ชี้มาที่ `npm run dev` — dev server บล็อก request ที่มาจาก origin อื่น
  // (ถ้าแชร์ด้วย `npm run share` ซึ่งใช้ production build อยู่แล้ว บรรทัดนี้ไม่มีผล)
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
