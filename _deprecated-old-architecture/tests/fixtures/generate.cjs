/* tests/fixtures/generate.cjs — synthetic Express reports at full scale.
 *
 * These carry the real SHAPE and the real COUNTS of the client's exports:
 * printed headings, repeated page headers, Buddhist-era dates, deposit notes,
 * malformed lines, Windows-874 encoding. They carry no real records: every
 * customer name is invented, there are no phone numbers and no remark text.
 *
 * Deterministic: a fixed seed, so a test failure is always reproducible.
 */
'use strict';

/* Counts from CLAUDE.md section 7, which are approved for the repository. */
const SCALE = {
  cashInvoices: 6088,
  cashLines: 30942,
  creditInvoices: 168,
  creditLines: 636,
  depositNotes: 193,
  productCodes: 626,
  customerCodes: 1471,
  salespeople: ['01', '03', '04', '06', '08'],
  blankSalespersonInvoices: 11,
  firstMonth: '2025-12',
  months: 9
};

/* A small deterministic generator: the same fixture every run. */
function rng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const PROFILES = ['ลอน760', 'ลอน750', 'ลอน660', 'ลอน900', 'ตัวซี', 'แผ่นเรียบ'];
const COLOURS = ['เทาเงา', 'ซิงค์', 'แดงอิฐ', 'ขาวมุก', 'น้ำเงิน', 'เขียวใบไม้'];
const THICKNESS = ['0.23', '0.28', '0.30', '0.35', '0.40', '0.47'];
const UNITS = ['เมตร', 'แผ่น', 'ชุด', 'เส้น', 'กิโลกรัม'];
const GROUPS = ['01', '02', '03', '04', '06', '07', '08', '13'];

function beDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year + 543}`;
}

function monthsList() {
  const out = [];
  let [year, month] = SCALE.firstMonth.split('-').map(Number);
  for (let i = 0; i < SCALE.months; i++) {
    out.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) { month = 1; year++; }
  }
  return out;
}

function daysInMonth(month) {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

function productCode(index) {
  const group = GROUPS[index % GROUPS.length];
  return `${group}-${String(100 + (index % 400)).padStart(3, '0')}`;
}

function description(random, code) {
  const profile = PROFILES[Math.floor(random() * PROFILES.length)];
  const colour = COLOURS[Math.floor(random() * COLOURS.length)];
  const thickness = THICKNESS[Math.floor(random() * THICKNESS.length)];
  const length = (2 + Math.floor(random() * 8)) + '.00ม';
  if (code.startsWith('09')) return `ชุดยึด/${1 + Math.floor(random() * 20)}ผ`;
  return `${profile}/${colour}/${thickness}/${length}/${8 + Math.floor(random() * 30)}ผ`;
}

/* ---------- cash sales ---------- */

function cashCsv() {
  const random = rng(20260918);
  const months = monthsList();
  const out = [];

  out.push('บริษัท ตัวอย่างหลังคาเหล็ก จำกัด,,,,,,,,,');
  out.push('รายงานขายเงินสด เรียงตามวันที่,,,,,,,,,');
  out.push(`ตั้งแต่ ${beDate(SCALE.firstMonth + '-01')} ถึง ${beDate('2026-08-31')},,,,,,,,,`);

  let invoiceCount = 0;
  let lineCount = 0;
  let blankLeft = SCALE.blankSalespersonInvoices;
  const linesPerInvoice = Math.floor(SCALE.cashLines / SCALE.cashInvoices);
  let extraLines = SCALE.cashLines - linesPerInvoice * SCALE.cashInvoices;

  while (invoiceCount < SCALE.cashInvoices) {
    const month = months[invoiceCount % months.length];
    const day = 1 + Math.floor(random() * daysInMonth(month));
    const iso = `${month}-${String(day).padStart(2, '0')}`;
    invoiceCount++;

    /* A repeated page header every 40 invoices, as the printed report does. */
    if (invoiceCount % 40 === 0) {
      out.push(`หน้า ${invoiceCount / 40},,,,,,,,,`);
      out.push('วันที่,เลขที่,รหัสลูกค้า,ชื่อลูกค้า,พนง.ขาย,V,ส่วนลด,มูลค่าสินค้า,ภาษี,รวมทั้งสิ้น');
      out.push('==========,,,,,,,,,');
    }

    const salesperson = blankLeft > 0 && invoiceCount % 500 === 0
      ? (blankLeft--, '')
      : SCALE.salespeople[invoiceCount % SCALE.salespeople.length];
    const customer = `C${String(1 + (invoiceCount % SCALE.customerCodes)).padStart(4, '0')}`;
    const invoiceNo = `HS${String(6900 + invoiceCount).slice(0, 4)}/${String(invoiceCount).padStart(4, '0')}`;

    let rows = linesPerInvoice;
    if (extraLines > 0) { rows++; extraLines--; }

    let goods = 0;
    const lineRows = [];
    for (let i = 0; i < rows && lineCount < SCALE.cashLines; i++) {
      lineCount++;
      const code = productCode(lineCount);
      const unit = code.startsWith('01') || code.startsWith('02') || code.startsWith('03')
        ? 'เมตร'
        : UNITS[lineCount % UNITS.length];
      const quantity = 1 + Math.floor(random() * 200);
      const price = 20 + Math.floor(random() * 300);
      /* Free lines: no price, no amount, quantity kept. */
      const free = lineCount % 7 === 0;
      const amount = free ? 0 : quantity * price;
      goods += amount;
      lineRows.push(`,${i + 1},"${code} -  ${description(random, code)}",${quantity},${unit},${free ? '' : price}.00,0.00,${free ? '' : amount + '.00'},SO6907/${String(lineCount).padStart(4, '0')}   1`);
    }

    const discount = invoiceCount % 33 === 0 ? 50 : 0;
    const vat = invoiceCount % 1000 === 0 ? Math.round(goods * 0.07) : 0;
    const deposit = invoiceCount % 22 === 0 ? 500 : 0;
    const total = goods - discount + vat - deposit;

    out.push(`${beDate(iso)},${invoiceNo},${customer},ลูกค้าสมมติ ${customer},${salesperson},,${discount}.00,${goods - discount - deposit}.00,${vat}.00,${total}.00,0.00,${total}.00,0.00,0.00`);
    lineRows.forEach((row) => out.push(row));
    if (deposit) out.push(`,,"ตัดใบรับมัดจำ#  AI6906/${String(invoiceCount).padStart(4, '0')} ${deposit}.00",,,,,,,`);

    /* One malformed line, as the real export contains. */
    if (invoiceCount === 1500) out.push(',,"ลอน760/เทาเงา,,,,,,,');
  }

  out.push('หมายเหตุ,,,,,,,,,');
  out.push('***,,,,,,,,,');
  out.push('>>>> จบรายงาน <<<<,,,,,,,,,');
  return out.join('\r\n');
}

/* ---------- credit sales ---------- */

function creditCsv() {
  const random = rng(778866);
  const months = monthsList();
  const out = [];

  out.push('บริษัท ตัวอย่างหลังคาเหล็ก จำกัด,,,,,,,,,');
  out.push('รายงานใบกำกับสินค้า เรียงตามวันที่,,,,,,,,,');
  out.push('วันที่,เลขที่,ชื่อลูกค้า,พนง.ขาย,V,ส่วนลด,มูลค่าสินค้า,ภาษี,รวมทั้งสิ้น,ครบกำหนด,ใบสั่งขาย,เก็บแล้ว');

  let lineCount = 0;
  const perInvoice = Math.floor(SCALE.creditLines / SCALE.creditInvoices);
  let extra = SCALE.creditLines - perInvoice * SCALE.creditInvoices;

  for (let n = 1; n <= SCALE.creditInvoices; n++) {
    const month = months[n % months.length];
    const day = 1 + Math.floor(random() * daysInMonth(month));
    const iso = `${month}-${String(day).padStart(2, '0')}`;
    /* Only 29 distinct names across 168 invoices, as in the real report, and
       the salesperson code is written inconsistently (" 3" and "03"). */
    const name = `ห้างหุ้นส่วนสมมติ ${String(1 + (n % 29)).padStart(2, '0')}`;
    const salesperson = n % 2 === 0 ? ' 3' : SCALE.salespeople[n % SCALE.salespeople.length];
    const collected = n <= SCALE.creditInvoices - 15 ? 'Y' : 'N';

    let rows = perInvoice;
    if (extra > 0) { rows++; extra--; }

    let goods = 0;
    const lineRows = [];
    for (let i = 0; i < rows && lineCount < SCALE.creditLines; i++) {
      lineCount++;
      const code = productCode(lineCount);
      const unit = code.startsWith('01') ? 'เมตร' : UNITS[lineCount % UNITS.length];
      const quantity = 1 + Math.floor(random() * 100);
      const price = 30 + Math.floor(random() * 200);
      const free = lineCount % 10 === 0;
      const amount = free ? 0 : quantity * price;
      goods += amount;
      lineRows.push(`,${i + 1},"${code} -",${description(random, code)},${quantity},${unit},${free ? '' : price}.00,0.00,${free ? '' : amount + '.00'},,,${i + 1}`);
    }

    const vat = Math.round(goods * 0.07);
    out.push(`${beDate(iso)},IV6907/${String(n).padStart(4, '0')},${name},${salesperson},,0.00,${goods}.00,${vat}.00,${goods + vat}.00,${beDate(iso)},,${collected}`);
    lineRows.forEach((row) => out.push(row));
  }

  out.push(`รวม ${SCALE.creditInvoices} ใบ,,,,,,,,,`);
  out.push('>>>> จบรายงาน <<<<,,,,,,,,,');
  return out.join('\r\n');
}

/* ---------- deposit receipts ---------- */

function depositCsv() {
  const out = [];
  out.push('บริษัท ตัวอย่างหลังคาเหล็ก จำกัด,,,,,,,,,');
  out.push('รายงานใบรับมัดจำ แยกตามลูกค้า,,,,,,,,,');

  for (let n = 1; n <= SCALE.depositNotes; n++) {
    const customer = `C${String(1 + (n % SCALE.customerCodes)).padStart(4, '0')}`;
    out.push(`  ลูกค้าสมมติ ${customer} /${customer},,,,,,,,,`);
    out.push(`,AI6906/${String(n * 22).padStart(4, '0')},${beDate('2026-06-15')},03,,500.00,0.00,500.00,,0.00,Y,500.00,0.00`);
    out.push('เอกสารที่ตัด:,,,,,,,,,');
    out.push(`,HS6907/${String(n * 22).padStart(4, '0')},${beDate('2026-07-01')},${beDate('2026-07-01')},500.00,,,,`);
    out.push(`รวม ลูกค้าสมมติ ${customer} /${customer},,,,,,,,,`);
  }

  out.push(`รวมทั้งสิ้น ${SCALE.depositNotes} ใบ,,,,,,,,,`);
  out.push('>>>> จบรายงาน <<<<,,,,,,,,,');
  return out.join('\r\n');
}

/* Windows-874 bytes, so the fixtures exercise the real decoding path. */
function toWindows874(text) {
  const bytes = [];
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code >= 0x0E01 && code <= 0x0E5B) bytes.push(code - 0x0E00 + 0xA0);
    else if (code < 0x80) bytes.push(code);
    else bytes.push(0x3F);
  }
  return Uint8Array.from(bytes);
}

module.exports = { SCALE, cashCsv, creditCsv, depositCsv, toWindows874, monthsList };
