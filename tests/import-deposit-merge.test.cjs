/* tests/import-deposit-merge.test.cjs — deposit-only imports.
 *
 * buildDataset() used to require at least one cash-sales or credit-sales
 * document on every call, so a deposits.csv selected on its own (without
 * reselecting the sales files) was always rejected, even when sales data
 * was already loaded from an earlier import. Fixed: buildDataset(documents,
 * existing) accepts the currently loaded dataset and, when the new files
 * are deposits only, merges the new adjustments into it instead of
 * requiring a full rebuild. Without an `existing` dataset the original
 * error still applies, because a deposit file alone has no sales date to
 * set the reporting month from.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const ExpressCsvImporter = require('../js/import-express.js');

const cashSalesText = [
  'หลังคาเหล็ก ฉนวนพียูโฟม',
  'รายงานขายเงินสด เรียงตามวันที่',
  'วันที่จาก 1 ธ.ค. 2568 ถึง 31 ส.ค. 2569',
  '"01/12/2568","HS6812/0001","C001","ลูกค้าทดสอบ","01","1","","1000.00","0.00","1000.00","0.00","1000.00","0.00","0.00"',
  '"","1","01-101 -  ทดสอบสินค้า","10.00","เมตร","100.00","","1000.00"',
  '>>>> จบรายงาน <<<<',
].join('\r\n');

const depositText = (docNumber, customerLine) => [
  'หลังคาเหล็ก ฉนวนพียูโฟม',
  'รายงานใบรับมัดจำ แยกตามลูกค้า',
  'วันที่จาก 1 ธ.ค. 2568 ถึง 31 ส.ค. 2569',
  customerLine,
  `"","${docNumber}","15/08/2569","01","5000.00","0.00","5000.00","20/08/2569","0.00","Y","5000.00",""`,
  '>>>> จบรายงาน <<<<',
].join('\r\n');

test('a deposit file alone, with no existing dataset, is rejected with a clear reason', () => {
  const documents = [{ name: 'deposits.csv', text: depositText('AI6908/0001', '"ลูกค้าทดสอบ /C001"') }];
  assert.throws(
    () => ExpressCsvImporter.buildDataset(documents),
    /Deposit receipts alone cannot start a new dataset/
  );
});

test('a deposit file alone, WITH an existing dataset, merges instead of replacing', () => {
  const base = ExpressCsvImporter.buildDataset([{ name: 'cash-sales.csv', text: cashSalesText }]);
  assert.strictEqual(base.sales.length, 1);
  assert.strictEqual(base.adjustments.length, 0);
  assert.strictEqual(base.customers.length, 1);

  const depositDocs = [{ name: 'deposits.csv', text: depositText('AI6908/0001', '"ลูกค้าทดสอบ /C001"') }];
  const merged = ExpressCsvImporter.buildDataset(depositDocs, base);

  // Sales, products and the reporting month all carry over unchanged --
  // nothing here re-derives them from a deposit file.
  assert.strictEqual(merged.completeThrough, base.completeThrough);
  assert.deepStrictEqual(merged.sales, base.sales);
  assert.strictEqual(merged.products.length, base.products.length);

  // The new deposit is added, against the SAME customer (matched by the
  // code the deposit file carries, C001), not a duplicate.
  assert.strictEqual(merged.adjustments.length, 1);
  assert.strictEqual(merged.adjustments[0].document, 'AI6908/0001');
  assert.strictEqual(merged.adjustments[0].customer, 'C001');
  assert.strictEqual(merged.customers.length, 1, 'the deposit customer matched the existing customer by code, no duplicate created');
});

test('a second deposit-only import merges onto the first merge, not just the original', () => {
  const base = ExpressCsvImporter.buildDataset([{ name: 'cash-sales.csv', text: cashSalesText }]);
  const afterFirstDeposit = ExpressCsvImporter.buildDataset(
    [{ name: 'deposits.csv', text: depositText('AI6908/0001', '"ลูกค้าทดสอบ /C001"') }],
    base
  );
  const afterSecondDeposit = ExpressCsvImporter.buildDataset(
    [{ name: 'deposits-2.csv', text: depositText('AI6908/0002', '"ลูกค้าทดสอบ /C001"') }],
    afterFirstDeposit
  );
  assert.strictEqual(afterSecondDeposit.adjustments.length, 2);
  assert.deepStrictEqual(
    afterSecondDeposit.adjustments.map((a) => a.document).sort(),
    ['AI6908/0001', 'AI6908/0002']
  );
});

test('importing cash/credit sales still fully rebuilds and ignores any existing dataset (unchanged behaviour)', () => {
  const base = ExpressCsvImporter.buildDataset([{ name: 'cash-sales.csv', text: cashSalesText }]);
  const rebuilt = ExpressCsvImporter.buildDataset([{ name: 'cash-sales.csv', text: cashSalesText }], base);
  assert.strictEqual(rebuilt.sales.length, 1);
  assert.strictEqual(rebuilt.adjustments.length, 0, 'a fresh sales-only import still starts adjustments empty, as before');
});

test('with no sales documents and no deposit documents either, the original error still applies', () => {
  assert.throws(
    () => ExpressCsvImporter.buildDataset([{ name: 'unknown.csv', text: 'not a recognised report' }]),
    /Unsupported Express CSV/
  );
});
