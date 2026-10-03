# FLOW — หลักการทำงานทั้งหมด

เอกสารนี้อธิบายว่าระบบทำงานยังไงตั้งแต่ไฟล์ Word จนถึง PDF ที่ออกมา ใครจะเอาโค้ดไปใส่
`cwie-tracking` หรือจะเตรียมไฟล์ Word เองอ่านตรงนี้

- [ภาพรวม](#ภาพรวม)
- [library ที่ใช้ และหน้าที่ของแต่ละตัว](#library-ที่ใช้-และหน้าที่ของแต่ละตัว)
- [Step 1 — อัพโหลดและ scan](#step-1--อัพโหลดและ-scan)
- [Step 2 — ตั้งค่าฟอร์ม](#step-2--ตั้งค่าฟอร์ม)
- [Step 3 — นักศึกษากรอก](#step-3--นักศึกษากรอก)
- [Step 4 — merge กลับเป็น .docx](#step-4--merge-กลับเป็น-docx)
- [Step 5 — แปลงเป็น PDF](#step-5--แปลงเป็น-pdf)
- [วิธีเตรียมไฟล์ Word](#วิธีเตรียมไฟล์-word)
- [ที่เก็บข้อมูล](#ที่เก็บข้อมูล)
- [สรุป API](#สรุป-api)
- [ข้อจำกัดที่รู้อยู่](#ข้อจำกัดที่รู้อยู่)

---

## ภาพรวม

```
  ไฟล์ .docx ที่มี {key}
        │
        │  [1] POST /api/templates
        │      scanPlaceholders()  →  ได้ลิสต์ key ดิบ 25 ตัว
        ▼
  TemplateRecord { keys: [...], fields: null }
        │
        │  [2] PUT /api/templates/:id/schema
        │      groupPlaceholders()  →  ยุบเหลือ 22 ฟิลด์
        │      แอดมินตั้ง label + type ของแต่ละฟิลด์
        ▼
  TemplateRecord { fields: [{key,label,type,options?}, ...] }
        │
        │  [3] POST /api/submissions
        │      buildZodSchema(fields)  →  validate ทั้ง client และ server
        ▼
  SubmissionRecord { answers: { student_name: "...", skills: ["ว่ายน้ำ"] } }
        │
        │  [4] GET /api/submissions/:id/docx
        │      expandAnswers() → renderDocx()
        ▼
  .docx ที่กรอกครบ
        │
        │  [5] GET /api/submissions/:id/pdf
        │      convertDocxToPdf()  (LibreOffice หรือ Word COM)
        ▼
  PDF เปิดดูในแท็บ
```

**หลักคิดสำคัญ** — เอกสารเป็นเจ้าของ "ว่ามีช่องอะไรบ้าง" ไม่ใช่โค้ด ระบบอ่านจากไฟล์ Word
แล้วสร้างฟอร์มตาม ไม่มี key ไหนถูก hardcode ไว้ในโค้ดเลยสักตัว

---

## library ที่ใช้ และหน้าที่ของแต่ละตัว

| library | ใช้ทำอะไร | อยู่ที่ไหน |
|---|---|---|
| **pizzip** | .docx คือไฟล์ zip — pizzip เปิด/ปิด zip ให้ | [`src/lib/docx.ts`](src/lib/docx.ts), [`scripts/make-sample-template.mjs`](scripts/make-sample-template.mjs) |
| **docxtemplater** | อ่านข้อความทั้งไฟล์ (`getFullText`) และแทนค่า `{key}` (`render`) | [`src/lib/docx.ts`](src/lib/docx.ts) |
| **zod** | สร้าง validation schema ตอน runtime จาก field list | [`src/lib/form-schema.ts`](src/lib/form-schema.ts) |
| **react-hook-form** | เก็บค่าในฟอร์ม + แสดง error | [`src/components/DynamicForm.tsx`](src/components/DynamicForm.tsx) |
| **@hookform/resolvers** | เชื่อม zod เข้ากับ react-hook-form | เดียวกัน |
| **Next.js 16 (App Router)** | หน้าเว็บ + API route ในโปรเจกต์เดียว | `src/app/` |

ทุกอย่างที่แตะ .docx อยู่ฝั่ง Node เท่านั้น — route handler ทุกตัวประกาศ
`export const runtime = "nodejs"` เพราะ Edge runtime ไม่มี `fs` และรัน pizzip ไม่ได้

### ไฟล์ใน `src/lib/`

| ไฟล์ | หน้าที่ | ฝั่งไหน |
|---|---|---|
| [`docx.ts`](src/lib/docx.ts) | `scanPlaceholders()` · `renderDocx()` — ทุกอย่างที่ต้องเปิดไฟล์ zip | server เท่านั้น |
| [`placeholders.ts`](src/lib/placeholders.ts) | `groupPlaceholders()` · `expandAnswers()` — ตรรกะ `{key=value}` ล้วนๆ | ทั้งสองฝั่ง |
| [`form-schema.ts`](src/lib/form-schema.ts) | `buildZodSchema()` · `buildDefaultValues()` | ทั้งสองฝั่ง |
| [`db.ts`](src/lib/db.ts) | อ่าน/เขียน `.runtime/db.json` | server เท่านั้น |
| [`pdf.ts`](src/lib/pdf.ts) | `convertDocxToPdf()` | server เท่านั้น |
| [`types.ts`](src/lib/types.ts) | นิยาม type ทั้งหมด | ทั้งสองฝั่ง |

> **ทำไมต้องแยก `placeholders.ts` ออกจาก `docx.ts`** — หน้า build-form เป็น client component
> และต้องใช้ `groupPlaceholders()` ถ้าอยู่รวมใน `docx.ts` จะลาก pizzip + docxtemplater
> เข้าไปใน bundle ของเบราว์เซอร์ทั้งก้อน แยกไว้แล้วตรรกะส่วนนี้เป็น TypeScript เปล่าๆ

---

## Step 1 — อัพโหลดและ scan

**ไฟล์:** [`src/app/api/templates/route.ts`](src/app/api/templates/route.ts) → `scanPlaceholders()` ใน [`src/lib/docx.ts`](src/lib/docx.ts)

### 1.1 เปิดไฟล์

```ts
const zip = new PizZip(buffer);
const doc = new Docxtemplater(zip, {
  paragraphLoop: true,
  linebreaks: true,
  delimiters: { start: "{", end: "}" },
});
```

constructor ของ docxtemplater **compile template ทันที** ไม่ได้รอตอน render ถ้าไฟล์มี
`{` ค้างหรือ tag ซ้อนกัน มันจะ throw ตรงนี้เลย

### 1.2 ดึงข้อความด้วย `getFullText()` ก่อน — นี่คือจุดสำคัญที่สุด

Word ชอบตัดคำเดียวออกเป็นหลาย `<w:t>` run โดยที่เราไม่รู้ตัว แค่เผลอกด Ctrl+Z
หรือเปลี่ยน format กลางคำก็เกิดได้ `{student_name}` จึงอาจถูกเก็บในไฟล์แบบนี้

```xml
<w:r><w:t>{stud</w:t></w:r>
<w:r><w:t>ent_na</w:t></w:r>
<w:r><w:t>me}</w:t></w:r>
```

ถ้า regex ลง XML ตรงๆ จะ **หาไม่เจอ** แต่ `getFullText()` เชื่อม run กลับให้ก่อน จึงได้
`{student_name}` เต็มคำ — `sample-template.docx` จงใจแตก key นี้เป็น 3 run ไว้เป็นตัวทดสอบ

### 1.3 อ่าน header/footer ด้วย

`getFullText()` เปล่าๆ อ่านแค่ `word/document.xml` ถ้าแบบฟอร์มมี placeholder ในหัวหรือ
ท้ายกระดาษจะพลาด เลยวนอ่านทุก part ที่ชื่อตรงกับ `word/header*.xml` / `word/footer*.xml`

### 1.4 regex หา key

```ts
/\{([^{}]+)\}/g
```

แล้วกรองทิ้ง:

- ขึ้นต้นด้วย `# / ^ > @ % ! - =` → เป็น control tag ของ docxtemplater ไม่ใช่ช่องกรอก
- มี `.` หรือ `[` → ชนกับ field-path notation ของ react-hook-form (`a.b` จะกลายเป็น object ซ้อน)

สุดท้าย dedupe โดยคงลำดับที่ปรากฏในเอกสาร เพื่อให้ฟอร์มเรียงเหมือนในกระดาษ

### 1.5 ถ้า compile ไม่ผ่าน — fallback

`catch` แล้วอ่าน `word/document.xml` ดิบ ถอด XML tag ออกแล้ว regex แบบ best-effort
พร้อมรายงาน `scanSource: "rawXml"` กลับไป หน้า upload จะขึ้นคำเตือนสีแดงว่า
**ตอน merge จะ error แน่** ให้ไปแก้ในเอกสารก่อน (ปกติเกิดจากมี `{` หรือ `}` ลอยๆ)

### 1.6 เซฟ

เซฟไฟล์ลง `.runtime/templates/<uuid>.docx` และบันทึก record

```ts
{ id, originalName, filename, keys: string[], scanSource, fields: null, createdAt }
```

`fields: null` แปลว่ายังไม่ได้ตั้งค่าฟอร์ม

### ตารางไม่ต้องทำอะไรเพิ่ม

เซลล์ตารางใน OOXML คือ `<w:tc><w:p><w:r><w:t>` — มี `w:t` เหมือนย่อหน้าธรรมดา
`getFullText()` จึงเก็บมาให้อยู่แล้ว **ใส่ `{key}` ลงในช่องได้เลย**

---

## Step 2 — ตั้งค่าฟอร์ม

**ไฟล์:** [`src/app/admin/build-form/FormBuilder.tsx`](src/app/admin/build-form/FormBuilder.tsx) → `groupPlaceholders()` ใน [`src/lib/placeholders.ts`](src/lib/placeholders.ts)

### 2.1 ยุบช่องติ๊ก

key ดิบที่ scan ได้มีทั้งแบบธรรมดาและแบบ `{key=value}` ปนกัน

```
student_name        →  ฟิลด์ธรรมดา
has_license=มี      ┐
has_license=ไม่มี    ┘  →  ฟิลด์เดียวชื่อ has_license มี option ["มี", "ไม่มี"]
```

`groupPlaceholders()` แยกที่ `=` ตัวแรก แล้วรวม key ที่ base เหมือนกันเข้าด้วยกัน คืนเป็น

```ts
type Placeholder =
  | { kind: "plain";  key: string }
  | { kind: "choice"; key: string; values: string[]; rawKeys: string[] };
```

ใน sample: **25 placeholder ดิบ → 22 ฟิลด์**

### 2.2 แอดมินตั้งค่า

- `plain` → เลือก type ได้ทั้ง 6 แบบ (`text` `textarea` `radio` `select` `date` `checkbox`)
  ถ้าเลือก radio/select/checkbox ต้องพิมพ์ option เอง
- `choice` → เลือกได้แค่ `radio` (ค่าเดียว) กับ `checkbox` (หลายค่า)
  และ **option ถูกล็อกตามที่อ่านมาจากเอกสาร** แก้ในหน้าเว็บไม่ได้ เพราะต้องตรงกับ
  `{key=value}` ที่อยู่ในไฟล์เป๊ะๆ ถ้าจะเปลี่ยนต้องไปแก้ที่ไฟล์ Word

### 2.3 บันทึก

`PUT /api/templates/:id/schema` ตรวจว่าทุก key ที่ส่งมาอยู่ในรายการ **base key** จริง
(เทียบกับผลของ `groupPlaceholders` ไม่ใช่ `keys` ดิบ) แล้วเก็บลง `fields`

---

## Step 3 — นักศึกษากรอก

**ไฟล์:** [`src/components/DynamicForm.tsx`](src/components/DynamicForm.tsx) + [`src/lib/form-schema.ts`](src/lib/form-schema.ts)

### 3.1 สร้าง zod schema ตอน runtime

```ts
export function buildZodSchema(fields: FormField[]) {
  const shape: Record<string, z.ZodType<AnswerValue>> = {};
  for (const field of fields) {
    switch (field.type) {
      case "checkbox": shape[field.key] = z.array(item).min(1, ...); break;
      case "radio":
      case "select":  shape[field.key] = z.enum(field.options); break;
      case "date":    shape[field.key] = z.string().regex(/^\d{4}-\d{2}-\d{2}$/); break;
      default:        shape[field.key] = z.string().trim().min(1, ...);
    }
  }
  return z.object(shape);   // ← ประกอบจาก field list ล้วน
}
```

ข้อควรระวังที่เจอจริง:

- `z.enum()` ต้องการ tuple ที่ไม่ว่าง ถ้า option ว่างจะพังตอนสร้าง schema เลยต้อง fallback
  เป็น `z.string().min(1)`
- `buildDefaultValues()` ต้องคืน `[]` ให้ `checkbox` และ `""` ให้ที่เหลือ ไม่งั้น
  react-hook-form จะไม่สะสมค่าเป็น array

### 3.2 render ฟอร์ม

วน `fields.map()` แล้วสลับ markup ตาม `type` จุดที่น่าสนใจคือ radio กับ checkbox —
ทุกช่องในกลุ่มใช้ `register(field.key)` **ตัวเดียวกัน** react-hook-form จะ bind ด้วย `name`
ให้เอง และคืน checkbox ที่ติ๊กมาเป็น array อัตโนมัติ

```tsx
{options.map((option) => (
  <label key={option}>
    <input type="checkbox" value={option} {...register(field.key)} />
    {option}
  </label>
))}
```

### 3.3 validate สองชั้น

schema ตัวเดียวกันถูกใช้ทั้ง

1. ฝั่ง client เป็น `resolver` ของ react-hook-form (ขึ้น error ทันทีใต้ช่อง)
2. ฝั่ง server ใน [`POST /api/submissions`](src/app/api/submissions/route.ts) ก่อนเก็บ

เพราะ client validation ข้ามได้ด้วย curl — เลยสร้าง schema ใหม่จาก `template.fields`
แล้ว `safeParse` ซ้ำเสมอ ของที่เก็บลง db คือผลจาก `parsed.data` ไม่ใช่ body ดิบ

---

## Step 4 — merge กลับเป็น .docx

**ไฟล์:** [`src/app/api/submissions/[submissionId]/docx/route.ts`](src/app/api/submissions/%5BsubmissionId%5D/docx/route.ts) → `renderDocx()`

### 4.1 ขยายคำตอบ

`answers` มีแค่ `has_license: "มี"` แต่เอกสารมี `{has_license=มี}` กับ `{has_license=ไม่มี}`
สองจุด `expandAnswers()` จึงวน template key ทุกตัวแล้วเติมสัญลักษณ์ให้

```ts
answers = { student_name: "สมชาย", has_license: "มี", skills: ["ว่ายน้ำ", "ขับรถ"] }
          ↓ expandAnswers(templateKeys, answers, symbols)
data = {
  student_name: "สมชาย",
  "has_license=มี": "þ",        // เลือก      → กล่องติ๊ก
  "has_license=ไม่มี": "o",      // ไม่ได้เลือก → กล่องว่าง
  "skills=ว่ายน้ำ": "þ",
  "skills=ขับรถ": "þ",
  "skills=ภาษาอังกฤษ": "o",
}
```

คำตอบที่เป็น array และไม่ใช่ช่องติ๊กจะถูก `join(", ")` ให้เป็นข้อความ

### 4.2 render

```ts
const doc = new Docxtemplater(zip, { ...opts, nullGetter: () => "" });
doc.render(data);
return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
```

`nullGetter: () => ""` สำคัญ — ถ้าไม่ใส่ key ที่ไม่มีคำตอบจะกลายเป็นคำว่า `undefined`
โผล่กลางเอกสาร

### 4.3 แปลง error ให้อ่านรู้เรื่อง

docxtemplater โยน `"Multi error"` ซึ่ง debug ไม่ได้เลย โค้ดจึงแกะ
`error.properties.errors[].properties.explanation` ออกมาเป็น `DocxRenderError`
แล้วส่งกลับเป็น JSON เช่น

```json
{ "error": "merge ไฟล์ .docx ไม่สำเร็จ",
  "details": ["The tag beginning with \"{ ที่ปิดไม่ครบ\" is unclosed"] }
```

### 4.4 ส่งไฟล์

```
Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
Content-Disposition: attachment; filename="document-xxxx.docx"; filename*=UTF-8''<urlencoded ชื่อไทย>
```

`filename*` คือตัวที่ถือชื่อภาษาไทยจริง ส่วน `filename` เป็น ASCII ไว้ให้ client เก่าๆ
และ body ต้องส่งเป็น `new Uint8Array(buf)` ไม่ใช่ `Buffer` ตรงๆ เพราะ type ของ `BodyInit`

---

## Step 5 — แปลงเป็น PDF

**ไฟล์:** [`src/lib/pdf.ts`](src/lib/pdf.ts) + [`scripts/docx-to-pdf.ps1`](scripts/docx-to-pdf.ps1)

### 5.1 เลือกตัวแปลง (ทำครั้งเดียวแล้ว cache)

1. **LibreOffice** — ไล่หาจาก `SOFFICE_PATH` → path มาตรฐานของแต่ละ OS → `where`/`which`
2. **Microsoft Word COM** — fallback บน Windows ผ่านสคริปต์ PowerShell
3. ไม่เจอเลย → `PdfConvertError` และหน้า view จะ disable ปุ่ม PDF พร้อมบอกวิธีแก้

LibreOffice มาก่อนเพราะรันใน Docker ได้ ซึ่งเป็นทางที่ระบบจริงต้องไป

### 5.2 แปลงทีละไฟล์

ทั้ง Word COM และ soffice headless รันขนานกันไม่ได้ (Word พังเมื่อเปิดหลาย Documents,
soffice ชน user profile lock) โค้ดจึงต่อคิวผ่าน promise chain เส้นเดียว

เขียน .docx ลง temp dir → เรียกตัวแปลง → อ่าน .pdf → ลบ temp dir ใน `finally`

### 5.3 ส่งแบบ inline

```
Content-Type: application/pdf
Content-Disposition: inline; ...
```

`inline` คือสิ่งที่ทำให้เบราว์เซอร์**เปิดดูในแท็บ** แทนที่จะเด้ง save dialog

route นี้ถูกเปิดตรงๆ ในแท็บใหม่ ไม่ได้เรียกผ่าน fetch เวลาพังจึงดู `Accept` header แล้ว
ตอบเป็น **หน้า HTML** ให้อ่านรู้เรื่อง (ตอบ JSON เฉพาะตอนถูกเรียกด้วย fetch)

### 5.4 เรื่องฟอนต์ที่ต้องรู้

**ฟอนต์ต้องติดตั้งบนเครื่องที่รันตัวแปลง ไม่ใช่แค่ฝังใน .docx** ถ้า PDF ออกมาเป็นฟอนต์อื่น
แปลว่าเครื่องนั้นไม่มี TH SarabunPSK

ใน Docker ต้อง

```dockerfile
COPY fonts/THSarabunPSK*.ttf /usr/share/fonts/truetype/thai/
RUN fc-cache -f
```

ตรวจว่าสำเร็จได้จากการดูฟอนต์ที่ฝังใน PDF — `npm run smoke` พิมพ์ออกมาให้ ควรเห็น
`ABCDEE+THSarabunPSK` และ `ABCDEE+Wingdings-Regular`

---

## วิธีเตรียมไฟล์ Word

### กฎพื้นฐาน

| ต้องการ | เขียนในเอกสารว่า |
|---|---|
| ช่องกรอกข้อความ / วันที่ / ดรอปดาวน์ | `{student_name}` |
| ช่องในตาราง | `{edu_lower_gpa}` (ใส่ในเซลล์เลย) |
| ช่องติ๊กถูก | `{has_license=มี}` และ `{has_license=ไม่มี}` |
| ข้อความที่ไม่ต้องให้กรอก | พิมพ์ไปตามปกติ ไม่ต้องใส่อะไร |

**ชื่อ key**

- ใช้ `a-z 0-9 _` จะปลอดภัยที่สุด
- **ห้ามมี `.` หรือ `[`** — ชนกับ field-path notation ของ react-hook-form
- **`=` เป็นอักขระสงวน** — ใส่ใน key ธรรมดาไม่ได้ จะถูกตีความเป็นช่องติ๊กทันที
- ห้ามมี `{` หรือ `}` ลอยๆ ในเอกสารที่ไม่ใช่ placeholder ไม่งั้น docxtemplater compile ไม่ผ่าน

### ช่องกรอกธรรมดา

พิมพ์ `{company_name}` ลงไปตรงที่ต้องการเลย ไม่ต้องตั้ง format อะไรพิเศษ

### ตาราง

สร้างตารางปกติใน Word แล้วใส่ `{key}` ในช่องที่อยากให้กรอก ช่องไหนที่มีค่าตายตัวอยู่แล้ว
(เช่นชื่อสถาบัน) ปล่อยไว้ merge แล้วไม่ถูกแตะ

```
┌────────────────────┬──────────────┬──────────────────────────────────┬─────────────────────┐
│ ระดับการศึกษา       │ ปีที่จบ        │ สถานศึกษา                          │ เกรดเฉลี่ย            │
├────────────────────┼──────────────┼──────────────────────────────────┼─────────────────────┤
│ มัธยมศึกษาตอนต้น     │ {edu_lower_  │ {edu_lower_school}               │ {edu_lower_gpa}     │
│                    │  year}       │                                  │                     │
├────────────────────┼──────────────┼──────────────────────────────────┼─────────────────────┤
│ ปริญญาตรี           │ {edu_bachel  │ สจล. ← พิมพ์ไว้ตายตัว ไม่มี placeholder │ {edu_bachelor_gpa}  │
│                    │  or_year}    │                                  │                     │
└────────────────────┴──────────────┴──────────────────────────────────┴─────────────────────┘
```

> รองรับเฉพาะ**ตารางที่จำนวนแถวตายตัว** ถ้าต้องการตารางที่เพิ่มแถวได้ (ประวัติการทำงาน
> ที่แต่ละคนไม่เท่ากัน) ต้องทำ repeating group เพิ่ม — ใช้ `{#rows}…{/rows}` ของ
> docxtemplater คู่กับ `useFieldArray` ของ react-hook-form

### ช่องติ๊กถูก — ขั้นตอนใน Word

เป้าหมาย: ใน `8. ใบขับขี่รถยนต์  ☐ มี  ☐ ไม่มี` ให้แทนที่กล่อง ☐ แต่ละอันด้วย placeholder

1. **ลบกล่อง ☐ เดิมออก** แล้วพิมพ์ `{has_license=มี}` แทนที่ (ฟอนต์ปกติ จะได้อ่านออก)
2. ทำกับกล่องที่สองเป็น `{has_license=ไม่มี}` — **ใช้ชื่อ key เดียวกัน** นี่คือสิ่งที่ทำให้
   ระบบรู้ว่าสองกล่องนี้เป็นคำถามเดียวกัน
3. พิมพ์ให้ครบทั้งเอกสารก่อน แล้วค่อยทำขั้นสุดท้าย
4. **เลือกเฉพาะส่วน `{...}`** (ไม่รวมคำว่า "มี" ที่อยู่ข้างๆ) → เปลี่ยนฟอนต์เป็น **Wingdings**
5. ตอนนี้มันจะดูเป็นสัญลักษณ์มั่วๆ — **ถูกแล้ว** ข้างในยังเป็นข้อความเดิม
6. เซฟ แล้วอัพโหลดได้เลย

ได้ผลลัพธ์เป็น

```
ก่อน merge:  8. ใบขับขี่รถยนต์   {has_license=มี} มี   {has_license=ไม่มี} ไม่มี
ตอบ "มี"  →  8. ใบขับขี่รถยนต์   ☑ มี                  ☐ ไม่มี
```

**เลือกได้หลายข้อ** ก็เขียนแบบเดียวกัน แค่มีหลายค่า แล้วตั้ง type เป็น `checkbox`
ตอน build-form

```
ความสามารถพิเศษ  {skills=ว่ายน้ำ} ว่ายน้ำ  {skills=ขับรถ} ขับรถ  {skills=ภาษาอังกฤษ} ภาษาอังกฤษ
```

#### ทำไมต้อง Wingdings

ตรวจ cmap ของ `THSarabunPSK.ttf` แล้วพบว่า **ไม่มี glyph ☐ ☑ ☒ ✓ เลยสักตัว**
ถ้าใส่ ☑ ลงไปตรงๆ Word จะ fallback ไปฟอนต์อื่นให้อัตโนมัติ ขนาดกับ baseline จะเพี้ยนจาก
ข้อความรอบๆ ส่วน Wingdings มีครบ

| ตัวอักษร | ใน Wingdings |
|---|---|
| `o` | ☐ กล่องว่าง |
| `þ` | ☑ กล่องติ๊กถูก |
| `ý` | ☒ กล่องกากบาท |

ไม่อยากใช้ Wingdings ก็สลับได้ด้วย env ไม่ต้องแก้โค้ด

```bash
CHECKBOX_CHECKED=☑ CHECKBOX_UNCHECKED=☐ npm run dev
CHECKBOX_CHECKED=X CHECKBOX_UNCHECKED=" " npm run dev   # สำหรับ template ที่พิมพ์ [ ] ไว้
```

### ตรวจไฟล์ก่อนใช้จริง

อัพโหลดที่ `/admin/upload` แล้วดู

- ขึ้น `scanSource: rawXml` สีแดง → ไฟล์มี `{` หรือ `}` ลอยๆ ต้องแก้ก่อน ไม่งั้น merge จะพัง
- key หายไปบางตัว → ตรวจว่าสะกดถูกและไม่มี `.` หรือ `[`
- ช่องติ๊กไม่ยุบเป็นฟิลด์เดียว → ชื่อ key สองฝั่งไม่ตรงกัน (ระวังช่องว่างหลงเข้ามา)
- merge แล้วได้ตัวอักษร `þ` แทนกล่อง → run นั้นยังไม่ได้เป็น Wingdings กลับไปทำขั้นตอนที่ 4

หรือจะเทสด้วยสคริปต์ก็ได้

```bash
TEMPLATE=./ไฟล์จริงของคุณ.docx npm run smoke
```

---

## ที่เก็บข้อมูล

**ไฟล์:** [`src/lib/db.ts`](src/lib/db.ts)

```
.runtime/
  db.json                  { templates: [...], submissions: [...] }
  templates/<uuid>.docx    ไฟล์ต้นฉบับที่อัพโหลดมา
```

เปลี่ยนที่เก็บด้วย env `DEMO_DATA_DIR` ค่าเริ่มต้นคือ `.runtime/` ที่ root ของโปรเจกต์
— จงใจไม่วางใต้ `src/` หรือ `public/` เพราะ dev watcher ของ Next จะ reload ทุกครั้งที่มีคนกด submit

สองอย่างที่ใส่ไว้กันพัง

- **เขียนแบบ atomic** — เขียนลงไฟล์ `.tmp` ก่อนแล้ว `rename` ทับ กัน `db.json` พังถ้า
  process ตายกลางคัน
- **คิวการเขียน** — read-modify-write ทั้งไฟล์ ถ้าสองคำขอทำพร้อมกันอันหลังจะทับอันแรกหาย
  จึงต่อคิวผ่าน promise chain เส้นเดียว

> **ไม่เหมาะกับ production** — เป็น single-process เท่านั้น ของจริงต้องย้ายไป Postgres
> ที่ `cwie-tracking` มีอยู่แล้ว

---

## สรุป API

| method | path | ทำอะไร |
|---|---|---|
| `GET` | `/api/templates` | ลิสต์ template ทั้งหมด |
| `POST` | `/api/templates` | อัพโหลด .docx (multipart, field ชื่อ `file`) + scan |
| `GET` | `/api/templates/:id` | ดู template ตัวเดียว |
| `PUT` | `/api/templates/:id/schema` | บันทึก field schema |
| `GET` | `/api/submissions` | ลิสต์คำตอบทั้งหมด |
| `POST` | `/api/submissions` | ส่งคำตอบ (validate ด้วย zod ซ้ำ) |
| `GET` | `/api/submissions/:id` | ดูคำตอบ + template ที่ผูกอยู่ |
| `GET` | `/api/submissions/:id/docx` | merge → ดาวน์โหลด .docx |
| `GET` | `/api/submissions/:id/pdf` | merge → แปลง → เปิด PDF ในแท็บ |

ทุก route ประกาศ `export const runtime = "nodejs"` และ route PDF ตั้ง `maxDuration = 120`
เพราะการแปลงใช้เวลาหลายวินาที

---

## ข้อจำกัดที่รู้อยู่

| เรื่อง | รายละเอียด |
|---|---|
| ตารางเพิ่มแถวไม่ได้ | รองรับเฉพาะแถวตายตัว ต้องทำ repeating group เพิ่มถ้าจะใช้ |
| ทุกช่องบังคับกรอก | `FormField` ไม่มี flag `required` ตามสัญญาเดิม `{key, label, type, options?}` |
| `=` เป็นอักขระสงวน | placeholder ธรรมดาใส่ `=` ไม่ได้ |
| key ห้ามมี `.` / `[` | ชนกับ field-path notation ของ react-hook-form |
| db เป็นไฟล์ JSON | single-process เท่านั้น ของจริงต้องใช้ฐานข้อมูล |
| Word COM ไปต่อใน Docker ไม่ได้ | ระบบจริงต้องติดตั้ง LibreOffice — `pdf.ts` สลับให้เองไม่ต้องแก้โค้ด |
| ฟอนต์ไทยต้องอยู่บน runtime | ไม่ใช่แค่ฝังใน .docx ไม่งั้น PDF จะเพี้ยน |
| ไม่มี auth | ใครเข้าถึง URL ได้ก็อัพโหลดและดูคำตอบของคนอื่นได้หมด |
