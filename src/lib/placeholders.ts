import type { AnswerValue } from "./types";

/**
 * การตีความ placeholder — ไม่มี dependency กับ docxtemplater/pizzip
 * แยกไฟล์ไว้เพราะ FormBuilder (client component) ต้องใช้ groupPlaceholders ด้วย
 * ถ้าไปอยู่ใน docx.ts จะลาก pizzip เข้า bundle ฝั่ง browser
 */

/**
 * placeholder หนึ่งตัวในเอกสาร หลังจับกลุ่ม {base=value} เข้าด้วยกันแล้ว
 *
 * "choice" = ช่องติ๊กถูก — หนึ่งคำถามกินที่หลายกล่องในเอกสาร
 * เช่น {has_license=มี} กับ {has_license=ไม่มี} คือฟิลด์เดียวกันชื่อ has_license
 */
export type Placeholder =
  | { kind: "plain"; key: string }
  | { kind: "choice"; key: string; values: string[]; rawKeys: string[] };

/** แยก {base=value} ออกเป็นคู่ คืน null ถ้าไม่ใช่รูปแบบนั้น */
export function splitChoice(raw: string): { base: string; value: string } | null {
  const eq = raw.indexOf("=");
  if (eq <= 0) return null;
  const base = raw.slice(0, eq).trim();
  const value = raw.slice(eq + 1).trim();
  if (!base || !value) return null;
  // base ถูกใช้เป็นชื่อ field ของ react-hook-form จึงห้ามมี field-path notation
  if (base.includes(".") || base.includes("[")) return null;
  return { base, value };
}

/**
 * ยุบ key ดิบที่ scan ได้ให้เป็นรายการฟิลด์ที่เอาไปสร้างฟอร์มได้จริง
 * คงลำดับตามที่ปรากฏในเอกสาร และ dedupe ค่าซ้ำ
 */
export function groupPlaceholders(keys: string[]): Placeholder[] {
  const result: Placeholder[] = [];
  const choiceIndex = new Map<string, number>();

  for (const raw of keys) {
    const choice = splitChoice(raw);

    if (!choice) {
      if (!result.some((p) => p.kind === "plain" && p.key === raw)) {
        result.push({ kind: "plain", key: raw });
      }
      continue;
    }

    const existing = choiceIndex.get(choice.base);
    if (existing === undefined) {
      choiceIndex.set(choice.base, result.length);
      result.push({
        kind: "choice",
        key: choice.base,
        values: [choice.value],
        rawKeys: [raw],
      });
      continue;
    }

    const group = result[existing] as Extract<Placeholder, { kind: "choice" }>;
    if (!group.values.includes(choice.value)) {
      group.values.push(choice.value);
      group.rawKeys.push(raw);
    }
  }

  return result;
}

export type AnswerMap = Record<string, AnswerValue>;

/**
 * แปลงคำตอบจากฟอร์มให้เป็น map ที่ docxtemplater ใช้ได้
 *
 * ทุก {base=value} ในเอกสารจะกลายเป็นสัญลักษณ์กล่องติ๊ก ส่วน key ธรรมดาส่งค่าเดิมผ่านไป
 * ต้องเรียกก่อน doc.render() เสมอ
 */
export function expandAnswers(
  templateKeys: string[],
  answers: AnswerMap,
  symbols: { checked: string; unchecked: string },
): Record<string, string> {
  const data: Record<string, string> = {};

  for (const [key, value] of Object.entries(answers)) {
    data[key] = Array.isArray(value) ? value.join(", ") : value;
  }

  for (const raw of templateKeys) {
    const choice = splitChoice(raw);
    if (!choice) continue;

    const answer = answers[choice.base];
    const selected = Array.isArray(answer)
      ? answer.includes(choice.value)
      : answer === choice.value;

    data[raw] = selected ? symbols.checked : symbols.unchecked;
  }

  return data;
}
