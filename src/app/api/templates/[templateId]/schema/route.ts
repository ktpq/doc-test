import { NextResponse } from "next/server";

import { getTemplate, saveTemplateFields } from "@/lib/db";
import { formFieldsSchema } from "@/lib/form-schema";
import { groupPlaceholders } from "@/lib/placeholders";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const { templateId } = await params;
  const template = await getTemplate(templateId);

  if (!template) {
    return NextResponse.json({ error: "ไม่พบ template" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = formFieldsSchema.safeParse(body?.fields);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "schema ไม่ถูกต้อง", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // กันตั้งค่าฟอร์มด้วย key ที่ไม่มีอยู่จริงในเอกสาร (merge แล้วจะไม่มีที่ลง)
  // เทียบกับ key ที่จับกลุ่มแล้ว เพราะช่องติ๊ก {a=x}{a=y} มีชื่อฟิลด์เป็น "a" ไม่ใช่ "a=x"
  const known = new Set(groupPlaceholders(template.keys).map((p) => p.key));
  const unknown = parsed.data.filter((f) => !known.has(f.key));
  if (unknown.length) {
    return NextResponse.json(
      { error: `key ไม่มีในเอกสาร: ${unknown.map((f) => f.key).join(", ")}` },
      { status: 400 },
    );
  }

  const updated = await saveTemplateFields(templateId, parsed.data);
  return NextResponse.json({ template: updated });
}
