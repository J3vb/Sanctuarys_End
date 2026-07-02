/* ================= ITEMS ================= */
const SLOTS = ['weapon', 'helm', 'armor', 'gloves', 'boots', 'ring', 'amulet'];

/* ---- floor bounties: optional per-floor goal that pays a bonus (soft gate; portal stays open) ----
   Pure (no THREE/DOM) so tests/objectives.test.js can load them from the browser-free prefix. */
function rollFloorObjective(depth) {
  if (depth <= 1 || depth % 5 === 0 || depth === 666) return null; // boss floors + the opening floor get no bounty
  if (Math.random() < 0.5) return { kind: 'champion', done: false };
  return { kind: 'slay', target: clamp(6 + (depth >> 1), 6, 18), count: 0, done: false };
}
// Advance a bounty by one kill of `kind` ('kill' | 'champion'); returns true on the transition to complete (once).
function bountyProgress(obj, kind) {
  if (!obj || obj.done) return false;
  if (obj.kind === 'slay' && kind === 'kill') { if (++obj.count >= obj.target) { obj.done = true; return true; } return false; }
  if (obj.kind === 'champion' && kind === 'champion') { obj.done = true; return true; }
  return false;
}
const SLOT_ICON = { weapon: '⚔️', helm: '🪖', armor: '🛡️', gloves: '🧤', boots: '🥾', ring: '💍', amulet: '📿' };
const BASE_NAMES = { weapon: ['Sword', 'Axe', 'Mace', 'Dagger', 'Blade', 'War Hammer', 'Cleaver', 'Scimitar', 'Flail', 'Glaive'], helm: ['Cap', 'Helm', 'Hood', 'Crown', 'Visor', 'Barbute', 'Sallet'], armor: ['Tunic', 'Mail', 'Plate', 'Robe', 'Cuirass', 'Brigandine', 'Hauberk'], gloves: ['Gloves', 'Gauntlets', 'Grips', 'Vambraces'], boots: ['Boots', 'Greaves', 'Sabatons', 'Treads'], ring: ['Ring', 'Band', 'Signet', 'Loop'], amulet: ['Amulet', 'Pendant', 'Talisman', 'Charm'] };
/* Class-flavored weapon base names (cosmetic only — base does not affect stats; baseStat comes from ilvl/rarity).
   Lets the visible weapon model be loot-driven for every class: mages roll caster bases, rogues ranged, warriors melee. */
const WEAPON_BASES = {
  melee: ['Sword', 'Axe', 'Mace', 'Dagger', 'Blade', 'War Hammer', 'Cleaver', 'Scimitar', 'Flail', 'Glaive'],
  caster: ['Staff', 'Wand', 'Scepter', 'Rod', 'Spire', 'Branch'],
  ranged: ['Bow', 'Crossbow', 'Longbow', 'Shortbow', 'Recurve', 'Hunting Bow'],
};
const CLASS_WEAPON_FAMILY = { warrior: 'melee', mage: 'caster', rogue: 'ranged' };
function pickWeaponBase() { return choice(WEAPON_BASES[CLASS_WEAPON_FAMILY[(typeof character !== 'undefined' && character && character.class)] || 'melee']); }
const PREFIX = ['Sturdy', 'Cruel', 'Vicious', 'Glowing', 'Ancient', 'Savage', 'Blessed', 'Howling', 'Grim', 'Radiant'];
const SUFFIX = ['of the Bear', 'of Flames', 'of Vigor', 'of the Fox', 'of Power', 'of the Owl', 'of Warding', 'of Fury', 'of the Wolf', 'of Doom'];
const AFFIXES = {
  dmg: { label: 'Damage', roll: il => randi(2, 4 + Math.round(il * 1.1)) }, hp: { label: 'Life', roll: il => randi(8, 18 + Math.round(il * 2)) }, mp: { label: 'Mana', roll: il => randi(5, 10 + Math.round(il * 1.4)) }, armor: { label: 'Armor', roll: il => randi(2, 5 + Math.round(il * 1.2)) }, str: { label: 'Strength', roll: il => randi(1, 2 + Math.round(il * 0.4)) }, dex: { label: 'Dexterity', roll: il => randi(1, 2 + Math.round(il * 0.4)) }, vit: { label: 'Vitality', roll: il => randi(1, 2 + Math.round(il * 0.4)) }, eng: { label: 'Energy', roll: il => randi(1, 2 + Math.round(il * 0.4)) }, crit: { label: 'Crit Chance %', roll: il => randi(2, 5) }, ias: { label: 'Attack Speed %', roll: il => randi(3, 7) }, ms: { label: 'Move Speed %', roll: il => randi(3, 8) }, leech: { label: 'Life Leech %', roll: il => randi(1, 3) }, allstats: { label: 'All Attributes', roll: il => randi(1, 1 + Math.round(il * 0.25)) }, thorns: { label: 'Thorns', roll: il => randi(2, 5 + Math.round(il * 0.6)) },
  fireRes: { label: 'Fire Resist %', roll: il => randi(4, 9 + Math.round(il * 0.4)) }, coldRes: { label: 'Cold Resist %', roll: il => randi(4, 9 + Math.round(il * 0.4)) }, poisonRes: { label: 'Poison Resist %', roll: il => randi(4, 9 + Math.round(il * 0.4)) }, lightRes: { label: 'Lightning Resist %', roll: il => randi(4, 9 + Math.round(il * 0.4)) },
  allRes: { label: 'All Resist %', roll: il => randi(2, 4 + Math.round(il * 0.25)) },
  critDmg: { label: 'Crit Damage %', roll: il => randi(8, 15 + Math.round(il * 1.0)) },
  manaLeech: { label: 'Mana Leech %', roll: il => randi(1, 3) }, leechAll: { label: 'Life & Mana Leech %', roll: il => randi(1, 2) },
  burnOnHit: { label: '% Burn on Hit', roll: il => randi(8, 16 + Math.round(il * 0.3)) }, bleedOnHit: { label: '% Bleed on Hit', roll: il => randi(8, 16 + Math.round(il * 0.3)) },
  skillranks: { label: 'to Skills', roll: il => randi(1, 1 + Math.round(il * 0.08)) },
  skilldmg: { label: 'Skill Damage %', roll: il => randi(5, 9 + Math.round(il * 0.3)) },
  activeskill: { label: 'Active Skill Dmg %', roll: il => randi(8, 14 + Math.round(il * 0.4)) },
  fireDmg: { label: 'Fire Damage %', roll: il => randi(6, 12 + Math.round(il * 0.4)) },
  coldDmg: { label: 'Cold Damage %', roll: il => randi(6, 12 + Math.round(il * 0.4)) },
  lightDmg: { label: 'Lightning Damage %', roll: il => randi(6, 12 + Math.round(il * 0.4)) },
  poisonDmg: { label: 'Poison Damage %', roll: il => randi(6, 12 + Math.round(il * 0.4)) },
  hpregen: { label: 'Health Regen /s', roll: il => randi(2, 4 + Math.round(il * 0.5)) },
  mpregen: { label: 'Mana Regen /s', roll: il => randi(1, 2 + Math.round(il * 0.4)) },
  mf: { label: 'Magic Find %', roll: il => randi(5, 10 + Math.round(il * 0.3)) },
  gf: { label: 'Gold Find %', roll: il => randi(6, 12 + Math.round(il * 0.4)) },
  dodge: { label: 'Dodge %', roll: il => randi(2, 4 + Math.round(il * 0.15)) },
  flatDR: { label: 'Damage Reduction %', roll: il => randi(2, 4 + Math.round(il * 0.15)) },
  cdr: { label: 'Cooldown Reduction %', roll: il => randi(3, 6 + Math.round(il * 0.2)) },
  lifeOnHit: { label: 'Life on Hit', roll: il => randi(2, 4 + Math.round(il * 0.5)) }
};
const AFFIX_KEYS = Object.keys(AFFIXES);
// tooltip grouping: off=offense, def=defense, res=resistance, util=utility
const AFFIX_CAT = { dmg: 'off', crit: 'off', ias: 'off', critDmg: 'off', leech: 'off', skillranks: 'off', skilldmg: 'off', activeskill: 'off', fireDmg: 'off', coldDmg: 'off', lightDmg: 'off', poisonDmg: 'off', burnOnHit: 'off', bleedOnHit: 'off', hp: 'def', armor: 'def', thorns: 'def', hpregen: 'def', fireRes: 'res', coldRes: 'res', poisonRes: 'res', lightRes: 'res', allRes: 'res', mp: 'util', str: 'util', dex: 'util', vit: 'util', eng: 'util', ms: 'util', allstats: 'util', manaLeech: 'util', leechAll: 'util', mpregen: 'util', mf: 'util', gf: 'util', dodge: 'def', flatDR: 'def', cdr: 'off', lifeOnHit: 'off' };
const AFFIX_CAT_ORD = { off: 1, def: 2, res: 3, util: 4 };
const RARITY_AFFIX = { common: [0, 0], magic: [1, 2], rare: [3, 5], set: [2, 3], unique: [4, 6] };
const RCOL = { common: 0xc8b89a, magic: 0x4a6ad0, rare: 0xd0b020, set: 0x40c040, unique: 0xb06010 };
const RTIER = { common: 1, magic: 2, rare: 3, set: 4, unique: 5 };
/* rarity now scales raw power: multiplier on base stat AND each rolled affix value (uniques keep hand-tuned values) */
const RARITY_MULT = { common: 1.0, magic: 1.18, rare: 1.4, set: 1.55, unique: 1.7 };
const RARITY_NAME = { common: 'Common', magic: 'Magic', rare: 'Rare', set: 'Set', unique: 'Unique' };
function baseStatRoll(slot, ilvl, rarity) { const m = RARITY_MULT[rarity] || 1; if (slot === 'weapon') return Math.round((4 + ilvl * 1.3 + rand(0, 4)) * m); if (slot !== 'ring' && slot !== 'amulet') return Math.round((2 + ilvl * 0.9 + rand(0, 3)) * m); return 0; }
function affixRoll(k, ilvl, rarity) { return Math.max(1, Math.round(AFFIXES[k].roll(ilvl) * (RARITY_MULT[rarity] || 1))); }
const UNIQUE_DEFS = [
  { slot: 'weapon', name: 'Bloodfang', base: 14, affixes: { dmg: 12, crit: 8 }, effect: 'lifesteal', effVal: 0.12, desc: 'Heals 12% of melee/spell damage dealt.' },
  { slot: 'armor', name: 'Thornmail', base: 14, affixes: { armor: 18, vit: 10 }, effect: 'thorns', effVal: 14, desc: 'Reflects 14 damage to melee attackers.' },
  { slot: 'helm', name: 'Crown of the Archmage', base: 8, affixes: { eng: 12, mp: 30 }, effect: 'allskills', effVal: 1, desc: '+1 to all skill ranks.' },
  { slot: 'boots', name: 'Windstep Greaves', base: 8, affixes: { dex: 10 }, effect: 'movespeed', effVal: 0.25, desc: '+25% movement speed.' },
  { slot: 'amulet', name: 'Reaper\u2019s Eye', base: 0, affixes: { crit: 10, dmg: 8 }, effect: 'critdmg', effVal: 1, desc: 'Critical hits deal 3x damage (not 2x).' },
  { slot: 'ring', name: 'Band of Leeching', base: 0, affixes: { hp: 20, dmg: 4 }, effect: 'lifesteal', effVal: 0.06, desc: 'Heals 6% of damage dealt.' },
  { slot: 'gloves', name: 'Gauntlets of Wrath', base: 8, affixes: { dmg: 10, str: 8 }, effect: 'lifesteal', effVal: 0.05, desc: 'Heals 5% of damage dealt.' },
  { slot: 'helm', name: 'Visage of Spite', base: 9, affixes: { vit: 8, armor: 8 }, effect: 'thorns', effVal: 18, desc: 'Reflects 18 damage to melee attackers.' },
  { slot: 'weapon', name: 'Stormcaller', base: 13, affixes: { dmg: 10, ias: 8 }, effect: 'haste', effVal: 0.15, desc: '+15% attack speed.' },
  { slot: 'weapon', name: 'Worldcleaver', base: 16, affixes: { dmg: 14, str: 8 }, effect: 'pierce', effVal: 2, desc: 'Attacks pierce 2 additional enemies.' },
  { slot: 'ring', name: 'Cinder Coil', base: 0, affixes: { dmg: 6, crit: 6 }, effect: 'deathnova', effVal: 0.5, desc: 'Slain foes erupt for 50% of your damage to nearby enemies.' },
  { slot: 'amulet', name: 'Heart of the Mountain', base: 0, affixes: { vit: 14, allRes: 10 }, effect: 'thorns', effVal: 16, desc: 'Reflects 16 damage to melee attackers.' },
  { slot: 'boots', name: 'Phantom Striders', base: 7, affixes: { dex: 8, ms: 10 }, effect: 'movespeed', effVal: 0.2, desc: '+20% movement speed.' },
  { slot: 'gloves', name: 'Graspers of Greed', base: 7, affixes: { dmg: 8, leechAll: 2 }, effect: 'lifesteal', effVal: 0.06, desc: 'Heals 6% of damage dealt.' },
  { slot: 'helm', name: 'Diadem of Ruin', base: 9, affixes: { eng: 10, critDmg: 30 }, effect: 'critdmg', effVal: 1, desc: 'Critical hits deal 3x damage (not 2x).' },
  { slot: 'armor', name: 'Aegis Eternal', base: 16, affixes: { armor: 20, allRes: 12, vit: 12 }, effect: 'thorns', effVal: 12, desc: 'Reflects 12 damage to melee attackers.' },
  { slot: 'weapon', name: 'Voidpiercer', base: 15, affixes: { dmg: 12, crit: 6 }, effect: 'pierce', effVal: 2, desc: 'Attacks pierce 2 additional enemies.' },
  { slot: 'gloves', name: 'Tempest Grips', base: 8, affixes: { ias: 10, dex: 8 }, effect: 'haste', effVal: 0.12, desc: '+12% attack speed.' },
  { slot: 'boots', name: 'Stormchaser Boots', base: 7, affixes: { ms: 12, dex: 6 }, effect: 'movespeed', effVal: 0.22, desc: '+22% movement speed.' },
  { slot: 'amulet', name: 'Aegis Pendant', base: 0, affixes: { vit: 12, allRes: 8 }, effect: 'manaShield', effVal: 0.25, desc: 'Absorbs 25% of incoming damage with mana.' },
  { slot: 'ring', name: 'Sanguine Loop', base: 0, affixes: { hp: 24, dmg: 5 }, effect: 'lifesteal', effVal: 0.07, desc: 'Heals 7% of damage dealt.' },
];
const SET_DEFS = {
  warden: { name: "Warden's Vigil", pieces: ['helm', 'armor', 'gloves', 'boots'], bonuses: { 2: { vit: 15, armor: 12 }, 3: { str: 12, hp: 40 }, 4: { vit: 30, armor: 30, effect: 'thorns', effVal: 12 } } },
  conjurer: { name: "Conjurer's Regalia", pieces: ['helm', 'armor', 'amulet', 'ring'], bonuses: { 2: { eng: 18, mp: 30 }, 3: { eng: 30 }, 4: { mp: 60, effect: 'allskills', effVal: 1 } } },
  shadow: { name: 'Shadowdancer', pieces: ['weapon', 'gloves', 'boots', 'ring'], bonuses: { 2: { dex: 15, crit: 6 }, 3: { dmg: 14 }, 4: { crit: 12, effect: 'critdmg', effVal: 1 } } },
  emberwalker: { name: 'Emberwalker', pieces: ['weapon', 'helm', 'gloves', 'boots'], bonuses: { 2: { ias: 8, crit: 5 }, 3: { dmg: 16 }, 4: { burnOnHit: 25, effect: 'haste', effVal: 0.12 } } },
  stoneguard: { name: 'Stoneguard', pieces: ['helm', 'armor', 'boots', 'amulet'], bonuses: { 2: { armor: 18, vit: 12 }, 3: { hp: 60 }, 4: { allRes: 15, effect: 'manaShield', effVal: 0.2 } } },
};
/* ---------- gems + sockets (slot-dependent: a gem's effect depends on where it's socketed) ----------
   A socketed gem grants one EXISTING affix key, so it folds into recompute's bonus map for free.
   Storage: item.sockets = [null | {t,q}] (optional/additive); character.gems = { 'ruby:0': count } pouch. */
const GEMS = {
  ruby: { name: 'Ruby', ico: '🔺', weapon: { key: 'fireDmg', vals: [5, 9, 14, 20, 28] }, gear: { key: 'hp', vals: [15, 28, 45, 68, 100] }, jewelry: { key: 'str', vals: [3, 6, 9, 13, 18] } },
  sapphire: { name: 'Sapphire', ico: '🔷', weapon: { key: 'coldDmg', vals: [5, 9, 14, 20, 28] }, gear: { key: 'mp', vals: [10, 20, 32, 48, 70] }, jewelry: { key: 'allRes', vals: [3, 6, 9, 13, 18] } },
  topaz: { name: 'Topaz', ico: '🟡', weapon: { key: 'lightDmg', vals: [5, 9, 14, 20, 28] }, gear: { key: 'lightRes', vals: [5, 9, 14, 20, 28] }, jewelry: { key: 'eng', vals: [3, 6, 9, 13, 18] } },
  emerald: { name: 'Emerald', ico: '🟢', weapon: { key: 'poisonDmg', vals: [5, 9, 14, 20, 28] }, gear: { key: 'dex', vals: [3, 6, 9, 13, 18] }, jewelry: { key: 'poisonRes', vals: [5, 9, 14, 20, 28] } },
  amethyst: { name: 'Amethyst', ico: '🟣', weapon: { key: 'dmg', vals: [3, 6, 10, 15, 22] }, gear: { key: 'armor', vals: [8, 16, 26, 40, 58] }, jewelry: { key: 'vit', vals: [3, 6, 9, 13, 18] } },
  diamond: { name: 'Diamond', ico: '⬜', weapon: { key: 'critDmg', vals: [6, 11, 17, 25, 35] }, gear: { key: 'allRes', vals: [3, 6, 9, 13, 18] }, jewelry: { key: 'crit', vals: [2, 3, 4, 5, 7] } },
  onyx: { name: 'Onyx', ico: '⬛', weapon: { key: 'crit', vals: [2, 3, 4, 5, 7] }, gear: { key: 'thorns', vals: [4, 8, 13, 20, 30] }, jewelry: { key: 'critDmg', vals: [6, 11, 17, 25, 35] } },
};
const GEM_KEYS = Object.keys(GEMS);
const GEM_TIER = ['Chipped', 'Flawed', '', 'Flawless', 'Perfect']; // q index 0..4; '' = plain name
const gemCat = s => s === 'weapon' ? 'weapon' : (s === 'ring' || s === 'amulet') ? 'jewelry' : 'gear';
const gemName = g => (GEM_TIER[g.q] ? GEM_TIER[g.q] + ' ' : '') + (GEMS[g.t] ? GEMS[g.t].name : g.t);
const gemEff = (slot, g) => GEMS[g.t] && GEMS[g.t][gemCat(slot)]; // {key,vals} this gem grants in this slot
const SOCKET_MAX = { weapon: 3, armor: 3, helm: 2, gloves: 2, boots: 2, ring: 1, amulet: 1 };
function rollSockets(slot, rarity) {
  const max = SOCKET_MAX[slot] || 0; if (!max) return [];
  const p = ({ common: 0.10, magic: 0.22, rare: 0.38, set: 0.30, unique: 0.30 })[rarity] || 0;
  let n = 0; for (let i = 0; i < max; i++) { if (Math.random() < p) n++; else break; } // streak roll → most items 0-1
  return Array(n).fill(null);
}
// Pure helper (lives above the THREE marker → sandbox-testable). Folds socketed gems into a bonus map; the
// item's slot decides each gem's effect. Gems are flat — callers must NOT multiply by upFactor.
function gemFold(it, bonus) { if (!it.sockets) return; for (const g of it.sockets) { if (!g) continue; const e = gemEff(it.slot, g); if (e) bonus[e.key] = (bonus[e.key] || 0) + e.vals[g.q]; } }
let _itemId = 1;
function rollRarity() { const r = Math.random(); if (r < 0.40) return 'common'; if (r < 0.73) return 'magic'; if (r < 0.92) return 'rare'; if (r < 0.98) return 'set'; return 'unique'; }
let lootLuck = 0; const RARITY_LADDER = ['common', 'magic', 'rare', 'set', 'unique'];
function bumpRarity(r, n) { let i = RARITY_LADDER.indexOf(r); i = Math.min(RARITY_LADDER.length - 1, i + n); return RARITY_LADDER[i]; }
function depthQuality() { const d = (typeof depth === 'number' ? depth : 0); return (typeof zone !== 'undefined' && zone === 'dungeon') ? Math.min(0.4, d * 0.02) : 0; }
function luckyRarity(bonus) { let r = rollRarity(); const p = Math.min(0.8, (lootLuck || 0) + (bonus || 0)); if (p > 0) { if (Math.random() < p) r = bumpRarity(r, 1); if (Math.random() < p * 0.35) r = bumpRarity(r, 1); } return r; }
function buildUnique(def, ilvl) { const a = {}; for (const k in def.affixes) a[k] = def.affixes[k]; return { id: _itemId++, slot: def.slot, rarity: 'unique', ilvl, base: def.name, baseStat: def.base ? Math.round(def.base + ilvl * 0.8) : 0, affixes: a, effect: def.effect, effVal: def.effVal, effectDesc: def.desc, upgrade: 0, sockets: rollSockets(def.slot, 'unique'), name: '\u2726 ' + def.name }; }
function buildSetItem(sid, slot, ilvl) {
  const sd = SET_DEFS[sid]; const base = (slot === 'weapon') ? pickWeaponBase() : choice(BASE_NAMES[slot]);
  const item = { id: _itemId++, slot, rarity: 'set', ilvl, base, affixes: {}, baseStat: baseStatRoll(slot, ilvl, 'set'), set: sid, upgrade: 0, sockets: rollSockets(slot, 'set'), name: sd.name + ' ' + base };
  const pool = [...AFFIX_KEYS]; const [lo, hi] = RARITY_AFFIX.set; const cnt = randi(lo, hi); for (let i = 0; i < cnt; i++) { const k = pool.splice(randi(0, pool.length - 1), 1)[0]; item.affixes[k] = affixRoll(k, ilvl, 'set'); } return item;
}
function rollItem(ilvl, forceSlot, quality) {
  const slot = forceSlot || choice(SLOTS); let rarity = luckyRarity(depthQuality() + (quality || 0));
  if (rarity === 'unique') { const opts = UNIQUE_DEFS.filter(u => u.slot === slot); if (opts.length) return buildUnique(choice(opts), ilvl); rarity = 'rare'; }
  if (rarity === 'set') { const setOpts = []; for (const sid in SET_DEFS) { if (SET_DEFS[sid].pieces.includes(slot)) setOpts.push(sid); } if (setOpts.length) return buildSetItem(choice(setOpts), slot, ilvl); rarity = 'rare'; }
  const base = (slot === 'weapon') ? pickWeaponBase() : choice(BASE_NAMES[slot]);
  const item = { id: _itemId++, slot, rarity, ilvl, base, affixes: {}, baseStat: baseStatRoll(slot, ilvl, rarity), upgrade: 0, sockets: rollSockets(slot, rarity) };
  const [lo, hi] = RARITY_AFFIX[rarity]; const count = randi(lo, hi); const pool = [...AFFIX_KEYS];
  for (let i = 0; i < count; i++) { if (!pool.length) break; const k = pool.splice(randi(0, pool.length - 1), 1)[0]; item.affixes[k] = affixRoll(k, ilvl, rarity); }
  let name = base;
  if (rarity === 'magic') { name = (Math.random() < .5 ? choice(PREFIX) + ' ' : '') + base; if (name === base) name = base + ' ' + choice(SUFFIX); }
  else if (rarity === 'rare') { name = choice(PREFIX) + ' ' + base + ' ' + choice(SUFFIX); }
  item.name = name; return item;
}
const UPGRADE_CAP = { common: 5, magic: 6, rare: 8, set: 8, unique: 10 };
/* The item helpers below are annotated with JSDoc as worked examples of the zero-build type-checking
   set up in jsconfig.json — the `Item` shape lives in types/game.d.ts. See types/README.md. */
/** @param {{upgrade?:number}|null} it @returns {number} */
const upFactor = it => 1 + ((it && it.upgrade) || 0) * 0.08;
/** @param {Item} it @returns {number} */
const upgradeMax = it => UPGRADE_CAP[it.rarity] || 5;
/** @param {*} it @returns {number} */
function itemScore(it) { if (!it) return 0; let s = it.baseStat * (it.slot === 'weapon' ? 3 : 2); const W = { dmg: 3, hp: 1, crit: 5, ias: 4, ms: 3, leech: 6, allstats: 5, thorns: 1, fireRes: 2, coldRes: 2, poisonRes: 2, lightRes: 2, allRes: 4, critDmg: 5, manaLeech: 4, leechAll: 7, burnOnHit: 5, bleedOnHit: 5, skilldmg: 6, activeskill: 6, skillranks: 25, fireDmg: 5, coldDmg: 5, lightDmg: 5, poisonDmg: 5, hpregen: 4, mpregen: 3, mf: 3, gf: 2, dodge: 5, flatDR: 6, cdr: 6, lifeOnHit: 4 }; for (const k in it.affixes) s += it.affixes[k] * (W[k] || 2); if (it.sockets) for (const g of it.sockets) { if (g) { const e = gemEff(it.slot, g); if (e) s += e.vals[g.q] * (W[e.key] || 2); } else s += 3; } if (it.effect) s += 40; if (it.set) s += 15; return Math.round(s * upFactor(it)); }
const upgradeCost = it => Math.round(itemScore(it) * (1 + ((it.upgrade) || 0)) * 0.5) + 15;
const enchantAffixes = it => Object.keys(it.affixes || {}).filter(k => AFFIXES[k]);
const enchantCost = it => Math.round(itemScore(it) * 0.35) + 25;
/* ---- Crafting: salvage → Dust, and Reforge (reroll an item's rolled affixes, small chance to bump rarity) ----
   Reforge only touches common/magic/rare gear: set/unique affixes are hand-tuned identity, not rerollable. */
const DUST_VALUE = { common: 1, magic: 3, rare: 8, set: 15, unique: 25 };
const dustValue = it => DUST_VALUE[it.rarity] || 1;
const REFORGE_RARITY_UP = 0.15; /* chance a reforge promotes one tier first (common→magic→rare, capped at rare = more affix slots) */
const reforgeable = it => !!it && (it.rarity === 'common' || it.rarity === 'magic' || it.rarity === 'rare');
const reforgeCost = it => ({ dust: 4 + (RTIER[it.rarity] || 1) * 4, gold: Math.round(itemScore(it) * 0.15) + 15 });
function reforgeName(it) { const base = it.base || it.name; if (it.rarity === 'rare') return choice(PREFIX) + ' ' + base + ' ' + choice(SUFFIX); if (it.rarity === 'magic') { let n = (Math.random() < 0.5 ? choice(PREFIX) + ' ' : '') + base; if (n === base) n = base + ' ' + choice(SUFFIX); return n; } return base; }
/** Reroll it.affixes in place (fresh random set per the item's rarity), with REFORGE_RARITY_UP chance to bump one
 *  tier first. Preserves id/slot/ilvl/base/upgrade/enchant; rerolls baseStat to match (possibly new) rarity. */
function reforgeItem(it) {
  if (it.rarity !== 'rare' && Math.random() < REFORGE_RARITY_UP) it.rarity = bumpRarity(it.rarity, 1);
  it.baseStat = baseStatRoll(it.slot, it.ilvl, it.rarity);
  it.affixes = {};
  const [lo, hi] = RARITY_AFFIX[it.rarity]; const cnt = randi(lo, hi); const pool = [...AFFIX_KEYS];
  for (let i = 0; i < cnt; i++) { if (!pool.length) break; const k = pool.splice(randi(0, pool.length - 1), 1)[0]; it.affixes[k] = affixRoll(k, it.ilvl, it.rarity); }
  it.name = reforgeName(it);
  return it;
}
/** @param {Item} it @returns {number} */
function sellValue(it) { return Math.max(2, Math.round(itemScore(it) * 0.5)); }
/** @param {Item} it @returns {number} */
function buyPrice(it) { return Math.round(sellValue(it) * 3) + 8; }
/** @param {LootFilter|null} lf @param {Item} it @returns {boolean} */
function lootPasses(lf, it) { if (!lf) return true; if (lf.rarity && lf.rarity[it.rarity] === false) return false; if (lf.slot && lf.slot[it.slot] === false) return false; if ((it.ilvl || 0) < (lf.minIlvl || 0) && it.rarity !== 'set' && it.rarity !== 'unique') return false; return true; }
const POTION_PRICE = 25, MANA_POTION_PRICE = 20;
