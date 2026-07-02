// sanctuary.html contract tests for Sanctuary's End.
//
// The whole game hangs off a few load-bearing lines in sanctuary.html: the Three.js import map (pinned to
// one version, with SRI hashes) and the ES-module shim that copies THREE/TSL onto window before the classic
// game script parses. CI type-checks game.js and runs node tests, but NOTHING parses sanctuary.html — so a
// broken import map (version drift, an SRI key that doesn't match an import, a dropped shim) would sail
// through green CI and produce a 100%-blank game in the browser (esp. Chromium, which enforces the hashes).
// These are cheap offline structural assertions that catch exactly those regressions.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'sanctuary.html'), 'utf8');

function importMap() {
  const m = HTML.match(/<script[^>]*type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/i);
  assert.ok(m, 'no <script type="importmap"> block found in sanctuary.html');
  let json;
  assert.doesNotThrow(() => {
    json = JSON.parse(m[1]);
  }, 'import map is not valid JSON');
  return json;
}

test('import map parses and defines the three specifiers game.js needs', () => {
  const map = importMap();
  assert.ok(map.imports, 'import map has no "imports"');
  for (const spec of ['three', 'three/webgpu', 'three/tsl', 'three/addons/']) {
    assert.ok(map.imports[spec], `import map missing specifier: ${spec}`);
  }
});

test('all import-map URLs pin a single three@x.y.z version', () => {
  const map = importMap();
  const urls = Object.values(map.imports);
  const versions = new Set();
  for (const url of urls) {
    const v = url.match(/three@(\d+\.\d+\.\d+)/);
    assert.ok(v, `import URL is not a pinned three@x.y.z: ${url}`);
    versions.add(v[1]);
  }
  assert.equal(versions.size, 1, `all three URLs must share one version, saw: ${[...versions].join(', ')}`);
});

test('every SRI integrity key corresponds to a declared import URL', () => {
  const map = importMap();
  if (!map.integrity) return; // integrity block is optional (progressive enhancement) — nothing to check
  const importUrls = new Set(Object.values(map.imports));
  for (const url of Object.keys(map.integrity)) {
    assert.ok(importUrls.has(url), `integrity URL has no matching import (version bump drift?): ${url}`);
    assert.match(map.integrity[url], /^sha(256|384|512)-/, `integrity value is not an SRI hash: ${url}`);
  }
});

test('the window.THREE / window.TSL shim and the classic game script are both present', () => {
  // game.js is a classic script that reads THREE/TSL as bare globals, so the module shim must assign them.
  assert.match(HTML, /window\.THREE\s*=/, 'missing window.THREE assignment (module shim)');
  assert.match(HTML, /window\.TSL\s*=/, 'missing window.TSL assignment (module shim)');
  // the game itself must load as at least one deferred .js script so it runs after the shim (matches both the
  // single game.js today and the split js/*.js files later).
  assert.match(HTML, /<script[^>]*\bdefer\b[^>]*src=["'][^"']+\.js["']/i, 'missing deferred game script tag');
});
