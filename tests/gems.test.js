// Gems + sockets tests for Sanctuary's End.
//
// Sockets fold into the same bonus map that drives every combat/UI stat, and a gem's effect depends on the
// socket's slot category (weapon/gear/jewelry). A bug here silently mis-stats gear or grants an out-of-table
// affix, so the pure helpers earn a fast regression net. Same trick as reforge.test.js: evaluate only
// game.js's browser-free prefix (everything before the THREE rendering section) in a vm sandbox.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadGems() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
  const cut = src.indexOf('/* ================= THREE');
  assert.ok(cut > 0, 'Could not find the THREE rendering-section marker in game.js.');
  const slice = `${src.slice(0, cut)}\n;globalThis.__gem = { GEMS, GEM_KEYS, rollSockets, SOCKET_MAX, gemFold, gemEff, gemCat, itemScore, AFFIX_KEYS };`;
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(slice, sandbox, { filename: 'game.js(gem-slice)' });
  return sandbox.__gem;
}

const { GEMS, GEM_KEYS, rollSockets, SOCKET_MAX, gemFold, gemEff, gemCat, itemScore, AFFIX_KEYS } = loadGems();
const AFFIX_SET = new Set(AFFIX_KEYS);
const CATS = ['weapon', 'gear', 'jewelry'];

test('every gem grants a real affix in all three socket categories, with 5 increasing tiers', () => {
  for (const t of GEM_KEYS) {
    const g = GEMS[t];
    for (const cat of CATS) {
      const e = g[cat];
      assert.ok(e && e.key, `${t} missing effect for ${cat}`);
      assert.ok(AFFIX_SET.has(e.key), `${t}.${cat} grants unknown affix ${e.key}`);
      assert.equal(e.vals.length, 5, `${t}.${cat} must have 5 tiers`);
      for (let q = 1; q < 5; q++) assert.ok(e.vals[q] > e.vals[q - 1], `${t}.${cat} tier ${q} must exceed ${q - 1}`);
    }
  }
});

test('rollSockets stays within the slot cap and produces empty sockets', () => {
  for (const slot in SOCKET_MAX) {
    for (let n = 0; n < 200; n++) {
      const s = rollSockets(slot, 'rare');
      assert.ok(s.length >= 0 && s.length <= SOCKET_MAX[slot], `${slot} rolled ${s.length} > cap ${SOCKET_MAX[slot]}`);
      assert.ok(
        s.every((x) => x === null),
        'fresh sockets must be null',
      );
    }
  }
  assert.equal(rollSockets('nonsense', 'rare').length, 0, 'non-socketable slot yields no sockets');
});

test('gemFold adds the slot-correct gem value to the matching bonus key, ignoring empties', () => {
  // a ruby grants a different stat per category: weapon→fireDmg, armor→hp(gear), ring→str(jewelry)
  for (const slot of ['weapon', 'armor', 'ring']) {
    const e = gemEff(slot, { t: 'ruby', q: 2 });
    const bonus = {};
    gemFold({ slot, sockets: [{ t: 'ruby', q: 2 }, null] }, bonus);
    assert.equal(bonus[e.key], e.vals[2], `ruby in ${slot} should grant ${e.vals[2]} ${e.key}`);
  }
  const b2 = {};
  gemFold({ slot: 'weapon', sockets: [null, null] }, b2);
  assert.deepEqual(b2, {}, 'empty sockets add nothing');
  const b3 = {};
  gemFold({ slot: 'weapon' }, b3);
  assert.deepEqual(b3, {}, 'no sockets array adds nothing');
});

test('socketing a gem strictly raises itemScore', () => {
  const mk = () => ({ slot: 'weapon', rarity: 'rare', baseStat: 20, affixes: { dmg: 6 }, upgrade: 0, sockets: [null] });
  const empty = itemScore(mk());
  const filled = mk();
  filled.sockets[0] = { t: 'amethyst', q: 4 };
  assert.ok(itemScore(filled) > empty, 'a socketed gem must increase item score');
});

test('gemCat maps slots to the three categories', () => {
  assert.equal(gemCat('weapon'), 'weapon');
  assert.equal(gemCat('ring'), 'jewelry');
  assert.equal(gemCat('amulet'), 'jewelry');
  for (const s of ['helm', 'armor', 'gloves', 'boots']) assert.equal(gemCat(s), 'gear');
});
