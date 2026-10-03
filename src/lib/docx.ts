import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

import { expandAnswers, type AnswerMap } from "./placeholders";

/** tag ควบคุมของ docxtemplater (loop/section/raw) ไม่ใช่ช่องกรอก */
const CONTROL_PREFIXES = ["#", "/", "^", ">", "@", "%", "!", "-", "="];

const PLACEHOLDER_RE = /\{([^{}]+)\}/g;

export type ScanResult = {
  keys: string[];
  source: "getFullText" | "rawXml";
};

function docxOptions() {
  return {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{", end: "}" },
  };
}

/** header1.xml / footer2.xml ฯลฯ — getFullText() เปล่าๆ อ่านแค่ word/document.xml */
function partNames(zip: PizZip): string[] {
  return Object.keys(zip.files).filter((name) =>
    /^word\/(header|footer)\d*\.xml$/.test(name),
  );
}

function extractKeys(text: string, into: string[], seen: Set<string>) {
  for (const match of text.matchAll(PLACEHOLDER_RE)) {
    const key = match[1].trim();
    if (!key) continue;
    if (CONTROL_PREFIXES.includes(key[0])) continue;
    // '.' กับ '[' จะถูก react-hook-form ตีความเป็น field path ซ้อน ใช้เป็น key ตรงๆ ไม่ได้
    if (key.includes(".") || key.includes("[")) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    into.push(key);
  }
}

/**
 * หา placeholder {key} ทั้งหมดในไฟล์ .docx
 *
 * ใช้ getFullText() ก่อนเสมอ เพราะ Word ชอบตัดคำเดียวออกเป็นหลาย <w:t> run
 * (เช่น {stud|ent_na|me}) — getFullText() เชื่อม run กลับให้แล้ว แต่ regex ลง XML ดิบจะหาไม่เจอ
 */
export function scanPlaceholders(buffer: Buffer): ScanResult {
  const zip = new PizZip(buffer);
  const keys: string[] = [];
  const seen = new Set<string>();

  try {
    // constructor ของ docxtemplater compile template ทันที จะ throw ถ้าเจอ tag ที่ปิดไม่ครบ
    const doc = new Docxtemplater(zip, docxOptions());
    extractKeys(doc.getFullText(), keys, seen);
    for (const name of partNames(zip)) {
      extractKeys(doc.getFullText(name), keys, seen);
    }
    return { keys, source: "getFullText" };
  } catch {
    // ไฟล์ compile ไม่ผ่าน (มี { หรือ } ลอยๆ) — ยังพอ scan แบบ best-effort ให้ดูได้
    // แต่ตอน merge จะ error แน่ จึงรายงาน source กลับไปเตือนผู้ใช้
    for (const name of ["word/document.xml", ...partNames(zip)]) {
      const file = zip.file(name);
      if (!file) continue;
      const text = file
        .asText()
        .replace(/<\/w:p>/g, "\n")
        .replace(/<[^>]+>/g, "");
      extractKeys(text, keys, seen);
    }
    return { keys, source: "rawXml" };
  }
}

/**
 * สัญลักษณ์ที่เขียนลงช่องติ๊กตอน merge
 *
 * ค่า default เป็น Unicode ☑ ☐ ซึ่งต้องคู่กับ run ที่ตั้งฟอนต์เป็น "Segoe UI Symbol"
 * ในไฟล์ Word — TH SarabunPSK ไม่มี glyph สองตัวนี้เลย ถ้า run เป็นฟอนต์ไทย Word
 * จะ fallback ไปฟอนต์อื่นเอง ขนาดกับ baseline จะเพี้ยนจากข้อความรอบๆ
 *
 * ถ้า template ใช้ Wingdings อยู่ ให้ตั้ง CHECKBOX_CHECKED=þ CHECKBOX_UNCHECKED=o
 */
function checkboxSymbols() {
  return {
    checked: process.env.CHECKBOX_CHECKED ?? "☑",
    unchecked: process.env.CHECKBOX_UNCHECKED ?? "☐",
  };
}

export class DocxRenderError extends Error {
  readonly details: string[];
  constructor(message: string, details: string[]) {
    super(message);
    this.name = "DocxRenderError";
    this.details = details;
  }
}

type DocxtemplaterError = Error & {
  properties?: {
    explanation?: string;
    errors?: Array<{ properties?: { explanation?: string } }>;
  };
};

function explain(error: unknown): string[] {
  const e = error as DocxtemplaterError;
  const nested = e?.properties?.errors ?? [];
  const messages = nested
    .map((n) => n.properties?.explanation)
    .filter((m): m is string => Boolean(m));
  if (messages.length) return messages;
  const single = e?.properties?.explanation;
  if (single) return [single];
  return [e?.message ?? String(error)];
}

/**
 * แทนค่าคำตอบลงไฟล์ต้นฉบับแล้วคืน .docx ที่กรอกครบ
 *
 * ต้องส่ง templateKeys (key ดิบที่ scan ได้ตอนอัพโหลด) มาด้วย เพราะช่องติ๊ก
 * {base=value} ไม่มีอยู่ใน answers ตรงๆ ต้องคำนวณจากรายการ key ในเอกสาร
 */
export function renderDocx(
  buffer: Buffer,
  templateKeys: string[],
  answers: AnswerMap,
): Buffer {
  const zip = new PizZip(buffer);
  try {
    const doc = new Docxtemplater(zip, {
      ...docxOptions(),
      // key ที่ไม่มีคำตอบให้เป็นช่องว่าง ไม่ใช่คำว่า "undefined" โผล่ในเอกสาร
      nullGetter: () => "",
    });
    doc.render(expandAnswers(templateKeys, answers, checkboxSymbols()));
    return doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    }) as Buffer;
  } catch (error) {
    // ไม่ catch แล้วจะเห็นแค่ "Multi error" ซึ่ง debug ไม่ได้เลย
    throw new DocxRenderError("merge ไฟล์ .docx ไม่สำเร็จ", explain(error));
  }
}

/** ใช้ใน smoke test: อ่านข้อความทั้งหมดออกมาจาก .docx เพื่อ assert ผลลัพธ์ */
export function readDocxText(buffer: Buffer): string {
  const zip = new PizZip(buffer);
  const doc = new Docxtemplater(zip, docxOptions());
  return [doc.getFullText(), ...partNames(zip).map((n) => doc.getFullText(n))].join("\n");
}
