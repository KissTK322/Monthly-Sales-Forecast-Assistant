/* tests/helpers.cjs — run a classic browser script under Node.
 *
 * The app ships classic scripts that attach to window.MSFA (no bundler, and
 * ES modules would not load from file:// in dist/index.html). Tests execute a
 * file's source against a stand-in window and return what it attached.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

/* Returns the MSFA namespace the file attached. Pass `shared` to load several
   modules into one namespace, the way the browser loads them in order. */
function loadModule(relativePath, shared) {
  const sandbox = shared || {};
  new Function('window', 'localStorage', 'document', read(relativePath))(sandbox, undefined, undefined);
  return sandbox.MSFA;
}

function loadModules(paths) {
  const sandbox = {};
  paths.forEach((p) => loadModule(p, sandbox));
  return sandbox.MSFA;
}

module.exports = { ROOT, read, loadModule, loadModules };
