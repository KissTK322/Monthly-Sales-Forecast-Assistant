/* tests/fixtures.test.cjs — the generated reports at full scale.
 *
 * This is the volume test as well as the shape test: the same counts as the
 * client's exports, parsed through the real decoding path, with the engine run
 * over the result.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { loadModules } = require('./helpers.cjs');
const fixtures = require('./fixtures/generate.cjs');

const MSFA = loadModules(['js/import-express.js', 'js/engine.js']);
const I = MSFA.importExpress;
const E = MSFA.engine;

/* Built once: at full scale this is the slow part of the suite. */
let dataset = null;
function build() {
  if (dataset) return dataset;
  const documents = [
    { name: 'cash-sales.csv', text: fixtures.cashCsv() },
    { name: 'credit-sales.csv', text: fixtures.creditCsv() },
    { name: 'deposits.csv', text: fixtures.depositCsv() }
  ].map((doc) => {
    /* Through the real bytes, so the decoder is exercised, not bypassed. */
    const decoded = I.decodeBytes(fixtures.toWindows874(doc.text).buffer);
    return { name: doc.name, text: decoded.text, encoding: decoded.encoding };
  });
  dataset = I.buildDataset(documents);
  return dataset;
}

test('the fixtures decode from Windows-874, not UTF-8', () => {
  const bytes = fixtures.toWindows874(fixtures.creditCsv());
  const decoded = I.decodeBytes(bytes.buffer);
  assert.strictEqual(decoded.encoding, 'windows-874');
  assert.ok(decoded.text.includes('รายงานใบกำกับสินค้า'));
});

test('the fixtures carry no personal data', () => {
  const all = fixtures.cashCsv() + fixtures.creditCsv() + fixtures.depositCsv();
  assert.ok(!/\b0\d{1,2}-?\d{3}-?\d{3,4}\b/.test(all), 'no phone numbers');
  assert.ok(!/หมายเหตุ\s*[:：]/.test(all), 'no remark content');
  assert.ok(all.includes('ลูกค้าสมมติ'), 'customer names are invented');
});

test('full scale: the counts match the shape of the real exports', () => {
  const data = build();
  assert.strictEqual(data.counts.cashInvoices, fixtures.SCALE.cashInvoices);
  assert.strictEqual(data.counts.cashLines, fixtures.SCALE.cashLines);
  assert.strictEqual(data.counts.creditInvoices, fixtures.SCALE.creditInvoices);
  assert.strictEqual(data.counts.creditLines, fixtures.SCALE.creditLines);
  assert.strictEqual(data.counts.depositNotes, fixtures.SCALE.depositNotes);
  assert.strictEqual(data.counts.blankSalesperson, fixtures.SCALE.blankSalespersonInvoices);
});

test('the inconsistent credit salesperson code is normalised', () => {
  const data = build();
  const codes = data.salespeople.map((s) => s.code);
  assert.deepStrictEqual(codes, fixtures.SCALE.salespeople,
    'only the five real codes, with " 3" folded into "03"');
});

test('malformed lines are reported, not fatal', () => {
  const data = build();
  assert.ok(data.counts.malformed >= 1, 'the planted malformed line is counted');
  assert.strictEqual(data.counts.unresolved, 0, 'everything else parsed');
});

test('deposits reduce the invoice total and the difference stays visible', () => {
  const data = build();
  const withDeposit = data.invoices.filter((i) => i.deposits > 0);
  assert.ok(withDeposit.length > 0);
  withDeposit.forEach((invoice) => {
    assert.strictEqual(invoice.grossBeforeDeposits, invoice.total + invoice.deposits);
  });
});

test('the engine runs over the whole dataset and forecasts by group', () => {
  const data = build();
  const cutoff = data.lines.reduce((latest, line) => (line.date > latest ? line.date : latest), data.lines[0].date);

  const groups = E.buildSeries(data.lines, {
    key: (line) => line.group,
    unit: 'เมตร',
    excludeNonMaterial: true
  });
  assert.ok(groups.length >= 3, 'several product groups are sold in metres');

  const results = groups.map((series) => E.forecastNextMonth(series, cutoff));

  results.forEach((result) => {
    assert.ok(result.unit === 'เมตร');
    assert.strictEqual(result.method, 'consumption-rate');
    /* Either a number with its error, or a reason. Never a bare number. */
    if (result.value === null) assert.ok(result.reason, 'a withheld figure states why');
    else {
      assert.ok(result.wape !== null && result.wape !== undefined);
      assert.ok(result.n >= 1);
      assert.ok(result.value >= 0);
      assert.ok(result.low <= result.value && result.high >= result.value);
    }
  });
});

test('no forecast uses data from after its cutoff, at full scale', () => {
  const data = build();
  const cutoff = '2026-07-31';
  const groups = E.buildSeries(data.lines, { key: (l) => l.group, unit: 'เมตร', excludeNonMaterial: true });

  const before = groups.map((s) => E.forecastNextMonth(s, cutoff).value);

  /* Nothing after the cutoff may change the answer. */
  const poisoned = data.lines.concat(data.lines.slice(0, 500).map((line) => ({
    ...line, date: '2026-08-20', quantity: line.quantity * 100
  })));
  const after = E.buildSeries(poisoned, { key: (l) => l.group, unit: 'เมตร', excludeNonMaterial: true })
    .map((s) => E.forecastNextMonth(s, cutoff).value);

  assert.deepStrictEqual(after, before);
});

test('attributes are parsed onto the lines at full scale', () => {
  const data = build();
  const metres = data.lines.filter((l) => l.unit === 'เมตร');
  const withProfile = metres.filter((l) => l.attrs && l.attrs.profile).length;
  const withColour = metres.filter((l) => l.attrs && l.attrs.colour).length;

  assert.ok(metres.length > 1000, 'the fixture has plenty of metre lines');
  assert.strictEqual(withProfile, metres.length, 'every description yields a profile');
  assert.ok(withColour / metres.length > 0.9, 'nearly every description yields a colour');
});
