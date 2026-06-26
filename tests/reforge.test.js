// Crafting / Reforge tests for Sanctuary's End.
//
// Reforge rerolls an item's rolled affixes (with a small chance to bump rarity). A bug here silently
// mangles players' gear — wrong affix counts, an out-of-table affix, or promoting a unique into garbage —
// so it earns a fast regression net. Same trick as save.test.js: evaluate only game.js's browser-free
// prefix (everything before the THREE rendering section) in a vm sandbox, then assert on the REAL logic.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCraft() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
  const cut = src.indexOf('/* ================= THREE');
  assert.ok(cut > 0, 'Could not find the THREE rendering-section marker in game.js.');
  const slice = `${src.slice(0, cut)}\n;globalThis.__craft = { reforgeItem, reforgeable, dustValue, RARITY_AFFIX, AFFIX_KEYS, RARITY_LADDER };`;
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(slice, sandbox, { filename: 'game.js(craft-slice)' });
  return sandbox.__craft;
}

const { reforgeItem, reforgeable, dustValue, RARITY_AFFIX, AFFIX_KEYS } = loadCraft();
const AFFIX_SET = new Set(AFFIX_KEYS);
const REFORGE_TIERS = ['common', 'magic', 'rare'];

function mkItem(rarity) {
  return { id: 42, slot: 'helm', ilvl: 20, base: 'Cap', rarity, affixes: { dmg: 5 }, baseStat: 10, upgrade: 3, enchant: { key: 'hp', val: 9 } };
}

test('reforge preserves identity and respects the rarity affix-count table', () => {
  for (let n = 0; n < 400; n++) {
    const start = REFORGE_TIERS[n % 3];
    const it = mkItem(start);
    reforgeItem(it);
    // identity preserved
    assert.equal(it.id, 42);
    assert.equal(it.slot, 'helm');
    assert.equal(it.ilvl, 20);
    assert.equal(it.base, 'Cap');
    assert.equal(it.upgrade, 3, 'upgrade level must survive a reforge');
    assert.deepEqual(it.enchant, { key: 'hp', val: 9 }, 'chosen enchant must survive a reforge');
    // rarity never escapes common/magic/rare (sets/uniques are never produced)
    assert.ok(REFORGE_TIERS.includes(it.rarity), `reforge produced illegal rarity: ${it.rarity}`);
    // affix count within the rarity's [lo,hi]
    const keys = Object.keys(it.affixes);
    const [lo, hi] = RARITY_AFFIX[it.rarity];
    assert.ok(keys.length >= lo && keys.length <= hi, `affix count ${keys.length} outside [${lo},${hi}] for ${it.rarity}`);
    // every affix is a real, positive affix
    for (const k of keys) {
      assert.ok(AFFIX_SET.has(k), `unknown affix key: ${k}`);
      assert.ok(it.affixes[k] >= 1, `affix ${k} rolled non-positive value ${it.affixes[k]}`);
    }
  }
});

test('reforge can only raise rarity upward, never demote, and never past rare', () => {
  for (let n = 0; n < 400; n++) {
    const start = REFORGE_TIERS[n % 3];
    const it = mkItem(start);
    reforgeItem(it);
    assert.ok(REFORGE_TIERS.indexOf(it.rarity) >= REFORGE_TIERS.indexOf(start), 'rarity must never drop');
    assert.notEqual(it.rarity, 'set');
    assert.notEqual(it.rarity, 'unique');
  }
});

test('reforgeable excludes set and unique gear', () => {
  assert.ok(reforgeable(mkItem('common')));
  assert.ok(reforgeable(mkItem('magic')));
  assert.ok(reforgeable(mkItem('rare')));
  assert.ok(!reforgeable(mkItem('set')));
  assert.ok(!reforgeable(mkItem('unique')));
  assert.ok(!reforgeable(null));
});

test('dustValue rises with rarity', () => {
  const order = ['common', 'magic', 'rare', 'set', 'unique'].map((r) => dustValue(mkItem(r)));
  for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], 'dust must increase with rarity');
});
