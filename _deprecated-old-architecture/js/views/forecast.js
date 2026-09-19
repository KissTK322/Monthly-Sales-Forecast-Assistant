/* views/forecast.js — next month, by product group only.
 *
 * Group level, never individual product codes: per-code forecasting was
 * measured at about 78% WAPE and does not work.
 * Every figure carries its method, window, cutoff, unit, error and n, and a
 * group whose error is too high prints the reason instead of a number.
 */
(function (MSFA) {
  'use strict';

  MSFA.views = MSFA.views || {};

  MSFA.views.forecast = {
    render: function (panel, ctx) {
      var ui = MSFA.ui, E = MSFA.engine, t = MSFA.i18n.t;
      if (!ctx.state.dataset) { panel.appendChild(ui.emptyState('empty.forecast.body')); return; }

      var cutoff = ctx.range().cutoff;
      if (!cutoff) { panel.appendChild(ui.emptyState('empty.forecast.body')); return; }

      /* The forecast always uses the whole history up to the cutoff, not the
         range picker: a three-month window would leave nothing to backtest. */
      var all = ctx.state.dataset.lines.filter(function (line) {
        if (ctx.state.filters.channel !== 'combined' && line.channel !== ctx.state.filters.channel) return false;
        if (ctx.state.scope && !MSFA.profiles.appliesTo(ctx.state.scope, line)) return false;
        return true;
      });

      var groups = E.buildSeries(all, {
        key: function (line) { return line.group; },
        unit: 'เมตร',
        excludeNonMaterial: true
      });

      var results = groups
        .map(function (series) { return E.forecastNextMonth(series, cutoff); })
        .sort(function (a, b) { return (b.value || 0) - (a.value || 0); });

      var head = ui.card([
        ui.sectionHeader(t('forecast.title'), t('forecast.methodName')),
        ui.el('p', 'chart-note',
          t('forecast.cutoff') + ' ' + ui.formatDate(cutoff) + ' · ' + t('unit.metre')),
        ui.el('p', 'notice', t('forecast.noSkuNote')),
        ui.el('p', 'notice', t('forecast.seasonalOff'))
      ]);
      panel.appendChild(head);

      results.forEach(function (result) {
        var body = [];
        var title = t('forecast.group') + ' ' + result.key;

        if (result.value === null) {
          body.push(ui.sectionHeader(title, t('forecast.noFigure')));
          body.push(ui.inlineError(t('forecast.reason.' + result.reason)));
          if (result.averageGapDays) {
            body.push(ui.el('p', 'empty__body',
              t('forecast.averageGap') + ': ' + ui.formatNumber(result.averageGapDays, 1) + ' ' + t('forecast.days')));
          }
          if (result.wape !== null && result.wape !== undefined) {
            body.push(ui.el('p', 'chart-note',
              t('forecast.error') + ' ' + ui.formatPercent(result.wape) + ' · n=' + result.n));
          }
          panel.appendChild(ui.card(body));
          return;
        }

        body.push(ui.sectionHeader(title));
        body.push(ui.kpiRow([
          {
            label: t('forecast.value') + ' · ' + result.targetMonth,
            value: ui.formatNumber(result.value), unit: t('unit.metre'),
            note: t('forecast.range') + ' ' + ui.formatNumber(result.low) + ' – ' + ui.formatNumber(result.high)
          },
          {
            label: t('product.ratePerDay'),
            value: ui.formatNumber(result.ratePerDay, 1), unit: t('unit.metre') + t('unit.perDay')
          },
          {
            label: t('forecast.error'),
            value: ui.formatPercent(result.wape),
            note: t('forecast.n') + ': ' + result.n
          }
        ]));

        if (result.warning) {
          body.push(ui.el('p', 'notice notice--warn', t('forecast.warning.' + result.warning)));
        }

        body.push(ui.el('p', 'chart-note', [
          t('forecast.method') + ': ' + t('forecast.methodName'),
          t('forecast.window') + ': ' + result.windowMonths + ' ' + t('forecast.months'),
          t('forecast.cutoff') + ': ' + ui.formatDate(result.cutoff),
          t('class.label') + ': ' + t('class.' + result.demandClass)
        ].join(' · ')));

        /* The backtest behind the number, so the reader can see the months it
           was scored on rather than taking the error on trust. */
        var detail = E.backtest(
          groups.filter(function (s) { return s.key === result.key; })[0], cutoff, result.windowMonths);

        body.push(ui.table({
          caption: t('forecast.backtest'),
          columns: [
            { key: 'month', label: t('overview.monthly') },
            { key: 'actual', label: t('chart.actual'), num: true, format: function (r) { return ui.formatNumber(r.actual); } },
            { key: 'predicted', label: t('chart.forecast'), num: true, format: function (r) { return ui.formatNumber(r.predicted); } },
            {
              key: 'difference', label: t('forecast.error'), num: true,
              sortValue: function (r) { return Math.abs(r.actual - r.predicted); },
              format: function (r) {
                return r.actual > 0 ? ui.formatPercent(Math.abs(r.actual - r.predicted) / r.actual) : '—';
              }
            }
          ],
          rows: detail.results,
          sortKey: 'month',
          sortDir: 'asc',
          scrollHint: false
        }));

        panel.appendChild(ui.card(body));
      });
    }
  };
})(window.MSFA = window.MSFA || {});
