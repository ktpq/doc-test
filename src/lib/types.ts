export const FIELD_TYPES = [
  "text",
  "textarea",
  "radio",
  "select",
  "date",
  "checkbox",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

/** schema ของหนึ่งช่องกรอก ตามที่ตกลงไว้: {key, label, type, options?} */
export type FormField = {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
};

/** checkbox ตอบได้หลายค่า จึงเป็น array ส่วนที่เหลือเป็น string */
export type AnswerValue = string | string[];

export type TemplateRecord = {
  id: string;
  originalName: string;
  /** ชื่อไฟล์จริงบนดิสก์ใต้ <dataDir>/templates */
  filename: string;
  /** placeholder ที่ scan เจอ เรียงตามลำดับที่ปรากฏในเอกสาร */
  keys: string[];
  /** วิธีที่ scan สำเร็จ — rawXml แปลว่า docxtemplater compile ไฟล์นี้ไม่ผ่าน */
  scanSource: "getFullText" | "rawXml";
  /** null = ยังไม่ได้ตั้งค่าฟอร์มในหน้า /admin/build-form */
  fields: FormField[] | null;
  createdAt: string;
};

export type SubmissionRecord = {
  id: string;
  templateId: string;
  answers: Record<string, AnswerValue>;
  createdAt: string;
};

export type Db = {
  templates: TemplateRecord[];
  submissions: SubmissionRecord[];
};
