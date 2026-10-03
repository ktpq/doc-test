import { NextResponse } from "next/server";

import { getSubmission, getTemplate, readTemplateFile } from "@/lib/db";
import { DocxRenderError, renderDocx } from "@/lib/docx";
import { PdfConvertError, convertDocxToPdf } from "@/lib/pdf";

export const runtime = "nodejs";
// แปลง PDF ใช้เวลาหลายวินาที อย่าให้ platform ตัดกลางคัน
export const maxDuration = 120;

/**
 * route นี้ถูกเปิดตรงๆ ในแท็บใหม่ ไม่ได้เรียกผ่าน fetch
 * เวลาพังจึงต้องตอบเป็นหน้า HTML ให้อ่านรู้เรื่อง ไม่ใช่ JSON ดิบ
 */
function fail(request: Request, status: number, title: string, detail?: string) {
  if (!request.headers.get("accept")?.includes("text/html")) {
    return NextResponse.json({ error: title, detail }, { status });
  }
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return new NextResponse(
    `<!doctype html><html lang="th"><head><meta charset="utf-8">
<title>เปิด PDF ไม่สำเร็จ</title>
<style>body{font-family:system-ui,"Segoe UI","Noto Sans Thai",sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;line-height:1.6;color-scheme:light dark}
pre{white-space:pre-wrap;word-break:break-word;font-size:.85rem;opacity:.75}</style></head>
<body><h1>${escape(title)}</h1>${detail ? `<pre>${escape(detail)}</pre>` : ""}
<p><a href="javascript:history.back()">← ย้อนกลับ</a></p></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await params;

  const submission = await getSubmission(submissionId);
  if (!submission) return fail(request, 404, "ไม่พบ submission");

  const template = await getTemplate(submission.templateId);
  if (!template) return fail(request, 404, "ไม่พบไฟล์ต้นฉบับของ submission นี้");

  let pdf: Buffer;
  try {
    const merged = renderDocx(
      await readTemplateFile(template),
      template.keys,
      submission.answers,
    );
    pdf = await convertDocxToPdf(merged);
  } catch (error) {
    if (error instanceof DocxRenderError) {
      return fail(request, 500, error.message, error.details.join("\n"));
    }
    if (error instanceof PdfConvertError) {
      return fail(request, 503, error.message, error.hint);
    }
    throw error;
  }

  const base = template.originalName.replace(/\.docx$/i, "");
  const filename = `${base}-${submission.id.slice(0, 8)}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.byteLength),
      // inline = ให้เบราว์เซอร์เปิดดูในแท็บ ไม่ใช่เด้ง save dialog
      "Content-Disposition": `inline; filename="document-${submission.id.slice(0, 8)}.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
