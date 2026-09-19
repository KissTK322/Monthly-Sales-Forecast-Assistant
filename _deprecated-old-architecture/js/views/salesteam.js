/* views/salesteam.js — who sells what.
 *
 * The salesperson-by-product-group table is the client's explicit request:
 * Express prints columns and never shows how the data connects.
 * A sales profile sees its own figures only and no colleague comparison.
 */
(function (MSFA) {
  'use strict';

  MSFA.views = MSFA.views || {};

  MSFA.views.salesteam = {
    render: function (panel, ctx) {
      var ui = MSFA.ui, E = MSFA.engine, t = MSFA.i18n.t;
      if (!ctx.state.dataset) { panel.appendChild(ui.emptyState('empty.salesteam.body')); return; }

      panel.appendChild(ctx.rangeControls(ctx.refresh));

      var bills = ctx.invoices();
      var rows = ctx.lines();
      var scope = ctx.state.scope;
      var canCompare = !scope || scope.canCompareColleagues;

      /* Totals per salesperson. A blank code stays blank and is shown as its
         own row rather than being attached to anybody. */
      var byPerson = new Map();
      bills.forEach(function (invoice) {
        var key = invoice.salespersonCode || '';
        if (!byPerson.has(key)) byPerson.set(key, { code: key, total: 0, invoices: 0 });
        var entry = byPerson.get(key);
        entry.total += invoice.total;
        entry.invoices++;
      });

      var people = Array.from(byPerson.values()).map(function (entry) {
        return {
          code: entry.code,
          label: entry.code || t('team.blank'),
          total: entry.total,
          invoices: entry.invoices,
          average: entry.invoices ? entry.total / entry.invoices : 0
        };
      }).sort(function (a, b) { return b.total - a.total; });

      if (canCompare && people.length) {
        /* A donut is allowed here: a handful of segments after folding the
           tail into "Other". */
        panel.appendChild(ui.card([
          ui.sectionHeader(t('team.share')),
          MSFA.charts.donut({
            items: people.map(function (p) { return { key: p.code, label: p.label, value: p.total }; }),
            title: t('team.share')
          })
        ]));
      }

      panel.appendChild(ui.card([
        ui.sectionHeader(t('team.title')),
        ui.table({
          columns: [
            { key: 'label', label: t('team.salesperson') },
            { key: 'total', label: t('kpi.sales'), num: true, format: function (r) { return ui.formatNumber(r.total); } },
            { key: 'invoices', label: t('kpi.invoices'), num: true, format: function (r) { return ui.formatNumber(r.invoices); } },
            { key: 'average', label: t('kpi.averagePerInvoice'), num: true, format: function (r) { return ui.formatNumber(r.average); } }
          ],
          rows: people,
          sortKey: 'total'
        })
      ]));

      if (!canCompare) return;

      /* The matrix: salesperson down the side, product group across. */
      var groups = Array.from(new Set(rows.map(function (line) { return line.group; }).filter(Boolean))).sort();
      var matrix = people.map(function (person) {
        var row = { label: person.label };
        groups.forEach(function (group) {
          row['g' + group] = E.sum(rows.filter(function (line) {
            return (line.salespersonCode || '') === person.code && line.group === group;
          }).map(function (line) { return line.amount; }));
        });
        return row;
      });

      if (groups.length) {
        panel.appendChild(ui.card([
          ui.sectionHeader(t('team.matrix'), t('team.matrixNote')),
          ui.table({
            columns: [{ key: 'label', label: t('team.salesperson') }].concat(groups.map(function (group) {
              return {
                key: 'g' + group, label: group, num: true,
                format: function (row) { return row['g' + group] ? ui.formatNumber(row['g' + group]) : '—'; }
              };
            })),
            rows: matrix,
            sortKey: 'label',
            sortDir: 'asc'
          })
        ]));
      }
    }
  };
})(window.MSFA = window.MSFA || {});
