"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { groupPlaceholders } from "@/lib/placeholders";
import { FIELD_TYPES, type FieldType, type FormField, type TemplateRecord } from "@/lib/types";

const TYPE_LABEL: Record<FieldType, string> = {
  text: "ข้อความสั้น (text)",
  textarea: "ข้อความยาว (textarea)",
  radio: "ตัวเลือกเดียว (radio)",
  select: "ดรอปดาวน์ (select)",
  date: "วันที่ (date)",
  checkbox: "ช่องติ๊ก เลือกได้หลายข้อ (checkbox)",
};

/** ช่องติ๊ก {key=value} เลือกได้แค่สองแบบนี้ ประเภทอื่นไม่มีกล่องให้ทา */
const CHOICE_TYPES: FieldType[] = ["radio", "checkbox"];

const needsOptions = (type: FieldType) =>
  type === "radio" || type === "select" || type === "checkbox";

/**
 * แปลง snake_case / kebab-case เป็น label ตั้งต้นที่พออ่านได้
 *
 * คีย์ที่ไม่ใช่ ASCII (ตั้งชื่อเป็นภาษาไทยมาแล้ว) คืนตามเดิม — ไม่งั้น {ชื่อ-นามสกุล}
 * จะกลายเป็น label "ชื่อ นามสกุล" ทั้งที่ตั้งใจตั้งชื่อไทยมาเพื่อจะได้ไม่ต้องแก้ label
 */
function guessLabel(key: string) {
  if (/[^\u0000-\u007F]/.test(key)) return key;
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type Draft = FormField & {
  optionsText: string;
  /** option มาจาก {key=value} ในเอกสาร แก้ไม่ได้ ไม่งั้นจะไม่ตรงกับกล่องในไฟล์ */
  lockedOptions: string[] | null;
};

export default function FormBuilder({ template }: { template: TemplateRecord }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    groupPlaceholders(template.keys).map((placeholder) => {
      const saved = template.fields?.find((f) => f.key === placeholder.key);
      const locked = placeholder.kind === "choice" ? placeholder.values : null;
      return {
        key: placeholder.key,
        label: saved?.label ?? guessLabel(placeholder.key),
        type: saved?.type ?? (locked ? "radio" : "text"),
        optionsText: (locked ?? saved?.options ?? []).join("\n"),
        lockedOptions: locked,
      };
    }),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function patch(key: string, change: Partial<Draft>) {
    setSaved(false);
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...change } : d)));
  }

  async function save() {
    setBusy(true);
    setError(null);

    const fields: FormField[] = drafts.map((d) => {
      const field: FormField = { key: d.key, label: d.label.trim() || d.key, type: d.type };
      if (needsOptions(d.type)) {
        field.options =
          d.lockedOptions ??
          d.optionsText
            .split("\n")
            .map((o) => o.trim())
            .filter(Boolean);
      }
      return field;
    });

    const missing = fields.filter((f) => needsOptions(f.type) && !f.options?.length);
    if (missing.length) {
      setBusy(false);
      setError(`ยังไม่ได้ใส่ option ให้: ${missing.map((f) => f.key).join(", ")}`);
      return;
    }

    const response = await fetch(`/api/templates/${template.id}/schema`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });
    const json = await response.json().catch(() => ({}));

    setBusy(false);
    if (!response.ok) {
      setError(json.error ?? `บันทึกไม่สำเร็จ (${response.status})`);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <>
      {drafts.map((draft) => (
        <div className="card" key={draft.key}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            {draft.lockedOptions ? (
              <span className="row">
                {draft.lockedOptions.map((value) => (
                  <code key={value}>{`{${draft.key}=${value}}`}</code>
                ))}
                <span className="hint">ช่องติ๊กในเอกสาร</span>
              </span>
            ) : (
              <code>{`{${draft.key}}`}</code>
            )}
          </div>

          <div className="grid" style={{ marginTop: ".6rem" }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor={`label-${draft.key}`}>Label</label>
              <input
                id={`label-${draft.key}`}
                type="text"
                value={draft.label}
                onChange={(e) => patch(draft.key, { label: e.target.value })}
              />
            </div>

            <div className="field" style={{ margin: 0 }}>
              <label htmlFor={`type-${draft.key}`}>ประเภทฟิลด์</label>
              <select
                id={`type-${draft.key}`}
                value={draft.type}
                onChange={(e) => patch(draft.key, { type: e.target.value as FieldType })}
              >
                {(draft.lockedOptions ? CHOICE_TYPES : FIELD_TYPES).map((type) => (
                  <option key={type} value={type}>
                    {TYPE_LABEL[type]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {draft.lockedOptions ? (
            <p className="hint" style={{ marginTop: ".8rem" }}>
              ตัวเลือกมาจากเอกสาร แก้ที่นี่ไม่ได้ — <b>{draft.lockedOptions.join(" · ")}</b>{" "}
              (ถ้าจะเปลี่ยนต้องแก้ <code>{`{${draft.key}=…}`}</code> ในไฟล์ Word)
            </p>
          ) : (
            needsOptions(draft.type) && (
              <div className="field" style={{ marginTop: ".8rem", marginBottom: 0 }}>
                <label htmlFor={`opt-${draft.key}`}>ตัวเลือก (บรรทัดละ 1 ตัวเลือก)</label>
                <textarea
                  id={`opt-${draft.key}`}
                  rows={3}
                  value={draft.optionsText}
                  placeholder={"ตัวเลือก ก\nตัวเลือก ข"}
                  onChange={(e) => patch(draft.key, { optionsText: e.target.value })}
                />
              </div>
            )
          )}
        </div>
      ))}

      {error && <p className="warn">{error}</p>}

      <div className="row" style={{ marginTop: "1rem" }}>
        <button type="button" className="primary" onClick={save} disabled={busy}>
          {busy ? "กำลังบันทึก…" : "บันทึกฟอร์ม"}
        </button>
        {saved && (
          <a href={`/student/fill?templateId=${template.id}`}>บันทึกแล้ว → ไปกรอกฟอร์ม</a>
        )}
      </div>
    </>
  );
}
