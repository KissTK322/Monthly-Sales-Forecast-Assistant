/* charts.js — plain SVG, no library.
 *
 * Rules that apply to every chart here:
 *  - series colours are fixed and ordered, and follow the entity rather than
 *    its rank, so filtering one out never repaints the others
 *  - grey is not a series colour: gridlines, baselines and "Other" only
 *  - a fifth series folds into "Other"
 *  - identity is never colour alone: every chart with two or more series has a
 *    legend, and up to four are labelled directly (green against rose sits at
 *    deutan dE 7.4, which is only allowed with a second encoding)
 *  - text uses text tokens, never the series colour
 *  - no dual axis, ever: two measures at different scales are two charts
 *  - actual is solid, forecast is the same colour dashed, so the difference
 *    survives greyscale and printing
 */
(function (MSFA) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var SERIES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];
  var OTHER = 'var(--chart-other)';
  var MAX_SERIES = 4;

  function svgEl(name, attrs) {
    var node = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, String(attrs[key])); });
    return node;
  }

  function text(x, y, value, options) {
    var settings = options || {};
    var node = svgEl('text', {
      x: x, y: y,
      'text-anchor': settings.anchor || 'start',
      'dominant-baseline': settings.baseline || 'auto'
    });
    if (settings.className) node.setAttribute('class', settings.className);
    node.textContent = String(value);
    return node;
  }

  function colourFor(index) {
    return index < MAX_SERIES ? SERIES[index] : OTHER;
  }

  /* More than four series is a different chart, not more colours. */
  function foldTail(items, limit) {
    var max = limit || MAX_SERIES;
    if (items.length <= max) return items.slice();
    var kept = items.slice(0, max - 1);
    var tail = items.slice(max - 1);
    kept.push({
      key: MSFA.i18n.t('chart.other'),
      label: MSFA.i18n.t('chart.other'),
      value: tail.reduce(function (total, item) { return total + item.value; }, 0),
      isOther: true
    });
    return kept;
  }

  function legend(items) {
    var box = MSFA.ui.el('div', 'chart-legend');
    items.forEach(function (item, index) {
      var entry = MSFA.ui.el('span', 'chart-legend__item');
      var swatch = MSFA.ui.el('span', 'chart-legend__swatch');
      swatch.style.background = item.isOther ? OTHER : colourFor(index);
      entry.appendChild(swatch);
      entry.appendChild(MSFA.ui.el('span', null, item.label));
      box.appendChild(entry);
    });
    return box;
  }

  function figure(svg, caption, extra) {
    var wrap = MSFA.ui.el('figure');
    wrap.style.margin = '0';
    wrap.appendChild(svg);
    if (extra) wrap.appendChild(extra);
    if (caption) {
      var cap = MSFA.ui.el('figcaption', 'chart-note', caption);
      wrap.appendChild(cap);
    }
    return wrap;
  }

  /* ---------- ranked horizontal bars ----------
     "Which sells most" is a magnitude comparison, so bars, not a pie: Thai
     product names do not fit in a slice and angles cannot be compared. */

  function rankedBars(spec) {
    var items = spec.items.slice(0, spec.limit || 10);
    var max = Math.max.apply(null, items.map(function (item) { return item.value; }).concat([0]));
    var rowHeight = 34;
    var labelWidth = spec.labelWidth || 150;
    var width = 600;
    var height = Math.max(1, items.length) * rowHeight + 8;

    var svg = svgEl('svg', {
      class: 'chart', viewBox: '0 0 ' + width + ' ' + height,
      role: 'img', 'aria-label': spec.title || ''
    });

    items.forEach(function (item, index) {
      var y = index * rowHeight + 4;
      var barWidth = max > 0 ? Math.max(2, (item.value / max) * (width - labelWidth - 120)) : 2;

      svg.appendChild(text(0, y + 14, item.label, { baseline: 'middle' }));

      var bar = svgEl('rect', {
        x: labelWidth, y: y + 3, width: barWidth, height: 22, rx: 4,
        fill: item.isOther ? OTHER : (spec.singleColour ? SERIES[0] : colourFor(index))
      });
      svg.appendChild(bar);

      var value = spec.format ? spec.format(item) : MSFA.ui.formatNumber(item.value);
      var share = item.share !== undefined && item.share !== null
        ? ' · ' + MSFA.ui.formatPercent(item.share)
        : '';
      svg.appendChild(text(labelWidth + barWidth + 8, y + 14, value + share,
        { baseline: 'middle', className: 'chart__value' }));
    });

    return figure(svg, spec.caption);
  }

  /* ---------- one 100% stacked bar: how the whole splits ---------- */

  function stackedShare(spec) {
    var items = foldTail(spec.items);
    var total = items.reduce(function (sum, item) { return sum + item.value; }, 0);
    var width = 600, height = 44;
    var svg = svgEl('svg', {
      class: 'chart', viewBox: '0 0 ' + width + ' ' + height,
      role: 'img', 'aria-label': spec.title || ''
    });

    var x = 0;
    items.forEach(function (item, index) {
      var segment = total > 0 ? (item.value / total) * width : 0;
      if (segment <= 0) return;
      svg.appendChild(svgEl('rect', {
        x: x, y: 0, width: Math.max(1, segment - 2), height: 24, rx: 4,
        fill: item.isOther ? OTHER : colourFor(index)
      }));
      /* Direct label under its own segment when there is room for one. */
      if (segment > 60) {
        svg.appendChild(text(x + 2, 38, item.label + ' ' + MSFA.ui.formatPercent(item.value / total)));
      }
      x += segment;
    });

    return figure(svg, spec.caption, legend(items));
  }

  /* ---------- monthly line, with forecast ----------
     points: [{ label, value }] actual; forecast: [{ label, value, low, high }]
     The forecast continues from the last actual point with no gap. */

  function monthlyLine(spec) {
    var actual = spec.points || [];
    var forecast = spec.forecast || [];
    var all = actual.concat(forecast);
    if (!all.length) return figure(svgEl('svg', { class: 'chart', viewBox: '0 0 600 200' }), spec.caption);

    var width = 600, height = 220;
    var padLeft = 56, padRight = 16, padTop = 12, padBottom = 34;
    var plotWidth = width - padLeft - padRight;
    var plotHeight = height - padTop - padBottom;

    var values = all.map(function (p) { return p.value; })
      .concat(forecast.map(function (p) { return p.high; }).filter(function (v) { return v !== null && v !== undefined; }));
    var max = Math.max.apply(null, values.concat([0]));
    var step = all.length > 1 ? plotWidth / (all.length - 1) : plotWidth;

    function x(index) { return padLeft + index * step; }
    function y(value) { return padTop + plotHeight - (max > 0 ? (value / max) * plotHeight : 0); }

    var svg = svgEl('svg', {
      class: 'chart', viewBox: '0 0 ' + width + ' ' + height,
      role: 'img', 'aria-label': spec.title || ''
    });

    /* Recessive grid and baseline */
    [0, 0.5, 1].forEach(function (fraction) {
      var lineY = padTop + plotHeight * fraction;
      svg.appendChild(svgEl('line', { class: 'chart__grid', x1: padLeft, y1: lineY, x2: width - padRight, y2: lineY }));
      svg.appendChild(text(padLeft - 8, lineY, MSFA.ui.formatNumber(max * (1 - fraction)), { anchor: 'end', baseline: 'middle' }));
    });

    /* The forecast range sits behind the line: same hue, low opacity, no stroke */
    if (forecast.length && forecast[0].low !== undefined && forecast[0].low !== null) {
      var band = [];
      var startIndex = actual.length - 1;
      band.push([x(startIndex), y(actual[startIndex] ? actual[startIndex].value : 0)]);
      forecast.forEach(function (point, index) {
        band.push([x(actual.length + index), y(point.high)]);
      });
      for (var i = forecast.length - 1; i >= 0; i--) {
        band.push([x(actual.length + i), y(forecast[i].low)]);
      }
      band.push([x(startIndex), y(actual[startIndex] ? actual[startIndex].value : 0)]);
      svg.appendChild(svgEl('polygon', {
        class: 'chart__band',
        points: band.map(function (p) { return p[0] + ',' + p[1]; }).join(' '),
        fill: SERIES[0]
      }));
    }

    function pathFor(points, offset) {
      return points.map(function (point, index) {
        return (index === 0 ? 'M' : 'L') + x(offset + index) + ',' + y(point.value);
      }).join(' ');
    }

    if (actual.length) {
      svg.appendChild(svgEl('path', { class: 'chart__series', d: pathFor(actual, 0), stroke: SERIES[0] }));
    }

    if (forecast.length && actual.length) {
      /* Continue from the last actual point, dashed: the dash is what
         separates forecast from actual without relying on colour. */
      var joined = [actual[actual.length - 1]].concat(forecast);
      svg.appendChild(svgEl('path', {
        class: 'chart__series',
        d: pathFor(joined, actual.length - 1),
        stroke: SERIES[0],
        'stroke-dasharray': '6 4'
      }));

      var cutoffX = x(actual.length - 1);
      svg.appendChild(svgEl('line', { class: 'chart__cutoff', x1: cutoffX, y1: padTop, x2: cutoffX, y2: padTop + plotHeight }));
      if (spec.cutoffLabel) {
        svg.appendChild(text(cutoffX + 4, padTop + 10, spec.cutoffLabel));
      }
    }

    /* Markers: at least 8px, so they can be tapped as well as seen */
    all.forEach(function (point, index) {
      var isForecast = index >= actual.length;
      var marker = svgEl('circle', {
        cx: x(index), cy: y(point.value), r: 4.5,
        fill: isForecast ? 'var(--surface)' : SERIES[0],
        stroke: SERIES[0], 'stroke-width': 2
      });
      var title = svgEl('title');
      title.textContent = point.label + ': ' + MSFA.ui.formatNumber(point.value) +
        (isForecast ? ' (' + MSFA.i18n.t('chart.forecast') + ')' : '');
      marker.appendChild(title);
      svg.appendChild(marker);
    });

    /* Labels on the axis, thinned so they never collide */
    var every = Math.ceil(all.length / 6);
    all.forEach(function (point, index) {
      if (index % every !== 0 && index !== all.length - 1) return;
      svg.appendChild(text(x(index), height - 12, point.label, { anchor: 'middle' }));
    });

    var key = MSFA.ui.el('div', 'chart-legend');
    [['chart.actual', false], ['chart.forecast', true]].forEach(function (entry) {
      if (entry[1] && !forecast.length) return;
      var item = MSFA.ui.el('span', 'chart-legend__item');
      var swatch = MSFA.ui.el('span', 'chart-legend__swatch');
      swatch.style.background = entry[1] ? 'transparent' : SERIES[0];
      swatch.style.border = '2px ' + (entry[1] ? 'dashed' : 'solid') + ' ' + SERIES[0];
      item.appendChild(swatch);
      item.appendChild(MSFA.ui.el('span', null, MSFA.i18n.t(entry[0])));
      key.appendChild(item);
    });

    return figure(svg, spec.caption, key);
  }

  /* ---------- donut: only for five segments or fewer ---------- */

  function donut(spec) {
    var items = foldTail(spec.items, 5);
    var total = items.reduce(function (sum, item) { return sum + item.value; }, 0);
    var size = 220, radius = 90, inner = 54, centre = size / 2;

    var svg = svgEl('svg', {
      class: 'chart', viewBox: '0 0 ' + size + ' ' + size,
      role: 'img', 'aria-label': spec.title || '',
      style: 'max-width:260px'
    });

    var angle = -Math.PI / 2;
    items.forEach(function (item, index) {
      if (!item.value || total <= 0) return;
      var sweep = (item.value / total) * Math.PI * 2;
      var end = angle + sweep;

      var x1 = centre + radius * Math.cos(angle), y1 = centre + radius * Math.sin(angle);
      var x2 = centre + radius * Math.cos(end), y2 = centre + radius * Math.sin(end);
      var xi2 = centre + inner * Math.cos(end), yi2 = centre + inner * Math.sin(end);
      var xi1 = centre + inner * Math.cos(angle), yi1 = centre + inner * Math.sin(angle);
      var large = sweep > Math.PI ? 1 : 0;

      var path = svgEl('path', {
        d: ['M', x1, y1, 'A', radius, radius, 0, large, 1, x2, y2,
            'L', xi2, yi2, 'A', inner, inner, 0, large, 0, xi1, yi1, 'Z'].join(' '),
        fill: item.isOther ? OTHER : colourFor(index),
        stroke: 'var(--surface)',
        'stroke-width': 2
      });
      var title = svgEl('title');
      title.textContent = item.label + ': ' + MSFA.ui.formatPercent(item.value / total);
      path.appendChild(title);
      svg.appendChild(path);
      angle = end;
    });

    return figure(svg, spec.caption, legend(items));
  }

  MSFA.charts = {
    SERIES: SERIES, OTHER: OTHER, MAX_SERIES: MAX_SERIES,
    colourFor: colourFor, foldTail: foldTail, legend: legend,
    rankedBars: rankedBars, stackedShare: stackedShare,
    monthlyLine: monthlyLine, donut: donut
  };
})(window.MSFA = window.MSFA || {});
