/* tests/contrast.test.cjs — WCAG AA contrast for every declared token pair.
 *
 * The brand palette is approximated from a photo of the client's logo and is
 * decoration only: brand green measures about 2:1 on white, so it is never a
 * text or button colour in the light theme. This test is what keeps that rule
 * true when someone later reaches for a brand colour because it looks nice.
 *
 * Ratios are computed from css/styles.css itself, so editing a token without
 * re-checking it fails here rather than in front of a user.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'css', 'styles.css'), 'utf8');

const AA_TEXT = 4.5;   /* body text */
const AA_LARGE = 3.0;  /* large text, and non-text UI such as a focus ring */

function relativeLuminance(hex) {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a, b) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

/* Pull the custom properties out of one CSS block, identified by its selector. */
function tokensFrom(selector) {
  const start = CSS.indexOf(selector);
  assert.ok(start !== -1, `selector not found in styles.css: ${selector}`);
  const block = CSS.slice(start, CSS.indexOf('}', start));

  const tokens = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)) {
    tokens[m[1]] = m[2];
  }
  return tokens;
}

/* The pairs the interface actually puts next to each other. */
const PAIRS = [
  ['text', 'bg', AA_TEXT],
  ['text', 'surface', AA_TEXT],
  ['muted', 'bg', AA_TEXT],
  ['muted', 'surface', AA_TEXT],
  ['primary', 'bg', AA_TEXT],
  ['primary', 'surface', AA_TEXT],
  ['on-primary', 'primary', AA_TEXT],
  ['accent-rose', 'surface', AA_TEXT],
  ['accent-blue', 'surface', AA_TEXT],
  ['primary', 'border', AA_LARGE]
];

/* Chart marks are graphics, not text: 3:1 against the surface they sit on.
   Their labels use text tokens, which are checked as text above. */
for (const [name, selector] of [['light', ':root {'], ['dark', ':root[data-theme="dark"] {']]) {
  test(`${name} theme: every chart series is visible on the surface`, () => {
    const tokens = tokensFrom(selector);
    ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-other'].forEach((token) => {
      assert.ok(tokens[token], `${name}: --${token} is not defined`);
      const ratio = contrast(tokens[token], tokens.surface);
      console.log(`  ${name.padEnd(5)} ${(token + ' on surface').padEnd(24)} ${ratio.toFixed(2)}:1 (min ${AA_LARGE})`);
      assert.ok(ratio >= AA_LARGE,
        `${name}: --${token} on --surface is ${ratio.toFixed(2)}:1, below ${AA_LARGE}:1`);
    });

    /* Grey is reserved for gridlines and "Other", never a series. */
    ['chart-1', 'chart-2', 'chart-3', 'chart-4'].forEach((token) => {
      assert.notStrictEqual(tokens[token], tokens['chart-other'],
        'grey is not a series colour');
    });
  });

  test(`${name} theme: every declared pair meets WCAG AA`, () => {
    const tokens = tokensFrom(selector);

    for (const [fg, bg, minimum] of PAIRS) {
      assert.ok(tokens[fg], `${name}: token --${fg} is not defined`);
      assert.ok(tokens[bg], `${name}: token --${bg} is not defined`);

      const ratio = contrast(tokens[fg], tokens[bg]);
      console.log(`  ${name.padEnd(5)} ${(fg + ' on ' + bg).padEnd(24)} ${ratio.toFixed(2)}:1 (min ${minimum})`);
      assert.ok(ratio >= minimum,
        `${name}: --${fg} on --${bg} is ${ratio.toFixed(2)}:1, below ${minimum}:1`);
    }
  });
}

test('the dark media-query block matches the explicit dark block', () => {
  /* One palette, declared twice: once for prefers-color-scheme and once for
     the forced choice. They must not drift apart. */
  const mediaStart = CSS.indexOf(':root:not([data-theme="light"])');
  assert.ok(mediaStart !== -1, 'the prefers-color-scheme dark block is missing');
  const mediaBlock = CSS.slice(mediaStart, CSS.indexOf('}', mediaStart));

  const mediaTokens = {};
  for (const m of mediaBlock.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)) {
    mediaTokens[m[1]] = m[2];
  }

  assert.deepStrictEqual(mediaTokens, tokensFrom(':root[data-theme="dark"] {'),
    'the two dark palettes have drifted apart');
});

test('brand colours are never used as light-theme text or fills', () => {
  const light = tokensFrom(':root {');
  const brandGreen = light['brand-green'];

  assert.ok(brandGreen, '--brand-green must be declared');
  assert.ok(contrast(brandGreen, light.surface) < AA_LARGE,
    'sanity check: brand green is a low-contrast decoration colour on white');

  // It may only be the value of a border property or a chart token. Check the
  // PROPERTY each declaration sets, not merely whether the line mentions
  // "border": a background set to brand green with a comment saying "border"
  // beside it must fail. CSS comments are stripped first so they cannot hide
  // or fake a use.
  const cssNoComments = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const declarations = [...cssNoComments.matchAll(/([a-z-]+)\s*:\s*[^;{}]*var\(--brand-green\)/g)];

  assert.ok(declarations.length > 0, 'expected at least one use of --brand-green (the header rule)');

  for (const [whole, property] of declarations) {
    assert.ok(/^border(-[a-z]+)*$/.test(property) || /^--chart-\d+$/.test(property),
      `--brand-green used as "${property}", which is neither a border nor a chart token: ${whole.trim()}`);
  }
});
