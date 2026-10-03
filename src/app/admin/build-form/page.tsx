import Link from "next/link";

import { getTemplate, listTemplates } from "@/lib/db";

import FormBuilder from "./FormBuilder";

export const dynamic = "force-dynamic";

export default async function BuildFormPage({
  searchParams,
}: {
  searchParams: Promise<{ templateId?: string }>;
}) {
  const { templateId } = await searchParams;

  if (!templateId) {
    const templates = await listTemplates();
    return (
      <>
        <h1>2. ตั้งค่าฟอร์ม</h1>
        <p className="muted">เลือก template ที่จะตั้งค่า</p>
        {templates.length === 0 ? (
          <p>
            ยังไม่มี template — <Link href="/admin/upload">อัพโหลดก่อน</Link>
          </p>
        ) : (
          <ul>
            {templates.map((t) => (
              <li key={t.id}>
                <Link href={`/admin/build-form?templateId=${t.id}`}>{t.originalName}</Link>{" "}
                <span className="muted">({t.keys.length} key)</span>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  const template = await getTemplate(templateId);
  if (!template) {
    return (
      <>
        <h1>ไม่พบ template</h1>
        <Link href="/admin/build-form">← เลือก template อื่น</Link>
      </>
    );
  }

  return (
    <>
      <h1>2. ตั้งค่าฟอร์ม</h1>
      <p className="muted">
        {template.originalName} · {template.keys.length} placeholder
      </p>
      <FormBuilder template={template} />
    </>
  );
}
