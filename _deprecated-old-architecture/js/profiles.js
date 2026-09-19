/* profiles.js — several people share one device.
 *
 * What this is: each person picks who they are and types a passcode, so
 * colleagues do not see each other's screens and a passer-by cannot pick up an
 * unlocked tablet.
 *
 * What this is NOT: protection. The data on the device is not encrypted.
 * Anyone who can reach the browser's storage or the device's files can read
 * everything, passcode or no passcode. The interface says so in both
 * languages, and no wording here or on screen may imply otherwise.
 *
 * Why the passcode is hashed slowly, since it cannot protect the data: it
 * protects the PASSCODE, because people reuse their phone and bank PINs.
 *
 * The store is injected (see storage.profileStore), so this file never talks
 * to IndexedDB and Node can drive it with a plain object.
 */
(function (MSFA) {
  'use strict';

  var ROLES = ['sales', 'supervisor', 'management'];
  var DEFAULT_ITERATIONS = 600000;
  var MIN_LENGTH = 6;
  /* Wrong attempts: a growing pause, capped, and it never destroys data. */
  var DELAY_STEPS_MS = [0, 0, 1000, 3000, 10000, 30000, 60000];

  function crypto() {
    return (typeof globalThis !== 'undefined' && globalThis.crypto) ? globalThis.crypto : null;
  }

  function randomBytes(length) {
    var bytes = new Uint8Array(length);
    crypto().getRandomValues(bytes);
    return bytes;
  }

  function toBase64(bytes) {
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    if (typeof btoa === 'function') return btoa(binary);
    return Buffer.from(bytes).toString('base64');
  }

  function fromBase64(text) {
    if (typeof atob === 'function') {
      var binary = atob(text);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
    return new Uint8Array(Buffer.from(text, 'base64'));
  }

  /* ---------- passcode rules ----------
     Six characters, and not one of the handful everybody picks. */

  function checkPasscode(passcode) {
    var value = String(passcode === undefined || passcode === null ? '' : passcode);
    if (value.length < MIN_LENGTH) return { ok: false, reason: 'too-short' };

    if (/^(.)\1+$/.test(value)) return { ok: false, reason: 'repeated' };

    var ascending = true, descending = true;
    for (var i = 1; i < value.length; i++) {
      var step = value.charCodeAt(i) - value.charCodeAt(i - 1);
      if (step !== 1) ascending = false;
      if (step !== -1) descending = false;
    }
    if (ascending || descending) return { ok: false, reason: 'sequential' };

    return { ok: true };
  }

  /* ---------- derivation ---------- */

  function deriveHash(passcode, saltBase64, iterations) {
    var subtle = crypto() && crypto().subtle;
    if (!subtle) return Promise.reject(new Error('Web Crypto is not available'));

    var encoded = new TextEncoder().encode(String(passcode));
    return subtle.importKey('raw', encoded, 'PBKDF2', false, ['deriveBits'])
      .then(function (key) {
        return subtle.deriveBits(
          { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(saltBase64), iterations: iterations },
          key,
          256
        );
      })
      .then(function (bits) { return toBase64(new Uint8Array(bits)); });
  }

  /* Compares every byte either way, so the comparison time says nothing. */
  function constantTimeEqual(a, b) {
    var left = String(a), right = String(b);
    if (left.length !== right.length) return false;
    var difference = 0;
    for (var i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
    return difference === 0;
  }

  /* ---------- profiles ---------- */

  function nextId(existing) {
    var used = {};
    existing.forEach(function (profile) { used[profile.id] = true; });
    var n = 1;
    while (used['P' + n]) n++;
    return 'P' + n;
  }

  /* The first profile is always management, so a device can never be locked
     out of its own data. */
  function createProfile(store, spec) {
    var options = spec || {};
    return Promise.resolve(store.list()).then(function (existing) {
      var profiles = existing || [];
      var check = checkPasscode(options.passcode);
      if (!check.ok) return Promise.reject(Object.assign(new Error('passcode-rejected'), { reason: check.reason }));

      var role = profiles.length === 0 ? 'management' : options.role;
      if (ROLES.indexOf(role) === -1) return Promise.reject(new Error('unknown-role'));

      var displayName = String(options.displayName || '').trim();
      if (!displayName) return Promise.reject(new Error('name-required'));

      var iterations = options.iterations || DEFAULT_ITERATIONS;
      var salt = toBase64(randomBytes(16));

      return deriveHash(options.passcode, salt, iterations).then(function (hash) {
        var profile = {
          id: nextId(profiles),
          displayName: displayName,
          role: role,
          salespersonCode: role === 'sales' ? (options.salespersonCode || null) : null,
          passcodeSalt: salt,
          passcodeHash: hash,
          kdfIterations: iterations,
          failedAttempts: 0,
          nextAttemptAt: null,
          createdAt: options.now || null,
          lastUsedAt: null
        };
        return Promise.resolve(store.put(profile)).then(function () { return profile; });
      });
    });
  }

  function delayForAttempts(attempts) {
    return DELAY_STEPS_MS[Math.min(attempts, DELAY_STEPS_MS.length - 1)];
  }

  /* The counter lives in the profile record, so reloading the page does not
     clear it. It never deletes anything. */
  function verifyPasscode(store, id, passcode, nowMs) {
    var now = nowMs === undefined || nowMs === null ? 0 : nowMs;
    return Promise.resolve(store.get(id)).then(function (profile) {
      if (!profile) return { ok: false, reason: 'no-such-profile' };

      if (profile.nextAttemptAt && now < profile.nextAttemptAt) {
        return { ok: false, reason: 'wait', waitMs: profile.nextAttemptAt - now };
      }

      return deriveHash(passcode, profile.passcodeSalt, profile.kdfIterations).then(function (hash) {
        if (constantTimeEqual(hash, profile.passcodeHash)) {
          profile.failedAttempts = 0;
          profile.nextAttemptAt = null;
          profile.lastUsedAt = now;
          return Promise.resolve(store.put(profile)).then(function () {
            return { ok: true, profile: profile };
          });
        }
        profile.failedAttempts = (profile.failedAttempts || 0) + 1;
        var wait = delayForAttempts(profile.failedAttempts);
        profile.nextAttemptAt = wait ? now + wait : null;
        return Promise.resolve(store.put(profile)).then(function () {
          return { ok: false, reason: 'wrong-passcode', waitMs: wait, failedAttempts: profile.failedAttempts };
        });
      });
    });
  }

  /* Deleting a profile needs its own passcode, or any management passcode. */
  function deleteProfile(store, id, passcode, nowMs) {
    return Promise.resolve(store.get(id)).then(function (target) {
      if (!target) return { ok: false, reason: 'no-such-profile' };

      return verifyPasscode(store, id, passcode, nowMs).then(function (own) {
        if (own.ok) return Promise.resolve(store.remove(id)).then(function () { return { ok: true, by: 'self' }; });

        return Promise.resolve(store.list()).then(function (profiles) {
          var managers = (profiles || []).filter(function (p) { return p.role === 'management' && p.id !== id; });

          function tryNext(index) {
            if (index >= managers.length) return { ok: false, reason: 'passcode-required' };
            return verifyPasscode(store, managers[index].id, passcode, nowMs).then(function (result) {
              if (!result.ok) return tryNext(index + 1);
              return Promise.resolve(store.remove(id)).then(function () {
                return { ok: true, by: 'management', managerId: managers[index].id };
              });
            });
          }
          return tryNext(0);
        });
      });
    });
  }

  /* Always available, so a forgotten passcode never locks anyone out. It
     removes the profiles and NOTHING else; the imported data stays. Afterwards
     the next management profile sees a notice until it is acknowledged,
     because the next profile created is management again. */
  function resetAllProfiles(store, nowMs) {
    return Promise.resolve(store.clear()).then(function () {
      return store.setMeta('profilesResetAt', { at: nowMs || 0, acknowledged: false });
    }).then(function () { return { ok: true }; });
  }

  function pendingResetNotice(store) {
    return Promise.resolve(store.getMeta('profilesResetAt')).then(function (notice) {
      return notice && !notice.acknowledged ? notice : null;
    });
  }

  function acknowledgeReset(store) {
    return Promise.resolve(store.getMeta('profilesResetAt')).then(function (notice) {
      if (!notice) return null;
      notice.acknowledged = true;
      return store.setMeta('profilesResetAt', notice);
    });
  }

  /* ---------- what a role sees ----------
     A convenience, not enforcement: the code and the data are on the device
     and readable. Never call this "permissions" in the interface. */
  function scopeFor(profile) {
    var role = profile ? profile.role : 'management';
    return {
      role: role,
      /* sales sees only its own code; the filter is pinned, not hidden */
      salespersonCode: role === 'sales' ? (profile.salespersonCode || null) : null,
      canCompareColleagues: role !== 'sales',
      canImport: role === 'management',
      canManageProfiles: role === 'management',
      canSeeCustomerList: true
    };
  }

  function appliesTo(scope, line) {
    if (!scope || !scope.salespersonCode) return true;
    return line.salespersonCode === scope.salespersonCode;
  }

  MSFA.profiles = {
    ROLES: ROLES,
    DEFAULT_ITERATIONS: DEFAULT_ITERATIONS,
    MIN_LENGTH: MIN_LENGTH,
    DELAY_STEPS_MS: DELAY_STEPS_MS,
    checkPasscode: checkPasscode,
    deriveHash: deriveHash,
    constantTimeEqual: constantTimeEqual,
    createProfile: createProfile,
    verifyPasscode: verifyPasscode,
    deleteProfile: deleteProfile,
    resetAllProfiles: resetAllProfiles,
    pendingResetNotice: pendingResetNotice,
    acknowledgeReset: acknowledgeReset,
    delayForAttempts: delayForAttempts,
    scopeFor: scopeFor,
    appliesTo: appliesTo
  };
})(typeof window !== 'undefined' ? (window.MSFA = window.MSFA || {}) : (globalThis.MSFA = globalThis.MSFA || {}));
