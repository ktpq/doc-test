# doc-test — Word template → dynamic form → merge กลับเป็น .docx / PDF

เดโมแยกสำหรับทดสอบ flow เดียวก่อนเอาไปต่อยอดในระบบติดตามสหกิจศึกษาจริง

```
.docx ที่มี {key}  →  scan placeholder  →  ตั้งค่าฟอร์ม  →  นักศึกษากรอก  →  merge  →  ดู PDF / โหลด .docx
```

ไม่มี authentication และไม่มีฐานข้อมูลจริง — เก็บลง `.runtime/db.json` กับ `.runtime/templates/*.docx`

> อยากรู้ว่าข้างในทำงานยังไง หรือจะเตรียมไฟล์ Word เอง → อ่าน [FLOW.md](FLOW.md)

## วิธีรัน

```bash
npm install
npm run sample     # สร้าง public/sample-template.docx (ฟอนต์ TH SarabunPSK 16pt)
npm run dev        # http://localhost:3000
```

เปิด `http://localhost:3000` แล้วไล่ตามลำดับ

| | หน้า | ทำอะไร |
|---|---|---|
| 1 | `/admin/upload` | อัพโหลด `sample-template.docx` → เห็น 22 ฟิลด์ (จาก 25 placeholder — ช่องติ๊กถูกยุบ) |
| 2 | `/admin/build-form?templateId=…` | ตั้ง label / ประเภทฟิลด์ / option แล้วกด **บันทึกฟอร์ม** |
| 3 | `/student/fill?templateId=…` | กรอกแล้วกด **ส่งคำตอบ** (กด submit ทั้งที่ว่างเพื่อดู validation ก่อนได้) |
| 4 | `/admin/view/<submissionId>` | **เปิด PDF ในแท็บใหม่** หรือ **ดาวน์โหลด .docx** |

หน้าแรก `/` รวมลิสต์ template และ submission ทั้งหมดไว้ให้กดเข้าทุกขั้น

### ทดสอบอัตโนมัติ

```bash
npm run dev      # terminal 1
npm run smoke    # terminal 2
```

ยิง API ครบทุกขั้นแล้ว assert ผลลัพธ์ — เซฟไฟล์ไว้ที่ `.runtime/smoke-output.docx` กับ
`.runtime/smoke-output.pdf`

ชี้ไปที่ไฟล์/พอร์ตอื่นได้: `BASE_URL=http://localhost:3123 TEMPLATE=./ของจริง.docx npm run smoke`

### ตัวแปรที่ตั้งได้

| env | ค่าเริ่มต้น | ทำอะไร |
|---|---|---|
| `DEMO_DATA_DIR` | `.runtime/` | ที่เก็บ `db.json` และไฟล์ template |
| `SOFFICE_PATH` | หาเอง | ชี้ตัว LibreOffice เองสำหรับแปลง PDF |
| `CHECKBOX_CHECKED` | `þ` | สัญลักษณ์กล่องที่ติ๊กแล้ว (Wingdings) |
| `CHECKBOX_UNCHECKED` | `o` | สัญลักษณ์กล่องว่าง |

## แชร์ให้เพื่อนลองใช้

ใช้ Cloudflare Tunnel ชี้มาที่เครื่องตัวเอง — ได้ลิงก์ https ทันที ไม่ต้อง deploy และใช้ได้ครบ
รวมถึงปุ่ม PDF (เพราะตัวแปลงคือ Word บนเครื่องเรา)

```bash
npm run preview    # terminal 1 — build แล้ว start แบบ production
npm run share      # terminal 2 — ได้ลิงก์ https://xxxx.trycloudflare.com
```

ส่งลิงก์ที่ `npm run share` พิมพ์ออกมาให้เพื่อนได้เลย เพื่อนกด "โหลดไฟล์ตัวอย่าง" ในหน้า
`/admin/upload` เพื่อเอา `sample-template.docx` ไปลองอัพโหลดได้โดยไม่ต้องมีไฟล์ของตัวเอง

ใช้ `npm run preview` (production) แทน `npm run dev` เพราะเร็วกว่าและไม่ติดเรื่อง dev origin
— ถ้าจำเป็นต้องเปิด tunnel ชี้ไปที่ `npm run dev` จริงๆ `allowedDevOrigins` ใน
[`next.config.ts`](next.config.ts) อนุญาต `*.trycloudflare.com` ไว้ให้แล้ว

### ปิด

กด **Ctrl+C** ในแต่ละ terminal — ปิด terminal ที่รัน `npm run share` เมื่อไหร่ลิงก์ตายทันที

ถ้า Ctrl+C แล้วยังค้าง (เกิดได้ถ้าปิดหน้าต่างทิ้งเฉยๆ) สั่งเก็บกวาดด้วย PowerShell:

```powershell
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like '*next*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Get-Process WINWORD -ErrorAction SilentlyContinue | Stop-Process -Force
```

บรรทัด WINWORD มีไว้เพราะถ้าปิดเซิร์ฟเวอร์ตอนมีคนกำลังกดปุ่ม PDF พอดี จะเหลือ Word ค้าง
เป็น process ที่มองไม่เห็น

### ข้อควรรู้

- **ลิงก์เปลี่ยนชื่อทุกครั้ง** ที่รัน `npm run share` ใหม่ (quick tunnel สุ่มชื่อให้) ต้องส่งลิงก์ใหม่เสมอ
- เครื่องต้องเปิดค้างไว้ตลอดช่วงที่ให้เพื่อนลอง
- **ลิงก์นี้ไม่มีรหัสผ่าน** ใครได้ลิงก์ไปก็อัพโหลด .docx เข้าเครื่องเราและสั่งให้ Word
  ทำงานได้ — ใช้แค่ช่วงสั้นๆ แล้วปิด อย่าปล่อยค้างไว้
- ข้อมูลอยู่ใน `.runtime/` บนเครื่องเรา เพื่อนทุกคนจึงเห็น template และ submission ชุดเดียวกัน
  อยากเริ่มสะอาดก่อนโชว์ให้ลบทิ้งก่อน: `Remove-Item -Recurse -Force .runtime`

### ทำไมไม่ deploy ขึ้น Vercel

ขึ้นได้แต่ใช้งานไม่ได้จริง ติด 2 เรื่อง

1. **เขียนไฟล์ไม่ได้** — [`src/lib/db.ts`](src/lib/db.ts) เขียนลงดิสก์ แต่ filesystem ของ
   Vercel Function เป็น read-only ยกเว้น `/tmp` ซึ่ง ephemeral และไม่ share ข้าม instance
   → อัพโหลดพังตั้งแต่ `fs.mkdir` และต่อให้ชี้ไป `/tmp` ข้อมูลก็หายทุก cold start
2. **ไม่มีตัวแปลง PDF** — ไม่มีทั้ง LibreOffice และ Word → `/pdf` ตอบ 503 ตลอด

ถ้าจะ deploy จริงต้องเลือกทางใดทางหนึ่ง — ย้าย storage ไป Vercel Blob + Postgres แล้วหา
ตัวแปลง PDF ภายนอก หรือทำ Dockerfile ที่มี LibreOffice + ฟอนต์ไทยแล้วขึ้น Railway/Render
(ทางหลังใกล้กับ `cwie-tracking` ที่ใช้ docker-compose อยู่แล้วมากกว่า)
