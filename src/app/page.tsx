import Link from "next/link";

import { listSubmissions, listTemplates } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [templates, submissions] = await Promise.all([listTemplates(), listSubmissions()]);

  return (
    <>
      <h1>Docx → Form → Docx</h1>
      <p className="muted">
        เดโม flow: อัพโหลด .docx ที่มี <code>{"{key}"}</code> → scan placeholder →
        ตั้งค่าฟอร์ม → นักศึกษากรอก → merge กลับเป็น .docx
      </p>

      <h2>Template ({templates.length})</h2>
      {templates.length === 0 ? (
        <p className="muted">
          ยังไม่มี — เริ่มที่ <Link href="/admin/upload">/admin/upload</Link>
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>ไฟล์</th>
              <th>placeholder</th>
              <th>ฟอร์ม</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td>{t.originalName}</td>
                <td>{t.keys.length} key</td>
                <td>{t.fields ? `ตั้งค่าแล้ว (${t.fields.length})` : "ยังไม่ได้ตั้ง"}</td>
                <td>
                  <div className="row">
                    <Link href={`/admin/build-form?templateId=${t.id}`}>ตั้งค่าฟอร์ม</Link>
                    {t.fields && (
                      <Link href={`/student/fill?templateId=${t.id}`}>กรอกฟอร์ม</Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Submission ({submissions.length})</h2>
      {submissions.length === 0 ? (
        <p className="muted">ยังไม่มีใครกรอก</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>เวลา</th>
              <th>template</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id}>
                <td>{new Date(s.createdAt).toLocaleString("th-TH")}</td>
                <td>
                  {templates.find((t) => t.id === s.templateId)?.originalName ?? s.templateId}
                </td>
                <td>
                  <Link href={`/admin/view/${s.id}`}>ดูคำตอบ</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
