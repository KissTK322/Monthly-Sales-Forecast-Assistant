/* storage.js — the only module that touches persistence (architecture 4.2).
 *
 * localStorage holds language and theme. Nothing else: no dataset, and no
 * passcode material of any kind.
 * IndexedDB holds the dataset, the profiles and a small meta store.
 *
 * The dataset is device-level. No dataset record refers to a profile, so
 * deleting or resetting a profile cannot take the imported data with it.
 */
(function (MSFA) {
  'use strict';

  var PREFIX = 'msfa.';
  var DB_NAME = 'msfa';
  var DB_VERSION = 1;
  var STORE_DATASET = 'dataset';
  var STORE_PROFILES = 'profiles';
  var STORE_META = 'meta';
  var DATASET_KEY = 'current';

  /* ---------- settings (localStorage) ---------- */

  function getSetting(key, fallback) {
    try {
      var value = localStorage.getItem(PREFIX + key);
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function setSetting(key, value) {
    try { localStorage.setItem(PREFIX + key, value); return true; }
    catch (error) { return false; }
  }

  function removeSetting(key) {
    try { localStorage.removeItem(PREFIX + key); return true; }
    catch (error) { return false; }
  }

  function isAvailable() {
    try {
      var probe = PREFIX + '__probe';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return true;
    } catch (error) { return false; }
  }

  /* ---------- IndexedDB ---------- */

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB is not available')); return; }
      var request = indexedDB.open(DB_NAME, DB_VERSION);
      /* Upgrades add stores and never touch the dataset store's contents. */
      request.onupgradeneeded = function (event) {
        var db = request.result;
        if (!db.objectStoreNames.contains(STORE_DATASET)) db.createObjectStore(STORE_DATASET);
        if (!db.objectStoreNames.contains(STORE_PROFILES)) db.createObjectStore(STORE_PROFILES, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
        void event;
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function run(storeName, mode, action) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, mode);
        var request = action(tx.objectStore(storeName));
        tx.oncomplete = function () { db.close(); resolve(request ? request.result : undefined); };
        tx.onerror = function () { db.close(); reject(tx.error); };
        tx.onabort = function () { db.close(); reject(tx.error); };
      });
    });
  }

  /* The dataset, whole. One import replaces it; a failed import never does. */
  function getDataset() { return run(STORE_DATASET, 'readonly', function (store) { return store.get(DATASET_KEY); }); }
  function putDataset(dataset) { return run(STORE_DATASET, 'readwrite', function (store) { return store.put(dataset, DATASET_KEY); }); }
  function clearDataset() { return run(STORE_DATASET, 'readwrite', function (store) { return store.delete(DATASET_KEY); }); }

  function getMeta(key) { return run(STORE_META, 'readonly', function (store) { return store.get(key); }); }
  function setMeta(key, value) { return run(STORE_META, 'readwrite', function (store) { return store.put(value, key); }); }

  /* The profile store, shaped so js/profiles.js never talks to IndexedDB
     directly and can be driven by an in-memory store in tests. */
  var profileStore = {
    list: function () { return run(STORE_PROFILES, 'readonly', function (store) { return store.getAll(); }); },
    get: function (id) { return run(STORE_PROFILES, 'readonly', function (store) { return store.get(id); }); },
    put: function (profile) { return run(STORE_PROFILES, 'readwrite', function (store) { return store.put(profile); }); },
    remove: function (id) { return run(STORE_PROFILES, 'readwrite', function (store) { return store.delete(id); }); },
    clear: function () { return run(STORE_PROFILES, 'readwrite', function (store) { return store.clear(); }); },
    getMeta: getMeta,
    setMeta: setMeta
  };

  /* ---------- persistence ----------
     iOS deletes IndexedDB for a site that is not installed and not opened for
     about a week, which would take the profiles and the imported data
     together. Ask, then tell the user what the answer was. */
  function requestPersistence() {
    if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.persist) {
      return Promise.resolve({ granted: false, supported: false });
    }
    return navigator.storage.persisted()
      .then(function (already) { return already ? true : navigator.storage.persist(); })
      .then(function (granted) { return { granted: !!granted, supported: true }; })
      .catch(function () { return { granted: false, supported: true }; });
  }

  function estimateUsage() {
    if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.estimate) {
      return Promise.resolve(null);
    }
    return navigator.storage.estimate().then(function (estimate) { return estimate.usage || 0; }).catch(function () { return null; });
  }

  MSFA.storage = {
    PREFIX: PREFIX,
    DB_NAME: DB_NAME,
    DB_VERSION: DB_VERSION,
    getSetting: getSetting,
    setSetting: setSetting,
    removeSetting: removeSetting,
    isAvailable: isAvailable,
    openDb: openDb,
    getDataset: getDataset,
    putDataset: putDataset,
    clearDataset: clearDataset,
    getMeta: getMeta,
    setMeta: setMeta,
    profileStore: profileStore,
    requestPersistence: requestPersistence,
    estimateUsage: estimateUsage
  };
})(typeof window !== 'undefined' ? (window.MSFA = window.MSFA || {}) : (globalThis.MSFA = globalThis.MSFA || {}));
