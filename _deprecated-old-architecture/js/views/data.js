/* views/data.js — import, reconciliation, export, device and profiles.
 *
 * Importing reads the chosen files on this device, in a worker. A failed
 * import never replaces the data already there.
 */
(function (MSFA) {
  'use strict';

  MSFA.views = MSFA.views || {};

  function importCard(ctx, refresh) {
    var ui = MSFA.ui, t = MSFA.i18n.t;
    var scope = ctx.state.scope;
    var card = ui.card([ui.sectionHeader(t('data.import.title'), t('data.import.onDevice'))]);

    card.appendChild(ui.el('p', 'empty__body', t('data.import.reports')));

    if (scope && !scope.canImport) {
      card.appendChild(ui.el('p', 'notice', t('role.' + scope.role)));
      return card;
    }

    var status = ui.el('p', 'chart-note', '');

    function handleFiles(files) {
      if (!files || !files.length) return;
      status.textContent = t('data.import.reading');

      Promise.all(Array.prototype.map.call(files, function (file) {
        return file.arrayBuffer().then(function (buffer) { return { name: file.name, buffer: buffer }; });
      })).then(function (payload) {
        return runImport(payload);
      }).then(function (dataset) {
        return MSFA.storage.putDataset(dataset).then(function () {
          MSFA.app.setDataset(dataset);
          status.textContent = '';
          ui.toast(t('data.import.done'));
          refresh();
        });
      }).catch(function (error) {
        status.textContent = '';
        /* The previous dataset is still in storage and still on screen. */
        card.appendChild(ui.inlineError(t('data.import.failed') + ' — ' + (error && error.message ? error.message : error)));
        ui.toast(t('data.import.failed'), { error: true });
      });
    }

    /* The worker keeps the interface alive; if it cannot start (a single file
       opened from a folder, for instance) the same code runs inline. */
    function runImport(payload) {
      return new Promise(function (resolve, reject) {
        var worker;
        try { worker = new Worker('js/import-worker.js'); }
        catch (error) { worker = null; }

        if (!worker) {
          try {
            var documents = payload.map(function (file) {
              var decoded = MSFA.importExpress.decodeBytes(file.buffer);
              return { name: file.name, text: decoded.text, encoding: decoded.encoding };
            });
            resolve(MSFA.importExpress.buildDataset(documents));
          } catch (error) { reject(error); }
          return;
        }

        worker.addEventListener('message', function (event) {
          var message = event.data || {};
          if (message.type === 'progress') {
            status.textContent = t('data.import.reading') + ' ' + message.step + '/' + message.total;
          } else if (message.type === 'done') {
            worker.terminate();
            resolve(message.dataset);
          } else if (message.type === 'error') {
            worker.terminate();
            reject(new Error(message.message));
          }
        });
        worker.addEventListener('error', function () { worker.terminate(); reject(new Error('worker failed')); });
        worker.postMessage({ type: 'import', files: payload });
      });
    }

    var picker = ui.fileInput({ multiple: true, onChange: handleFiles });
    card.appendChild(ui.field(t('data.import.choose'), picker));

    /* Some phone pickers grey out CSV files; this one has no filter at all. */
    var fallback = ui.fileInput({ multiple: true, accept: null, onChange: handleFiles });
    card.appendChild(ui.field(t('data.import.greyedOut'), fallback));

    card.appendChild(status);
    return card;
  }

  function reconciliationCard(ctx) {
    var ui = MSFA.ui, t = MSFA.i18n.t;
    var counts = ctx.state.dataset.counts || {};
    var rows = [
      ['data.rows.invoices', (counts.cashInvoices || 0) + (counts.creditInvoices || 0)],
      ['data.rows.lines', (counts.cashLines || 0) + (counts.creditLines || 0)],
      ['data.rows.products', counts.productCodes],
      ['data.rows.customers', counts.customers],
      ['data.rows.salespeople', counts.salespeople],
      ['data.rows.deposits', counts.depositNotes],
      ['data.rows.blankSalesperson', counts.blankSalesperson],
      ['data.rows.freeLines', counts.freeLines],
      ['data.rows.unresolved', counts.unresolved],
      ['data.rows.malformed', counts.malformed]
    ].map(function (entry) { return { label: t(entry[0]), value: entry[1] || 0 }; });

    return ui.card([
      ui.sectionHeader(t('data.reconciliation')),
      ui.table({
        columns: [
          { key: 'label', label: t('data.reconciliation') },
          { key: 'value', label: '', num: true, format: function (row) { return ui.formatNumber(row.value); } }
        ],
        rows: rows,
        sortable: false,
        scrollHint: false
      })
    ]);
  }

  function exportCard(ctx) {
    var ui = MSFA.ui, t = MSFA.i18n.t;
    var card = ui.card([ui.sectionHeader(t('data.export'), t('data.exportWarning'))]);

    card.appendChild(ui.button(t('data.export'), {
      variant: 'secondary',
      onClick: function () {
        var rows = [['date', 'invoice', 'channel', 'code', 'description', 'quantity', 'unit', 'amount']];
        ctx.lines().forEach(function (line) {
          rows.push([line.date, line.invoiceId, line.channel, line.code, line.description,
            line.quantity, line.unit || '', line.amount]);
        });
        /* A cell that starts with = + - @ is prefixed so a spreadsheet cannot
           execute it. */
        var csv = rows.map(function (row) {
          return row.map(function (cell) {
            var value = String(cell === null || cell === undefined ? '' : cell);
            if (/^[=+\-@]/.test(value)) value = "'" + value;
            return '"' + value.replace(/"/g, '""') + '"';
          }).join(',');
        }).join('\r\n');

        var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
        var file = new File([blob], 'sales-export.csv', { type: 'text/csv' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: 'sales-export.csv' }).catch(function () {});
          return;
        }
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'sales-export.csv';
        link.click();
        URL.revokeObjectURL(url);
      }
    }));

    card.appendChild(ui.el('p', 'notice notice--warn', t('data.exportWarning')));
    return card;
  }

  function deviceCard(ctx) {
    var ui = MSFA.ui, t = MSFA.i18n.t;
    var card = ui.card([ui.sectionHeader(t('data.device.title'))]);

    var list = ui.el('ul', 'list-plain');
    function row(labelKey, value) {
      var li = ui.el('li');
      var kv = ui.el('div', 'kv');
      kv.appendChild(ui.el('span', 'kv__key', t(labelKey)));
      kv.appendChild(ui.el('span', null, value));
      li.appendChild(kv);
      return li;
    }

    var persistence = ctx.state.persistence;
    list.appendChild(row('data.device.language', t('lang.' + MSFA.i18n.getLang())));
    list.appendChild(row('data.device.theme', t('theme.' + MSFA.theme.getPref())));
    list.appendChild(row('data.device.online', navigator.onLine ? t('data.online') : t('data.offline')));
    list.appendChild(row('data.device.installed', MSFA.pwa && MSFA.pwa.isStandalone() ? t('data.yes') : t('data.no')));
    list.appendChild(row('data.device.storage', MSFA.storage.isAvailable() ? t('data.yes') : t('data.no')));
    list.appendChild(row('data.device.persisted', persistence && persistence.granted ? t('data.yes') : t('data.no')));
    card.appendChild(list);

    /* iOS deletes this data if the app is not installed and not opened for a
       week, and the profiles go with it. Say so rather than letting it happen. */
    if (!persistence || !persistence.granted) {
      var warning = ui.el('div', 'notice notice--warn');
      warning.appendChild(ui.el('strong', null, t('storage.warningTitle')));
      warning.appendChild(ui.el('p', null, t('storage.warningBody')));
      card.appendChild(warning);
    }

    card.appendChild(ui.button(t('data.clear'), {
      variant: 'destructive',
      onClick: function () {
        MSFA.ui.dialog({
          title: t('data.clear'),
          content: [ui.el('p', null, t('data.clear'))],
          actions: [
            { label: t('toast.dismiss'), variant: 'secondary' },
            {
              label: t('data.clear'), variant: 'destructive',
              onClick: function () {
                MSFA.storage.clearDataset().then(function () {
                  MSFA.app.setDataset(null);
                  ui.toast(t('data.cleared'));
                  MSFA.app.renderActive();
                });
              }
            }
          ]
        });
      }
    }));

    return card;
  }

  function installCard() {
    var ui = MSFA.ui, t = MSFA.i18n.t;
    var card = ui.card([ui.sectionHeader(t('data.install.title'))]);

    var status = ui.el('p', 'empty__body', t('pwa.install.insecure'));
    status.id = 'install-status';
    card.appendChild(status);

    var steps = ui.el('ol', 'steps');
    steps.id = 'install-steps';
    steps.hidden = true;
    card.appendChild(steps);

    var button = ui.el('button', 'button', t('pwa.install.button'));
    button.id = 'install-button';
    button.type = 'button';
    button.hidden = true;
    card.appendChild(button);

    return card;
  }

  function profilesCard(ctx, refresh) {
    var ui = MSFA.ui, t = MSFA.i18n.t;
    var scope = ctx.state.scope;
    if (scope && !scope.canManageProfiles) return null;

    var card = ui.card([ui.sectionHeader(t('profile.title'), t('profile.notEncryptedTitle'))]);
    card.appendChild(ui.el('p', 'empty__body', t('profile.notEncryptedBody')));

    if (ctx.state.profile) {
      card.appendChild(ui.el('p', 'chart-note',
        t('profile.currentlyUsing') + ': ' + ctx.state.profile.displayName + ' · ' + t('role.' + ctx.state.profile.role)));
      card.appendChild(ui.button(t('profile.signOut'), { variant: 'secondary', onClick: function () { MSFA.app.signOut(); } }));
    }

    card.appendChild(ui.button(t('profile.create'), {
      variant: 'secondary',
      onClick: function () { MSFA.views.profile.openCreateDialog(ctx.state, refresh); }
    }));

    return card;
  }

  MSFA.views.data = {
    render: function (panel, ctx) {
      var refresh = ctx.refresh;
      panel.appendChild(importCard(ctx, refresh));
      if (ctx.state.dataset) {
        panel.appendChild(reconciliationCard(ctx));
        panel.appendChild(exportCard(ctx));
      }
      var profiles = profilesCard(ctx, refresh);
      if (profiles) panel.appendChild(profiles);
      panel.appendChild(installCard());
      panel.appendChild(deviceCard(ctx));

      if (MSFA.pwa && typeof MSFA.pwa.renderInstallHelp === 'function') MSFA.pwa.renderInstallHelp();
    }
  };
})(window.MSFA = window.MSFA || {});
