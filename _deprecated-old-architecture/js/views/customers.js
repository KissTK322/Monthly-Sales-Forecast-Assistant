/* views/customers.js — customer ranking.
 *
 * Credit customers have no code in the source, so they are shown by their
 * printed name and flagged until the client supplies a mapping.
 */
(function (MSFA) {
  'use strict';

  MSFA.views = MSFA.views || {};

  MSFA.views.customers = {
    render: function (panel, ctx) {
      var ui = MSFA.ui, t = MSFA.i18n.t;
      if (!ctx.state.dataset) { panel.appendChild(ui.emptyState('empty.customers.body')); return; }

      panel.appendChild(ctx.rangeControls(ctx.refresh));

      var names = new Map();
      (ctx.state.dataset.customers || []).forEach(function (customer) { names.set(customer.id, customer); });

      var byCustomer = new Map();
      ctx.invoices().forEach(function (invoice) {
        var key = invoice.customerId;
        if (!byCustomer.has(key)) byCustomer.set(key, { id: key, total: 0, invoices: 0 });
        var entry = byCustomer.get(key);
        entry.total += invoice.total;
        entry.invoices++;
      });

      var rows = Array.from(byCustomer.values()).map(function (entry) {
        var customer = names.get(entry.id);
        return {
          id: entry.id,
          name: customer ? customer.name : entry.id,
          mapped: customer ? customer.hasSourceCode : true,
          total: entry.total,
          invoices: entry.invoices,
          average: entry.invoices ? entry.total / entry.invoices : 0
        };
      }).sort(function (a, b) { return b.total - a.total; });

      panel.appendChild(ui.card([
        ui.sectionHeader(t('customer.title')),
        ui.table({
          columns: [
            {
              key: 'name', label: t('customer.name'),
              format: function (row) {
                if (row.mapped) return row.name;
                var wrap = ui.el('span');
                wrap.appendChild(ui.el('span', null, row.name + ' '));
                wrap.appendChild(ui.chip(t('customer.unmapped'), 'warn'));
                return wrap;
              }
            },
            { key: 'total', label: t('customer.total'), num: true, format: function (r) { return ui.formatNumber(r.total); } },
            { key: 'invoices', label: t('customer.invoices'), num: true, format: function (r) { return ui.formatNumber(r.invoices); } },
            { key: 'average', label: t('customer.average'), num: true, format: function (r) { return ui.formatNumber(r.average); } }
          ],
          rows: rows.slice(0, 50),
          sortKey: 'total'
        })
      ]));
    }
  };
})(window.MSFA = window.MSFA || {});
