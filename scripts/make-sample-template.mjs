/**
 * สร้าง sample-template.docx สำหรับเทส flow — ประกอบ OOXML เองด้วย pizzip
 * (ไม่เพิ่ม dependency ใหม่ ใช้ตัวที่ docxtemplater ต้องใช้อยู่แล้ว)
 *
 * จุดสำคัญ: {ชื่อ-นามสกุล} ถูกจงใจแตกเป็น 3 <w:t> run เลียนแบบสิ่งที่ Word ทำจริง
 * ตอนมีการแก้ข้อความ/เปลี่ยน format กลางคำ — เป็นตัวพิสูจน์ว่า getFullText()
 * เชื่อม run กลับให้ก่อน regex จริง
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import PizZip from "pizzip";

// วางไว้ใน public/ เพื่อให้เปิดเว็บแล้วโหลดไฟล์ตัวอย่างไปลองอัพโหลดได้เลย
const outFile = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "sample-template.docx",
);

const FONT = "TH SarabunPSK";
// ฟอนต์ของ run ช่องติ๊ก — ต้องมีทั้ง ☐ ☑ และตัวอักษรปกติ เพื่อให้ template ยังอ่านออก
const SYMBOL_FONT = "Segoe UI Symbol";
const SIZE = 32; // half-point → 16pt ซึ่งเป็นขนาดมาตรฐานของเอกสารราชการไทย
const HEADING_SIZE = 36; // 18pt

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * rPr ชุดเดียวกันทุก run — ตั้ง cs (complex script) ด้วย ไม่งั้น Word จะใช้ฟอนต์อื่นกับตัวอักษรไทย
 *
 * symbol: true → ใช้ Segoe UI Symbol สำหรับ run ของช่องติ๊ก เพราะ TH SarabunPSK
 * ไม่มี glyph ☐ ☑ เลยสักตัว (ตรวจ cmap แล้ว) ส่วน Segoe UI Symbol มีครบ
 * และยัง "อ่านออก" ตอนแก้ template ด้วย ต่างจาก Wingdings ที่ทำให้ {ใบขับขี่=มี}
 * กลายเป็นสัญลักษณ์มั่วทั้งบรรทัด
 */
const rPr = ({ bold = false, size = SIZE, symbol = false } = {}) => {
  const font = symbol ? SYMBOL_FONT : FONT;
  return `<w:rPr>${bold ? "<w:b/><w:bCs/>" : ""}<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:lang w:bidi="th-TH"/></w:rPr>`;
};

/** <w:r> หนึ่งอัน; xml:space="preserve" จำเป็นไม่งั้น Word ตัดช่องว่างหัวท้ายทิ้ง */
const run = (text, opts = {}) =>
  `<w:r>${rPr(opts)}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;

/** run ของ placeholder ช่องติ๊ก — ฟอนต์ต้องมี glyph ☐ ☑ ไม่งั้น Word จะ fallback แล้วขนาดเพี้ยน */
const box = (placeholder) => run(placeholder, { symbol: true });

/** หนึ่งย่อหน้า จาก array ของ run */
const para = (runs, { align = "left", spaceAfter = 120 } = {}) =>
  `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:after="${spaceAfter}" w:line="276" w:lineRule="auto"/></w:pPr>${runs.join("")}</w:p>`;

const line = (label, placeholder) => para([run(label), run(placeholder)]);

/** หนึ่งเซลล์; เซลล์ต้องมี <w:p> อย่างน้อยหนึ่งอันเสมอ ไม่งั้น Word ฟ้องไฟล์เสีย */
const cell = (runs, width) =>
  `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${para(runs, { spaceAfter: 0 })}</w:tc>`;

const row = (cells) => `<w:tr>${cells.join("")}</w:tr>`;

const BORDERS = ["top", "left", "bottom", "right", "insideH", "insideV"]
  .map((side) => `<w:${side} w:val="single" w:sz="6" w:space="0" w:color="000000"/>`)
  .join("");

const table = (rows) =>
  `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${BORDERS}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>${rows.join("")}</w:tbl>`;

/** คอลัมน์ของตารางประวัติการศึกษา (หน่วย dxa, รวม ~9638 = ความกว้างหน้ากระดาษ A4 หักขอบ) */
const EDU_COLS = [1900, 1300, 3238, 2000, 1200];

const eduRow = (level, cells) =>
  row([
    cell([run(level)], EDU_COLS[0]),
    ...cells.map((runs, i) => cell(runs, EDU_COLS[i + 1])),
  ]);

const body = [
  para([run("แบบตอบรับนักศึกษาสหกิจศึกษา", { bold: true, size: HEADING_SIZE })], {
    align: "center",
    spaceAfter: 240,
  }),

  para([run("ส่วนที่ 1: ข้อมูลนักศึกษา", { bold: true })]),

  // ตรงนี้คือหัวใจ: {ชื่อ-นามสกุล} ถูกหั่นเป็น 3 run → regex ลง XML ดิบจะหาไม่เจอ
  para([run("ชื่อ-นามสกุล: "), run("{ชื่อ-"), run("นาม"), run("สกุล}")]),

  line("รหัสนักศึกษา: ", "{รหัสนักศึกษา}"),
  line("คณะ/สาขาวิชา: ", "{คณะ}"),

  para([run("ส่วนที่ 2: ข้อมูลสถานประกอบการ", { bold: true })]),
  line("ชื่อสถานประกอบการ: ", "{ชื่อสถานประกอบการ}"),
  line("ตำแหน่งงานที่ปฏิบัติ: ", "{ตำแหน่งงาน}"),
  line("ชื่อพนักงานที่ปรึกษา: ", "{ชื่อพนักงานที่ปรึกษา}"),
  line("ลักษณะงานที่มอบหมาย: ", "{ลักษณะงาน}"),

  para([run("ส่วนที่ 3: ระยะเวลาปฏิบัติงาน", { bold: true })]),
  line("วันเริ่มปฏิบัติงาน: ", "{วันเริ่มงาน}"),
  line("วันสิ้นสุดการปฏิบัติงาน: ", "{วันสิ้นสุดงาน}"),

  // ── ช่องติ๊กถูก ────────────────────────────────────────────────────
  // {key=value} หลายอันที่ base เดียวกันจะถูกยุบเป็นฟิลด์เดียวพร้อม option
  para([run("ส่วนที่ 4: ข้อมูลเพิ่มเติม", { bold: true })]),

  // เลือกได้ค่าเดียว → ตั้งเป็น radio ในหน้า build-form
  para([
    run("8. ใบขับขี่รถยนต์       "),
    box("{ใบขับขี่=มี}"),
    run(" มี        "),
    box("{ใบขับขี่=ไม่มี}"),
    run(" ไม่มี"),
  ]),

  // เลือกได้หลายค่า → ตั้งเป็น checkbox ในหน้า build-form
  para([
    run("9. ความสามารถพิเศษ   "),
    box("{ความสามารถพิเศษ=ว่ายน้ำ}"),
    run(" ว่ายน้ำ      "),
    box("{ความสามารถพิเศษ=ขับรถ}"),
    run(" ขับรถ      "),
    box("{ความสามารถพิเศษ=ภาษาอังกฤษ}"),
    run(" ภาษาอังกฤษ"),
  ]),

  // ── ตารางแถวตายตัว ────────────────────────────────────────────────
  // ไม่ต้องใช้ feature อะไรเพิ่ม getFullText() อ่าน <w:t> ในเซลล์เหมือนย่อหน้าทั่วไป
  para([run("ประวัติการศึกษา", { bold: true })], { spaceAfter: 60 }),

  table([
    row(
      ["ระดับการศึกษา", "ปีที่จบ", "สถานศึกษา", "วิชาเอก / สาขาวิชา", "เกรดเฉลี่ย"].map(
        (head, i) => cell([run(head, { bold: true })], EDU_COLS[i]),
      ),
    ),
    eduRow("มัธยมศึกษาตอนต้น", [
      [run("{มัธยมต้น_ปีที่จบ}")],
      [run("{มัธยมต้น_สถานศึกษา}")],
      [run("{มัธยมต้น_สาขาวิชา}")],
      [run("{มัธยมต้น_เกรดเฉลี่ย}")],
    ]),
    eduRow("มัธยมศึกษาตอนปลาย", [
      [run("{มัธยมปลาย_ปีที่จบ}")],
      [run("{มัธยมปลาย_สถานศึกษา}")],
      [run("{มัธยมปลาย_สาขาวิชา}")],
      [run("{มัธยมปลาย_เกรดเฉลี่ย}")],
    ]),
    eduRow("ปริญญาตรี", [
      [run("{ปริญญาตรี_ปีที่จบ}")],
      // ช่องนี้พิมพ์ค่าไว้ตายตัวเหมือนในฟอร์มจริง ไม่มี placeholder — merge แล้วต้องไม่ถูกแตะ
      [run("สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง")],
      [run("{ปริญญาตรี_สาขาวิชา}")],
      [run("{ปริญญาตรี_เกรดเฉลี่ย}")],
    ]),
  ]),

  para([run("ลงชื่อ ....................................... ผู้รับรอง")], {
    align: "right",
    spaceAfter: 0,
  }),
];

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`;

/** ตั้งฟอนต์เริ่มต้นของทั้งเอกสาร เผื่อย่อหน้าที่ไม่ได้ระบุ rPr เอง */
const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/><w:sz w:val="${SIZE}"/><w:szCs w:val="${SIZE}"/><w:lang w:val="th-TH" w:bidi="th-TH"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;

const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;

const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

const zip = new PizZip();
zip.file("[Content_Types].xml", contentTypesXml);
zip.file("_rels/.rels", rootRelsXml);
zip.file("word/_rels/document.xml.rels", docRelsXml);
zip.file("word/document.xml", documentXml);
zip.file("word/styles.xml", stylesXml);

writeFileSync(outFile, zip.generate({ type: "nodebuffer", compression: "DEFLATE" }));

console.log(`สร้างแล้ว: ${outFile}`);
console.log(`ฟอนต์: ${FONT} ${SIZE / 2}pt (ช่องติ๊กใช้ ${SYMBOL_FONT})`);
console.log();
console.log("placeholder ที่ควร scan เจอ:");
console.log("  ช่องกรอกธรรมดา 9 — ชื่อ-นามสกุล (ถูกแตกเป็น 3 run), รหัสนักศึกษา, คณะ,");
console.log("                     ชื่อสถานประกอบการ, ตำแหน่งงาน, ชื่อพนักงานที่ปรึกษา,");
console.log("                     ลักษณะงาน, วันเริ่มงาน, วันสิ้นสุดงาน");
console.log("  ในเซลล์ตาราง  11 — {มัธยมต้น,มัธยมปลาย}_{ปีที่จบ,สถานศึกษา,สาขาวิชา,เกรดเฉลี่ย}");
console.log("                     + ปริญญาตรี_{ปีที่จบ,สาขาวิชา,เกรดเฉลี่ย}");
console.log("                     (ป.ตรีไม่มี _สถานศึกษา เพราะพิมพ์ KMITL ไว้ตายตัว)");
console.log("  ช่องติ๊ก        2 — ใบขับขี่ (มี/ไม่มี), ความสามารถพิเศษ (ว่ายน้ำ/ขับรถ/ภาษาอังกฤษ)");
console.log();
console.log("รวม 25 placeholder ดิบ → ยุบเหลือ 22 ฟิลด์ในฟอร์ม");
