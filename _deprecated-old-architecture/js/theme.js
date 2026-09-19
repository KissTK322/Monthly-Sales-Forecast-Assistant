/* theme.js — light, dark, or follow the system (D5).
 *
 * The preference is one of 'system' | 'light' | 'dark'.
 * 'system' removes data-theme from <html> and lets the CSS media query decide,
 * so there is exactly one set of tokens and no duplicated palette in JS.
 *
 * The matching anti-flash block is inline in index.html; it must stay there,
 * because a deferred script shows the wrong theme for one frame.
 */
(function (MSFA) {
  'use strict';

  var PREFS = ['system', 'light', 'dark'];
  var DEFAULT_PREF = 'system';

  /* Resolved theme -> the browser UI colour. Light uses the header surface
     (white); dark uses the dark surface, not the page background, so the
     status bar matches the header it sits above. */
  var THEME_COLOR = { light: '#FFFFFF', dark: '#1D2125' };

  var pref = DEFAULT_PREF;
  var media = null;

  function isSupported(value) {
    return PREFS.indexOf(value) !== -1;
  }

  function systemPrefersDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function resolved() {
    if (pref === 'light' || pref === 'dark') return pref;
    return systemPrefersDark() ? 'dark' : 'light';
  }

  function applyToDocument() {
    var root = document.documentElement;
    if (pref === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', pref);
    }

    /* index.html carries one theme-color tag per system scheme. Following the
       system, each keeps its own colour and the browser picks by media query.
       With a forced theme, both get the forced colour, so a dark OS cannot
       paint a dark status bar over a light app (or the reverse). */
    var lightMeta = document.getElementById('theme-color-light');
    var darkMeta = document.getElementById('theme-color-dark');
    var forced = pref === 'system' ? null : THEME_COLOR[pref];
    if (lightMeta) lightMeta.setAttribute('content', forced || THEME_COLOR.light);
    if (darkMeta) darkMeta.setAttribute('content', forced || THEME_COLOR.dark);
  }

  function getPref() {
    return pref;
  }

  function setPref(value) {
    pref = isSupported(value) ? value : DEFAULT_PREF;
    MSFA.storage.setSetting('theme', pref);
    applyToDocument();
    return pref;
  }

  function init() {
    var stored = MSFA.storage.getSetting('theme', DEFAULT_PREF);
    pref = isSupported(stored) ? stored : DEFAULT_PREF;
    applyToDocument();

    /* While following the system, react to the OS switching at runtime. */
    if (window.matchMedia) {
      media = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () {
        if (pref === 'system') applyToDocument();
      };
      if (media.addEventListener) media.addEventListener('change', onChange);
      else if (media.addListener) media.addListener(onChange);
    }

    return pref;
  }

  MSFA.theme = {
    PREFS: PREFS,
    DEFAULT_PREF: DEFAULT_PREF,
    init: init,
    getPref: getPref,
    setPref: setPref,
    resolved: resolved,
    isSupported: isSupported
  };
})(window.MSFA = window.MSFA || {});
