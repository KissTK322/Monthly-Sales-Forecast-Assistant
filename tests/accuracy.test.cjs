/* tests/accuracy.test.cjs — the accuracy metrics shown beside WAPE.
 * Hand-worked example, three backtest months (error = predicted - actual):
 *   actual 100, predicted 110, naive  90  -> error +10, naive error 10
 *   actual   0, predicted  20, naive 100  -> error +20, naive error 100
 *   actual  50, predicted  40, naive   0  -> error -10, naive error 50
 * sum actual 150, sum |error| 40, sum error 20, sum error^2 600, naive MAE 160/3.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const Predictions = require('../js/predictions.js');

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const results = [
  { month: '2026-06', actual: 100, predicted: 110, naive: 90 },
  { month: '2026-07', actual: 0, predicted: 20, naive: 100 },
  { month: '2026-08', actual: 50, predicted: 40, naive: 0 },
];

test('each metric matches the hand-worked example', () => {
  const m = Predictions.accuracyMetrics(results);
  assert.strictEqual(m.n, 3);
  close(m.wape, 40 / 150);
  close(m.mape, (10 / 100 + 10 / 50) / 2); // the zero-actual month is skipped
  assert.strictEqual(m.mapeSkipped, 1);
  close(m.mae, 40 / 3);
  close(m.rmse, Math.sqrt(600 / 3));
  close(m.bias, 20 / 150);
  close(m.mase, (40 / 3) / (160 / 3)); // 0.25: a quarter of the naive error
});

test('WAPE from accuracyMetrics equals the backtest headline WAPE on real-shaped data', () => {
  const lines = [];
  const months = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
  months.forEach((m, i) => { lines.push({ date: m + '-10', quantity: 100 + i * 7, unit: 'm', key: 'G' }); lines.push({ date: m + '-20', quantity: 40 + (i % 3) * 15, unit: 'm', key: 'G' }); });
  const series = Predictions.buildSeries(lines, { unit: 'm', key: () => 'G' })[0];
  const fc = Predictions.forecastNextMonth(series, '2026-08-31', 9);
  assert.ok(fc.value > 0);
  close(fc.accuracy.wape, fc.wape);
  assert.strictEqual(fc.accuracy.n, fc.backtestResults.length);
});

test('no backtest months gives no metrics', () => {
  assert.strictEqual(Predictions.accuracyMetrics([]), null);
});
