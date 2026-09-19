/* tests/predictions.test.cjs — consumption rate, backtests, demand classes,
 * for js/predictions.js (the group-level engine added on top of the ported
 * prototype). Hand-worked numbers, boundary cases, leakage and determinism.
 * Adapted from the equivalent test in the project's earlier architecture
 * (_deprecated-old-architecture/tests/engine.test.cjs) to this module's API.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const E = require('../js/predictions.js');

function series(entries, unit) {
  const lines = entries.map(([date, quantity], index) => ({
    id: 'L' + index, date, quantity, unit: unit || 'เมตร', code: '01-208', group: '01',
  }));
  return E.buildSeries(lines, { unit: unit || 'เมตร' })[0];
}

function evenMonth(month, perDay, unit) {
  const days = E.daysInMonth(month);
  const out = [];
  for (let d = 1; d <= days; d++) out.push([`${month}-${String(d).padStart(2, '0')}`, perDay]);
  return out;
}

test('date helpers are correct across month lengths and leap years', () => {
  assert.strictEqual(E.daysInMonth('2026-02'), 28);
  assert.strictEqual(E.daysInMonth('2024-02'), 29);
  assert.strictEqual(E.daysInMonth('2026-12'), 31);
  assert.strictEqual(E.monthEnd('2026-02'), '2026-02-28');
  assert.strictEqual(E.shiftMonth('2026-12', 1), '2027-01');
  assert.strictEqual(E.shiftMonth('2026-01', -1), '2025-12');
  assert.strictEqual(E.daysBetween('2026-01-01', '2026-01-31'), 30);
});

test('worked example: 8,703 m over 92 days is 94.6 m/day, and cover follows', () => {
  const s = series([['2026-06-01', 4351.5], ['2026-08-31', 4351.5]]);
  const window = E.rateBetween(s, '2026-06-01', '2026-08-31');

  assert.strictEqual(window.days, 92);
  assert.strictEqual(window.quantity, 8703);
  assert.ok(Math.abs(window.rate - 94.6) < 0.05, `rate ${window.rate} should be about 94.6`);

  const cover500 = E.daysOfCover(500, window.rate);
  const cover2000 = E.daysOfCover(2000, window.rate);
  assert.ok(Math.abs(cover500.days - 5.3) < 0.05, `cover ${cover500.days} should be about 5.3`);
  assert.ok(Math.abs(cover2000.days - 21.1) < 0.05, `cover ${cover2000.days} should be about 21.1`);
  assert.strictEqual(cover500.urgent, false, '5.3 days is not below the 5-day mark');
  assert.strictEqual(E.daysOfCover(400, window.rate).urgent, true);
});

test('days of cover refuses to guess without a rate or a typed stock figure', () => {
  assert.deepStrictEqual(E.daysOfCover(100, 0), { days: null, reason: 'no-rate' });
  assert.deepStrictEqual(E.daysOfCover(null, 5), { days: null, reason: 'no-stock-entered' });
  assert.deepStrictEqual(E.daysOfCover('', 5), { days: null, reason: 'no-stock-entered' });
});

test('a flat series predicts its own rate times the days in the target month', () => {
  const entries = [];
  ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'].forEach((month) => entries.push(...evenMonth(month, 10)));
  const s = series(entries);

  const forecast = E.forecastNextMonth(s, '2026-08-31');
  assert.strictEqual(forecast.targetMonth, '2026-09');
  assert.strictEqual(forecast.unit, 'เมตร');
  assert.ok(Math.abs(forecast.ratePerDay - 10) < 1e-9);
  assert.ok(Math.abs(forecast.value - 300) < 1e-6, `expected 300, got ${forecast.value}`);
  assert.ok(forecast.wape < 1e-9, 'a flat series should backtest at ~0 error');
  assert.strictEqual(forecast.grade, 'good');
});

test('the trend factor is damped and clamped to 0.8-1.2', () => {
  const entries = [];
  ['2026-03', '2026-04', '2026-05'].forEach((m) => entries.push(...evenMonth(m, 1)));
  ['2026-06', '2026-07', '2026-08'].forEach((m) => entries.push(...evenMonth(m, 10)));
  assert.strictEqual(E.trendFactor(series(entries), '2026-08-31'), 1.2);

  const falling = [];
  ['2026-03', '2026-04', '2026-05'].forEach((m) => falling.push(...evenMonth(m, 10)));
  ['2026-06', '2026-07', '2026-08'].forEach((m) => falling.push(...evenMonth(m, 1)));
  assert.strictEqual(E.trendFactor(series(falling), '2026-08-31'), 0.8);

  const flat = [];
  ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'].forEach((m) => flat.push(...evenMonth(m, 5)));
  assert.ok(Math.abs(E.trendFactor(series(flat), '2026-08-31') - 1) < 1e-9);
});

test('demand class follows the number of months that had a sale', () => {
  function classFor(monthsWithSales) {
    const all = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
    const entries = all.map((month, index) => [month + '-05', index < monthsWithSales ? 10 : 0]);
    return E.demandClass(series(entries.filter((e) => e[1] > 0)), '2026-08-31').className;
  }
  assert.strictEqual(classFor(9), 'regular');
  assert.strictEqual(classFor(8), 'regular');
  assert.strictEqual(classFor(7), 'irregular');
  assert.strictEqual(classFor(5), 'irregular');
  assert.strictEqual(classFor(4), 'sparse');
  assert.strictEqual(classFor(3), 'sparse');
  assert.strictEqual(classFor(2), 'insufficient');
});

test('sparse and insufficient series return a reason, never a number', () => {
  /* historyMonths=9 states explicitly what these fixtures mean: a 9-month
     dataset in which this group only shows activity in 3 (or 2) of those
     months — not "a product we have only ever seen for 3 months", which
     is a different, self-referential question buildSeries cannot answer
     on its own (see the dynamic-window test below). Real app.js callers
     always pass the dataset's own history length the same way. */
  const sparse = series([['2026-06-02', 5], ['2026-07-03', 5], ['2026-08-04', 5]]);
  const result = E.forecastNextMonth(sparse, '2026-08-31', 9);
  assert.strictEqual(result.value, null);
  assert.strictEqual(result.reason, 'too-few-months');
  assert.ok(result.averageGapDays > 0, 'a sparse series still reports its average gap');

  const thin = series([['2026-07-03', 5], ['2026-08-04', 5]]);
  const thinResult = E.forecastNextMonth(thin, '2026-08-31', 9);
  assert.strictEqual(thinResult.value, null);
  assert.strictEqual(thinResult.reason, 'not-enough-data');
});

test('the trailing window is not hardcoded to 9 months: it follows the dataset\'s own history length', () => {
  /* Same shape as the fixed-9-month regular case above, but with 15 months
     of history and proportionally more months with a sale, to prove the
     window itself moved, not just the numbers inside a fixed 9. */
  const entries = [];
  const months15 = [];
  for (let m = '2025-06'; m <= '2026-08'; m = E.shiftMonth(m, 1)) months15.push(m);
  assert.strictEqual(months15.length, 15, 'test setup: expected 15 trailing months to 2026-08');
  months15.forEach((m) => entries.push(...evenMonth(m, 4)));
  const s = series(entries);

  const classified9 = E.demandClass(s, '2026-08-31', 9);
  const classified15 = E.demandClass(s, '2026-08-31', 15);
  assert.strictEqual(classified9.periods, 9);
  assert.strictEqual(classified15.periods, 15);
  assert.strictEqual(classified9.monthsWithSales, 9, 'only the trailing 9 of the 15 months are counted when historyMonths=9');
  assert.strictEqual(classified15.monthsWithSales, 15, 'all 15 are counted when historyMonths=15');
  assert.strictEqual(classified15.className, 'regular', '15/15 is regular under the same 8/9 proportion as the original rule');

  // A group that only sold in the most recent 5 of those 15 months reads
  // as sparse-to-insufficient against the full 15-month window, even
  // though 5 months on their own would have read as "irregular" under the
  // old fixed-9 rule -- the proportion, not the raw count, now decides.
  const fiveOf15 = [];
  months15.slice(-5).forEach((m) => fiveOf15.push(...evenMonth(m, 4)));
  const thin15 = series(fiveOf15);
  const thin15Class = E.demandClass(thin15, '2026-08-31', 15);
  assert.strictEqual(thin15Class.monthsWithSales, 5);
  assert.strictEqual(thin15Class.className, 'sparse', '5/15 = 33% falls in the sparse band, not irregular');
});

test('a series whose error is above tolerance still shows the number, graded unusable, not hidden', () => {
  /* Decided explicitly: WAPE and its grade are shown so the reader can
     judge for themselves; the app does not withhold a number just because
     its own backtest error is high, only when there is not enough history
     to compute one at all (see the sparse/insufficient test above). */
  const entries = [];
  ['2025-12', '2026-02', '2026-04', '2026-06', '2026-08'].forEach((m) => entries.push(...evenMonth(m, 40)));
  ['2026-01', '2026-03', '2026-05', '2026-07'].forEach((m) => entries.push([m + '-15', 1]));
  const result = E.forecastNextMonth(series(entries), '2026-08-31');

  assert.ok(result.wape > 0.25, `expected a high error, got ${result.wape}`);
  assert.strictEqual(result.grade, 'unusable');
  assert.ok(Number.isFinite(result.value), 'a number must still be shown even when the grade is unusable');
  assert.strictEqual(result.reason, null);
});

test('grade thresholds are the client tolerance of 10% and 15%', () => {
  assert.strictEqual(E.grade(0.05), 'good');
  assert.strictEqual(E.grade(0.10), 'good');
  assert.strictEqual(E.grade(0.101), 'fair');
  assert.strictEqual(E.grade(0.15), 'fair');
  assert.strictEqual(E.grade(0.215), 'weak');
  assert.strictEqual(E.grade(0.30), 'unusable');
  assert.strictEqual(E.grade(null), 'unknown');
});

test('no future data reaches a forecast', () => {
  const past = [];
  ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'].forEach((m) => past.push(...evenMonth(m, 10)));

  const before = E.forecastNextMonth(series(past), '2026-08-31');
  const withFuture = E.forecastNextMonth(series(past.concat(evenMonth('2026-09', 10000))), '2026-08-31');

  assert.strictEqual(before.value, withFuture.value, 'a line dated after the cutoff must not change the prediction');
  assert.strictEqual(before.wape, withFuture.wape, 'a line dated after the cutoff must not change the backtest');
});

test('the backtest never scores a month against itself', () => {
  const entries = [];
  ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'].forEach((m) => entries.push(...evenMonth(m, 7)));
  const result = E.backtest(series(entries), '2026-08-31', 3);
  result.results.forEach((point) => assert.ok(point.month <= '2026-08'));
  assert.ok(result.n >= 1);
});

test('the same input gives the same output, twice', () => {
  const entries = [];
  ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08'].forEach((m) => entries.push(...evenMonth(m, 3)));
  const a = E.forecastNextMonth(series(entries), '2026-08-31');
  const b = E.forecastNextMonth(series(entries), '2026-08-31');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

test('boundary cases: empty, one month, all zeros', () => {
  assert.deepStrictEqual(E.buildSeries([], {}), []);

  const oneMonth = series(evenMonth('2026-08', 5));
  const result = E.forecastNextMonth(oneMonth, '2026-08-31');
  assert.strictEqual(result.value, null);
  assert.strictEqual(result.reason, 'not-enough-data');

  const zeros = E.buildSeries([{ date: '2026-08-01', quantity: 0, unit: 'เมตร', code: '01-208', group: '01' }], { unit: 'เมตร' });
  assert.deepStrictEqual(zeros, [], 'a zero-quantity line starts no series');
});

test('units are never mixed into one series', () => {
  const lines = [
    { date: '2026-08-01', quantity: 10, unit: 'เมตร', code: '01-208', group: '01' },
    { date: '2026-08-02', quantity: 10, unit: 'แผ่น', code: '01-208', group: '01' },
  ];
  const metres = E.buildSeries(lines, { unit: 'เมตร' });
  assert.strictEqual(metres.length, 1);
  assert.strictEqual(metres[0].total, 10, 'the piece line must not be added to the metre series');
});

test('service and free-item groups are excluded from material series', () => {
  const lines = [
    { date: '2026-08-01', quantity: 10, unit: 'เมตร', code: '01-208', group: '01' },
    { date: '2026-08-02', quantity: 99, unit: 'เมตร', code: '77-101', group: '77' },
    { date: '2026-08-03', quantity: 99, unit: 'เมตร', code: '99-101', group: '99' },
    { date: '2026-08-04', quantity: 99, unit: 'เมตร', code: '88-101', group: '88' },
  ];
  const kept = E.buildSeries(lines, { unit: 'เมตร', excludeNonMaterial: true, key: (l) => l.group });
  assert.deepStrictEqual(kept.map((s) => s.key), ['01']);
});

test('seasonality is switched off and says why', () => {
  const entries = [];
  ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'].forEach((m) => entries.push(...evenMonth(m, 2)));
  const seasonal = E.seasonalIndex(series(entries), '2026-08-31');
  assert.strictEqual(seasonal.available, false);
  assert.strictEqual(seasonal.index, 1, 'an inert index must not scale anything');
  assert.strictEqual(seasonal.reason, 'needs-12-months');
});

test('suspected duplicate attribute values are flagged, never merged', () => {
  const groups = E.suspectedDuplicates(['Shutter Grey', 'ShutterGrey', 'ซิงค์', 'เทาเงา']);
  assert.strictEqual(groups.length, 1);
  assert.deepStrictEqual(groups[0].slice().sort(), ['Shutter Grey', 'ShutterGrey']);
});

test('group-level aggregation: two SKUs in the same group become one series when keyed by group', () => {
  const lines = [
    { date: '2026-08-01', quantity: 10, unit: 'เมตร', code: '01-101', group: '01' },
    { date: '2026-08-01', quantity: 5, unit: 'เมตร', code: '01-208', group: '01' },
    { date: '2026-08-02', quantity: 20, unit: 'เมตร', code: '02-101', group: '02' },
  ];
  const byGroup = E.buildSeries(lines, { unit: 'เมตร', key: (l) => l.group });
  assert.strictEqual(byGroup.length, 2);
  const group01 = byGroup.find((s) => s.key === '01');
  assert.strictEqual(group01.total, 15, 'both SKUs in group 01 must be summed into one series');
});

test('C1 best sellers rank by revenue or quantity and attach days of cover from typed stock', () => {
  const rows = [
    { key: '01', name: 'Group 01', quantity: 100, revenue: 5000 },
    { key: '02', name: 'Group 02', quantity: 300, revenue: 3000 },
  ];
  const byRevenue = E.bestSellers(rows, 30, new Map([['01', 50]]), 'revenue');
  assert.strictEqual(byRevenue[0].key, '01', 'higher revenue ranks first');
  assert.ok(byRevenue[0].observedOnly, 'C1 is observed history, never a forecast');
  assert.ok(Math.abs(byRevenue[0].ratePerDay - 100 / 30) < 1e-9);
  assert.strictEqual(byRevenue[0].cover.reason, undefined);
  assert.strictEqual(byRevenue[1].cover.reason, 'no-stock-entered', 'group 02 has no typed stock figure');

  const byQuantity = E.bestSellers(rows, 30, new Map(), 'quantity');
  assert.strictEqual(byQuantity[0].key, '02', 'higher quantity ranks first when ranking by quantity');
});
