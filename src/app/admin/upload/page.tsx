"use client";

import Link from "next/link";
import { useState } from "react";

import { groupPlaceholders } from "@/lib/placeholders";
import type { TemplateRecord } from "@/lib/types";

export default function UploadPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateRecord | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setTemplate(null);

    const body = new FormData(event.currentTarget);
    const response = await fetch("/api/templates", { method: "POST", body });
    const json = await response.json().catch(() => ({}));

    setBusy(false);
    if (!response.ok) {
      setError(json.error ?? `อัพโหลดไม่สำเร็จ (${response.status})`);
      return;
    }
    setTemplate(json.template);
  }

  return (
    <>
      <h1>1. อัพโหลดไฟล์ต้นแบบ</h1>
      <p className="muted">
        ระบบจะ scan หา <code>{"{key}"}</code> ทั้งหมดด้วย{" "}
        <code>docxtemplater.getFullText()</code> ก่อน แล้วจึง regex — วิธีนี้จับ placeholder
        ที่ Word ตัดขาดเป็นหลาย text run ได้
      </p>

      <p className="hint">
        ยังไม่มีไฟล์? <a href="/sample-template.docx" download>โหลดไฟล์ตัวอย่าง</a>{" "}
        (แบบตอบรับนักศึกษาสหกิจศึกษา ฟอนต์ TH SarabunPSK มีทั้งช่องกรอกธรรมดา ตาราง
        และช่องติ๊กถูก) แล้วเอามาอัพโหลดได้เลย
      </p>

      <p className="hint">
        ช่องติ๊กถูกเขียนเป็น <code>{"{has_license=มี}"}</code>{" "}
        <code>{"{has_license=ไม่มี}"}</code> — ระบบจะยุบให้เหลือฟิลด์เดียวพร้อมตัวเลือก
        ส่วนตารางไม่ต้องทำอะไรพิเศษ ใส่ <code>{"{key}"}</code> ในช่องได้เลย
      </p>

      <form onSubmit={handleSubmit} className="card">
        <div className="field">
          <label htmlFor="file">ไฟล์ .docx</label>
          <input id="file" name="file" type="file" accept=".docx" required />
        </div>
        <button type="submit" className="primary" disabled={busy}>
          {busy ? "กำลัง scan…" : "อัพโหลดและ scan"}
        </button>
      </form>

      {error && <p className="warn">{error}</p>}

      {template && (
        <>
          <h2>
            พบ {groupPlaceholders(template.keys).length} ฟิลด์{" "}
            <span className="muted">(จาก {template.keys.length} placeholder ในเอกสาร)</span>
          </h2>
          {template.scanSource === "rawXml" && (
            <p className="warn">
              docxtemplater compile ไฟล์นี้ไม่ผ่าน (น่าจะมี <code>{"{"}</code> หรือ{" "}
              <code>{"}"}</code> ลอยๆ ที่ไม่ใช่ placeholder) — ลิสต์ข้างล่างมาจากการอ่าน XML
              ดิบแบบ best-effort และตอน merge จะ error ควรแก้ในเอกสารก่อน
            </p>
          )}
          <ul>
            {groupPlaceholders(template.keys).map((placeholder) =>
              placeholder.kind === "choice" ? (
                <li key={placeholder.key}>
                  <code>{`{${placeholder.key}}`}</code>{" "}
                  <span className="hint">
                    ช่องติ๊ก — {placeholder.values.join(" / ")}
                  </span>
                </li>
              ) : (
                <li key={placeholder.key}>
                  <code>{`{${placeholder.key}}`}</code>
                </li>
              ),
            )}
          </ul>
          <Link href={`/admin/build-form?templateId=${template.id}`}>
            → ไปตั้งค่าฟอร์ม
          </Link>
        </>
      )}
    </>
  );
}
