import { z } from "zod";

import { FIELD_TYPES, type AnswerValue, type FormField } from "./types";

/**
 * สร้าง zod schema จาก field list ตอน runtime — ไม่มี key ไหนถูก hardcode ไว้เลย
 * ไฟล์นี้ใช้ร่วมกันทั้งฝั่ง client (resolver ของ react-hook-form) และฝั่ง server
 * (validate ซ้ำตอนรับ submission) เพื่อให้กติกาเป็นชุดเดียวกัน
 */
export function buildZodSchema(fields: FormField[]) {
  const shape: Record<string, z.ZodType<AnswerValue>> = {};

  for (const field of fields) {
    const label = field.label || field.key;

    switch (field.type) {
      // ช่องติ๊กแบบเลือกได้หลายข้อ — คำตอบเป็น array ไม่ใช่ string
      case "checkbox": {
        const options = field.options?.filter((o) => o.trim() !== "") ?? [];
        const item = options.length
          ? z.enum(options as [string, ...string[]])
          : z.string().trim().min(1);
        shape[field.key] = z
          .array(item)
          .min(1, `กรุณาเลือก${label} อย่างน้อย 1 ข้อ`);
        break;
      }
      case "radio":
      case "select": {
        const options = field.options?.filter((o) => o.trim() !== "") ?? [];
        shape[field.key] = options.length
          ? z.enum(options as [string, ...string[]], { message: `กรุณาเลือก${label}` })
          : // ถ้ายังไม่ได้ใส่ option ให้ fallback เป็น text ไม่งั้น z.enum จะพังเพราะ tuple ว่าง
            z.string().trim().min(1, `กรุณาเลือก${label}`);
        break;
      }
      case "date":
        shape[field.key] = z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, `${label}: ต้องเป็นวันที่รูปแบบ YYYY-MM-DD`);
        break;
      case "textarea":
      case "text":
      default:
        shape[field.key] = z.string().trim().min(1, `กรุณากรอก${label}`);
        break;
    }
  }

  return z.object(shape);
}

export type DynamicFormValues = Record<string, AnswerValue>;

/**
 * ค่าเริ่มต้นของทุกช่อง เพื่อให้ input เป็น controlled ตั้งแต่ render แรก
 * checkbox ต้องเป็น [] ไม่ใช่ "" ไม่งั้น react-hook-form จะไม่สะสมค่าเป็น array ให้
 */
export function buildDefaultValues(fields: FormField[]): DynamicFormValues {
  return Object.fromEntries(
    fields.map((f) => [f.key, f.type === "checkbox" ? [] : ""]),
  );
}

/** ตรวจ schema ที่ส่งมาจากหน้า /admin/build-form ก่อนบันทึก */
export const formFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1, "ต้องมี label"),
  type: z.enum(FIELD_TYPES),
  options: z.array(z.string()).optional(),
});

export const formFieldsSchema = z.array(formFieldSchema);
