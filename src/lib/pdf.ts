import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);

const CONVERT_TIMEOUT_MS = 120_000;

export class PdfConvertError extends Error {
  readonly hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = "PdfConvertError";
    this.hint = hint;
  }
}

type Converter =
  | { kind: "libreoffice"; bin: string }
  | { kind: "word"; script: string };

async function exists(file: string) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

const LIBREOFFICE_CANDIDATES = [
  process.env.SOFFICE_PATH,
  "C:\Program Files\LibreOffice\program\soffice.exe",
  "C:\Program Files (x86)\LibreOffice\program\soffice.exe",
  "/usr/bin/soffice",
  "/usr/bin/libreoffice",
  "/opt/libreoffice/program/soffice",
  "/Applications/LibreOffice.app/Contents/MacOS/soffice",
].filter((p): p is string => Boolean(p));

let cached: Promise<Converter> | null = null;

/**
 * เลือกตัวแปลงครั้งเดียวแล้ว cache ไว้
 *
 * LibreOffice มาก่อนเพราะรันใน Docker ได้ — ซึ่งเป็นทางที่ระบบจริงต้องไป
 * Word COM เป็น fallback สำหรับเครื่อง Windows ที่มี Office ติดตั้งอยู่ (เช่นเครื่อง dev)
 */
async function resolveConverter(): Promise<Converter> {
  for (const bin of LIBREOFFICE_CANDIDATES) {
    if (await exists(bin)) return { kind: "libreoffice", bin };
  }

  // หา soffice ใน PATH
  try {
    const { stdout } = await run(process.platform === "win32" ? "where" : "which", [
      "soffice",
    ]);
    const bin = stdout.split(/\r?\n/).find((l) => l.trim());
    if (bin) return { kind: "libreoffice", bin: bin.trim() };
  } catch {
    // ไม่มีใน PATH — ไปลอง Word ต่อ
  }

  if (process.platform === "win32") {
    const script = path.join(process.cwd(), "scripts", "docx-to-pdf.ps1");
    if (await exists(script)) return { kind: "word", script };
  }

  throw new PdfConvertError(
    "ไม่พบโปรแกรมสำหรับแปลง .docx เป็น PDF บนเครื่องนี้",
    "ติดตั้ง LibreOffice (แนะนำ — ใช้ใน Docker ได้) แล้วรันใหม่ หรือชี้ path เองด้วย env SOFFICE_PATH",
  );
}

function converter() {
  cached ??= resolveConverter().catch((error) => {
    cached = null; // ให้ลองใหม่ได้ถ้าผู้ใช้เพิ่งติดตั้ง LibreOffice ระหว่าง dev server ยังรันอยู่
    throw error;
  });
  return cached;
}

/**
 * แปลงทีละไฟล์ ห้ามขนาน — Word COM เปิดหลาย Documents พร้อมกันแล้วพัง
 * และ soffice headless ชน user profile lock ถ้ารันซ้อนกัน
 */
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}

export async function convertDocxToPdf(docx: Buffer): Promise<Buffer> {
  const tool = await converter();

  return serialize(async () => {
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "doc-test-pdf-"));
    const inFile = path.join(workDir, `${randomUUID()}.docx`);
    const outFile = inFile.replace(/\.docx$/, ".pdf");

    try {
      await fs.writeFile(inFile, docx);

      if (tool.kind === "libreoffice") {
        await run(
          tool.bin,
          [
            "--headless",
            "--norestore",
            // profile แยก กัน lock ชนกับ LibreOffice ที่ผู้ใช้เปิดค้างไว้อยู่
            `-env:UserInstallation=${pathToFileURL(path.join(workDir, "profile")).href}`,
            "--convert-to",
            "pdf",
            "--outdir",
            workDir,
            inFile,
          ],
          { timeout: CONVERT_TIMEOUT_MS, windowsHide: true },
        );
      } else {
        await run(
          "powershell.exe",
          [
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            tool.script,
            "-In",
            inFile,
            "-Out",
            outFile,
          ],
          { timeout: CONVERT_TIMEOUT_MS, windowsHide: true },
        );
      }

      if (!(await exists(outFile))) {
        throw new PdfConvertError(
          `ตัวแปลง (${tool.kind}) รันจบแต่ไม่ได้ไฟล์ PDF ออกมา`,
          "ลองเปิดไฟล์ .docx ด้วยมือดูว่าเสียหรือเปล่า",
        );
      }
      return await fs.readFile(outFile);
    } catch (error) {
      if (error instanceof PdfConvertError) throw error;
      const message = (error as Error).message ?? String(error);
      throw new PdfConvertError(`แปลงเป็น PDF ไม่สำเร็จ (${tool.kind})`, message);
    } finally {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });
}

/** ให้ UI บอกได้ว่าเครื่องนี้แปลง PDF ได้ไหม โดยไม่ต้องลองแปลงจริง */
export async function pdfConverterName(): Promise<string | null> {
  try {
    const tool = await converter();
    return tool.kind === "libreoffice" ? `LibreOffice (${tool.bin})` : "Microsoft Word (COM)";
  } catch {
    return null;
  }
}
