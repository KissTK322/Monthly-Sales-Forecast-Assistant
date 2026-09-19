/* build.cjs — produce dist/index.html, the single-file offline review copy.
 *
 * What it does:
 *   - inlines css/styles.css into a <style> block
 *   - inlines every <script src="..."> that is not marked data-build="strip"
 *   - removes every element marked data-build="strip"
 *     (the manifest link and js/pwa.js, i.e. the whole install/update path)
 *   - unhides every element marked data-build="show" (the dist notice)
 *
 * Why strip the PWA layer: a service worker cannot be registered from file://,
 * so a single file that carries the registration code would look installable
 * and never be. architecture.md section 2 makes that split explicit.
 *
 * Output is deterministic: no timestamps, no hashes, no ordering by mtime.
 * Run twice, get identical bytes; tests/shell.test.cjs checks that.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SOURCE = path.join(ROOT, 'index.html');
const OUT_DIR = path.join(ROOT, 'dist');
const OUT_FILE = path.join(OUT_DIR, 'index.html');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

/* Matches a whole tag that carries data-build="<mode>", including a closing
   tag when the element has one.
   How to read it, piece by piece:
     [ \t]*                  leading indentation, so no blank line is left
     <([a-zA-Z0-9-]+)\b      the opening tag; its name is captured as group 1
     [^>]*data-build="MODE"  ...somewhere inside, the marker attribute
     [^>]*>                  ...then the rest of the opening tag
     (?:[\s\S]*?<\/\1>)?     optionally, the shortest run up to the MATCHING
                             closing tag — \1 reuses the name from group 1, so
                             <script ...></script> closes on </script>
     \n?                     the trailing newline
   <link> has no closing tag, so the optional part simply does not match. */
function tagPattern(mode) {
  return new RegExp(
    '[ \\t]*<([a-zA-Z0-9-]+)\\b[^>]*\\bdata-build="' + mode + '"[^>]*>(?:[\\s\\S]*?<\\/\\1>)?\\n?',
    'g'
  );
}

function build() {
  let html = read('index.html');

  const stripped = [];
  const inlined = [];

  /* 1. Remove everything marked for stripping. */
  html = html.replace(tagPattern('strip'), (match) => {
    stripped.push(match.trim().slice(0, 60).replace(/\s+/g, ' '));
    return '';
  });

  /* 2. Unhide the dist-only notice. */
  html = html.replace(/(<[^>]*\bdata-build="show"[^>]*>)/g, (match) =>
    match.replace(/\s+hidden(?=[\s>])/, '')
  );

  /* 3. Inline the stylesheet. */
  html = html.replace(
    /[ \t]*<link\s+rel="stylesheet"\s+href="([^"]+)"\s*>\n?/g,
    (match, href) => {
      inlined.push(href);
      return '<style>\n' + read(href).trimEnd() + '\n</style>\n';
    }
  );

  /* 4. Inline the remaining scripts, in document order. */
  html = html.replace(
    /[ \t]*<script\s+src="([^"]+)"\s*><\/script>\n?/g,
    (match, src) => {
      const source = read(src);
      /* A literal "</script" inside inlined code would end the script block
         early and silently break the page. Fail the build instead. */
      if (/<\/script/i.test(source)) {
        throw new Error('build.cjs: ' + src + ' contains "</script", which cannot be inlined safely');
      }
      inlined.push(src);
      return '<script>\n' + source.trimEnd() + '\n</script>\n';
    }
  );

  /* 5. Inline images as data URIs. Without this the single file would show a
        broken image: nothing resolves icons/ when the file is opened alone. */
  html = html.replace(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/g, (match, src) => {
    const file = path.join(ROOT, src);
    if (!fs.existsSync(file)) return match;
    const base64 = fs.readFileSync(file).toString('base64');
    const type = path.extname(src).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
    inlined.push(src);
    return match.replace(src, 'data:' + type + ';base64,' + base64);
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, html, 'utf8');

  return { html, stripped, inlined };
}

if (require.main === module) {
  const result = build();
  const kb = (Buffer.byteLength(result.html, 'utf8') / 1024).toFixed(1);
  console.log('dist/index.html written: ' + kb + ' KB');
  console.log('  inlined: ' + result.inlined.join(', '));
  console.log('  stripped: ' + result.stripped.join(' | '));
}

module.exports = { build, OUT_FILE };
