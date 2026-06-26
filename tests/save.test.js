// Save-data / migration tests for Sanctuary's End.
//
// These guard the code path that protects players' characters: SAVE.migrate() upgrading old saves
// and SAVE.newCharacter() producing a valid hero. A bug here is the worst kind — silently corrupted
// or lost characters — so it's worth a fast, dependency-free regression net.
//
// We test the REAL logic out of game.js (no duplication, no drift): game.js is a single classic
// script, so we evaluate just its game-logic prefix — everything BEFORE the `THREE` rendering section,
// which needs a browser + WebGPU — inside a tiny sandbox with a localStorage stub. Run with `npm test`
// (or `node --test tests/`).
//
// Note: objects returned by SAVE.* are built inside the vm sandbox (a separate realm), so we assert on
// scalars / lengths / JSON shape rather than deepStrictEqual, which rejects cross-realm prototypes.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load SAVE (+ a few data tables) from game.js by evaluating everything up to the rendering section.
function loadGameSave() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
  const marker = '/* ================= THREE';
  const cut = src.indexOf(marker);
  assert.ok(
    cut > 0,
    'Could not find the THREE rendering-section marker in game.js. If the file was ' +
      'restructured, update this boundary so the test still loads only the browser-free save logic.',
  );
  const slice = `${src.slice(0, cut)}\n;globalThis.__save = { SAVE, CLASSES, SKILLDEFS, SLOTS, PTREE };`;

  const store = new Map();
  const sandbox = {
    console,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(slice, sandbox, { filename: 'game.js(save-slice)' });
  return sandbox.__save;
}

const { SAVE, CLASSES, SKILLDEFS, SLOTS, PTREE } = loadGameSave();

test('newCharacter produces a complete, valid hero', () => {
  const c = SAVE.newCharacter('Tester', 'mage');
  assert.equal(c.name, 'Tester');
  assert.equal(c.class, 'mage');
  assert.equal(c.level, 1);
  assert.equal(c.version, SAVE.VERSION);
  // stats seeded from the class base table
  assert.equal(c.stats.str, CLASSES.mage.base.str);
  assert.equal(c.stats.dex, CLASSES.mage.base.dex);
  assert.equal(c.stats.vit, CLASSES.mage.base.vit);
  assert.equal(c.stats.eng, CLASSES.mage.base.eng);
  // every equipment slot exists and starts empty
  for (const s of SLOTS) {
    assert.ok(s in c.equipment, `missing equipment slot: ${s}`);
    assert.equal(c.equipment[s], null, `slot ${s} should start empty`);
  }
  assert.ok(Array.isArray(c.inventory) && c.inventory.length === 0);
  assert.ok(Array.isArray(c.stash) && c.stash.length === 0);
  // a rank entry exists for every defined skill
  for (const id of Object.keys(SKILLDEFS)) {
    assert.ok(id in c.skills, `missing skill rank entry: ${id}`);
  }
  // starting passive node matches the class
  assert.equal(c.passives.length, 1);
  assert.equal(c.passives[0], PTREE.starts.mage);
});

test('newCharacter falls back to warrior for an unknown class', () => {
  const c = SAVE.newCharacter('Nobody', 'sorcerer');
  assert.equal(c.class, 'warrior');
  assert.equal(c.passives[0], PTREE.starts.warrior);
});

test('migrate backfills every required field on a sparse legacy save', () => {
  const m = SAVE.migrate({ name: 'Old', class: 'rogue' });
  assert.ok(m.base && typeof m.base.hpMax === 'number' && typeof m.base.mpMax === 'number');
  for (const k of ['str', 'dex', 'vit', 'eng']) {
    assert.equal(typeof m.stats[k], 'number', `stat ${k} not backfilled`);
  }
  for (const s of SLOTS) {
    assert.ok(s in m.equipment, `equipment slot not backfilled: ${s}`);
  }
  assert.equal(typeof m.statPoints, 'number');
  assert.equal(typeof m.skillPoints, 'number');
  assert.equal(typeof m.invMax, 'number');
  assert.equal(typeof m.stashMax, 'number');
  assert.equal(m.discovered.town, true);
  assert.ok(Array.isArray(m.passives) && m.passives.length >= 1);
  // unknown/blank class is normalized
  const noClass = SAVE.migrate({ name: 'Classless' });
  assert.equal(noClass.class, 'warrior');
});

test('migrate converts legacy stat points into skill points (v<5 respec)', () => {
  const m = SAVE.migrate({ name: 'Legacy', class: 'warrior', statPoints: 5, skillPoints: 2 });
  assert.equal(m.statPoints, 0, 'stat points should be drained');
  assert.equal(m.skillPoints, 7, 'drained stat points should be added to skill points');
});

test('migrate is idempotent — re-running does not corrupt a save', () => {
  const once = SAVE.migrate({ name: 'Idem', class: 'mage', statPoints: 3 });
  const twice = SAVE.migrate(JSON.parse(JSON.stringify(once)));
  assert.equal(JSON.stringify(twice.equipment), JSON.stringify(once.equipment));
  assert.equal(JSON.stringify(twice.stats), JSON.stringify(once.stats));
  assert.equal(twice.statPoints, once.statPoints);
  assert.equal(twice.skillPoints, once.skillPoints);
  assert.equal(JSON.stringify(twice.passives), JSON.stringify(once.passives));
});

test('a freshly created character survives a migrate round-trip unchanged in shape', () => {
  const fresh = SAVE.newCharacter('Round', 'warrior');
  const migrated = SAVE.migrate(JSON.parse(JSON.stringify(fresh)));
  assert.equal(migrated.class, 'warrior');
  assert.equal(JSON.stringify(Object.keys(migrated.equipment).sort()), JSON.stringify([...SLOTS].sort()));
  for (const id of Object.keys(SKILLDEFS)) {
    assert.ok(id in migrated.skills, `skill ${id} lost during migrate`);
  }
});
