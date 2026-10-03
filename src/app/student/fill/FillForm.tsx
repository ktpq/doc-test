"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import DynamicForm from "@/components/DynamicForm";
import type { DynamicFormValues } from "@/lib/form-schema";
import type { FormField } from "@/lib/types";

export default function FillForm({
  templateId,
  fields,
}: {
  templateId: string;
  fields: FormField[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(answers: DynamicFormValues) {
    setBusy(true);
    setError(null);

    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, answers }),
    });
    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      setBusy(false);
      setError(json.error ?? `ส่งไม่สำเร็จ (${response.status})`);
      return;
    }
    // ไม่ปลด busy เพราะกำลังจะเปลี่ยนหน้า
    router.push(`/admin/view/${json.submission.id}`);
  }

  return (
    <>
      {error && <p className="warn">{error}</p>}
      <DynamicForm fields={fields} submitting={busy} onSubmit={submit} />
    </>
  );
}
