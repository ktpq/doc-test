import { NextResponse } from "next/server";

import { getSubmission, getTemplate } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await params;
  const submission = await getSubmission(submissionId);

  if (!submission) {
    return NextResponse.json({ error: "ไม่พบ submission" }, { status: 404 });
  }

  return NextResponse.json({
    submission,
    template: (await getTemplate(submission.templateId)) ?? null,
  });
}
