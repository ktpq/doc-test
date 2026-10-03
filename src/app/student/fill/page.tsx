import Link from "next/link";

import { getTemplate, listTemplates } from "@/lib/db";

import FillForm from "./FillForm";

export const dynamic = "force-dynamic";

export default async function FillPage({
  searchParams,
}: {
  searchParams: Promise<{ templateId?: string }>;
}) {
  const { templateId } = await searchParams;

  if (!templateId) {
    const ready = (await listTemplates()).filter((t) => t.fields?.length);
    return (
      <>
        <h1>3. กรอกฟอร์ม</h1>
        {ready.length === 0 ? (
          <p className="muted">
            ยังไม่มี template ที่ตั้งค่าฟอร์มไว้ —{" "}
            <Link href="/admin/build-form">ไปตั้งค่าก่อน</Link>
          </p>
        ) : (
          <ul>
            {ready.map((t) => (
              <li key={t.id}>
                <Link href={`/student/fill?templateId=${t.id}`}>{t.originalName}</Link>
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
        <Link href="/student/fill">← เลือก template อื่น</Link>
      </>
    );
  }
  if (!template.fields?.length) {
    return (
      <>
        <h1>template นี้ยังไม่ได้ตั้งค่าฟอร์ม</h1>
        <Link href={`/admin/build-form?templateId=${template.id}`}>→ ไปตั้งค่าฟอร์ม</Link>
      </>
    );
  }

  return (
    <>
      <h1>3. กรอกฟอร์ม</h1>
      <p className="muted">{template.originalName}</p>
      <FillForm templateId={template.id} fields={template.fields} />
    </>
  );
}
