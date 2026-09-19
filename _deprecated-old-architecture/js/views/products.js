/* views/products.js — ranked products, consumption rate, days of cover, and
 * the attribute views (colour, thickness, profile).
 *
 * Stock on hand is typed in by the user. There is no stock data, and the
 * screen says so wherever the figure appears.
 */
(function (MSFA) {
  'use strict';

  MSFA.views = MSFA.views || {};

  var grouping = 'code';

  MSFA.views.products = {
    render: function (panel, ctx) {
      var ui = MSFA.ui, E = MSFA.engine, t = MSFA.i18n.t;
      if (!ctx.state.dataset) { panel.appendChild(ui.emptyState('empty.products.body')); return; }

      panel.appendChild(ctx.rangeControls(ctx.refresh));

      var range = ctx.range();
      /* Metres only: units are never added together. */
      var rows = ctx.lines().filter(function (line) { return line.unit === 'เมตร'; });

      panel.appendChild(ui.filterBar([
        ui.field(t('class.label'), ui.segmented([
          { value: 'code', label: t('product.byCode') },
          { value: 'colour', label: t('product.byColour') },
          { value: 'thickness', label: t('product.byThickness') },
          { value: 'profile', label: t('product.byProfile') }
        ], {
          value: grouping,
          label: t('class.label'),
          onChange: function (value) { grouping = value; ctx.refresh(); }
        }))
      ]));

      var ranked = grouping === 'code'
        ? E.rank(rows, { key: function (line) { return line.code; }, unit: 'เมตร', excludeNonMaterial: true, cutoff: range.to })
        : E.rankByAttribute(rows, grouping, { unit: 'เมตร', excludeNonMaterial: true, cutoff: range.to });

      if (!ranked.length) { panel.appendChild(ui.card([ui.el('p', 'empty__body', t('empty.products.body'))])); return; }

      var duplicates = grouping === 'code' ? [] : E.suspectedDuplicates(ranked.map(function (r) { return r.key; }));

      var bars = ranked.slice(0, 10).map(function (item) {
        return { key: item.key, label: String(item.key), value: item.quantity, share: item.share };
      });

      var header = ui.card([
        ui.sectionHeader(t('product.title'), t('product.attributeNote')),
        MSFA.charts.rankedBars({
          items: bars,
          singleColour: true,
          title: t('product.title'),
          format: function (item) { return ui.formatNumber(item.value) + ' ' + t('unit.metre'); }
        })
      ]);
      if (duplicates.length) {
        header.appendChild(ui.el('p', 'notice notice--warn',
          t('product.duplicateWarning') + ' — ' + duplicates.map(function (g) { return g.join(' / '); }).join(', ')));
      }
      panel.appendChild(header);

      /* One row per item: rate per day, demand class, typed stock, cover. */
      var tableRows = ranked.slice(0, 40).map(function (item) {
        var demand = E.demandClass(item.series, range.to);
        var stock = ctx.state.stockOnHand[item.key];
        var cover = E.daysOfCover(stock === undefined ? null : stock, item.ratePerDay);
        return {
          key: item.key,
          label: String(item.key),
          quantity: item.quantity,
          share: item.share,
          rate: item.ratePerDay,
          demand: demand,
          stock: stock,
          cover: cover
        };
      });

      panel.appendChild(ui.card([
        ui.sectionHeader(t('product.daysOfCover'), t('product.stockNote')),
        ui.table({
          columns: [
            { key: 'label', label: grouping === 'code' ? t('product.code') : t('class.label') },
            {
              key: 'quantity', label: t('product.quantity'), num: true,
              format: function (row) { return ui.formatNumber(row.quantity) + ' ' + t('unit.metre'); }
            },
            {
              key: 'rate', label: t('product.ratePerDay'), num: true,
              format: function (row) { return ui.formatNumber(row.rate, 1) + t('unit.perDay'); }
            },
            {
              key: 'demand', label: t('class.label'),
              sortValue: function (row) { return row.demand.monthsWithSales; },
              format: function (row) {
                return ui.chip(t('class.' + row.demand.className),
                  row.demand.className === 'regular' ? 'strong' : (row.demand.className === 'insufficient' ? 'warn' : null));
              }
            },
            {
              key: 'stock', label: t('product.stockOnHand'), num: true,
              sortValue: function (row) { return row.stock === undefined ? -1 : Number(row.stock); },
              format: function (row) {
                return ui.input({
                  type: 'number', inline: true, min: 0,
                  value: row.stock === undefined ? '' : row.stock,
                  inputMode: 'decimal',
                  onChange: function (event) {
                    var value = event.target.value;
                    if (value === '') delete ctx.state.stockOnHand[row.key];
                    else ctx.state.stockOnHand[row.key] = Number(value);
                    ctx.refresh();
                  }
                });
              }
            },
            {
              key: 'cover', label: t('product.daysOfCover'), num: true,
              sortValue: function (row) { return row.cover.days === null ? -1 : row.cover.days; },
              format: function (row) {
                if (row.cover.days === null) return '—';
                var text = ui.formatNumber(row.cover.days, 1) + ' ' + t('forecast.days');
                if (!row.cover.urgent) return text;
                var wrap = ui.el('span');
                wrap.appendChild(ui.el('span', null, text + ' '));
                wrap.appendChild(ui.chip(t('product.urgent'), 'warn'));
                return wrap;
              }
            }
          ],
          rows: tableRows,
          sortKey: 'quantity'
        })
      ]));
    }
  };
})(window.MSFA = window.MSFA || {});
