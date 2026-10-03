import { NextResponse } from "next/server";

import { getTemplate } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  // Next 16: params ของ dynamic route เป็น Promise
  { params }: { params: Promise<{ templateId: string }> },
) {
  const { templateId } = await params;
  const template = await getTemplate(templateId);

  if (!template) {
    return NextResponse.json({ error: "ไม่พบ template" }, { status: 404 });
  }
  return NextResponse.json({ template });
}
