"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm, type Resolver, type UseFormRegister } from "react-hook-form";

import {
  buildDefaultValues,
  buildZodSchema,
  type DynamicFormValues,
} from "@/lib/form-schema";
import type { FormField } from "@/lib/types";

type Props = {
  fields: FormField[];
  submitting?: boolean;
  onSubmit: (values: DynamicFormValues) => void | Promise<void>;
};

export default function DynamicForm({ fields, submitting = false, onSubmit }: Props) {
  // schema สร้างใหม่เมื่อ field list เปลี่ยนเท่านั้น ไม่งั้น resolver จะถูกสร้างใหม่ทุก render
  // cast ทิ้งไว้เพราะ shape ของ z.object สร้างตอน runtime zod จึง infer เป็น
  // Record<string, unknown> ได้อย่างเดียว แต่ทุก field ที่เราใส่คืน string เสมอ
  const resolver = useMemo(
    () => zodResolver(buildZodSchema(fields)) as Resolver<DynamicFormValues>,
    [fields],
  );
  const defaultValues = useMemo(() => buildDefaultValues(fields), [fields]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DynamicFormValues>({
    resolver,
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {fields.map((field) => (
        <div className="field" key={field.key}>
          <label htmlFor={`f-${field.key}`}>
            {field.label}
            <code>{`{${field.key}}`}</code>
          </label>
          <FieldInput field={field} register={register} />
          {errors[field.key] && (
            <p className="error" role="alert">
              {String(errors[field.key]?.message)}
            </p>
          )}
        </div>
      ))}

      <button type="submit" disabled={submitting}>
        {submitting ? "กำลังส่ง…" : "ส่งคำตอบ"}
      </button>
    </form>
  );
}

function FieldInput({
  field,
  register,
}: {
  field: FormField;
  register: UseFormRegister<DynamicFormValues>;
}) {
  const id = `f-${field.key}`;
  const options = field.options?.filter((o) => o.trim() !== "") ?? [];

  switch (field.type) {
    case "textarea":
      return <textarea id={id} rows={4} {...register(field.key)} />;

    case "date":
      return <input id={id} type="date" {...register(field.key)} />;

    case "select":
      return (
        <select id={id} defaultValue="" {...register(field.key)}>
          <option value="" disabled>
            — เลือก —
          </option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );

    case "radio":
      return (
        <div className="radio-group" role="radiogroup" aria-labelledby={id}>
          {options.map((option) => (
            <label key={option} className="radio">
              {/* ทุกปุ่มใน group ใช้ register(key) ตัวเดียวกัน RHF จะ bind ด้วย name ให้เอง */}
              <input type="radio" value={option} {...register(field.key)} />
              {option}
            </label>
          ))}
          {options.length === 0 && <span className="hint">ยังไม่ได้ตั้ง option</span>}
        </div>
      );

    case "checkbox":
      return (
        <div className="radio-group" role="group" aria-labelledby={id}>
          {options.map((option) => (
            <label key={option} className="radio">
              {/* หลายช่องใช้ register(key) ตัวเดียวกัน RHF จะสะสมค่าที่ติ๊กเป็น array ให้เอง */}
              <input type="checkbox" value={option} {...register(field.key)} />
              {option}
            </label>
          ))}
          {options.length === 0 && <span className="hint">ยังไม่ได้ตั้ง option</span>}
        </div>
      );

    case "text":
    default:
      return <input id={id} type="text" {...register(field.key)} />;
  }
}
