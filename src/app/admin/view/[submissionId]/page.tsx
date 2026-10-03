import Link from "next/link";

import { getSubmission, getTemplate } from "@/lib/db";
import { pdfConverterName } from "@/lib/pdf";

export const dynamic = "force-dynamic";

export default async function ViewSubmissionPage({
  params,
}: {
  // Next 16: params ของ dynamic route เป็น Promise
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  const submission = await getSubmission(submissionId);

  if (!submission) {
    return (
      <>
        <h1>ไม่พบ submission</h1>
        <Link href="/">← กลับหน้าแรก</Link>
      </>
    );
  }

  const template = await getTemplate(submission.templateId);
  const fields = template?.fields ?? [];
  const converter = await pdfConverterName();

  return (
    <>
      <h1>4. คำตอบที่ได้รับ</h1>
      <p className="muted">
        {template?.originalName ?? submission.templateId} ·{" "}
        {new Date(submission.createdAt).toLocaleString("th-TH")}
      </p>

      <table>
        <thead>
          <tr>
            <th>Placeholder</th>
            <th>Label</th>
            <th>คำตอบ</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(submission.answers).map(([key, value]) => (
            <tr key={key}>
              <td>
                <code>{`{${key}}`}</code>
              </td>
              <td>{fields.find((f) => f.key === key)?.label ?? "—"}</td>
              {/* checkbox ตอบได้หลายข้อ เก็บเป็น array */}
              <td style={{ whiteSpace: "pre-wrap" }}>
                {Array.isArray(value) ? value.join(", ") : value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="row" style={{ marginTop: "1.5rem" }}>
        {/* ลิงก์ตรงไป route handler — route ตอบ Content-Disposition: inline แท็บใหม่จึงแสดง PDF เลย */}
        <a href={`/api/submissions/${submission.id}/pdf`} target="_blank" rel="noopener">
          <button type="button" className="primary" disabled={!converter}>
            ดูไฟล์ที่ generate (เปิด PDF ในแท็บใหม่)
          </button>
        </a>
        <a href={`/api/submissions/${submission.id}/docx`} download>
          <button type="button">ดาวน์โหลด .docx</button>
        </a>
        <Link href="/">กลับหน้าแรก</Link>
      </div>

      <p className="hint" style={{ marginTop: ".5rem" }}>
        ไฟล์ถูก merge ตอนกดปุ่มทุกครั้ง (docxtemplater + pizzip) ไม่ได้เก็บไฟล์ผลลัพธ์ไว้
        {converter && ` · แปลง PDF ด้วย ${converter}`}
      </p>

      {!converter && (
        <p className="warn">
          เครื่องนี้ยังไม่มีตัวแปลง PDF — ติดตั้ง LibreOffice (หรือมี Microsoft Word บน
          Windows) แล้ว restart dev server ระหว่างนี้ใช้ปุ่มดาวน์โหลด .docx ไปก่อนได้
        </p>
      )}
    </>
  );
}
