// Load-order guard for the split game scripts.
//
// The game is a set of classic <script defer> files that share one global scope; ORDER IS LOAD-BEARING
// (numeric filename prefix = execution order = original game.js line order). Nothing at runtime enforces
// that sanctuary.html lists every js/ file exactly once, in ascending order, all deferred, after the module
// shim — a dropped or reordered tag would only surface as a TDZ/ReferenceError in the browser. This test
// pins the HTML tag list to the js/ directory so drift fails CI instead.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'sanctuary.html'), 'utf8');

// Every js/*.js referenced by a <script src="js/..."> tag, in document order.
function scriptSrcsInOrder() {
  const srcs = [];
  const re = /<script\b([^>]*)\bsrc=["'](js\/[^"']+\.js)["']/gi;
  let m;
  while ((m = re.exec(HTML))) srcs.push({ attrs: m[1] + '', src: m[2] });
  return srcs;
}

test('every js/*.js file on disk is loaded by sanctuary.html exactly once', () => {
  const onDisk = fs
    .readdirSync(path.join(ROOT, 'js'))
    .filter((f) => f.endsWith('.js'))
    .sort();
  const inHtml = scriptSrcsInOrder().map((s) => s.src.replace(/^js\//, ''));
  assert.deepEqual([...inHtml].sort(), onDisk, 'the js/ directory and the HTML <script> list have drifted');
  assert.equal(new Set(inHtml).size, inHtml.length, 'a js file is listed more than once');
});

test('script tags are in ascending (numeric-prefix) order', () => {
  const inHtml = scriptSrcsInOrder().map((s) => s.src);
  const sorted = [...inHtml].sort();
  assert.deepEqual(inHtml, sorted, 'script tags are not in ascending filename order (load order is line order)');
});

test('all game scripts are deferred so they run after the window.THREE/TSL module shim', () => {
  for (const s of scriptSrcsInOrder()) {
    assert.match(s.attrs, /\bdefer\b/, `${s.src} must be a defer script`);
  }
});
