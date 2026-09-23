/* tests/csv-quotes.test.cjs — unescaped double quotes in Express CSV cells.
 *
 * Express writes an inch mark inside a quoted cell without doubling it, e.g.
 *   "12-403 -  กรรไกรตัดสังกะสี 12"",1.00,...
 * A parser that toggles quoting on every quote reads the rest of that line
 * as one cell, so the line loses its quantity and amount and is skipped. In
 * the real export this dropped 36 cash lines and 8 whole invoices.
 * The rows below are synthetic; they copy only the quoting shape.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const ExpressCsvImporter = require('../js/import-express.js');

const { parseCsvLine } = ExpressCsvImporter;

test('an inch mark at the end of a quoted cell does not swallow the line', () => {
  assert.deepStrictEqual(
    parseCsvLine('"",1,"12-403 -  กรรไกร 12"",1.00,"อัน",160.00,"",160.00'),
    ['', '1', '12-403 -  กรรไกร 12"', '1.00', 'อัน', '160.00', '', '160.00']
  );
});

test('an inch mark in the middle of a quoted cell stays in the cell', () => {
  assert.deepStrictEqual(
    parseCsvLine('"",4,"10-958 -  สกรู 8*2.5"(ซิงค์",300.00,"ตัว"'),
    ['', '4', '10-958 -  สกรู 8*2.5"(ซิงค์', '300.00', 'ตัว']
  );
  assert.deepStrictEqual(
    parseCsvLine('"",1,"12-608 -  ประแจ 12"30",1.00'),
    ['', '1', '12-608 -  ประแจ 12"30', '1.00']
  );
});

test('ordinary quoting is unchanged', () => {
  assert.deepStrictEqual(parseCsvLine('"","a,b",1,""'), ['', 'a,b', '1', '']);
  assert.deepStrictEqual(parseCsvLine('"say ""hi"" now",2'), ['say "hi" now', '2']);
  assert.deepStrictEqual(parseCsvLine('"ends with quote""",3'), ['ends with quote"', '3']);
});

test('an invoice whose only line has an inch mark is imported', () => {
  const text = [
    'รายงานขายเงินสด เรียงตามวันที่',
    '"09/01/2569","HS0000/0001","C-1","Test customer","03","1","",160.00,0.00,160.00,0.00,160.00,0.00,0.00',
    '"",1,"12-403 -  กรรไกร 12"",1.00,"อัน",160.00,"",160.00',
    '""',
  ].join('\r\n');
  const dataset = ExpressCsvImporter.buildDataset([{ name: 'cash.csv', text }]);
  assert.strictEqual(dataset.sales.length, 1);
  assert.strictEqual(dataset.sales[0].invoice, 'HS0000/0001');
  assert.strictEqual(dataset.sales[0].quantity, 1);
  assert.strictEqual(dataset.sales[0].amount, 160);
});
