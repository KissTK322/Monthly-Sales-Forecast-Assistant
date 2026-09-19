/* tests/shell.test.cjs — static checks for the M0 app shell.
 *
 * These run without a browser: node --test "tests/*.test.cjs"
 * (the bare `node --test tests/` form fails on Node 24).
 * They cover the things a human reviewer cannot reliably eyeball — precache
 * drift, version drift, missing translations, absolute paths, and the eco
 * budget — and leave the visual checks to tests/device-checklist.md.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const bytes = (p) => fs.statSync(path.join(ROOT, p)).size;

/* Files fetched on a first visit, per prd.md NFR14 ("HTML + CSS + JS + fonts").
   sw.js and the manifest are included: sw.js is JavaScript the browser
   downloads on the first visit even though it runs separately.
   Icons are reported separately below rather than counted: they are images,
   not HTML/CSS/JS, but the service worker still pre-downloads all of them
   on the first visit, so that number is printed too and must be recorded. */
const FIRST_LOAD = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'css/styles.css',
  'js/storage.js',
  'js/i18n.js',
  'js/theme.js',
  'js/import-express.js',
  'js/engine.js',
  'js/profiles.js',
  'js/charts.js',
  'js/app.js',
  'js/pwa.js',
  'js/views/_components.js',
  'js/views/overview.js',
  'js/views/products.js',
  'js/views/salesteam.js',
  'js/views/forecast.js',
  'js/views/customers.js',
  'js/views/data.js',
  'js/views/profile.js'
];

const REQUIRED = FIRST_LOAD.concat([
  'js/import-worker.js',
  'tools/make-icons.py',
  '.nojekyll',
  'build.cjs',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png'
]);

/* Walk a directory and return repo-relative POSIX paths. */
function walk(dir) {
  const out = [];
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return out;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = dir + '/' + entry.name;
    if (entry.isDirectory()) out.push(...walk(rel));
    else out.push(rel);
  }
  return out;
}

/* Load the i18n catalogue in Node by running the classic script against a
   stand-in window object. */
function loadStrings() {
  const sandbox = {};
  new Function('window', read('js/i18n.js'))(sandbox);
  return sandbox.MSFA.i18n.__strings;
}

test('every required file exists', () => {
  for (const file of REQUIRED) {
    assert.ok(exists(file), `missing required file: ${file}`);
  }
});

test('service worker precache list matches the files on disk', () => {
  const sw = read('sw.js');
  const block = sw.slice(sw.indexOf('const APP_FILES = ['), sw.indexOf('];'));
  const listed = [...block.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);

  const onDisk = ['index.html', 'manifest.webmanifest']
    .concat(walk('css'), walk('js'), walk('icons'))
    .sort();

  assert.ok(block.includes("'./'"), "APP_FILES must precache './' for the start URL");

  for (const file of onDisk) {
    assert.ok(listed.includes(file), `file on disk is not precached in sw.js: ${file}`);
  }
  for (const file of listed) {
    assert.ok(exists(file), `sw.js precaches a file that does not exist: ${file}`);
  }
});

test('the version is identical in sw.js, js/pwa.js and index.html', () => {
  const swVersion = read('sw.js').match(/const VERSION = '([^']+)'/)[1];
  const pwaVersion = read('js/pwa.js').match(/var APP_VERSION = '([^']+)'/)[1];
  const htmlVersion = read('index.html').match(/<span id="app-version">([^<]+)<\/span>/)[1];

  assert.strictEqual(pwaVersion, swVersion,
    'the version constant must be changed in sw.js and js/pwa.js on every release');
  /* index.html carries it too, so the single-file build (which has no pwa.js)
     shows the real version instead of a placeholder. */
  assert.strictEqual(htmlVersion, swVersion,
    'the version text in index.html must match sw.js');
});

test('no absolute or external paths: the site is served from a sub-path', () => {
  const files = ['index.html', 'manifest.webmanifest', 'sw.js', 'css/styles.css']
    .concat(walk('js'));

  /* The SVG namespace is an identifier, not an address: nothing is fetched
     from it. It is the only external-looking string allowed. */
  const SVG_NS = 'http://www.w3.org/2000/svg';

  for (const file of files) {
    const source = read(file);
    assert.ok(!/(?:src|href)="\//.test(source), `absolute path in ${file}`);
    assert.ok(!/url\(\s*\//.test(source), `absolute url() in ${file}`);

    const external = source.split(SVG_NS).join('');
    assert.ok(!/https?:\/\//.test(external),
      `external URL in ${file}: no CDN, no third-party request (prd.md NFR04)`);
  }
});

test('the styleguide is a development page and never ships to users', () => {
  assert.ok(exists('styleguide.html'), 'the styleguide exists');

  const sw = read('sw.js');
  assert.ok(!sw.includes('styleguide'),
    'the styleguide must not be precached: it is not part of the app');

  assert.ok(!FIRST_LOAD.includes('styleguide.html'),
    'the styleguide must not count against the eco budget');

  const { build } = require(path.join(ROOT, 'build.cjs'));
  assert.ok(!build().html.includes('Styleguide'),
    'the styleguide must not appear in the single-file build');

  /* Its demo code is inline, so no file under js/ exists only for it. */
  const guide = read('styleguide.html');
  const scripts = [...guide.matchAll(/<script\s+src="([^"]+)"/g)].map((m) => m[1]);
  scripts.forEach((src) => {
    assert.ok(read('sw.js').includes(src.replace(/^/, './')),
      `styleguide.html loads ${src}, which must be an app file that is precached`);
  });
});

test('no web fonts: system fonts only, 0 KB of font bytes', () => {
  assert.ok(!exists('fonts'), 'there must be no fonts/ directory');
  assert.ok(!/@font-face/.test(read('css/styles.css')), 'no @font-face is allowed');
});

test('no runtime dependency is vendored', () => {
  assert.ok(!exists('js/vendor'), 'js/vendor/ belongs to the M8+ .xlsx work');
});

test('Thai and English catalogues have identical key sets and no empty values', () => {
  const strings = loadStrings();
  const th = Object.keys(strings.th).sort();
  const en = Object.keys(strings.en).sort();

  assert.deepStrictEqual(th, en, 'a key exists in one language and not the other');

  for (const lang of ['th', 'en']) {
    for (const [key, value] of Object.entries(strings[lang])) {
      assert.ok(typeof value === 'string' && value.trim().length > 0,
        `empty ${lang} string for key: ${key}`);
    }
  }
});

test('every key the app uses exists in both languages', () => {
  const strings = loadStrings();
  const used = new Set();

  /* Static keys in the markup */
  const html = read('index.html');
  for (const m of html.matchAll(/data-i18n="([^"]+)"/g)) used.add(m[1]);
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    for (const pair of m[1].split(',')) {
      const parts = pair.split(':');
      if (parts.length === 2) used.add(parts[1].trim());
    }
  }

  /* Every quoted string in the scripts that looks like a translation key.
     Matching only t('...') missed keys handed to helpers, such as
     emptyState('empty.overview.body'), keyValueRow('data.device.theme', ...)
     and setSteps(['pwa.install.iosStep1', ...]); a typo there would have
     shown a raw key on screen and passed. A key is recognised by its first
     segment, so a string like './sw.js' or 'msfa.' is never mistaken for one. */
  const NAMESPACES = ['app', 'a11y', 'settings', 'lang', 'theme', 'nav', 'empty', 'data', 'pwa'];
  const keyLike = new RegExp("'((?:" + NAMESPACES.join('|') + ")(?:\\.[a-zA-Z0-9]+)+)'", 'g');
  for (const file of walk('js')) {
    if (file === 'js/i18n.js') continue; /* the catalogue itself, not a use of it */
    for (const m of read(file).matchAll(keyLike)) used.add(m[1]);
  }

  /* Keys built at runtime from a prefix plus a value, which the regex above
     cannot see: t('theme.' + pref), t('lang.' + lang). */
  ['theme.system', 'theme.light', 'theme.dark', 'lang.th', 'lang.en']
    .forEach((key) => used.add(key));

  assert.ok(used.size > 20, 'key extraction found suspiciously few keys');

  for (const key of used) {
    assert.ok(key in strings.th, `missing Thai string for used key: ${key}`);
    assert.ok(key in strings.en, `missing English string for used key: ${key}`);
  }
});

test('the six visible tabs are wired, and Stock is absent', () => {
  const html = read('index.html');
  const tabs = [...html.matchAll(/data-tab="([^"]+)"/g)].map((m) => m[1]);
  const panels = [...html.matchAll(/data-panel="([^"]+)"/g)].map((m) => m[1]);

  assert.deepStrictEqual(tabs,
    ['overview', 'products', 'salesteam', 'forecast', 'customers', 'data']);
  assert.deepStrictEqual(panels, tabs, 'every tab needs a panel, in the same order');
  assert.ok(!tabs.includes('stock'),
    'Stock is an M8+ placeholder and must not be rendered (prd.md 11.1)');
});

test('the anti-flash script is inline in the head and uses the storage.js keys', () => {
  const head = read('index.html').split('</head>')[0];

  /* The inline script is the one documented exception to "only storage.js
     touches persistence" (architecture 4.2): it runs before storage.js can
     load, and only reads. It must still use exactly the same keys. */
  const sandbox = {};
  new Function('window', 'localStorage', read('js/storage.js'))(sandbox, {});
  const prefix = sandbox.MSFA.storage.PREFIX;

  assert.ok(head.includes(`localStorage.getItem('${prefix}theme')`),
    `the inline head script must read the theme from '${prefix}theme'`);
  assert.ok(head.includes(`localStorage.getItem('${prefix}lang')`),
    `the inline head script must read the language from '${prefix}lang'`);
  assert.ok(!/localStorage\.setItem/.test(head),
    'the inline head script may only read settings, never write them');
});

test('build.cjs produces a single file with no install path', () => {
  const { build, OUT_FILE } = require(path.join(ROOT, 'build.cjs'));
  const first = build().html;

  assert.ok(!/<script\s+src=/.test(first), 'dist must not reference external scripts');
  assert.ok(!/<link\s+rel="stylesheet"/.test(first), 'dist must not reference a stylesheet');
  assert.ok(!/rel="manifest"/.test(first), 'dist must not link a manifest');
  assert.ok(!/serviceWorker\.register/.test(first),
    'dist must not try to register a service worker: it cannot work from file://');
  assert.ok(first.includes('<style>'), 'dist must inline the stylesheet');
  assert.ok(first.includes("localStorage.getItem('msfa.theme')"),
    'dist must keep the anti-flash theme block');
  assert.ok(/id="dist-note"(?![^>]*\shidden)/.test(first),
    'dist must show the single-file notice');
  assert.ok(!/<img[^>]+src="(?!data:)/.test(first),
    'dist must inline its images: nothing resolves icons/ beside a single file');
  assert.ok(!/<link[^>]+rel="(?:icon|apple-touch-icon)"/.test(first),
    'dist must not link icon files that will not exist beside it');

  /* Deterministic: same input, same bytes. */
  const second = build().html;
  assert.strictEqual(first, second, 'build.cjs output must be deterministic');
  assert.ok(fs.existsSync(OUT_FILE));
});

test('eco budget: first load is within 250 KB and fonts are 0 KB', () => {
  let total = 0;
  const rows = [];
  for (const file of FIRST_LOAD) {
    const size = bytes(file);
    total += size;
    rows.push(`${file}: ${(size / 1024).toFixed(1)} KB`);
  }

  const kb = total / 1024;
  console.log(`  first load: ${kb.toFixed(1)} KB uncompressed across ${FIRST_LOAD.length} files`);
  rows.forEach((row) => console.log('    ' + row));

  const icons = walk('icons').reduce((sum, file) => sum + bytes(file), 0) / 1024;
  console.log(`  icons pre-downloaded by the service worker: ${icons.toFixed(1)} KB (reported, not budgeted)`);

  assert.ok(kb <= 250, `first load ${kb.toFixed(1)} KB exceeds the 250 KB budget`);
});
