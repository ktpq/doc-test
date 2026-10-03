import { NextResponse } from "next/server";

import { createSubmission, getTemplate, listSubmissions } from "@/lib/db";
import { buildZodSchema } from "@/lib/form-schema";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ submissions: await listSubmissions() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const templateId = typeof body?.templateId === "string" ? body.templateId : "";
  const template = await getTemplate(templateId);

  if (!template) {
    return NextResponse.json({ error: "ไม่พบ template" }, { status: 404 });
  }
  if (!template.fields?.length) {
    return NextResponse.json(
      { error: "template นี้ยังไม่ได้ตั้งค่าฟอร์มที่ /admin/build-form" },
      { status: 409 },
    );
  }

  // validate ซ้ำฝั่ง server ด้วย schema ชุดเดียวกับที่ client ใช้
  const parsed = buildZodSchema(template.fields).safeParse(body?.answers);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "คำตอบไม่ผ่านการตรวจสอบ", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const submission = await createSubmission({
    templateId: template.id,
    answers: parsed.data,
  });

  return NextResponse.json({ submission }, { status: 201 });
}
