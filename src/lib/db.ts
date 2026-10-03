import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type {
  AnswerValue,
  Db,
  FormField,
  SubmissionRecord,
  TemplateRecord,
} from "./types";

/**
 * เก็บ runtime data ไว้นอก src/ และนอก public/ เพื่อไม่ให้ dev watcher ของ Next
 * reload ทุกครั้งที่มีคนกด submit. ย้ายที่เก็บได้ด้วย env DEMO_DATA_DIR
 */
const dataDir = process.env.DEMO_DATA_DIR
  ? path.resolve(process.env.DEMO_DATA_DIR)
  : path.join(process.cwd(), ".runtime");

const dbFile = path.join(dataDir, "db.json");
const templateDir = path.join(dataDir, "templates");

const emptyDb: Db = { templates: [], submissions: [] };

async function ensureDirs() {
  await fs.mkdir(templateDir, { recursive: true });
}

async function readDb(): Promise<Db> {
  try {
    const raw = await fs.readFile(dbFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<Db>;
    return {
      templates: parsed.templates ?? [],
      submissions: parsed.submissions ?? [],
    };
  } catch {
    return structuredClone(emptyDb);
  }
}

async function writeDb(db: Db) {
  await ensureDirs();
  // เขียนลง temp ก่อนแล้วค่อย rename — กัน db.json พังถ้า process ตายกลางคัน
  const tmp = `${dbFile}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmp, dbFile);
}

/**
 * ทุกการเขียนต่อคิวกันผ่าน promise chain เส้นเดียว เพราะ read-modify-write ของทั้งไฟล์
 * ถ้าทำพร้อมกันสองคำขอ อันหลังจะทับอันแรกหายไป
 */
let writeQueue: Promise<unknown> = Promise.resolve();

function mutate<T>(fn: (db: Db) => Promise<T> | T): Promise<T> {
  const run = writeQueue.then(async () => {
    const db = await readDb();
    const result = await fn(db);
    await writeDb(db);
    return result;
  });
  // คิวต้องเดินต่อแม้คำขอก่อนหน้าพัง
  writeQueue = run.catch(() => undefined);
  return run;
}

export async function listTemplates(): Promise<TemplateRecord[]> {
  return (await readDb()).templates;
}

export async function getTemplate(id: string): Promise<TemplateRecord | undefined> {
  return (await readDb()).templates.find((t) => t.id === id);
}

export async function createTemplate(input: {
  originalName: string;
  buffer: Buffer;
  keys: string[];
  scanSource: TemplateRecord["scanSource"];
}): Promise<TemplateRecord> {
  await ensureDirs();
  const id = randomUUID();
  const filename = `${id}.docx`;
  await fs.writeFile(path.join(templateDir, filename), input.buffer);

  const record: TemplateRecord = {
    id,
    originalName: input.originalName,
    filename,
    keys: input.keys,
    scanSource: input.scanSource,
    fields: null,
    createdAt: new Date().toISOString(),
  };

  return mutate((db) => {
    db.templates.push(record);
    return record;
  });
}

export async function saveTemplateFields(
  id: string,
  fields: FormField[],
): Promise<TemplateRecord | undefined> {
  return mutate((db) => {
    const template = db.templates.find((t) => t.id === id);
    if (!template) return undefined;
    template.fields = fields;
    return template;
  });
}

export async function readTemplateFile(template: TemplateRecord): Promise<Buffer> {
  return fs.readFile(path.join(templateDir, template.filename));
}

export async function listSubmissions(): Promise<SubmissionRecord[]> {
  return (await readDb()).submissions;
}

export async function getSubmission(id: string): Promise<SubmissionRecord | undefined> {
  return (await readDb()).submissions.find((s) => s.id === id);
}

export async function createSubmission(input: {
  templateId: string;
  answers: Record<string, AnswerValue>;
}): Promise<SubmissionRecord> {
  const record: SubmissionRecord = {
    id: randomUUID(),
    templateId: input.templateId,
    answers: input.answers,
    createdAt: new Date().toISOString(),
  };
  return mutate((db) => {
    db.submissions.push(record);
    return record;
  });
}
