/* tests/profiles.test.cjs — local profiles.
 *
 * The store is an in-memory stand-in for IndexedDB, which is what makes the
 * logic testable at all. A reload is simulated by building a fresh module over
 * the same store: that is exactly what a reload does.
 *
 * Iterations are lowered here so the suite stays fast; the shipped default is
 * asserted separately.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { loadModule } = require('./helpers.cjs');

const FAST = 1000;

function memoryStore() {
  const profiles = new Map();
  const meta = new Map();
  /* The dataset lives beside the profiles and must survive profile changes. */
  const dataset = { value: { invoices: [1, 2, 3], lines: [1, 2, 3] } };
  return {
    dataset,
    list: () => Promise.resolve(Array.from(profiles.values()).map((p) => ({ ...p }))),
    get: (id) => Promise.resolve(profiles.has(id) ? { ...profiles.get(id) } : undefined),
    put: (profile) => { profiles.set(profile.id, { ...profile }); return Promise.resolve(); },
    remove: (id) => { profiles.delete(id); return Promise.resolve(); },
    clear: () => { profiles.clear(); return Promise.resolve(); },
    getMeta: (key) => Promise.resolve(meta.get(key)),
    setMeta: (key, value) => { meta.set(key, value); return Promise.resolve(); }
  };
}

function load() {
  return loadModule('js/profiles.js').profiles;
}

test('the shipped default is 600,000 PBKDF2 iterations', () => {
  assert.strictEqual(load().DEFAULT_ITERATIONS, 600000);
  assert.strictEqual(load().MIN_LENGTH, 6);
});

test('obvious passcodes are rejected', () => {
  const P = load();
  assert.strictEqual(P.checkPasscode('12345').ok, false, 'five characters is too short');
  assert.strictEqual(P.checkPasscode('12345').reason, 'too-short');
  assert.strictEqual(P.checkPasscode('000000').reason, 'repeated');
  assert.strictEqual(P.checkPasscode('aaaaaa').reason, 'repeated');
  assert.strictEqual(P.checkPasscode('123456').reason, 'sequential');
  assert.strictEqual(P.checkPasscode('987654').reason, 'sequential');
  assert.strictEqual(P.checkPasscode('abcdef').reason, 'sequential');
  assert.strictEqual(P.checkPasscode('4827.buy').ok, true);
  assert.strictEqual(P.checkPasscode('713904').ok, true);
});

test('the first profile is management, whatever role was asked for', async () => {
  const P = load();
  const store = memoryStore();

  const first = await P.createProfile(store, {
    displayName: 'คนแรก', role: 'sales', salespersonCode: '03', passcode: '713904', iterations: FAST
  });
  assert.strictEqual(first.role, 'management');
  assert.strictEqual(first.salespersonCode, null);

  const second = await P.createProfile(store, {
    displayName: 'คนที่สอง', role: 'sales', salespersonCode: '04', passcode: '481502', iterations: FAST
  });
  assert.strictEqual(second.role, 'sales');
  assert.strictEqual(second.salespersonCode, '04');
});

test('the passcode itself is never stored, in any field', async () => {
  const P = load();
  const store = memoryStore();
  const profile = await P.createProfile(store, {
    displayName: 'A', role: 'management', passcode: 'secret-passcode-42', iterations: FAST
  });
  const serialized = JSON.stringify(profile);
  assert.ok(!serialized.includes('secret-passcode-42'), 'the passcode must not appear in the record');
  assert.ok(profile.passcodeSalt && profile.passcodeHash && profile.kdfIterations);
});

test('two profiles with the same passcode get different salts and hashes', async () => {
  const P = load();
  const store = memoryStore();
  const a = await P.createProfile(store, { displayName: 'A', role: 'management', passcode: '713904', iterations: FAST });
  const b = await P.createProfile(store, { displayName: 'B', role: 'sales', passcode: '713904', iterations: FAST });
  assert.notStrictEqual(a.passcodeSalt, b.passcodeSalt);
  assert.notStrictEqual(a.passcodeHash, b.passcodeHash);
});

test('the correct passcode opens and a wrong one does not, across a reload', async () => {
  const store = memoryStore();
  const created = await load().createProfile(store, {
    displayName: 'ทีมบริหาร', role: 'management', passcode: '713904', iterations: FAST
  });

  /* A reload: a brand-new module instance over the same stored records. */
  const afterReload = load();
  const good = await afterReload.verifyPasscode(store, created.id, '713904', 1000);
  assert.strictEqual(good.ok, true);

  const bad = await afterReload.verifyPasscode(store, created.id, '713905', 2000);
  assert.strictEqual(bad.ok, false);
  assert.strictEqual(bad.reason, 'wrong-passcode');
});

test('the delay after wrong attempts survives a reload, and never deletes data', async () => {
  const P = load();
  const store = memoryStore();
  const profile = await P.createProfile(store, {
    displayName: 'A', role: 'management', passcode: '713904', iterations: FAST
  });

  /* Time moves between attempts: a guess made during a wait is turned away
     and does not count, which is why each attempt here waits its turn. */
  await P.verifyPasscode(store, profile.id, 'wrong1', 1000);
  await P.verifyPasscode(store, profile.id, 'wrong2', 2000);
  const third = await P.verifyPasscode(store, profile.id, 'wrong3', 3500);
  assert.ok(third.waitMs > 0, 'the third wrong attempt starts a wait');

  /* Reload: a new module, and the wait is still in force. */
  const afterReload = load();
  const stored = await store.get(profile.id);
  assert.strictEqual(stored.failedAttempts, 3, 'the counter is in the profile record');
  assert.ok(stored.nextAttemptAt > 3500);

  const tooSoon = await afterReload.verifyPasscode(store, profile.id, '713904', 3600);
  assert.strictEqual(tooSoon.ok, false);
  assert.strictEqual(tooSoon.reason, 'wait', 'even the right passcode waits its turn');

  const later = await afterReload.verifyPasscode(store, profile.id, '713904', stored.nextAttemptAt + 1);
  assert.strictEqual(later.ok, true, 'the wait expires; nothing is destroyed');
  assert.deepStrictEqual(store.dataset.value.invoices, [1, 2, 3], 'the dataset is untouched throughout');
});

test('a correct passcode clears the delay', async () => {
  const P = load();
  const store = memoryStore();
  const profile = await P.createProfile(store, { displayName: 'A', role: 'management', passcode: '713904', iterations: FAST });
  await P.verifyPasscode(store, profile.id, 'wrong', 1000);
  await P.verifyPasscode(store, profile.id, '713904', 1000);
  const stored = await store.get(profile.id);
  assert.strictEqual(stored.failedAttempts, 0);
  assert.strictEqual(stored.nextAttemptAt, null);
});

test('deleting a profile needs its own passcode or a management one', async () => {
  const P = load();
  const store = memoryStore();
  const manager = await P.createProfile(store, { displayName: 'M', role: 'management', passcode: '713904', iterations: FAST });
  const sales = await P.createProfile(store, { displayName: 'S', role: 'sales', salespersonCode: '04', passcode: '481502', iterations: FAST });

  const refused = await P.deleteProfile(store, sales.id, 'not-the-passcode', 0);
  assert.strictEqual(refused.ok, false);
  assert.strictEqual(refused.reason, 'passcode-required');
  assert.ok(await store.get(sales.id), 'the profile is still there');

  const byManager = await P.deleteProfile(store, sales.id, '713904', 0);
  assert.strictEqual(byManager.ok, true);
  assert.strictEqual(byManager.by, 'management');
  assert.strictEqual(await store.get(sales.id), undefined);
  assert.ok(await store.get(manager.id), 'the manager is untouched');
});

test('resetting all profiles keeps the dataset and leaves a notice', async () => {
  const P = load();
  const store = memoryStore();
  await P.createProfile(store, { displayName: 'M', role: 'management', passcode: '713904', iterations: FAST });
  await P.createProfile(store, { displayName: 'S', role: 'sales', salespersonCode: '04', passcode: '481502', iterations: FAST });

  await P.resetAllProfiles(store, 1750000000000);

  assert.deepStrictEqual(await store.list(), [], 'the profiles are gone');
  assert.deepStrictEqual(store.dataset.value.invoices, [1, 2, 3], 'the imported data is NOT');

  const notice = await P.pendingResetNotice(store);
  assert.ok(notice, 'a notice is waiting');
  assert.strictEqual(notice.at, 1750000000000);
  assert.strictEqual(notice.acknowledged, false);

  /* It stays until someone acknowledges it, not until a page reloads. */
  assert.ok(await P.pendingResetNotice(store));
  await P.acknowledgeReset(store);
  assert.strictEqual(await P.pendingResetNotice(store), null);

  const next = await P.createProfile(store, { displayName: 'ใหม่', role: 'sales', passcode: '713904', iterations: FAST });
  assert.strictEqual(next.role, 'management', 'the first profile after a reset is management again');
});

test('there are exactly three roles, and each sees what it should', () => {
  const P = load();
  assert.deepStrictEqual(P.ROLES, ['sales', 'supervisor', 'management']);

  const sales = P.scopeFor({ role: 'sales', salespersonCode: '04' });
  assert.strictEqual(sales.salespersonCode, '04');
  assert.strictEqual(sales.canCompareColleagues, false);
  assert.strictEqual(sales.canImport, false);
  assert.strictEqual(sales.canManageProfiles, false);

  const supervisor = P.scopeFor({ role: 'supervisor' });
  assert.strictEqual(supervisor.salespersonCode, null, 'a supervisor sees every salesperson');
  assert.strictEqual(supervisor.canCompareColleagues, true);
  assert.strictEqual(supervisor.canManageProfiles, false, 'profile admin is management only');

  const management = P.scopeFor({ role: 'management' });
  assert.strictEqual(management.canImport, true);
  assert.strictEqual(management.canManageProfiles, true);
});

test('the sales scope filters lines to that salesperson only', () => {
  const P = load();
  const scope = P.scopeFor({ role: 'sales', salespersonCode: '04' });
  assert.strictEqual(P.appliesTo(scope, { salespersonCode: '04' }), true);
  assert.strictEqual(P.appliesTo(scope, { salespersonCode: '06' }), false);
  assert.strictEqual(P.appliesTo(scope, { salespersonCode: null }), false);

  const everyone = P.scopeFor({ role: 'management' });
  assert.strictEqual(P.appliesTo(everyone, { salespersonCode: '06' }), true);
  assert.strictEqual(P.appliesTo(everyone, { salespersonCode: null }), true);
});

test('constant-time comparison still compares correctly', () => {
  const P = load();
  assert.strictEqual(P.constantTimeEqual('abc', 'abc'), true);
  assert.strictEqual(P.constantTimeEqual('abc', 'abd'), false);
  assert.strictEqual(P.constantTimeEqual('abc', 'ab'), false);
});

test('the profile flow makes no network request', async () => {
  const P = load();
  const store = memoryStore();

  /* Anything that could reach the network is replaced with a trap. NFR04. */
  const calls = [];
  const originals = {};
  ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon'].forEach((name) => {
    originals[name] = globalThis[name];
    globalThis[name] = function () { calls.push(name); throw new Error('network call during the profile flow: ' + name); };
  });

  try {
    const profile = await P.createProfile(store, {
      displayName: 'A', role: 'management', passcode: '713904', iterations: FAST
    });
    await P.verifyPasscode(store, profile.id, '713904', 0);
    await P.verifyPasscode(store, profile.id, 'wrong', 0);
    await P.deleteProfile(store, profile.id, '713904', 0);
    await P.resetAllProfiles(store, 0);
  } finally {
    Object.keys(originals).forEach((name) => { globalThis[name] = originals[name]; });
  }

  assert.deepStrictEqual(calls, [], 'nothing in the profile flow touches the network');
});
