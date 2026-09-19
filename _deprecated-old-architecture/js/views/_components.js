/* _components.js — the shared component set (M0.5).
 *
 * Every component is built as DOM with textContent. Nothing here ever accepts
 * a string of HTML, so imported text cannot become markup.
 * Loaded before the views; `styleguide.html` shows every component.
 */
(function (MSFA) {
  'use strict';

  var t = function (key) { return MSFA.i18n.t(key); };

  /* ---------- basics ---------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function append(parent, children) {
    (Array.isArray(children) ? children : [children]).forEach(function (child) {
      if (child) parent.appendChild(child);
    });
    return parent;
  }

  /* ---------- formatting ----------
     Gregorian dates in both languages (AGENTS.md); grouped numbers with a
     fixed number of decimals so columns line up with tabular figures. */

  function locale() {
    return MSFA.i18n.getLang() === 'th' ? 'th-TH-u-ca-gregory' : 'en-GB';
  }

  function formatNumber(value, decimals) {
    if (value === null || value === undefined || !isFinite(value)) return '—';
    var d = decimals === undefined ? 0 : decimals;
    return new Intl.NumberFormat(locale(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(value);
  }

  function formatMoney(value) {
    return formatNumber(value, 2);
  }

  function formatPercent(value, decimals) {
    if (value === null || value === undefined || !isFinite(value)) return '—';
    return formatNumber(value * 100, decimals === undefined ? 1 : decimals) + '%';
  }

  function formatDate(iso) {
    if (!iso) return '—';
    var parts = String(iso).split('-');
    if (parts.length !== 3) return String(iso);
    return new Intl.DateTimeFormat(locale(), { year: 'numeric', month: 'short', day: 'numeric' })
      .format(new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
  }

  /* ---------- card, section header ---------- */

  function card(children, className) {
    return append(el('div', 'card' + (className ? ' ' + className : '')), children);
  }

  function sectionHeader(title, note) {
    var header = el('div', 'section-header');
    header.appendChild(el('h2', 'section-header__title', title));
    if (note) header.appendChild(el('p', 'section-header__note', note));
    return header;
  }

  /* ---------- KPI tile ----------
     The change indicator never relies on colour: arrow, sign and word. */

  function kpiTile(spec) {
    var tile = el('div', 'kpi');
    tile.appendChild(el('p', 'kpi__label', spec.label));

    var value = el('div', 'kpi__value', spec.value);
    if (spec.unit) value.appendChild(el('span', 'kpi__unit', spec.unit));
    tile.appendChild(value);

    if (spec.change !== undefined && spec.change !== null && isFinite(spec.change)) {
      var up = spec.change > 0;
      var flat = Math.abs(spec.change) < 0.0005;
      var line = el('p', 'kpi__change');
      line.appendChild(el('span', 'kpi__change-arrow', flat ? '→' : (up ? '↑' : '↓')));
      line.appendChild(document.createTextNode(' ' +
        (flat ? '' : (up ? '+' : '−')) +
        formatPercent(Math.abs(spec.change)) + ' ' +
        t(flat ? 'change.flat' : (up ? 'change.up' : 'change.down'))));
      if (spec.changeNote) line.appendChild(el('span', 'kpi__unit', ' ' + spec.changeNote));
      tile.appendChild(line);
    } else if (spec.note) {
      tile.appendChild(el('p', 'kpi__change', spec.note));
    }
    return tile;
  }

  function kpiRow(tiles) {
    return append(el('div', 'kpi-row'), tiles.map(kpiTile));
  }

  /* ---------- table ----------
     columns: [{ key, label, num, format, sortValue }]
     Sorting is in-memory and stable; the header button carries aria-sort. */

  function table(spec) {
    var wrap = el('div', 'table-wrap');
    var columns = spec.columns;
    var rows = spec.rows.slice();
    var sortKey = spec.sortKey || null;
    var sortDir = spec.sortDir === 'asc' ? 'asc' : 'desc';

    if (spec.scrollHint !== false) {
      wrap.appendChild(el('p', 'table-scroll-hint', t('table.scrollHint')));
    }

    var node = el('table', 'table');
    if (spec.caption) node.appendChild(el('caption', null, spec.caption));
    var thead = el('thead');
    var headRow = el('tr');
    var tbody = el('tbody');

    function valueOf(row, column) {
      if (column.sortValue) return column.sortValue(row);
      return row[column.key];
    }

    function renderBody() {
      tbody.replaceChildren();
      var ordered = rows.slice();
      if (sortKey) {
        var column = columns.filter(function (c) { return c.key === sortKey; })[0];
        if (column) {
          ordered.sort(function (a, b) {
            var av = valueOf(a, column), bv = valueOf(b, column);
            if (av === bv) return 0;
            if (av === null || av === undefined) return 1;
            if (bv === null || bv === undefined) return -1;
            var cmp = typeof av === 'number' && typeof bv === 'number'
              ? av - bv
              : String(av).localeCompare(String(bv), locale());
            return sortDir === 'asc' ? cmp : -cmp;
          });
        }
      }
      ordered.forEach(function (row) {
        var tr = el('tr');
        columns.forEach(function (column) {
          var cell = el('td', column.num ? 'num' : null);
          var content = column.format ? column.format(row) : row[column.key];
          if (content instanceof Node) cell.appendChild(content);
          else cell.textContent = content === null || content === undefined ? '—' : String(content);
          tr.appendChild(cell);
        });
        tbody.appendChild(tr);
      });
    }

    columns.forEach(function (column) {
      var th = el('th', column.num ? 'num' : null);
      th.scope = 'col';
      if (spec.sortable === false) {
        th.textContent = column.label;
      } else {
        var button = el('button', 'sort');
        button.type = 'button';
        button.appendChild(el('span', null, column.label));
        var mark = el('span', 'sort__mark', '');
        button.appendChild(mark);
        button.addEventListener('click', function () {
          if (sortKey === column.key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
          else { sortKey = column.key; sortDir = column.num ? 'desc' : 'asc'; }
          updateHeaders();
          renderBody();
        });
        th.appendChild(button);
      }
      headRow.appendChild(th);
    });

    function updateHeaders() {
      Array.prototype.forEach.call(headRow.children, function (th, index) {
        var column = columns[index];
        var mark = th.querySelector('.sort__mark');
        if (sortKey === column.key) {
          th.setAttribute('aria-sort', sortDir === 'asc' ? 'ascending' : 'descending');
          if (mark) mark.textContent = sortDir === 'asc' ? '▲' : '▼';
        } else {
          th.removeAttribute('aria-sort');
          if (mark) mark.textContent = '';
        }
      });
    }

    thead.appendChild(headRow);
    node.appendChild(thead);
    node.appendChild(tbody);
    updateHeaders();
    renderBody();
    wrap.appendChild(node);

    return wrap;
  }

  /* ---------- form controls ---------- */

  function button(label, opts) {
    var options = opts || {};
    var node = el('button', 'button' + (options.variant ? ' button--' + options.variant : ''), label);
    node.type = options.type || 'button';
    if (options.onClick) node.addEventListener('click', options.onClick);
    if (options.disabled) node.disabled = true;
    return node;
  }

  function field(labelText, control, hint) {
    var wrap = el('label', 'field');
    wrap.appendChild(el('span', 'field__label', labelText));
    wrap.appendChild(control);
    if (hint) wrap.appendChild(el('span', 'field__hint', hint));
    return wrap;
  }

  function input(opts) {
    var options = opts || {};
    var node = el('input', 'input' + (options.inline ? ' input--inline' : ''));
    node.type = options.type || 'text';
    if (options.value !== undefined && options.value !== null) node.value = options.value;
    if (options.placeholder) node.placeholder = options.placeholder;
    if (options.inputMode) node.inputMode = options.inputMode;
    if (options.min !== undefined) node.min = options.min;
    if (options.onInput) node.addEventListener('input', options.onInput);
    if (options.onChange) node.addEventListener('change', options.onChange);
    return node;
  }

  function select(options, opts) {
    var settings = opts || {};
    var node = el('select', 'select');
    options.forEach(function (option) {
      var item = el('option', null, option.label);
      item.value = option.value;
      node.appendChild(item);
    });
    if (settings.value !== undefined) node.value = settings.value;
    if (settings.disabled) node.disabled = true;
    if (settings.onChange) node.addEventListener('change', function () { settings.onChange(node.value); });
    return node;
  }

  function segmented(options, opts) {
    var settings = opts || {};
    var group = el('div', 'segmented');
    group.setAttribute('role', 'group');
    if (settings.label) group.setAttribute('aria-label', settings.label);

    options.forEach(function (option) {
      var node = el('button', 'segmented__option', option.label);
      node.type = 'button';
      node.setAttribute('aria-pressed', String(option.value === settings.value));
      node.addEventListener('click', function () {
        Array.prototype.forEach.call(group.children, function (child) {
          child.setAttribute('aria-pressed', String(child === node));
        });
        if (settings.onChange) settings.onChange(option.value);
      });
      node.addEventListener('keydown', function (event) {
        var items = Array.prototype.slice.call(group.children);
        var index = items.indexOf(node);
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();
          var next = items[(index + (event.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length];
          next.focus();
        }
      });
      group.appendChild(node);
    });
    return group;
  }

  function choice(labelText, opts) {
    var settings = opts || {};
    var wrap = el('label', 'choice');
    var box = el('input');
    box.type = settings.type || 'checkbox';
    if (settings.name) box.name = settings.name;
    box.checked = !!settings.checked;
    if (settings.onChange) box.addEventListener('change', function () { settings.onChange(box.checked); });
    wrap.appendChild(box);
    wrap.appendChild(el('span', null, labelText));
    return wrap;
  }

  function fileInput(opts) {
    var settings = opts || {};
    var node = el('input', 'file-input');
    node.type = 'file';
    if (settings.multiple) node.multiple = true;
    /* Both extensions and MIME types, because phone pickers disagree (FR25) */
    if (settings.accept !== null) node.accept = settings.accept || '.csv,text/csv,text/plain,application/vnd.ms-excel';
    if (settings.onChange) node.addEventListener('change', function () { settings.onChange(node.files); });
    return node;
  }

  function filterBar(children) {
    var bar = el('div', 'filter-bar');
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', t('filter.barLabel'));
    return append(bar, children);
  }

  function chip(label, variant) {
    return el('span', 'chip' + (variant ? ' chip--' + variant : ''), label);
  }

  /* ---------- states ---------- */

  function emptyState(bodyKey, actionHref) {
    var box = el('div', 'card empty');
    box.appendChild(el('h2', 'empty__title', t('empty.noData')));
    box.appendChild(el('p', 'empty__body', t(bodyKey)));
    var link = el('a', 'button button--link', t('empty.action'));
    link.setAttribute('href', actionHref || '#data');
    box.appendChild(link);
    box.appendChild(el('p', 'empty__later', t('empty.later')));
    return box;
  }

  function skeleton(count, tall) {
    var wrap = el('div');
    wrap.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < (count || 3); i++) {
      wrap.appendChild(el('div', 'skeleton' + (tall ? ' skeleton--tall' : '')));
    }
    return wrap;
  }

  function inlineError(message) {
    var box = el('div', 'inline-error');
    box.setAttribute('role', 'alert');
    box.appendChild(el('span', 'inline-error__mark', '!'));
    box.appendChild(el('span', null, message));
    return box;
  }

  /* Success messages clear themselves; errors stay until dismissed, because a
     message that disappears on a timer fails people who read slowly. */
  function toast(message, opts) {
    var settings = opts || {};
    var region = document.getElementById('toast-region');
    if (!region) return null;

    var node = el('div', 'toast');
    node.setAttribute('role', settings.error ? 'alert' : 'status');
    node.appendChild(el('span', null, message));
    node.appendChild(button(t('toast.dismiss'), {
      variant: 'quiet',
      onClick: function () { node.remove(); }
    }));
    region.appendChild(node);

    if (!settings.error) {
      var timer = setTimeout(function () { node.remove(); }, 6000);
      /* No timers running in a hidden tab (NFR15) */
      document.addEventListener('visibilitychange', function handler() {
        if (document.visibilityState === 'hidden') {
          clearTimeout(timer);
          document.removeEventListener('visibilitychange', handler);
        }
      });
    }
    return node;
  }

  /* A modal on desktop, a bottom sheet under 600px (CSS decides which). */
  function dialog(spec) {
    var node = el('dialog', 'dialog');
    if (spec.title) node.appendChild(el('h2', 'dialog__title', spec.title));
    append(node, spec.content);

    var actions = el('div', 'dialog__actions');
    (spec.actions || []).forEach(function (action) {
      actions.appendChild(button(action.label, {
        variant: action.variant,
        onClick: function () {
          if (action.onClick) action.onClick(node);
          if (action.close !== false) node.close();
        }
      }));
    });
    node.appendChild(actions);

    node.addEventListener('close', function () { node.remove(); });
    document.body.appendChild(node);
    if (typeof node.showModal === 'function') node.showModal();
    else node.setAttribute('open', '');
    return node;
  }

  /* The page must never scroll sideways (NFR02). A table wider than the space
     it has scrolls inside its own box instead of pushing the page out. This
     is measured, not guessed: it depends on the language, the data and the
     window. Called once a panel is on screen, and again on resize. */
  function fitTables(root) {
    (root || document).querySelectorAll('.table-wrap').forEach(function (wrap) {
      var table = wrap.querySelector('table');
      if (!table || !wrap.clientWidth) return;
      wrap.classList.remove('table-wrap--scroll');
      if (table.scrollWidth > wrap.clientWidth + 1) wrap.classList.add('table-wrap--scroll');
    });
  }

  MSFA.ui = {
    el: el, append: append, fitTables: fitTables,
    formatNumber: formatNumber, formatMoney: formatMoney,
    formatPercent: formatPercent, formatDate: formatDate,
    card: card, sectionHeader: sectionHeader,
    kpiTile: kpiTile, kpiRow: kpiRow, table: table,
    button: button, field: field, input: input, select: select,
    segmented: segmented, choice: choice, fileInput: fileInput,
    filterBar: filterBar, chip: chip,
    emptyState: emptyState, skeleton: skeleton,
    inlineError: inlineError, toast: toast, dialog: dialog
  };
})(window.MSFA = window.MSFA || {});
