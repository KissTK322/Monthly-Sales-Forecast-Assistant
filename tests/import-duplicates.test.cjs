/* tests/import-duplicates.test.cjs — overlapping files must not double count.
 *
 * Users may select two cash-sales files whose periods overlap (e.g. Oct-Dec
 * and Dec-Aug), or add the same deposits file twice. The same document number
 * in two different files is the same document: the first copy is kept, the
 * repeat is skipped, and importSummary.duplicateDocuments says how many.
 * All names and amounts below are synthetic.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const ExpressCsvImporter = require('../js/import-express.js');

const invoice = (date, number, amount) => [
  `"${date}","${number}","C001","ลูกค้าทดสอบ","01","1","","${amount}","0.00","${amount}","0.00","${amount}","0.00","0.00"`,
  `"","1","01-101 -  ทดสอบสินค้า","1.00","เมตร","${amount}","","${amount}"`,
];
const cashFile = (...invoices) => ['รายงานขายเงินสด เรียงตามวันที่', ...invoices.flat(), '>>>> จบรายงาน <<<<'].join('\r\n');
const depositFile = (docNumber) => [
  'รายงานใบรับมัดจำ แยกตามลูกค้า',
  '"ลูกค้าทดสอบ /C001"',
  `"","${docNumber}","15/08/2569","01","5000.00","0.00","5000.00","20/08/2569","0.00","Y","5000.00",""`,
  '>>>> จบรายงาน <<<<',
].join('\r\n');

test('an invoice present in two overlapping cash files is counted once', () => {
  const octDec = cashFile(invoice('05/10/2568', 'HS6810/0001', '100.00'), invoice('02/12/2568', 'HS6812/0001', '200.00'));
  const decAug = cashFile(invoice('02/12/2568', 'HS6812/0001', '200.00'), invoice('03/08/2569', 'HS6908/0001', '300.00'));
  const dataset = ExpressCsvImporter.buildDataset([{ name: 'oct-dec.csv', text: octDec }, { name: 'dec-aug.csv', text: decAug }]);
  assert.deepStrictEqual(dataset.sales.map((s) => s.invoice), ['HS6810/0001', 'HS6812/0001', 'HS6908/0001']);
  assert.strictEqual(dataset.sales.reduce((sum, s) => sum + s.amount, 0), 600);
  assert.strictEqual(dataset.importSummary.duplicateDocuments, 1);
});

test('files that do not overlap report no duplicates', () => {
  const a = cashFile(invoice('05/10/2568', 'HS6810/0001', '100.00'));
  const b = cashFile(invoice('03/08/2569', 'HS6908/0001', '300.00'));
  const dataset = ExpressCsvImporter.buildDataset([{ name: 'a.csv', text: a }, { name: 'b.csv', text: b }]);
  assert.strictEqual(dataset.sales.length, 2);
  assert.strictEqual(dataset.importSummary.duplicateDocuments, 0);
});

test('adding the same deposits file twice does not add the deposit twice', () => {
  const base = ExpressCsvImporter.buildDataset([{ name: 'cash.csv', text: cashFile(invoice('03/08/2569', 'HS6908/0001', '300.00')) }]);
  const once = ExpressCsvImporter.buildDataset([{ name: 'deposits.csv', text: depositFile('AI6908/0001') }], base);
  assert.strictEqual(once.adjustments.length, 1);
  const twice = ExpressCsvImporter.buildDataset([{ name: 'deposits.csv', text: depositFile('AI6908/0001') }], once);
  assert.strictEqual(twice.adjustments.length, 1);
  assert.strictEqual(twice.importSummary.duplicateDocuments, 1);
});
