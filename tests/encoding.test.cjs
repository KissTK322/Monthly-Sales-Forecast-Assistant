/* tests/encoding.test.cjs — the Windows-874 / UTF-8 decoding boundary.
 *
 * The bug under test: a decoder that tries `new TextDecoder('utf-8',
 * {fatal:true})` first and falls back to windows-874 only when that THROWS
 * is unsafe, because a short or ASCII-heavy windows-874 byte run can by
 * chance also be well-formed UTF-8. The two cp874 bytes for the Thai word
 * "ยก" (0xC2 0xA1) are also a valid UTF-8 encoding of "¡" (U+00A1) — the
 * strict UTF-8 decode does not throw, so a throw/no-throw decision picks
 * UTF-8 and silently returns wrong (but readable-looking) text.
 *
 * ExpressCsvImporter.decodeExpressBytes must decide from the decoded
 * CONTENT (more Thai characters, fewer replacement characters) instead.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const ExpressCsvImporter = require('../js/import-express.js');

test('a byte-order mark selects UTF-8', () => {
  const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('สวัสดี', 'utf-8')]);
  assert.strictEqual(ExpressCsvImporter.decodeExpressBytes(bytes), 'สวัสดี');
});

test('a windows-874 byte pair that is ALSO valid UTF-8 must still decode as windows-874', () => {
  // "ยก","01","160.00"\r\n encoded as windows-874 (TIS-620).
  // Confirmed independently (Python cp874 vs utf-8 codecs) that this exact
  // byte sequence decodes without error under BOTH encodings, but to
  // different text: cp874 -> the Thai word "ยก"; utf-8 -> the character "¡".
  // A throw/no-throw UTF-8-first strategy would pick utf-8 here and silently
  // corrupt the customer name. This is the reproduction the spec asked for.
  const bytes = Buffer.from([34, 194, 161, 34, 44, 34, 48, 49, 34, 44, 34, 49, 54, 48, 46, 48, 48, 34, 13, 10]);

  // Sanity-check the premise before asserting the fix: strict UTF-8 must
  // NOT throw on these bytes, or this test would not be exercising the bug.
  assert.doesNotThrow(() => new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const wrongUtf8Reading = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  assert.strictEqual(wrongUtf8Reading, '"¡","01","160.00"\r\n', 'premise: naive UTF-8 decode silently produces this wrong text');

  const decoded = ExpressCsvImporter.decodeExpressBytes(bytes);
  assert.strictEqual(decoded, '"ยก","01","160.00"\r\n');
});

test('plain ASCII with no Thai and no BOM decodes as windows-874 by default (never UTF-8 by default)', () => {
  const bytes = Buffer.from('"01/12/2568","HS0001","C001","Cash customer","01"\r\n', 'ascii');
  const decoded = ExpressCsvImporter.decodeExpressBytes(bytes);
  assert.strictEqual(decoded, '"01/12/2568","HS0001","C001","Cash customer","01"\r\n');
});

test('bytes that are not valid UTF-8 at all fall back to windows-874 without throwing', () => {
  // A lone continuation byte (0x80..0xBF at position 0) is invalid UTF-8 on
  // its own, but every byte value is defined in windows-874.
  const bytes = Buffer.from([0xa1, 0xa2, 0xa3]);
  assert.doesNotThrow(() => ExpressCsvImporter.decodeExpressBytes(bytes));
  const decoded = ExpressCsvImporter.decodeExpressBytes(bytes);
  assert.strictEqual(decoded, new TextDecoder('windows-874').decode(bytes));
});

test('the real cash-sales.csv file (if present locally) decodes with zero replacement characters', () => {
  const fs = require('fs');
  const path = require('path');
  const file = path.join(__dirname, '..', 'private-data', 'cash-sales.csv');
  if (!fs.existsSync(file)) return; // private data is never committed; skip when absent
  const bytes = fs.readFileSync(file);
  const decoded = ExpressCsvImporter.decodeExpressBytes(bytes);
  assert.ok(!decoded.includes('�'), 'the real Express export must decode with no replacement characters');
  const thaiChars = (decoded.match(/[฀-๿]/g) || []).length;
  assert.ok(thaiChars > 100000, 'the real Express export is mostly Thai text');
});
