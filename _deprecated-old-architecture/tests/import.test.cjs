/* tests/import.test.cjs — the three Express CSV adapters.
 *
 * The fixtures here are generated, never copied from the client's files: they
 * carry the real shape (printed headers, Buddhist dates, deposit notes,
 * malformed lines) with invented names and no remark text.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { loadModule } = require('./helpers.cjs');

const I = loadModule('js/import-express.js').importExpress;

/* Encode Thai text as TIS-620/Windows-874: byte = codepoint - 0x0E00 + 0xA0 */
function toWindows874(text) {
  const bytes = [];
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code >= 0x0E01 && code <= 0x0E5B) bytes.push(code - 0x0E00 + 0xA0);
    else if (code < 0x80) bytes.push(code);
    else throw new Error('not encodable in windows-874: ' + ch);
  }
  return Uint8Array.from(bytes);
}

test('Windows-874 text that is also valid UTF-8 decodes as Thai, not as mojibake', () => {
  /* "รถสดวง" encodes to C3 B6 CA B4 C7 A7, which is a well-formed UTF-8
     sequence too. The prototype tried UTF-8 first and would have returned
     Latin letters here, losing the Thai for good. */
  const thai = 'รถสดวง';
  const bytes = toWindows874(thai);

  let validUtf8 = true;
  try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { validUtf8 = false; }
  assert.strictEqual(validUtf8, true, 'the fixture must be ambiguous, or it proves nothing');

  const decoded = I.decodeBytes(bytes.buffer);
  assert.strictEqual(decoded.encoding, 'windows-874');
  assert.strictEqual(decoded.text, thai);
});

test('ordinary Thai Windows-874 (invalid as UTF-8) decodes as Thai', () => {
  const thai = 'รายงานขายเงินสด';
  const decoded = I.decodeBytes(toWindows874(thai).buffer);
  assert.strictEqual(decoded.encoding, 'windows-874');
  assert.strictEqual(decoded.text, thai);
});

test('a UTF-8 byte-order mark is honoured', () => {
  const utf8 = new TextEncoder().encode('รายงานขายเงินสด');
  const withBom = Uint8Array.from([0xEF, 0xBB, 0xBF, ...utf8]);
  const decoded = I.decodeBytes(withBom.buffer);
  assert.strictEqual(decoded.encoding, 'utf-8-bom');
  assert.strictEqual(decoded.text, 'รายงานขายเงินสด');
});

test('pure ASCII decodes identically either way', () => {
  const decoded = I.decodeBytes(new TextEncoder().encode('date,doc,amount').buffer);
  assert.strictEqual(decoded.text, 'date,doc,amount');
});

test('Buddhist-era dates convert, and rubbish returns empty', () => {
  assert.strictEqual(I.parseThaiDate('01/07/2569'), '2026-07-01');
  assert.strictEqual(I.parseThaiDate('31/12/2568'), '2025-12-31');
  assert.strictEqual(I.parseThaiDate('29/02/2567'), '2024-02-29');
  assert.strictEqual(I.parseThaiDate('31/02/2569'), '', 'a day that does not exist is not a date');
  assert.strictEqual(I.parseThaiDate('not a date'), '');
});

test('salesperson codes normalise to two digits, and blank stays null', () => {
  assert.strictEqual(I.normalizeStaffCode('3'), '03');
  assert.strictEqual(I.normalizeStaffCode(' 3'), '03');
  assert.strictEqual(I.normalizeStaffCode('03'), '03');
  assert.strictEqual(I.normalizeStaffCode(''), null);
  assert.strictEqual(I.normalizeStaffCode('   '), null);
});

test('a malformed line is reported and does not shift the lines after it', () => {
  const rows = I.parseRows('a,b,c\n"unbalanced,quote\nd,e,f');
  assert.strictEqual(rows.length, 3);
  assert.strictEqual(rows[1].unbalanced, true);
  assert.deepStrictEqual(rows[2].cells, ['d', 'e', 'f'], 'the next line parses normally');
});

test('product code and description split apart', () => {
  assert.deepStrictEqual(I.splitCombinedProduct('01-208 -  ลอน760/เทาเงา/0.35'),
    { code: '01-208', description: 'ลอน760/เทาเงา/0.35' });
  assert.strictEqual(I.splitCombinedProduct('no code here'), null);
});

test('description attributes are parsed onto the line', () => {
  assert.deepStrictEqual(I.parseAttributes('01-208', 'ลอน760/เทาเงา/0.35/4.75ม/32ผ'), {
    profile: 'ลอน760', colour: 'เทาเงา', thickness: '0.35', length: '4.75ม', sheets: '32ผ'
  });

  const partial = I.parseAttributes('03-101', 'ลอน750/ซิงค์/0.40');
  assert.strictEqual(partial.profile, 'ลอน750');
  assert.strictEqual(partial.colour, 'ซิงค์');
  assert.strictEqual(partial.thickness, '0.40');
  assert.strictEqual(partial.length, null, 'a missing length stays null, never guessed');
});

test('group 09-1xx keeps its sheet count and is given no colour', () => {
  const attrs = I.parseAttributes('09-101', 'ชุดยึด/2ผ');
  assert.strictEqual(attrs.sheets, '2ผ');
  assert.strictEqual(attrs.colour, null, 'the second field there is a sheet count, not a colour');
});

test('near-identical colour names stay apart', () => {
  const a = I.parseAttributes('01-208', 'ลอน760/ซิงค์/0.35');
  const b = I.parseAttributes('01-208', 'ลอน760/ซิ้งค์/0.35');
  assert.notStrictEqual(a.colour, b.colour, 'only the client may say these are the same colour');
});

/* ---------- fixtures ---------- */

const CASH_CSV = [
  'บริษัท ตัวอย่าง จำกัด,,,,,,,,',
  'รายงานขายเงินสด เรียงตามวันที่,,,,,,,,',
  'ตั้งแต่ 01/12/2568 ถึง 31/08/2569,,,,,,,,',
  'วันที่,เลขที่,รหัสลูกค้า,ชื่อลูกค้า,พนง.ขาย,V,ส่วนลด,มูลค่าสินค้า,ภาษี,รวมทั้งสิ้น',
  '01/07/2569,HS6907/0001,C001,ร้านทดสอบหนึ่ง,03,,0.00,10000.00,0.00,10000.00',
  ',1,"01-208 -  ลอน760/เทาเงา/0.35/4.75ม/32ผ",100,เมตร,100.00,0.00,10000.00,SO6907/0001   1',
  ',2,"99-101 -  ค่าขนส่ง",1,เที่ยว,,,0.00,',
  'ตัดใบรับมัดจำ#  AI6906/0004 2000.00,,,,,,,,',
  '02/07/2569,HS6907/0002,C002,ร้านทดสอบสอง,,,0.00,5000.00,0.00,5000.00',
  ',1,"03-101 -  ลอน750/ซิงค์/0.40/3.00ม",50,เมตร,100.00,0.00,5000.00,',
  '>>>> จบรายงาน <<<<,,,,,,,,'
].join('\r\n');

const CREDIT_CSV = [
  'บริษัท ตัวอย่าง จำกัด,,,,,,,,',
  'รายงานใบกำกับสินค้า เรียงตามวันที่,,,,,,,,',
  'วันที่,เลขที่,ชื่อลูกค้า,พนง.ขาย,V,ส่วนลด,มูลค่าสินค้า,ภาษี,รวมทั้งสิ้น,ครบกำหนด,ใบสั่งขาย,เก็บแล้ว',
  '05/07/2569,IV6907/0001,ห้างทดสอบ จำกัด, 3,,0.00,20000.00,1400.00,21400.00,04/08/2569,,N',
  ',1,"01-208 -",ลอน760/เทาเงา/0.35/4.75ม/32ผ,200,เมตร,100.00,0.00,20000.00,,,1',
  '06/07/2569,IV6907/0002,ห้างทดสอบ  จำกัด,03,,0.00,1000.00,70.00,1070.00,05/08/2569,,Y',
  ',1,"77-101 -",ค่ารีดลอน,10,เมตร,100.00,0.00,1000.00,,,1',
  'รวม 2 ใบ,,,,,,,,'
].join('\r\n');

const DEPOSIT_CSV = [
  'บริษัท ตัวอย่าง จำกัด,,,,,,,,',
  'รายงานใบรับมัดจำ แยกตามลูกค้า,,,,,,,,',
  '  ร้านทดสอบหนึ่ง /C001,,,,,,,,',
  ',AI6906/0004,15/06/2569,03,,2000.00,0.00,2000.00,,0.00,Y,2000.00,0.00',
  'เอกสารที่ตัด:,,,,,,,,',
  ',HS6907/0001,01/07/2569,01/07/2569,2000.00,,,,',
  'รวมทั้งสิ้น 1 ใบ,,,,,,,,'
].join('\r\n');

function build() {
  return I.buildDataset([
    { name: 'cash-sales.csv', text: CASH_CSV, encoding: 'windows-874' },
    { name: 'credit-sales.csv', text: CREDIT_CSV, encoding: 'windows-874' },
    { name: 'deposits.csv', text: DEPOSIT_CSV, encoding: 'windows-874' }
  ]);
}

test('each report is recognised by its printed title', () => {
  assert.strictEqual(I.classify(CASH_CSV), 'cash');
  assert.strictEqual(I.classify(CREDIT_CSV), 'credit');
  assert.strictEqual(I.classify(DEPOSIT_CSV), 'deposit');
  assert.strictEqual(I.classify('something else'), 'unknown');
});

test('an unrecognised file is refused rather than guessed at', () => {
  assert.throws(() => I.buildDataset([{ name: 'x.csv', text: 'date,amount\n1,2' }]), /Unsupported/);
});

test('cash and credit invoices and their lines are built', () => {
  const data = build();
  assert.strictEqual(data.counts.cashInvoices, 2);
  assert.strictEqual(data.counts.creditInvoices, 2);
  assert.strictEqual(data.counts.cashLines, 3);
  assert.strictEqual(data.counts.creditLines, 2);
  assert.strictEqual(data.counts.unresolved, 0);

  const first = data.invoices[0];
  assert.strictEqual(first.id, 'HS6907/0001');
  assert.strictEqual(first.channel, 'cash');
  assert.strictEqual(first.date, '2026-07-01');
  assert.strictEqual(first.salespersonCode, '03');
});

test('a blank salesperson stays null and is counted, never an invented person', () => {
  const data = build();
  const blank = data.invoices.filter((i) => i.salespersonCode === null);
  assert.strictEqual(blank.length, 1);
  assert.strictEqual(data.counts.blankSalesperson, 1);
  assert.ok(!data.salespeople.some((s) => s.code === null || s.code === 'UNASSIGNED'),
    'there is no "unassigned salesperson" in the team list');
});

test('credit salesperson " 3" is the same person as "03"', () => {
  const data = build();
  const credit = data.invoices.filter((i) => i.channel === 'credit');
  assert.deepStrictEqual(credit.map((i) => i.salespersonCode), ['03', '03']);
  assert.deepStrictEqual(data.salespeople.map((s) => s.code), ['03']);
});

test('credit customers keyed by printed name are not merged with lookalikes', () => {
  const data = build();
  const unmapped = data.customers.filter((c) => !c.hasSourceCode);
  assert.strictEqual(unmapped.length, 2,
    '"ห้างทดสอบ จำกัด" and "ห้างทดสอบ  จำกัด" stay apart until the client maps them');
  data.invoices.filter((i) => i.channel === 'credit').forEach((invoice) => {
    assert.strictEqual(invoice.customerMapped, false);
    assert.ok(invoice.customerNameRaw);
  });
});

test('invoice totals are after deposits, and the difference stays visible', () => {
  const data = build();
  const invoice = data.invoices.find((i) => i.id === 'HS6907/0001');
  assert.strictEqual(invoice.deposits, 2000);
  assert.strictEqual(invoice.total, 10000);
  assert.strictEqual(invoice.grossBeforeDeposits, 12000, 'gross = net + deposits');
  assert.strictEqual(data.counts.invoicesWithDeposits, 1);
});

test('deposit receipts and their links to invoices are parsed', () => {
  const data = build();
  assert.strictEqual(data.deposits.length, 1);
  assert.strictEqual(data.deposits[0].id, 'AI6906/0004');
  assert.strictEqual(data.deposits[0].date, '2026-06-15');
  assert.strictEqual(data.deposits[0].total, 2000);
  assert.ok(data.depositLinks.some((l) => l.invoiceId === 'HS6907/0001' && l.amount === 2000));
});

test('free and no-price lines keep their quantity and are flagged', () => {
  const data = build();
  const free = data.lines.filter((l) => l.free);
  assert.strictEqual(free.length, 1);
  assert.strictEqual(free[0].code, '99-101');
  assert.strictEqual(free[0].quantity, 1, 'quantity is kept');
  assert.strictEqual(free[0].amount, 0);
  assert.strictEqual(data.counts.freeLines, 1);
});

test('credit item lines read the description from its own column', () => {
  const data = build();
  const line = data.lines.find((l) => l.invoiceId === 'IV6907/0001');
  assert.strictEqual(line.code, '01-208');
  assert.strictEqual(line.attrs.profile, 'ลอน760');
  assert.strictEqual(line.attrs.colour, 'เทาเงา');
  assert.strictEqual(line.quantity, 200);
  assert.strictEqual(line.unit, 'เมตร');
});

test('the collected flag and due date are read from credit invoices', () => {
  const data = build();
  const invoices = data.invoices.filter((i) => i.channel === 'credit');
  assert.strictEqual(invoices[0].collected, false);
  assert.strictEqual(invoices[0].dueDate, '2026-08-04');
  assert.strictEqual(invoices[1].collected, true);
  assert.strictEqual(data.counts.notCollected, 1);
});

test('importing twice gives the same dataset', () => {
  assert.deepStrictEqual(JSON.stringify(build()), JSON.stringify(build()));
});
