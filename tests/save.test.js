// Save-data / migration tests for Sanctuary's End.
//
// These guard the code path that protects players' characters: SAVE.migrate() upgrading old saves
// and SAVE.newCharacter() producing a valid hero. A bug here is the worst kind — silently corrupted
// or lost characters — so it's worth a fast, dependency-free regression net.
//
// We test the REAL logic (no duplication, no drift): the browser-free logic files (js/00..03) are evaluated
// in a tiny vm sandbox with a localStorage stub via the shared harness. Run with `npm test`.
//
// Note: objects returned by SAVE.* are built inside the vm sandbox (a separate realm), so we assert on
// scalars / lengths / JSON shape rather than deepStrictEqual, which rejects cross-realm prototypes.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CORE_FILES, makeSandbox, loadFiles, runSnippet } = require('./harness');

function loadGameSave() {
  const sandbox = makeSandbox();
  loadFiles(sandbox, CORE_FILES);
  runSnippet(sandbox, ';globalThis.__save = { SAVE, CLASSES, SKILLDEFS, SLOTS, PTREE };');
  // Expose the localStorage stub so tests can exercise SAVE.load()/persist() — the real production path
  // that parses stored JSON, migrates every slot, and backfills settings (the receiving end of import).
  return { ...sandbox.__save, localStorage: sandbox.localStorage };
}

const { SAVE, CLASSES, SKILLDEFS, SLOTS, PTREE, localStorage: LS } = loadGameSave();

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

// --- SAVE.load()/persist(): the actual production path (parse localStorage → migrate slots → backfill
//     settings). This is what import writes into, and where a malformed slot would brick the game at boot. ---

test('load() falls back to a clean default when the stored JSON is garbage', () => {
  LS.setItem(SAVE.KEY, '{ this is not json');
  assert.doesNotThrow(() => SAVE.load());
  assert.equal(SAVE._data.version, SAVE.VERSION);
  assert.equal(SAVE._data.slots.length, SAVE.NUM_SLOTS);
  assert.ok(
    SAVE._data.slots.every((s) => s === null),
    'all slots empty after garbage',
  );
});

test('load() does not throw on non-object slots (import-brick guard) and nulls them out', () => {
  // {"slots":["bogus"]} is a shape importSave used to accept — before the guard it threw in migrate() at
  // top-level boot and permanently bricked the game. load() must survive it and degrade the bad slots.
  LS.setItem(SAVE.KEY, JSON.stringify({ version: 7, slots: ['bogus', 42, ['x'], null] }));
  assert.doesNotThrow(() => SAVE.load());
  assert.ok(
    SAVE._data.slots.every((s) => s === null),
    'every non-object slot degrades to null',
  );
});

test('load() migrates a sparse legacy (v1) slot and rewrites the store version', () => {
  LS.setItem(SAVE.KEY, JSON.stringify({ version: 1, slots: [{ name: 'Old', class: 'mage', level: 3 }, null, null] }));
  SAVE.load();
  assert.equal(SAVE._data.version, SAVE.VERSION, 'container version bumped');
  const s0 = SAVE.getSlot(0);
  assert.equal(s0.name, 'Old');
  assert.ok(Array.isArray(s0.loadout) && s0.loadout.length === 6, 'v7 loadout backfilled');
  assert.equal(typeof s0.skillRunes, 'object', 'v7 skillRunes backfilled');
  assert.equal(typeof s0.abilityPoints, 'number', 'v7 abilityPoints backfilled');
  assert.equal(typeof s0.materials, 'number', 'materials backfilled');
});

test('load() preserves stored settings and backfills newly-added defaults', () => {
  LS.setItem(
    SAVE.KEY,
    JSON.stringify({ version: 6, slots: [null, null, null], settings: { difficulty: 'Hell', volume: 20 } }),
  );
  SAVE.load();
  const s = SAVE._data.settings;
  assert.equal(s.difficulty, 'Hell', 'existing setting preserved');
  assert.equal(s.volume, 20, 'existing setting preserved');
  assert.equal(s.music, true, 'missing default backfilled');
  assert.ok(s.lootFilter && s.lootFilter.rarity, 'nested default (lootFilter) backfilled');
});

test('persist() then load() round-trips a fresh character without shape loss', () => {
  LS.setItem(SAVE.KEY, JSON.stringify({ version: SAVE.VERSION, slots: [null, null, null] }));
  SAVE.load();
  const fresh = SAVE.newCharacter('Trip', 'rogue');
  assert.equal(SAVE.saveCharacter(0, fresh), true, 'persist reports success on the stub');
  SAVE.load(); // re-read from storage exactly as a page reload would
  const back = SAVE.getSlot(0);
  assert.equal(back.name, 'Trip');
  assert.equal(back.class, 'rogue');
  assert.equal(back.loadout.length, 6);
  assert.equal(JSON.stringify(Object.keys(back.equipment).sort()), JSON.stringify([...SLOTS].sort()));
  for (const id of Object.keys(SKILLDEFS)) assert.ok(id in back.skills, `skill ${id} lost on round-trip`);
});
