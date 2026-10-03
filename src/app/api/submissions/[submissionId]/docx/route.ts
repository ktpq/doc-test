import { NextResponse } from "next/server";

import { getSubmission, getTemplate, readTemplateFile } from "@/lib/db";
import { DocxRenderError, renderDocx } from "@/lib/docx";

export const runtime = "nodejs";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await params;

  const submission = await getSubmission(submissionId);
  if (!submission) {
    return NextResponse.json({ error: "ไม่พบ submission" }, { status: 404 });
  }

  const template = await getTemplate(submission.templateId);
  if (!template) {
    return NextResponse.json({ error: "ไม่พบไฟล์ต้นฉบับของ submission นี้" }, { status: 404 });
  }

  let merged: Buffer;
  try {
    merged = renderDocx(
      await readTemplateFile(template),
      template.keys,
      submission.answers,
    );
  } catch (error) {
    if (error instanceof DocxRenderError) {
      return NextResponse.json({ error: error.message, details: error.details }, { status: 500 });
    }
    throw error;
  }

  const base = template.originalName.replace(/\.docx$/i, "");
  const filename = `${base}-filled-${submission.id.slice(0, 8)}.docx`;

  return new NextResponse(new Uint8Array(merged), {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Length": String(merged.byteLength),
      // filename ธรรมดาเป็น ASCII ไว้ก่อน แล้วให้ filename* ถือชื่อไทยจริง
      "Content-Disposition": `attachment; filename="document-${submission.id.slice(0, 8)}.docx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
