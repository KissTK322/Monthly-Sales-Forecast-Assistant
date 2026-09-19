/* views/overview.js — KPIs, the product-group split, and the monthly trend. */
(function (MSFA) {
  'use strict';

  MSFA.views = MSFA.views || {};

  MSFA.views.overview = {
    render: function (panel, ctx) {
      var ui = MSFA.ui, E = MSFA.engine, t = MSFA.i18n.t;
      if (!ctx.state.dataset) { panel.appendChild(ui.emptyState('empty.overview.body')); return; }

      panel.appendChild(ctx.rangeControls(ctx.refresh));

      var range = ctx.range();
      var rows = ctx.lines();
      var bills = ctx.invoices();

      var total = E.sum(bills.map(function (i) { return i.total; }));
      var average = bills.length ? total / bills.length : 0;
      var perDay = range.days > 0 ? total / range.days : 0;

      /* The preceding window of the same length, so the comparison is fair. */
      var previousTo = E.addDays(range.from, -1);
      var previousFrom = E.addDays(previousTo, -(range.days - 1));
      var previousTotal = E.sum(ctx.state.dataset.invoices.filter(function (invoice) {
        if (invoice.date < previousFrom || invoice.date > previousTo) return false;
        if (ctx.state.filters.channel !== 'combined' && invoice.channel !== ctx.state.filters.channel) return false;
        if (ctx.state.scope && ctx.state.scope.salespersonCode && invoice.salespersonCode !== ctx.state.scope.salespersonCode) return false;
        return true;
      }).map(function (i) { return i.total; }));

      panel.appendChild(ui.kpiRow([
        {
          label: t('kpi.sales'), value: ui.formatNumber(total), unit: t('unit.baht'),
          change: previousTotal > 0 ? (total - previousTotal) / previousTotal : null,
          changeNote: t('change.vsPrevious')
        },
        { label: t('kpi.invoices'), value: ui.formatNumber(bills.length) },
        { label: t('kpi.averagePerInvoice'), value: ui.formatNumber(average), unit: t('unit.baht') },
        {
          label: t('kpi.sales') + ' · ' + t('kpi.perDay'),
          value: ui.formatNumber(perDay), unit: t('unit.baht'),
          note: ui.formatDate(range.from) + ' – ' + ui.formatDate(range.to)
        }
      ]));

      /* One 100% stacked bar: how the whole splits. */
      var byGroup = E.rank(rows, { key: function (line) { return line.group; } })
        .map(function (item) {
          return { key: item.key, label: item.key || t('product.unmapped'), value: item.quantity, share: item.share };
        });

      if (byGroup.length) {
        panel.appendChild(ui.card([
          ui.sectionHeader(t('overview.groupSplit'), t('product.attributeNote')),
          MSFA.charts.stackedShare({ items: byGroup, title: t('overview.groupSplit') }),
          ui.table({
            caption: t('table.view'),
            columns: [
              { key: 'label', label: t('forecast.group') },
              { key: 'value', label: t('product.quantity'), num: true, format: function (row) { return ui.formatNumber(row.value); } },
              { key: 'share', label: t('product.share'), num: true, format: function (row) { return ui.formatPercent(row.share); } }
            ],
            rows: byGroup,
            sortKey: 'value',
            scrollHint: false
          })
        ]));
      }

      /* Monthly line: actuals only, never past the cutoff. */
      var months = [];
      var month = E.monthOf(range.from);
      while (month <= E.monthOf(range.to)) { months.push(month); month = E.shiftMonth(month, 1); }

      var points = months.map(function (m) {
        var from = E.monthStart(m) < range.from ? range.from : E.monthStart(m);
        var to = E.monthEnd(m) > range.to ? range.to : E.monthEnd(m);
        var value = E.sum(bills.filter(function (i) { return i.date >= from && i.date <= to; })
          .map(function (i) { return i.total; }));
        return { label: m, value: value };
      });

      if (points.length) {
        panel.appendChild(ui.card([
          ui.sectionHeader(t('overview.monthly'), range.partial ? t('range.partial') : null),
          MSFA.charts.monthlyLine({ points: points, title: t('overview.monthly') }),
          ui.table({
            caption: t('table.view'),
            columns: [
              { key: 'label', label: t('overview.monthly') },
              { key: 'value', label: t('kpi.sales'), num: true, format: function (row) { return ui.formatNumber(row.value); } }
            ],
            rows: points,
            sortKey: 'label',
            sortDir: 'asc',
            scrollHint: false
          })
        ]));
      }
    }
  };
})(window.MSFA = window.MSFA || {});
