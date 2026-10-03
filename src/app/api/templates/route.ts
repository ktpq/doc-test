import { NextResponse } from "next/server";

import { createTemplate, listTemplates } from "@/lib/db";
import { scanPlaceholders } from "@/lib/docx";

// ใช้ fs + pizzip จึงต้องรันบน Node runtime (edge ไม่มี fs)
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ templates: await listTemplates() });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "กรุณาแนบไฟล์ในฟิลด์ 'file'" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".docx")) {
    return NextResponse.json({ error: "รองรับเฉพาะไฟล์ .docx" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let scan;
  try {
    scan = scanPlaceholders(buffer);
  } catch (error) {
    // เปิด zip ไม่ได้เลย = ไม่ใช่ .docx จริง (เช่น .doc เก่าที่เปลี่ยนนามสกุลมา)
    return NextResponse.json(
      { error: `อ่านไฟล์ไม่สำเร็จ: ${(error as Error).message}` },
      { status: 400 },
    );
  }

  if (scan.keys.length === 0) {
    return NextResponse.json(
      { error: "ไม่พบ placeholder รูปแบบ {key} ในไฟล์นี้" },
      { status: 422 },
    );
  }

  const template = await createTemplate({
    originalName: file.name,
    buffer,
    keys: scan.keys,
    scanSource: scan.source,
  });

  return NextResponse.json({ template }, { status: 201 });
}
