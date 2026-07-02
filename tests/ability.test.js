// Ability-bar loadout + per-skill rune-tree tests for Sanctuary's End.
//
// The action bar, save migration, and rune resolver all hang off three pure helpers: defaultLoadout (which
// backfills the 6 slots and must never lose the basic attack or duplicate a skill), the V7 SAVE.migrate
// (which must add loadout/skillRunes/abilityPoints without touching old fields), and resolveSkill/buildSkillTree/
// canAllocRune (the rune math + allocation rules that every cast reads). A bug here silently mis-stats a skill
// or bricks a save, so they earn a fast regression net. Same vm trick as gems.test.js: the save helpers live in
// game.js's browser-free prefix; the rune engine lives in a later self-contained block we splice in after it.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadAbility() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
  const idxThree = src.indexOf('/* ================= THREE');
  const idxRunes = src.indexOf('/* ================= RUNES');
  const idxCast = src.indexOf('function castActive(');
  const idxCanAlloc = src.indexOf('function canAllocRune(');
  const idxBuildRune = src.indexOf('function buildRuneSvg(');
  assert.ok(idxThree > 0 && idxRunes > idxThree && idxCast > idxRunes, 'game.js section markers moved');
  assert.ok(idxCanAlloc > 0 && idxBuildRune > idxCanAlloc, 'canAllocRune/buildRuneSvg markers moved');

  const prefix = src.slice(0, idxThree); // SKILLDEFS, ACTIVE_ORDER, CLASSES, PTREE, defaultLoadout, SAVE
  const runes = src.slice(idxRunes, idxCast); // RUNE_KIND/_runeShape/_runeKey/buildSkillTree/SKILL_RUNES/resolveSkill...
  const canAlloc = src.slice(idxCanAlloc, idxBuildRune); // canAllocRune (reads global player/character)

  // clamp + `let character` already exist in the prefix; only `player` is declared later (after the THREE cut).
  const glue = ';var player={level:99};';
  const exp =
    ';globalThis.__ab={defaultLoadout,SAVE,SKILLDEFS,ACTIVE_ORDER,SKILL_RUNES,buildSkillTree,resolveSkill,invalidateRunes,canAllocRune,classAbilities,CLASS_ACTIVES,setChar:(c)=>{character=c;invalidateRunes();},setLevel:(n)=>{player.level=n;}};';

  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(prefix + glue + runes + canAlloc + exp, sandbox, { filename: 'game.js(ability-slice)' });
  return sandbox.__ab;
}

const AB = loadAbility();

test('save VERSION is bumped to 7 for the loadout/rune migration', () => {
  assert.equal(AB.SAVE.VERSION, 7);
});

test('defaultLoadout locks the basic attack, honors activeSkillId, and never duplicates', () => {
  const lo = AB.defaultLoadout({ skills: { strike: 1, fireball: 1, frost: 1, nova: 1 }, activeSkillId: 'frost' });
  assert.equal(lo.length, 6);
  assert.equal(lo[0], 'strike', 'slot 0 must be the basic attack');
  assert.equal(lo[1], 'frost', 'the selected skill should land on the RMB slot');
  for (const id of ['fireball', 'nova']) assert.ok(lo.includes(id), `${id} should be backfilled`);
  const used = lo.filter(Boolean);
  assert.equal(new Set(used).size, used.length, 'no skill may appear in two slots');
});

test('defaultLoadout on a fresh character is just the basic attack', () => {
  const lo = AB.defaultLoadout({ skills: { strike: 1 }, activeSkillId: null });
  assert.equal(lo.length, 6);
  assert.equal(lo[0], 'strike');
  assert.ok(
    lo.slice(1).every((x) => x === null),
    'all non-basic slots empty',
  );
});

test('SAVE.migrate adds loadout/skillRunes/abilityPoints without disturbing existing fields', () => {
  const ch = {
    class: 'mage',
    level: 5,
    skills: { strike: 1, fireball: 1 },
    passives: ['start_int'],
    skillPoints: 4,
    activeSkillId: 'fireball',
  };
  const out = AB.SAVE.migrate(ch);
  assert.ok(Array.isArray(out.loadout) && out.loadout.length === 6, 'loadout array of 6');
  assert.equal(out.loadout[0], 'strike');
  assert.ok(out.loadout.includes('fireball'));
  assert.equal(Object.keys(out.skillRunes).length, 0, 'skillRunes starts empty');
  assert.equal(out.abilityPoints, 4, 'retroactive +1/level from L2 → level 5 gives 4');
  assert.equal(out.skillPoints, 4, 'existing passive points untouched');
  assert.equal(out.passives.length, 1, 'passives untouched');
  assert.equal(out.passives[0], 'start_int', 'passives untouched');
});

test('every active skill (except strike) gets a rune tree with a root and an exclusive branch set', () => {
  for (const id of AB.ACTIVE_ORDER) {
    if (id === 'strike') continue;
    const tree = AB.SKILL_RUNES[id];
    assert.ok(tree && tree.nodes[tree.root], `${id} missing tree/root`);
    const excl = {};
    for (const nid in tree.nodes) {
      const n = tree.nodes[nid];
      assert.ok(n.max >= 1 && n.cost >= 1, `${id}.${nid} bad max/cost`);
      if (n.excl) excl[n.excl] = (excl[n.excl] || 0) + 1;
    }
    assert.ok(
      Object.values(excl).some((c) => c >= 2),
      `${id} should offer a real choice (an excl group with 2+ runes)`,
    );
  }
});

test('resolveSkill folds numeric mods, clamps cdr, and unions flags', () => {
  AB.setLevel(99);
  AB.setChar({ skillRunes: { fireball: { fireball_dmg: 3 } } });
  let R = AB.resolveSkill('fireball');
  assert.ok(Math.abs(R.dmgMult - 1.21) < 1e-9, `+7%/rank × 3 → 1.21, got ${R.dmgMult}`);

  AB.setChar({ skillRunes: { fireball: { fireball_cdr: 3 } } }); // -5%/rank × 3 = -15% → 0.85
  R = AB.resolveSkill('fireball');
  assert.ok(Math.abs(R.cdrMult - 0.85) < 1e-9, `cdrMult should be 0.85, got ${R.cdrMult}`);

  AB.setChar({ skillRunes: { fireball: { fireball_sh0: 1 } } }); // Volatile (explodeOnImpact + addRadius:3)
  R = AB.resolveSkill('fireball');
  assert.ok(R.flags.has('explodeOnImpact'), 'flag rune should populate the flag set');
  assert.equal(R.addRadius, 3, 'numeric mod on a flag rune still folds');

  AB.setChar({ skillRunes: {} });
  R = AB.resolveSkill('fireball');
  assert.equal(R.dmgMult, 1, 'no runes → identity');
  assert.equal(R.flags.size, 0);
});

test('classAbilities lists a class’s actives ordered by unlock level, without strike', () => {
  AB.setChar({ class: 'warrior' });
  const list = AB.classAbilities();
  assert.ok(!list.includes('strike'), 'strike is the fixed basic attack, not in the unlock list');
  const reqs = list.map((id) => AB.CLASS_ACTIVES.warrior[id]);
  for (let i = 1; i < reqs.length; i++) assert.ok(reqs[i] >= reqs[i - 1], 'sorted by ascending unlock level');
  for (const id of list) assert.ok(AB.CLASS_ACTIVES.warrior[id] != null, `${id} belongs to the warrior unlock map`);
  assert.ok(list.includes('charge') && list.includes('whirlwind'), 'higher-tier warrior actives are surfaced');
});

test('the keystone is reachable from every shape node, not just the middle one', () => {
  AB.setLevel(99);
  // The three shapes are mutually exclusive; the keystone must link to all of them, or picking the
  // left/right shape would leave the middle blocked by exclusivity and the keystone unreachable forever.
  const tree = AB.SKILL_RUNES.fireball;
  for (const sh of ['fireball_sh0', 'fireball_sh1', 'fireball_sh2']) {
    assert.ok(tree.adj.fireball_key.includes(sh), `keystone should be adjacent to ${sh}`);
  }
  for (const sh of ['fireball_sh0', 'fireball_sh1', 'fireball_sh2']) {
    AB.setChar({
      abilityPoints: 99,
      skillRunes: { fireball: { fireball_dmg: 1, fireball_cdr: 1, fireball_mana: 1, [sh]: 1 } },
    });
    assert.equal(AB.canAllocRune('fireball', 'fireball_key'), true, `keystone must be allocatable after picking ${sh}`);
  }
});

test('the Extended (addDuration) rune folds into resolveSkill for util skills', () => {
  AB.setLevel(99);
  // warcry is a 'util' archetype tree whose sh2 is the +1.5s "Extended" rune; it must accumulate addDuration
  // (consumed by warcry's cast) rather than being an inert point sink.
  AB.setChar({ skillRunes: { warcry: { warcry_sh2: 1 } } });
  const R = AB.resolveSkill('warcry');
  assert.equal(R.addDuration, 1500, 'Extended rune should add 1500ms of duration');
});

test('canAllocRune enforces connectivity, exclusivity, and level gates', () => {
  AB.setLevel(99);
  AB.setChar({ abilityPoints: 99, skillRunes: { fireball: {} } });
  assert.equal(AB.canAllocRune('fireball', 'fireball_dmg'), true, 'root is allocatable from scratch');
  assert.equal(AB.canAllocRune('fireball', 'fireball_sh0'), false, 'a shape rune needs an allocated neighbor first');

  // Build a path to a shape rune, then verify its sibling shape rune is locked out by exclusivity.
  AB.setChar({ abilityPoints: 99, skillRunes: { fireball: { fireball_dmg: 1, fireball_cdr: 1, fireball_sh0: 1 } } });
  assert.equal(AB.canAllocRune('fireball', 'fireball_sh1'), false, 'only one rune per exclusive shape slot');

  // Level gate: shape runes require level base+2; at level 1 they are locked even with a neighbor.
  AB.setLevel(1);
  AB.setChar({ abilityPoints: 99, skillRunes: { fireball: { fireball_dmg: 1, fireball_cdr: 1 } } });
  assert.equal(AB.canAllocRune('fireball', 'fireball_sh0'), false, 'level requirement blocks early allocation');
});
