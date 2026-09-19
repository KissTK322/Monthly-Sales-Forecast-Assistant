/* tests/reproduce-group-forecast.cjs — runs js/predictions.js against the
 * real private-data/ CSVs to measure actual group-level WAPE, instead of
 * quoting the "reported, not reproduced" figures in CLAUDE.md/progress.md.
 *
 * Not a pass/fail unit test: a manual verification step for real client
 * data that must never be committed. Run: node tests/reproduce-group-forecast.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ExpressCsvImporter = require('../js/import-express.js');
const Predictions = require('../js/predictions.js');

const DATA_DIR = path.join(__dirname, '..', 'private-data');
const files = ['cash-sales.csv', 'credit-sales.csv', 'deposits.csv'];
const documents = files.map((name) => ({
  name,
  text: ExpressCsvImporter.decodeExpressBytes(fs.readFileSync(path.join(DATA_DIR, name))),
}));

const dataset = ExpressCsvImporter.buildDataset(documents);
const productBySku = new Map(dataset.products.map((p) => [p.sku, p]));
const cutoff = Predictions.monthEnd(dataset.completeThrough);

console.log('dataset completeThrough:', dataset.completeThrough, 'cutoff:', cutoff);
console.log('total sale lines:', dataset.sales.length);

// Build engine lines: one per sale, carrying the SKU's group prefix and unit.
const lines = dataset.sales.map((sale) => {
  const product = productBySku.get(sale.sku);
  return {
    date: sale.date,
    quantity: sale.quantity,
    unit: product ? product.unit : 'unit',
    code: sale.sku,
    group: sale.sku.split(/[-._/]/)[0] || 'unknown',
  };
});

// Per group, the dominant unit is the one carrying the most quantity, so a
// group is not forecast on a minority unit that happens to sort first.
const groupUnitTotals = new Map(); // group -> Map(unit -> quantity)
for (const line of lines) {
  if (!groupUnitTotals.has(line.group)) groupUnitTotals.set(line.group, new Map());
  const units = groupUnitTotals.get(line.group);
  units.set(line.unit, (units.get(line.unit) || 0) + line.quantity);
}
const dominantUnitByGroup = new Map();
for (const [group, units] of groupUnitTotals) {
  const [dominant] = [...units.entries()].sort((a, b) => b[1] - a[1])[0];
  dominantUnitByGroup.set(group, dominant);
}

console.log();
console.log('--- group-level forecast, real data, method=consumption-rate (js/predictions.js) ---');
console.log('group | unit | demandClass | monthsWithSales | window | WAPE | grade | ratePerDay | forecast(', Predictions.shiftMonth(dataset.completeThrough, 1), ') | n(lines)');

const groups = [...dominantUnitByGroup.keys()].sort();
const summaryForClaudeMdComparison = [];
for (const group of groups) {
  const unit = dominantUnitByGroup.get(group);
  const groupLines = lines.filter((l) => l.group === group);
  const series = Predictions.buildSeries(groupLines, { unit, key: () => group })[0];
  if (!series) continue;
  const forecast = Predictions.forecastNextMonth(series, cutoff);
  const wapeText = forecast.wape === null ? '—' : (forecast.wape * 100).toFixed(1) + '%';
  const valueText = forecast.value === null ? `— (${forecast.reason})` : forecast.value.toFixed(1);
  console.log(
    `${group} | ${unit} | ${forecast.demandClass} | ${forecast.monthsWithSales} | ${forecast.window ?? '—'} | ${wapeText} | ${forecast.grade} | ${forecast.ratePerDay === null ? '—' : forecast.ratePerDay.toFixed(2)} | ${valueText} | ${series.lines.length}`
  );
  if (forecast.wape !== null) summaryForClaudeMdComparison.push({ group, wape: forecast.wape, grade: forecast.grade });
}

console.log();
console.log('--- comparison against the "reported, not reproduced" figures in CLAUDE.md section 1 (2026-09-18 entry) ---');
console.log('CLAUDE.md reported: group 02 at 10.1%, group 03 at 10.6%, group 01 at 21.5% (WAPE, method and window unspecified in that note)');
for (const row of summaryForClaudeMdComparison.filter((r) => ['01', '02', '03'].includes(r.group))) {
  console.log(`measured now: group ${row.group} WAPE = ${(row.wape * 100).toFixed(1)}% (grade ${row.grade})`);
}
console.log('These are independent measurements from a from-scratch implementation of the CLAUDE.md section 8 rule; they are not expected to match the old figures digit-for-digit, only to be in the same range, since the old numbers were never reproduced by committed code either.');
