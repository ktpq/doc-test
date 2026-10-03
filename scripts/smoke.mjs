/**
 * ยิง API ทั้ง flow ตั้งแต่ต้นจนจบโดยไม่ต้องเปิดเบราว์เซอร์
 * ต้องรัน `npm run dev` ค้างไว้อีก terminal ก่อน
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

import { groupPlaceholders } from "../src/lib/placeholders.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const templateFile = process.env.TEMPLATE ?? path.join(root, "public", "sample-template.docx");
const outDir = path.join(root, ".runtime");
const outFile = path.join(outDir, "smoke-output.docx");

let failed = 0;

function check(label, ok, extra = "") {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failed++;
}

async function call(method, url, init = {}) {
  const response = await fetch(`${base}${url}`, { method, ...init });
  const body = response.headers.get("content-type")?.includes("application/json")
    ? await response.json()
    : Buffer.from(await response.arrayBuffer());
  return { response, body };
}

/** เดาประเภทฟิลด์จาก placeholder เพื่อให้ smoke test ครอบคลุมทุก type */
function fieldFor(placeholder) {
  const { key } = placeholder;

  // ช่องติ๊ก {key=value} — option ต้องมาจากเอกสารเท่านั้น แก้เองไม่ได้
  if (placeholder.kind === "choice") {
    return {
      key,
      label: key,
      // หลายค่า → checkbox, สองค่าแบบ มี/ไม่มี → radio
      type: placeholder.values.length > 2 ? "checkbox" : "radio",
      options: placeholder.values,
    };
  }

  if (key.endsWith("_date")) return { key, label: key, type: "date" };
  if (key === "faculty")
    return {
      key,
      label: "คณะ",
      type: "select",
      options: ["วิศวกรรมคอมพิวเตอร์", "วิทยาการคอมพิวเตอร์"],
    };
  if (key === "position")
    return { key, label: "ตำแหน่ง", type: "radio", options: ["Developer", "Tester"] };
  if (key === "job_description") return { key, label: "ลักษณะงาน", type: "textarea" };
  return { key, label: key, type: "text" };
}

function answerFor(field) {
  switch (field.type) {
    case "date":
      return field.key === "start_date" ? "2026-11-03" : "2027-03-31";
    case "select":
    case "radio":
      return field.options[0];
    // เลือกไม่ครบทุกข้อตั้งใจ เพื่อให้มีทั้งกล่องที่ติ๊กและไม่ติ๊กในไฟล์ผลลัพธ์
    case "checkbox":
      return field.options.slice(0, 2);
    case "textarea":
      return "พัฒนาเว็บแอปพลิเคชันด้วย Next.js\nและดูแลระบบฐานข้อมูล";
    default:
      return `ค่าทดสอบ-${field.key}`;
  }
}

console.log(`\nbase url: ${base}\ntemplate: ${templateFile}\n`);

// ── 1. upload + scan ────────────────────────────────────────────────
const fileBuffer = readFileSync(templateFile);
const form = new FormData();
form.append("file", new File([fileBuffer], path.basename(templateFile)), path.basename(templateFile));

const upload = await call("POST", "/api/templates", { body: form });
check("1. POST /api/templates", upload.response.status === 201, JSON.stringify(upload.body?.error ?? ""));
if (upload.response.status !== 201) process.exit(1);

const template = upload.body.template;
const placeholders = groupPlaceholders(template.keys);
const isSample = path.basename(templateFile) === "sample-template.docx";

console.log(`      scan source: ${template.scanSource}`);
console.log(`      placeholder ดิบ ${template.keys.length} → ${placeholders.length} ฟิลด์`);
check("   scan เจอ placeholder อย่างน้อย 1 ตัว", template.keys.length > 0);
check(
  "   scan ใช้ getFullText ได้ (ไฟล์ compile ผ่าน)",
  template.scanSource === "getFullText",
);
// placeholder ที่ถูกแตกเป็นหลาย run ต้องถูกเชื่อมกลับได้
if (isSample) {
  check(
    "   เจอ student_name ที่ถูกแตกเป็น 3 text run",
    template.keys.includes("student_name"),
  );

  // ── ตาราง: เซลล์ก็คือ <w:p><w:r><w:t> เหมือนย่อหน้าทั่วไป ไม่ต้องทำอะไรเพิ่ม ──
  const tableKeys = [
    "edu_lower_year",
    "edu_lower_school",
    "edu_upper_gpa",
    "edu_bachelor_major",
  ];
  const missingTable = tableKeys.filter((k) => !template.keys.includes(k));
  check(
    "   เจอ placeholder ที่อยู่ในเซลล์ตาราง",
    missingTable.length === 0,
    missingTable.join(", "),
  );

  // ── ช่องติ๊ก: {a=x} {a=y} ต้องยุบเหลือฟิลด์เดียว ──
  const license = placeholders.find((p) => p.key === "has_license");
  check("   has_license ยุบเป็นฟิลด์เดียว", license?.kind === "choice");
  check(
    "   has_license มี 2 ตัวเลือกจากเอกสาร",
    license?.values?.join("/") === "มี/ไม่มี",
    license?.values?.join("/"),
  );

  const skills = placeholders.find((p) => p.key === "skills");
  check("   skills มี 3 ตัวเลือกจากเอกสาร", skills?.values?.length === 3);

  check(
    "   ไม่มี key ดิบ has_license=… หลุดมาเป็นฟิลด์",
    !placeholders.some((p) => p.key.includes("=")),
  );
}

// ── 2. บันทึก form schema ───────────────────────────────────────────
const fields = placeholders.map(fieldFor);
const schema = await call("PUT", `/api/templates/${template.id}/schema`, {
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ fields }),
});
check("2. PUT schema", schema.response.ok, JSON.stringify(schema.body?.error ?? ""));

// ── 3. submit คำตอบ ─────────────────────────────────────────────────
const answers = Object.fromEntries(fields.map((f) => [f.key, answerFor(f)]));

// ส่งค่าว่างก่อน — ต้องโดน zod ฝั่ง server ตีกลับ
const invalid = await call("POST", "/api/submissions", {
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    templateId: template.id,
    answers: Object.fromEntries(
      fields.map((f) => [f.key, f.type === "checkbox" ? [] : ""]),
    ),
  }),
});
check(
  "3a. server ปฏิเสธคำตอบว่าง (zod dynamic ทำงาน)",
  invalid.response.status === 400,
  `ได้ ${invalid.response.status}`,
);

const submit = await call("POST", "/api/submissions", {
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ templateId: template.id, answers }),
});
check("3b. POST /api/submissions", submit.response.status === 201, JSON.stringify(submit.body?.error ?? ""));
if (submit.response.status !== 201) process.exit(1);

const submissionId = submit.body.submission.id;

// ── 4. merge + ดาวน์โหลด ────────────────────────────────────────────
const download = await call("GET", `/api/submissions/${submissionId}/docx`);
check("4. GET .docx", download.response.ok, JSON.stringify(download.body?.error ?? download.body?.details ?? ""));
if (!download.response.ok) process.exit(1);

check(
  "   content-type เป็น .docx",
  download.response.headers.get("content-type")?.includes("wordprocessingml.document") === true,
);

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, download.body);
console.log(`      บันทึกไว้ที่: ${outFile}`);

// ── 5. ตรวจเนื้อหาไฟล์ผลลัพธ์ ───────────────────────────────────────
const merged = new Docxtemplater(new PizZip(download.body), {
  delimiters: { start: "{", end: "}" },
});
const text = merged.getFullText();

check("5a. ไฟล์ผลลัพธ์เปิดเป็น .docx ได้", text.length > 0);
check("5b. ไม่เหลือ placeholder ที่ยังไม่แทนค่า", !/\{[^{}]+\}/.test(text));
check("5c. ไม่มีคำว่า undefined หลุดเข้าเอกสาร", !text.includes("undefined"));

const choices = placeholders.filter((p) => p.kind === "choice");
const choiceKeys = new Set(choices.map((p) => p.key));

for (const field of fields) {
  // ช่องติ๊กไม่ได้เขียนข้อความคำตอบลงเอกสาร มันทากล่อง — ตรวจแยกข้างล่าง
  if (choiceKeys.has(field.key)) continue;

  // textarea มี \n ซึ่งกลายเป็น <w:br/> ใน docx — เทียบทีละบรรทัด
  const parts = String(answers[field.key])
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
  check(`5d. เอกสารมีคำตอบของ {${field.key}}`, parts.every((p) => text.includes(p)));
}

// ── 5e. ช่องติ๊ก: กล่องที่เลือกต้องเป็น þ ที่ไม่ได้เลือกต้องเป็น o ──
// เทียบคู่กับ label ที่อยู่ถัดไป (เช่น "þ มี") แทนการนับตัวอักษรรวม
// เพราะ 'o' โผล่ในคำตอบอื่นได้ เช่น "Developer"
for (const choice of choices) {
  const answer = answers[choice.key];
  const picked = Array.isArray(answer) ? answer : [answer];

  for (const value of choice.values) {
    const selected = picked.includes(value);
    const expected = `${selected ? "þ" : "o"} ${value}`;
    const ok = text.includes(expected);
    check(
      `5e. {${choice.key}=${value}} → ${selected ? "ติ๊ก þ" : "ว่าง o"}`,
      ok,
      // คำนวณสาเหตุเฉพาะตอนตก ไม่งั้นข้อที่ผ่านจะมีข้อความชวนสับสนต่อท้าย
      ok
        ? ""
        : text.includes(`${selected ? "o" : "þ"} ${value}`)
          ? "ได้สัญลักษณ์ตรงข้าม"
          : "หาไม่เจอทั้งคู่",
    );
  }
}

// ── 5f. ข้อความคงที่ในตารางต้องไม่ถูกแตะ ────────────────────────────
if (isSample) {
  check(
    "5f. ข้อความคงที่ในเซลล์ตาราง (KMITL) ยังอยู่ครบ",
    text.includes("สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง"),
  );
  check(
    "   หัวตารางยังอยู่ครบ",
    ["ระดับการศึกษา", "เกรดเฉลี่ย", "วิชาเอก / สาขาวิชา"].every((h) => text.includes(h)),
  );
}

// ── 6. เปิดเป็น PDF ─────────────────────────────────────────────────
const pdf = await call("GET", `/api/submissions/${submissionId}/pdf`);

if (pdf.response.status === 503) {
  // เครื่องนี้ไม่มี LibreOffice/Word — ไม่นับว่าสอบตก แค่ข้ามไป
  console.log("  skip  6. GET .pdf — เครื่องนี้ไม่มีตัวแปลง PDF");
  console.log(`        ${pdf.body?.detail ?? ""}`);
} else {
  check("6. GET .pdf", pdf.response.ok, JSON.stringify(pdf.body?.error ?? ""));

  if (pdf.response.ok) {
    const contentType = pdf.response.headers.get("content-type") ?? "";
    const disposition = pdf.response.headers.get("content-disposition") ?? "";

    check("   content-type เป็น application/pdf", contentType.includes("application/pdf"));
    // inline คือสิ่งที่ทำให้เบราว์เซอร์เปิดดูในแท็บ แทนที่จะเด้ง save dialog
    check("   ส่งแบบ inline (เปิดดูในแท็บได้)", disposition.startsWith("inline"));
    check("   ไฟล์เป็น PDF จริง", pdf.body.subarray(0, 5).toString("latin1") === "%PDF-");

    const raw = pdf.body.toString("latin1");
    const fonts = [
      ...new Set([...raw.matchAll(/\/BaseFont\s*\/([#A-Za-z0-9+._-]+)/g)].map((m) => m[1])),
    ];
    console.log(`      ฟอนต์ที่ฝังใน PDF: ${fonts.join(", ") || "(ไม่พบ)"}`);

    if (path.basename(templateFile) === "sample-template.docx") {
      check("   PDF ฝังฟอนต์ TH SarabunPSK", fonts.some((f) => /sarabun/i.test(f)));
    }

    const pdfOut = path.join(outDir, "smoke-output.pdf");
    writeFileSync(pdfOut, pdf.body);
    console.log(`      บันทึกไว้ที่: ${pdfOut}`);
  }
}

console.log(
  failed === 0
    ? "\nผ่านทั้งหมด — flow ทำงานครบตั้งแต่ upload → scan → form → merge → PDF\n"
    : `\nไม่ผ่าน ${failed} ข้อ\n`,
);
process.exit(failed === 0 ? 0 : 1);
