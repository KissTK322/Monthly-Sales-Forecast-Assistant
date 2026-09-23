/* js/motion.js — motion for page entry, the nav indicator, KPI count-up,
 * chart reveal, a skeleton for slow tabs, and smooth <details>.
 *
 * Rules this file keeps:
 *   - It never reads or changes data. app.js renders first; this file only
 *     animates what is already in the DOM, and every counted-up number ends on
 *     the exact text app.js wrote.
 *   - Only transform and opacity are animated (the CSS lives at the end of
 *     css/styles.css).
 *   - Animation happens when a page is ENTERED (role + tab changed). A render
 *     caused by a filter, a search keystroke, the language or the theme on the
 *     same page does not animate.
 *   - prefers-reduced-motion: page entry becomes a short fade; nothing moves.
 *
 * app.js calls two functions:
 *   Motion.navigate(button, key, run)  from the nav click handler
 *   Motion.afterRender(key)            at the end of every render ('' = locked)
 */
(function (root) {
  'use strict';

  const SKELETON_AFTER_MS = 150; // show a skeleton only if this tab's last render was slower
  const STAGGER_MS = 40;         // gap between staggered items
  const STAGGER_MAX = 6;         // items after the sixth all start together
  const COUNT_MS = 500;          // KPI count-up
  const BAR_STAGGER_MS = 30;

  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const wide = () => !!(root.matchMedia && root.matchMedia('(min-width: 901px)').matches);

  const lastRenderMs = new Map(); // page key -> ms of its last render started from the nav
  const visited = new Set();      // page keys already opened this session (count-up runs once)
  let lastKey = '';
  let indicatorAt = null;         // last transform; survives nav re-renders so the bar slides, not jumps
  let clipSeq = 0;

  /* ---- nav ---- */

  function activeTab(nav) {
    return nav.querySelector('[data-tab][aria-current="page"]');
  }

  function moveIndicator(nav) {
    if (!nav) return;
    let bar = nav.querySelector(':scope > .nav-indicator');
    const active = activeTab(nav);
    if (!bar) {
      bar = document.createElement('span');
      bar.className = 'nav-indicator';
      bar.setAttribute('aria-hidden', 'true');
      nav.prepend(bar);
      /* A fresh element: place it where the last one was, with no transition,
         so the move below slides from the previous tab. */
      if (indicatorAt !== null) {
        bar.style.transition = 'none';
        bar.style.transform = indicatorAt;
        void bar.offsetWidth;
        bar.style.transition = '';
      }
    }
    if (!active) { bar.style.opacity = '0'; return; }
    bar.style.opacity = '1';
    /* The bar is 100px wide in CSS; translate + scaleX place it under the
       active tab without animating width or left. */
    indicatorAt = 'translateX(' + active.offsetLeft + 'px) scaleX(' + (active.offsetWidth / 100) + ')';
    bar.style.transform = indicatorAt;
  }

  function updateFade(nav) {
    if (!nav) return;
    const max = nav.scrollWidth - nav.clientWidth;
    nav.classList.toggle('fade-left', nav.scrollLeft > 2);
    nav.classList.toggle('fade-right', max - nav.scrollLeft > 2);
  }

  function scrollActiveIntoView(nav, smooth) {
    const active = activeTab(nav);
    if (!active || nav.scrollWidth <= nav.clientWidth) return;
    const left = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
    nav.scrollTo({ left: Math.max(0, left), behavior: smooth && !reduced() ? 'smooth' : 'auto' });
  }

  const watchedNavs = new WeakSet();
  function watchNav(nav) {
    if (!nav || watchedNavs.has(nav)) return;
    watchedNavs.add(nav);
    nav.addEventListener('scroll', () => updateFade(nav), { passive: true });
    root.addEventListener('resize', () => { updateFade(nav); moveIndicator(nav); });
  }

  /* ---- skeleton ---- */

  function skeletonHtml() {
    const th = document.documentElement.lang === 'th';
    return '<div class="m-skeleton" aria-hidden="true"><span class="sk-label">' + (th ? 'กำลังโหลด…' : 'Loading…') + '</span>' +
      '<div class="sk sk-title"></div>' +
      '<div class="sk-row"><div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-card"></div></div>' +
      '<div class="sk sk-panel"></div><div class="sk sk-panel short"></div></div>';
  }

  /* Tab click: the tab turns active at once, a skeleton appears only when this
     page was slow last time, and the (synchronous) render runs after that has
     been painted. */
  function navigate(button, key, run) {
    const nav = button && button.closest('#nav');
    if (nav) {
      nav.querySelectorAll('[data-tab]').forEach(b => {
        if (b === button) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      });
      moveIndicator(nav);
      scrollActiveIntoView(nav, true);
    }
    const main = document.getElementById('main');
    let skeleton = null;
    if (main && key !== lastKey && (lastRenderMs.get(key) || 0) > SKELETON_AFTER_MS) {
      /* Beside <main>, never inside it: some pages move #controls into <main>,
         and overwriting it would delete that element before the render. */
      skeleton = document.createElement('div');
      skeleton.innerHTML = skeletonHtml();
      skeleton = skeleton.firstChild;
      main.classList.add('m-behind-skeleton');
      main.setAttribute('aria-busy', 'true');
      main.before(skeleton);
    }
    /* Two frames: the first paints the active tab (and skeleton), the second
       starts the render. Removing the skeleton and rendering happen in the
       same task, so no empty frame is painted between them. */
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (skeleton) skeleton.remove();
      if (main) { main.classList.remove('m-behind-skeleton'); main.removeAttribute('aria-busy'); }
      const started = performance.now();
      try { run(); } finally { lastRenderMs.set(key, performance.now() - started); }
    }));
  }

  /* ---- page entry ---- */

  function onceAnimationEnd(el, name, done) {
    function handler(event) {
      if (event.target !== el || (name && event.animationName !== name)) return;
      el.removeEventListener('animationend', handler);
      done();
    }
    el.addEventListener('animationend', handler);
  }

  function play(el, className, delay, name) {
    if (delay) el.style.setProperty('--m-delay', delay + 'ms');
    el.classList.add(className);
    onceAnimationEnd(el, name, () => { el.classList.remove(className); el.style.removeProperty('--m-delay'); });
  }

  /* The blocks that rise in order: direct children of <main>, with KPI rows
     and grids opened up so each card counts as one item. */
  function staggerUnits(main) {
    const units = [];
    for (const child of main.children) {
      if (child.matches('.kpis, .grid') && child.children.length) units.push(...child.children);
      else units.push(child);
    }
    return units;
  }

  function countUp(el) {
    const finalText = el.textContent;
    const tokens = finalText.match(/-?\d[\d,]*(?:\.\d+)?/g);
    if (!tokens || tokens.length !== 1) return; // only a single plain number
    const token = tokens[0];
    const target = Number(token.replace(/,/g, ''));
    if (!Number.isFinite(target) || target === 0) return;
    const at = finalText.indexOf(token);
    const before = finalText.slice(0, at), after = finalText.slice(at + token.length);
    const decimals = token.includes('.') ? token.split('.')[1].length : 0;
    const format = new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: token.includes(',') });
    const start = performance.now();
    function frame(now) {
      if (!el.isConnected) return;
      const p = Math.min(1, (now - start) / COUNT_MS);
      if (p >= 1) { el.textContent = finalText; return; }
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = before + format.format(target * eased) + after;
      requestAnimationFrame(frame);
    }
    el.textContent = before + format.format(0) + after;
    requestAnimationFrame(frame);
  }

  function revealChart(svg) {
    const box = svg.viewBox && svg.viewBox.baseVal;
    const lines = [...svg.querySelectorAll('path')];
    if (!box || !box.width || !lines.length) return;
    const ns = 'http://www.w3.org/2000/svg';
    const id = 'm-clip-' + (++clipSeq);
    const clip = document.createElementNS(ns, 'clipPath');
    clip.setAttribute('id', id);
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', box.x); rect.setAttribute('y', box.y);
    rect.setAttribute('width', box.width); rect.setAttribute('height', box.height);
    rect.setAttribute('class', 'm-draw');
    clip.append(rect);
    svg.append(clip);
    lines.forEach(path => path.setAttribute('clip-path', 'url(#' + id + ')'));
    svg.querySelectorAll('circle').forEach(point => play(point, 'm-pop', 300, 'm-pop'));
    onceAnimationEnd(rect, 'm-grow-x', () => {
      lines.forEach(path => path.removeAttribute('clip-path'));
      clip.remove();
    });
  }

  function enter(main, firstVisit) {
    if (reduced()) { play(main, 'm-fade', 0, 'm-fade'); return; }
    staggerUnits(main).forEach((el, i) => play(el, 'm-rise', Math.min(i, STAGGER_MAX - 1) * STAGGER_MS, 'm-rise'));
    main.querySelectorAll('.fill, .meter-fill, .customer-company-track > i').forEach((bar, i) => {
      play(bar, 'm-grow', 120 + Math.min(i, STAGGER_MAX - 1) * BAR_STAGGER_MS, 'm-grow-x');
    });
    main.querySelectorAll('svg.chart').forEach(revealChart);
    main.querySelectorAll('svg.product-pie, svg.sparkline, svg.fc-spark').forEach(svg => play(svg, 'm-pop', 120, 'm-pop'));
    if (firstVisit) main.querySelectorAll('.kpi strong').forEach(countUp);
  }

  function afterRender(key) {
    const nav = document.getElementById('nav');
    if (nav) { watchNav(nav); moveIndicator(nav); updateFade(nav); }
    if (!key) { lastKey = ''; return; }
    if (key === lastKey) return;
    lastKey = key;
    if (nav) scrollActiveIntoView(nav, false);
    const main = document.getElementById('main');
    if (!main) return;
    const firstVisit = !visited.has(key);
    visited.add(key);
    enter(main, firstVisit);
  }

  /* ---- <details>: open with a short drop-in, close with a short fade ---- */

  document.addEventListener('click', event => {
    const summary = event.target.closest && event.target.closest('details > summary');
    if (!summary) return;
    const details = summary.parentElement;
    if (!details.open) {
      details.classList.remove('m-closing');
      details.classList.add('m-opening');
      const body = details.querySelector(':scope > :not(summary)');
      if (body) onceAnimationEnd(body, null, () => details.classList.remove('m-opening'));
      return;
    }
    if (reduced() || details.classList.contains('m-closing')) return;
    const body = details.querySelector(':scope > :not(summary)');
    if (!body) return;
    event.preventDefault();
    details.classList.remove('m-opening');
    details.classList.add('m-closing');
    onceAnimationEnd(body, 'm-drop-out', () => {
      details.classList.remove('m-closing');
      details.open = false;
    });
  });

  root.Motion = { navigate, afterRender };
})(typeof window !== 'undefined' ? window : globalThis);
