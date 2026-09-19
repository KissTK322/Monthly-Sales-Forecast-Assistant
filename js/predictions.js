/* js/predictions.js — group-level demand prediction, added on top of the
 * ported prototype (which forecasts per SKU only). Pure functions: canonical
 * records in, plain result objects out, no DOM access, no clock reads except
 * a cutoff passed in as an argument, so every result is reproducible and
 * every backtest is honest by construction (architecture.md 5.1).
 *
 * Scope, per CLAUDE.md section 8 (2026-09-18 decision, which supersedes the
 * ADI/CV-squared rule in the original prd.md/architecture.md — this module
 * follows the later, simpler, shipped rule):
 *   - rate = quantity / days in the window
 *   - window 3 or 6 months, chosen per series by backtest, never hardcoded
 *   - damped trend factor: clamp(sqrt(recent3 / previous3), 0.8, 1.2)
 *   - rolling-origin backtest; WAPE headline, 10% / 15% grading, no figure
 *     shown above 25% error
 *   - demand pattern by months with sales in the trailing 9-month window:
 *     8-9 forecast, 5-7 flagged, 3-4 gap only, under 3 nothing
 *   - seasonal method present but switched off until 12+ months of history
 * A function that cannot produce a result returns a reason, never a
 * substituted number. Null is never coerced to zero.
 */
(function (root) {
  'use strict';

  /* ---------- date helpers ---------- */

  function daysInMonth(month) {
    const [y, m] = month.split('-').map(Number);
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  }
  function monthEnd(month) {
    return `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
  }
  function shiftMonth(month, delta) {
    const [y, m] = month.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
  }
  function daysBetween(fromDate, toDate) {
    return Math.round((Date.parse(toDate + 'T00:00:00Z') - Date.parse(fromDate + 'T00:00:00Z')) / 86400000);
  }

  /* ---------- series construction ---------- */

  const NON_MATERIAL_GROUPS = ['77', '88', '99'];

  /* lines: [{date:'YYYY-MM-DD', quantity, unit, code, group}], options:
     {unit, excludeNonMaterial, key(line)->string}. Default key is the SKU
     code; pass key: line => line.group for the group-level series this
     module's forecast panel actually uses. */
  function buildSeries(lines, options) {
    const opts = options || {};
    const unit = opts.unit;
    const excludeNonMaterial = !!opts.excludeNonMaterial;
    const key = opts.key || ((line) => line.code);
    const groups = new Map();
    for (const line of lines) {
      if (unit && line.unit !== unit) continue;
      const quantity = Number(line.quantity);
      if (!(quantity > 0)) continue; // a zero-quantity or invalid line starts no series
      if (excludeNonMaterial && NON_MATERIAL_GROUPS.includes(String(line.group))) continue;
      const k = key(line);
      if (!groups.has(k)) groups.set(k, { key: k, unit: line.unit, total: 0, lines: [] });
      const series = groups.get(k);
      series.total += quantity;
      series.lines.push({ date: line.date, quantity });
    }
    for (const series of groups.values()) series.lines.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return [...groups.values()];
  }

  /* ---------- rate and cover ---------- */

  function rateBetween(series, fromDate, toDate) {
    const quantity = series.lines
      .filter((l) => l.date >= fromDate && l.date <= toDate)
      .reduce((sum, l) => sum + l.quantity, 0);
    const days = daysBetween(fromDate, toDate) + 1;
    return { days, quantity, rate: days > 0 ? quantity / days : 0 };
  }

  function daysOfCover(stock, ratePerDay) {
    if (stock === null || stock === '' || stock === undefined) return { days: null, reason: 'no-stock-entered' };
    if (!(ratePerDay > 0)) return { days: null, reason: 'no-rate' };
    const days = Number(stock) / ratePerDay;
    return { days, urgent: days < 5 };
  }

  /* ---------- internal monthly helpers ---------- */

  function monthlyTotals(series, cutoffMonth) {
    const totals = new Map();
    for (const line of series.lines) {
      const month = line.date.slice(0, 7);
      if (month > cutoffMonth) continue; // no future data ever reaches a result
      totals.set(month, (totals.get(month) || 0) + line.quantity);
    }
    return totals;
  }

  function trailingMonths(cutoffMonth, count) {
    const out = [];
    let month = cutoffMonth;
    for (let i = 0; i < count; i++) {
      out.unshift(month);
      month = shiftMonth(month, -1);
    }
    return out;
  }

  function weightedRate(totals, months) {
    const values = months.map((m) => (totals.get(m) || 0) / daysInMonth(m));
    const n = values.length;
    if (!n) return 0;
    const weightTotal = (n * (n + 1)) / 2;
    return values.reduce((sum, v, i) => sum + v * (i + 1), 0) / weightTotal;
  }

  /* ---------- demand classification ---------- */

  function monthsWithSalesInTrailingWindow(series, cutoffDate, windowSize) {
    const cutoffMonth = cutoffDate.slice(0, 7);
    const totals = monthlyTotals(series, cutoffMonth);
    const window = trailingMonths(cutoffMonth, windowSize);
    return window.filter((m) => (totals.get(m) || 0) > 0).length;
  }

  /* How many trailing months this ONE series itself spans, earliest sale to
     cutoff. Used only as a fallback when no dataset-wide history length is
     supplied — see the historyMonths parameter below. */
  function seriesHistoryMonths(series, cutoffDate) {
    if (!series.lines.length) return 0;
    const cutoffMonth = cutoffDate.slice(0, 7);
    const earliestMonth = series.lines[0].date.slice(0, 7);
    let count = 0;
    for (let m = earliestMonth; m <= cutoffMonth; m = shiftMonth(m, 1)) count++;
    return count;
  }

  /* The original rule was fixed at 9 trailing months: 8-9 regular, 5-7
     irregular, 3-4 sparse, under 3 insufficient (CLAUDE.md section 8). That
     is a fixed CALENDAR-MONTH GUARD for the "insufficient" floor (under 3
     months of anything is never enough, regardless of window size) plus a
     PROPORTION for the rest, so the same call works once more history
     arrives (prd.md section 13, Q1): a 15-month window needs the same
     8/9 share (>=13.3, i.e. >=14 months) to read as regular, not a fixed
     8 months out of 15. The three cut ratios are exactly the original
     9-month thresholds (8/9, 5/9, 3/9), kept as exact fractions rather than
     rounded percentages so the original 9-month case is bit-for-bit
     unchanged (8/9 = 88.9%, which a rounded ">=89%" check would wrongly
     fail). */
  function classifyMonthsWithSales(monthsWithSales, windowSize) {
    if (!windowSize || windowSize < 3 || monthsWithSales < 3) return 'insufficient';
    const ratio = monthsWithSales / windowSize;
    if (ratio >= 8 / 9 - 1e-9) return 'regular';
    if (ratio >= 5 / 9 - 1e-9) return 'irregular';
    return 'sparse';
  }

  /* historyMonths: the number of trailing months to classify over. Pass the
     dataset's own overall history length (the same value for every series
     being compared) so all groups are judged on the same calendar span;
     omit it only for a single series considered on its own (falls back to
     that series' own span), which is what makes every existing test still
     construct its own scenario without having to state the window twice. */
  function demandClass(series, cutoffDate, historyMonths) {
    const windowSize = historyMonths || seriesHistoryMonths(series, cutoffDate);
    const monthsWithSales = monthsWithSalesInTrailingWindow(series, cutoffDate, windowSize);
    const className = classifyMonthsWithSales(monthsWithSales, windowSize);
    return {
      className,
      monthsWithSales,
      periods: windowSize,
      periodType: 'month',
      cutoff: cutoffDate,
      advice: {
        regular: { en: 'Regular demand; the group forecast is shown.', th: 'ยอดขายสม่ำเสมอ แสดงตัวเลขคาดการณ์' },
        irregular: { en: 'Sells most months; forecast shown but flagged as less certain.', th: 'ขายเกือบทุกเดือน แสดงตัวเลขแต่ทำเครื่องหมายว่าความแน่นอนต่ำกว่า' },
        sparse: { en: 'Too few months with sales for a number; only the sales gap is shown.', th: 'มีเดือนที่ขายน้อยเกินจะให้ตัวเลข แสดงเฉพาะช่วงห่างของการขาย' },
        insufficient: { en: 'Not enough history to say anything about this group yet.', th: 'ประวัติยังไม่พอที่จะบอกอะไรเกี่ยวกับกลุ่มนี้ได้' },
      }[className],
    };
  }

  /* ---------- trend ---------- */

  function trendFactor(series, cutoffDate) {
    if (!series.lines.length) return 1;
    const cutoffMonth = cutoffDate.slice(0, 7);
    const window6 = trailingMonths(cutoffMonth, 6);
    const earliestMonth = series.lines[0].date.slice(0, 7);
    /* The earlier comparison window reaching back before the first sale is
       meaningless, not a mild trend of 1 — CLAUDE.md section 8. */
    if (earliestMonth > window6[0]) return 1;
    const totals = monthlyTotals(series, cutoffMonth);
    const rates = window6.map((m) => (totals.get(m) || 0) / daysInMonth(m));
    const recentAvg = (rates[3] + rates[4] + rates[5]) / 3;
    const previousAvg = (rates[0] + rates[1] + rates[2]) / 3;
    if (!(previousAvg > 0)) return 1;
    const ratio = recentAvg / previousAvg;
    return Math.min(1.2, Math.max(0.8, Math.sqrt(Math.max(0, ratio))));
  }

  /* ---------- backtest ---------- */

  function backtest(series, cutoffDate, window) {
    if (!series.lines.length) return { results: [], n: 0, wape: null, window };
    const cutoffMonth = cutoffDate.slice(0, 7);
    const totals = monthlyTotals(series, cutoffMonth);
    const earliestMonth = series.lines[0].date.slice(0, 7);
    const calendar = [];
    for (let m = earliestMonth; m <= cutoffMonth; m = shiftMonth(m, 1)) calendar.push(m);

    const results = [];
    for (let i = window; i < calendar.length; i++) {
      const targetMonth = calendar[i];
      const priorMonths = calendar.slice(i - window, i);
      const predicted = weightedRate(totals, priorMonths) * daysInMonth(targetMonth);
      const actual = totals.get(targetMonth) || 0;
      results.push({ month: targetMonth, actual, predicted });
    }
    const denominator = results.reduce((sum, r) => sum + r.actual, 0);
    const wape = results.length && denominator > 0
      ? results.reduce((sum, r) => sum + Math.abs(r.actual - r.predicted), 0) / denominator
      : results.length ? 0 : null;
    return { results, n: results.length, wape, window };
  }

  /* ---------- grading ---------- */

  function grade(wape) {
    if (wape === null || wape === undefined || !Number.isFinite(wape)) return 'unknown';
    if (wape <= 0.10) return 'good';
    if (wape <= 0.15) return 'fair';
    if (wape <= 0.25) return 'weak';
    return 'unusable';
  }

  /* ---------- next-month forecast ---------- */

  function averageGapDays(series) {
    const lines = series.lines;
    if (lines.length < 2) return null;
    let totalGap = 0;
    for (let i = 1; i < lines.length; i++) totalGap += daysBetween(lines[i - 1].date, lines[i].date);
    return totalGap / (lines.length - 1);
  }

  function forecastNextMonth(series, cutoffDate, historyMonths) {
    const cutoffMonth = cutoffDate.slice(0, 7);
    const targetMonth = shiftMonth(cutoffMonth, 1);
    const unit = series.unit;
    const windowSize = historyMonths || seriesHistoryMonths(series, cutoffDate);
    const monthsWithSales = monthsWithSalesInTrailingWindow(series, cutoffDate, windowSize);
    const className = classifyMonthsWithSales(monthsWithSales, windowSize);

    const base = {
      targetMonth, unit, method: 'consumption-rate', cutoff: cutoffDate,
      demandClass: className, monthsWithSales, n: series.lines.length,
    };

    if (className === 'insufficient') {
      return { ...base, ratePerDay: null, value: null, wape: null, grade: 'unknown', window: null, reason: 'not-enough-data', averageGapDays: averageGapDays(series) };
    }
    if (className === 'sparse') {
      return { ...base, ratePerDay: null, value: null, wape: null, grade: 'unknown', window: null, reason: 'too-few-months', averageGapDays: averageGapDays(series) };
    }

    const totals = monthlyTotals(series, cutoffMonth);
    const candidates = [3, 6]
      .map((window) => ({ window, result: backtest(series, cutoffDate, window) }))
      .filter((c) => c.result.n > 0);
    if (!candidates.length) {
      return { ...base, ratePerDay: null, value: null, wape: null, grade: 'unknown', window: null, reason: 'not-enough-data', averageGapDays: averageGapDays(series) };
    }
    candidates.sort((a, b) => a.result.wape - b.result.wape);
    const chosen = candidates[0];
    const wape = chosen.result.wape;
    const forecastGrade = grade(wape);

    /* A number is always shown once the method can actually run (enough
       months with sales to pick a window and backtest it). WAPE and its
       good/fair/weak/unusable grade are shown alongside it so the person
       reading the number can judge it themselves; the app does not decide
       on their behalf that a number is too unreliable to see. The only
       reasons a number is withheld are the two returns above, where there
       is not enough history to compute anything at all. */
    const recentMonths = trailingMonths(cutoffMonth, chosen.window);
    const ratePerDay = weightedRate(totals, recentMonths) * trendFactor(series, cutoffDate);
    const value = ratePerDay * daysInMonth(targetMonth);

    return { ...base, ratePerDay, value, wape, grade: forecastGrade, window: chosen.window, reason: null };
  }

  /* ---------- seasonality (present, switched off) ---------- */

  function seasonalIndex(series, cutoffDate) {
    const cutoffMonth = cutoffDate.slice(0, 7);
    const totals = monthlyTotals(series, cutoffMonth);
    if (totals.size < 12) {
      return { available: false, index: 1, reason: 'needs-12-months' };
    }
    const targetMonthKey = shiftMonth(cutoffMonth, 1).slice(5, 7);
    const sameMonthValues = [...totals.entries()].filter(([m]) => m.slice(5, 7) === targetMonthKey).map(([, v]) => v);
    const overallAvg = [...totals.values()].reduce((a, b) => a + b, 0) / totals.size;
    if (!sameMonthValues.length || !(overallAvg > 0)) return { available: false, index: 1, reason: 'needs-12-months' };
    const sameMonthAvg = sameMonthValues.reduce((a, b) => a + b, 0) / sameMonthValues.length;
    return { available: true, index: Math.min(1.3, Math.max(0.7, sameMonthAvg / overallAvg)), reason: null };
  }

  /* ---------- attribute-value hygiene ---------- */

  /* Flags raw attribute values (colour, profile...) that look like the same
     thing typed two ways, without ever merging them by guesswork — a client-
     confirmed mapping table is the only thing allowed to merge values. */
  function suspectedDuplicates(values) {
    const normalized = new Map();
    for (const value of values) {
      const key = String(value).replace(/\s+/g, '').toLowerCase();
      if (!normalized.has(key)) normalized.set(key, new Set());
      normalized.get(key).add(value);
    }
    return [...normalized.values()].map((set) => [...set]).filter((group) => group.length > 1);
  }

  /* ---------- C1: observed best sellers with days of cover ---------- */

  /* rows: [{key, name, quantity, revenue}] for one closed period; stock: a
     Map key -> typed-in on-hand figure (or undefined/''/null when not
     entered). windowDays: the number of days the quantity was measured
     over, so rate = quantity / windowDays, matching rateBetween. */
  function bestSellers(rows, windowDays, stockByKey, measure) {
    const metric = measure === 'quantity' ? 'quantity' : 'revenue';
    const ranked = rows.slice().sort((a, b) => b[metric] - a[metric]);
    return ranked.map((row) => {
      const ratePerDay = windowDays > 0 ? row.quantity / windowDays : 0;
      const stock = stockByKey ? stockByKey.get(row.key) : undefined;
      const cover = daysOfCover(stock === undefined ? null : stock, ratePerDay);
      return { ...row, ratePerDay, windowDays, cover, observedOnly: true };
    });
  }

  const Predictions = {
    daysInMonth, monthEnd, shiftMonth, daysBetween,
    buildSeries, rateBetween, daysOfCover,
    demandClass, trendFactor, backtest, grade, forecastNextMonth,
    seasonalIndex, suspectedDuplicates, bestSellers,
  };

  root.Predictions = Predictions;
  if (typeof module !== 'undefined') module.exports = Predictions;
})(typeof window === 'undefined' ? globalThis : window);
