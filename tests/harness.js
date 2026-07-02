// Shared test harness for the split game (js/00..26).
//
// The game logic lives in classic scripts that share one global scope. The browser-free prefix — utils,
// items, skills, and the SAVE object — is the first four files (CORE_FILES); the rune engine adds one more.
// We evaluate the real files in a vm sandbox (no marker-slicing, no per-test drift) with a localStorage stub
// so SAVE.load() runs, then splice in a one-line export snippet to lift the symbols under test into scope.
//
// Note: values built inside the sandbox live in a separate realm, so tests assert on scalars / lengths /
// JSON shape rather than deepStrictEqual (which rejects cross-realm prototypes).

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// The browser-free logic prefix (everything the old tests sliced out before the THREE rendering section).
const CORE_FILES = ['js/00-core.js', 'js/01-items.js', 'js/02-skills.js', 'js/03-save.js'];
// The rune engine (RUNE data, buildSkillTree, resolveSkill, canAllocRune) — also browser-free at load time.
const RUNES_FILE = 'js/14-runes.js';

function makeSandbox(extra) {
  const store = new Map();
  const sandbox = {
    console,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    ...extra,
  };
  vm.createContext(sandbox);
  return sandbox;
}

// Evaluate each repo-relative file into the sandbox, in order. A missing file throws a clear ENOENT.
function loadFiles(sandbox, files) {
  for (const f of files) {
    const code = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    vm.runInContext(code, sandbox, { filename: f });
  }
  return sandbox;
}

// Run a small glue/export snippet in the sandbox (e.g. ';globalThis.__x = { ... };').
function runSnippet(sandbox, code) {
  return vm.runInContext(code, sandbox, { filename: '(test-glue)' });
}

module.exports = { CORE_FILES, RUNES_FILE, makeSandbox, loadFiles, runSnippet };
