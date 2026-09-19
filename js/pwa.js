/* pwa.js — service worker registration, update banner, offline badge and
 * per-platform install help.
 *
 * Self-contained on purpose: app.js is the prototype's own code (kept as
 * close to the client-reviewed original as possible), so this file reads
 * the language app.js already writes to <html lang> instead of importing
 * app.js's internal t() helper, and never modifies app.js's flow.
 *
 * APP_VERSION must match VERSION in sw.js.
 */
(function () {
  'use strict';

  var APP_VERSION = '1.2.0';
  var deferredInstallPrompt = null;

  var $ = function (id) { return document.getElementById(id); };
  var lang = function () { return document.documentElement.lang === 'th' ? 'th' : 'en'; };
  var tr = function (en, th) { return lang() === 'th' ? th : en; };

  var ua = navigator.userAgent;
  var isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isIOSSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|GSA|Line\//.test(ua);
  var isMacSafari = !isIOS && /Macintosh/.test(ua) && /Safari/.test(ua) &&
    !/Chrome|Chromium|Edg|Firefox/.test(ua);
  var isChromium = /Chrome|Chromium|Edg/.test(ua);

  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
  }
  function isSecure() {
    return window.isSecureContext && window.location.protocol !== 'file:';
  }

  /* ---------- service worker and updates ---------- */

  function showUpdateBanner(worker) {
    var banner = $('update-banner');
    var button = $('update-reload');
    if (!banner || !button) return;
    banner.hidden = false;
    button.textContent = tr('Reload', 'โหลดใหม่');
    button.onclick = function () {
      button.disabled = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    };
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !isSecure()) return;
    var userAskedReload = false;
    var reloading = false;
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('#update-reload')) userAskedReload = true;
    });
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!userAskedReload || reloading) return;
      reloading = true;
      window.location.reload();
    });
    navigator.serviceWorker.register('./sw.js', { scope: './' }).then(function (registration) {
      if (registration.waiting && navigator.serviceWorker.controller) showUpdateBanner(registration.waiting);
      registration.addEventListener('updatefound', function () {
        var worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', function () {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(worker);
        });
      });
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') registration.update().catch(function () { /* offline: retry later */ });
      });
    }).catch(function (error) {
      console.warn('Service worker registration failed:', error);
    });
  }

  /* ---------- online / offline ---------- */

  function updateOnlineState() {
    var badge = $('offline-badge');
    if (!badge) return;
    badge.hidden = navigator.onLine;
    badge.textContent = tr('Offline', 'ออฟไลน์');
  }

  /* ---------- install help (all platforms) ---------- */

  function renderInstallHelp() {
    var status = $('install-status');
    var steps = $('install-steps');
    var button = $('install-button');
    if (!status || !steps || !button) return;

    steps.replaceChildren();
    steps.hidden = true;
    button.hidden = true;

    function setSteps(items) {
      items.forEach(function (text) {
        var li = document.createElement('li');
        li.textContent = text;
        steps.appendChild(li);
      });
      steps.hidden = false;
    }

    if (isStandalone()) {
      status.textContent = tr('This app is installed on this device.', 'แอปนี้ติดตั้งบนอุปกรณ์นี้แล้ว');
    } else if (!isSecure()) {
      status.textContent = tr('Installing needs the website address (https). A file opened from a folder cannot be installed.', 'การติดตั้งต้องเปิดผ่านที่อยู่เว็บไซต์ (https) ไฟล์ที่เปิดจากโฟลเดอร์จะติดตั้งไม่ได้');
    } else if (deferredInstallPrompt) {
      status.textContent = tr('Install this app on this device.', 'ติดตั้งแอปนี้บนอุปกรณ์ของคุณ');
      button.textContent = tr('Install', 'ติดตั้ง');
      button.hidden = false;
    } else if (isIOS && isIOSSafari) {
      status.textContent = tr('Install this app from Safari:', 'ติดตั้งแอปนี้จาก Safari:');
      setSteps([
        tr('Tap the Share button in the Safari toolbar.', 'แตะปุ่มแชร์ในแถบเครื่องมือ Safari'),
        tr('Choose Add to Home Screen.', 'เลือก "เพิ่มไปยังหน้าจอโฮม"'),
        tr('Tap Add. The app icon appears on your Home Screen.', 'แตะ "เพิ่ม" ไอคอนแอปจะปรากฏบนหน้าจอโฮม'),
      ]);
    } else if (isIOS) {
      status.textContent = tr('On iPhone and iPad, open this page in Safari to install it.', 'บน iPhone และ iPad ให้เปิดหน้านี้ใน Safari เพื่อติดตั้ง');
    } else if (isMacSafari) {
      status.textContent = tr('Install this app from Safari on Mac:', 'ติดตั้งแอปนี้จาก Safari บน Mac:');
      setSteps([tr('In the menu bar, choose File, then Add to Dock.', 'ในแถบเมนู เลือก "File" แล้วเลือก "Add to Dock"')]);
    } else if (isChromium) {
      status.textContent = tr('Use the install icon in the address bar, or the browser menu, to install this app.', 'ใช้ไอคอนติดตั้งในแถบที่อยู่ หรือเมนูเบราว์เซอร์ เพื่อติดตั้งแอปนี้');
    } else {
      status.textContent = tr('Open this page in Chrome or Edge to install it.', 'เปิดหน้านี้ใน Chrome หรือ Edge เพื่อติดตั้ง');
    }
  }

  function runInstallPrompt() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.catch(function () { /* dismissed */ }).then(function () {
      deferredInstallPrompt = null;
      renderInstallHelp();
    });
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    renderInstallHelp();
  });
  window.addEventListener('appinstalled', function () {
    deferredInstallPrompt = null;
    renderInstallHelp();
  });

  /* ---------- boot ---------- */

  function init() {
    var versionNode = $('app-version');
    if (versionNode) versionNode.textContent = APP_VERSION;

    var installButton = $('install-button');
    if (installButton) installButton.addEventListener('click', runInstallPrompt);

    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);
    updateOnlineState();
    renderInstallHelp();

    /* Refresh install text and the offline badge to the current language
       whenever the settings popover opens, since this module does not
       hook into app.js's own render cycle. */
    document.addEventListener('toggle', function (e) {
      if (e.target && e.target.id === 'settings-menu' && e.target.open) {
        renderInstallHelp();
        updateOnlineState();
      }
    }, true);

    /* Best-effort: ask for persistent storage so an installed app is less
       likely to have its local data evicted under storage pressure. */
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {}); } catch (error) { /* ignored */ }

    registerServiceWorker();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
