/* Phase 0 perf rig: in ?perftest=1 mode, seed Math.random (mulberry32) so spawnWave/pickBiome/biome rolls
   are reproducible across cold runs — kills the ±~1s spawn/leveling noise the old PERF-FINDINGS doc flagged.
   Must run before any Math.random() call. ?seed=N overrides the default seed. No effect in normal play. */
(() => {
  if (typeof location === 'undefined' || !/[?&]perftest=1\b/.test(location.search)) return;
  let s = (parseInt((location.search.match(/[?&]seed=(\d+)/) || [])[1], 10) || 12345) >>> 0;
  Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
})();
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => performance.now();
const choice = a => a[Math.floor(Math.random() * a.length)];

/* ================= AUDIO ================= */
const Audio2 = {
  ctx: null, master: null, muted: false,
  init() { if (this.ctx) return; try { const AC = window.AudioContext || window.webkitAudioContext; this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination); } catch (e) { } },
  beep(freq, dur, type, vol, slideTo) { if (!this.ctx || this.muted) return; const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type || 'sine'; o.frequency.value = freq; if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), this.ctx.currentTime + dur); g.gain.value = vol || 0.18; g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur); o.connect(g); g.connect(this.master); o.start(); o.stop(this.ctx.currentTime + dur); },
  noise(dur, vol) { if (!this.ctx || this.muted) return; const n = this.ctx.createBufferSource(); const buf = this.ctx.createBuffer(1, Math.max(1, this.ctx.sampleRate * dur), this.ctx.sampleRate); const data = buf.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2); n.buffer = buf; const g = this.ctx.createGain(); g.gain.value = vol || 0.18; n.connect(g); g.connect(this.master); n.start(); }
};
function sfx(t) {
  const A = Audio2; if (!A.ctx || A.muted || !SAVE._data.settings.sfx) return;
  if (t === 'melee') { A.noise(0.08, 0.14); A.beep(180, 0.08, 'square', 0.1, 90); }
  else if (t === 'fire') { A.beep(620, 0.25, 'sawtooth', 0.15, 160); }
  else if (t === 'frost') { A.beep(900, 0.25, 'triangle', 0.13, 420); }
  else if (t === 'nova') { A.beep(300, 0.3, 'square', 0.15, 120); }
  else if (t === 'chain') { A.beep(1300, 0.18, 'sawtooth', 0.15, 300); }
  else if (t === 'hurt') { A.beep(200, 0.18, 'square', 0.2, 70); A.noise(0.1, 0.12); }
  else if (t === 'gold') { A.beep(1200, 0.08, 'sine', 0.1, 1600); }
  else if (t === 'potion') { A.beep(500, 0.18, 'sine', 0.13, 820); }
  else if (t === 'death') { A.beep(160, 0.14, 'sawtooth', 0.1, 60); }
  else if (t === 'level') { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => A.beep(f, 0.18, 'triangle', 0.18), i * 90)); }
  else if (t === 'boss') { A.beep(90, 0.7, 'sawtooth', 0.25, 60); A.noise(0.5, 0.18); }
  else if (t === 'bossdie') { [400, 300, 200, 120].forEach((f, i) => setTimeout(() => { A.beep(f, 0.3, 'sawtooth', 0.2, f * 0.6); A.noise(0.2, 0.15); }, i * 120)); }
  else if (t === 'die') { [300, 240, 180, 120, 80].forEach((f, i) => setTimeout(() => A.beep(f, 0.3, 'sawtooth', 0.2), i * 150)); }
}
const MUSIC = {
  scale: [220, 261.63, 293.66, 329.63, 392, 440], timer: null,
  start() { if (this.timer || Audio2.muted || !Audio2.ctx || !SAVE._data.settings.music) return; this.timer = setInterval(() => { if (Audio2.muted || !Audio2.ctx) return; const f = choice(this.scale) * (Math.random() < 0.3 ? 0.5 : 1); const o = Audio2.ctx.createOscillator(), g = Audio2.ctx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.value = 0; g.gain.linearRampToValueAtTime(0.045, Audio2.ctx.currentTime + 0.6); g.gain.linearRampToValueAtTime(0.001, Audio2.ctx.currentTime + 2.6); o.connect(g); g.connect(Audio2.master); o.start(); o.stop(Audio2.ctx.currentTime + 2.7); }, 1900); },
  stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
};
const DIFF = { Normal: { hp: 1, dmg: 1, xp: 1 }, Hard: { hp: 1.6, dmg: 1.4, xp: 1.3 }, Hell: { hp: 2.6, dmg: 2, xp: 1.8 }, Inferno: { hp: 4, dmg: 3, xp: 2.5 } };
const DIFF_ORDER = ['Normal', 'Hard', 'Hell', 'Inferno'];
// endgame depth scaling (data-driven; early floors stay ~linear, late floors ramp up via the quadratic terms)
const DSCALE = { hpLin: 0.4, hpQuad: 0.05, dmgLin: 0.28, dmgQuad: 0.04, xpLin: 0.5, xpQuad: 0.04, ilvlPerDepth: 2 };
const BOSS_SCALE = { hpBase: 380, hpLin: 0.5, hpQuad: 0.05, dmgBase: 14, dmgLin: 0.3, dmgQuad: 0.03, xpBase: 300, xpLin: 0.6 };
let shake = 0;

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

/* ================= SKILLS ================= */
const SKILLDEFS = {
  strike: { name: 'Strike', ico: '⚔', type: 'active', kind: 'melee', cost: 0, cd: 0, maxRank: 1, req: 1, granted: true, desc: 'Basic melee attack.' },
  fireball: { name: 'Fireball', ico: '🔥', type: 'active', kind: 'fire', elem: 'fire', onHit: 'burn', cost: 8, cd: 600, maxRank: 5, req: 1, granted: true, desc: 'Hurls a bolt of fire. Rank boosts damage.' },
  frost: { name: 'Frost', ico: '❄', type: 'active', kind: 'frost', elem: 'cold', onHit: 'chill', cost: 12, cd: 1100, maxRank: 5, req: 1, granted: true, desc: 'Cold bolt that slows. Rank boosts damage & slow.' },
  nova: { name: 'Nova', ico: '✦', type: 'active', kind: 'nova', elem: 'fire', onHit: 'burn', cost: 20, cd: 2600, maxRank: 5, req: 1, granted: true, desc: 'Ring of fire bolts. Rank adds bolts.' },
  chain: { name: 'Chain Lightning', ico: '⚡', type: 'active', kind: 'chain', cost: 18, cd: 1400, maxRank: 5, req: 8, granted: false, desc: 'Bolt that leaps between foes. Rank adds jumps.' },
  toughness: { name: 'Toughness', ico: '🪨', type: 'passive', maxRank: 5, req: 2, granted: false, desc: '+8% Life per rank.' },
  precision: { name: 'Precision', ico: '🎯', type: 'passive', maxRank: 5, req: 4, granted: false, desc: '+2% Crit Chance per rank.' },
  meditation: { name: 'Meditation', ico: '🌀', type: 'passive', maxRank: 5, req: 6, granted: false, desc: '+40% Mana regen per rank.' },
  cleave: { name: 'Cleave', ico: '🪓', type: 'active', kind: 'cleave', cost: 6, cd: 500, maxRank: 1, req: 1, granted: false, desc: 'Sweeping melee hit to all foes in front.' },
  multishot: { name: 'Multishot', ico: '🏹', type: 'active', kind: 'multishot', elem: 'poison', onHit: 'poison', cost: 6, cd: 450, maxRank: 1, req: 1, granted: false, desc: 'Throws three venom-tipped daggers in a spread.' },
  whirlwind: { name: 'Whirlwind', ico: '🌀', type: 'active', kind: 'whirl', cost: 14, cd: 900, maxRank: 5, req: 5, granted: false, desc: 'Spin, striking all nearby foes. Rank boosts damage.' },
  volley: { name: 'Volley', ico: '🎯', type: 'active', kind: 'volley', elem: 'phys', onHit: 'bleed', cost: 10, cd: 700, maxRank: 5, req: 5, granted: false, desc: 'A fan of five daggers that make foes bleed. Rank boosts damage.' },
  berserk: { name: 'Berserk', ico: '💢', type: 'passive', maxRank: 5, req: 3, granted: false, desc: '+6% melee damage per rank.' },
  arcanemind: { name: 'Arcane Mind', ico: '🔮', type: 'passive', maxRank: 5, req: 3, granted: false, desc: '+6% spell damage per rank.' },
  swiftness: { name: 'Swiftness', ico: '💨', type: 'passive', maxRank: 5, req: 3, granted: false, desc: '+4% move speed per rank.' },
  leap: { name: 'Leap', ico: '🦿', type: 'active', kind: 'leap', cost: 12, cd: 1200, maxRank: 5, req: 7, granted: false, desc: 'Leap to the cursor, slamming foes on landing.' },
  meteor: { name: 'Meteor', ico: '☄️', type: 'active', kind: 'meteor', elem: 'fire', onHit: 'burn', cost: 24, cd: 2400, maxRank: 5, req: 10, granted: false, desc: 'Calls a meteor at the cursor — heavy fire AoE.' },
  blink: { name: 'Blink', ico: '✨', type: 'active', kind: 'blink', cost: 8, cd: 1000, maxRank: 1, req: 7, granted: false, desc: 'Teleport a short distance toward the cursor.' },
  frostnova: { name: 'Frost Nova', ico: '🌨️', type: 'active', kind: 'frostnova', elem: 'cold', onHit: 'chill', cost: 16, cd: 1500, maxRank: 5, req: 3, granted: false, desc: 'Freezing burst: damages and slows nearby foes.' },
  ironskin: { name: 'Iron Skin', ico: '🧱', type: 'passive', maxRank: 5, req: 5, granted: false, desc: '+10% armor per rank.' },
  bloodlust: { name: 'Bloodlust', ico: '🩸', type: 'passive', maxRank: 5, req: 9, granted: false, desc: '+2% life leech per rank.' },
  piercing: { name: 'Piercing Shot', ico: '➹', type: 'passive', maxRank: 3, req: 5, granted: false, desc: 'Daggers pierce +1 enemy per rank.' },
  deadlyaim: { name: 'Deadly Aim', ico: '👁️', type: 'passive', maxRank: 5, req: 9, granted: false, desc: '+2% crit chance per rank.' },
  // ---- expanded actives (auto-granted by class level) ----
  groundslam: { name: 'Ground Slam', ico: '🪨', type: 'active', kind: 'groundslam', cost: 14, cd: 1400, maxRank: 5, req: 1, granted: false, desc: 'Smash a cone of ground — damages, knocks back and slows. Rank boosts damage.' },
  charge: { name: 'Charge', ico: '🐗', type: 'active', kind: 'charge', cost: 12, cd: 1600, maxRank: 5, req: 1, granted: false, desc: 'Rush toward the cursor, damaging and slowing foes you crash into.' },
  warcry: { name: 'War Cry', ico: '📢', type: 'active', kind: 'warcry', cost: 16, cd: 9000, maxRank: 5, req: 1, granted: false, desc: 'Roar for 8s: more melee damage and less damage taken. Rank boosts the bonus.' },
  arcaneorb: { name: 'Arcane Orb', ico: '🔮', type: 'active', kind: 'arcaneorb', cost: 16, cd: 900, maxRank: 5, req: 1, granted: false, desc: 'A slow, heavy orb that pierces foes. Rank boosts damage.' },
  blizzard: { name: 'Blizzard', ico: '🌨️', type: 'active', kind: 'blizzard', elem: 'cold', onHit: 'chill', cost: 26, cd: 3000, maxRank: 5, req: 1, granted: false, desc: 'Call a storm of ice at the cursor over several seconds. Rank boosts damage.' },
  teleportstorm: { name: 'Teleport Storm', ico: '🌀', type: 'active', kind: 'teleportstorm', cost: 18, cd: 1600, maxRank: 5, req: 1, granted: false, desc: 'Blink to the cursor, blasting foes at both ends.' },
  shadowstep: { name: 'Shadow Step', ico: '🗡️', type: 'active', kind: 'shadowstep', cost: 12, cd: 1100, maxRank: 5, req: 1, granted: false, desc: 'Blink to the nearest foe and strike for a guaranteed crit. Rank boosts damage.' },
  fanofknives: { name: 'Fan of Knives', ico: '🔪', type: 'active', kind: 'fanofknives', elem: 'phys', onHit: 'bleed', cost: 16, cd: 1200, maxRank: 5, req: 1, granted: false, desc: 'Hurl daggers in every direction, making foes bleed. Rank boosts damage.' },
  secondwind: { name: 'Second Wind', ico: '💗', type: 'active', kind: 'secondwind', cost: 0, cd: 6000, maxRank: 5, req: 1, granted: false, desc: 'Spend all mana to heal for a share of it. Rank boosts the conversion.' },
};
const ACTIVE_ORDER = ['strike', 'cleave', 'whirlwind', 'leap', 'groundslam', 'charge', 'warcry', 'multishot', 'volley', 'fanofknives', 'shadowstep', 'blink', 'teleportstorm', 'fireball', 'frost', 'frostnova', 'nova', 'chain', 'meteor', 'arcaneorb', 'blizzard', 'secondwind'];
const CLASSES = {
  warrior: { name: 'Warrior', col: 0x9a3020, base: { str: 18, dex: 10, vit: 16, eng: 6 }, grow: { hp: 24, mp: 5, dmg: 4 }, dmgMult: 1.15, granted: ['cleave'], blurb: 'Brawler — high life, strong melee, Cleave.' },
  mage: { name: 'Mage', col: 0x2a3aaa, base: { str: 8, dex: 10, vit: 10, eng: 20 }, grow: { hp: 14, mp: 12, dmg: 2 }, spellMult: 1.3, granted: ['fireball', 'frost'], blurb: 'Glass cannon — spells hit hard, low life.' },
  rogue: { name: 'Rogue', col: 0x2a7a3a, base: { str: 12, dex: 20, vit: 11, eng: 9 }, grow: { hp: 18, mp: 7, dmg: 3 }, critBonus: 0.08, granted: ['multishot'], blurb: 'Swift — crit & speed, throws daggers.' },
};
function classBaseRank(id) { const c = CLASSES[(character && character.class) || 'warrior'] || CLASSES.warrior; return (id === 'strike' || c.granted.includes(id)) ? 1 : 0; }
const TREE_TIERS = [{ req: 1, nodes: ['fireball', 'frost'] }, { req: 2, nodes: ['toughness'] }, { req: 4, nodes: ['precision'] }, { req: 5, nodes: ['nova'] }, { req: 6, nodes: ['meditation'] }, { req: 8, nodes: ['chain'] }];
const CLASS_TREES = {
  warrior: [{ req: 1, nodes: ['cleave'] }, { req: 3, nodes: ['toughness', 'berserk'] }, { req: 5, nodes: ['whirlwind', 'ironskin'] }, { req: 7, nodes: ['leap'] }, { req: 9, nodes: ['bloodlust', 'precision'] }],
  mage: [{ req: 1, nodes: ['fireball', 'frost'] }, { req: 3, nodes: ['arcanemind', 'frostnova'] }, { req: 4, nodes: ['precision'] }, { req: 5, nodes: ['nova', 'blink'] }, { req: 6, nodes: ['meditation'] }, { req: 8, nodes: ['chain'] }, { req: 10, nodes: ['meteor'] }],
  rogue: [{ req: 1, nodes: ['multishot'] }, { req: 3, nodes: ['swiftness', 'precision'] }, { req: 5, nodes: ['volley', 'piercing'] }, { req: 7, nodes: ['blink'] }, { req: 9, nodes: ['deadlyaim', 'toughness'] }],
};
// active skills unlock automatically by level per class; the forest below holds passive power
const CLASS_ACTIVES = {
  warrior: { strike: 1, cleave: 1, groundslam: 3, charge: 5, whirlwind: 6, warcry: 9, leap: 10, secondwind: 12 },
  mage: { strike: 1, fireball: 1, frost: 2, frostnova: 4, arcaneorb: 4, nova: 6, blink: 8, chain: 10, blizzard: 13, meteor: 14 },
  rogue: { strike: 1, multishot: 1, shadowstep: 5, volley: 6, fanofknives: 7, blink: 8, teleportstorm: 9, secondwind: 12 },
};
// Auto-grant only the level-1 starting kit. Higher abilities are unlocked by spending an ability point (see unlockAbility).
function syncActives() { const m = CLASS_ACTIVES[character.class] || CLASS_ACTIVES.warrior; for (const id in m) { if (m[id] <= 1 && (character.skills[id] || 0) < 1) character.skills[id] = 1; } }
// Class abilities, ordered by their unlock level (drives the Abilities-tab list).
function classAbilities() { const m = CLASS_ACTIVES[(character && character.class) || 'warrior'] || CLASS_ACTIVES.warrior; return Object.keys(m).filter(id => id !== 'strike').sort((a, b) => m[a] - m[b]); }
// ---- the passive "forest": a connected web of nodes you path through ----
const PTREE = (() => {
  const nodes = {}, adj = {};
  const N = (id, x, y, type, mods, label) => { nodes[id] = { id, x, y, type: type || 'minor', mods: mods || {}, label: label || '' }; adj[id] = adj[id] || []; };
  const L = (a, b) => { (adj[a] = adj[a] || []); (adj[b] = adj[b] || []); if (!adj[a].includes(b)) adj[a].push(b); if (!adj[b].includes(a)) adj[b].push(a); };
  N('hub', 0, 0, 'minor', {}, 'Crossroads');
  const sec = {
    str: { ang: Math.PI * 0.78, minors: [{ str: 4 }, { vit: 6 }, { dmg: 2 }, { armor: 6 }], notable: { str: 14, hpPct: 8, meleePct: 8 }, nl: 'Battle Hardened', key: { armorPct: 25, hpPct: 15 }, kl: 'Juggernaut' },
    dex: { ang: Math.PI * 0.22, minors: [{ dex: 4 }, { crit: 2 }, { dmg: 2 }, { vit: 4 }], notable: { dex: 14, crit: 6 }, nl: 'Precision', key: { crit: 14, pierce: 1 }, kl: 'Deadeye' },
    int: { ang: -Math.PI * 0.5, minors: [{ eng: 4 }, { mp: 12 }, { spellPct: 4 }, { crit: 1 }], notable: { eng: 14, spellPct: 12, mp: 20 }, nl: 'Spell Weaver', key: { allskills: 1, spellPct: 20 }, kl: 'Archmage' },
  };
  const starts = { warrior: 'start_str', mage: 'start_int', rogue: 'start_dex' };
  for (const k in sec) {
    const s = sec[k], ga = s.ang;
    N('gw_' + k, Math.cos(ga) * 70, Math.sin(ga) * 70, 'minor', s.minors[0], ''); L('hub', 'gw_' + k);
    N(starts[Object.keys(starts).find(c => starts[c] === 'start_' + k)] || 'start_' + k, Math.cos(ga) * 34, Math.sin(ga) * 34, 'start', {}, 'Start'); L('start_' + k, 'gw_' + k);
    const rings = [140, 210, 285, 360]; let prev = 'gw_' + k;
    rings.forEach((R, i) => {
      const ax = 'ax_' + k + '_' + i, x = Math.cos(ga) * R, y = Math.sin(ga) * R; let type = 'minor', mods = s.minors[(i + 1) % 4], label = '';
      if (i === 2) { type = 'notable'; mods = s.notable; label = s.nl; } if (i === 3) { type = 'keystone'; mods = s.key; label = s.kl; }
      N(ax, x, y, type, mods, label); L(prev, ax); prev = ax;
      if (i < 3) { for (const sg of [-1, 1]) { const a2 = ga + sg * 0.32, sx = Math.cos(a2) * R, sy = Math.sin(a2) * R, sid = 'sd_' + k + '_' + i + '_' + (sg > 0 ? 'p' : 'n'); N(sid, sx, sy, 'minor', s.minors[(i + (sg > 0 ? 2 : 3)) % 4], ''); L(ax, sid); } }
    });
    for (const sg of [-1, 1]) { let p2 = 'gw_' + k; for (let j = 0; j < 3; j++) { const ba = ga + sg * 0.66, R2 = 130 + j * 72, x = Math.cos(ba) * R2, y = Math.sin(ba) * R2, id = 'br_' + k + '_' + (sg > 0 ? 'p' : 'n') + '_' + j; N(id, x, y, 'minor', j === 1 ? { vit: 6 } : s.minors[j % 4], ''); L(p2, id); p2 = id; } }
  }
  L('gw_str', 'gw_int'); L('gw_int', 'gw_dex'); L('gw_dex', 'gw_str');
  // ---- outer ring of powerful keystones + inter-sector clusters ----
  const A = { str: Math.PI * 0.78, dex: Math.PI * 0.22, int: -Math.PI * 0.5 };
  const AK = (id, ang, R, type, mods, label) => { nodes[id] = { id, x: Math.cos(ang) * R, y: Math.sin(ang) * R, type, mods, label }; adj[id] = adj[id] || []; };
  AK('ks_titan', A.str + 0.24, 440, 'keystone', { hpPct: 35, armorPct: 25, movespeed: -0.12 }, 'Titan'); L('ax_str_3', 'ks_titan');
  AK('ks_blood', A.str - 0.24, 440, 'keystone', { lifesteal: 0.15, meleePct: 12 }, 'Bloodthirst'); L('ax_str_3', 'ks_blood');
  AK('ks_exec', A.dex + 0.24, 440, 'keystone', { crit: 12, critdmg: true, pierce: 1 }, 'Executioner'); L('ax_dex_3', 'ks_exec');
  AK('ks_tempo', A.dex - 0.24, 440, 'keystone', { haste: 0.30, movespeed: 0.15 }, 'Tempo'); L('ax_dex_3', 'ks_tempo');
  AK('ks_echo', A.int + 0.24, 440, 'keystone', { echo: true, spellPct: 12 }, 'Spell Echo'); L('ax_int_3', 'ks_echo');
  AK('ks_glass', A.int - 0.24, 440, 'keystone', { dmgPct: 55, hpPct: -40 }, 'Glass Cannon'); L('ax_int_3', 'ks_glass');
  AK('nt_top', Math.PI * 0.5, 250, 'notable', { meleePct: 10, spellPct: 10, crit: 4 }, 'Warmonger'); L('sd_str_2_n', 'nt_top'); L('sd_dex_2_p', 'nt_top');
  AK('ks_chain', Math.PI * 0.5, 360, 'keystone', { deathnova: 0.9 }, 'Chain Reaction'); L('nt_top', 'ks_chain');
  AK('nt_right', -Math.PI * 0.13, 250, 'notable', { dex: 10, eng: 10, crit: 3 }, 'Trickster'); L('sd_dex_2_n', 'nt_right'); L('sd_int_2_p', 'nt_right');
  AK('ks_aegis', -Math.PI * 0.13, 360, 'keystone', { manaShield: 0.4, mp: 50 }, 'Aegis'); L('nt_right', 'ks_aegis');
  AK('nt_left', Math.PI * 1.13, 250, 'notable', { str: 10, vit: 10, armor: 8 }, 'Bulwark'); L('sd_str_2_p', 'nt_left'); L('sd_int_2_n', 'nt_left');
  AK('ks_frost', Math.PI * 1.13, 360, 'keystone', { chillaura: true, spellPct: 8, eng: 8 }, 'Frostbite'); L('nt_left', 'ks_frost');
  return { nodes, adj, starts };
})();
function defaultSkillRanks() { const o = {}; for (const id in SKILLDEFS) o[id] = (id === 'strike') ? 1 : 0; return o; }
// V7 action-bar loadout: 6 fixed slots [LMB basic, RMB, key1..4]. Backfill from currently-unlocked actives;
// RMB (slot 1) preferentially takes the old activeSkillId so existing characters keep their "selected" skill.
function defaultLoadout(ch) {
  const lo = ['strike', null, null, null, null, null];
  const unlocked = ACTIVE_ORDER.filter(id => id !== 'strike' && ch.skills && ch.skills[id] >= 1);
  if (ch.activeSkillId && ch.activeSkillId !== 'strike' && unlocked.indexOf(ch.activeSkillId) >= 0) lo[1] = ch.activeSkillId;
  let s = 1;
  for (const id of unlocked) {
    if (id === lo[1]) continue;
    while (s < 6 && lo[s]) s++;
    if (s >= 6) break;
    lo[s] = id; s++;
  }
  return lo;
}

/* ================= SAVE ================= */
const SAVE = {
  KEY: 'sanctuarys_end_saves', VERSION: 7, NUM_SLOTS: 3, _data: null,
  load() {
    try { this._data = JSON.parse(localStorage.getItem(this.KEY)); } catch (e) { this._data = null; }
    if (!this._data) this._data = { version: this.VERSION, slots: Array(this.NUM_SLOTS).fill(null) };
    this._data.version = this.VERSION; if (!Array.isArray(this._data.slots)) this._data.slots = Array(this.NUM_SLOTS).fill(null);
    // Guard every slot: a corrupt/hand-edited/imported slot that isn't a valid character object must not
    // throw out of migrate() — this runs at top level, so an unhandled throw here bricks the whole game
    // on every boot (blank page until localStorage is cleared by hand). Bad slots degrade to empty.
    this._data.slots = this._data.slots.map(s => { if (!s || typeof s !== 'object' || Array.isArray(s)) return null; try { return this.migrate(s); } catch (e) { return null; } }); this._data.settings = Object.assign({ difficulty: 'Normal', muted: false, volume: 60, music: true, sfx: true, shake: true, dmgnum: true, resScale: 100, shadows: true, postfx: true, bloom: 0.9, exposure: 1.0, reflections: true, ssao: true, colorgrade: true, vfx: true, particles: true, lootFilter: { rarity: { common: true, magic: true, rare: true, set: true, unique: true }, slot: { weapon: true, helm: true, armor: true, gloves: true, boots: true, ring: true, amulet: true }, minIlvl: 0 }, keybinds: {} }, this._data.settings || {}); this.persist(); return this._data;
  },
  migrate(ch) {
    ch.base = ch.base || { hpMax: ch.hpMax || 100, mpMax: ch.mpMax || 50, dmg: (ch.dmg || 10) };
    ch.stats = ch.stats || { str: 10, dex: 10, vit: 10, eng: 10 };['str', 'dex', 'vit', 'eng'].forEach(k => { if (ch.stats[k] == null) ch.stats[k] = 10; });
    if (ch.statPoints == null) ch.statPoints = 0; if (ch.skillPoints == null) ch.skillPoints = 0;
    ch.inventory = ch.inventory || []; ch.stash = ch.stash || [];
    ch.equipment = Object.assign({ weapon: null, helm: null, armor: null, gloves: null, boots: null, ring: null, amulet: null }, ch.equipment || {});
    ch.skills = Object.assign(defaultSkillRanks(), ch.skills || {});
    if (ch.potions == null) ch.potions = 4;
    if (ch.hpPotions == null) ch.hpPotions = (ch.potions != null ? ch.potions : 4); if (ch.mpPotions == null) ch.mpPotions = 2;
    if (ch.potionTier == null) ch.potionTier = 0; if (ch.potionCap == null) ch.potionCap = 10;
    if (ch.invMax == null) ch.invMax = 40; if (ch.stashMax == null) ch.stashMax = 40; if (ch.activeSkillId === undefined) ch.activeSkillId = null; if (ch.materials == null) ch.materials = 0;
    if (ch.xpNext == null) ch.xpNext = 30; if (ch.maxDepth == null) ch.maxDepth = 0; if (!ch.class) ch.class = 'warrior'; if (!ch.passives || !ch.passives.length) ch.passives = [PTREE.starts[ch.class] || 'start_str']; if (ch.statPoints > 0) { ch.skillPoints = (ch.skillPoints || 0) + ch.statPoints; ch.statPoints = 0; }
    if (ch.discovered == null) ch.discovered = { town: true, highreach: false, emberhold: false };
    if (ch.gems == null) ch.gems = {};
    // ---- V7: ability loadout + per-skill rune trees (additive; never touches skills/passives/skillPoints/gems) ----
    if (!Array.isArray(ch.loadout) || ch.loadout.length !== 6) ch.loadout = defaultLoadout(ch); else ch.loadout[0] = 'strike';
    ch.skillRunes = ch.skillRunes || {};
    if (ch.abilityPoints == null) ch.abilityPoints = Math.max(0, (ch.level || 1) - 1); // retroactive +1/lvl from L2
    return ch;
  },
  persist() { try { localStorage.setItem(this.KEY, JSON.stringify(this._data)); return true; } catch (e) { return false; } },
  getSlot(i) { return this._data.slots[i]; },
  newCharacter(name, cls) {
    cls = CLASSES[cls] ? cls : 'warrior'; const c = CLASSES[cls]; const skills = {}; for (const id in SKILLDEFS) skills[id] = 0;
    return {
      name, class: cls, version: this.VERSION, created: Date.now(), lastPlayed: Date.now(), level: 1, xp: 0, xpNext: 30, gold: 0, materials: 0, gems: {}, kills: 0, potions: 4, hpPotions: 4, mpPotions: 2, potionTier: 0, potionCap: 10, invMax: 40, stashMax: 40, maxDepth: 0, activeSkillId: null, discovered: { town: true, highreach: false, emberhold: false },
      base: { hpMax: 100, mpMax: 50, dmg: 10 }, stats: { str: c.base.str, dex: c.base.dex, vit: c.base.vit, eng: c.base.eng }, statPoints: 0, skillPoints: 0,
      inventory: [], stash: [], equipment: { weapon: null, helm: null, armor: null, gloves: null, boots: null, ring: null, amulet: null }, skills, passives: [PTREE.starts[cls]],
      loadout: ['strike', (c.granted && c.granted[0]) || null, null, null, null, null], skillRunes: {}, abilityPoints: 0
    };
  },
  saveCharacter(i, ch) { ch.lastPlayed = Date.now(); this._data.slots[i] = ch; return this.persist(); },
  deleteSlot(i) { this._data.slots[i] = null; this.persist(); }
};
SAVE.load();
let currentSlot = null, character = null; const INV_CAP = 80, STASH_CAP = 80;
let difficulty = SAVE._data.settings.difficulty;

/* ================= THREE ================= */
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0d0a07); scene.fog = new THREE.Fog(0x0d0a07, 60, 170);
/* Phase 1b: WebGPURenderer. ?forceWebGL=1 in the URL forces the WebGL2 backend for fallback testing (init() is async; see the renderer.init() bootstrap at the file tail). antialias dropped: AA is done in the TSL chain (smaa) which renders to intermediate targets, so swapchain MSAA never reaches the composited image. */
const _forceWebGL = /[?&]forceWebGL=1\b/.test(location.search);
const _perf = /[?&]perf(test)?=1\b/.test(location.search); /* Phase 0 rig: ?perf=1 (or ?perftest=1) turns on GPU-timestamp tracking + the perf HUD. Off in normal play — timestamp queries add a little GPU overhead, so don't pay it unless measuring. */
const _perftest = /[?&]perftest=1\b/.test(location.search); /* ?perftest=1 also seeds RNG (top of file) + exposes window.perfRun() — the deterministic scripted measurement harness. */
let _perfGod = _perftest; /* perf rig: god-mode (perftest only) so perfRun's L1 char survives the depth-5 boss instead of dying → corrupting the test save. Toggle via window.__perfGod. */
const renderer = new THREE.WebGPURenderer({ powerPreference: 'high-performance', forceWebGL: _forceWebGL, trackTimestamp: _perf }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace; /* Phase 2: managed color (sRGB output). ColorManagement enabled in shim; renderOutput() reads this and applies the linear->sRGB encode (single transform; post.outputColorTransform stays false so it isn't double-applied). */
renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = (SAVE._data.settings.shadows !== false); renderer.shadowMap.type = THREE.PCFShadowMap; /* Phase 1b: WebGPURenderer.shadowMap is only {enabled,transmitted,type} - no autoUpdate/needsUpdate. The autoUpdate=false write moves to moon.shadow.autoUpdate after moon is created (avoids a TDZ ReferenceError - moon is a const below); per-frame needsUpdate writes route to moon.shadow.needsUpdate. */
let isWebGPUBackend = false; /* set once, post-init, in the renderer.init() bootstrap; gates backend-conditional behavior (e.g. AO default-OFF on the WebGL2 fallback). */
renderer.domElement.id = 'game'; document.getElementById('app').appendChild(renderer.domElement);
renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); console.warn('WebGL context lost'); }, false);
renderer.domElement.addEventListener('webglcontextrestored', () => { console.warn('WebGL context restored'); }, false);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 500); let camDist = 46, camHeight = 42;
function placeCamera(t) { const sh = SAVE._data.settings.shake ? shake : 0; const sx = (Math.random() - 0.5) * sh, sz = (Math.random() - 0.5) * sh; camera.position.set(t.x + sx, camHeight, t.z + camDist * 0.55 + sz); camera.lookAt(t.x, 0, t.z - 6); }
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); if (typeof sizeComposer === 'function') sizeComposer(); });
function applyGraphics() { const s = SAVE._data.settings; const pr = clamp((devicePixelRatio || 1) * ((s.resScale || 100) / 100), 0.5, 2); renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = !!s.shadows; if (typeof moon !== 'undefined') { moon.castShadow = !!s.shadows; moon.shadow.needsUpdate = true; } /* Phase 1b: per-light one-shot refresh (renderer.shadowMap has no needsUpdate on WebGPU). */ scene.traverse(o => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (m && (m.isMeshStandardMaterial || m.isMeshPhongMaterial || m.isMeshLambertMaterial)) m.needsUpdate = true; }); } }); }

/* ================= POST-FX (Phase 1b: TSL RenderPipeline - bloom + ACES tone map + per-biome grade/vignette + SMAA) =================
   The r128 EffectComposer chain (RenderPass -> SSAO -> UnrealBloom -> SMAA -> OutputPass -> _GRADE_SHADER ShaderPass)
   is rebuilt as a TSL node graph. EffectComposer addons do NOT run under WebGPURenderer.
   Node order (HARD requirement) reproduces the 1a tone-map-then-grade order:
     beauty = pass(scene,camera).getTextureNode()         (linear HDR)
     [+ bloom(beauty,...)]                                 (bloom on linear HDR)
     ldr = renderOutput(...)                               (ACES tone map + colorspace; reads renderer.toneMapping/exposure/outputColorSpace)
     graded = gradeVignette(ldr)                           (hand-ported _GRADE_SHADER on LDR; contrast pivot 0.5 + max(col,0) vignette)
     [+ smaa(graded)]                                      (AA on final LDR)
   post.outputColorTransform=false because renderOutput() applies the transform ourselves (Phase 2: outputColorSpace is
   SRGBColorSpace, so renderOutput applies ACES tone map + the linear->sRGB encode exactly once). */
let post = null; /* THREE.RenderPipeline; null until buildPipeline() runs post-init (or if build fails -> plain render fallback). */
let bloomPass = null; /* live BloomNode (strength/threshold/radius are uniform nodes). */
/* live grade uniforms (TSL): per-biome tint (vec3), vignette amount (float), and a 0/1 enable for the colorgrade toggle. */
const _uGradeTint = TSL.uniform(new THREE.Vector3(1, 1, 1)); const _uGradeVig = TSL.uniform(0.28); const _uGradeOn = TSL.uniform(1);
const _GRADE_CONTRAST = 1.06; /* matches the old _GRADE_SHADER gradeContrast literal. */
const MANAGED_EXPO = 1.8; /* Phase 2: managed color applies the proper linear->sRGB output encode (Path A skipped it, over-brightening the frame); the existing light rig was tuned for that over-bright output, so the color-managed frame renders ~half as bright. This code-side base lifts it back to a playable level. Kept SEPARATE from the user exposure setting so it reaches every save (incl. ones that already persisted exposure:1.0) and the slider stays a relative trim around the designed look. */
let _gTint = [1, 1, 1], _gVig = 0.28;
/* hand-ported _GRADE_SHADER as a TSL Fn: multiply tint, contrast pivot at 0.5, screen-space vignette = clamp(1 - vig*dot(d,d)*2.2). */
function _gradeVignette(ldr) {
  const T = TSL;
  return T.Fn(() => {
    const base = ldr.toVar();
    let col = base.rgb.mul(_uGradeTint);
    col = col.sub(0.5).mul(_GRADE_CONTRAST).add(0.5);
    const d = T.screenUV.sub(0.5);
    const vig = T.float(1).sub(_uGradeVig.mul(T.dot(d, d)).mul(2.2)).clamp(0, 1);
    col = T.max(col, 0).mul(vig);
    const graded = T.vec4(col, base.a);
    return T.mix(base, graded, _uGradeOn); /* colorgrade toggle: 0 = passthrough ldr, 1 = graded. */
  })();
}
function applyGradeUniforms() { _uGradeTint.value.set(_gTint[0], _gTint[1], _gTint[2]); _uGradeVig.value = _gVig; }
function setBiomeGrade(g) { if (g && g.t) { _gTint = g.t; _gVig = (g.v != null ? g.v : 0.3); } else { _gTint = [1, 1, 1]; _gVig = 0.26; } applyGradeUniforms(); }
function applyGrade() { _uGradeOn.value = (SAVE._data.settings.colorgrade !== false) ? 1 : 0; }
/* AO defaults OFF on the WebGL2 fallback (GTAO is costly on integrated GPUs - the toggle is the perf escape hatch); explicit ssao===true honors a deliberate opt-in. */
function _ssaoWanted() { const s = SAVE._data.settings; return s.ssao !== false && (isWebGPUBackend || s.ssao === true); }
/* Build (or rebuild) the RenderPipeline outputNode. Structural inclusion of the AO node lives here (TSL nodes have no .enabled),
   so the ssao toggle must rebuild; bloom strength / grade uniforms / exposure are LIVE and never trigger a rebuild. */
function buildPipeline() {
  if (!(window.THREE && THREE.RenderPipeline && window.TSL && TSL.pass)) { console.warn('Post-FX: RenderPipeline/TSL unavailable -> plain render'); post = null; return; }
  try {
    const s = SAVE._data.settings; const T = TSL;
    if (post && post.dispose) post.dispose(); /* Phase 1b: dispose the prior pipeline before rebuild (ssao toggle / preset switch) so its GPU render targets aren't leaked - buildPipeline is a rebuild, not a build-once like 1a's buildComposer. */
    post = new THREE.RenderPipeline(renderer); post.outputColorTransform = false;
    const scenePass = T.pass(scene, camera);
    const wantAO = _ssaoWanted() && THREE.ao;
    /* GTAO needs a scene-normal buffer; PassNode emits none by default, so request an MRT normal target ONLY when AO is on
       (MRT has bandwidth cost - keeping the plain single-target path when AO is off preserves the fallback perf escape hatch). */
    if (wantAO) { try { scenePass.setMRT(T.mrt({ output: T.output, normal: T.normalView })); } catch (e) { console.warn('GTAO MRT setup failed; AO disabled this build:', e && e.message); } }
    let beauty = scenePass.getTextureNode(wantAO ? 'output' : undefined);
    if (wantAO) {
      try {
        const aoPass = THREE.ao(scenePass.getTextureNode('depth'), scenePass.getTextureNode('normal'), camera);
        const aoTex = aoPass.getTextureNode ? aoPass.getTextureNode() : aoPass;
        beauty = beauty.mul(aoTex.r); /* GTAO output is single-channel occlusion in .r; multiply onto the beauty (matches the 1a SSAO multiply-onto-scene behavior). */
      } catch (e) { console.warn('GTAO wiring skipped (AO inactive this build):', e && e.message); }
    }
    bloomPass = THREE.bloom(beauty, (s.bloom != null ? s.bloom : 0.9), 0.5, 0.72); /* strength, radius, threshold (matches 1a UnrealBloom 0.9/0.5/0.72). */
    const hdr = beauty.add(bloomPass);
    let outNode = T.renderOutput(hdr); /* null toneMapping/colorSpace -> reads renderer.toneMapping/exposure + outputColorSpace (Phase 2: SRGBColorSpace -> ACES + sRGB encode). */
    outNode = _gradeVignette(outNode);
    if (THREE.smaa) { try { outNode = THREE.smaa(outNode); } catch (e) { console.warn('SMAA wiring skipped:', e && e.message); } }
    post.outputNode = outNode; applyGrade(); applyGradeUniforms();
  } catch (err) { console.warn('Post-FX pipeline build failed; using plain render:', err); post = null; bloomPass = null; }
}
function sizeComposer() { /* Phase 1b: PassNode follows the renderer's buffer (driven by renderer.setSize/setPixelRatio in applyGraphics + the resize handler), and RenderPipeline has no separate setSize - so resScale flows through the renderer automatically. Kept as a no-op stub so the resize handler + applyGraphics call sites stay valid. */ }
function applySSAO() { buildPipeline(); } /* structural: rebuild to include/exclude the GTAO node (TSL nodes have no .enabled, and we must NOT leave GTAO computing when off). */
function postOn() { return SAVE._data.settings.postfx !== false && !!post; } /* re-gated on the RenderPipeline instance (EffectComposer is gone). */
/* markGlows: under the 1a path (composer + OutputPass) the whole image was tone-mapped uniformly, so toneMapped=false was already effectively a no-op for additive glows; renderOutput() does the same uniform tone map -> keep as a harmless carryover that matches 1a (no per-material skip engineered, which would diverge from baseline). */
function markGlows() { scene.traverse(o => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (m && m.isMeshBasicMaterial) m.toneMapped = false; }); } }); }
function applyPostFX() { const s = SAVE._data.settings; const on = SAVE._data.settings.postfx !== false; renderer.toneMapping = on ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping; /* renderOutput() reads this; off-path keeps NoToneMapping for the plain-render branch. */ renderer.toneMappingExposure = (s.exposure != null ? s.exposure : 1.0) * MANAGED_EXPO; /* Phase 2: user exposure setting (slider, default 1.0) x managed-color base compensation. */ if (bloomPass && bloomPass.strength) bloomPass.strength.value = (s.bloom != null ? s.bloom : 0.9); markGlows(); scene.traverse(o => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (m) m.needsUpdate = true; }); } }); }
let _lastDraws = 0, _lastTris = 0;
function renderFrame() {
  _stepParticles(); /* Phase 5: advance the GPU ambient field (no-op unless built) before the render reads its buffer. */
  if (postOn()) post.render(); else renderer.render(scene, camera);
  _lastDraws = renderer.info.render.drawCalls; _lastTris = renderer.info.render.triangles; /* Phase 0 rig: capture NOW — info.render resets at the next render's start, and updateDebug() runs in update() before the next renderFrame, so reading it there gives 0. */
  if (_tsSupported) renderer.resolveTimestampsAsync(THREE.TimestampQuery.RENDER).then(() => { _gpuMs = renderer.info.render.timestamp || _gpuMs; }).catch(() => {}); /* resolve per render (every render path — menu/game/warm — must resolve or the query pool overflows); perf mode only */
}
/* NOTE: applyPostFX()/buildPipeline() are NOT called at parse time - the RenderPipeline build is GPU-dependent and runs inside the renderer.init().then(...) bootstrap at the file tail (R4: nothing GPU-dependent before init resolves). */

/* ================= IBL (procedural environment map for PBR reflections) ================= */
let envTex = null;
/* Phase 1b: assign the equirect CanvasTexture directly to scene.environment and let WebGPU's EnvironmentNode auto-PMREM it.
   This sidesteps the two-same-named-PMREMGenerator-classes ambiguity (the bare-three one is WebGL-only). Runs post-init. */
function buildEnv() { try { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const c = cv.getContext('2d'); const g = c.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#3a3220'); g.addColorStop(0.45, '#1a160e'); g.addColorStop(1, '#070503'); c.fillStyle = g; c.fillRect(0, 0, 128, 64); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; /* Phase 2: painted sRGB gradient -> decode for correct reflection tint. */ tex.mapping = THREE.EquirectangularReflectionMapping; envTex = tex; applyReflections(); } catch (err) { console.warn('IBL env build failed; metals will use light-only shading:', err); } }
/* Region-aware: in the open-world wild zone reflections sample the loaded sky HDRI; everywhere else the dark
   procedural canvas env (envTex). Called by buildEnv (init), the reflections settings toggle, and applyHDRI/restoreProcEnv. */
function applyReflections() { const on = SAVE._data.settings.reflections !== false; const tex = (zone === 'wild' && curRegion && _envCache[curRegion.id]) ? _envCache[curRegion.id] : envTex; scene.environment = (on && tex) ? tex : null; }
/* NOTE: buildEnv() runs inside the renderer.init().then(...) bootstrap (R4: PMREM/env setup is GPU-dependent). */

/* ================= HDRI sky + IBL per open-world region (lazy-loaded, cached) =================
   Real 2K Radiance maps in assets/hdri/, one per REGION. HDRLoader output is LINEAR radiance — do NOT tag it
   sRGB (that washes the colors). Assigned straight to scene.background (skybox) + scene.environment; WebGPU's
   EnvironmentNode auto-PMREMs it (same proven path as buildEnv, no PMREMGenerator). Only the wild zone gets a
   sky; town/dungeon keep the dark procedural env. Intensities dial the bright sky down to fit the moody grade. */
const REGION_HDRI = { greenwilds: 'greenwilds_alps_field_2k.hdr', frostfen: 'frostfen_frozen_lake_2k.hdr', ashlands: 'ashlands_the_sky_is_on_fire_2k.hdr' };
const HDRI_BASE = 'assets/hdri/'; let _hdrLoader = null; const _envCache = {};
function ensureColorBg() { if (!(scene.background && scene.background.isColor)) scene.background = new THREE.Color(0x000000); }
function applyHDRI(tex) { scene.background = tex; scene.backgroundIntensity = 0.42; scene.environmentIntensity = 0.45; applyReflections(); }
function restoreProcEnv() { scene.backgroundIntensity = 1; scene.environmentIntensity = 1; applyReflections(); }
function loadRegionEnv(region) {
  if (!region) return; const file = REGION_HDRI[region.id]; if (!file) { restoreProcEnv(); return; }
  if (_envCache[region.id]) { applyHDRI(_envCache[region.id]); return; }
  if (!(window.THREE && THREE.HDRLoader)) return; /* loader missing -> dark procedural env stays as fallback */
  if (!_hdrLoader) _hdrLoader = new THREE.HDRLoader();
  _hdrLoader.load(HDRI_BASE + file,
    tex => { tex.mapping = THREE.EquirectangularReflectionMapping; _envCache[region.id] = tex; if (zone === 'wild' && curRegion && curRegion.id === region.id) applyHDRI(tex); },
    undefined,
    err => { console.warn('HDRI load fail: ' + file, err); });
}

/* ================= PBR ground textures (KTX2, per-zone, lazy-loaded + cached) =================
   Real ambientCG PBR sets in assets/textures/, transcoded by KTX2Loader (basis transcoder from the same
   unpkg CDN as three). Mirrors the HDRI loader exactly: a zone/region -> set map, a lazy singleton loader,
   a cache by set name, and a race-guarded apply. There is ONE shared `ground` plane for every zone (it's
   added straight to `scene` and never hidden — just recolored/remapped per zone), so this all funnels through
   `groundMat`. CRITICAL (perf-fixes-v38 / models-v41): the material keeps ALL map slots populated forever
   (white/flat placeholders) so swapping a set only changes texture *contents* — no node-graph/pipeline
   variant change, no shader-recompile hitch at a region boundary. Gated by the `groundTex` quality knob;
   Low keeps the cheap procedural ground. */
const REGION_GROUND = { greenwilds: 'greenwilds_grass', frostfen: 'frostfen_snow', ashlands: 'ashlands_dark_rock' };
const TOWN_GROUND_SET = 'greenwilds_forest_floor';        /* default town ground -> earthy forest floor */
const TOWN_GROUND_BY_ID = { emberhold: 'ashlands_dark_rock', highreach: 'frostfen_snow' }; /* per-town overrides: each town gets its biome ring's ground (Emberhold->Ashlands rock, Highreach->Frostfen snow), not grass */
const DUNGEON_FLOOR_SET = 'dungeon_floor_cobble', DUNGEON_WALL_SET = 'dungeon_wall_brick';
const TEX_BASE = 'assets/textures/';
const BASIS_PATH = 'https://unpkg.com/three@0.184.0/examples/jsm/libs/basis/'; /* basis_transcoder.js + .wasm, same CDN as the import map */
let _ktx2 = null; const _groundTexCache = {}, _groundTexLoading = {};
let _whiteTex = null, _flatNTex = null;
function _whitePx() { if (_whiteTex) return _whiteTex; _whiteTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); _whiteTex.colorSpace = THREE.NoColorSpace; _whiteTex.needsUpdate = true; return _whiteTex; } /* neutral roughness(=1)/AO(=none) placeholder */
function _flatNormal() { if (_flatNTex) return _flatNTex; _flatNTex = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1); _flatNTex.colorSpace = THREE.NoColorSpace; _flatNTex.needsUpdate = true; return _flatNTex; } /* flat tangent-space normal placeholder */
function groundTexOn() { return SAVE._data.settings.groundTex !== false; }
function _getKTX2() { if (_ktx2) return _ktx2; if (!(window.THREE && THREE.KTX2Loader)) return null; try { _ktx2 = new THREE.KTX2Loader().setTranscoderPath(BASIS_PATH).detectSupport(renderer); } catch (e) { console.warn('KTX2Loader init failed:', e && e.message); _ktx2 = null; } return _ktx2; }
function _cfgTex(t, srgb, rx, ry) { t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = _MAXANI; t.needsUpdate = true; return t; }
/* Load albedo/normal/roughness(/ao) for a set once, configure colorspace+tiling, cache by set name. ao is
   optional (some sets ship emission instead) -> tolerated as null and replaced by the white placeholder. */
function loadGroundSet(setName, rx, ry) {
  if (_groundTexCache[setName]) return Promise.resolve(_groundTexCache[setName]);
  if (_groundTexLoading[setName]) return _groundTexLoading[setName];
  const k = _getKTX2(); if (!k) return Promise.reject(new Error('KTX2Loader unavailable'));
  const base = TEX_BASE + setName + '/';
  const p = Promise.all([
    k.loadAsync(base + 'albedo.ktx2').then(t => _cfgTex(t, true, rx, ry)),
    k.loadAsync(base + 'normal.ktx2').then(t => _cfgTex(t, false, rx, ry)),
    k.loadAsync(base + 'roughness.ktx2').then(t => _cfgTex(t, false, rx, ry)),
    k.loadAsync(base + 'ao.ktx2').then(t => _cfgTex(t, false, rx, ry)).catch(() => null)
  ]).then(([map, normalMap, roughnessMap, aoMap]) => { const b = { map, normalMap, roughnessMap, aoMap }; _groundTexCache[setName] = b; delete _groundTexLoading[setName]; return b; })
    .catch(e => { delete _groundTexLoading[setName]; throw e; });
  _groundTexLoading[setName] = p; return p;
}
/* Swap a cached set onto the shared groundMat (no slot ever set null -> stable pipeline). tintHex multiplies
   the albedo (0xffffff = raw for wild/town; biome th.ground for dungeon mood). guard re-checks we're still in
   the zone/region that requested the load (fast-travel race). */
function _applyToGround(setName, rx, ry, tintHex, guard) {
  const t = _groundTexCache[setName]; if (!t) return; if (guard && !guard()) return;
  groundMat.vertexColors = false; groundMat.color.setHex(tintHex == null ? 0xffffff : tintHex);
  // Re-apply the tiling on every use: the set cache is keyed by name only, so a set shared between the wild
  // (30,30) and a town override (40,40) would otherwise inherit whichever zone loaded it first.
  if (rx != null) for (const x of [t.map, t.normalMap, t.roughnessMap, t.aoMap]) { if (x && x.repeat) { x.repeat.set(rx, ry); x.needsUpdate = true; } }
  groundMat.map = t.map; groundMat.normalMap = t.normalMap; groundMat.roughnessMap = t.roughnessMap || _whitePx(); groundMat.aoMap = t.aoMap || _whitePx();
  groundMat.needsUpdate = true;
}
function restoreProcGround() { groundMat.map = texGround(30); groundMat.normalMap = texGroundNormal(30); groundMat.roughnessMap = _whitePx(); groundMat.aoMap = _whitePx(); groundMat.needsUpdate = true; } /* fallback (gate off / loader missing); vertexColors+color are owned by setZoneVisuals */
function _requestGround(setName, rx, ry, tintHex, guard) {
  if (!groundTexOn() || !setName) { restoreProcGround(); return; }
  if (_groundTexCache[setName]) { _applyToGround(setName, rx, ry, tintHex, guard); return; }
  if (!_getKTX2()) { restoreProcGround(); return; }
  loadGroundSet(setName, rx, ry).then(() => _applyToGround(setName, rx, ry, tintHex, guard)).catch(e => console.warn('ground tex load fail ' + setName + ':', e && e.message));
}
function loadRegionGround(region) { if (!region) return; _requestGround(REGION_GROUND[region.id], 30, 30, 0xffffff, () => zone === 'wild' && curRegion && curRegion.id === region.id); }
function loadTownGround() { const id = curTownArea && curTownArea.id, set = (id && TOWN_GROUND_BY_ID[id]) || TOWN_GROUND_SET; _requestGround(set, 40, 40, 0xffffff, () => zone === 'town' && curTownArea && curTownArea.id === id); ensureCobble(); }
function loadDungeonGround(th) { _requestGround(DUNGEON_FLOOR_SET, 64, 64, (th && th.ground != null) ? th.ground : 0xffffff, () => zone === 'dungeon'); }
/* Town roads/plaza re-skin with the dungeon_floor_cobble KTX2. Loaded ONCE at the dungeon's repeat (64) so the shared
   set cache stays valid for the dungeon floor; each road segment then gets a CLONE of the albedo with a world-proportional
   repeat so cobbles are a uniform size on every road. Procedural texStone until it arrives / if the groundTex knob is off;
   a town rebuild re-skins the roads when it loads. Albedo only — mergeStaticScenery keeps `map` but drops normalMap. */
let _cobbleBase = null, _cobbleLoading = false;
function ensureCobble() {
  if (_cobbleBase || _cobbleLoading || !groundTexOn() || !_getKTX2()) return;
  _cobbleLoading = true;
  loadGroundSet(DUNGEON_FLOOR_SET, 64, 64).then(b => { _cobbleBase = b; _cobbleLoading = false; if (typeof zone !== 'undefined' && zone === 'town') { try { buildTown(curTownArea); } catch (e) { console.warn('town cobble rebuild failed:', e && e.message); } } }).catch(e => { _cobbleLoading = false; console.warn('cobble load fail:', e && e.message); });
}
/* Cache cobble albedo clones by tiling. Every buildTown used to clone _cobbleBase.map afresh per road/plaza,
   and disposeObj disposes materials but not their textures — so each town entry leaked a batch of GPU
   textures. Keying by repeat bounds the clones to the handful of distinct road sizes across all rebuilds. */
const _cobbleTexCache = {};
function _cobbleTex(map, w, l) { const TILE = 4, rx = Math.max(1, w / TILE), ry = Math.max(1, l / TILE), key = rx.toFixed(3) + 'x' + ry.toFixed(3); if (_cobbleTexCache[key]) return _cobbleTexCache[key]; const t = map.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.offset.set(0, 0); t.repeat.set(rx, ry); t.needsUpdate = true; _cobbleTexCache[key] = t; return t; }
function _pavedMat(w, l, fallbackCol) {
  if (_cobbleBase) return new THREE.MeshPhongMaterial({ specular: 0x0a0a0a, shininess: 6, color: fallbackCol || 0xc9bda6, map: _cobbleTex(_cobbleBase.map, w, l) });
  return new THREE.MeshPhongMaterial({ specular: 0x000000, color: fallbackCol, map: texStone(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(l / 2))) });
}
/* Persistent dungeon perimeter wall (brick). Lives in its own scene-level group so clearGroup(dungeonGroup)
   never disposes its shared material; recoloured per biome instead of rebuilt per descent. */
function loadDungeonWall(th) {
  dungeonWallMat.color.setHex((th && th.pillar != null) ? th.pillar : 0x3a3340);
  if (!groundTexOn()) { dungeonWallMat.map = texStone(16, 2); dungeonWallMat.normalMap = _flatNormal(); dungeonWallMat.roughnessMap = _whitePx(); dungeonWallMat.aoMap = _whitePx(); dungeonWallMat.needsUpdate = true; return; }
  loadGroundSet(DUNGEON_WALL_SET, 18, 3).then(t => { if (zone !== 'dungeon') return; dungeonWallMat.map = t.map; dungeonWallMat.normalMap = t.normalMap; dungeonWallMat.roughnessMap = t.roughnessMap || _whitePx(); dungeonWallMat.aoMap = t.aoMap || _whitePx(); dungeonWallMat.needsUpdate = true; }).catch(e => console.warn('dungeon wall tex:', e && e.message));
}
/* Re-apply the current zone's ground when the groundTex knob flips at runtime (quality change). */
function refreshGroundTex() {
  if (typeof zone === 'undefined') return;
  if (zone === 'wild') { if (groundMat.vertexColors) { groundMat.vertexColors = false; } groundMat.color.setHex(groundTexOn() ? ((curRegion && curRegion.groundTint) || 0xffffff) : ((curRegion && curRegion.groundCol) || 0x35402a)); groundMat.needsUpdate = true; loadRegionGround(curRegion); }
  else if (zone === 'town') { groundMat.color.setHex(groundTexOn() ? 0xffffff : ((curTownArea && curTownArea.townTheme && curTownArea.townTheme.ground) || 0x3a2f22)); loadTownGround(); }
  else if (zone === 'dungeon') { const th = curTheme || dungeonTheme(depth); loadDungeonGround(th); loadDungeonWall(th); }
}

/* ================= Phase 5: GPU-compute ambient particles (WebGPU-only, High preset) =================
   A bounded additive ambient field (drifting embers/dust) simulated in a TSL compute pass on the GPU.
   Gated through the quality system (the `particles` knob is High-only; Auto maps WebGL2->Medium) AND a hard
   isWebGPUBackend guard, so the WebGL2 fallback simply omits it - no CPU sim => no mid-hardware regression;
   "absent on fallback" IS the lighter fallback for pure ambience. Built ONCE and reused across zones (the
   tint follows the zone + the field follows the camera each frame), so there's no per-zone rebuild churn and
   the pipeline compiles behind #loading in the init bootstrap (no gameplay first-encounter freeze). */
const PART_COUNT = 500, PART_R = 55, PART_Y = 24;
const _uPartCam = (window.TSL && TSL.uniform) ? TSL.uniform(new THREE.Vector3()) : null;
const _uPartTint = (window.TSL && TSL.uniform) ? TSL.uniform(new THREE.Color(0xffd2a0)) : null;
let _particles = null;
function _particlesWanted() { const s = SAVE._data.settings; return !!(isWebGPUBackend && window.TSL && TSL.instancedArray && THREE.SpriteNodeMaterial && s.particles !== false); }
function buildParticles() {
  try {
    const T = TSL;
    const positions = T.instancedArray(PART_COUNT, 'vec3'), velocities = T.instancedArray(PART_COUNT, 'vec3');
    const ii = T.instanceIndex; /* hash() takes the uint index directly + integer offsets (matches the r184 webgpu_compute_particles example); float(index)+frac did NOT randomize -> particles fell on a line. */
    const computeInit = T.Fn(() => {
      const p = positions.element(ii), v = velocities.element(ii);
      p.x = T.hash(ii).sub(0.5).mul(PART_R * 2); p.y = T.hash(ii.add(1)).mul(PART_Y); p.z = T.hash(ii.add(2)).sub(0.5).mul(PART_R * 2);
      v.x = T.hash(ii.add(3)).sub(0.5).mul(1.2); v.y = T.hash(ii.add(4)).mul(1.4).add(0.5); v.z = T.hash(ii.add(5)).sub(0.5).mul(1.2);
    })().compute(PART_COUNT);
    const computeUpdate = T.Fn(() => {
      const p = positions.element(ii), v = velocities.element(ii);
      p.addAssign(v.mul(T.deltaTime));
      p.x = T.mod(p.x.add(PART_R), PART_R * 2).sub(PART_R); p.y = T.mod(p.y, PART_Y); p.z = T.mod(p.z.add(PART_R), PART_R * 2).sub(PART_R);
    })().compute(PART_COUNT);
    renderer.compute(computeInit);
    const mat = new THREE.SpriteNodeMaterial(); mat.transparent = true; mat.depthWrite = false; mat.blending = THREE.AdditiveBlending;
    const base = positions.toAttribute();
    const wx = T.mod(base.x.sub(_uPartCam.x).add(PART_R), PART_R * 2).sub(PART_R).add(_uPartCam.x);
    const wz = T.mod(base.z.sub(_uPartCam.z).add(PART_R), PART_R * 2).sub(PART_R).add(_uPartCam.z);
    mat.positionNode = T.vec3(wx, base.y, wz); mat.colorNode = _uPartTint; mat.scaleNode = T.float(0.4); mat.opacityNode = T.shapeCircle().mul(0.13);
    const sprite = new THREE.Sprite(mat); sprite.count = PART_COUNT; sprite.frustumCulled = false; sprite.renderOrder = 6; sprite.userData.noDispose = true;
    scene.add(sprite);
    _particles = { sprite, mat, computeUpdate, dispose() { scene.remove(sprite); try { mat.dispose(); } catch (e) {} try { positions.dispose && positions.dispose(); velocities.dispose && velocities.dispose(); } catch (e) {} } };
  } catch (e) { console.warn('Ambient particles unavailable; skipping:', e && e.message); _particles = null; }
}
function applyParticles() { if (!_uPartCam) return; const want = _particlesWanted(); if (want && !_particles) buildParticles(); else if (!want && _particles) { _particles.dispose(); _particles = null; } }
/* per-frame: follow the camera (XZ only; Y stays in the stored low band) + tint by zone, then dispatch the GPU update. */
function _stepParticles() { if (!_particles) return; const cx = (typeof player !== 'undefined' && player) ? player.x : camera.position.x, cz = (typeof player !== 'undefined' && player) ? player.z : camera.position.z; _uPartCam.value.set(cx, 0, cz); _uPartTint.value.set((typeof zone !== 'undefined' && zone === 'dungeon') ? 0xff7a2e : 0xffd2a0); renderer.compute(_particles.computeUpdate); }
/* Phase 1a relight: r184 removed useLegacyLights, so ambient/hemisphere/directional intensities are x Math.PI for a clean legacy restore; point lights use x Math.PI as a starting point (inverse-square decay=2 has no exact factor) and are eyeball/A-B retuned. */
const hemi = new THREE.HemisphereLight(0x443322, 0x110a05, 0.55 * Math.PI); scene.add(hemi);
const moon = new THREE.DirectionalLight(0x9fb6ff, 0.7 * Math.PI); moon.position.set(30, 60, 20); moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); moon.shadow.bias = -0.0005;
moon.shadow.camera.left = -70; moon.shadow.camera.right = 70; moon.shadow.camera.top = 70; moon.shadow.camera.bottom = -70; moon.shadow.camera.far = 180; scene.add(moon);
moon.shadow.autoUpdate = false; /* Phase 1b: relocated here from the renderer construction (WebGPURenderer.shadowMap has no autoUpdate; referencing moon at the renderer line would be a TDZ ReferenceError). LightShadow.autoUpdate defaults true, so this is mandatory or the 1024x1024 map recomputes every frame. needsUpdate is driven one-shot from applyGraphics/loop/menuLoop/bootstrap. */
const torch = new THREE.PointLight(0xffb070, 1.6 * Math.PI, 66, 2); torch.position.set(0, 8, 0); scene.add(torch);
/* Diablo-style player aura: a wide, gentle (low-decay) pool of light around the hero so dark zones read clearly
   near the player and fade to black further out. PERMANENT in the scene (intensity modulated per zone, never
   add/removed) so the light count stays constant -> no shader recompile on zone change ([[perf-fixes-v38]]).
   Not registered in PL_REG, so it's exempt from the cull budget (like torch). Decay 1.3 (vs torch's physical 2)
   = a flatter, more even radius. Tune PLAYER_GLOW (per-zone intensity), .distance (radius) and .color by eye. */
const PLAYER_GLOW = { dungeon: 9 * Math.PI, wild: 0, town: 0 }; /* per-zone aura intensity; set wild>0 to light the night wilds too */
const playerGlow = new THREE.PointLight(0xffe2b4, 0, 56, 1.0); playerGlow.position.set(0, 14, 0); scene.add(playerGlow);

/* ---- point-light budget: only the N nearest emitters stay lit (perf) ---- */
const PL_REG = []; let PL_MAX = 9; let _plVisN = 0; const _plWP = new THREE.Vector3(); let _lightBucket = 'static';
function regLight(light, dynamic) { PL_REG.push({ light, dynamic: !!dynamic, wp: null, bucket: _lightBucket }); return light; }
function clearLightBucket(b) { for (let i = PL_REG.length - 1; i >= 0; i--) if (PL_REG[i].bucket === b) PL_REG.splice(i, 1); }
function unregLight(L) { if (!L) return; for (let i = PL_REG.length - 1; i >= 0; i--) if (PL_REG[i].light === L) { PL_REG.splice(i, 1); break; } }
/* Fixed light-slot pool — THE fix for the dungeon/combat stutter. three.js WebGPU bakes the *set* of active lights
   into every material's pipeline cache key, so the old cullLights (which toggled which of the ~50 registered torches
   were the nearest-PL_MAX visible) made the active set churn as the player moved — and every churn forced ALL
   materials to recompile (~500ms NodeBuilder rebuild + ~40MB garbage), the felt "stutter while walking/fighting".
   Now PL_MAX PointLights live permanently in the scene; cullLights only COPIES the nearest sources' world-pos +
   color/intensity/distance/decay into these fixed slots (uniform writes — never a recompile). The registered lights
   are pure data: their own .visible is forced false so they never render directly. Constant light set ⇒ compile once. */
const _plSlots = [];
function _ensureSlots() { while (_plSlots.length < PL_MAX) { const L = new THREE.PointLight(0xffffff, 0, 10, 2); L.userData.plSlot = true; scene.add(L); _plSlots.push(L); } while (_plSlots.length > PL_MAX) scene.remove(_plSlots.pop()); for (const L of _plSlots) L.visible = true; }
function cullLights() {
  _ensureSlots();
  const cands = [];
  for (const e of PL_REG) {
    const L = e.light; L.visible = false; if (L.intensity <= 0) continue;
    let vis = true, o = L.parent; while (o) { if (o.visible === false) { vis = false; break; } o = o.parent; }
    if (!vis) continue;
    let wp; if (e.dynamic) { L.getWorldPosition(_plWP); wp = _plWP; } else { if (!e.wp) { L.updateWorldMatrix(true, false); e.wp = new THREE.Vector3(); L.getWorldPosition(e.wp); } wp = e.wp; }
    e._d = (wp.x - player.x) ** 2 + (wp.z - player.z) ** 2; e._wx = wp.x; e._wy = wp.y; e._wz = wp.z; cands.push(e);
  }
  cands.sort((a, b) => a._d - b._d);
  for (let i = 0; i < _plSlots.length; i++) { const slot = _plSlots[i], e = cands[i]; if (e) { const L = e.light; slot.position.set(e._wx, e._wy, e._wz); slot.color.copy(L.color); slot.intensity = L.intensity; slot.distance = L.distance; slot.decay = L.decay; } else slot.intensity = 0; }
  _plVisN = _plSlots.length;
}

const MAP = 480, DUNG_PLAY_R = 88, DUNG_WALL_R = 90, DUNG_HALF = 80, DUNG_BACK_R = 122, TOWN_R = 48, WILD_R = 150;
/* DUNG_HALF: half-extent of the rectangular stone hall (kit walls at ±(DUNG_HALF+2), player/mob clamp at ±DUNG_HALF).
   DUNG_BACK_R: radius of the persistent brick backdrop cylinder — must exceed the hall's corner reach (DUNG_HALF·√2≈113). */
const EMBER_UNLOCK = 10; /* maxDepth required to breach Frostfen → Ashlands (declared early: referenced in REGIONS) */
/* ---- biome regions. Each is now its OWN bounded map (origin-centered, radius WILD_R), reached through a portal —
   NOT concentric rings of one open world. `town` = the settlement this wilderness adjoins; `next`/`prev` chain the
   biomes; `nextGate` is a maxDepth requirement to breach onward. `trees/bushes/grasses/rocks` are the KayKit nature
   atlas variants this biome instances (all share nature.glb's single atlas → free InstancedMesh). r2 kept only for
   the (now-dead) ground vertex bake & legacy regionAt. ---- */
const REGIONS = [
  {
    id: 'greenwilds', name: 'Greenwilds', lvl: 1, r2: 260 * 260, groundCol: 0x35402a, groundTint: 0x8f9a82, fog: 0x0c1108, fire: 0xff7a2a, amb: 0x9ad86a,
    town: 'town', next: 'frostfen', prev: null,
    trees: ['Tree_1_A_Color1', 'Tree_2_A_Color1', 'Tree_3_A_Color1', 'Tree_4_A_Color1'], bushes: ['Bush_1_A_Color1', 'Bush_2_A_Color1', 'Bush_3_A_Color1', 'Bush_4_A_Color1'], grasses: ['Grass_1_A_Color1', 'Grass_2_A_Color1', 'Grass_1_C_Color1', 'Grass_2_C_Color1'], rocks: ['Rock_1_A_Color1', 'Rock_2_A_Color1', 'Rock_3_A_Color1'],
    dens: { tree: 70, rock: 55, bush: 130, grass: 240, flower: 130, mush: 40 },
  },
  {
    id: 'frostfen', name: 'Frostfen', lvl: 7, r2: 380 * 380, groundCol: 0x415a68, groundTint: 0xc8d2da, fog: 0x0a1620, fire: 0x6ad8ff, amb: 0xbfe8ff,
    town: 'highreach', next: 'ashlands', prev: 'greenwilds', nextGate: EMBER_UNLOCK,
    trees: ['Tree_Bare_1_A_Color1', 'Tree_Bare_2_A_Color1', 'Tree_3_A_Color1'], bushes: ['Bush_4_A_Color1', 'Bush_2_A_Color1'], grasses: ['Grass_1_A_Color1', 'Grass_2_A_Color1'], rocks: ['Rock_1_A_Color1', 'Rock_2_A_Color1', 'Rock_3_A_Color1', 'Rock_1_E_Color1', 'Rock_2_C_Color1'],
    dens: { tree: 45, rock: 95, bush: 55, grass: 110, flower: 50, mush: 30 },
  },
  {
    id: 'ashlands', name: 'Ashlands', lvl: 14, r2: Infinity, groundCol: 0x4a2a22, groundTint: 0xb1968a, fog: 0x1a0e08, fire: 0xff5020, amb: 0xff7a4a,
    town: 'emberhold', next: null, prev: 'frostfen',
    trees: ['Tree_Bare_1_A_Color1', 'Tree_Bare_2_A_Color1'], bushes: ['Bush_4_A_Color1'], grasses: ['Grass_2_A_Color1'], rocks: ['Rock_1_A_Color1', 'Rock_2_A_Color1', 'Rock_3_A_Color1', 'Rock_1_E_Color1', 'Rock_2_C_Color1', 'Rock_3_C_Color1'],
    dens: { tree: 30, rock: 120, bush: 25, grass: 40, flower: 30, mush: 50 },
  },
];
function regionAt(x, z) { const d2 = x * x + z * z; for (const r of REGIONS) if (d2 <= r.r2) return r; return REGIONS[REGIONS.length - 1]; }
function wildById(id) { return REGIONS.find(r => r.id === id) || null; }
const REGION_DECO = {
  greenwilds: { foliage: 0x3a5a26, grass: 0x3a4a26, trunk: 0x2a1f14, rock: 0x4a443a, flower: 0xffe27a },
  frostfen: { foliage: 0x6a86a0, grass: 0x4a5a60, trunk: 0x3a3a3e, rock: 0x3a4450, flower: 0xbfe8ff },
  ashlands: { foliage: 0x5a3a2a, grass: 0x4a3326, trunk: 0x1a120c, rock: 0x3a2620, flower: 0xff6a3a }
};
const wildColliders = [], townColliders = [], dungeonColliders = [];

/* ---- procedural textures (canvas -> CanvasTexture; the only path that works under file://) ----
   All textures are grayscale DETAIL maps: they multiply each material's existing color, so every
   zone/theme keeps its palette for free and we just add surface relief. Canvases are painted once
   and cached; finished THREE.Texture objects are cached by repeat-key so dungeon rebuilds reuse
   them (a bare material.dispose() does NOT free textures, so sharing avoids a per-descent leak). */
const _texCache = {};
/* Phase 1b: r184 Renderer exposes getMaxAnisotropy() directly (WebGPURenderer has no renderer.capabilities.getMaxAnisotropy). This is a parse-time read before init resolves, so it may report 1 (textures slightly softer) until anisotropy support is known; _refreshAnisotropy() re-resolves it post-init in the bootstrap and re-tags cached textures. */
let _MAXANI = (() => { try { return Math.min(8, (renderer.getMaxAnisotropy ? renderer.getMaxAnisotropy() : (renderer.capabilities && renderer.capabilities.getMaxAnisotropy && renderer.capabilities.getMaxAnisotropy())) || 1); } catch (_) { return 1; } })();
function _refreshAnisotropy() { try { const m = Math.min(8, (renderer.getMaxAnisotropy ? renderer.getMaxAnisotropy() : 1) || 1); if (m > _MAXANI) { _MAXANI = m; for (const k in _texCache) { const t = _texCache[k]; if (t) { t.anisotropy = m; t.needsUpdate = true; } } } } catch (_) { } }
function _hash2(ix, iz, seed) { let h = (Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263) + Math.imul(seed | 0, 1442695041)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return (h >>> 0) / 4294967295; }
function _tileNoise(u, v, cells, seed) {
  const fx = u * cells, fy = v * cells, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), m = n => ((n % cells) + cells) % cells;
  const a = _hash2(m(x0), m(y0), seed), b = _hash2(m(x0 + 1), m(y0), seed), c = _hash2(m(x0), m(y0 + 1), seed), d = _hash2(m(x0 + 1), m(y0 + 1), seed);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}
function _fbm(u, v, seed) { return 0.5 * _tileNoise(u, v, 4, seed) + 0.3 * _tileNoise(u, v, 8, seed + 7) + 0.2 * _tileNoise(u, v, 16, seed + 19); }
function _paint(size, fn) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const ctx = cv.getContext('2d'), img = ctx.createImageData(size, size), d = img.data;
  for (let y = 0; y < size; y++)for (let x = 0; x < size; x++) { const c = fn(x / size, y / size), i = (y * size + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; } ctx.putImageData(img, 0, 0); return cv;
}
function _mkTex(cv, rx, ry) { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; /* Phase 2: these procedural canvases are albedo/color maps -> decode sRGB. Data maps (texGroundNormal) override back to NoColorSpace. */ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.anisotropy = _MAXANI; t.needsUpdate = true; return t; }
function _cobbleH(u, v) { u -= Math.floor(u); v -= Math.floor(v); const cell = 5, gx = u * cell, gy = v * cell, cx = Math.floor(gx), cy = Math.floor(gy), px = gx - cx - 0.5, py = gy - cy - 0.5, dist = Math.min(1, Math.hypot(px, py) * 2); let h = 1 - dist * dist; if (h < 0) h = 0; return h * (0.82 + 0.18 * _fbm(u, v, 3)); }
function texGround(rep) {
  const k = 'g' + (rep || 30); if (_texCache[k]) return _texCache[k];
  if (!_texCache._gcv) _texCache._gcv = _paint(256, (u, v) => { const h = _cobbleH(u, v), cx = Math.floor((((u % 1) + 1) % 1) * 5), cy = Math.floor((((v % 1) + 1) % 1) * 5), ps = _hash2(cx, cy, 2); let s = 0.7 + 0.28 * h + (ps - 0.5) * 0.12; s = Math.max(0, Math.min(1, s)); const g = s * 240; return [g, g * 0.97, g * 0.92]; });
  return _texCache[k] = _mkTex(_texCache._gcv, rep || 30, rep || 30);
}
function texGroundNormal(rep) {
  const k = 'gn' + (rep || 30); if (_texCache[k]) return _texCache[k];
  if (!_texCache._gncv) { const e = 1 / 256; _texCache._gncv = _paint(256, (u, v) => { const hl = _cobbleH(u - e, v), hr = _cobbleH(u + e, v), hd = _cobbleH(u, v - e), hu = _cobbleH(u, v + e), nx = (hl - hr) * 3, ny = (hd - hu) * 3, nz = 1, L = Math.hypot(nx, ny, nz); return [(nx / L * 0.5 + 0.5) * 255, (ny / L * 0.5 + 0.5) * 255, (nz / L * 0.5 + 0.5) * 255]; }); }
  const t = _mkTex(_texCache._gncv, rep || 30, rep || 30); t.colorSpace = THREE.NoColorSpace; /* Phase 2: normal map = linear data, NOT a color map. */ return _texCache[k] = t;
}
function texStone(rx, ry) {
  const k = 's' + (rx || 2) + 'x' + (ry || 2); if (_texCache[k]) return _texCache[k];
  if (!_texCache._scv) _texCache._scv = _paint(256, (u, v) => { const n = _fbm(u, v, 11), cr = _fbm(u, v, 23), crack = Math.abs(cr - 0.5) < 0.025 ? 0.55 : 1; let g = (0.64 + 0.34 * n) * crack; g = Math.max(0, Math.min(1, g)) * 235; return [g, g * 0.98, g * 0.94]; });
  return _texCache[k] = _mkTex(_texCache._scv, rx || 2, ry || 2);
}
function texWood(rx, ry) {
  const k = 'w' + (rx || 1) + 'x' + (ry || 2); if (_texCache[k]) return _texCache[k];
  if (!_texCache._wcv) _texCache._wcv = _paint(256, (u, v) => { const plank = Math.floor(v * 5), f = (v * 5) % 1, seam = (f < 0.05 || f > 0.95) ? 0.55 : 1, grain = _fbm(u, v, plank * 13 + 1); let g = (0.66 + 0.3 * grain) * seam; g = Math.max(0, Math.min(1, g)) * 230; return [g, g * 0.95, g * 0.9]; });
  return _texCache[k] = _mkTex(_texCache._wcv, rx || 1, ry || 2);
}
// detail textures for organics / glowing FX — glow ones are bright-biased so the glow survives the multiply
function texCloth(rx, ry) {
  const k = 'cl' + (rx || 2) + 'x' + (ry || 2); if (_texCache[k]) return _texCache[k];
  if (!_texCache._clcv) _texCache._clcv = _paint(128, (u, v) => { const tt = 16, a = Math.abs(Math.sin(u * Math.PI * tt)), b = Math.abs(Math.sin(v * Math.PI * tt)), w = Math.max(a, b); let g = 0.62 + 0.3 * w + 0.06 * _fbm(u, v, 61); g = Math.max(0, Math.min(1, g)) * 230; return [g, g * 0.99, g * 0.97]; });
  return _texCache[k] = _mkTex(_texCache._clcv, rx || 2, ry || 2);
}
function texMetal(rx, ry) {
  const k = 'mt' + (rx || 1) + 'x' + (ry || 3); if (_texCache[k]) return _texCache[k];
  if (!_texCache._mtcv) _texCache._mtcv = _paint(128, (u, v) => { let g = 0.74 + 0.18 * _tileNoise(u, v, 64, 5) + 0.06 * _fbm(u, v, 6); g = Math.max(0, Math.min(1, g)) * 245; return [g, g, g]; });
  return _texCache[k] = _mkTex(_texCache._mtcv, rx || 1, ry || 3);
}
function texSkin(rx, ry) {
  const k = 'sk' + (rx || 1) + 'x' + (ry || 1); if (_texCache[k]) return _texCache[k];
  if (!_texCache._skcv) _texCache._skcv = _paint(128, (u, v) => { let g = 0.85 + 0.12 * _fbm(u, v, 9); g = Math.max(0, Math.min(1, g)) * 235; return [g, g * 0.98, g * 0.95]; });
  return _texCache[k] = _mkTex(_texCache._skcv, rx || 1, ry || 1);
}
function texCrystal(rx, ry) {
  const k = 'cr' + (rx || 1) + 'x' + (ry || 1); if (_texCache[k]) return _texCache[k];
  if (!_texCache._crcv) _texCache._crcv = _paint(128, (u, v) => { const n = _fbm(u, v, 12), edge = Math.abs(_tileNoise(u, v, 6, 13) - 0.5) < 0.06 ? 0.72 : 1; let g = (0.8 + 0.2 * n) * edge; g = Math.max(0, Math.min(1, g)) * 245; return [g, g, g]; });
  return _texCache[k] = _mkTex(_texCache._crcv, rx || 1, ry || 1);
}
function texLava(rx, ry) {
  const k = 'lv' + (rx || 2) + 'x' + (ry || 2); if (_texCache[k]) return _texCache[k];
  if (!_texCache._lvcv) _texCache._lvcv = _paint(128, (u, v) => { const n = _fbm(u, v, 30), crust = Math.abs(_fbm(u, v, 31) - 0.5) < 0.06 ? 0.5 : 1; let g = (0.82 + 0.18 * n) * crust; g = Math.max(0, Math.min(1, g)) * 250; return [g, g * 0.92, g * 0.85]; });
  return _texCache[k] = _mkTex(_texCache._lvcv, rx || 2, ry || 2);
}
function texWater(rx, ry) {
  const k = 'wt' + (rx || 2) + 'x' + (ry || 2); if (_texCache[k]) return _texCache[k];
  if (!_texCache._wtcv) _texCache._wtcv = _paint(128, (u, v) => { let g = 0.82 + 0.16 * _fbm(u, v, 41) + 0.04 * Math.sin((u + v) * Math.PI * 8); g = Math.max(0, Math.min(1, g)) * 240; return [g * 0.95, g * 0.98, g]; });
  return _texCache[k] = _mkTex(_texCache._wtcv, rx || 2, ry || 2);
}
function texEnergy(rx, ry) {
  const k = 'en' + (rx || 2) + 'x' + (ry || 1); if (_texCache[k]) return _texCache[k];
  if (!_texCache._encv) _texCache._encv = _paint(128, (u, v) => { const tt = 10; let g = 0.7 + 0.3 * Math.abs(Math.sin((u + v) * Math.PI * tt)); g = Math.max(0, Math.min(1, g)) * 250; return [g, g, g]; });
  return _texCache[k] = _mkTex(_texCache._encv, rx || 2, ry || 1);
}
function texFlame(rx, ry) {
  const k = 'fl' + (rx || 1) + 'x' + (ry || 1); if (_texCache[k]) return _texCache[k];
  if (!_texCache._flcv) _texCache._flcv = _paint(128, (u, v) => { let g = 0.84 + 0.16 * _fbm(u, v, 50); g = Math.max(0, Math.min(1, g)) * 252; return [g, g, g]; });
  return _texCache[k] = _mkTex(_texCache._flcv, rx || 1, ry || 1);
}
function texSpots(rx, ry) {
  const k = 'sp' + (rx || 1) + 'x' + (ry || 1); if (_texCache[k]) return _texCache[k];
  if (!_texCache._spcv) _texCache._spcv = _paint(128, (u, v) => { const cell = 5, gx = u * cell, gy = v * cell, cx = Math.floor(gx), cy = Math.floor(gy), px = gx - cx - 0.5, py = gy - cy - 0.5, d = Math.hypot(px, py); let g = (d < 0.26 ? 1.0 : 0.72); g = Math.max(0, Math.min(1, g)) * 245; return [g, g, g]; });
  return _texCache[k] = _mkTex(_texCache._spcv, rx || 1, ry || 1);
}

const groundGeo = new THREE.PlaneGeometry(MAP * 2, MAP * 2, 120, 120); const gpos = groundGeo.attributes.position;
for (let i = 0; i < gpos.count; i++) { const x = gpos.getX(i), y = gpos.getY(i); gpos.setZ(i, (Math.sin(x * 0.06) + Math.cos(y * 0.05)) * 0.8 + Math.sin(x * 0.2 + y * 0.13) * 0.3); }
groundGeo.computeVertexNormals();
/* Towns are authored FLAT (player + all scenery sit at y=0), but the shared ground keeps the wild heightfield -> flat
   roads/props bury or float on the bumps. Flatten the ground in town, restore the heightfield for wild/dungeon. */
const _groundZ0 = new Float32Array(gpos.count); for (let i = 0; i < gpos.count; i++) _groundZ0[i] = gpos.getZ(i);
let _groundFlat = null;
function setGroundFlat(flat) { if (_groundFlat === flat) return; _groundFlat = flat; for (let i = 0; i < gpos.count; i++) gpos.setZ(i, flat ? 0 : _groundZ0[i]); gpos.needsUpdate = true; groundGeo.computeVertexNormals(); }
groundGeo.setAttribute('uv1', groundGeo.attributes.uv); /* MeshStandardMaterial.aoMap samples a 2nd UV set (uv1); reuse the plane's uv */
/* bake per-region biome tint into vertex colors (seamless ground biomes; multiplied by texGround when vertexColors on) */
(() => {
  const col = new Float32Array(gpos.count * 3), c = new THREE.Color(), tmp = new THREE.Color();
  for (let i = 0; i < gpos.count; i++) {
    const x = gpos.getX(i), y = gpos.getY(i); const r = regionAt(x, y); c.setHex(r.groundCol);
    const r2 = regionAt(x * 1.05, y * 1.05); if (r2 !== r) { tmp.setHex(r2.groundCol); c.lerp(tmp, 0.5); }
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  groundGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
})();
/* Phase: PBR ground. MeshStandard so roughnessMap works AND the per-region HDRI lights the floor via IBL.
   All four map slots are populated from the start (white/flat placeholders for roughness/ao) so per-zone
   set swaps never change the node graph -> no pipeline recompile hitch at region boundaries (see the
   ground-texture block above). Procedural map/normal are the initial look + Low-tier fallback. */
const groundMat = new THREE.MeshStandardMaterial({ color: 0x3a2f22, roughness: 1.0, metalness: 0.0, vertexColors: false, map: texGround(30), normalMap: texGroundNormal(30), roughnessMap: _whitePx(), aoMap: _whitePx() }); groundMat.normalScale.set(0.7, 0.7);
const ground = new THREE.Mesh(groundGeo, groundMat); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

function makePortal(x, z, col) {
  const g = new THREE.Group(); const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.25, 10, 24), new THREE.MeshBasicMaterial({ color: col, map: texEnergy(3, 1) })); ring.position.y = 1.8; ring.rotation.x = Math.PI / 2.4; g.add(ring);
  const core = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, side: THREE.DoubleSide, map: texEnergy(1, 1) })); core.position.y = 1.8; core.rotation.x = Math.PI / 2.4; g.add(core);
  const lt = regLight(new THREE.PointLight(col, 1.6 * Math.PI, 20, 2)); lt.position.y = 2; g.add(lt); g.position.set(x, 0, z); return { group: g, ring, x, z };
}
function makeFire(x, z, grp, list, colliders, col) {
  const lc = col || 0xff7a2a, fc = col || 0xff9a3a; const light = regLight(new THREE.PointLight(lc, 1.6 * Math.PI, 34, 2)); light.position.set(x, 3, z); grp.add(light);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 6), new THREE.MeshBasicMaterial({ color: fc, map: texFlame(1, 1) })); flame.position.set(x, 2, z); grp.add(flame);
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2, 5), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x1a120a, map: texWood(1, 2) })); log.rotation.z = Math.PI / 2; log.position.set(x, 0.4, z); grp.add(log);
  list.push({ light, flame, base: light.intensity, x, z }); if (colliders) colliders.push({ x, z, r: 0.9 });
}
const waypointMarks = [];
function makeWaypoint(x, z, grp, colliders) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.7, 0.7, 8), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x4a4458, flatShading: true, map: texStone(2, 1) })); base.position.y = 0.35; base.receiveShadow = true; g.add(base);
  const ob = new THREE.Mesh(new THREE.ConeGeometry(0.95, 4.6, 4), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x39355a, flatShading: true, map: texStone(1, 2) })); ob.position.y = 2.8; ob.castShadow = true; g.add(ob);
  const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.72, 0), new THREE.MeshBasicMaterial({ color: 0x9fd0ff, map: texCrystal(1, 1) })); cr.position.y = 5.4; g.add(cr);
  const lt = regLight(new THREE.PointLight(0x6ab0ff, 1.7 * Math.PI, 24, 2)); lt.position.y = 5.4; g.add(lt);
  g.position.set(x, 0, z); grp.add(g); waypointMarks.push(cr); if (colliders) colliders.push({ x, z, r: 1.6 }); return { x, z, group: g };
}
// ---- ambient particles (embers / dust / motes) ----
const AMB = 170; const ambGeo = new THREE.BufferGeometry(); const ambPos = new Float32Array(AMB * 3);
for (let i = 0; i < AMB; i++) { ambPos[i * 3] = rand(-90, 90); ambPos[i * 3 + 1] = rand(0, 42); ambPos[i * 3 + 2] = rand(-90, 90); }
ambGeo.setAttribute('position', new THREE.BufferAttribute(ambPos, 3));
const ambMat = new THREE.PointsMaterial({ color: 0xff8a3a, size: 0.55, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending });
const ambient = new THREE.Points(ambGeo, ambMat); ambient.visible = false; scene.add(ambient); let ambMode = 'ember';
let _ambDir = 1, _ambSpd = 0.05; // re-enabled (perf pass had stubbed these); 170 additive points = a single draw call
function setAmbient(mode, col) {
  ambMode = mode; if (col != null) ambMat.color.setHex(col); ambient.visible = true;
  if (mode === 'snow') { _ambDir = -1; _ambSpd = 0.06; ambMat.size = 0.7; }
  else if (mode === 'ember' || mode === 'rune') { _ambDir = 1; _ambSpd = 0.05; ambMat.size = 0.5; }
  else { _ambDir = 1; _ambSpd = 0.02; ambMat.size = 0.55; }
}
function updateAmbient(dt) {
  if (!ambient.visible) return; const p = ambPos, v = _ambDir * _ambSpd * dt;
  for (let i = 0; i < AMB; i++) { let y = p[i * 3 + 1] + v; if (y > 42) y -= 42; else if (y < 0) y += 42; p[i * 3 + 1] = y; }
  ambGeo.attributes.position.needsUpdate = true;
}

/* ---- WILD scenery. Each biome is its OWN bounded map (origin-centered, radius WILD_R), entered via a portal and
   rebuilt on every entry like a dungeon — so only ONE region's scenery is ever resident (lower draw-calls/memory,
   load-gated transitions). Persistent fixtures (portals + a fixed campfire pool, all 'static' lights created once)
   live directly on wildGroup and are only recolored/toggled per biome → zero light-budget churn. Only the
   light-less nature props are disposed & rebuilt into wildSceneryGroup by buildWild(). ---- */
const wildGroup = new THREE.Group(); wildGroup.visible = false; scene.add(wildGroup);
const wildSceneryGroup = new THREE.Group(); wildGroup.add(wildSceneryGroup);
const wildFires = [];
/* Resident region scenery cache (mirrors the dungeon biome cache): each wild region's scenery is built once into
   its own sub-group and kept resident; portal re-entry toggles .visible + re-randomizes the instanced props (no
   dispose → pipelines stay warm, ~tens of ms vs a ~2.7s rebuild-recompile). Rebuilt (not toggled) if the cached
   version was the pre-kit procedural fallback, so real models swap in once nature.glb loads. */
const wildRegionCache = new Map(); // region.id -> sub group (userData.scatterIMs, userData.kit)
function _wildScatterPoint() { for (let t = 0; t < 8; t++) { const ang = rand(0, 6.283), d = Math.sqrt(rand(144, (WILD_R - 8) ** 2)), x = Math.cos(ang) * d, z = Math.sin(ang) * d; if ((x - WILD_SPAWN.x) ** 2 + (z - WILD_SPAWN.z) ** 2 < 256) continue; return { x, z }; } return { x: 0, z: 0 }; }
function _rescatterWild(sub) {
  for (const im of sub.userData.scatterIMs) {
    const tf = [];
    for (const m of im.userData.scatterMeta) { const p = _wildScatterPoint(); tf.push({ x: p.x, z: p.z, ry: rand(0, 6), sx: m.s, sy: m.s, sz: m.s, cr: m.cr }); }
    _imSetTF(im, tf);
    for (const t of tf) if (t.cr != null) wildColliders.push({ x: t.x, z: t.z, r: t.cr });
  }
}
function buildWildScenery(region) {
  region = region || curRegion || REGIONS[0];
  for (const s of wildRegionCache.values()) s.visible = false;
  let sub = wildRegionCache.get(region.id);
  if (sub && sub.userData.kit && PROPS_READY) { sub.visible = true; _rescatterWild(sub); return; } /* cached kit version: toggle + fresh scatter, no recompile */
  if (sub) clearGroup(sub); else { sub = new THREE.Group(); sub.name = 'wregion:' + region.id; wildSceneryGroup.add(sub); wildRegionCache.set(region.id, sub); }
  sub.visible = true; sub.userData.scatterIMs = []; sub.userData.kit = PROPS_READY;
  _fillWildScenery(sub, region);
  if (sub.userData.kit) _rescatterWild(sub); /* kit path owns its scatter colliders (built fresh here); fallback pushes them inline */
}
function _fillWildScenery(sub, region) {
  region = region || curRegion || REGIONS[0];
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
  const rid = region.id, tint = WILD_TINT[rid];
  const has = n => PROPS_READY && PROP_PROTO[n];
  const kitTrees = (region.trees || []).filter(has), kitBushes = (region.bushes || []).filter(has), kitGrass = (region.grasses || []).filter(has), kitRocks = (region.rocks || []).filter(has);
  const natMat = v => tint ? tintPropMat(PROP_PROTO[v].mat, tint) : PROP_PROTO[v].mat;
  const build = (geo, mat, tf, opts) => {
    if (!tf.length) return;
    const im = new THREE.InstancedMesh(geo, mat, tf.length); im.castShadow = !!(opts && opts.cast); im.receiveShadow = !!(opts && opts.recv);
    for (let i = 0; i < tf.length; i++) { const t = tf[i]; E.set(t.rx || 0, t.ry || 0, t.rz || 0); Q.setFromEuler(E); V.set(t.x, t.y || 0, t.z); S.set(t.sx || 1, t.sy || 1, t.sz || 1); M.compose(V, Q, S); im.setMatrixAt(i, M); }
    im.instanceMatrix.needsUpdate = true; im.frustumCulled = false;
    if (opts && opts.scatter) { im.userData.scatterMeta = tf.map(t => ({ s: t.sx != null ? t.sx : 1, cr: t.cr != null ? t.cr : null })); sub.userData.scatterIMs.push(im); } /* tagged for _rescatterWild */
    sub.add(im);
  };
  // scatter n points across the playable disc, kept clear of the spawn apron
  const scatter = n => { const a = []; let tries = 0; const cap = n * 4; while (a.length < n && tries < cap) { tries++; const ang = rand(0, 6.283), d = Math.sqrt(rand(12 * 12, (WILD_R - 8) * (WILD_R - 8))), x = Math.cos(ang) * d, z = Math.sin(ang) * d; if ((x - WILD_SPAWN.x) ** 2 + (z - WILD_SPAWN.z) ** 2 < 16 * 16) continue; a.push({ x, z }); } return a; };
  const dn = region.dens || {}, dc = REGION_DECO[rid] || REGION_DECO.greenwilds;
  // rocks (collider) — KayKit Rock variants, procedural fallback
  {
    const pts = scatter(dn.rock || 50);
    if (kitRocks.length) {
      const bk = {}; for (const v of kitRocks) bk[v] = [];
      for (let i = 0; i < pts.length; i++) { const p = pts[i], v = kitRocks[i % kitRocks.length], ts = rand(0.9, 2.8), s = ts / PROP_PROTO[v].base; bk[v].push({ x: p.x, y: 0, z: p.z, ry: rand(0, 6), sx: s, sy: s, sz: s, cr: Math.max(PROP_PROTO[v].size.x, PROP_PROTO[v].size.z) * s * 0.5 }); }
      for (const v of kitRocks) build(PROP_PROTO[v].geo, natMat(v), bk[v], { recv: true, scatter: true });
    } else {
      const T = []; for (const p of pts) { const s = rand(0.8, 2.6); T.push({ x: p.x, y: s * 0.5, z: p.z, rx: rand(0, 6), ry: rand(0, 6), rz: rand(0, 6), sx: s, sy: s, sz: s }); wildColliders.push({ x: p.x, z: p.z, r: s * 0.9 }); }
      build(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshPhongMaterial({ specular: 0x000000, color: dc.rock, flatShading: true, map: texStone(2, 2) }), T, { recv: true });
    }
  }
  // trees (collider) — KayKit Tree / Tree_Bare variants, procedural fallback
  {
    const pts = scatter(dn.tree || 50);
    if (kitTrees.length) {
      const bk = {}; for (const v of kitTrees) bk[v] = [];
      for (let i = 0; i < pts.length; i++) { const p = pts[i], v = kitTrees[i % kitTrees.length], h = rand(7, 12), s = h / PROP_PROTO[v].base; bk[v].push({ x: p.x, y: 0, z: p.z, ry: rand(0, 6), sx: s, sy: s, sz: s, cr: 1.3 }); }
      for (const v of kitTrees) build(PROP_PROTO[v].geo, natMat(v), bk[v], { cast: true, scatter: true });
    } else {
      const TR = [], BR = [], FO = [];
      for (const p of pts) {
        const x = p.x, z = p.z, h = rand(7, 12); TR.push({ x, y: h / 2, z, sy: h });
        for (let b = 0; b < 3; b++) { const bh = rand(2, 4); BR.push({ x, y: h * rand(.5, .9), z, rz: rand(-1, 1), ry: rand(0, 6), sy: bh }); }
        for (let f = 0; f < 3; f++) { const s = rand(1.8, 3.2); FO.push({ x: x + rand(-1.2, 1.2), y: h * rand(0.78, 1.02), z: z + rand(-1.2, 1.2), ry: rand(0, 6), sx: s, sy: s * rand(0.8, 1.1), sz: s }); }
        wildColliders.push({ x, z, r: 1.3 });
      }
      build(new THREE.CylinderGeometry(0.4, 0.7, 1, 5), new THREE.MeshPhongMaterial({ specular: 0x000000, color: dc.trunk, flatShading: true, map: texWood(1, 3) }), TR, { cast: true });
      build(new THREE.CylinderGeometry(0.12, 0.3, 1, 4), new THREE.MeshPhongMaterial({ specular: 0x000000, color: dc.trunk, flatShading: true, map: texWood(1, 3) }), BR, {});
      build(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshPhongMaterial({ specular: 0x000000, color: dc.foliage, flatShading: true, map: texSpots(1, 1) }), FO, { cast: true });
    }
  }
  // bushes (no collider)
  {
    const pts = scatter(dn.bush || 80);
    if (kitBushes.length) {
      const bk = {}; for (const v of kitBushes) bk[v] = [];
      for (let i = 0; i < pts.length; i++) { const p = pts[i], v = kitBushes[i % kitBushes.length], hgt = rand(0.8, 1.7), s = hgt / PROP_PROTO[v].base; bk[v].push({ x: p.x, y: 0, z: p.z, ry: rand(0, 6), sx: s, sy: s, sz: s }); }
      for (const v of kitBushes) build(PROP_PROTO[v].geo, natMat(v), bk[v], { cast: true, scatter: true });
    } else {
      const B = [];
      for (const p of pts) { const n = 2 + randi(0, 1), s0 = rand(0.5, 0.95); for (let k = 0; k < n; k++) { const s = s0 * (1 - k * 0.2); B.push({ x: p.x + rand(-0.4, 0.4), y: 0.4 + k * 0.34 * s0, z: p.z + rand(-0.4, 0.4), ry: rand(0, 6), sx: s, sy: s, sz: s }); } }
      build(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshPhongMaterial({ specular: 0x000000, color: dc.foliage, flatShading: true, map: texSpots(1, 1) }), B, { cast: true });
    }
  }
  // grass tufts (no collider) — KayKit Grass variants, procedural blade fallback
  {
    const pts = scatter(dn.grass || 150);
    if (kitGrass.length) {
      const bk = {}; for (const v of kitGrass) bk[v] = [];
      for (let i = 0; i < pts.length; i++) { const p = pts[i], v = kitGrass[i % kitGrass.length], hgt = rand(0.5, 1.1), s = hgt / PROP_PROTO[v].base; bk[v].push({ x: p.x, y: 0, z: p.z, ry: rand(0, 6), sx: s, sy: s, sz: s }); }
      for (const v of kitGrass) build(PROP_PROTO[v].geo, natMat(v), bk[v], { scatter: true });
    } else {
      const T = []; for (const p of pts) T.push({ x: p.x, y: 0.5, z: p.z, ry: rand(0, 6) });
      build(new THREE.ConeGeometry(0.32, 1.1, 4), new THREE.MeshPhongMaterial({ specular: 0x000000, color: dc.grass, flatShading: true }), T, {});
    }
  }
  // flowers (no collider) — tiny emissive dots that read as 'alive'
  {
    const pts = scatter(dn.flower || 80), fc = dc.flower, T = [];
    for (const p of pts) T.push({ x: p.x + rand(-0.3, 0.3), y: 0.5, z: p.z + rand(-0.3, 0.3) });
    build(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshBasicMaterial({ color: fc }), T, {});
  }
  // mushrooms (no collider) — glowing caps
  {
    const pts = scatter(dn.mush || 40), ST = [], CT = [];
    for (const p of pts) { ST.push({ x: p.x, y: 0.3, z: p.z }); CT.push({ x: p.x, y: 0.62, z: p.z }); }
    build(new THREE.CylinderGeometry(0.08, 0.13, 0.6, 5), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0xcfc2a0 }), ST, {});
    build(new THREE.SphereGeometry(0.3, 8, 6, 0, 6.28, 0, 1.5), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x6ad8ff, emissive: 0x2a7a9a, emissiveIntensity: .9, flatShading: true, map: texSpots(1, 1) }), CT, {});
  }
}
const WILD_TINT = { greenwilds: null, frostfen: 0xc2d2e0, ashlands: 0xcea284 };  /* near-white multipliers over the natural KayKit nature atlas */
const WILD_SPAWN = { x: 0, z: 30 };  /* player drop point on every wild entry (just inside the town-return portal) */
// world-space ground height (matches the gentle heightfield the shared ground plane is built with)
function groundH(x, z) { return (Math.sin(x * 0.06) + Math.cos(z * 0.05)) * 0.8 + Math.sin(x * 0.2 - z * 0.13) * 0.3; }
/* persistent campfire pool: a fixed ring reused by every biome (recolored per region in themeWild). Its lights are
   created ONCE under the 'static' bucket, so re-entering a biome never churns the PL_MAX light budget. Colliders are
   re-pushed each buildWild (which resets wildColliders). */
const WILD_FIRE_SPOTS = [];
for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283 + 0.4, d = 42 + (i % 3) * 30; WILD_FIRE_SPOTS.push({ x: Math.cos(a) * d, z: Math.sin(a) * d }); }
for (const s of WILD_FIRE_SPOTS) makeFire(s.x, s.z, wildGroup, wildFires, null);
/* persistent portals: fixed anchors whose DESTINATIONS are read from curRegion at interaction time. Town + cave are
   always present; next/prev just toggle visibility per biome (see buildWild). */
function _placePortal(p) { p.group.position.y = groundH(p.x, p.z); wildGroup.add(p.group); return p; }
const wpTown = _placePortal(makePortal(0, 64, 0x9f6aff));    // back to the adjoining town
const wpCave = _placePortal(makePortal(52, -14, 0xff8a3a));  // down into the dungeon (depth 1)
const wpNext = _placePortal(makePortal(0, -126, 0xbcd0ff));  // onward to the next biome
const wpPrev = _placePortal(makePortal(-124, 6, 0x9ad86a));  // back to the previous biome
const w_waypoint = makeWaypoint(-24, 18, wildGroup, null); w_waypoint.group.position.y = groundH(w_waypoint.x, w_waypoint.z);  // fast-travel hub; collider re-added per entry
function buildWild(region) {
  region = region || curRegion || REGIONS[0];
  wildColliders.length = 0; /* region scenery persists in wildRegionCache; buildWildScenery toggles + re-scatters */
  wildColliders.push({ x: w_waypoint.x, z: w_waypoint.z, r: 1.6 });
  for (const s of WILD_FIRE_SPOTS) wildColliders.push({ x: s.x, z: s.z, r: 0.9 });
  wpNext.group.visible = !!region.next; wpPrev.group.visible = !!region.prev;
  buildWildScenery(region);
}

/* rebuild whichever populated zone we're standing in when async assets (roster / prop kits / buildings) finish
   loading — so e.g. nature.glb arriving while you're in the wild swaps the procedural fallback for real models. */
function rebuildZoneScenery() {
  if (typeof zone === 'undefined') return;
  _menuShadowDirty = true; /* scenery changed — the menu's otherwise-static shadow map needs one refresh */
  try { if (zone === 'town') buildTown(curTownArea); else if (zone === 'wild') buildWild(curRegion); }
  catch (e) { console.warn('zone scenery rebuild failed:', e && e.message); }
}

/* ---- TOWN scenery ---- */
const townGroup = new THREE.Group(); townGroup.visible = false; scene.add(townGroup); const townFires = []; const npcs = [];
// Per-town scenery lives here and is rebuilt on every town entry by buildTown() (see below); persistent
// objects (NPCs, portal, waypoint, cauldron) stay on townGroup and are only repositioned per town.
const townSceneryGroup = new THREE.Group(); townGroup.add(townSceneryGroup);
/* skinned/animated town actors (decorative idling villagers) live OUTSIDE townSceneryGroup so they're never merged; rebuilt per buildTown */
const townActorsGroup = new THREE.Group(); townGroup.add(townActorsGroup); const townVillagers = [];
function makeNPC(kind, x, z, col, iconColor, noCol) {
  const g = new THREE.Group(); const procBody = new THREE.Group(); g.add(procBody); g.userData.procBody = procBody; const body = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3, 8), new THREE.MeshPhongMaterial({ specular: 0x000000, color: col, flatShading: true, map: texCloth(2, 2) })); body.position.y = 1.5; body.castShadow = true; procBody.add(body);
  const armGeo = new THREE.CylinderGeometry(0.13, 0.16, 1.2, 5), armMat = new THREE.MeshPhongMaterial({ specular: 0x000000, color: col, flatShading: true, map: texCloth(1, 2) }); const aL = new THREE.Mesh(armGeo, armMat); aL.position.set(-0.55, 1.7, 0.12); aL.rotation.z = 0.22; procBody.add(aL); const aR = new THREE.Mesh(armGeo, armMat); aR.position.set(0.55, 1.7, 0.12); aR.rotation.z = -0.22; procBody.add(aR);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0xc9a36a, map: texSkin(1, 1) })); head.position.y = 3.1; head.castShadow = true; procBody.add(head);
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), new THREE.MeshBasicMaterial({ color: iconColor })); marker.position.y = 4.6; g.add(marker); g.userData.marker = marker;
  if (kind === 'stash') { const chest = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 1.3), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x6a4420, flatShading: true, map: texWood(2, 1) })); chest.position.set(0, 0.6, 1.8); chest.castShadow = true; g.add(chest); }
  if (kind === 'smith') { const anvilBase = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.7), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x2a2630, flatShading: true, map: texStone(1, 1) })); anvilBase.position.set(0, 0.35, 1.9); g.add(anvilBase); const anvil = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.9), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x44424c, flatShading: true, map: texStone(2, 1) })); anvil.position.set(0, 0.95, 1.9); anvil.castShadow = true; g.add(anvil); }
  if (kind === 'alchemist') { const tbl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 0.95), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x4a3a26, flatShading: true, map: texWood(2, 1) })); tbl.position.set(0, 0.6, 1.9); tbl.castShadow = true; g.add(tbl); const bcols = [0x6affa6, 0xff6a8a, 0x6a9aff]; for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 0.55, 7), new THREE.MeshPhongMaterial({ specular: 0x223344, color: bcols[i], emissive: bcols[i], emissiveIntensity: 0.5, flatShading: true })); b.position.set(-0.5 + i * 0.5, 1.16, 1.9); g.add(b); } }
  g.position.set(x, 0, z); townGroup.add(g); npcs.push({ kind, x, z, group: g }); if (!noCol) townColliders.push({ x, z, r: 1.2 });
}
makeNPC('vendor', -12, 2, 0x6a3a8a, 0x9f6aff); makeNPC('stash', 12, 2, 0x3a6a4a, 0xffd24d); makeNPC('smith', 12, -8, 0x5a4a3a, 0xff8a3a);
makeNPC('enchanter', -20, -4, 0x4a3a6a, 0x9f6aff, true); makeNPC('gambler', 20, -4, 0x6a5a2a, 0xffd24d, true); makeNPC('jeweler', -18, 9, 0x2a5a5a, 0x6affd0, true); makeNPC('premiumVendor', 18, 9, 0x6a2a4a, 0xff6ad0, true);
makeNPC('alchemist', -6, -12, 0x2a6a4a, 0x6affa6, true);
const NPC_TOWNS = { vendor: ['town', 'highreach', 'emberhold'], stash: ['town', 'highreach', 'emberhold'], smith: ['town', 'highreach', 'emberhold'], alchemist: ['town', 'highreach', 'emberhold'], enchanter: ['town', 'highreach', 'emberhold'], gambler: ['highreach', 'emberhold'], jeweler: ['emberhold'], premiumVendor: ['emberhold'] };
for (const _n of npcs) { _n.towns = NPC_TOWNS[_n.kind] || ['town', 'highreach', 'emberhold']; }
const t_wildPortal = makePortal(0, -14, 0x6affa0); townGroup.add(t_wildPortal.group); // town -> wild
function makeCauldron(x, z) {
  const g = new THREE.Group();
  const ironMat = new THREE.MeshPhongMaterial({ specular: 0x111119, color: 0x262329, flatShading: true, map: texMetal(2, 2) });
  const legGeo = new THREE.CylinderGeometry(0.12, 0.17, 0.95, 6);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5; const leg = new THREE.Mesh(legGeo, ironMat); leg.position.set(Math.cos(a) * 0.72, 0.46, Math.sin(a) * 0.72); leg.castShadow = true; g.add(leg); }
  const pot = new THREE.Mesh(new THREE.SphereGeometry(1.18, 18, 14), ironMat); pot.scale.set(1, 0.9, 1); pot.position.y = 1.4; pot.castShadow = true; g.add(pot);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.04, 0.17, 8, 22), ironMat); rim.rotation.x = Math.PI / 2; rim.position.y = 2.05; rim.castShadow = true; g.add(rim);
  const brew = new THREE.Mesh(new THREE.CircleGeometry(0.97, 22), new THREE.MeshBasicMaterial({ color: 0x5affa6, map: texWater(2, 2) })); brew.rotation.x = -Math.PI / 2; brew.position.y = 2.02; g.add(brew);
  const lt = regLight(new THREE.PointLight(0x55ffa0, 1.1 * Math.PI, 18, 2)); lt.position.set(0, 2.5, 0); g.add(lt);
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), new THREE.MeshBasicMaterial({ color: 0x9affc8 })); marker.position.y = 3.4; g.add(marker);
  g.position.set(x, 0, z); townGroup.add(g); townColliders.push({ x, z, r: 1.4 });
  return { x, z, group: g, marker, brew };
}
const t_cauldron = makeCauldron(-12, -8);
const t_waypoint = makeWaypoint(-9, 6, townGroup, townColliders);

/* ---- TOWN building/prop kit — every helper draws into townSceneryGroup and pushes townColliders ---- */
/* place a KayKit building: clone the proto node (bake its world transform), wrap in a group scaled to a target
   footprint with base re-based to y=0. Multi-material; merges into townSceneryGroup by color. */
function placeBuilding(name, x, z, rotY, footprint) {
  const p = BUILDING_PROTO[name]; if (!p) return null;
  const s = footprint / Math.max(p.size.x, p.size.z, 0.01);
  const inner = p.node.clone(true);
  p.node.updateWorldMatrix(true, false); inner.matrix.copy(p.node.matrixWorld); inner.matrix.decompose(inner.position, inner.quaternion, inner.scale);
  inner.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const g = new THREE.Group(); g.add(inner); g.scale.setScalar(s); g.position.set(x, -p.minY * s, z); g.rotation.y = rotY || 0;
  townSceneryGroup.add(g); townColliders.push({ x, z, r: Math.max(p.size.x, p.size.z) * s * 0.42 });
  return g;
}
function tHouse(x, z, w, h, wallCol, roofCol, o) {
  o = o || {};
  if (BUILDINGS_READY) {
    const pool = o.stone ? ['barracks', 'mine', 'market', 'mill', 'watchtower'] : ['house', 'lumbermill', 'market', 'mill', 'archeryrange'];
    const name = pool[Math.abs(Math.round(x * 13) + Math.round(z * 7)) % pool.length];
    const rot = (o.rot != null) ? o.rot : Math.atan2(-x, -z);
    if (placeBuilding(name, x, z, rot, Math.max(6, Math.min(12, w)))) return;
  }
  const dep = w * (o.dep || 1); const g = new THREE.Group();
  const wallTex = o.stone ? texStone(2, 2) : texWood(2, 2);
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, dep), new THREE.MeshPhongMaterial({ specular: 0x000000, color: wallCol, flatShading: true, map: wallTex })); body.position.y = h / 2; body.castShadow = body.receiveShadow = true; g.add(body);
  if (o.stories === 2) { const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.25, dep + 0.1), new THREE.MeshPhongMaterial({ specular: 0x000000, color: roofCol, flatShading: true, map: texWood(2, 1) })); band.position.y = h * 0.52; g.add(band); }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, dep) * 0.8, h * (o.roofH || 0.62), 4), new THREE.MeshPhongMaterial({ specular: 0x000000, color: roofCol, flatShading: true, map: o.stone ? texStone(3, 2) : texWood(3, 2) })); roof.position.y = h + h * (o.roofH || 0.62) * 0.5; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(w * 0.26, h * 0.42, 0.16), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x241810, map: texWood(1, 2) })); door.position.set(0, h * 0.21, dep / 2 + 0.03); g.add(door);
  const wmat = new THREE.MeshBasicMaterial({ color: o.win || 0xffd27a }), wg = new THREE.BoxGeometry(w * 0.16, w * 0.16, 0.12);
  const rows = o.stories === 2 ? [h * 0.32, h * 0.72] : [h * 0.6];
  for (const wy of rows) for (const wx of [-w * 0.28, w * 0.28]) { const wd = new THREE.Mesh(wg, wmat); wd.position.set(wx, wy, dep / 2 + 0.04); g.add(wd); }
  if (o.chimney) { const ch = new THREE.Mesh(new THREE.BoxGeometry(w * 0.16, h * 0.55, w * 0.16), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x3a3026, map: texStone(1, 2) })); ch.position.set(w * 0.26, h + h * 0.32, dep * 0.18); ch.castShadow = true; g.add(ch); }
  g.position.set(x, 0, z); if (o.rot) g.rotation.y = o.rot; townSceneryGroup.add(g); townColliders.push({ x, z, r: Math.max(w, dep) * 0.62 });
}
function tTower(x, z, r, h, col, o) {
  o = o || {};
  if (BUILDINGS_READY) {
    const name = (r >= 3 || h >= 13) ? 'castle' : 'watchtower';
    if (placeBuilding(name, x, z, Math.atan2(-x, -z), Math.max(4, r * 2.2))) return;
  }
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, h, 10), new THREE.MeshPhongMaterial({ specular: 0x000000, color: col, flatShading: true, map: texStone(2, 3) })); body.position.y = h / 2; body.castShadow = true; g.add(body);
  if (o.crenel) { const cm = new THREE.MeshPhongMaterial({ specular: 0x000000, color: col, flatShading: true, map: texStone(1, 1) }); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; const b = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.55), cm); b.position.set(Math.cos(a) * r, h + 0.4, Math.sin(a) * r); g.add(b); } }
  else { const roof = new THREE.Mesh(new THREE.ConeGeometry(r * 1.3, h * 0.5, 8), new THREE.MeshPhongMaterial({ specular: 0x000000, color: o.roof || 0x5a2a3a, flatShading: true, map: texWood(2, 2) })); roof.position.y = h + h * 0.25; roof.castShadow = true; g.add(roof); }
  for (const wy of [h * 0.4, h * 0.66, h * 0.86]) { const wd = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.12), new THREE.MeshBasicMaterial({ color: o.win || 0xffd27a })); wd.position.set(0, wy, r + 0.02); g.add(wd); }
  g.position.set(x, 0, z); townSceneryGroup.add(g); townColliders.push({ x, z, r: r + 0.4 });
}
function tWell(x, z) { if (BUILDINGS_READY && placeBuilding('well', x, z, rand(0, 6), 3.4)) return; const g = new THREE.Group(); const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 1.0, 12), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x6a6258, flatShading: true, map: texStone(2, 1) })); ring.position.y = 0.5; ring.castShadow = true; g.add(ring); const wtr = new THREE.Mesh(new THREE.CircleGeometry(0.92, 14), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x2a6a9a, emissive: 0x0a2a3a, map: texWater(1, 1) })); wtr.rotation.x = -Math.PI / 2; wtr.position.y = 0.86; g.add(wtr); const pm = new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x4a3a26, map: texWood(1, 2) }); for (const px of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.4, 5), pm); p.position.set(px, 1.7, 0); g.add(p); } const roof = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.0, 4), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x5a2418, flatShading: true, map: texWood(2, 1) })); roof.position.y = 3.1; roof.rotation.y = Math.PI / 4; g.add(roof); g.position.set(x, 0, z); townSceneryGroup.add(g); townColliders.push({ x, z, r: 1.3 }); }
function tFountain(x, z) { const g = new THREE.Group(); const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.1, 1, 16), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x6a6258, flatShading: true, map: texStone(2, 1) })); basin.position.y = 0.5; basin.receiveShadow = true; g.add(basin); const water = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.3, 16), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x2a6a9a, emissive: 0x0a2a3a, map: texWater(2, 2) })); water.position.y = 0.95; g.add(water); const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 2.2, 8), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x6a6258, map: texStone(1, 1) })); spout.position.y = 1.9; g.add(spout); g.position.set(x, 0, z); townSceneryGroup.add(g); townColliders.push({ x, z, r: 3.2 }); }
function tTree(x, z, s, leaf) { s = s || 1; const g = new THREE.Group(); const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.32 * s, 2.4 * s, 6), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x4a3420, flatShading: true, map: texWood(1, 2) })); trunk.position.y = 1.2 * s; trunk.castShadow = true; g.add(trunk); const lm = new THREE.MeshPhongMaterial({ specular: 0x000000, color: leaf || 0x2f5a2a, flatShading: true }); for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry((1.4 - i * 0.3) * s, 1.6 * s, 7), lm); c.position.y = (2.5 + i * 0.9) * s; c.castShadow = true; g.add(c); } g.position.set(x, 0, z); townSceneryGroup.add(g); townColliders.push({ x, z, r: 0.6 * s }); }
function tBarrel(x, z) { const p = PROPS_READY && PROP_PROTO['barrel_large']; if (p) { const s = 1.5 / p.base, m = new THREE.Mesh(p.geo, p.mat); m.position.set(x, 0, z); m.rotation.y = rand(0, 6); m.scale.setScalar(s); m.castShadow = true; townSceneryGroup.add(m); townColliders.push({ x, z, r: Math.max(p.size.x, p.size.z) * s * 0.5 }); return; } const b = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 1.0, 9), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x6a4a28, flatShading: true, map: texWood(1, 1) })); b.position.set(x, 0.5, z); b.castShadow = true; townSceneryGroup.add(b); townColliders.push({ x, z, r: 0.5 }); }
function tCrate(x, z) { const p = PROPS_READY && (PROP_PROTO['box_large'] || PROP_PROTO['crates_stacked']); if (p) { const s = 1.4 / p.base, m = new THREE.Mesh(p.geo, p.mat); m.position.set(x, 0, z); m.rotation.y = rand(0, 6); m.scale.setScalar(s); m.castShadow = true; townSceneryGroup.add(m); townColliders.push({ x, z, r: Math.max(p.size.x, p.size.z) * s * 0.5 }); return; } const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x5a4226, flatShading: true, map: texWood(1, 1) })); b.rotation.y = rand(0, 1.5); b.position.set(x, 0.45, z); b.castShadow = true; townSceneryGroup.add(b); townColliders.push({ x, z, r: 0.6 }); }
function tStall(x, z, col) { const g = new THREE.Group(); const pm = new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x4a3a26, map: texWood(1, 2) }); for (const px of [-1, 1]) for (const pz of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 5), pm); p.position.set(px, 1.1, pz * 0.7); g.add(p); } const awn = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.14, 1.9), new THREE.MeshPhongMaterial({ specular: 0x000000, color: col || 0xc0402a, flatShading: true, map: texCloth(2, 1) })); awn.position.y = 2.3; awn.rotation.x = 0.1; g.add(awn); const tbl = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 1.4), pm); tbl.position.y = 1.0; g.add(tbl); g.position.set(x, 0, z); townSceneryGroup.add(g); townColliders.push({ x, z, r: 1.3 }); }
function tFence(x1, z1, x2, z2) { const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), n = Math.max(1, Math.round(len / 1.7)), pm = new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x4a3826, flatShading: true, map: texWood(1, 2) }); for (let i = 0; i <= n; i++) { const t = i / n, p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.16), pm); p.position.set(x1 + dx * t, 0.55, z1 + dz * t); townSceneryGroup.add(p); } const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.1), pm); rail.position.set((x1 + x2) / 2, 0.82, (z1 + z2) / 2); rail.rotation.y = Math.atan2(dz, dx); townSceneryGroup.add(rail); }
function tBanner(x, z, col) { const c = col || 0x8a2030; if (PROPS_READY) { const cr = (c >> 16) & 255, cg = (c >> 8) & 255, cb = c & 255; const name = (cr >= cg && cr >= cb) ? 'banner_red' : (cb >= cr && cb >= cg) ? 'banner_blue' : 'banner_green'; const p = PROP_PROTO[name]; if (p) { const s = 4.0 / p.base, m = new THREE.Mesh(p.geo, p.mat); m.position.set(x, 0, z); m.rotation.y = rand(0, 6); m.scale.setScalar(s); m.castShadow = true; townSceneryGroup.add(m); townColliders.push({ x, z, r: 0.3 }); return; } } const g = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.2, 6), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x2a2218, map: texWood(1, 3) })); pole.position.y = 2.1; g.add(pole); const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.7, 1.0), new THREE.MeshPhongMaterial({ specular: 0x000000, color: col || 0x8a2030, flatShading: true, map: texCloth(1, 1), side: THREE.DoubleSide })); cloth.position.set(0, 3.0, 0.55); g.add(cloth); g.position.set(x, 0, z); townSceneryGroup.add(g); townColliders.push({ x, z, r: 0.3 }); }
function tLamp(x, z, col) { const g = new THREE.Group(); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 3.6, 6), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x2a2218, map: texWood(1, 3) })); post.position.y = 1.8; g.add(post); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 8), new THREE.MeshBasicMaterial({ color: col || 0xffd27a })); bulb.position.y = 3.7; g.add(bulb); const lt = regLight(new THREE.PointLight(col || 0xffc060, 0.9 * Math.PI, 20, 2)); lt.position.y = 3.9; g.add(lt); g.position.set(x, 0, z); townSceneryGroup.add(g); townColliders.push({ x, z, r: 0.3 }); }
function tBrazier(x, z, col) { const g = new THREE.Group(); const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.42, 1.7, 7), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x2a2026, flatShading: true, map: texMetal(1, 1) })); stand.position.y = 0.85; g.add(stand); const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.4, 0.5, 9), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x2a2026, flatShading: true, map: texMetal(1, 1) })); bowl.position.y = 1.8; g.add(bowl); const fire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 6), new THREE.MeshBasicMaterial({ color: col || 0xff7a2a, map: texFlame(1, 1) })); fire.position.y = 2.4; g.add(fire); const lt = regLight(new THREE.PointLight(col || 0xff6a20, 1.4 * Math.PI, 24, 2)); lt.position.y = 2.5; g.add(lt); g.position.set(x, 0, z); townSceneryGroup.add(g); townColliders.push({ x, z, r: 0.5 }); townFires.push({ light: lt, flame: fire, base: lt.intensity, x, z }); }
function tLavaPool(x, z, r) { const p = new THREE.Mesh(new THREE.CircleGeometry(r || 2, 16), new THREE.MeshBasicMaterial({ color: 0xff4a18, map: texLava(2, 2) })); p.rotation.x = -Math.PI / 2; p.position.set(x, 0.06, z); townSceneryGroup.add(p); const lt = regLight(new THREE.PointLight(0xff5020, 0.7 * Math.PI, 16, 2)); lt.position.set(x, 1.2, z); townSceneryGroup.add(lt); }
function tPath(x, z, w, l, rot, col) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, l), _pavedMat(w, l, col || 0x9c8b6e)); p.rotation.x = -Math.PI / 2; if (rot) p.rotation.z = rot; p.position.set(x, 0.04, z); p.receiveShadow = true; townSceneryGroup.add(p); }
function tWall(x, z, len, horiz, col) { const w = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : 1.0, 2.6, horiz ? 1.0 : len), new THREE.MeshPhongMaterial({ specular: 0x000000, color: col || 0x55606e, flatShading: true, map: texStone(horiz ? Math.round(len / 2) : 2, 2) })); w.position.set(x, 1.3, z); w.castShadow = true; townSceneryGroup.add(w); }
/* a paved plaza slab (cobble look via grey-tinted stone tex); sits just under tPath so road crossings read on top */
function tPlaza(x, z, w, l, col) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, l), _pavedMat(w, l, col || 0x6b6b64)); p.rotation.x = -Math.PI / 2; p.position.set(x, 0.02, z); p.receiveShadow = true; townSceneryGroup.add(p); }
/* shared-proto prop mesh at a target HEIGHT (mirrors tBarrel); merges into townSceneryGroup. returns false if kit not ready */
function _goodsMesh(name, x, y, z, targetH, rotY) { const p = PROPS_READY && PROP_PROTO[name]; if (!p) return false; const s = (targetH || 1) / p.base, m = new THREE.Mesh(p.geo, p.mat); m.position.set(x, y || 0, z); m.rotation.y = (rotY != null) ? rotY : rand(0, 6); m.scale.setScalar(s); m.castShadow = true; townSceneryGroup.add(m); return true; }
/* a market stall dressed with goods: ground barrel+crates flanking it, a few bottles on the table (~y1.08) */
function tStallGoods(x, z) { _goodsMesh('barrel_small', x + 1.7, 0, z + 0.2, 1.0) && townColliders.push({ x: x + 1.7, z: z + 0.2, r: 0.45 }); _goodsMesh('crates_stacked', x - 1.7, 0, z + 0.2, 1.3) && townColliders.push({ x: x - 1.7, z: z + 0.2, r: 0.55 }); _goodsMesh('bottle_A_labeled_green', x - 0.5, 1.08, z, 0.36); _goodsMesh('bottle_A_labeled_green', x + 0.2, 1.08, z - 0.15, 0.36); _goodsMesh('bottle_A_labeled_green', x + 0.6, 1.08, z + 0.12, 0.36); }
/* a KayKit nature bush (forest atlas) at ~1.1 height; procedural clump fallback; decorative, no collider */
function tBush(x, z, s) { s = s || 1; const names = ['Bush_1_A_Color1', 'Bush_2_A_Color1', 'Bush_4_A_Color1']; const nm = names[Math.abs(Math.round(x * 7) + Math.round(z * 11)) % names.length]; if (_goodsMesh(nm, x, 0, z, 1.1 * s)) return; const g = new THREE.Group(), lm = new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x356a30, flatShading: true }); for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.5 * s, 7, 6), lm); c.position.set((i - 1) * 0.42 * s, 0.42 * s, 0); c.castShadow = true; g.add(c); } g.position.set(x, 0, z); townSceneryGroup.add(g); }
/* a small flower bed — colored blooms on short stems, merged, no collider */
function tFlowerbed(x, z) { const cols = [0xff5a7a, 0xffd24d, 0x6a9aff, 0xff8a3a, 0xc06aff], stemMat = new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x2f6a2a, flatShading: true }); for (let i = 0; i < 7; i++) { const a = rand(0, 6.283), r = rand(0, 1.2), fx = x + Math.cos(a) * r, fz = z + Math.sin(a) * r; const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.5, 4), stemMat); stem.position.set(fx, 0.25, fz); townSceneryGroup.add(stem); const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), new THREE.MeshBasicMaterial({ color: cols[i % cols.length] })); bloom.position.set(fx, 0.52, fz); townSceneryGroup.add(bloom); } }
/* KayKit perimeter wall: tile wall_straight along each edge (footprint = segment length so pieces abut edge-to-edge),
   a wall_gate at the south centre, watchtowers at the corners. Pieces are multi-material building clones that merge by
   color like the rest of the town. Only draws when BUILDINGS_READY (no procedural fallback — a box wall would clash). */
function tWallEdge(fixed, isZ, half, foot, gate) {
  let N = Math.max(3, Math.round(2 * half / foot)); if (gate && N % 2 === 0) N++;
  const step = 2 * half / N;
  for (let i = 0; i < N; i++) { const t = -half + step * (i + 0.5), name = (gate && i === (N - 1) / 2) ? 'wall_gate' : 'wall_straight'; if (isZ) placeBuilding(name, fixed, t, Math.PI / 2, step); else placeBuilding(name, t, fixed, 0, step); }
}
function tWallRing(hx, hz, foot) {
  tWallEdge(-hz, false, hx, foot, true); tWallEdge(hz, false, hx, foot, false); tWallEdge(-hx, true, hz, foot, false); tWallEdge(hx, true, hz, foot, false);
  for (const c of [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]]) placeBuilding('watchtower', c[0], c[1], 0, Math.max(6, foot * 0.9));
}
/* ---- three distinct themed towns; each returns its anchor + NPC layout (+ optional villager spots) ---- */
function buildAldermere() { // warm woodland village around a cobbled market plaza
  tPlaza(0, 2, 26, 24, 0x877d68); tWell(0, 2); makeFire(-12, 14, townSceneryGroup, townFires, townColliders, 0xff9a3a);
  // stone perimeter wall with a south gatehouse + corner watchtowers -> reads as a fortified town
  tWallRing(40, 40, 9);
  // cobbled road network, lighter tan so it reads against grass: long N-S avenue (plaza->south gate), E-W cross street, north spur
  tPath(0, -11, 6, 62, 0, 0x9c8b6e); tPath(0, 2, 70, 6, 0, 0x9c8b6e); tPath(0, 22, 6, 22, 0, 0x9c8b6e);
  // buildings ring the plaza facing inward (deterministic pool by x,z); anchors (market/mill) are larger
  const houses = [[-24, 18, 8, 6, 0x6a5236, 0x5a2418, { chimney: 1 }], [24, 18, 8, 6, 0x5e4a32, 0x5a2418, { chimney: 1 }], [-31, 2, 9, 7, 0x70583a, 0x4a2014, {}], [31, 2, 11, 8, 0x64502f, 0x4a2014, {}], [0, 31, 11, 8, 0x70583a, 0x4a2014, { chimney: 1 }], [-26, -13, 8, 6, 0x6a5236, 0x5a2418, {}], [26, -13, 8, 6, 0x5e4a32, 0x5a2418, { chimney: 1 }], [-35, -23, 7, 6, 0x64502f, 0x5a2418, { chimney: 1 }], [35, -23, 7, 6, 0x6a5236, 0x4a2014, { chimney: 1 }]];
  for (const h of houses) tHouse(h[0], h[1], h[2], h[3], h[4], h[5], h[6]);
  // market: two stalls flanking the south avenue, each dressed with goods
  tStall(-8, -6, 0xc0402a); tStallGoods(-8, -6); tStall(8, -6, 0x2a6ac0); tStallGoods(8, -6);
  // greenery framing the plaza + avenue
  for (const t of [[-30, 30, 1.3], [30, 30, 1.2], [-38, 12, 1.1], [38, 12, 1.1], [-36, -30, 1.2], [36, -30, 1.3]]) tTree(t[0], t[1], t[2]);
  for (const b of [[-16, 8, 1], [16, 8, 1], [-16, -4, 1], [16, -4, 1.1], [-12, 24, 1], [12, 24, 1]]) tBush(b[0], b[1], b[2]);
  tFlowerbed(-7, 12); tFlowerbed(7, 12); tFlowerbed(0, -22);
  tFence(-36, -16, -24, -16); tFence(24, -16, 36, -16);
  // warm lighting down the avenue and around the plaza
  for (const l of [[-12, -12, 0xffd27a], [12, -12, 0xffd27a], [-13, 13, 0xffd27a], [13, 13, 0xffd27a], [0, -22, 0xffd27a]]) tLamp(l[0], l[1], l[2]);
  return {
    anchors: { portal: [0, -20], waypoint: [-18, -2], cauldron: [18, -2] },
    npcs: { vendor: [-9, -4], stash: [9, -4], smith: [16, 7], alchemist: [-16, 7], enchanter: [0, 15] },
    villagers: [[-6, 0], [6, 1], [-11, 9], [11, 8], [0, -9]]
  };
}
function buildHighreach() { // grey-stone fortress keep: cobbled plaza + fountain, a crenellated keep overlooking it
  tPlaza(0, 2, 24, 22, 0x7a838f); tFountain(0, 2); makeFire(-11, 13, townSceneryGroup, townFires, townColliders, 0xffb060);
  tWallRing(38, 38, 9); // fortified perimeter: wall + corner watchtowers + south gate
  // central keep at the north end, overlooking the plaza
  tTower(0, 24, 3.2, 14, 0x5a626e, { crenel: 1 });
  // cool-grey cobbled roads: avenue plaza->south gate, E-W cross, short spur to the keep face
  tPath(0, -11, 6, 56, 0, 0x8a93a0); tPath(0, 2, 64, 6, 0, 0x8a93a0); tPath(0, 15, 6, 10, 0, 0x8a93a0);
  // stone houses ring the plaza facing inward; north-centre left clear for the keep
  const houses = [[-23, 17, 8, 8, 0x6a7280, 0x424a56, { stone: 1, stories: 2 }], [23, 17, 8, 8, 0x626a78, 0x3a424e, { stone: 1, stories: 2 }], [-30, 2, 9, 8, 0x6a7280, 0x424a56, { stone: 1 }], [30, 2, 11, 9, 0x626a78, 0x3a424e, { stone: 1, stories: 2 }], [-26, -13, 8, 7, 0x6a7280, 0x424a56, { stone: 1 }], [26, -13, 8, 7, 0x626a78, 0x3a424e, { stone: 1, stories: 2 }], [-34, -23, 7, 7, 0x626a78, 0x3a424e, { stone: 1 }], [34, -23, 7, 7, 0x6a7280, 0x424a56, { stone: 1, stories: 2 }]];
  for (const h of houses) tHouse(h[0], h[1], h[2], h[3], h[4], h[5], h[6]);
  // market: two stalls flanking the south avenue, each dressed
  tStall(-8, -6, 0x3a6ab0); tStallGoods(-8, -6); tStall(8, -6, 0x4a5a8a); tStallGoods(8, -6);
  // sparse hardy pines at the corners (grey-green), no flowerbeds in a cold keep
  for (const t of [[-31, 30, 1.2], [31, 30, 1.2], [-37, -30, 1.1], [37, -30, 1.1]]) tTree(t[0], t[1], t[2], 0x5a6e5a);
  tBanner(-7, 12, 0x2a4a8a); tBanner(7, 12, 0x3a4250); tBanner(-7, -4, 0x3a4250); tBanner(7, -4, 0x2a4a8a);
  for (const l of [[-12, -12, 0xbcd0ff], [12, -12, 0xbcd0ff], [-13, 13, 0xbcd0ff], [13, 13, 0xbcd0ff], [0, -22, 0xbcd0ff]]) tLamp(l[0], l[1], l[2]);
  tCrate(11, -8); tBarrel(-11, -8);
  return {
    anchors: { portal: [0, -18], waypoint: [-18, -2], cauldron: [18, -2] },
    npcs: { vendor: [-9, -4], stash: [9, -4], smith: [16, 7], alchemist: [-16, 7], enchanter: [-13, 13], gambler: [13, 13] },
    villagers: [[-6, 0], [6, 1], [-12, 9], [12, 8], [0, -9]]
  };
}
function buildEmberhold() { // volcanic forge-town: dark cobble plaza, a glowing forge-keep, lava + braziers (no greenery)
  tPlaza(0, 2, 26, 22, 0x5a4036); makeFire(0, 2, townSceneryGroup, townFires, townColliders, 0xff7a2a); // forge hearth at the plaza heart
  tWallRing(40, 38, 9); // imposing endgame perimeter
  // central glowing forge-tower at the north end (ember windows)
  tTower(0, 24, 2.8, 15, 0x3a2026, { roof: 0x6a1a14, win: 0xffb060 });
  // dark volcanic cobbled roads: avenue plaza->south gate, E-W cross, short spur to the forge face
  tPath(0, -11, 6, 56, 0, 0x4a342a); tPath(0, 2, 66, 6, 0, 0x4a342a); tPath(0, 15, 6, 10, 0, 0x4a342a);
  // dark-red stone houses ring the plaza; north-centre left clear for the forge-tower
  const houses = [[-23, 17, 8, 8, 0x4a2a26, 0x2a1014, { stone: 1, stories: 2 }], [23, 17, 8, 8, 0x42221e, 0x2a1014, { stone: 1, stories: 2, chimney: 1 }], [-30, 2, 9, 8, 0x4a2a26, 0x2a1014, { stone: 1 }], [30, 2, 11, 9, 0x42221e, 0x2a1014, { stone: 1, stories: 2 }], [-26, -13, 8, 7, 0x4a2a26, 0x2a1014, { stone: 1, chimney: 1 }], [26, -13, 8, 7, 0x42221e, 0x2a1014, { stone: 1 }], [-34, -23, 7, 7, 0x4a2a26, 0x2a1014, { stone: 1 }], [34, -23, 7, 7, 0x42221e, 0x2a1014, { stone: 1, chimney: 1 }]];
  for (const h of houses) tHouse(h[0], h[1], h[2], h[3], h[4], h[5], h[6]);
  // market: two stalls flanking the south avenue, ember awnings
  tStall(-8, -6, 0x8a2a20); tStallGoods(-8, -6); tStall(8, -6, 0xff6a20); tStallGoods(8, -6);
  // lava pools in the open diagonal courtyard gaps (off the road axes + building ring)
  for (const lv of [[-18, -14, 2.2], [18, -14, 2.2], [-18, 16, 2.0], [18, 16, 2.0]]) tLavaPool(lv[0], lv[1], lv[2]);
  // braziers are the light source down the avenue + plaza
  for (const b of [[-11, -10], [11, -10], [-11, 13], [11, 13], [-13, 4], [13, 4]]) tBrazier(b[0], b[1], 0xff7a2a);
  tBanner(-7, 12, 0x8a2030); tBanner(7, 12, 0xff6a20); tBanner(-7, -4, 0xff6a20); tBanner(7, -4, 0x8a2030);
  tCrate(11, -8); tBarrel(-11, -8);
  return {
    anchors: { portal: [0, -18], waypoint: [-20, -2], cauldron: [20, -2] },
    npcs: { vendor: [-9, -4], stash: [9, -4], smith: [16, 6], alchemist: [-16, 6], enchanter: [-13, 13], gambler: [13, 13], jeweler: [-18, -11], premiumVendor: [18, -11] },
    villagers: [[-6, 0], [6, 1], [-12, 9], [12, 8], [0, -9]]
  };
}
const TOWN_BUILDERS = { town: buildAldermere, highreach: buildHighreach, emberhold: buildEmberhold };
/* ---- Phase 4: static-scenery draw-call collapse ----
   Town is built from ~130 individual non-instanced meshes (~110 drawn) = ~110 draw calls. Browser-verified
   under 6x CPU throttle: those draws cost ~11ms/frame (pure CPU submission, GPU ~0.3ms) — the dominant
   weak-CPU cost. This merges them by material+shadow signature into ~16 draws. Per-mesh color is baked into
   a vertex-color attribute and the merged material is white+vertexColors, so the lit result is byte-identical;
   geometry is preserved (world matrices applied), so positions/shadows are unchanged. Runs once per town
   entry behind the warmScene gate; originals are never rendered (merge precedes the first render) so no GPU
   churn. Atomic: merged meshes are built first, the group is mutated only at the end; guarded by try/catch. */
function _concatGeos(geos) {
  let total = 0; for (const g of geos) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2), col = new Float32Array(total * 3);
  let off = 0;
  for (const g of geos) { const n = g.attributes.position.count; pos.set(g.attributes.position.array, off * 3); nor.set(g.attributes.normal.array, off * 3); uv.set(g.attributes.uv.array, off * 2); col.set(g.attributes.color.array, off * 3); off += n; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
function mergeStaticScenery(group, skip) {
  group.updateMatrixWorld(true);
  const buckets = new Map(); const toRemove = [];
  group.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh) return; /* never merge InstancedMesh (instanceMatrix can't be baked this way) — keeps the fn safe on the dungeon's instanced pillars/rocks */
    if (skip && skip.has(o)) return;
    if (o.userData && (o.userData.dynamic || o.userData.noMerge)) return;
    const m = o.material; if (Array.isArray(m) || !m || m.transparent) return;
    const a = o.geometry.attributes; if (!a.position || !a.normal) return; /* uv optional: KayKit vertex-colored buildings carry no UVs — a synthesized zero-UV (below) lets them merge too */
    const isBasic = !!m.isMeshBasicMaterial, isStd = !!m.isMeshStandardMaterial;
    if (isStd && (m.normalMap || m.roughnessMap || m.aoMap || m.metalnessMap || m.emissiveMap)) return; /* can't faithfully merge PBR-mapped Standard mats (we only bake albedo color -> vertex color) */
    const sig = (isBasic ? 'B' : isStd ? 'S' : 'P') + '|' + (m.map ? m.map.uuid : 'n') + '|' + (m.flatShading ? 1 : 0) + '|' + m.side + '|' + (m.toneMapped ? 1 : 0) + '|' + (m.emissive ? m.emissive.getHex() : 0) + '|' + (m.emissiveIntensity != null ? m.emissiveIntensity : 1) + '|' + (m.specular ? m.specular.getHex() : 0) + '|' + (m.shininess != null ? m.shininess : 30) + (isStd ? '|' + m.roughness + 'r' + m.metalness : '') + '|' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0);
    let b = buckets.get(sig); if (!b) { b = { proto: m, isBasic, isStd, cast: o.castShadow, recv: o.receiveShadow, geos: [] }; buckets.set(sig, b); }
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    const n = g.attributes.position.count, c = m.color, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2)); /* synth zero UVs so _concatGeos can pack a uv buffer; merged building mat has map:null -> UVs unused */
    b.geos.push(g); toRemove.push(o);
  });
  const built = [];
  for (const b of buckets.values()) {
    if (!b.geos.length) continue; const p = b.proto;
    const mat = b.isBasic
      ? new THREE.MeshBasicMaterial({ vertexColors: true, map: p.map || null, toneMapped: p.toneMapped })
      : b.isStd
      ? new THREE.MeshStandardMaterial({ vertexColors: true, map: p.map || null, flatShading: p.flatShading, roughness: (p.roughness != null ? p.roughness : 1), metalness: (p.metalness != null ? p.metalness : 0), side: p.side, toneMapped: p.toneMapped, emissive: (p.emissive ? p.emissive.getHex() : 0), emissiveIntensity: (p.emissiveIntensity != null ? p.emissiveIntensity : 1), envMapIntensity: (p.envMapIntensity != null ? p.envMapIntensity : 1) })
      : new THREE.MeshPhongMaterial({ vertexColors: true, map: p.map || null, flatShading: p.flatShading, specular: (p.specular ? p.specular.getHex() : 0x000000), shininess: (p.shininess != null ? p.shininess : 30), side: p.side, toneMapped: p.toneMapped, emissive: (p.emissive ? p.emissive.getHex() : 0), emissiveIntensity: (p.emissiveIntensity != null ? p.emissiveIntensity : 1) });
    const mesh = new THREE.Mesh(_concatGeos(b.geos), mat); mesh.castShadow = b.cast; mesh.receiveShadow = b.recv; mesh.frustumCulled = false; mesh.userData.merged = true;
    built.push(mesh);
  }
  for (const o of toRemove) { if (o.parent) o.parent.remove(o); }
  for (const mesh of built) group.add(mesh);
  return { draws: built.length, collapsed: toRemove.length };
}
function buildTown(area) {
  const id = (area && area.id) || 'town'; clearGroup(townSceneryGroup); clearLightBucket('town'); _lightBucket = 'town'; townColliders.length = 0; townFires.length = 0;
  const cfg = (TOWN_BUILDERS[id] || buildAldermere)(); const A = cfg.anchors;
  t_wildPortal.x = A.portal[0]; t_wildPortal.z = A.portal[1]; t_wildPortal.group.position.set(A.portal[0], 0, A.portal[1]);
  t_waypoint.x = A.waypoint[0]; t_waypoint.z = A.waypoint[1]; t_waypoint.group.position.set(A.waypoint[0], 0, A.waypoint[1]); townColliders.push({ x: A.waypoint[0], z: A.waypoint[1], r: 1.6 });
  t_cauldron.x = A.cauldron[0]; t_cauldron.z = A.cauldron[1]; t_cauldron.group.position.set(A.cauldron[0], 0, A.cauldron[1]); townColliders.push({ x: A.cauldron[0], z: A.cauldron[1], r: 1.4 });
  for (const n of npcs) { const inTown = (n.towns || []).includes(id); n.group.visible = inTown; const p = cfg.npcs[n.kind]; if (p && inTown) { n.x = p[0]; n.z = p[1]; n.group.position.set(p[0], 0, p[1]); n.group.rotation.y = (p[2] != null) ? p[2] : Math.atan2(-p[0], -p[1]); townColliders.push({ x: p[0], z: p[1], r: 1.2 }); } }
  _lightBucket = 'static';
  try { mergeStaticScenery(townSceneryGroup, new Set(townFires.map(f => f.flame))); } catch (e) { console.warn('town scenery merge failed; using unmerged:', e && e.message); } /* Phase 4: collapse static draws; skip animated fire flames */
  buildTownVillagers(cfg.villagers);
}
/* Decorative idling townsfolk. Reuse already-loaded NPC protos (Rogue_Hooded/Ranger/Barbarian/Rogue), weapon-stripped, no
   interaction. Detach (don't dispose) on rebuild: their geo/mat are SHARED with the proto via SkeletonUtils.clone, so
   disposeObj would free the shared buffers and break every other clone. They sit in townActorsGroup, never merged. */
function clearTownActors() { for (let i = townActorsGroup.children.length - 1; i >= 0; i--) townActorsGroup.remove(townActorsGroup.children[i]); townVillagers.length = 0; }
function buildTownVillagers(spots) {
  clearTownActors(); if (!spots || !spots.length || !GLB_READY) return;
  const roles = ['alchemist', 'gambler', 'jeweler', 'stash']; /* Rogue_Hooded / Ranger / Barbarian / Rogue meshes */
  for (let i = 0; i < spots.length; i++) {
    const sp = spots[i], role = roles[i % roles.length]; if (!GLB_PROTO[role]) continue;
    const ent = buildGLBEntity(role, 0.92 + (i % 3) * 0.05); if (!ent) continue;
    stripNPCWeapons(ent.userData.model);
    ent.position.set(sp[0], 0, sp[1]); ent.rotation.y = (sp[2] != null) ? sp[2] : rand(0, 6.283);
    townActorsGroup.add(ent); townVillagers.push(ent); glbPlay(ent, 'idle');
    townColliders.push({ x: sp[0], z: sp[1], r: 0.9 });
  }
}

/* ---- DUNGEON scenery (rebuilt per level) ---- */
const dungeonGroup = new THREE.Group(); dungeonGroup.visible = false; scene.add(dungeonGroup);
/* Persistent dungeon perimeter wall (brick PBR). Separate scene-level group so clearGroup(dungeonGroup) can't
   dispose its shared material; geometry is fixed (DUNG_WALL_R), so it's built once and recoloured per biome
   in loadDungeonWall instead of rebuilt each descent (avoids per-dive material/pipeline churn). */
const dungeonExtraGroup = new THREE.Group(); dungeonExtraGroup.visible = false; scene.add(dungeonExtraGroup);
const dungeonWallMat = new THREE.MeshStandardMaterial({ color: 0x3a3340, roughness: 1.0, metalness: 0.0, map: texStone(16, 2), normalMap: _flatNormal(), roughnessMap: _whitePx(), aoMap: _whitePx(), side: THREE.DoubleSide }); dungeonWallMat.normalScale.set(0.7, 0.7);
const dungeonWallGeo = new THREE.CylinderGeometry(DUNG_BACK_R, DUNG_BACK_R, 11, 80, 1, true); dungeonWallGeo.setAttribute('uv1', dungeonWallGeo.attributes.uv);
const dungeonWall = new THREE.Mesh(dungeonWallGeo, dungeonWallMat); dungeonWall.position.y = 5.5; dungeonWall.userData.noDispose = true; dungeonExtraGroup.add(dungeonWall);
let dungeonFires = []; let d_deeperPortal = null; let curTheme = null;
function disposeObj(o) { if (!o) return; o.traverse(c => { if (c.isInstancedMesh) c.dispose(); /* frees instanceMatrix only, not geo/mat */ const g = c.geometry; if (g && !(g.userData && g.userData.sharedProto)) g.dispose(); if (c.material) { const ms = Array.isArray(c.material) ? c.material : [c.material]; for (const mm of ms) if (mm && !(mm.userData && mm.userData.sharedProto)) mm.dispose(); } }); } /* shared prop prototypes (userData.sharedProto) survive zone rebuilds */
function removeMesh(o) { if (!o) return; if (o.userData && o.userData.eliteLight) { unregLight(o.userData.eliteLight); o.userData.eliteLight = null; } scene.remove(o); if (o.userData && (o.userData.pooled || o.userData.linePooled)) { o.visible = false; const pool = o.userData.linePooled ? _linePool : _meshPool; if (pool.length < _POOL_MAX) pool.push(o); return; } if (o.userData && o.userData.noDispose) return; disposeObj(o); }
function clearGroup(g) { while (g.children.length) { const c = g.children[0]; g.remove(c); disposeObj(c); } }
/* Biomes are no longer locked to a depth tier — buildDungeon picks one at random each entry (pickBiome),
   so re-running the same depth varies the scenery & monster mix. Each biome carries a weighted `pool`
   of monster type-keys (repeats = higher spawn weight). HELL_BIOME is reserved for depth 666. */
const BIOMES = [
  { name: 'Catacombs', pillar: 0x3a3340, rock: 0x2a2630, fire: 0xff8a3a, fog: 0x07080e, ground: 0x221f2a, amb: 'dust', ambCol: 0xb0a080, deco: 'bone', grade: { t: [1.04, 0.99, 0.92], v: 0.36 }, pool: ['fallen', 'fallen', 'zombie', 'zombie', 'skeleton', 'brute'] },
  { name: 'Frozen Wastes', pillar: 0x3a4450, rock: 0x2e3640, fire: 0x9fd8ff, fog: 0x0a1018, ground: 0x1c2630, amb: 'snow', ambCol: 0xdff0ff, deco: 'ice', grade: { t: [0.93, 0.99, 1.09], v: 0.34 }, pool: ['fallen', 'zombie', 'wraith', 'wraith', 'brute', 'skeleton'] },
  { name: 'Crystal Caverns', pillar: 0x33404a, rock: 0x283038, fire: 0x6ad8ff, fog: 0x081016, ground: 0x1a2230, amb: 'dust', ambCol: 0x9fd8ff, deco: 'crystal', grade: { t: [0.92, 1.00, 1.10], v: 0.32 }, pool: ['shaman', 'shaman', 'fallen', 'wraith', 'brute', 'skeleton'] },
  { name: 'Sunken Swamp', pillar: 0x2e3a2a, rock: 0x24301f, fire: 0x7ac05a, fog: 0x0a140a, ground: 0x16200f, amb: 'spore', ambCol: 0x8fd86a, deco: 'swamp', grade: { t: [0.93, 1.06, 0.92], v: 0.36 }, pool: ['zombie', 'zombie', 'fallen', 'shaman', 'skeleton', 'brute'] },
  { name: 'Infernal Deep', pillar: 0x4a2620, rock: 0x3a201a, fire: 0xff5020, fog: 0x180806, ground: 0x281410, amb: 'ember', ambCol: 0xff5a2a, deco: 'lava', grade: { t: [1.12, 0.95, 0.84], v: 0.40 }, pool: ['imp', 'imp', 'hellhound', 'fallen', 'brute', 'hellhound'] },
  { name: 'Bone Cathedral', pillar: 0x4a4438, rock: 0x38322a, fire: 0xffcf8a, fog: 0x141008, ground: 0x2a2418, amb: 'dust', ambCol: 0xe8d8a0, deco: 'bonepile', grade: { t: [1.07, 1.01, 0.88], v: 0.34 }, pool: ['skeleton', 'skeleton', 'zombie', 'shaman', 'wraith', 'brute'] },
  { name: 'The Void', pillar: 0x3a2a4a, rock: 0x2a2036, fire: 0xb060ff, fog: 0x100818, ground: 0x1c1426, amb: 'rune', ambCol: 0xc080ff, deco: 'rune', grade: { t: [1.05, 0.93, 1.10], v: 0.42 }, pool: ['wraith', 'wraith', 'shaman', 'fallen', 'brute', 'imp'] },
];
const HELL_BIOME = { name: 'The Inferno', pillar: 0x5a1810, rock: 0x3a100a, fire: 0xff3010, fog: 0x1a0402, ground: 0x300a06, amb: 'ember', ambCol: 0xff4a1a, deco: 'lava', grade: { t: [1.25, 0.82, 0.74], v: 0.5 }, pool: ['imp', 'hellhound', 'imp', 'hellhound', 'brute', 'fallen'] };
function dungeonTheme(depth) { if (depth === 666) return HELL_BIOME; const i = depth >= 19 ? 6 : depth >= 16 ? 5 : depth >= 13 ? 4 : depth >= 10 ? 3 : depth >= 7 ? 2 : depth >= 4 ? 1 : 0; return BIOMES[i]; }
function pickBiome(depth) { if (depth === 666) return HELL_BIOME; if (typeof window !== 'undefined' && window.__forceBiome != null && BIOMES[window.__forceBiome]) return BIOMES[window.__forceBiome]; /* perf A/B instrumentation: pin one biome so NUM_POINT_LIGHTS stays invariant across re-entries (unset in normal play) */ return BIOMES[Math.floor(Math.random() * BIOMES.length)]; }
/* shared prop instancing + per-tint material cache (one clone per atlas+hex, persists across rebuilds) */
const _propMatCache = {};
function tintPropMat(base, hex) { const key = base.uuid + ':' + hex; let m = _propMatCache[key]; if (!m) { m = base.clone(); if (m.color) m.color.setHex(hex); m.userData = Object.assign(m.userData || {}, { sharedProto: true }); _propMatCache[key] = m; } return m; }
function makePropInst(geo, mat, tf, group, opts) { /* tf items: {x,z,ry?,rx?,rz?,s?|sx,sy,sz} ; geo base sits at y=0 */
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), Sc = new THREE.Vector3();
  const im = new THREE.InstancedMesh(geo, mat, tf.length); im.castShadow = !!(opts && opts.cast); im.receiveShadow = !!(opts && opts.recv); im.frustumCulled = false;
  for (let i = 0; i < tf.length; i++) { const t = tf[i], s = t.s || 1; E.set(t.rx || 0, t.ry || 0, t.rz || 0); Q.setFromEuler(E); V.set(t.x, t.y || 0, t.z); Sc.set(t.sx || s, t.sy || s, t.sz || s); M.compose(V, Q, Sc); im.setMatrixAt(i, M); }
  im.instanceMatrix.needsUpdate = true; if (group) group.add(im); return im;
}
/* Resident biome cache: each dungeon biome is BUILT ONCE into its own sub-group and kept in the scene; re-entry
   toggles .visible + re-scatters the instanced props (no dispose) so GPU pipelines stay warm — re-entry compiles
   in ~6ms vs the ~950ms recompile a teardown+rebuild evicts into. Bounded at the 7 BIOMES. */
const dungeonBiomeCache = new Map(); // biome.name -> { sub, scatterIMs, fixedColliders, fires }
const _dM4 = new THREE.Matrix4(), _dQ = new THREE.Quaternion(), _dE = new THREE.Euler(), _dV = new THREE.Vector3(), _dSc = new THREE.Vector3();
function _imSetTF(im, tf) { for (let i = 0; i < tf.length; i++) { const t = tf[i], s = t.s || 1; _dE.set(t.rx || 0, t.ry || 0, t.rz || 0); _dQ.setFromEuler(_dE); _dV.set(t.x, t.y || 0, t.z); _dSc.set(t.sx || s, t.sy || s, t.sz || s); _dM4.compose(_dV, _dQ, _dSc); im.setMatrixAt(i, _dM4); } im.instanceMatrix.needsUpdate = true; }
/* Fresh layout on (re-)entry: re-randomize each tagged InstancedMesh's instance positions/rotations within the
   playable disc (keeping each instance's authored scale + collider radius) and rebuild the dynamic collider set.
   No object is created or disposed → pipelines stay warm. ponytail: the non-instanced deco (merged) + fires stay
   frozen across re-entries — a minor visual subset; moving them + their lights isn't worth the risk. The instanced
   pillars/rubble/furniture carry the layout variety. Upgrade path: reposition deco groups + their lights too. */
function _rescatterDungeon(c) {
  dungeonColliders.length = 0;
  for (const col of c.fixedColliders) dungeonColliders.push(col);
  const R = DUNG_HALF - 6;
  for (const im of c.scatterIMs) {
    const tf = [];
    for (const m of im.userData.scatterMeta) { const ang = rand(0, 6.28), d = rand(8, R); tf.push({ x: Math.cos(ang) * d, z: Math.sin(ang) * d, ry: rand(0, 6), s: m.s, cr: m.cr }); }
    _imSetTF(im, tf);
    for (const t of tf) if (t.cr != null) dungeonColliders.push({ x: t.x, z: t.z, r: t.cr });
  }
}
function _buildDungeonBiome(depth, th) {
  const sub = new THREE.Group(); sub.name = 'dbiome:' + th.name; dungeonGroup.add(sub);
  _lightBucket = 'dungeon'; /* per-biome lights live under this sub; cullLights' parent-visibility skip excludes inactive biomes, so the visible point-light count stays constant (no biome-switch recompile) */
  const fires = [], fixedColliders = [], scatterIMs = [];
  _fillDungeonBiome(sub, depth, th, fires, fixedColliders, scatterIMs);
  _lightBucket = 'static';
  const cache = { sub, scatterIMs, fixedColliders, fires };
  dungeonBiomeCache.set(th.name, cache);
  dungeonFires = fires;
  _rescatterDungeon(cache); /* place scatter + build dungeonColliders (fixed + fresh scatter) */
}
function buildDungeon(depth) {
  const th = curTheme = pickBiome(depth);
  for (const c of dungeonBiomeCache.values()) c.sub.visible = false;
  const cached = dungeonBiomeCache.get(th.name);
  if (cached) { cached.sub.visible = true; dungeonFires = cached.fires; _rescatterDungeon(cached); }
  else _buildDungeonBiome(depth, th);
  if (!d_deeperPortal) { _lightBucket = 'static'; d_deeperPortal = makePortal(0, -50, 0xc04aff); dungeonGroup.add(d_deeperPortal.group); } /* singleton biome-agnostic deeper-descent portal, created once, kept resident */
}
/* `dungeonGroup` here is the per-biome sub-group (param shadows the module group): every add below targets it. */
function _fillDungeonBiome(dungeonGroup, depth, th, fires, fixedColliders, scatterIMs) {
  const R = DUNG_HALF - 6; /* interior scatter stays inside the rectangular hall (kit walls sit at ±(DUNG_HALF+2)) */
  const addScatter = (geo, mat, metas, opts) => { const im = new THREE.InstancedMesh(geo, mat, metas.length); im.frustumCulled = false; im.castShadow = !!(opts && opts.cast); im.receiveShadow = !!(opts && opts.recv); im.userData.scatterMeta = metas; dungeonGroup.add(im); scatterIMs.push(im); return im; }; /* tagged scatter: positioned + re-randomized by _rescatterDungeon */
  const useProps = PROPS_READY && PROP_PROTO['pillar'] && PROP_PROTO['rubble_large'];
  if (useProps) {
    // pillars: KayKit pillar + pillar_decorated (full-height pieces), height-targeted, tinted to biome stone
    const pK = ['pillar', 'pillar_decorated'];
    for (const k of pK) { const metas = []; for (let i = 0; i < 30; i++) metas.push({ s: rand(7, 13) / PROP_PROTO[k].base, cr: 1.7 }); addScatter(PROP_PROTO[k].geo, tintPropMat(PROP_PROTO[k].mat, th.pillar), metas, { cast: true, recv: true }); }
    // loose rocks -> KayKit rubble (low debris), biome-tinted
    /** @type {[string, number][]} */
    const ruK = [['rubble_large', 13], ['rubble_half', 12]];
    for (const [k, cnt] of ruK) { const metas = []; for (let i = 0; i < cnt; i++) { const s = rand(0.7, 1.5) / PROP_PROTO[k].base; metas.push({ s, cr: Math.max(PROP_PROTO[k].size.x, PROP_PROTO[k].size.z) * s * 0.45 }); } addScatter(PROP_PROTO[k].geo, tintPropMat(PROP_PROTO[k].mat, th.rock), metas, { recv: true }); }
  } else {
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), Sc = new THREE.Vector3();
    const pim = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.2, 1.5, 1, 6), new THREE.MeshPhongMaterial({ specular: 0x000000, color: th.pillar, flatShading: true, map: texStone(2, 4) }), 60); pim.receiveShadow = true; pim.frustumCulled = false;
    for (let i = 0; i < 60; i++) { const ang = rand(0, 6.28), d = rand(10, R), x = Math.cos(ang) * d, z = Math.sin(ang) * d, h = rand(6, 12), rs = rand(0.7, 1.2); E.set(0, rand(0, 6), 0); Q.setFromEuler(E); V.set(x, h / 2, z); Sc.set(rs, h, rs); M.compose(V, Q, Sc); pim.setMatrixAt(i, M); fixedColliders.push({ x, z, r: 1.7 }); }
    pim.instanceMatrix.needsUpdate = true; dungeonGroup.add(pim);
    const rim = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshPhongMaterial({ specular: 0x000000, color: th.rock, flatShading: true, map: texStone(2, 2) }), 25); rim.frustumCulled = false;
    for (let i = 0; i < 25; i++) { const x = rand(-R, R), z = rand(-R, R), s = rand(1, 2.4); E.set(rand(0, 6), rand(0, 6), rand(0, 6)); Q.setFromEuler(E); V.set(x, s * 0.4, z); Sc.set(s, s, s); M.compose(V, Q, Sc); rim.setMatrixAt(i, M); fixedColliders.push({ x, z, r: s * 0.9 }); }
    rim.instanceMatrix.needsUpdate = true; dungeonGroup.add(rim);
  }
  for (let i = 0; i < 6; i++) { const ang = rand(0, 6.28), d = rand(15, R - 10); makeFire(Math.cos(ang) * d, Math.sin(ang) * d, dungeonGroup, fires, fixedColliders, th.fire); }
  // themed decorations
  for (let i = 0; i < 22; i++) {
    const ang = rand(0, 6.28), d = rand(8, R - 6), x = Math.cos(ang) * d, z = Math.sin(ang) * d; const lit = (i % 3 === 0);
    if (th.deco === 'crystal') { const cl = new THREE.Group(); for (let k = 0; k < rand(2, 4); k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(rand(0.3, 0.6), rand(2, 4), 5), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x6ad8ff, emissive: 0x2a7aaa, emissiveIntensity: 1, flatShading: true, map: texCrystal(1, 2) })); c.position.set(rand(-0.8, 0.8), rand(1, 2), rand(-0.8, 0.8)); c.rotation.set(rand(-.4, .4), rand(0, 6), rand(-.4, .4)); cl.add(c); } cl.position.set(x, 0, z); dungeonGroup.add(cl); if (lit) { const lt = regLight(new THREE.PointLight(0x6ad8ff, 0.8 * Math.PI, 15, 2)); lt.position.set(x, 3, z); dungeonGroup.add(lt); } }
    else if (th.deco === 'lava') { const pool = new THREE.Mesh(new THREE.CircleGeometry(rand(2, 4), 18), new THREE.MeshBasicMaterial({ color: 0xff4a18, map: texLava(2, 2) })); pool.rotation.x = -Math.PI / 2; pool.position.set(x, 0.16, z); dungeonGroup.add(pool); if (lit) { const lt = regLight(new THREE.PointLight(0xff5020, 1.2 * Math.PI, 18, 2)); lt.position.set(x, 2, z); dungeonGroup.add(lt); } }
    else if (th.deco === 'rune') { const ring = new THREE.Mesh(new THREE.TorusGeometry(rand(1.2, 2), 0.12, 8, 24), new THREE.MeshBasicMaterial({ color: 0xc080ff, map: texEnergy(4, 1) })); ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.2, z); dungeonGroup.add(ring); if (lit) { const lt = regLight(new THREE.PointLight(0xb060ff, 0.9 * Math.PI, 16, 2)); lt.position.set(x, 2, z); dungeonGroup.add(lt); } }
    else if (th.deco === 'ice') { const cl = new THREE.Group(); for (let k = 0; k < rand(2, 4); k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(rand(0.25, 0.55), rand(1.6, 3.6), 5), new THREE.MeshPhongMaterial({ specular: 0x88aacc, shininess: 50, color: 0xbfe8ff, emissive: 0x244a66, emissiveIntensity: .5, flatShading: true, map: texCrystal(1, 2) })); c.position.set(rand(-0.8, 0.8), rand(.9, 1.8), rand(-0.8, 0.8)); c.rotation.set(rand(-.3, .3), rand(0, 6), rand(-.3, .3)); cl.add(c); } cl.position.set(x, 0, z); dungeonGroup.add(cl); if (lit) { const lt = regLight(new THREE.PointLight(0x9fd8ff, 0.8 * Math.PI, 16, 2)); lt.position.set(x, 3, z); dungeonGroup.add(lt); } }
    else if (th.deco === 'swamp') { const pool = new THREE.Mesh(new THREE.CircleGeometry(rand(2, 4.5), 18), new THREE.MeshPhongMaterial({ specular: 0x102010, color: 0x2a3a22, emissive: 0x0a1a08, map: texWater(2, 2) })); pool.rotation.x = -Math.PI / 2; pool.position.set(x, 0.14, z); dungeonGroup.add(pool); const reeds = new THREE.Group(); for (let k = 0; k < rand(2, 5); k++) { const rd = new THREE.Mesh(new THREE.ConeGeometry(0.08, rand(1.4, 3), 4), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x3a4a26, flatShading: true })); rd.position.set(rand(-1.6, 1.6), rand(.7, 1.5), rand(-1.6, 1.6)); reeds.add(rd); } reeds.position.set(x, 0, z); dungeonGroup.add(reeds); if (lit) { const lt = regLight(new THREE.PointLight(0x6a9a4a, 0.7 * Math.PI, 15, 2)); lt.position.set(x, 2, z); dungeonGroup.add(lt); } }
    else if (th.deco === 'bonepile') { const pile = new THREE.Group(); for (let k = 0; k < rand(3, 6); k++) { const bn = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, rand(0.8, 2), 5), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0xcfc4ac, flatShading: true, map: texStone(1, 2) })); bn.position.set(rand(-0.9, 0.9), rand(.2, .7), rand(-0.9, 0.9)); bn.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6)); pile.add(bn); } const skull = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 7), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0xe8e0cc, flatShading: true, map: texSkin(1, 1) })); skull.position.set(0, 0.42, 0); pile.add(skull); pile.position.set(x, 0, z); dungeonGroup.add(pile); if (lit) { const lt = regLight(new THREE.PointLight(0xffcf8a, 0.7 * Math.PI, 15, 2)); lt.position.set(x, 2, z); dungeonGroup.add(lt); } }
    else { const b = new THREE.Mesh(new THREE.SphereGeometry(rand(0.3, 0.6), 6, 5), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0xcfc4ac, flatShading: true })); b.position.set(x, 0.3, z); dungeonGroup.add(b); }
  }
  if (useProps) { // KayKit furniture scatter (untinted atlas reads as wood/metal); InstancedMesh -> bypasses merge, keeps PBR
    const FURN_H = { barrel_large: 1.6, barrel_small: 1.1, box_large: 1.4, box_small: 0.95, crates_stacked: 2.2, table_medium: 1.3 };
    for (const k of Object.keys(FURN_H)) { if (!PROP_PROTO[k]) continue; const metas = []; for (let i = 0; i < 4; i++) { const s = FURN_H[k] / PROP_PROTO[k].base * rand(0.9, 1.1); metas.push({ s, cr: Math.max(PROP_PROTO[k].size.x, PROP_PROTO[k].size.z) * s * 0.5 }); } addScatter(PROP_PROTO[k].geo, PROP_PROTO[k].mat, metas, { cast: true, recv: true }); }
    if (PROP_PROTO['chest']) { const cs = 1.1 / PROP_PROTO['chest'].base; const metas = []; for (let i = 0; i < 2; i++) metas.push({ s: cs, cr: PROP_PROTO['chest'].size.x * cs * 0.6 }); addScatter(PROP_PROTO['chest'].geo, PROP_PROTO['chest'].mat, metas, { cast: true, recv: true }); }
  }
  {
    const M2 = new THREE.Matrix4(), Q2 = new THREE.Quaternion(), E2 = new THREE.Euler(), V2 = new THREE.Vector3(), S2 = new THREE.Vector3();
    const dim = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.35, 0), new THREE.MeshPhongMaterial({ specular: 0x000000, color: th.rock, flatShading: true, map: texStone(1, 1) }), 36); dim.receiveShadow = true; dim.frustumCulled = false;
    for (let i = 0; i < 36; i++) { const ang = rand(0, 6.28), d = rand(6, R - 4), x = Math.cos(ang) * d, z = Math.sin(ang) * d, s = rand(0.5, 1.4); E2.set(rand(0, 6), rand(0, 6), rand(0, 6)); Q2.setFromEuler(E2); V2.set(x, s * 0.18, z); S2.set(s, s * 0.6, s); M2.compose(V2, Q2, S2); dim.setMatrixAt(i, M2); } dim.instanceMatrix.needsUpdate = true; dungeonGroup.add(dim);
  }
  { /* KayKit modular stone hall: rectangular wall ring + corners + doorways + wall torches (shared dungeon atlas, biome-tinted).
       Walls/corners/torches are InstancedMesh (skip merge); the rectangular clamp (clampEntToZone) is the boundary, so no wall colliders.
       Falls back to the (enlarged) persistent brick backdrop cylinder if the arch kit failed to load. */
    const hasArch = useProps && PROP_PROTO['wall'] && PROP_PROTO['wall_corner'];
    if (hasArch) {
      const HW = DUNG_HALF, WL = HW + 2, WALL_H = 7.5;
      const wp = PROP_PROTO['wall'], ws = WALL_H / wp.base, segW = wp.size.x * ws;
      const wallMat = tintPropMat(wp.mat, th.pillar);
      const n = Math.max(4, Math.round((2 * HW) / segW)), step = (2 * HW) / n, doorI = Math.floor(n / 2);
      const wtf = [];
      /** @type {Array<{x:number,z:number,ry:number,s?:number}>} */
      const dtf = [];
      for (let i = 0; i < n; i++) {
        const t = -HW + (i + 0.5) * step;
        if (i === doorI) { dtf.push({ x: t, z: -WL, ry: 0 }, { x: t, z: WL, ry: Math.PI }); }
        else { wtf.push({ x: t, z: -WL, s: ws, ry: 0 }, { x: t, z: WL, s: ws, ry: Math.PI }); }
        wtf.push({ x: -WL, z: t, s: ws, ry: Math.PI / 2 }, { x: WL, z: t, s: ws, ry: -Math.PI / 2 });
      }
      makePropInst(wp.geo, wallMat, wtf, dungeonGroup, { cast: true, recv: true });
      // doorway frames at the N/S gaps (entrance + deeper-portal exit); fall back to plain wall if the doorway proto is missing
      if (PROP_PROTO['wall_doorway']) { const dp = PROP_PROTO['wall_doorway'], dsc = WALL_H / dp.base; for (const d of dtf) d.s = dsc; makePropInst(dp.geo, tintPropMat(dp.mat, th.pillar), dtf, dungeonGroup, { cast: true, recv: true }); }
      else { for (const d of dtf) d.s = ws; makePropInst(wp.geo, wallMat, dtf, dungeonGroup, { cast: true, recv: true }); }
      // corners
      const cp = PROP_PROTO['wall_corner'], csc = WALL_H / cp.base;
      makePropInst(cp.geo, tintPropMat(cp.mat, th.pillar), [{ x: -WL, z: -WL, s: csc, ry: 0 }, { x: WL, z: -WL, s: csc, ry: -Math.PI / 2 }, { x: WL, z: WL, s: csc, ry: Math.PI }, { x: -WL, z: WL, s: csc, ry: Math.PI / 2 }], dungeonGroup, { cast: true, recv: true });
      // wall-mounted torches (every 3rd segment) + additive flame embers (visual glow only — no per-torch PointLight, so the light budget is untouched)
      if (PROP_PROTO['torch_mounted']) {
        const tp = PROP_PROTO['torch_mounted'], tsc = 2.8 / tp.base, inset = WL - 1.1, ti = [];
        for (let i = 0; i < n; i++) { if (i % 3 !== 1) continue; const t = -HW + (i + 0.5) * step; ti.push({ x: t, z: -inset, s: tsc, ry: 0 }, { x: t, z: inset, s: tsc, ry: Math.PI }, { x: -inset, z: t, s: tsc, ry: Math.PI / 2 }, { x: inset, z: t, s: tsc, ry: -Math.PI / 2 }); }
        if (ti.length) {
          makePropInst(tp.geo, tp.mat, ti, dungeonGroup, { cast: false, recv: false });
          const flameMat = new THREE.MeshBasicMaterial({ color: th.fire, map: texFlame(1, 1), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
          makePropInst(new THREE.ConeGeometry(0.42, 1.1, 6), flameMat, ti.map(t => ({ x: t.x, z: t.z, y: 2.5, s: 0.7 })), dungeonGroup, { cast: false, recv: false });
          /* budgeted torch lights at a spaced subset — cullLights keeps only the PL_MAX nearest visible, so the
             wall the player is near lights up (torchlit hall) while distant torches stay dark candidates. */
          for (let j = 0; j < ti.length; j += 2) { const lt = regLight(new THREE.PointLight(th.fire, 1.2 * Math.PI, 22, 2)); lt.position.set(ti[j].x, 3.0, ti[j].z); dungeonGroup.add(lt); }
        }
      }
      // central floor dais under the deeper portal (accent tile, biome-tinted)
      if (PROP_PROTO['floor_tile_large_rocks']) { const fp = PROP_PROTO['floor_tile_large_rocks'], fsc = fp.size.x ? 5.2 / fp.size.x : 1; makePropInst(fp.geo, tintPropMat(fp.mat, th.ground), [{ x: 0, z: -50, sx: fsc, sy: 1, sz: fsc, y: 0.05 }], dungeonGroup, { recv: true }); }
    }
  }
  try { mergeStaticScenery(dungeonGroup, new Set(fires.map(f => f.flame))); } catch (e) { console.warn('dungeon scenery merge failed; using unmerged:', e && e.message); } /* collapse static deco draws; skip animated fire flames. InstancedMesh scatter is skipped by merge, so it stays re-randomizable. */
}

/* ---- hero ---- */
/* ===================== glTF animated roster: KayKit hero + Quaternius monsters, SkeletonUtils-cloned + AnimationMixer-driven; procedural fallback until models parse ===================== */
const GLB_MANIFEST = {"hero":{"file":"hero.glb","bytes":2474424},"zombie":{"file":"zombie.glb","bytes":129956},"fallen":{"file":"fallen.glb","bytes":203148},"brute":{"file":"brute.glb","bytes":499836},"shaman":{"file":"shaman.glb","bytes":90632},"boss":{"file":"boss.glb","bytes":540700},"vendor":{"file":"vendor.glb","bytes":340752},"smith":{"file":"smith.glb","bytes":352692},"stash":{"file":"stash.glb","bytes":341684},"alchemist":{"file":"npcs/Rogue_Hooded.glb","bytes":381000},"enchanter":{"file":"heroes/Mage.glb","bytes":352472},"gambler":{"file":"npcs/Ranger.glb","bytes":485000},"jeweler":{"file":"npcs/Barbarian.glb","bytes":386000},"premiumVendor":{"file":"heroes/Knight.glb","bytes":341688},"warrior":{"file":"heroes/Knight.glb","bytes":341688},"mage":{"file":"heroes/Mage.glb","bytes":352472},"rogue":{"file":"heroes/Rogue.glb","bytes":409188},"skeleton":{"file":"monsters/Skeleton_Minion.glb","bytes":318520},"imp":{"file":"monsters/Demon.gltf","bytes":1264925},"hellhound":{"file":"monsters/Dino.gltf","bytes":1211215},"wraith":{"file":"monsters/Ghost.gltf","bytes":643180},"boss_mushking":{"file":"bosses/MushroomKing.gltf","bytes":1219690},"boss_bluedemon":{"file":"bosses/BlueDemon.gltf","bytes":1190068},"boss_goleling":{"file":"bosses/Goleling_Evolved.gltf","bytes":494339},"boss_mushnub":{"file":"bosses/Mushnub_Evolved.gltf","bytes":246194},"boss_dragon":{"file":"bosses/Dragon.gltf","bytes":427100},"boss_dragonevo":{"file":"bosses/Dragon_Evolved.gltf","bytes":991335}}; const GLB_BASE = 'assets/models/'; /* P3: roster extracted to external GLBs; loaded async by loadRoster */
const ROLE_CLIPS = { hero: { idle: 'Idle', walk: 'Walking_A', run: 'Running_A', attack: '1H_Melee_Attack_Chop', death: 'Death_A' }, zombie: { idle: 'Idle', walk: 'Walk', attack: 'Bite_Front', death: 'Death', hit: 'HitRecieve' }, fallen: { idle: 'Idle', walk: 'Walk', attack: 'Bite_Front', death: 'Death', hit: 'HitRecieve' }, shaman: { idle: 'Idle', walk: 'Walk', attack: 'Bite_Front', death: 'Death', hit: 'HitRecieve' }, brute: { idle: 'Idle', walk: 'Walk', run: 'Run', attack: 'Punch', death: 'Death', hit: 'HitReact' }, boss: { idle: 'Idle', walk: 'Walk', run: 'Run', attack: 'Punch', death: 'Death', hit: 'HitReact' } };
const ROLE_HEIGHT = { hero: 3.4, zombie: 3.2, fallen: 2.4, brute: 5.2, shaman: 3.0, boss: 8.5 };
const ROLE_FACE = 0; /* model-forward offset so they face the player after lookAt; flip 0<->Math.PI if they face backwards (TUNABLE by eye) */
const NPC_KINDS = new Set(['vendor', 'smith', 'stash', 'alchemist', 'enchanter', 'gambler', 'jeweler', 'premiumVendor']);
Object.assign(ROLE_CLIPS, { vendor: { idle: 'Idle' }, smith: { idle: 'Idle' }, stash: { idle: 'Idle' } });
Object.assign(ROLE_HEIGHT, { vendor: 3.2, smith: 3.4, stash: 3.2 });
/* the 5 added shopkeepers reuse existing KayKit Adventurer/hero meshes (no clips of their own) -> RIG_ROLES below so they borrow the shared Idle_A; weapons stripped at swap by stripNPCWeapons */
Object.assign(ROLE_CLIPS, { alchemist: { idle: 'Idle_A' }, enchanter: { idle: 'Idle_A' }, gambler: { idle: 'Idle_A' }, jeweler: { idle: 'Idle_A' }, premiumVendor: { idle: 'Idle_A' } });
Object.assign(ROLE_HEIGHT, { alchemist: 3.2, enchanter: 3.3, gambler: 3.2, jeweler: 3.4, premiumVendor: 3.4 });
/* Per-class hero meshes + extra monster variety. KayKit chars (warrior/mage/rogue/skeleton) ship 0 clips -> borrow the shared Rig_Medium set (verified 100% bone-name match). Quaternius monsters carry their own clips. */
const RIG_BASE = 'assets/animations/', RIG_FILES = ['Rig_Medium_General.glb', 'Rig_Medium_MovementBasic.glb', 'Rig_Medium_CombatMelee.glb']; const KAYKIT_RIG_CLIPS = []; const RIG_ROLES = new Set(['warrior', 'mage', 'rogue', 'skeleton', 'alchemist', 'enchanter', 'gambler', 'jeweler', 'premiumVendor']); const HERO_ROLE = { warrior: 'warrior', mage: 'mage', rogue: 'rogue' };
const _RIG_CLIPMAP = { idle: 'Idle_A', walk: 'Walking_A', run: 'Running_A', attack: 'Melee_1H_Attack_Chop', death: 'Death_A', hit: 'Hit_A' };
Object.assign(ROLE_CLIPS, { warrior: _RIG_CLIPMAP, mage: _RIG_CLIPMAP, rogue: _RIG_CLIPMAP, skeleton: _RIG_CLIPMAP, imp: { idle: 'Idle', walk: 'Walk', run: 'Run', attack: 'Punch', death: 'Death', hit: 'HitReact' }, hellhound: { idle: 'Idle', walk: 'Walk', run: 'Run', attack: 'Punch', death: 'Death', hit: 'HitReact' }, wraith: { idle: 'Flying_Idle', walk: 'Fast_Flying', attack: 'Punch', death: 'Death', hit: 'HitReact' } });
Object.assign(ROLE_HEIGHT, { warrior: 3.4, mage: 3.4, rogue: 3.4, skeleton: 3.0, imp: 2.4, hellhound: 2.0, wraith: 3.4 });
/* Distinct boss roster (assets/models/bosses). Two rig families reuse clip maps already proven on the monster roster:
   humanoid (Demon/Dino-style: Idle/Walk/Run/Punch) and flying (Ghost-style: Flying_Idle/Fast_Flying/Headbutt). Mushnub is its own. */
const _BCLH = { idle: 'Idle', walk: 'Walk', run: 'Run', attack: 'Punch', death: 'Death', hit: 'HitReact' };
const _BCLF = { idle: 'Flying_Idle', walk: 'Fast_Flying', attack: 'Headbutt', death: 'Death', hit: 'HitReact' };
Object.assign(ROLE_CLIPS, { boss_mushking: _BCLH, boss_bluedemon: _BCLH, boss_goleling: _BCLF, boss_dragon: _BCLF, boss_dragonevo: _BCLF, boss_mushnub: { idle: 'Idle', walk: 'Walk', attack: 'Bite_Front', death: 'Death', hit: 'HitRecieve' } });
Object.assign(ROLE_HEIGHT, { boss_mushking: 8.5, boss_bluedemon: 8.0, boss_goleling: 7.5, boss_mushnub: 6.5, boss_dragon: 9.5, boss_dragonevo: 12.0 });
function curHeroRole() { return (typeof character !== 'undefined' && character && HERO_ROLE[character.class]) || 'hero'; }
const GLB_PROTO = {}; let GLB_READY = false; const _dying = [];
function buildGLBEntity(role, mul) {
  mul = mul || 1; const p = GLB_PROTO[role]; if (!p || !(window.THREE && THREE.SkeletonUtils)) return null;
  const g = new THREE.Group(); const model = THREE.SkeletonUtils.clone(p.scene); model.scale.setScalar(p.scale * mul); model.position.y = p.yOff * mul; model.rotation.y = ROLE_FACE;
  model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  g.add(model); const mixer = new THREE.AnimationMixer(model); const byName = {}; for (const c of p.clips) byName[c.name] = c;
  const map = ROLE_CLIPS[role] || {}, actions = {}; for (const k in map) { const cl = byName[map[k]]; if (cl) actions[k] = mixer.clipAction(cl); }
  g.userData.mixer = mixer; g.userData.actions = actions; g.userData.model = model; g.userData.glb = true; g.userData.noDispose = true;
  const start = actions.walk || actions.idle; if (start) { start.play(); g.userData.cur = start; } return g;
}
function glbPlay(g, key, once) { const acts = g.userData && g.userData.actions; if (!acts) return; const a = acts[key]; if (!a || g.userData.cur === a) return; if (g.userData.cur) g.userData.cur.fadeOut(0.15); a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity); a.clampWhenFinished = !!once; a.fadeIn(0.15).play(); g.userData.cur = a; }
function killMesh(m) { const g = m.mesh, ud = g && g.userData; if (ud && ud.glb && ud.actions && ud.actions.death) { _ev('deathAnim'); glbPlay(g, 'death', true); _dying.push({ g, t: 1400 }); } else removeMob(g); }
/* KayKit Adventurer/hero meshes bake the FULL weapon set onto handslot.r/.l (1H_Axe, 2H_Staff, Knife, Shield, Quiver…).
   Town NPCs are shopkeepers -> hide every weapon/held-item node by name (tokens word-anchored so 'elbow' != 'Bow'),
   plus hide any leftover children of the handslot bones. Spellbook/Mug kept as merchant flavor (e.g. mage-vendor's book). */
const NPC_WEAPON_RE = /(^|_)(1H|2H|Sword|Blade|Scimitar|Glaive|Axe|Cleaver|Mace|Hammer|Flail|Dagger|Knife|Spear|Bow|Crossbow|Longbow|Shortbow|Recurve|Quiver|Staff|Wand|Scepter|Rod|Shield|Throwable|Arrow)(_|$)/i;
const NPC_WEAPON_KEEP = /Spellbook|Mug/i;
function stripNPCWeapons(model) {
  if (!model) return;
  model.traverse(o => { const nm = o.name; if (!nm || NPC_WEAPON_KEEP.test(nm)) return; if (NPC_WEAPON_RE.test(nm)) o.visible = false; });
  for (const bn of ['handslotr', 'handslotl', 'handslot_r', 'handslot_l']) { const b = model.getObjectByName(bn); if (b) for (const c of b.children) { if (!NPC_WEAPON_KEEP.test(c.name || '')) c.visible = false; } }
}
function swapNPCsToGLB(kind) { if (!GLB_PROTO[kind] || typeof npcs === 'undefined') return; for (const n of npcs) { if (n.kind !== kind || n.group.userData.npcEnt) continue; const ent = buildGLBEntity(kind, 1); if (!ent) continue; stripNPCWeapons(ent.userData.model); if (n.group.userData.procBody) n.group.userData.procBody.visible = false; n.group.add(ent); n.group.userData.npcEnt = ent; glbPlay(ent, 'idle'); } }
/* ===================== hero weapon: static KayKit weapon GLB parented to the rig's handslot.r bone =====================
   Loot-driven model (item.base -> WEAPON_MODEL), class default for uniques/unarmed. Loaded at NATIVE scale via a dedicated
   cache (NOT GLB_MANIFEST, which height-normalizes). The attack animation swings the arm, so the bone-parented weapon follows. */
const WEAPON_BASE_PATH = 'assets/models/weapons/';
const WEAPON_FILES = { sword1h: 'sword_1handed.gltf', sword2h: 'sword_2handed.gltf', axe1h: 'axe_1handed.gltf', axe2h: 'axe_2handed.gltf', dagger: 'dagger.gltf', staff: 'staff.gltf', wand: 'wand.gltf', bow: 'bow.gltf', crossbow: 'crossbow_1handed.gltf' };
const WEAPON_MODEL = { Sword: 'sword1h', Blade: 'sword1h', Scimitar: 'sword1h', Glaive: 'sword2h', Axe: 'axe1h', Cleaver: 'axe1h', Mace: 'axe2h', 'War Hammer': 'axe2h', Flail: 'axe2h', Dagger: 'dagger', Staff: 'staff', Spire: 'staff', Branch: 'staff', Scepter: 'wand', Rod: 'wand', Wand: 'wand', Bow: 'bow', Longbow: 'bow', Shortbow: 'bow', Recurve: 'bow', 'Hunting Bow': 'bow', Crossbow: 'crossbow' };
const WEAPON_CLASS_DEFAULT = { warrior: 'sword1h', mage: 'staff', rogue: 'bow' };
/* per-model mount offset in the handslot.r bone's local space — TUNE BY EYE (start identity; bow/staff/crossbow likely need rot) */
const WEAPON_FIX = { _default: { pos: [0, 0, 0], rot: [0, 0, 0], scale: 1 } };
const _weaponCache = {}; let _wLoader = null;
function loadWeaponProto(key, cb) {
  const file = WEAPON_FILES[key]; if (!file) return;
  if (_weaponCache[key]) { cb(_weaponCache[key]); return; }
  if (!(window.THREE && THREE.GLTFLoader)) return;
  if (!_wLoader) _wLoader = new THREE.GLTFLoader();
  _wLoader.load(WEAPON_BASE_PATH + file, gltf => { _weaponCache[key] = gltf.scene; cb(gltf.scene); }, undefined, err => console.warn('weapon load fail: ' + file, err));
}
function pickWeaponKey() {
  const w = (typeof character !== 'undefined' && character && character.equipment) ? character.equipment.weapon : null;
  if (w && w.base && WEAPON_MODEL[w.base]) return WEAPON_MODEL[w.base];
  return WEAPON_CLASS_DEFAULT[(typeof character !== 'undefined' && character && character.class)] || 'sword1h';
}
function attachHeroWeapon() {
  if (typeof hero === 'undefined' || !hero || !hero.userData.glb) return; /* procedural hero keeps its userData.sword */
  const model = hero.userData.model; if (!model) return;
  const bone = model.getObjectByName('handslotr') || model.getObjectByName('handr'); if (!bone) return; /* GLTFLoader strips dots: handslot.r -> handslotr (child of handr->wristr->arm, so it tracks the attack swing) */
  if (hero.userData.weaponMesh) { bone.remove(hero.userData.weaponMesh); hero.userData.weaponMesh = null; } /* cached proto -> no dispose */
  const key = pickWeaponKey(); const tok = (hero.userData._wtok = (hero.userData._wtok || 0) + 1);
  loadWeaponProto(key, scene => {
    if (hero.userData._wtok !== tok || !hero.userData.glb) return; /* class/weapon changed mid-load */
    const w = scene.clone(true); const f = WEAPON_FIX[key] || WEAPON_FIX._default;
    w.position.fromArray(f.pos); w.rotation.fromArray(f.rot); w.scale.setScalar(f.scale != null ? f.scale : 1);
    w.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    bone.add(w); hero.userData.weaponMesh = w;
  });
}
function swapHeroToGLB() { if (typeof hero === 'undefined' || !hero) return; let role = curHeroRole(); if (!GLB_PROTO[role]) role = 'hero'; if (!GLB_PROTO[role]) return; if (hero.userData.glbRole === role && hero.userData.glbEnt) return; /* already showing this role's rig — re-adding would stack another hidden skinned clone every load/revive */ const ent = buildGLBEntity(role, 1); if (!ent) return; const prev = hero.userData.glbEnt; if (prev) { if (prev.userData.mixer) prev.userData.mixer.stopAllAction(); hero.remove(prev); } /* SkeletonUtils clones share the proto's geo/mat (noDispose), so just stop the mixer + detach and let GC reclaim the clone — never dispose, or the shared proto buffers die */ hero.children.forEach(c => c.visible = false); hero.add(ent); hero.userData.glbEnt = ent; hero.userData.mixer = ent.userData.mixer; hero.userData.actions = ent.userData.actions; hero.userData.model = ent.userData.model; hero.userData.glb = true; hero.userData.glbRole = role; hero.userData.sword = null; glbPlay(hero, 'idle'); attachHeroWeapon(); }
/* ===================== KayKit prop kits (dungeon + nature) — each kit is ONE opaque atlas material; we extract
   the prop names we use into reusable {geo,mat,size,base} prototypes drawn as InstancedMesh (dungeon/wild) or
   merged meshes (town). Shared geo/mat carry userData.sharedProto so disposeObj skips them across zone rebuilds. */
const PROP_KIT_MANIFEST = { dungeon: { file: 'dungeon.glb', bytes: 4650000 }, dungeon_arch: { file: 'dungeon_arch.glb', bytes: 227020 }, nature: { file: 'nature.glb', bytes: 1290000 } };
const PROP_PROTO = {}; let PROPS_READY = false; /* name -> { geo, mat, size:Vector3, base:number } */
const DUNGEON_PROPS = ['pillar', 'column', 'pillar_decorated', 'rubble_large', 'rubble_half', 'barrel_large', 'barrel_small', 'box_large', 'box_small', 'crates_stacked', 'table_medium', 'chest'];
/* KayKit Dungeon Remastered modular architecture, packed separately into dungeon_arch.glb (same single
   dungeon_texture.png atlas as the dungeon kit). buildDungeon lays these as a rectangular stone hall. */
const ARCH_PROPS = ['wall', 'wall_corner', 'wall_doorway', 'wall_broken', 'torch_mounted', 'floor_tile_large_rocks'];
/* all share nature.glb's single atlas (1 material / 1 image) → every variant instances for free. Must cover the
   union of every REGIONS biome's trees/bushes/grasses/rocks lists. */
const NATURE_PROPS = [
  'Tree_1_A_Color1', 'Tree_2_A_Color1', 'Tree_3_A_Color1', 'Tree_4_A_Color1', 'Tree_Bare_1_A_Color1', 'Tree_Bare_2_A_Color1',
  'Rock_1_A_Color1', 'Rock_2_A_Color1', 'Rock_3_A_Color1', 'Rock_1_E_Color1', 'Rock_2_C_Color1', 'Rock_3_C_Color1',
  'Bush_1_A_Color1', 'Bush_2_A_Color1', 'Bush_3_A_Color1', 'Bush_4_A_Color1',
  'Grass_1_A_Color1', 'Grass_2_A_Color1', 'Grass_1_C_Color1', 'Grass_2_C_Color1',
];
const TOWN_PROPS = ['barrel_large', 'barrel_small', 'box_large', 'crates_stacked', 'bottle_A_labeled_green', 'banner_red', 'banner_blue', 'banner_green']; /* all live in dungeon.glb */
function _concatPropGeos(geos) { /* like _concatGeos but position/normal/uv only (KayKit geos have no color attr) */
  let total = 0; for (const g of geos) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2); let off = 0;
  for (const g of geos) { const n = g.attributes.position.count; pos.set(g.attributes.position.array, off * 3); nor.set(g.attributes.normal.array, off * 3); uv.set(g.attributes.uv.array, off * 2); off += n; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}
function _extractProp(root, name) { /* named node -> prop-local geometry re-based to y=0, ready for InstancedMesh */
  const node = root.getObjectByName(name); if (!node) { console.warn('prop miss: ' + name); return null; }
  const c = node.clone(true); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1); c.updateMatrixWorld(true);
  /** @type {any[]} */
  const geos = [];
  /** @type {any} */
  let mat = null;
  c.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes.position && o.geometry.attributes.uv) { const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld); if (!g.attributes.normal) g.computeVertexNormals(); geos.push(g); if (!mat) mat = o.material; } });
  if (!geos.length || !mat) { console.warn('prop empty: ' + name); return null; }
  const geo = geos.length === 1 ? geos[0] : _concatPropGeos(geos);
  geo.computeBoundingBox(); const bb = geo.boundingBox, size = new THREE.Vector3(); bb.getSize(size);
  geo.translate(0, -bb.min.y, 0); geo.computeBoundingBox(); /* keep KayKit authored normals (applyMatrix4 already transformed them); recomputing on non-indexed geo would force flat shading */
  geo.userData.sharedProto = true; mat.userData = Object.assign(mat.userData || {}, { sharedProto: true });
  return { geo, mat, size, base: size.y || 1 };
}
/* ===================== KayKit Medieval Builder buildings (buildings.glb) — multi-material vertex-color models
   (no atlas), RTS-tiny so scaled by footprint. Few per town & multi-material → clone whole scene per placement
   (NOT instanced) and let mergeStaticScenery collapse their color primitives. Proto geo/mat flagged sharedProto. */
const BUILDING_MANIFEST = { file: 'buildings.glb', bytes: 941000 };
const BUILDING_PROTO = {}; let BUILDINGS_READY = false; /* name -> { node, size:Vector3, minY } */
const BUILDING_NAMES = ['house', 'castle', 'barracks', 'market', 'mill', 'watermill', 'lumbermill', 'mine', 'well', 'watchtower', 'archeryrange', 'farm_plot', 'wall_straight', 'wall_corner', 'wall_gate', 'wall_gate_closed', 'bridge', 'bridge_roofed'];
function _extractBuilding(scene, name) {
  const node = scene.getObjectByName(name); if (!node) { console.warn('building miss: ' + name); return null; }
  const bb = new THREE.Box3().setFromObject(node), size = new THREE.Vector3(); bb.getSize(size);
  node.traverse(o => { if (o.isMesh) { if (o.geometry) o.geometry.userData.sharedProto = true; const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) if (m) m.userData = Object.assign(m.userData || {}, { sharedProto: true }); } });
  return { node, size, minY: bb.min.y };
}
function loadRoster() {
  if (!(window.THREE && THREE.GLTFLoader && THREE.SkeletonUtils)) { console.warn('glTF roster: GLTFLoader/SkeletonUtils missing -> procedural models'); return; }
  const loader = new THREE.GLTFLoader();
  function startModels() {
    const roles = Object.keys(GLB_MANIFEST), propKeys = Object.keys(PROP_KIT_MANIFEST);
    const totalBytes = roles.reduce((a, r) => a + GLB_MANIFEST[r].bytes, 0) + propKeys.reduce((a, k) => a + PROP_KIT_MANIFEST[k].bytes, 0) + BUILDING_MANIFEST.bytes;
    const got = {}; let pending = roles.length + propKeys.length + 1, propPending = propKeys.length;
    const fill = document.getElementById('modelfill'), barBox = document.getElementById('modelload');
    if (barBox) barBox.style.display = 'block';
    function progress() { if (!fill) return; let sum = 0; for (const r in got) sum += got[r]; fill.style.width = Math.min(100, (sum / totalBytes) * 100).toFixed(1) + '%'; }
    function done() { if (--pending <= 0) { GLB_READY = true; console.log('glTF roster loaded'); if (barBox) barBox.style.display = 'none'; rebuildZoneScenery(); } }
    for (const role of roles) {
      const m = GLB_MANIFEST[role];
      loader.load(GLB_BASE + m.file,
        gltf => {
          const sc = gltf.scene, bb = new THREE.Box3().setFromObject(sc), sz = new THREE.Vector3(); bb.getSize(sz); const scale = (ROLE_HEIGHT[role] || 3) / (sz.y || 1);
          GLB_PROTO[role] = { scene: sc, clips: RIG_ROLES.has(role) ? KAYKIT_RIG_CLIPS : (gltf.animations || []), scale, yOff: -bb.min.y * scale };
          if (role === 'hero' || role === curHeroRole()) swapHeroToGLB(); else if (NPC_KINDS.has(role)) swapNPCsToGLB(role);
          got[role] = m.bytes; progress(); done();
        },
        e => { if (e && e.lengthComputable) { got[role] = Math.min(e.loaded, m.bytes); progress(); } },
        err => { console.warn('glTF load fail: ' + role, err); got[role] = m.bytes; progress(); done(); }
      );
    }
    for (const key of propKeys) {
      const m = PROP_KIT_MANIFEST[key];
      loader.load(GLB_BASE + m.file,
        gltf => {
          const KIT_NAMES = { dungeon: [...DUNGEON_PROPS, ...TOWN_PROPS], dungeon_arch: ARCH_PROPS, nature: NATURE_PROPS };
          const names = new Set(KIT_NAMES[key] || []);
          for (const nm of names) { if (!PROP_PROTO[nm]) { const p = _extractProp(gltf.scene, nm); if (p) PROP_PROTO[nm] = p; } }
          got[key] = m.bytes; progress();
          if (--propPending <= 0) { PROPS_READY = true; console.log('prop kits loaded'); rebuildZoneScenery(); }
          done();
        },
        e => { if (e && e.lengthComputable) { got[key] = Math.min(e.loaded, m.bytes); progress(); } },
        err => { console.warn('prop kit load fail: ' + key, err); got[key] = m.bytes; progress(); if (--propPending <= 0) PROPS_READY = true; done(); }
      );
    }
    loader.load(GLB_BASE + BUILDING_MANIFEST.file,
      gltf => {
        gltf.scene.updateMatrixWorld(true);
        for (const nm of BUILDING_NAMES) { const b = _extractBuilding(gltf.scene, nm); if (b) BUILDING_PROTO[nm] = b; }
        got.buildings = BUILDING_MANIFEST.bytes; progress(); BUILDINGS_READY = true; console.log('buildings loaded');
        rebuildZoneScenery();
        done();
      },
      e => { if (e && e.lengthComputable) { got.buildings = Math.min(e.loaded, BUILDING_MANIFEST.bytes); progress(); } },
      err => { console.warn('buildings load fail', err); got.buildings = BUILDING_MANIFEST.bytes; progress(); BUILDINGS_READY = true; done(); }
    );
  }
  /* KayKit character meshes ship 0 clips -> load the shared Rig_Medium set FIRST, then the models (rig-driven roles reference KAYKIT_RIG_CLIPS, populated by now). Models still load if a rig fetch fails; those roles just stay static. */
  let rigPending = RIG_FILES.length; if (!rigPending) startModels();
  RIG_FILES.forEach(fn => loader.load(RIG_BASE + fn,
    gltf => { for (const c of (gltf.animations || [])) KAYKIT_RIG_CLIPS.push(c); if (--rigPending <= 0) startModels(); },
    undefined,
    err => { console.warn('rig clips load fail: ' + fn, err); if (--rigPending <= 0) startModels(); }
  ));
}
function buildHero() {
  const g = new THREE.Group();
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0x6a2018, roughness: 0.86, metalness: 0.05, flatShading: true, map: texCloth(2, 2), envMapIntensity: 0.5 })); cloak.position.y = 1.7; cloak.castShadow = true; g.add(cloak); g.userData.cloak = cloak;
  /* PBR metal armor over the robe — reads the shared scene.environment env map (same treatment as the sword blade / loot) */
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.95, 0.34), new THREE.MeshStandardMaterial({ color: 0x6b727e, roughness: 0.42, metalness: 0.82, map: texMetal(1, 2), envMapIntensity: 1.15 })); chest.position.set(0, 2.05, 0.42); chest.castShadow = true; g.add(chest); g.userData.chest = chest;
  const pmat = new THREE.MeshStandardMaterial({ color: 0x7a818c, roughness: 0.4, metalness: 0.85, map: texMetal(1, 1), envMapIntensity: 1.2 }); const pgeo = new THREE.SphereGeometry(0.42, 10, 8);
  const pL = new THREE.Mesh(pgeo, pmat); pL.position.set(-0.4, 2.55, 0); pL.scale.set(1, 0.62, 1); pL.castShadow = true; g.add(pL);
  const pR = new THREE.Mesh(pgeo, pmat); pR.position.set(0.4, 2.55, 0); pR.scale.set(1, 0.62, 1); pR.castShadow = true; g.add(pR);
  /* sleeved arms + hands + waist belt + gorget — articulate the robed silhouette */
  const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x5a1a12, roughness: 0.85, metalness: 0.05, flatShading: true, map: texCloth(1, 2), envMapIntensity: 0.4 }); const armGeo = new THREE.CylinderGeometry(0.18, 0.22, 1.5, 6);
  const aL = new THREE.Mesh(armGeo, sleeveMat); aL.position.set(-0.62, 1.95, 0.06); aL.rotation.z = 0.16; aL.castShadow = true; g.add(aL);
  const aR = new THREE.Mesh(armGeo, sleeveMat); aR.position.set(0.62, 1.95, 0.12); aR.rotation.z = -0.16; aR.castShadow = true; g.add(aR);
  const handMat = new THREE.MeshStandardMaterial({ color: 0xc9a36a, roughness: 0.8, metalness: 0, map: texSkin(1, 1) }); const handGeo = new THREE.SphereGeometry(0.17, 8, 6);
  const hL = new THREE.Mesh(handGeo, handMat); hL.position.set(-0.72, 1.2, 0.08); g.add(hL); const hR = new THREE.Mesh(handGeo, handMat); hR.position.set(0.82, 1.25, 0.2); g.add(hR);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.1, 6, 16), new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.6, metalness: 0.25, map: texWood(2, 1), envMapIntensity: 0.5 })); belt.rotation.x = Math.PI / 2; belt.position.y = 1.55; g.add(belt);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x55504a, roughness: 0.5, metalness: 0.6, map: texMetal(1, 1), envMapIntensity: 0.9 })); neck.position.y = 2.95; neck.castShadow = true; g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), new THREE.MeshStandardMaterial({ color: 0xc9a36a, roughness: 0.82, metalness: 0.0, map: texSkin(1, 1) })); head.position.y = 3.4; head.castShadow = true; g.add(head);
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1, 8), new THREE.MeshStandardMaterial({ color: 0x3a1810, roughness: 0.9, metalness: 0.05, flatShading: true, map: texCloth(2, 2), envMapIntensity: 0.4 })); hood.position.y = 3.9; g.add(hood);
  const sword = new THREE.Group(); const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3, 0.16), new THREE.MeshStandardMaterial({ color: 0xd8e0ec, metalness: 0.92, roughness: 0.34, map: texMetal(1, 3), envMapIntensity: 1.25 })); blade.position.y = 1.5; sword.add(blade);
  const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.18), new THREE.MeshStandardMaterial({ color: 0x8a6a2a, roughness: 0.55, metalness: 0.35, map: texWood(1, 2), envMapIntensity: 0.6 })); sword.add(hilt); sword.position.set(1.1, 2, 0.4); g.add(sword); g.userData.sword = sword; return g;
}
const hero = buildHero(); scene.add(hero);
loadRoster();

const player = { x: 0, z: 0, r: 1.4, speed: 0.32, hp: 100, hpMax: 100, mp: 50, mpMax: 50, level: 1, xp: 0, xpNext: 30, gold: 0, kills: 0, dmg: 14, attackCd: 0, attackRate: 420, range: 3.2, potions: 4, dir: 0, swing: 0, bob: 0, armor: 0, crit: 0.05, mpRegen: 0.004, chillUntil: 0, effects: { lifesteal: 0, thorns: 0, allskills: 0, movespeed: 0, critdmg: false, pierce: 0, dodge: 0, flatDR: 0, lifeOnHit: 0 }, goldFind: 0, cdr: 0, meleeMult: 1, spellMult: 1, buffs: { cryUntil: 0, cryMul: 1, cryDR: 0, empUntil: 0, empMul: 1, fleetUntil: 0, fleetMul: 1 } };
const empowerMul = () => (player.buffs.empUntil > now() ? player.buffs.empMul : 1); // shrine "Empowered" damage buff (timer-read, like War Cry)
// Effective skill cooldown after Cooldown Reduction. MUST be used by both the cast gate and the cooldown
// swirl render, or the on-screen timer desyncs from when the skill actually re-fires.
const skillCd = (def, id) => def.cd * (1 - (player.cdr || 0)) * (id ? resolveSkill(id).cdrMult : 1);

function recompute() {
  const b = character.base, st = character.stats, eq = character.equipment, sk = character.skills; const cls = CLASSES[character.class] || CLASSES.warrior;
  let dmg = b.dmg, hp = b.hpMax, mp = b.mpMax, armor = 0, crit = 5; const bonus = { dmg: 0, hp: 0, mp: 0, armor: 0, str: 0, vit: 0, eng: 0, crit: 0 };
  const eff = { lifesteal: 0, manaleech: 0, thorns: 0, allskills: 0, movespeed: 0, critdmg: false, critDmgPct: 0, pierce: 0, deathnova: 0, manaShield: 0, haste: 0, chillaura: false, echo: false, fireRes: 0, frostRes: 0, poisonRes: 0, lightningRes: 0, allRes: 0, burnProc: 0, bleedProc: 0, dodge: 0, flatDR: 0, lifeOnHit: 0 }; const setCount = {};
  for (const s of SLOTS) {
    const it = eq[s]; if (!it) continue; const uf = upFactor(it); if (it.slot === 'weapon') bonus.dmg += it.baseStat * uf; else bonus.armor += it.baseStat * uf; for (const k in it.affixes) bonus[k] = (bonus[k] || 0) + it.affixes[k] * uf; gemFold(it, bonus);
    if (it.enchant && it.enchant.key) bonus[it.enchant.key] = (bonus[it.enchant.key] || 0) + (it.enchant.val || 0) * uf;
    if (it.effect) { if (it.effect === 'critdmg') eff.critdmg = true; else eff[it.effect] = (eff[it.effect] || 0) + it.effVal; }
    if (it.set) { setCount[it.set] = (setCount[it.set] || 0) + 1; }
  }
  for (const sid in setCount) { const sd = SET_DEFS[sid]; if (!sd) continue; for (const thr in sd.bonuses) { if (setCount[sid] >= +thr) { const bb = sd.bonuses[thr]; for (const k in bb) { if (k === 'effect') { if (bb.effect === 'critdmg') eff.critdmg = true; else eff[bb.effect] = (eff[bb.effect] || 0) + (bb.effVal || 0); } else if (k !== 'effVal') bonus[k] = (bonus[k] || 0) + bb[k]; } } } }
  // allocated forest nodes
  const pm = { meleePct: 0, spellPct: 0, armorPct: 0, hpPct: 0, dmgPct: 0 };
  for (const pid of (character.passives || [])) {
    const nd = PTREE.nodes[pid]; if (!nd) continue; for (const k in nd.mods) {
      const v = nd.mods[k];
      if (k === 'critdmg') eff.critdmg = true; else if (k === 'chillaura') eff.chillaura = true; else if (k === 'echo') eff.echo = true;
      else if (k === 'allskills' || k === 'pierce' || k === 'lifesteal' || k === 'movespeed' || k === 'thorns' || k === 'deathnova' || k === 'manaShield' || k === 'haste') eff[k] = (eff[k] || 0) + v;
      else if (k === 'meleePct' || k === 'spellPct' || k === 'armorPct' || k === 'hpPct' || k === 'dmgPct') pm[k] += v;
      else bonus[k] = (bonus[k] || 0) + v;
    }
  }
  eff.allskills = (eff.allskills || 0) + Math.round(bonus.skillranks || 0);
  const all = eff.allskills || 0; const as = bonus.allstats || 0;
  const str = st.str + (bonus.str || 0) + as, dex = st.dex + (bonus.dex || 0) + as, vit = st.vit + (bonus.vit || 0) + as, eng = st.eng + (bonus.eng || 0) + as;
  dmg += bonus.dmg + Math.floor(str * 0.5); hp += bonus.hp + vit * 4; mp += bonus.mp + eng * 3; armor += bonus.armor; crit += (bonus.crit || 0) + dex * 0.1 + (cls.critBonus ? cls.critBonus * 100 : 0);
  const tough = sk.toughness > 0 ? sk.toughness + all : 0, prec = sk.precision > 0 ? sk.precision + all : 0, med = sk.meditation > 0 ? sk.meditation + all : 0;
  const ber = sk.berserk > 0 ? sk.berserk + all : 0, arc = sk.arcanemind > 0 ? sk.arcanemind + all : 0, swi = sk.swiftness > 0 ? sk.swiftness + all : 0;
  const iron = sk.ironskin > 0 ? sk.ironskin + all : 0, blood = sk.bloodlust > 0 ? sk.bloodlust + all : 0, pierce = sk.piercing > 0 ? sk.piercing + all : 0, deadly = sk.deadlyaim > 0 ? sk.deadlyaim + all : 0;
  hp = Math.round(hp * Math.max(0.2, 1 + 0.08 * tough + pm.hpPct / 100)); crit += 2 * prec + 2 * deadly; armor = Math.round(armor * (1 + 0.10 * iron + pm.armorPct / 100)); player.mpRegen = 0.004 * (1 + 0.4 * med) + (bonus.mpregen || 0) * 0.001 + eng * 0.0002; player.hpRegen = (bonus.hpregen || 0) * 0.001 + vit * 0.0003;
  player.attackRate = clamp((420 - dex * 1.2) * (1 - (eff.haste || 0)) * (1 - (bonus.ias || 0) / 100), 150, 420);
  eff.movespeed = (eff.movespeed || 0) + 0.04 * swi + (bonus.ms || 0) / 100; eff.lifesteal = (eff.lifesteal || 0) + 0.02 * blood + (bonus.leech || 0) / 100; eff.pierce = (eff.pierce || 0) + pierce; eff.thorns = (eff.thorns || 0) + (bonus.thorns || 0);
  // unit 4 affixes: resists (% taken reduction), leech variants, crit-dmg %, on-hit procs (% chance)
  eff.fireRes = (eff.fireRes || 0) + (bonus.fireRes || 0); eff.frostRes = (eff.frostRes || 0) + (bonus.coldRes || 0); eff.poisonRes = (eff.poisonRes || 0) + (bonus.poisonRes || 0); eff.lightningRes = (eff.lightningRes || 0) + (bonus.lightRes || 0); eff.allRes = (eff.allRes || 0) + (bonus.allRes || 0);
  eff.lifesteal += (bonus.leechAll || 0) / 100; eff.manaleech = (eff.manaleech || 0) + (bonus.manaLeech || 0) / 100 + (bonus.leechAll || 0) / 100;
  eff.critDmgPct = (eff.critDmgPct || 0) + (bonus.critDmg || 0);
  eff.burnProc = (eff.burnProc || 0) + (bonus.burnOnHit || 0); eff.bleedProc = (eff.bleedProc || 0) + (bonus.bleedOnHit || 0);
  // unit 5 affixes: avoidance + farming. dodge/flatDR capped; mf overwrites the global lootLuck (composes additively with depthQuality/quality in luckyRarity).
  eff.dodge = Math.min((bonus.dodge || 0) / 100, 0.6); eff.flatDR = Math.min((bonus.flatDR || 0) / 100, 0.5); eff.lifeOnHit = (bonus.lifeOnHit || 0);
  player.cdr = Math.min((bonus.cdr || 0) / 100, 0.5); player.goldFind = (bonus.gf || 0) / 100; lootLuck = (bonus.mf || 0) / 100;
  player.meleeMult = (cls.dmgMult || 1) * (1 + (0.06 * ber) + (pm.meleePct + pm.dmgPct) / 100); player.spellMult = (cls.spellMult || 1) * (1 + (0.06 * arc) + (pm.spellPct + pm.dmgPct) / 100); player.skillMult = 1 + (bonus.skilldmg || 0) / 100; player.activeSkillDmg = 1 + (bonus.activeskill || 0) / 100; player.elemMult = { fire: 1 + (bonus.fireDmg || 0) / 100, frost: 1 + (bonus.coldDmg || 0) / 100, lightning: 1 + (bonus.lightDmg || 0) / 100, poison: 1 + (bonus.poisonDmg || 0) / 100, phys: 1 }; player.effects = eff; player.speed = 0.32 * (1 + Math.min(eff.movespeed || 0, 0.75));
  player.str = str; player.dex = dex; player.vit = vit; player.eng = eng;
  player.dmg = Math.round(dmg); player.hpMax = Math.round(hp); player.mpMax = Math.round(mp); player.armor = armor; player.crit = clamp(crit / 100, 0, 0.9);
  player.hp = Math.min(player.hp, player.hpMax); player.mp = Math.min(player.mp, player.mpMax); updateGlobes(); updatePips();
}

let monsters = [], projectiles = [], loots = [], floats = [], fx = []; let target = null, moveTarget = null; let boss = null, bossActive = false;
/* Phase 1: in-place list compaction — replaces the per-frame Array.filter() that allocated a fresh array
   AND a fresh closure every frame for projectiles/fx/loots/floats. Predicate/killer are module-level
   singletons (no per-frame closure alloc); arr.length=w truncates in place (no realloc). Order-preserving. */
function _compact(arr, dead, kill) { let w = 0; for (let i = 0; i < arr.length; i++) { const it = arr[i]; if (dead(it)) { if (kill) kill(it); } else arr[w++] = it; } arr.length = w; }
const _deadLife0 = o => o.life <= 0, _deadFlag = o => o.dead, _killMesh = o => removeMesh(o.mesh);
const MTYPES = {
  zombie: { hp: 30, dmg: 6, speed: 0.10, r: 1.4, col: 0x6a8a4a, xp: 8, scale: 1.1, name: 'Zombie', resist: { poison: 0.5, fire: 1.25 } }, fallen: { hp: 18, dmg: 5, speed: 0.19, r: 1.1, col: 0xb04a3a, xp: 6, scale: 0.8, name: 'Fallen', resist: { fire: 0.5, frost: 1.25 } }, brute: { hp: 95, dmg: 14, speed: 0.09, r: 2.0, col: 0x7a6a8a, xp: 22, scale: 1.8, name: 'Brute', resist: { fire: 0.5, frost: 1.25 } }, shaman: { hp: 42, dmg: 10, speed: 0.13, r: 1.3, col: 0x3aa0a0, xp: 15, scale: 1.0, ranged: true, name: 'Shaman', resist: { frost: 0.5, lightning: 1.25 } },
  skeleton: { hp: 26, dmg: 8, speed: 0.14, r: 1.2, col: 0xd8d0c0, xp: 12, scale: 1.0, name: 'Skeleton', resist: { poison: 0.25, phys: 1.15, fire: 1.15 } },
  imp: { hp: 16, dmg: 7, speed: 0.22, r: 0.9, col: 0xd0402a, xp: 11, scale: 0.7, name: 'Imp', resist: { fire: 0.4, frost: 1.3 } },
  hellhound: { hp: 34, dmg: 12, speed: 0.24, r: 1.2, col: 0x6a1a14, xp: 18, scale: 0.95, name: 'Hellhound', resist: { fire: 0.4, frost: 1.25 } },
  wraith: { hp: 30, dmg: 11, speed: 0.12, r: 1.2, col: 0x6a4a9a, xp: 16, scale: 1.1, ranged: true, name: 'Wraith', resist: { poison: 0.4, phys: 0.6, fire: 1.2 } }
};
const ELITE_MODS = {
  swift: { name: 'Swift', col: 0x6affa0, speed: 1.6 },
  mighty: { name: 'Mighty', col: 0xff5040, dmg: 1.6 },
  vile: { name: 'Vile', col: 0x8a5ac0, hp: 1.6 },
  fiery: { name: 'Fiery', col: 0xff7a2a, resist: 'fire', explode: true },
  frozen: { name: 'Frozen', col: 0x6ad8ff, resist: 'frost', chill: true },
  arcane: { name: 'Arcane', col: 0xc06aff, resist: 'lightning', shoot: true },
  toxic: { name: 'Toxic', col: 0x8fe07a, resist: 'poison' },
};
/* ---------- elemental damage typing + monster resistances (unit 2) ---------- */
const ELEMENTS = ['fire', 'frost', 'poison', 'lightning', 'phys'];
// canonical tag set above; 'cold' is accepted on input as an alias of 'frost'.
function normElem(k) { if (k === 'cold') return 'frost'; if (k === 'nova') return 'fire'; return k; }
// Returns the resist multiplier a monster applies to incoming damage of `kind`.
// Supports the legacy single-kind string (resisted ~x0.5) OR a {fire:0.5,frost:1.25,...} map.
function monsterResistMult(m, kind) {
  const sh = (m.shield > 0) ? (m.shieldMul || 0.5) : 1; const r = m.resist; if (!r) return sh; const e = normElem(kind);
  if (typeof r === 'string') return (normElem(r) === e ? 0.5 : 1) * sh;   // legacy fallback: matched kind halves dmg
  const v = r[e]; return ((v === undefined || v === null) ? 1 : v) * sh;
}
// Deepen a clone of a resist map by depth/elite: resisted (<1) mults sink lower (stronger resist),
// floored so depth can never reach 0 (no accidental immunity); vulnerabilities (>1) left as-is.
function deepenResist(r, depth, elite) {
  if (!r || typeof r === 'string') return r; const out = { ...r };
  const bonus = Math.min(0.18, (depth || 0) * 0.02) + (elite ? 0.06 : 0);
  for (const k in out) { if (out[k] < 1) out[k] = Math.max(0.25, out[k] - bonus); }
  return out;
}
let curScale = { hp: 1, dmg: 1, xp: 1, ilvl: 1 };
/* ---- richer procedural monsters: cached unit geometry + cached accessory materials; only the torso (body) material is per-instance so hit-flash stays isolated. Monster meshes are noDispose; the body material is freed on death via removeMob(). ---- */
function _shade(hex, f) { const r = Math.min(255, (hex >> 16 & 255) * f | 0), g = Math.min(255, (hex >> 8 & 255) * f | 0), b = Math.min(255, (hex & 255) * f | 0); return (r << 16) | (g << 8) | b; }
const _mGeoC = {}; function _mGeo(k, mk) { return _mGeoC[k] || (_mGeoC[k] = mk()); }
const _mMatC = {}; function _mMat(k, mk) { return _mMatC[k] || (_mMatC[k] = mk()); }
const _mPhong = (col, o) => new THREE.MeshPhongMaterial(Object.assign({ specular: 0x000000, color: col, flatShading: true }, o || {}));
function removeMob(mesh) { if (mesh && mesh.userData && mesh.userData.noDispose && mesh.userData.bodyMat) mesh.userData.bodyMat.dispose(); removeMesh(mesh); }
function buildMonsterMesh(t, col, scale) {
  if (GLB_PROTO[t]) { const _ge = buildGLBEntity(t, scale / ((MTYPES[t] && MTYPES[t].scale) || 1)); if (_ge) return _ge; } const g = new THREE.Group();
  const bodyMat = _mPhong(col, { map: texSkin(1, 1) });                                       // per-instance (isolated flash)
  const headMat = _mMat('mhead' + col, () => _mPhong(_shade(col, 1.12), { map: texSkin(1, 1) }));    // shared
  const limbMat = _mMat('mlimb' + col, () => _mPhong(_shade(col, 0.6), { map: texSkin(1, 1) }));     // shared
  const eyeMat = _mMat('meye' + t, () => new THREE.MeshBasicMaterial({ color: t === 'shaman' ? 0x8fe8ff : t === 'wraith' ? 0xb060ff : (t === 'imp' || t === 'hellhound') ? 0xff3a20 : t === 'skeleton' ? 0xff8a3a : 0xffcf3a }));
  const eyeGeo = _mGeo('meyeg', () => new THREE.SphereGeometry(0.1, 6, 6));
  let body, eyeY = 2.5, eyeZ = 0.46, eyeX = 0.16;
  if (t === 'shaman') {
    body = new THREE.Mesh(_mGeo('sh_robe', () => new THREE.ConeGeometry(1.0, 2.8, 7)), bodyMat); body.position.y = 1.4;
    const head = new THREE.Mesh(_mGeo('mheadg', () => new THREE.IcosahedronGeometry(0.5, 0)), headMat); head.position.y = 2.62; head.castShadow = true; g.add(head);
    const hood = new THREE.Mesh(_mGeo('sh_hood', () => new THREE.ConeGeometry(0.64, 0.95, 7)), limbMat); hood.position.y = 3.05; g.add(hood);
    const staff = new THREE.Mesh(_mGeo('sh_staff', () => new THREE.CylinderGeometry(0.07, 0.09, 3.4, 5)), _mMat('mstaff', () => _mPhong(0x3a2a1a, { map: texWood(1, 3) }))); staff.position.set(0.95, 1.7, 0.12); staff.rotation.z = 0.06; g.add(staff);
    const orb = new THREE.Mesh(_mGeo('sh_orb', () => new THREE.IcosahedronGeometry(0.26, 0)), _mMat('mshorb', () => new THREE.MeshBasicMaterial({ color: 0x8fe8ff }))); orb.position.set(0.95, 3.5, 0.12); g.add(orb);
    eyeY = 2.6; eyeZ = 0.44; eyeX = 0.15;
  } else if (t === 'wraith') {
    body = new THREE.Mesh(_mGeo('wr_robe', () => new THREE.ConeGeometry(0.85, 2.7, 8)), bodyMat); body.position.y = 1.6;
    const head = new THREE.Mesh(_mGeo('mheadg', () => new THREE.IcosahedronGeometry(0.5, 0)), headMat); head.position.y = 2.7; head.scale.setScalar(0.8); head.castShadow = true; g.add(head);
    const hood = new THREE.Mesh(_mGeo('wr_hood', () => new THREE.ConeGeometry(0.6, 1.05, 8)), limbMat); hood.position.y = 3.05; g.add(hood);
    const armGeo = _mGeo('wr_arm', () => new THREE.ConeGeometry(0.16, 1.25, 5));
    const aL = new THREE.Mesh(armGeo, limbMat); aL.position.set(-0.72, 1.85, 0.1); aL.rotation.z = 0.55; g.add(aL);
    const aR = new THREE.Mesh(armGeo, limbMat); aR.position.set(0.72, 1.85, 0.1); aR.rotation.z = -0.55; g.add(aR);
    eyeY = 2.68; eyeZ = 0.42; eyeX = 0.15;
  } else if (t === 'hellhound') {
    body = new THREE.Mesh(_mGeo('hh_body', () => new THREE.CylinderGeometry(0.5, 0.5, 1.8, 7)), bodyMat); body.rotation.x = Math.PI / 2; body.position.set(0, 1.0, 0);
    const head = new THREE.Mesh(_mGeo('hh_head', () => new THREE.IcosahedronGeometry(0.44, 0)), headMat); head.position.set(0, 1.1, 1.0); head.castShadow = true; g.add(head);
    const legGeo = _mGeo('hh_leg', () => new THREE.CylinderGeometry(0.12, 0.1, 0.85, 5));
    for (const lp of [[-0.34, 0.62], [0.34, 0.62], [-0.34, -0.58], [0.34, -0.58]]) { const lg = new THREE.Mesh(legGeo, limbMat); lg.position.set(lp[0], 0.42, lp[1]); g.add(lg); }
    const tail = new THREE.Mesh(_mGeo('hh_tail', () => new THREE.ConeGeometry(0.13, 1.0, 5)), limbMat); tail.position.set(0, 1.1, -1.05); tail.rotation.x = -0.9; g.add(tail);
    const hG = _mGeo('hh_horn', () => new THREE.ConeGeometry(0.1, 0.5, 4)); for (const hx of [-0.2, 0.2]) { const h = new THREE.Mesh(hG, limbMat); h.position.set(hx, 1.42, 0.95); h.rotation.x = -0.3; g.add(h); }
    eyeY = 1.16; eyeZ = 1.32; eyeX = 0.17;
  } else {
    const P = t === 'brute' ? { tR: 1.02, tH: 1.8, by: 1.5, hy: 2.95, hs: 1.15, armL: 1.3, armR: 0.26, legL: 1.05, legR: 0.3, stance: 0.55 }
      : t === 'fallen' ? { tR: 0.56, tH: 1.0, by: 0.95, hy: 1.95, hs: 0.9, armL: 0.8, armR: 0.14, legL: 0.7, legR: 0.17, stance: 0.3 }
        : t === 'imp' ? { tR: 0.44, tH: 0.85, by: 0.78, hy: 1.62, hs: 0.72, armL: 0.62, armR: 0.11, legL: 0.55, legR: 0.13, stance: 0.22 }
          : t === 'skeleton' ? { tR: 0.46, tH: 1.4, by: 1.12, hy: 2.32, hs: 0.82, armL: 0.95, armR: 0.1, legL: 0.82, legR: 0.12, stance: 0.3 }
            : { tR: 0.8, tH: 1.5, by: 1.25, hy: 2.5, hs: 1.0, armL: 1.05, armR: 0.18, legL: 0.85, legR: 0.22, stance: 0.42 };
    body = new THREE.Mesh(_mGeo('torso' + t, () => new THREE.CylinderGeometry(P.tR * 0.78, P.tR, P.tH, 6)), bodyMat); body.position.y = P.by;
    const head = new THREE.Mesh(_mGeo('mheadg', () => new THREE.IcosahedronGeometry(0.5, 0)), headMat); head.position.set(0, P.hy, 0.04); head.scale.setScalar(P.hs); head.castShadow = true; g.add(head);
    const armGeo = _mGeo('arm' + t, () => new THREE.CylinderGeometry(P.armR * 0.82, P.armR, P.armL, 5));
    const aL = new THREE.Mesh(armGeo, limbMat); aL.position.set(-(P.tR + 0.06), P.by + 0.12, 0.06); aL.rotation.z = 0.28; if (t === 'zombie') aL.rotation.x = -0.7; aL.castShadow = true; g.add(aL);
    const aR = new THREE.Mesh(armGeo, limbMat); aR.position.set(P.tR + 0.06, P.by + 0.12, 0.06); aR.rotation.z = -0.28; if (t === 'zombie') aR.rotation.x = -0.7; aR.castShadow = true; g.add(aR);
    const legGeo = _mGeo('leg' + t, () => new THREE.CylinderGeometry(P.legR, P.legR * 1.12, P.legL, 5));
    const lL = new THREE.Mesh(legGeo, limbMat); lL.position.set(-P.stance, P.legL / 2, 0); g.add(lL);
    const lR = new THREE.Mesh(legGeo, limbMat); lR.position.set(P.stance, P.legL / 2, 0); g.add(lR);
    eyeY = P.hy + 0.04; eyeZ = 0.5 * P.hs + 0.02; eyeX = 0.18 * P.hs;
    if (t === 'brute') { const hG = _mGeo('bhorn', () => new THREE.ConeGeometry(0.18, 1.1, 5)); const hM = _mMat('bhornM', () => _mPhong(0xcfc8d8)); const h1 = new THREE.Mesh(hG, hM); h1.position.set(0.42, P.hy + 0.5, 0); h1.rotation.z = -0.4; g.add(h1); const h2 = new THREE.Mesh(hG, hM); h2.position.set(-0.42, P.hy + 0.5, 0); h2.rotation.z = 0.4; g.add(h2); }
    if (t === 'fallen') { const hG = _mGeo('fhorn', () => new THREE.ConeGeometry(0.09, 0.5, 4)); const hM = _mMat('fhornM', () => _mPhong(0x5a2418)); const h1 = new THREE.Mesh(hG, hM); h1.position.set(0.2, P.hy + 0.4, 0); h1.rotation.z = -0.5; g.add(h1); const h2 = new THREE.Mesh(hG, hM); h2.position.set(-0.2, P.hy + 0.4, 0); h2.rotation.z = 0.5; g.add(h2); }
    if (t === 'imp') {
      const hG = _mGeo('ihorn', () => new THREE.ConeGeometry(0.08, 0.42, 4)); const hM = _mMat('ihornM', () => _mPhong(0x3a0c06)); const h1 = new THREE.Mesh(hG, hM); h1.position.set(0.16, P.hy + 0.32, 0); h1.rotation.z = -0.6; g.add(h1); const h2 = new THREE.Mesh(hG, hM); h2.position.set(-0.16, P.hy + 0.32, 0); h2.rotation.z = 0.6; g.add(h2);
      const tl = new THREE.Mesh(_mGeo('itail', () => new THREE.ConeGeometry(0.06, 0.7, 4)), limbMat); tl.position.set(0, P.by - 0.1, -0.3); tl.rotation.x = 1.1; g.add(tl);
    }
  }
  body.castShadow = true; g.add(body); g.userData.body = body; g.userData.bodyMat = bodyMat;
  const e1 = new THREE.Mesh(eyeGeo, eyeMat); e1.position.set(eyeX, eyeY, eyeZ); g.add(e1);
  const e2 = new THREE.Mesh(eyeGeo, eyeMat); e2.position.set(-eyeX, eyeY, eyeZ); g.add(e2);
  g.scale.setScalar(scale); g.userData.noDispose = true; return g;
}
function spawnMonster(t, eliteMods, pos) {
  if (_SPK.on) { _ev(eliteMods ? 'spawnElite' : 'spawnMon'); if (!_SPK.seen.has(t)) { _SPK.seen.add(t); _ev('NEWTYPE:' + t); } }
  const base = MTYPES[t]; let x, z;
  if (pos) { x = pos.x; z = pos.z; } else { const ang = rand(0, Math.PI * 2), d = rand(40, 70); const p = { x: player.x + Math.cos(ang) * d, z: player.z + Math.sin(ang) * d }; clampEntToZone(p); x = p.x; z = p.z; }
  const sc = eliteMods ? base.scale * 1.4 : base.scale;
  const mesh = buildMonsterMesh(t, base.col, sc); mesh.position.set(x, 0, z); scene.add(mesh);
  let hpM = curScale.hp, dmgM = curScale.dmg, xpM = curScale.xp, speedMult = 1, name = base.name;
  // clone the archetype's resist map so per-instance depth scaling never mutates MTYPES (shared-ref trap)
  let resist = base.resist ? (typeof base.resist === 'string' ? base.resist : { ...base.resist }) : null;
  if (eliteMods) {
    hpM *= 3; dmgM *= 1.6; xpM *= 4; const names = [];
    for (const id of eliteMods) {
      const md = ELITE_MODS[id]; if (md.speed) speedMult *= md.speed; if (md.dmg) dmgM *= md.dmg; if (md.hp) hpM *= md.hp;
      if (md.resist) { const rk = normElem(md.resist); if (resist && typeof resist === 'object') resist[rk] = Math.min(resist[rk] || 1, 0.5); else resist = md.resist; }
      names.push(md.name);
    }
    name = names.join(' ') + ' ' + base.name; const col = ELITE_MODS[eliteMods[0]].col;
    const aura = new THREE.Mesh(_mGeo('aura' + base.r, () => new THREE.TorusGeometry(base.r * 0.85, 0.16, 8, 20)), _mMat('auram' + col, () => new THREE.MeshBasicMaterial({ color: col }))); aura.rotation.x = Math.PI / 2; aura.position.y = 0.4; mesh.add(aura); const al = regLight(new THREE.PointLight(col, 1.3 * Math.PI, 18, 2), true); al.visible = false; al.position.y = 2; mesh.add(al); mesh.userData.aura = aura; mesh.userData.eliteLight = al;
  }
  let empowered = false;
  if (zone === 'dungeon' && !eliteMods && depth >= 6 && Math.random() < Math.min(0.5, depth * 0.025)) { empowered = true; hpM *= 1.6; dmgM *= 1.35; speedMult *= 1.12; xpM *= 1.4; }
  const hp = Math.round(base.hp * hpM);
  resist = deepenResist(resist, depth, !!eliteMods || empowered);  // bake depth/elite into this instance's clone
  monsters.push(Object.assign({}, base, { type: t, x, z, hp, hpMax: hp, dmg: base.dmg * dmgM, xp: Math.round(base.xp * xpM), atkCd: 0, slow: 0, flash: 0, mesh, bob: rand(0, 6), r: base.r * (eliteMods ? 1.3 : 1), elite: eliteMods || null, empowered, speedMult, resist, name, arcaneCd: randi(0, 90) }));
  return monsters[monsters.length - 1];
}
function spawnPack() {
  const t = choice(biomePool()); const ang = rand(0, 6.28), d = rand(45, 65);
  const c = { x: player.x + Math.cos(ang) * d, z: player.z + Math.sin(ang) * d }; clampEntToZone(c); const cx = c.x, cz = c.z;
  const cnt = depth > 3 ? 2 : 1; const p2 = Object.keys(ELITE_MODS); const mods = []; for (let i = 0; i < cnt; i++) mods.push(p2.splice(randi(0, p2.length - 1), 1)[0]);
  spawnMonster(t, mods, { x: cx, z: cz });
  for (let i = 0; i < 3; i++) { const a = rand(0, 6.28); const mp = { x: cx + Math.cos(a) * 5, z: cz + Math.sin(a) * 5 }; clampEntToZone(mp); spawnMonster(t, null, { x: mp.x, z: mp.z }); }
  cullLights(); showMsg('An elite pack appears!');
}
/* Named Champion: a single beefed elite that (on champion-bounty floors) gates the floor bonus and drops big.
   Reuses spawnMonster's elite path (aura+light+nameplate); we just tag the returned instance. */
const CHAMP_NAMES = ['Gorehowl the Render', 'Vexna, Spite of the Deep', 'Karthok Bonecrown', 'The Sallow Warden', 'Ymira Frostfang', 'Drazzel the Unmaker', 'Old Scorn', 'Maluk, Ash-Touched'];
function spawnChampion(depth) {
  const t = choice(biomePool()); const mod = choice(Object.keys(ELITE_MODS));
  const ang = rand(0, 6.28), d = rand(40, 60); const p = { x: player.x + Math.cos(ang) * d, z: player.z + Math.sin(ang) * d }; clampEntToZone(p);
  const m = spawnMonster(t, [mod], { x: p.x, z: p.z }); if (!m) return null;
  m.champion = true; m.hp = m.hpMax = Math.round(m.hpMax * 2); m.dmg = Math.round(m.dmg * 1.25); m.name = choice(CHAMP_NAMES); m.nameCol = 0xffd24d;
  cullLights(); return m;
}
/* Treasure Goblin: rare, fast, harmless, flees — drops a hoard only if you catch it (escape = nothing).
   Reuses the small 'imp' mesh, gold-tinted; no bespoke model. */
function spawnGoblin() {
  const ang = rand(0, 6.28), d = rand(34, 55); const p = { x: player.x + Math.cos(ang) * d, z: player.z + Math.sin(ang) * d }; clampEntToZone(p);
  const m = spawnMonster('imp', null, { x: p.x, z: p.z }); if (!m) return null;
  m.flee = true; m.treasure = true; m.showName = true; m.name = 'Treasure Goblin'; m.nameCol = 0xffd24d;
  m.dmg = 0; m.speed = 0.34; m.ttl = 18000; m.hp = m.hpMax = Math.round(30 + depth * 4); m.xp = Math.round(m.xp * 3);
  if (m.mesh.userData.bodyMat) m.mesh.userData.bodyMat.color.setHex(0xffd24d);
  // golden glow shell (additive, no PointLight -> no shader-recompile risk); userData.aura makes the monster loop pulse it
  const glow = new THREE.Mesh(_mGeo('goblinGlow', () => new THREE.SphereGeometry(1.3, 12, 10)), _mMat('goblinGlow', () => new THREE.MeshBasicMaterial({ color: 0xffd24d, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false })));
  glow.position.y = 1.0; m.mesh.add(glow); m.mesh.userData.aura = glow;
  sfx('gold'); showMsg('A Treasure Goblin scurries by!'); return m;
}
/* Distinct named bosses: each maps a model + a FIXED AI variant (reusing bossAI's brute/caster/summoner kits) +
   a signature color/aura. pickBossDef rotates by depth tier so weaker forms front-load and _Evolved forms gate deep. */
const BOSS_DEFS = [
  { role: 'boss_mushnub',   name: 'Sporelord Myconid',      variant: 'summoner', col: 0x7ad84a, light: 0x9aff5a, minDepth: 0 },
  { role: 'boss_bluedemon', name: 'Azurath the Profane',    variant: 'caster',   col: 0x4a8aff, light: 0x6aa0ff, minDepth: 0 },
  { role: 'boss_mushking',  name: 'The Mycelial Throne',    variant: 'summoner', col: 0xb070ff, light: 0xc090ff, minDepth: 0 },
  { role: 'boss_goleling',  name: 'Gravelmaw the Unbroken', variant: 'brute',    col: 0xc8a060, light: 0xe0b070, minDepth: 10 },
  { role: 'boss_dragon',    name: 'Cinderwing',             variant: 'brute',    col: 0xff5020, light: 0xff6a30, minDepth: 15 },
  { role: 'boss_dragonevo', name: 'Pyraxis, Elder Wyrm',    variant: 'caster',   col: 0xff3010, light: 0xff4a18, minDepth: 25 },
];
function pickBossDef(d) { const pool = BOSS_DEFS.filter(b => d >= (b.minDepth || 0)); if (!pool.length) return BOSS_DEFS[0]; return pool[Math.floor(d / 5) % pool.length]; }
function buildBoss(def) {
  def = def || BOSS_DEFS[0];
  const _role = (def.role && GLB_PROTO[def.role]) ? def.role : (GLB_PROTO.boss ? 'boss' : null);
  if (_role) { const _ge = buildGLBEntity(_role, def.heightMul || 1); if (_ge) { const _ac = (def.col != null ? def.col : 0xff3020); const _aura = new THREE.Mesh(_mGeo('bossaura', () => new THREE.TorusGeometry(2.6, 0.34, 8, 28)), _mMat('bossaura' + _ac, () => new THREE.MeshBasicMaterial({ color: _ac, toneMapped: false }))); _aura.rotation.x = Math.PI / 2; _aura.position.y = 0.35; _ge.add(_aura); _ge.userData.aura = _aura; const _bl = regLight(new THREE.PointLight((def.light != null ? def.light : _ac), 2.4 * Math.PI, 42, 2), true); _bl.visible = false; _bl.position.y = 4; _ge.add(_bl); _ge.userData.eliteLight = _bl; return _ge; } } const g = new THREE.Group(); const sc = 3;
  const bodyMat = new THREE.MeshPhongMaterial({ specular: 0x000000, color: (def.col != null ? def.col : 0x8a2030), flatShading: true, map: texSkin(1, 1) });
  const dark = new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x4a1018, flatShading: true, map: texSkin(1, 1) });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.0 * sc, 1.28 * sc, 2.0 * sc, 8), bodyMat); torso.position.y = 1.7 * sc; torso.castShadow = true; g.add(torso);
  const shG = new THREE.SphereGeometry(0.55 * sc, 8, 6); const shL = new THREE.Mesh(shG, dark); shL.position.set(-1.12 * sc, 2.5 * sc, 0); shL.castShadow = true; g.add(shL); const shR = new THREE.Mesh(shG, dark); shR.position.set(1.12 * sc, 2.5 * sc, 0); shR.castShadow = true; g.add(shR);
  const armG = new THREE.CylinderGeometry(0.28 * sc, 0.38 * sc, 1.8 * sc, 6); const aL = new THREE.Mesh(armG, dark); aL.position.set(-1.3 * sc, 1.55 * sc, 0.08 * sc); aL.rotation.z = 0.32; aL.castShadow = true; g.add(aL); const aR = new THREE.Mesh(armG, dark); aR.position.set(1.3 * sc, 1.55 * sc, 0.08 * sc); aR.rotation.z = -0.32; aR.castShadow = true; g.add(aR);
  const legG = new THREE.CylinderGeometry(0.42 * sc, 0.52 * sc, 1.55 * sc, 6); const lL = new THREE.Mesh(legG, dark); lL.position.set(-0.55 * sc, 0.78 * sc, 0); g.add(lL); const lR = new THREE.Mesh(legG, dark); lR.position.set(0.55 * sc, 0.78 * sc, 0); g.add(lR);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62 * sc, 0), bodyMat); head.position.y = 3.0 * sc; head.castShadow = true; g.add(head);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff5030 }); const eg = new THREE.SphereGeometry(0.14 * sc, 6, 6); const e1 = new THREE.Mesh(eg, eyeMat); e1.position.set(0.24 * sc, 3.05 * sc, 0.54 * sc); g.add(e1); const e2 = new THREE.Mesh(eg, eyeMat); e2.position.set(-0.24 * sc, 3.05 * sc, 0.54 * sc); g.add(e2);
  for (let i = 0; i < 4; i++) { const ang = (i - 1.5) * 0.42; const horn = new THREE.Mesh(new THREE.ConeGeometry(0.16 * sc, 1.5 * sc, 5), new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x1a1014, flatShading: true })); horn.position.set(Math.sin(ang) * 0.55 * sc, 3.55 * sc, -0.05 * sc); horn.rotation.z = ang * 0.8; horn.rotation.x = -0.18; g.add(horn); }
  const aura = new THREE.Mesh(new THREE.TorusGeometry(1.35 * sc, 0.3, 8, 24), new THREE.MeshBasicMaterial({ color: (def.col != null ? def.col : 0xff3020) })); aura.rotation.x = Math.PI / 2; aura.position.y = 0.4; g.add(aura); g.userData.aura = aura;
  const lt = regLight(new THREE.PointLight((def.light != null ? def.light : 0xff3020), 2 * Math.PI, 32, 2), true); lt.visible = false; lt.position.y = 3; g.add(lt); g.userData.body = torso; g.userData.eliteLight = lt; return g;
}
function spawnBoss(d) {
  const dm = DIFF[difficulty] || DIFF.Normal; const B = BOSS_SCALE; const hp = Math.round(B.hpBase * (1 + d * B.hpLin + Math.pow(d * B.hpQuad, 2)) * dm.hp); const cdMul = clamp(1 - d * 0.015, 0.5, 1); const def = pickBossDef(d); const mesh = buildBoss(def); mesh.position.set(0, 0, -30); scene.add(mesh); cullLights();
  const b = Object.assign({ type: 'boss', x: 0, z: -30, hp, hpMax: hp, r: 4.2, dmg: Math.round(B.dmgBase * (1 + d * B.dmgLin + Math.pow(d * B.dmgQuad, 2)) * dm.dmg), xp: Math.round(B.xpBase * (1 + d * B.xpLin) * dm.xp), speed: 0.07, col: def.col, scale: 3, atkCd: 0, slow: 0, flash: 0, mesh, bob: 0, elite: null, boss: true, cdMul, name: def.name + ' · Depth ' + d, phase: 1, boltCd: 120, slamCd: 300, summonCd: 480, variant: def.variant, tpCd: 240, shield: 0, shieldMul: 0.5 });
  monsters.push(b); boss = b; sfx('boss');
}
/* ---- depth-666 unique: the big devil + hell arena (reachable only by descending) ---- */
function buildDevil() {
  const g = new THREE.Group(); const sc = 5.5;
  const bodyMat = new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x6a0e12, flatShading: true, map: texSkin(1, 1) });
  const dark = new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x2a0608, flatShading: true, map: texSkin(1, 1) });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.0 * sc, 1.35 * sc, 2.1 * sc, 8), bodyMat); torso.position.y = 1.8 * sc; torso.castShadow = true; g.add(torso);
  const shG = new THREE.SphereGeometry(0.62 * sc, 8, 6); const shL = new THREE.Mesh(shG, dark); shL.position.set(-1.2 * sc, 2.7 * sc, 0); shL.castShadow = true; g.add(shL); const shR = new THREE.Mesh(shG, dark); shR.position.set(1.2 * sc, 2.7 * sc, 0); shR.castShadow = true; g.add(shR);
  const armG = new THREE.CylinderGeometry(0.3 * sc, 0.42 * sc, 2.0 * sc, 6); const aL = new THREE.Mesh(armG, dark); aL.position.set(-1.42 * sc, 1.6 * sc, 0.08 * sc); aL.rotation.z = 0.34; aL.castShadow = true; g.add(aL); const aR = new THREE.Mesh(armG, dark); aR.position.set(1.42 * sc, 1.6 * sc, 0.08 * sc); aR.rotation.z = -0.34; aR.castShadow = true; g.add(aR);
  const legG = new THREE.CylinderGeometry(0.46 * sc, 0.58 * sc, 1.7 * sc, 6); const lL = new THREE.Mesh(legG, dark); lL.position.set(-0.6 * sc, 0.85 * sc, 0); g.add(lL); const lR = new THREE.Mesh(legG, dark); lR.position.set(0.6 * sc, 0.85 * sc, 0); g.add(lR);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72 * sc, 0), bodyMat); head.position.y = 3.25 * sc; head.castShadow = true; g.add(head);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffe23a }); const eg = new THREE.SphereGeometry(0.17 * sc, 6, 6); const e1 = new THREE.Mesh(eg, eyeMat); e1.position.set(0.27 * sc, 3.3 * sc, 0.6 * sc); g.add(e1); const e2 = new THREE.Mesh(eg, eyeMat); e2.position.set(-0.27 * sc, 3.3 * sc, 0.6 * sc); g.add(e2);
  const hornMat = new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x140608, flatShading: true });
  for (let i = 0; i < 6; i++) { const ang = (i - 2.5) * 0.36; const horn = new THREE.Mesh(new THREE.ConeGeometry(0.18 * sc, 1.9 * sc, 5), hornMat); horn.position.set(Math.sin(ang) * 0.62 * sc, 3.85 * sc, -0.05 * sc); horn.rotation.z = ang * 0.9; horn.rotation.x = -0.2; g.add(horn); }
  const wingMat = new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x3a0a0c, flatShading: true, side: THREE.DoubleSide });
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.ConeGeometry(1.3 * sc, 3.4 * sc, 3), wingMat); w.position.set(s * 1.6 * sc, 2.6 * sc, -0.5 * sc); w.rotation.z = s * 1.15; w.rotation.x = 0.5; w.scale.set(1, 1, 0.18); g.add(w); }
  const aura = new THREE.Mesh(new THREE.TorusGeometry(1.55 * sc, 0.36, 8, 24), new THREE.MeshBasicMaterial({ color: 0xff2400 })); aura.rotation.x = Math.PI / 2; aura.position.y = 0.5; g.add(aura); g.userData.aura = aura;
  const lt = regLight(new THREE.PointLight(0xff2400, 3 * Math.PI, 52, 2), true); lt.visible = false; lt.position.y = 4; g.add(lt); g.userData.body = torso; g.userData.eliteLight = lt; return g;
}
function spawnDevil(d) {
  const dm = DIFF[difficulty] || DIFF.Normal; const B = BOSS_SCALE;
  const hp = Math.round(B.hpBase * (1 + d * B.hpLin + Math.pow(d * B.hpQuad, 2)) * dm.hp * 3); const cdMul = clamp(1 - d * 0.015, 0.45, 1); const mesh = buildDevil(); mesh.position.set(0, 0, -34); scene.add(mesh); cullLights();
  const b = Object.assign({ type: 'boss', x: 0, z: -34, hp, hpMax: hp, r: 6.5, dmg: Math.round(B.dmgBase * (1 + d * B.dmgLin + Math.pow(d * B.dmgQuad, 2)) * dm.dmg * 1.5), xp: Math.round(B.xpBase * (1 + d * B.xpLin) * dm.xp * 4), speed: 0.06, col: 0x6a0e12, scale: 5.5, atkCd: 0, slow: 0, flash: 0, mesh, bob: 0, elite: null, boss: true, cdMul, name: 'Belphegor, Lord of the Inferno · Depth ' + d, phase: 1, boltCd: 90, slamCd: 240, summonCd: 360, variant: 'devil', tpCd: 200, shield: 0, shieldMul: 0.4 });
  monsters.push(b); boss = b; sfx('boss');
}
function bossVolley(m, arc, spd, chill) {
  const cm = m.cdMul || 1; const base = Math.atan2(player.x - m.x, player.z - m.z);
  for (let k = -arc; k <= arc; k++) { const a = base + k * 0.22; const pm = makeOrb(m.x, 2.5, m.z, chill ? 0x6ad8ff : 0xff5020, 0.55); scene.add(pm); projectiles.push({ x: m.x, z: m.z, vx: Math.sin(a) * spd, vz: Math.cos(a) * spd, dmg: Math.round(m.dmg * 0.7), kind: 'enemy', life: 160, mesh: pm, chill: !!chill }); }
}
function bossAI(m, dt, d, sp) {
  const fr = dt * 60 / 1000; /* see update(): decrement frame-count cooldowns by real elapsed 60ths so boss ability cadence is framerate-independent */
  if (m.shield > 0) m.shield -= fr;
  if (m.phase === 1 && m.hp < m.hpMax * 0.5) { m.phase = 2; m.speed *= 1.5; showMsg(m.name.split(' · ')[0] + ' enrages!'); }
  if (d > m.r + player.r + 0.5) stepEnt(m, player.x, player.z, sp); else { m.atkCd -= fr; if (m.atkCd <= 0) { m.atkCd = 70; damagePlayer(m.dmg); if (player.effects.thorns > 0) { m.hp -= player.effects.thorns; if (m.hp <= 0) killMonster(m); } } }
  const cm = m.cdMul || 1; const v = m.variant || 'brute';
  if (v === 'devil') {
    m.boltCd -= fr; if (m.boltCd <= 0) { m.boltCd = (m.phase === 2 ? 44 : 72) * cm; bossVolley(m, m.phase === 2 ? 4 : 3, 0.62, false); bossVolley(m, 2, 0.5, true); }
    m.slamCd -= fr; if (m.slamCd <= 0 && d < 24) { m.slamCd = 300 * cm; spawnExplosion(m.x, m.z, 0xff2400); if (d < 16) damagePlayer(Math.round(m.dmg * 1.4)); }
    m.tpCd -= fr; if (m.tpCd <= 0 && d < 28) { m.tpCd = 240 * cm; spawnExplosion(m.x, m.z, 0xff5020); const a = Math.atan2(player.x - m.x, player.z - m.z); m.x = player.x - Math.sin(a) * 22; m.z = player.z - Math.cos(a) * 22; clampEntToZone(m); spawnExplosion(m.x, m.z, 0xff5020); }
    m.summonCd -= fr; if (m.summonCd <= 0) { m.summonCd = (m.phase === 2 ? 260 : 380) * cm; for (let i = 0; i < (m.phase === 2 ? 4 : 3); i++) { const a = rand(0, 6.28); spawnMonster(choice(['imp', 'hellhound']), null, { x: m.x + Math.cos(a) * 6, z: m.z + Math.sin(a) * 6 }); } m.shield = Math.max(m.shield, 150); spawnExplosion(m.x, m.z, 0xff6a2a); showMsg('The Devil calls its brood!'); }
  } else if (v === 'caster') {
    m.boltCd -= fr; if (m.boltCd <= 0) { m.boltCd = (m.phase === 2 ? 64 : 104) * cm; bossVolley(m, m.phase === 2 ? 3 : 2, 0.6, true); }
    m.slamCd -= fr; if (m.slamCd <= 0 && d < 14) { m.slamCd = 520 * cm; spawnExplosion(m.x, m.z, 0xff3020); if (d < 10) damagePlayer(Math.round(m.dmg * 1.3)); }
    m.tpCd -= fr; if (m.tpCd <= 0 && d < 18) { m.tpCd = 260 * cm; spawnExplosion(m.x, m.z, 0x9f6aff); const a = Math.atan2(player.x - m.x, player.z - m.z); m.x = player.x - Math.sin(a) * 24; m.z = player.z - Math.cos(a) * 24; clampEntToZone(m); spawnExplosion(m.x, m.z, 0x9f6aff); }
  } else if (v === 'summoner') {
    m.summonCd -= fr; if (m.summonCd <= 0) { m.summonCd = (m.phase === 2 ? 300 : 420) * cm; for (let i = 0; i < (m.phase === 2 ? 3 : 2); i++) { const a = rand(0, 6.28); spawnMonster('fallen', null, { x: m.x + Math.cos(a) * 5, z: m.z + Math.sin(a) * 5 }); } m.shield = Math.max(m.shield, 180); spawnExplosion(m.x, m.z, 0x6aff9a); showMsg('Minions summoned!'); }
    m.boltCd -= fr; if (m.boltCd <= 0) { m.boltCd = (m.phase === 2 ? 80 : 130) * cm; bossVolley(m, m.phase === 2 ? 3 : 2, 0.6, false); }
    m.slamCd -= fr; if (m.slamCd <= 0 && d < 16) { m.slamCd = 300 * cm; spawnExplosion(m.x, m.z, 0xff3020); if (d < 10) damagePlayer(Math.round(m.dmg * 1.3)); }
  } else {
    m.boltCd -= fr; if (m.boltCd <= 0) { m.boltCd = (m.phase === 2 ? 80 : 130) * cm; bossVolley(m, m.phase === 2 ? 3 : 2, 0.6, false); }
    m.slamCd -= fr; if (m.slamCd <= 0 && d < 16) { m.slamCd = 300 * cm; spawnExplosion(m.x, m.z, 0xff3020); if (d < 10) damagePlayer(Math.round(m.dmg * 1.3)); }
    if (m.phase === 2) { m.summonCd -= fr; if (m.summonCd <= 0) { m.summonCd = 420 * cm; for (let i = 0; i < 2; i++) { const a = rand(0, 6.28); spawnMonster('fallen', null, { x: m.x + Math.cos(a) * 5, z: m.z + Math.sin(a) * 5 }); } showMsg('Minions summoned!'); } }
  }
}
// Dungeon spawns draw from the active biome's weighted pool (random biome → varied roster); wild keeps its classic mix.
const WILD_POOL = ['fallen', 'fallen', 'zombie', 'zombie', 'shaman', 'brute'];
function biomePool() { return (zone === 'dungeon' && curTheme && curTheme.pool) ? curTheme.pool : WILD_POOL; }
let _spawnQueue = [], _spawnCd = 0;
const MOB_CAP = 30; /* ponytail: flat concurrent-monster ceiling. Normal play (killing) rarely reaches it; it only bites the pathological case (walking past mobs without clearing) where the uncapped spawner piled 1000+. Make depth-scaled if a zone needs denser packs. */
function spawnWave() {
  const eliteChance = zone === 'dungeon' ? 0.10 + depth * 0.02 : 0.04; if (Math.random() < eliteChance) _spawnQueue.push({ pack: true });
  if (zone === 'dungeon' && Math.random() < 0.03) _spawnQueue.push({ goblin: true }); // rare treasure goblin
  const extra = zone === 'dungeon' ? 1 : 0; const pool = biomePool(); for (let i = 0; i < rand(2, 5) + extra; i++) _spawnQueue.push({ type: choice(pool) });
}
// Amortize first-render: release one queued spawn per cadence so each frame compiles at most one new GPU
// pipeline variant. Turns the cold-encounter compile burst (a single ~2s frozen frame) into a few small
// stutters; cached after first encounter, so it's a once-per-machine cost.
function drainSpawns(dt) {
  if (!_spawnQueue.length) return;
  if (monsters.length >= MOB_CAP) { _spawnQueue.length = 0; return; }   /* at the field cap: drop the queue rather than overflow it */
  _spawnCd -= dt; if (_spawnCd > 0) return;
  const job = _spawnQueue.shift();
  if (job.pack) spawnPack(); else if (job.goblin) spawnGoblin(); else spawnMonster(job.type);
  _spawnCd = 140;
}

const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2(); let mouseWorld = new THREE.Vector3();
function monsterAt() { let mhit = null, best = 1e9; for (const m of monsters) { const d = Math.hypot(m.x - mouseWorld.x, m.z - mouseWorld.z); if (d < m.r + 1.5 && d < best) { best = d; mhit = m; } } return mhit; }
let lmbDown = false, rmbDown = false;
function pick(ev) {
  ndc.x = (ev.clientX / innerWidth) * 2 - 1; ndc.y = -(ev.clientY / innerHeight) * 2 + 1; ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObject(ground); if (hit.length) mouseWorld.copy(hit[0].point); return monsterAt();
}
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
renderer.domElement.addEventListener('mousedown', e => {
  if (!running || busyPanel() || anyModal()) return; e.preventDefault(); const m = pick(e);
  if (e.button === 2) { rmbDown = true; if (isCombat()) castActive(character.loadout[1], { x: mouseWorld.x, z: mouseWorld.z }); return; }
  if (e.button === 0) { lmbDown = true; if (m && isCombat()) { target = m; moveTarget = null; } else { moveTarget = { x: mouseWorld.x, z: mouseWorld.z }; target = null; } }
});
renderer.domElement.addEventListener('mousemove', e => { if (running && !busyPanel() && !anyModal()) pick(e); });
addEventListener('mouseup', e => { if (e.button === 2) rmbDown = false; else if (e.button === 0) lmbDown = false; });
renderer.domElement.addEventListener('mouseleave', () => { lmbDown = rmbDown = false; });
addEventListener('blur', () => { lmbDown = rmbDown = false; });
addEventListener('wheel', e => { if (!running || busyPanel() || anyModal()) return; camDist = clamp(camDist + Math.sign(e.deltaY) * 4, 28, 72); camHeight = camDist * 0.9; });
/* ---------- centralized keybinds + single dispatcher ---------- */
/* Keybinds use KeyboardEvent.code (PHYSICAL key) so they're AZERTY/QWERTZ-safe — e.key would shift with layout. */
const DEFAULT_KEYBINDS = { toggleInv: ['KeyI', 'KeyB'], toggleSkill: ['KeyK'], enterTown: ['KeyT'], interact: ['KeyE'], hpPotion: ['Space'], manaPotion: ['KeyQ'], toggleMap: ['KeyG'], toggleSound: ['KeyM'], toggleDebug: ['Backquote'], toggleHelp: ['KeyH', 'Slash'], close: ['Escape'], skill1: ['Digit1'], skill2: ['Digit2'], skill3: ['Digit3'], skill4: ['Digit4'] };
const KEYBIND_LABELS = { toggleInv: 'Inventory', toggleSkill: 'Skills', enterTown: 'Return to Town', interact: 'Interact', hpPotion: 'Health Potion', manaPotion: 'Mana Potion', toggleMap: 'Waypoint Map', toggleSound: 'Toggle Sound', toggleDebug: 'Debug Overlay', toggleHelp: 'Help', close: 'Close / Cancel', skill1: 'Skill Slot 1', skill2: 'Skill Slot 2', skill3: 'Skill Slot 3', skill4: 'Skill Slot 4' };
const KEYBIND_ORDER = ['skill1', 'skill2', 'skill3', 'skill4', 'toggleInv', 'toggleSkill', 'enterTown', 'interact', 'hpPotion', 'manaPotion', 'toggleMap', 'toggleSound', 'toggleHelp', 'toggleDebug'];
let KEYBINDS = {};
// Convert a legacy e.key-char bind (pre-V7 saves) to an event.code; returns null if unmappable (caller falls back to default).
function migrateKey(k) {
  if (typeof k !== 'string' || !k) return null;
  if (/^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Arrow(Up|Down|Left|Right)|Space|Escape|Backquote|Slash|Minus|Equal|Comma|Period|Semicolon|Quote|Backslash|Bracket(Left|Right)|F\d{1,2}|Enter|Tab)$/.test(k)) return k;
  if (k === ' ') return 'Space';
  if (k === 'Escape') return 'Escape';
  if (k === '`' || k === '~') return 'Backquote';
  if (k === '?' || k === '/') return 'Slash';
  if (k.length === 1) { const c = k.toLowerCase(); if (c >= 'a' && c <= 'z') return 'Key' + c.toUpperCase(); if (c >= '0' && c <= '9') return 'Digit' + c; }
  return null;
}
function buildKeybinds() {
  const u = (SAVE._data.settings && SAVE._data.settings.keybinds) || {}; KEYBINDS = {}; let dirty = false;
  for (const a in DEFAULT_KEYBINDS) {
    let arr = Array.isArray(u[a]) ? u[a].map(migrateKey).filter(Boolean) : null;
    if (Array.isArray(u[a]) && (!arr || arr.length !== u[a].length)) dirty = true;
    KEYBINDS[a] = (arr && arr.length) ? arr : DEFAULT_KEYBINDS[a].slice();
  }
  if (dirty && SAVE._data.settings) { const out = {}; for (const a in u) if (KEYBINDS[a]) out[a] = KEYBINDS[a].slice(); SAVE._data.settings.keybinds = out; SAVE.persist(); }
  return KEYBINDS;
}
buildKeybinds();
function normalizeKey(e) { return e.code || e.key; }
function keyLabel(c) {
  if (!c) return '?';
  if (/^Key[A-Z]$/.test(c)) return c.slice(3);
  if (/^Digit[0-9]$/.test(c)) return c.slice(5);
  if (/^Numpad[0-9]$/.test(c)) return 'Num ' + c.slice(6);
  const M = { Space: 'Space', Escape: 'Esc', Backquote: '`', Slash: '/', Minus: '-', Equal: '=', Comma: ',', Period: '.', Semicolon: ';', Quote: "'", Backslash: '\\', BracketLeft: '[', BracketRight: ']', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Tab: 'Tab' };
  return M[c] || c;
}
function actionForKey(e) { const k = normalizeKey(e); for (const a in KEYBINDS) { if (KEYBINDS[a].indexOf(k) >= 0) return a; } return null; }
let capturingAction = null, captureCb = null;
addEventListener('keydown', e => {
  if (capturingAction) { e.preventDefault(); if (captureCb) captureCb(e); return; }
  const a = actionForKey(e);
  const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && a !== 'close') return;
  if (a === 'close') { if (wpModal && wpModal.style.display === 'block') { closeWaypoints(); } else if (mpModal && mpModal.style.display === 'block') { closeMP(); } else if (settingsModal && settingsModal.style.display === 'block') { closeSettings(); } else if (helpModal && helpModal.style.display === 'block') { closeHelp(); } else if (running && anyPanel()) { closeAll(); } return; }
  if (a === 'toggleDebug') { _dbgOn = !_dbgOn; const el = document.getElementById('dbg'); if (el) { el.style.display = _dbgOn ? 'block' : 'none'; if (_dbgOn) updateDebug(); } return; }
  if (a === 'toggleHelp') { if (helpModal.style.display === 'block') { closeHelp(); } else if (running && !anyModal()) { openHelp(); } return; }
  if (a === 'toggleMap') { if (wpModal.style.display === 'block') { closeWaypoints(); } else if (running && !anyModal() && !anyPanel()) { openWaypoints(); } return; }
  if (anyModal()) return;
  if (!running) return;
  if (a === 'toggleSound') { toggleSound(); return; }
  if (a === 'toggleInv') { toggleInv(); return; }
  if (a === 'toggleSkill') { toggleSkill(); return; }
  if (a === 'enterTown') { if (zone !== 'town') enterTown(); return; }
  if (a === 'interact') { interact(); return; }
  if (busyPanel()) return; /* inventory stays live: skill-select + potions work with it open */
  if (a === 'skill1') { if (isCombat() && !player.stunned) castActive(character.loadout[2], { x: mouseWorld.x, z: mouseWorld.z }); return; }
  if (a === 'skill2') { if (isCombat() && !player.stunned) castActive(character.loadout[3], { x: mouseWorld.x, z: mouseWorld.z }); return; }
  if (a === 'skill3') { if (isCombat() && !player.stunned) castActive(character.loadout[4], { x: mouseWorld.x, z: mouseWorld.z }); return; }
  if (a === 'skill4') { if (isCombat() && !player.stunned) castActive(character.loadout[5], { x: mouseWorld.x, z: mouseWorld.z }); return; }
  if (a === 'hpPotion') { drinkPotion(); return; }
  if (a === 'manaPotion') { drinkManaPotion(); return; }
});

/* ---------- casting / combat ---------- */
const _cd = {};
const SPELLKINDS = new Set(['fire', 'frost', 'nova', 'chain', 'meteor', 'frostnova', 'arcaneorb', 'blizzard']);
const SFX_FOR = { cleave: 'melee', multishot: 'melee', whirl: 'melee', groundslam: 'nova', charge: 'melee', warcry: 'level', shadowstep: 'melee', fanofknives: 'melee', arcaneorb: 'fire', blizzard: 'frost', teleportstorm: 'nova', secondwind: 'potion' };
/* Single source of truth for per-skill damage coefficients — consumed by castActive (the live damage)
   AND by skillDamageInfo (the hover tooltip), so the displayed number can never drift from the dealt number.
   coef(rank) → damage multiplier on player.dmg. school: spell=spellMult·skM, melee=meleeMult·skM, skill=skM only, none=no damage.
   hits/perTick/note/critMult are display metadata only. */
const SKILL_COEF = {
  strike: { coef: r => 1, school: 'melee', note: 'basic attack' },
  fire: { coef: r => 1.4 + 0.2 * r, school: 'spell' },
  frost: { coef: r => 0.9 + 0.15 * r, school: 'spell', note: 'slows' },
  nova: { coef: r => 0.9 + 0.12 * r, school: 'spell', hits: r => 12 + 2 * r, note: 'ring of bolts' },
  chain: { coef: r => 1.2 + 0.2 * r, school: 'skill', hits: r => 3 + r, note: '−15% per jump' },
  multishot: { coef: r => 0.8, school: 'melee', hits: 3 },
  volley: { coef: r => 0.6 + 0.1 * r, school: 'melee', hits: 5 },
  cleave: { coef: r => 1.3, school: 'melee', note: 'cone AoE' },
  whirl: { coef: r => 0.9 + 0.15 * r, school: 'melee', note: 'AoE' },
  leap: { coef: r => 1.0 + 0.2 * r, school: 'melee', note: 'AoE on landing' },
  blink: { school: 'none', note: 'teleport' },
  meteor: { coef: r => 1.6 + 0.3 * r, school: 'spell', note: 'AoE' },
  frostnova: { coef: r => 0.8 + 0.12 * r, school: 'spell', note: 'AoE slow' },
  groundslam: { coef: r => 1.2 + 0.25 * r, school: 'melee', note: 'cone · knockback' },
  charge: { coef: r => 1.1 + 0.2 * r, school: 'melee', note: 'dash' },
  warcry: { school: 'none', note: '+dmg / −dmg taken, 8s' },
  arcaneorb: { coef: r => 1.6 + 0.3 * r, school: 'spell', note: 'pierces' },
  blizzard: { coef: r => 0.4 + 0.08 * r, school: 'spell', perTick: true, note: 'over time' },
  teleportstorm: { coef: r => 0.7 + 0.15 * r, school: 'spell', hits: 2, note: 'blasts both ends' },
  shadowstep: { coef: r => 1.6 + 0.3 * r, school: 'melee', critMult: true, note: 'guaranteed crit' },
  fanofknives: { coef: r => 0.5 + 0.1 * r, school: 'melee', hits: r => 10 + 2 * r },
  secondwind: { school: 'none', note: 'heals from spent mana' },
};
/* ================= RUNES (deep per-skill upgrade trees) =================
   Each active skill gets a small D3-rune-style tree (SKILL_RUNES[id]). Rune effects are a BOUNDED set of
   composable numeric mods + named behavior flags, folded by resolveSkill(id) into one struct that castActive /
   skillCd / the mana check / the tooltips all read — so adding runes is DATA, never new per-skill code. */
const RUNE_FLAG_INFO = {
  explodeOnImpact: ['Volatile', 'Bursts for area damage on impact'],
  fork: ['Splinter', 'Splits into two on first hit'],
  pierceAll: ['Impale', 'Passes through every enemy'],
  freeze: ['Glaciate', 'Chills enemies it strikes'],
  chillNova: ['Frost Burst', 'Frost nova at the impact point'],
  knockback: ['Concussive', 'Knocks enemies back'],
  homing: ['Seeking', 'Projectiles curve toward foes'],
  vampiric: ['Vampiric', 'Heals you for part of the damage'],
  lingering: ['Lingering', 'Leaves a damaging field at the impact'],
  doubleCast: ['Echo Strike', 'Unleashes the skill a second time'],
};
// Skill kind -> rune archetype (drives which exclusive choices the tree offers).
const RUNE_KIND = { fire: 'proj', frost: 'proj', arcaneorb: 'proj', nova: 'multiproj', multishot: 'multiproj', volley: 'multiproj', fanofknives: 'multiproj', chain: 'chain', cleave: 'aoe', whirl: 'aoe', leap: 'aoe', meteor: 'aoe', frostnova: 'aoe', groundslam: 'aoe', charge: 'aoe', blizzard: 'aoe', teleportstorm: 'aoe', warcry: 'util', secondwind: 'util', blink: 'util', shadowstep: 'util' };
function _runeShape(kc) {
  if (kc === 'proj') return [{ flag: 'explodeOnImpact', mod: { addRadius: 3 } }, { flag: 'fork' }, { flag: 'pierceAll' }];
  if (kc === 'multiproj') return [{ flag: 'explodeOnImpact', mod: { addRadius: 3 } }, { flag: 'fork' }, { flag: 'freeze' }];
  if (kc === 'chain') return [{ mod: { addRadius: 2 }, label: 'Wide Arc' }, { flag: 'doubleCast' }, { mod: { dmgMult: 0.25 }, label: 'Overload' }];
  if (kc === 'aoe') return [{ mod: { addRadius: 3 }, label: 'Wide Reach' }, { flag: 'doubleCast' }, { mod: { dmgMult: 0.25 }, label: 'Overpower' }];
  return [{ mod: { cdrMult: -0.15 }, label: 'Swift' }, { mod: { dmgMult: 0.25 }, label: 'Empowered' }, { mod: { addDuration: 1500 }, label: 'Extended' }];
}
function _runeKey(kc) {
  if (kc === 'proj' || kc === 'multiproj') return { flag: 'homing', mod: { dmgMult: 0.15 }, label: 'Seeker' };
  if (kc === 'util') return { mod: { cdrMult: -0.2, dmgMult: 0.2 }, label: 'Mastery' };
  return { mod: { dmgMult: 0.4 }, label: 'Devastate' };
}
function buildSkillTree(id) {
  const def = SKILLDEFS[id]; const kc = RUNE_KIND[def.kind] || 'util'; const base = def.req || 1; const nodes = {}, adj = {};
  const N = (nid, x, y, type, max, cost, lvlreq, mod, flags, label, excl) => { nodes[nid] = { x, y, type, max, cost, lvlreq, mod: mod || {}, flags: flags || [], label, excl: excl || null }; adj[nid] = adj[nid] || []; };
  const L = (a, b) => { (adj[a] = adj[a] || []).push(b); (adj[b] = adj[b] || []).push(a); };
  const root = id + '_dmg';
  N(root, 0, -72, 'minor', 5, 1, 0, { dmgMult: 0.07 }, [], 'Empower');
  N(id + '_cdr', -62, -8, 'minor', 3, 1, 0, { cdrMult: -0.05 }, [], 'Quicken'); L(root, id + '_cdr');
  N(id + '_mana', 62, -8, 'minor', 3, 1, 0, { costMult: -0.08 }, [], 'Focus'); L(root, id + '_mana');
  if (kc === 'multiproj' || kc === 'chain') { N(id + '_proj', 0, 8, 'minor', 2, 2, base, { addProj: 1 }, [], kc === 'chain' ? 'Arc Splitter' : 'Extra Bolt'); L(root, id + '_proj'); }
  const shapes = _runeShape(kc); const sx = [-80, 0, 80];
  shapes.forEach((s, i) => { const nid = id + '_sh' + i; const lab = s.label || (s.flag && RUNE_FLAG_INFO[s.flag] ? RUNE_FLAG_INFO[s.flag][0] : 'Rune'); N(nid, sx[i], 80, 'notable', 1, 2, base + 2, s.mod || {}, s.flag ? [s.flag] : [], lab, 'shape'); L(i === 0 ? id + '_cdr' : i === 2 ? id + '_mana' : root, nid); });
  const key = _runeKey(kc); N(id + '_key', 0, 158, 'keystone', 1, 3, base + 4, key.mod || {}, key.flag ? [key.flag] : [], key.label);
  // Link the keystone to ALL three shape nodes. The shapes are mutually exclusive (excl:'shape'), so linking
  // only to sh1 meant picking sh0 or sh2 left sh1 permanently blocked and the keystone unreachable forever.
  L(id + '_sh0', id + '_key'); L(id + '_sh1', id + '_key'); L(id + '_sh2', id + '_key');
  return { root, nodes, adj };
}
const SKILL_RUNES = (() => { const o = {}; for (const id of ACTIVE_ORDER) { if (id === 'strike') continue; o[id] = buildSkillTree(id); } return o; })();
let _runeCache = {};
function invalidateRunes() { _runeCache = {}; }
// Pure: fold a skill's allocated rune nodes into one effect struct. Depends only on character.skillRunes[id] (cache-safe).
function resolveSkill(id) {
  const hit = _runeCache[id]; if (hit) return hit;
  const out = { dmgMult: 1, cdrMult: 1, costMult: 1, addProj: 0, addHits: 0, addRadius: 0, addSlow: 0, addDuration: 0, pierce: 0, flags: new Set() };
  const tree = SKILL_RUNES[id], alloc = character && character.skillRunes && character.skillRunes[id];
  if (tree && alloc) {
    let d = 0, c = 0, k = 0;
    for (const nid in alloc) {
      const ranks = alloc[nid]; if (!ranks) continue; const node = tree.nodes[nid]; if (!node) continue; const m = node.mod || {};
      d += (m.dmgMult || 0) * ranks; c += (m.cdrMult || 0) * ranks; k += (m.costMult || 0) * ranks;
      out.addProj += (m.addProj || 0) * ranks; out.addHits += (m.addHits || 0) * ranks; out.addRadius += (m.addRadius || 0) * ranks;
      out.addSlow += (m.addSlow || 0) * ranks; out.addDuration += (m.addDuration || 0) * ranks; out.pierce += (m.pierce || 0) * ranks;
      if (node.flags) for (const f of node.flags) out.flags.add(f);
    }
    out.dmgMult = 1 + d; out.cdrMult = clamp(1 + c, 0.2, 1.5); out.costMult = clamp(1 + k, 0.25, 2);
  }
  return _runeCache[id] = out;
}
// Stamp resolved rune flags/pierce onto a freshly spawned projectile.
function applyRuneProj(p, R) {
  if (!p || !R) return p;
  if (R.pierce) { p.pierce = (p.pierce || 0) + R.pierce; if (!p.hit) p.hit = new Set(); }
  if (R.flags.has('pierceAll')) { p.pierce = 999; if (!p.hit) p.hit = new Set(); }
  if (R.flags.has('explodeOnImpact')) { p.explode = true; p.explodeR = 4 + R.addRadius; }
  if (R.flags.has('freeze')) p.freeze = true;
  if (R.flags.has('chillNova')) p.chillNova = true;
  if (R.flags.has('fork')) p.fork = true;
  if (R.flags.has('knockback')) p.knockback = true;
  if (R.flags.has('homing')) p.homing = true;
  if (R.flags.has('vampiric')) p.vampiric = true;
  if (R.flags.has('lingering')) p.lingering = true;
  return p;
}
// One-time on-impact rune burst for a projectile (explode / chill-nova / lingering field / fork).
function projBurst(p) {
  if (p._burst || !(p.explode || p.chillNova || p.fork || p.lingering)) return; p._burst = true;
  if (p.explode) { spawnExplosion(p.x, p.z, 0xff7030); const r = p.explodeR || 4; for (const o of monsters) { if (Math.hypot(o.x - p.x, o.z - p.z) < r) { hitMonsterProj(o, p.dmg * 0.6, p.kind); if (o.hp > 0 && p.onHit) applyOnHit(o, p.onHit, p.dmg * 0.6); } } }
  if (p.chillNova) { spawnExplosion(p.x, p.z, 0x6ad8ff); for (const o of monsters) { if (Math.hypot(o.x - p.x, o.z - p.z) < 5) applyStatus(o, 'chill', 1500, 0); } }
  if (p.lingering) spawnLingerField(p.x, p.z, p.dmg, p.kind, p.onHit);
  if (p.fork && !p._forked) { p._forked = true; const sp = Math.hypot(p.vx, p.vz) || 0.8, base = Math.atan2(p.vx, p.vz); for (const off of [-0.5, 0.5]) { const a = base + off; const c = spawnProj(p.x, p.z, { x: Math.sin(a), z: Math.cos(a) }, sp, p.dmg * 0.7, p.kind, p.slow, p.onHit); c._burst = true; c._forked = true; } }
}
function spawnLingerField(x, z, dmg, kind, onHit) { const ep = _fieldEpoch; for (let i = 0; i < 5; i++) { setTimeout(() => { if (_fieldEpoch !== ep || !running || !isCombat()) return; spawnExplosion(x, z, kind === 'frost' ? 0x6ad8ff : 0xff7030); for (const m of monsters) { if (Math.hypot(m.x - x, m.z - z) < 3.5) { hitMonsterProj(m, dmg * 0.35, kind); if (m.hp > 0 && onHit) applyOnHit(m, onHit, dmg * 0.35); } } }, i * 240); } }
function castActive(id, aim, isEcho) {
  const def = SKILLDEFS[id]; let rank = character.skills[id]; if (!def || rank < 1) return; if (_SPK.on) _ev('cast:' + id); rank += (player.effects.allskills || 0); const R = resolveSkill(id);
  const t = now(); const cost = Math.round(def.cost * R.costMult); if (!isEcho) { if (t - (_cd[id] || -9999) < skillCd(def, id)) return; if (player.mp < cost) { floatText('No mana', player.x, player.z, '#88aaff'); return; } _cd[id] = t; player.mp -= cost; updateGlobes(); sfx(SFX_FOR[def.kind] || def.kind); }
  const ang = Math.atan2(aim.x - player.x, aim.z - player.z) + (isEcho ? rand(-0.12, 0.12) : 0); player.dir = ang; player.swing = now(); const fwd = { x: Math.sin(ang), z: Math.cos(ang) }; const skM = (player.skillMult || 1) * ((id === character.activeSkillId) ? (player.activeSkillDmg || 1) : 1); const eb = empowerMul(); const sm = player.spellMult * skM * eb, mm = player.meleeMult * skM * eb;
  const _C = SKILL_COEF[def.kind]; const cf = ((_C && _C.coef) ? _C.coef(rank) : 1) * R.dmgMult;
  if (def.kind === 'fire') applyRuneProj(spawnProj(player.x, player.z, fwd, 0.9, player.dmg * cf * sm, 'fire', 120, def.onHit), R);
  else if (def.kind === 'frost') { applyRuneProj(spawnProj(player.x, player.z, fwd, 0.8, player.dmg * cf * sm, 'frost', 80 + 30 * rank + R.addSlow, def.onHit), R); }
  else if (def.kind === 'nova') { const cnt = 12 + 2 * rank + R.addProj; for (let k = 0; k < cnt; k++) { const a = k / cnt * Math.PI * 2; applyRuneProj(spawnProj(player.x, player.z, { x: Math.sin(a), z: Math.cos(a) }, 0.85, player.dmg * cf * sm, 'fire', 120, def.onHit), R); } }
  else if (def.kind === 'chain') castChain(rank, skM, R);
  else if (def.kind === 'multishot') { const n = 3 + R.addProj; for (let k = 0; k < n; k++) { const a = ang + (k - (n - 1) / 2) * 0.18; applyRuneProj(spawnProj(player.x, player.z, { x: Math.sin(a), z: Math.cos(a) }, 1.0, player.dmg * cf * mm, 'poison', 120, def.onHit), R); } }
  else if (def.kind === 'volley') { const n = 5 + R.addProj; for (let k = 0; k < n; k++) { const a = ang + (k - (n - 1) / 2) * 0.16; applyRuneProj(spawnProj(player.x, player.z, { x: Math.sin(a), z: Math.cos(a) }, 1.0, player.dmg * cf * mm, 'phys', 120, def.onHit), R); } }
  else if (def.kind === 'cleave') { for (const m of [...monsters]) { const dx = m.x - player.x, dz = m.z - player.z, d = Math.hypot(dx, dz); if (d < 6 + R.addRadius) { const ma = Math.atan2(dx, dz); const da = Math.abs(Math.atan2(Math.sin(ma - ang), Math.cos(ma - ang))); if (da < 1.2) meleeDamage(m, cf * skM, player); } } }
  else if (def.kind === 'whirl') { for (const m of [...monsters]) { if (Math.hypot(m.x - player.x, m.z - player.z) < 7 + R.addRadius) meleeDamage(m, cf * skM, player); } }
  else if (def.kind === 'leap') { const dd = Math.min(Math.hypot(aim.x - player.x, aim.z - player.z), 16); player.x += Math.sin(ang) * dd; player.z += Math.cos(ang) * dd; clampToZone(); spawnExplosion(player.x, player.z, 0xc4a050); for (const m of [...monsters]) { if (Math.hypot(m.x - player.x, m.z - player.z) < 6 + R.addRadius) meleeDamage(m, cf * skM, player); } }
  else if (def.kind === 'blink') { const dd = Math.min(Math.hypot(aim.x - player.x, aim.z - player.z), 22); player.x += Math.sin(ang) * dd; player.z += Math.cos(ang) * dd; clampToZone(); spawnExplosion(player.x, player.z, 0x6a8aff); }
  else if (def.kind === 'meteor') { spawnExplosion(aim.x, aim.z, 0xff5020); for (const m of [...monsters]) { if (Math.hypot(m.x - aim.x, m.z - aim.z) < 7 + R.addRadius) { const dd = player.dmg * cf * sm; hitMonsterProj(m, dd, 'fire'); if (m.hp > 0 && def.onHit) applyOnHit(m, def.onHit, dd); } } }
  else if (def.kind === 'frostnova') { spawnExplosion(player.x, player.z, 0x6ad8ff); for (const m of [...monsters]) { if (Math.hypot(m.x - player.x, m.z - player.z) < 9 + R.addRadius) { const dd = player.dmg * cf * sm; hitMonsterProj(m, dd, 'frost'); if (m.hp > 0) { m.slow = 120 + 30 * rank + R.addSlow; if (def.onHit) applyOnHit(m, def.onHit, dd); } } } }
  else if (def.kind === 'groundslam') { spawnExplosion(player.x + fwd.x * 3, player.z + fwd.z * 3, 0xc4a050); for (const m of [...monsters]) { const dx = m.x - player.x, dz = m.z - player.z, d = Math.hypot(dx, dz); if (d < 8 + R.addRadius) { const ma = Math.atan2(dx, dz); const da = Math.abs(Math.atan2(Math.sin(ma - ang), Math.cos(ma - ang))); if (da < 1.0) { meleeDamage(m, cf * skM, player); m.slow = Math.max(m.slow, 120); const kb = Math.min(4, 9 - d); m.x += Math.sin(ma) * kb; m.z += Math.cos(ma) * kb; } } } }
  else if (def.kind === 'charge') { const dd = Math.min(Math.hypot(aim.x - player.x, aim.z - player.z), 20); player.x += Math.sin(ang) * dd; player.z += Math.cos(ang) * dd; clampToZone(); spawnExplosion(player.x, player.z, 0xd8c060); for (const m of [...monsters]) { if (Math.hypot(m.x - player.x, m.z - player.z) < 5 + R.addRadius) { meleeDamage(m, cf * skM, player); m.slow = Math.max(m.slow, 90); } } }
  else if (def.kind === 'warcry') { player.buffs.cryUntil = now() + 8000 + R.addDuration; player.buffs.cryMul = 1.2 + 0.06 * rank; player.buffs.cryDR = Math.min(0.4, 0.1 + 0.04 * rank); spawnExplosion(player.x, player.z, 0xffcf3a); floatText('War Cry!', player.x, player.z - 1, '#ffcf3a'); }
  else if (def.kind === 'arcaneorb') { const p = spawnProj(player.x, player.z, fwd, 0.45, player.dmg * cf * sm, 'fire'); p.pierce = 3; if (!p.hit) p.hit = new Set(); p.slow = 60; p.mesh.scale.setScalar(0.85); applyRuneProj(p, R); }
  else if (def.kind === 'blizzard') { const cx = aim.x, cz = aim.z, reps = 4 + rank + R.addHits, oh = def.onHit, ep = _fieldEpoch; for (let i = 0; i < reps; i++) { setTimeout(() => { if (_fieldEpoch !== ep || !running || !isCombat()) return; const ox = cx + rand(-5, 5), oz = cz + rand(-5, 5); spawnExplosion(ox, oz, 0x6ad8ff); for (const m of [...monsters]) { if (Math.hypot(m.x - ox, m.z - oz) < 5 + R.addRadius) { const dd = player.dmg * cf * sm; hitMonsterProj(m, dd, 'frost'); if (m.hp > 0) { m.slow = Math.max(m.slow, 120); if (oh) applyOnHit(m, oh, dd); } } } }, i * 220); } }
  else if (def.kind === 'teleportstorm') { const blast = () => { spawnExplosion(player.x, player.z, 0x9f6aff); for (const m of [...monsters]) { if (Math.hypot(m.x - player.x, m.z - player.z) < 6 + R.addRadius) hitMonsterProj(m, player.dmg * cf * sm, 'lightning'); } }; blast(); const dd = Math.min(Math.hypot(aim.x - player.x, aim.z - player.z), 22); player.x += Math.sin(ang) * dd; player.z += Math.cos(ang) * dd; clampToZone(); blast(); }
  else if (def.kind === 'shadowstep') { let best = null, bd = 1e9; for (const m of monsters) { const d = Math.hypot(m.x - player.x, m.z - player.z); if (d < bd) { bd = d; best = m; } } if (best) { const ba = Math.atan2(best.x - player.x, best.z - player.z); player.x = best.x - Math.sin(ba) * 2.2; player.z = best.z - Math.cos(ba) * 2.2; clampToZone(); player.dir = ba; spawnExplosion(player.x, player.z, 0x6a3a8a); const dmg = player.dmg * player.meleeMult * skM * cf * (player.effects.critdmg ? 3 : 2); best.hp -= dmg; best.flash = 8; floatText('✸' + Math.round(dmg), best.x, best.z, '#ffd24d'); if (player.effects.lifesteal > 0) player.hp = Math.min(player.hpMax, player.hp + dmg * player.effects.lifesteal); if (best.hp <= 0) killMonster(best); } else floatText('No target', player.x, player.z, '#aaa'); }
  else if (def.kind === 'fanofknives') { const cnt = 10 + 2 * rank + R.addProj; for (let k = 0; k < cnt; k++) { const a = k / cnt * Math.PI * 2; applyRuneProj(spawnProj(player.x, player.z, { x: Math.sin(a), z: Math.cos(a) }, 1.0, player.dmg * cf * mm, 'phys', 120, def.onHit), R); } }
  else if (def.kind === 'secondwind') { const m0 = player.mp; player.mp = 0; const heal = Math.round(m0 * (0.6 + 0.12 * rank)); player.hp = Math.min(player.hpMax, player.hp + heal); floatText('+' + heal, player.x, player.z, '#7fd07f'); spawnExplosion(player.x, player.z, 0x6ad88a); updateGlobes(); }
  if (!isEcho && player.effects.echo && SPELLKINDS.has(def.kind)) setTimeout(() => castActive(id, aim, true), 90);
  if (!isEcho && R.flags.has('doubleCast')) setTimeout(() => castActive(id, aim, true), 80);
  renderSkillbar();
}
const _orbGeo = new THREE.SphereGeometry(1, 8, 8); const _matCache = {};
function projMat(hex) { if (!_matCache[hex]) _matCache[hex] = new THREE.MeshBasicMaterial({ color: hex }); return _matCache[hex]; }
/* ponytail: free-lists for the high-churn combat throwaways. geo+mats are already shared/cached; this recycles the
   Mesh/Line *wrappers* (and the chain-line's GPU buffer) so sustained combat stops minting hundreds of short-lived
   objects/sec — that allocation rate is the GC-pause source, not a leak. Bounded; pool overflow is just left to GC.
   removeMesh() returns userData.pooled / userData.linePooled objects here instead of discarding them. */
const _POOL_MAX = 256, _meshPool = [], _linePool = [], _LINE_PTS = 16;
function poolMesh(geo, mat) { const m = _meshPool.pop(); if (m) { m.geometry = geo; m.material = mat; m.visible = true; m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.setScalar(1); return m; } const nm = new THREE.Mesh(geo, mat); nm.userData.pooled = true; return nm; }
function poolLine() { const ln = _linePool.pop(); if (ln) { ln.visible = true; ln.material.opacity = 1; return ln; } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(_LINE_PTS * 3), 3)); const nl = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 1 })); nl.frustumCulled = false; nl.userData.linePooled = true; return nl; }
function makeOrb(x, y, z, hex, r) { const m = poolMesh(_orbGeo, projMat(hex)); m.scale.setScalar(r); m.position.set(x, y, z); return m; }
/* perftest-only spike profiler: when on, the loop logs every frame over _SPK.thresh with heap-delta (gc=heap dropped
   ⇒ GC pause) and the game events that fired that frame (loot/kill/cast/new-monster-type) — so a real-play hitch can
   be attributed to GC vs first-render-compile vs a specific event. Drive via window.__spikeStart()/__spikeStop(). */
const _SPK = { on: false, thresh: 40, spikes: [], ev: {}, rates: {}, seen: new Set(), lcSeen: new Set(), t0: 0 };
function _ev(n) { if (!_SPK.on) return; _SPK.ev[n] = (_SPK.ev[n] || 0) + 1; _SPK.rates[n] = (_SPK.rates[n] || 0) + 1; }
function spawnProj(x, z, dir, sp, dmg, kind, slow, onHit) { const col = kind === 'frost' ? 0x9fe8ff : kind === 'poison' ? 0x8fe07a : (kind === 'phys' ? 0xd8d8e8 : 0xff8a3a); const mesh = makeOrb(x, 2, z, col, 0.5); scene.add(mesh); const pierce = ((kind === 'phys' || kind === 'poison') ? (player.effects.pierce || 0) : 0); const p = { x, z, vx: dir.x * sp, vz: dir.z * sp, dmg, kind, life: 120, mesh, slow: slow || 120, onHit: onHit || null, hit: pierce > 0 ? new Set() : null, pierce }; projectiles.push(p); return p; }
function castChain(rank, skM, R) {
  skM = skM || 1; R = R || resolveSkill('chain'); let dmg = player.dmg * SKILL_COEF.chain.coef(rank) * skM * R.dmgMult; const jumps = 2 + rank + R.addProj; const hitSet = new Set(); let cur = { x: player.x, z: player.z }; const pts = [new THREE.Vector3(player.x, 2.6, player.z)];
  for (let j = 0; j <= jumps; j++) { let best = null, bd = 1e9; for (const m of monsters) { if (hitSet.has(m)) continue; const d = Math.hypot(m.x - cur.x, m.z - cur.z); const range = j === 0 ? 40 : 18; if (d < range && d < bd) { bd = d; best = m; } } if (!best) break; hitSet.add(best); pts.push(new THREE.Vector3(best.x, 2.4, best.z)); hitMonsterProj(best, dmg, 'lightning'); dmg *= 0.85; cur = { x: best.x, z: best.z }; }
  if (pts.length > 1) spawnLightning(pts);
}
function spawnLightning(pts) { const ln = poolLine(), arr = ln.geometry.attributes.position.array, n = Math.min(pts.length, _LINE_PTS); for (let i = 0; i < n; i++) { arr[i * 3] = pts[i].x; arr[i * 3 + 1] = pts[i].y; arr[i * 3 + 2] = pts[i].z; } ln.geometry.setDrawRange(0, n); ln.geometry.attributes.position.needsUpdate = true; ln.geometry.boundingSphere = null; scene.add(ln); pushFx({ mesh: ln, life: 14 }); } /* pooled Line: own material (per-instance opacity fade), fixed max-point buffer reused via draw-range — was a fresh BufferGeometry+material every cast */
/* shared FX/loot geometry+material caches (avoid per-event allocation + GPU-upload spikes) */
const _LGEO = { gold: new THREE.SphereGeometry(0.4, 8, 8), pot: new THREE.CylinderGeometry(0.3, 0.3, 0.9, 8), item: new THREE.OctahedronGeometry(0.55, 0), ring: new THREE.RingGeometry(0.85, 1.2, 28), expl: new THREE.SphereGeometry(6, 16, 12), spark: new THREE.TetrahedronGeometry(0.22, 0), flash: new THREE.SphereGeometry(0.5, 8, 8) };
const _beamGeoC = {}; function _beamGeo(h, w) { const k = h + 'x' + w; return _beamGeoC[k] || (_beamGeoC[k] = new THREE.CylinderGeometry(w * 0.45, w, h, 10, 1, true)); }
const _lootMatC = {}; function _lootMat(kind, col) { const k = kind + col; if (_lootMatC[k]) return _lootMatC[k]; let m; if (kind === 'gold') m = new THREE.MeshStandardMaterial({ color: 0xffd24d, emissive: 0x3a2900, emissiveIntensity: 0.5, metalness: 1.0, roughness: 0.3, envMapIntensity: 1.3 }); else if (kind === 'potion') m = new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0xff3a3a, emissive: 0x4a0000 }); else if (kind === 'manapotion') m = new THREE.MeshPhongMaterial({ specular: 0x000000, color: 0x3a5aff, emissive: 0x00104a }); else m = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .45, metalness: 0.6, roughness: 0.35, envMapIntensity: 1.2 }); return _lootMatC[k] = m; }
const _basicMatC = {}; function _basicMat(col, opacity) { const k = col + '_' + opacity; return _basicMatC[k] || (_basicMatC[k] = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); }
/* combat VFX: shared geo + cached additive mats, fade-by-scale (never mutate shared material opacity), hard-capped to survive AoE wipes */
const FX_CAP = 160; function pushFx(o) { if (fx.length >= FX_CAP) { const old = fx.shift(); if (old) removeMesh(old.mesh); } fx.push(o); }
function spawnSparks(x, z, col, count) {
  if (SAVE._data.settings.vfx === false) return; count = Math.min(count || 6, 8); const mat = _basicMat(col, 0.95);
  for (let i = 0; i < count; i++) { const m = poolMesh(_LGEO.spark, mat); m.position.set(x, 1.4, z); const a = Math.random() * 6.2832, sp = 4 + Math.random() * 7, s0 = 0.6 + Math.random() * 0.6; m.scale.setScalar(s0); m.rotation.set(Math.random() * 3, Math.random() * 3, 0); scene.add(m); const lf = 18 + (Math.random() * 10 | 0); pushFx({ mesh: m, life: lf, life0: lf, scale0: s0, vx: Math.cos(a) * sp, vy: 4.5 + Math.random() * 5, vz: Math.sin(a) * sp, grav: 20, spin: 0.18 + Math.random() * 0.25 }); }
}
function impactFlash(x, z, col) { if (SAVE._data.settings.vfx === false) return; const m = poolMesh(_LGEO.flash, _basicMat(col, 0.7)); m.position.set(x, 1.6, z); const s0 = 1.7; m.scale.setScalar(s0); scene.add(m); pushFx({ mesh: m, life: 9, life0: 9, scale0: s0 }); }
const _explMatC = {}; function spawnExplosion(x, z, col) { const mat = _explMatC[col] || (_explMatC[col] = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, wireframe: true })); const m = poolMesh(_LGEO.expl, mat); m.position.set(x, 1.5, z); scene.add(m); pushFx({ mesh: m, life: 14 }); } /* ponytail: per-color wireframe mat cached (was a per-call alloc + a noDispose leak). Two same-color explosions overlapping share the opacity fade — negligible/rare. */
const POTION_PCT = 0.40, POTION_TIER_PCT = 0.05;
function potionHealAmt() { return Math.round(player.hpMax * (POTION_PCT + (character.potionTier || 0) * POTION_TIER_PCT)); }
function potionManaAmt() { return Math.round(player.mpMax * (POTION_PCT + (character.potionTier || 0) * POTION_TIER_PCT)); }
function cleanseDots() { if (!player.statuses) return false; const i = player.statuses.findIndex(s => s.type === 'burn' || s.type === 'poison' || s.type === 'bleed'); if (i >= 0) { player.statuses.splice(i, 1); return true; } return false; }
function drinkPotion() { if (player.hpPotions <= 0) { floatText('No potions', player.x, player.z, '#ff8'); return; } const hasDot = player.statuses && player.statuses.some(s => s.type === 'burn' || s.type === 'poison' || s.type === 'bleed'); if (player.hp >= player.hpMax && !hasDot) { floatText('Full HP', player.x, player.z, '#ff8'); return; } player.hpPotions--; cleanseDots(); const amt = potionHealAmt(); player.hp = Math.min(player.hpMax, player.hp + amt); updateGlobes(); floatText('+' + amt, player.x, player.z, '#ff6b5b'); sfx('potion'); }
function drinkManaPotion() { if (player.mpPotions <= 0) { floatText('No mana potions', player.x, player.z, '#9cf'); return; } if (player.mp >= player.mpMax) { floatText('Full MP', player.x, player.z, '#9cf'); return; } player.mpPotions--; const amt = potionManaAmt(); player.mp = Math.min(player.mpMax, player.mp + amt); updateGlobes(); floatText('+' + amt, player.x, player.z, '#5a9bff'); sfx('potion'); }
function rollDamage() { let d = player.dmg * player.meleeMult + rand(-3, 3); const crit = Math.random() < player.crit; if (crit) d *= ((player.effects.critdmg ? 3 : 2) + (player.effects.critDmgPct || 0) / 100); return { d, crit }; }
function meleeDamage(m, mult, from) { const cb = (player.buffs.cryUntil > now() ? player.buffs.cryMul : 1) * empowerMul(); let d = (player.dmg * player.meleeMult * mult * cb) + rand(-3, 3); const crit = Math.random() < player.crit; if (crit) d *= ((player.effects.critdmg ? 3 : 2) + (player.effects.critDmgPct || 0) / 100); const rm = monsterResistMult(m, 'phys'); if (rm < 1) floatText('resist', m.x, m.z + 1, '#9aa'); d *= rm; m.hp -= d; m.flash = 8; spawnSparks(m.x, m.z, crit ? 0xffe27a : 0xffb060, crit ? 7 : 5); if (crit) impactFlash(m.x, m.z, 0xffd24d); floatText((crit ? '✸' : '') + Math.round(d), m.x, m.z, crit ? '#ffd24d' : (rm > 1 ? '#ff8a6a' : '#ffe')); if (player.effects.lifesteal > 0) player.hp = Math.min(player.hpMax, player.hp + d * player.effects.lifesteal); if (player.effects.manaleech > 0) player.mp = Math.min(player.mpMax, player.mp + d * player.effects.manaleech); if (from) { const a = Math.atan2(m.x - from.x, m.z - from.z); m.x += Math.sin(a) * 0.6; m.z += Math.cos(a) * 0.6; } procOnHit(m, d); if (m.hp <= 0) killMonster(m); }
// unit 4: roll equipped on-hit proc affixes against a live monster (call before killMonster)
function procOnHit(m, dmg) { if (!m || m.hp <= 0) return; const e = player.effects; if (e.burnProc > 0 && Math.random() * 100 < e.burnProc) applyOnHit(m, 'burn', dmg); if (m.hp > 0 && e.bleedProc > 0 && Math.random() * 100 < e.bleedProc) applyOnHit(m, 'bleed', dmg); if (e.lifeOnHit > 0) player.hp = Math.min(player.hpMax, player.hp + e.lifeOnHit); }
/* ---------- status-effect core (foundational; reused by later units) ---------- */
function applyStatus(ent, type, dur, val) {
  if (!ent.statuses) ent.statuses = []; const s = ent.statuses.find(x => x.type === type);
  if (s) { s.dur = Math.max(s.dur, dur); s.val = val; s.stacks = Math.min(3, (s.stacks || 1) + 1); if (type === 'poison') s.age = Math.min(s.age || 0, 0); }
  else ent.statuses.push({ type, dur, val, stacks: 1, age: 0 });
  if (type === 'chill' && ent === player) player.chillUntil = Math.max(player.chillUntil, now() + dur);
}
// Skill on-hit hook: derives a sensible dur/val from the hit and applies the status (unit 3).
// baseDmg is the damage just dealt; DoTs deal a share of it per second over the duration.
function applyOnHit(ent, type, baseDmg) {
  if (!ent || !type) return;
  if (type === 'burn') applyStatus(ent, 'burn', 2200, Math.max(1, baseDmg * 0.30));
  else if (type === 'bleed') applyStatus(ent, 'bleed', 3000, Math.max(1, baseDmg * 0.25));
  else if (type === 'poison') applyStatus(ent, 'poison', 2600, Math.max(1, baseDmg * 0.22));
  else if (type === 'chill') applyStatus(ent, 'chill', 1600, 0);
  else if (type === 'stun') applyStatus(ent, 'stun', 800, 0);
  else applyStatus(ent, type, 1800, Math.max(1, baseDmg * 0.2));
}
function tickStatuses(ent, dt, isPlayer) {
  ent.stunned = false; if (!isPlayer) ent.chilled = false; const arr = ent.statuses; if (!arr || !arr.length) return;
  let dot = 0;
  // player DoTs are mitigated by the matching resist (+ allRes), capped 75%; bleed is physical → unresisted
  /** @type {Effects|null} */ const pe = isPlayer ? (player.effects || {}) : null;
  const dotRes = el => { if (!pe) return 1; return 1 - Math.min(75, (pe[el] || 0) + (pe.allRes || 0)) / 100; };
  for (const s of arr) {
    s.dur -= dt; s.age = (s.age || 0) + dt; const sec = dt / 1000; const st = s.stacks || 1;
    if (s.type === 'burn') dot += s.val * st * sec * dotRes('fireRes');
    else if (s.type === 'bleed') dot += s.val * st * sec;
    else if (s.type === 'poison') dot += s.val * st * sec * (1 + Math.min(2, s.age / 1500)) * dotRes('poisonRes');
    else if (s.type === 'chill') { if (!isPlayer) ent.chilled = true; }
    else if (s.type === 'stun') ent.stunned = true;
  }
  if (dot > 0) {
    if (isPlayer) { if (!_perfGod) player.hp -= dot; if (player.hp < 0) player.hp = 0; updateGlobes(); if (player.hp <= 0 && running && !_perfGod) { sfx('die'); gameOver(); } }
    else { ent.hp -= dot; ent.flash = Math.max(ent.flash, 4); if (ent.dotAcc === undefined) ent.dotAcc = 0; ent.dotAcc += dot; if (ent.dotAcc >= 1) { floatText(Math.round(ent.dotAcc), ent.x, ent.z + 0.6, '#ff9a5b'); ent.dotAcc = 0; } if (ent.hp <= 0) { killMonster(ent); return; } }
  }
  ent.statuses = arr.filter(s => s.dur > 0);
}
function hitMonster(m, from) { sfx('melee'); meleeDamage(m, 1, from); }
function hitMonsterProj(m, dmg, kind) { const rm = monsterResistMult(m, kind); if (rm < 1) { floatText('resist', m.x, m.z + 1, '#9aa'); } dmg *= rm; if (player.elemMult && player.elemMult[kind]) dmg *= player.elemMult[kind]; m.hp -= dmg; m.flash = 8; if (!m._nova) spawnSparks(m.x, m.z, kind === 'frost' ? 0x9fe8ff : kind === 'poison' ? 0x8fe07a : kind === 'lightning' ? 0xcfe8ff : kind === 'phys' ? 0xd8d8e8 : 0xff8a3a, 5); floatText(Math.round(dmg), m.x, m.z, rm > 1 ? '#ff8a6a' : '#ffe'); if (player.effects.lifesteal > 0) player.hp = Math.min(player.hpMax, player.hp + dmg * player.effects.lifesteal); if (player.effects.manaleech > 0) player.mp = Math.min(player.mpMax, player.mp + dmg * player.effects.manaleech); if (m._nova !== true) procOnHit(m, dmg); if (m.hp <= 0) killMonster(m); }
function killMonster(m) {
  _ev(m.boss ? 'killBoss' : m.elite ? 'killElite' : 'kill');
  gainXP(m.xp); player.kills++; killsTxt.textContent = 'Slain: ' + player.kills;
  if (zone === 'dungeon') { if (floorObj && !floorObj.done && bountyProgress(floorObj, m.champion ? 'champion' : 'kill')) payBounty(); renderObjective(); }
  sfx(m.boss ? 'bossdie' : 'death'); spawnSparks(m.x, m.z, 0xff7a3a, m.boss ? 8 : 7); impactFlash(m.x, m.z, m.boss ? 0xff5030 : 0xffb060);
  if (m.empowered && !m.boss) { spawnExplosion(m.x, m.z, 0xff6a2a); if (Math.hypot(m.x - player.x, m.z - player.z) < 7) damagePlayer(Math.round(m.dmg * 0.8), []); }
  if (m.boss) {
    bossActive = false; boss = null; if (d_deeperPortal) d_deeperPortal.group.visible = true; spawnExplosion(m.x, m.z, 0xff3020); showMsg('The way down opens!');
    for (let i = 0; i < 5; i++) { const ang = i / 5 * 6.28; let best = rollItem(curScale.ilvl + 4, null, 0.35); for (let k = 0; k < 3; k++) { const c = rollItem(curScale.ilvl + 4, null, 0.35); if (itemScore(c) > itemScore(best)) best = c; } dropLoot(m.x + Math.cos(ang) * 3, m.z + Math.sin(ang) * 3, 'item', best); }
    dropLoot(m.x, m.z, 'gold', Math.round(rand(150, 300) + depth * 20)); for (let i = 0; i < 2; i++) dropLoot(m.x + rand(-3, 3), m.z + rand(-3, 3), 'potion', 1); for (let i = 0; i < 2; i++) dropLoot(m.x + rand(-3, 3), m.z + rand(-3, 3), 'manapotion', 1);
  } else if (m.champion) {
    spawnExplosion(m.x, m.z, 0xffd24d);
    for (let i = 0; i < 5; i++) { const ang = i / 5 * 6.28; let best = rollItem(curScale.ilvl + 3, null, 0.30); for (let k = 0; k < 2; k++) { const c = rollItem(curScale.ilvl + 3, null, 0.30); if (itemScore(c) > itemScore(best)) best = c; } dropLoot(m.x + Math.cos(ang) * 3, m.z + Math.sin(ang) * 3, 'item', best); }
    dropLoot(m.x, m.z, 'gold', Math.round(rand(80, 160) + depth * 14)); for (let i = 0; i < 2; i++) dropLoot(m.x + rand(-2, 2), m.z + rand(-2, 2), 'potion', 1); if (Math.random() < 0.5) dropLoot(m.x, m.z + 1, 'gem', { t: choice(GEM_KEYS), q: Math.random() < 0.6 ? 0 : 1 });
  } else if (m.treasure) {
    spawnExplosion(m.x, m.z, 0xffd24d); showMsg('The hoard spills open!');
    const ng = randi(3, 4); for (let i = 0; i < ng; i++) { const ang = i / ng * 6.28; dropLoot(m.x + Math.cos(ang) * 3, m.z + Math.sin(ang) * 3, 'item', rollItem(curScale.ilvl + 1)); }
    dropLoot(m.x, m.z, 'gold', Math.round(rand(120, 240) + depth * 18)); if (Math.random() < 0.6) dropLoot(m.x + 1, m.z, 'gem', { t: choice(GEM_KEYS), q: Math.random() < 0.5 ? 0 : 1 });
  } else if (m.elite) {
    if (m.elite.includes('fiery')) { if (Math.hypot(m.x - player.x, m.z - player.z) < 7) damagePlayer(m.dmg * 1.4, []); spawnExplosion(m.x, m.z, 0xff7a2a); }
    let best = rollItem(curScale.ilvl + 2, null, 0.18); for (let k = 0; k < 2; k++) { const c = rollItem(curScale.ilvl + 2, null, 0.18); if (itemScore(c) > itemScore(best)) best = c; }
    dropLoot(m.x, m.z, 'item', best); dropLoot(m.x + 1, m.z, 'gold', Math.round(rand(20, 50) + player.level + depth * 6)); if (Math.random() < .5) dropLoot(m.x - 1, m.z, (Math.random() < 0.4 ? 'manapotion' : 'potion'), 1);
  } else {
    const dropBonus = zone === 'dungeon' ? 0.08 * depth : 0;
    if (Math.random() < .85) dropLoot(m.x, m.z, 'gold', Math.round(rand(2, 18) + player.level + depth * 4));
    if (Math.random() < .30 + dropBonus) dropLoot(m.x + rand(-1, 1), m.z + rand(-1, 1), 'item', rollItem(curScale.ilvl));
    if (Math.random() < 0.05) dropLoot(m.x + rand(-1, 1), m.z + rand(-1, 1), 'gem', { t: choice(GEM_KEYS), q: Math.random() < 0.7 ? 0 : 1 });
    if (Math.random() < .12) dropLoot(m.x + rand(-1, 1), m.z + rand(-1, 1), (Math.random() < 0.4 ? 'manapotion' : 'potion'), 1);
  }
  killMesh(m); monsters = monsters.filter(x => x !== m); if (target === m) target = null;
  if (player.effects.deathnova > 0 && !m._nova) { spawnExplosion(m.x, m.z, 0xff7030); const dn = player.dmg * player.effects.deathnova; for (const o of [...monsters]) { if (o !== m && Math.hypot(o.x - m.x, o.z - m.z) < 6) { o._nova = true; hitMonsterProj(o, dn, 'fire'); o._nova = false; } } }
}
function gainXP(n) {
  player.xp += n; let leveled = false;
  while (player.xp >= player.xpNext) {
    player.xp -= player.xpNext; player.level++; character.level = player.level; player.xpNext = Math.round(player.xpNext * 1.45);
    const gr = (CLASSES[character.class] || CLASSES.warrior).grow; character.base.hpMax += gr.hp; character.base.mpMax += gr.mp; character.base.dmg += gr.dmg; character.skillPoints += 2; character.abilityPoints = (character.abilityPoints || 0) + 1;
    recompute(); syncActives(); renderSkillbar(); player.hp = player.hpMax; player.mp = player.mpMax; setLevelText(player.level); showMsg('Level Up!  Lv ' + player.level); sfx('level'); leveled = true;
  }
  if (leveled) saveProgress(true);
  updateGlobes(); updatePips();
}
function dropLoot(x, z, kind, payload) {
  _ev('loot:' + kind);
  if (kind === 'gold') payload = Math.round(payload * (1 + (player.goldFind || 0))); // Gold Find % affix
  const group = new THREE.Group(); group.position.set(x, 0, z); group.userData.noDispose = true; let icon, col, tier;
  if (kind === 'gold') { col = 0xffd24d; tier = 1; icon = new THREE.Mesh(_LGEO.gold, _lootMat('gold', col)); }
  else if (kind === 'potion') { col = 0xff5a4a; tier = 1; icon = new THREE.Mesh(_LGEO.pot, _lootMat('potion', col)); }
  else if (kind === 'manapotion') { col = 0x5a7aff; tier = 1; icon = new THREE.Mesh(_LGEO.pot, _lootMat('manapotion', col)); }
  else if (kind === 'gem') { col = 0x6ad8ff; tier = 2; icon = new THREE.Mesh(_LGEO.item, _lootMat('item', col)); }
  else { col = RCOL[payload.rarity]; tier = RTIER[payload.rarity] || 1; icon = new THREE.Mesh(_LGEO.item, _lootMat('item', col)); }
  icon.position.y = 1; icon.castShadow = true; group.add(icon);
  const beamH = kind === 'item' ? (tier >= 4 ? 13 : tier >= 3 ? 9 : tier >= 2 ? 6 : 3.5) : 2.4; const beamW = tier >= 4 ? 0.85 : tier >= 2 ? 0.55 : 0.4; const beamOp = tier >= 4 ? 0.5 : tier >= 2 ? 0.34 : 0.22;
  const beam = new THREE.Mesh(_beamGeo(beamH, beamW), _basicMat(col, beamOp)); beam.position.y = beamH / 2; group.add(beam);
  const ring = new THREE.Mesh(_LGEO.ring, _basicMat(col, 0.55)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.13; group.add(ring);
  scene.add(group); loots.push({ x, z, kind, payload, mesh: group, icon, beam, ring, tier, t: rand(0, 6) });
}
const tmpV = new THREE.Vector3(); function floatText(txt, x, z, col) { _ev('float'); if (floats.length > 80) floats.splice(0, floats.length - 80); floats.push({ txt: String(txt), x, z, col, life: 55, y: 3 }); }

/* ---------- collision ---------- */
function activeColliders() { return zone === 'town' ? townColliders : zone === 'wild' ? wildColliders : zone === 'dungeon' ? dungeonColliders : []; }
function resolveCircles(e, r, arr, iters) { for (let it = 0; it < iters; it++) { for (const c of arr) { if (c === e) continue; const dx = e.x - c.x, dz = e.z - c.z; let d = Math.hypot(dx, dz); const min = r + (c.r || 1); if (d < min) { if (d < 0.0001) { d = 0.0001; e.x += 0.01; } e.x += dx / d * (min - d); e.z += dz / d * (min - d); } } } }

/* ================= ZONES ================= */
let zone = 'town', depth = 0;
let floorObj = null, shrines = [], shrineGroup = null; // per-floor bounty + dungeon shrines (ephemeral, rebuilt each enterDungeon)
function isCombat() { return zone === 'wild' || zone === 'dungeon'; }
let _fieldEpoch = 0; /* bumped on every field teardown; deferred combat ticks (blizzard/lingering fields) capture it and bail if it changed, so a cast can't keep detonating after a floor/zone change */
function clearField() { _fieldEpoch++; for (const d of _dying) removeMesh(d.g); _dying.length = 0; for (const m of monsters) removeMob(m.mesh); for (const p of projectiles) removeMesh(p.mesh); for (const l of loots) removeMesh(l.mesh); for (const e of fx) removeMesh(e.mesh); monsters = []; projectiles = []; loots = []; fx = []; _spawnQueue.length = 0; _spawnCd = 0; target = null; moveTarget = null; boss = null; bossActive = false; _resetHudCache(); }
function setZoneVisuals() {
  wildGroup.visible = zone === 'wild'; townGroup.visible = zone === 'town'; dungeonGroup.visible = zone === 'dungeon'; dungeonExtraGroup.visible = zone === 'dungeon'; if (typeof markGlows === 'function') markGlows();
  playerGlow.intensity = PLAYER_GLOW[zone] || 0; /* Diablo-style player aura — on in dungeons, off in lit town/open wild */
  /* Phase 1a relight: these per-zone overrides re-set hemi/moon/torch intensity every zone transition, so they get the same x Math.PI scale as the construction sites (otherwise zones darken to ~1/pi while the menu looks fine). */
  if (zone === 'town') { setGroundFlat(true); ensureColorBg(); scene.background.setHex(0x0a0805); scene.fog.color.setHex(0x0a0805); scene.fog.near = 70; scene.fog.far = 180; hemi.intensity = 0.6 * Math.PI; moon.intensity = 0.7 * Math.PI; if (groundMat.vertexColors) { groundMat.vertexColors = false; groundMat.needsUpdate = true; } groundMat.color.setHex(0x3a2f22); setAmbient('ember', 0xffb060); torch.intensity = 1.4 * Math.PI; torch.distance = 64; setBiomeGrade({ t: [1.06, 1.00, 0.90], v: 0.28 }); restoreProcEnv(); loadTownGround(); }
  else if (zone === 'wild') { setGroundFlat(false); const rg = curRegion || REGIONS[0]; if (scene.background.isColor) scene.background.setHex(rg.fog); scene.fog.color.setHex(rg.fog); scene.fog.near = 58; scene.fog.far = 168; hemi.intensity = 0.42 * Math.PI; moon.intensity = 0.55 * Math.PI; if (groundMat.vertexColors) { groundMat.vertexColors = false; groundMat.needsUpdate = true; } groundMat.color.setHex(groundTexOn() ? (rg.groundTint || 0xffffff) : rg.groundCol); setAmbient('ember', rg.amb); torch.intensity = 1.5 * Math.PI; torch.distance = 66; setBiomeGrade({ t: [0.96, 1.05, 0.95], v: 0.30 }); loadRegionEnv(rg); loadRegionGround(rg); }
  else { setGroundFlat(false); const th = curTheme || dungeonTheme(depth); const dk = clamp(0.52 - depth * 0.018, 0.34, 0.52) * Math.PI; ensureColorBg(); scene.background.setHex(th.fog); scene.fog.color.setHex(th.fog); scene.fog.near = 42; scene.fog.far = clamp(150 - depth * 5, 100, 150); hemi.intensity = dk; moon.intensity = 0.34 * Math.PI; if (groundMat.vertexColors) { groundMat.vertexColors = false; groundMat.needsUpdate = true; } groundMat.color.setHex(th.ground); setAmbient(th.amb, th.ambCol); torch.intensity = clamp(2.2 + depth * 0.09, 2.2, 4.4) * Math.PI; torch.distance = clamp(76 + depth * 1.6, 76, 114); setBiomeGrade(th.grade); restoreProcEnv(); loadDungeonGround(th); loadDungeonWall(th); }
}
const AREAS = [
  { id: 'town', name: 'Aldermere', kind: 'town', tier: 0, townTheme: { ground: 0x3a2f22, fog: 0x0a0805 } },
  { id: 'highreach', name: 'Highreach', kind: 'town', tier: 1, townTheme: { ground: 0x55606e, fog: 0x090c13 } },
  { id: 'emberhold', name: 'Emberhold', kind: 'town', tier: 2, townTheme: { ground: 0x4a2622, fog: 0x100704 } },
  { id: 'wilds', name: 'The Wilds', kind: 'wild', lvl: 1 },
  { id: 'descent', name: 'The Descent', kind: 'dungeon' },
];
let curArea = AREAS.find(a => a.id === 'wilds'), curTownArea = AREAS[0];
let curRegion = REGIONS[0];
const _fogFrom = new THREE.Color(), _fogTo = new THREE.Color(); let _fogT = 1;
buildTown(curTownArea); // build the default town once so the title screen has scenery before any enterTown()
function themeTown(a) { if (a && a.townTheme) { groundMat.color.setHex(groundTexOn() ? 0xffffff : a.townTheme.ground); scene.background.setHex(a.townTheme.fog); scene.fog.color.setHex(a.townTheme.fog); } }
function themeWild() { const r = curRegion || REGIONS[0]; if (scene.background.isColor) scene.background.setHex(r.fog); scene.fog.color.setHex(r.fog); setAmbient('ember', r.amb); for (const f of wildFires) { f.light.color.setHex(r.fire); f.flame.material.color.setHex(r.fire); } loadRegionEnv(r); loadRegionGround(r); }
function onRegionChange(r) { _fogFrom.copy(scene.fog.color); _fogTo.setHex(r.fog); _fogT = 0; setAmbient('ember', r.amb); for (const f of wildFires) { f.light.color.setHex(r.fire); f.flame.material.color.setHex(r.fire); } setScale(); zoneTxt.textContent = r.name + ' · Lv ' + r.lvl; showMsg(r.name); loadRegionEnv(r); loadRegionGround(r); }
function setScale() {
  const dm = DIFF[difficulty] || DIFF.Normal; if (zone === 'dungeon') {
    const D = DSCALE;
    curScale = { hp: (1 + depth * D.hpLin + Math.pow(depth * D.hpQuad, 2)) * dm.hp, dmg: (1 + depth * D.dmgLin + Math.pow(depth * D.dmgQuad, 2)) * dm.dmg, xp: (1 + depth * D.xpLin + Math.pow(depth * D.xpQuad, 2)) * dm.xp, ilvl: player.level + depth * D.ilvlPerDepth };
    lootLuck = Math.min(0.5, depth * 0.02);
  }
  else if (zone === 'wild') { const lv = (curRegion && curRegion.lvl) || 1; curScale = { hp: (1 + lv * 0.12) * dm.hp, dmg: (1 + lv * 0.09) * dm.dmg, xp: (1 + lv * 0.15) * dm.xp, ilvl: Math.max(player.level, lv) + 2 }; lootLuck = 0; }
  else { curScale = { hp: dm.hp, dmg: dm.dmg, xp: dm.xp, ilvl: player.level }; lootLuck = 0; }
}
/* Phase 1b perf: pre-warm the freshly-built scene's GPU pipelines behind the loading gate so the first live
   frame doesn't compile-stutter (browser-verified: zone entry froze ~2s as the main thread idle-waited on GPU
   pipeline compilation - a pure GPU-wait, ~0 main-thread longtask). Pauses the sim+render loop while warming
   (also stops the "mobbed while the frame froze" deaths). Sequence: (1) compileAsync() warms modules/pipelines
   off the main thread while the overlay stays live; (2) ONE synchronous renderFrame() through the ACTIVE (post)
   path finalizes the exact offscreen/MRT variant the loop will draw - post.renderAsync() resolves BEFORE
   compilation finishes (browser-verified: gate flashed ~8ms then the freeze leaked into gameplay), so the
   synchronous render is required. This covers the static scene (scenery, ground, town). It does NOT cover
   transient combat content first-rendered after reveal - monsters, projectiles, FX, skills - whose pipeline
   variants are context/pass-specific; that residual (~1.5-1.9s on first combat) is a separate, unsolved piece
   (see PERF-FINDINGS). Token + 8s watchdog guard against a stuck overlay (black-screen guard). */
/* Pre-compile the FULL transient combat pipeline set in THIS zone's exact lighting context, behind the loading
   gate. Combat content (wave monsters, skill FX, projectiles, loot) first-renders AFTER reveal, so without this
   the first render of each compiles its pipeline on the main thread mid-fight — the "freeze when walking around"
   (browser-measured ~3.2s cold on first combat, plus per-biome residuals). The pipeline variant is context-
   specific (point-light count is baked per biome — verified: a warm done in town left wild's first combat at
   ~670ms), so the warm MUST run in each zone's own context, not once globally. Builds one temp mesh per distinct
   (geometry, material) combo, renders it once via warmScene's compileAsync+renderFrame, then removes it.
   _warmedCtx gates it to once per biome/zone-context per session so re-entries don't repay the load cost. */
const _warmedCtx = new Set();
function _combatCtxKey() { return zone + ':' + (zone === 'dungeon' ? ((curTheme && curTheme.name) || '?') : zone === 'wild' ? ((curRegion && curRegion.name) || '?') : 'town'); }
function warmCombatPipelines() {
  if (!isCombat()) return [];
  const tmp = [], px = player.x, pz = player.z;
  const add = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, y == null ? 1.5 : y, pz); m.frustumCulled = false; m.userData.noDispose = true; scene.add(m); tmp.push(m); return m; };
  for (const t of new Set(biomePool())) { const b = MTYPES[t]; if (!b) continue; const mesh = buildMonsterMesh(t, b.col, b.scale); if (mesh) { mesh.position.set(px, 0, pz); mesh.frustumCulled = false; scene.add(mesh); tmp.push(mesh); } } /* skinned MeshStandard, one per spawnable type */
  add(_orbGeo, projMat(0xff8a3a), 2);                                  /* projectile orb (opaque MeshBasic) */
  add(_LGEO.spark, _basicMat(0xffffff, 0.95));                          /* additive-transparent VFX, one per distinct geo layout */
  add(_LGEO.flash, _basicMat(0xffffff, 0.7));
  add(_LGEO.ring, _basicMat(0xffffff, 0.55));
  add(_beamGeo(3.5, 0.4), _basicMat(0xffffff, 0.3), 1.5);
  add(_LGEO.expl, new THREE.MeshBasicMaterial({ color: 0xff5020, transparent: true, opacity: 0.5, wireframe: true })); /* explosion = wireframe variant (distinct pipeline) */
  { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(px, 2, pz), new THREE.Vector3(px + 2, 2.4, pz)]); const ln = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 1 })); ln.frustumCulled = false; ln.userData.noDispose = true; scene.add(ln); tmp.push(ln); } /* chain-lightning Line */
  add(_LGEO.gold, _lootMat('gold', 0xffd24d), 1);                       /* loot: MeshStandard (gold/item) + MeshPhong (potion) */
  add(_LGEO.pot, _lootMat('potion', 0xff5a4a), 1);
  add(_LGEO.item, _lootMat('item', 0xc080ff), 1);
  return tmp;
}
let _warming = false, _warmToken = 0;
function warmScene(label) {
  const el = document.getElementById('loading');
  const tok = ++_warmToken;
  _warming = true;
  if (el) { el.textContent = label || 'Summoning the world…'; el.style.display = ''; }
  setTimeout(() => { if (tok === _warmToken && _warming) { console.warn('warmScene watchdog: forcing reveal'); _warming = false; if (el) el.style.display = 'none'; last = now(); } }, 8000);
  /* yield two frames so the overlay actually paints before the (potentially blocking) warm render begins */
  requestAnimationFrame(() => requestAnimationFrame(async () => {
    if (tok !== _warmToken) return;
    const _ckey = isCombat() ? _combatCtxKey() : null;
    const _skipWarm = typeof window !== 'undefined' && window.__skipCombatWarm; /* perf A/B: disable the combat warm to measure the un-warmed first-combat hitch (unset in normal play) */
    const _warmMobs = (_ckey && !_warmedCtx.has(_ckey) && !_skipWarm) ? warmCombatPipelines() : [];  /* combat content, gated once per context */
    try {
      if (renderer.shadowMap.enabled) moon.shadow.needsUpdate = true;
      await renderer.compileAsync(scene, camera); /* off-main-thread warm of modules/pipelines; overlay stays live */
      renderFrame();                              /* sync: finalize the exact active (post) variant behind the gate */
      if (_ckey) _warmedCtx.add(_ckey);           /* mark warmed only after a successful in-context compile+render */
    } catch (err) { console.warn('warmScene warm failed:', err && err.message); }
    finally {
      for (const o of _warmMobs) { if (o.userData && o.userData.glb) removeMob(o); else removeMesh(o); } /* drop temp instances (noDispose → shared geo/mat survive) */
      // biome-ignore lint/correctness/noUnsafeFinally: the try/catch above already absorbs all throws, so this return only skips the cleanup tail when a newer warm-up superseded this token — no exception is masked.
      if (tok !== _warmToken) return;
      _warming = false; if (el) el.style.display = 'none'; last = now(); placeCamera(player);
    }
  }));
}
function enterTown(area) {
  curTownArea = area || curTownArea || AREAS[0]; zone = 'town'; depth = 0; clearField(); invalidateTownInter(); buildTown(curTownArea); setZoneVisuals(); themeTown(curTownArea); setScale();
  for (const n of npcs) { n.group.visible = (!n.towns || n.towns.includes(curTownArea.id)); } player.x = 0; player.z = 8; player.hp = player.hpMax; refreshVendor(); zoneTxt.textContent = curTownArea.name + ' · Town'; townBtn.style.display = 'none'; placeCamera(player); saveProgress(false);
  warmScene(curTownArea.name + ' · Town');
}
function enterWild(regionId, spawn) {
  curArea = AREAS.find(a => a.id === 'wilds'); const r = (regionId && wildById(regionId)) || curRegion || REGIONS[0];
  curRegion = r; zone = 'wild'; depth = 0; clearField(); buildWild(r);
  player.x = (spawn && spawn.x != null) ? spawn.x : WILD_SPAWN.x; player.z = (spawn && spawn.z != null) ? spawn.z : WILD_SPAWN.z;
  setZoneVisuals(); themeWild(); setScale(); _fogT = 1; waveTimer = 0;
  if (r.town) markDiscovered(r.town);   // reaching a biome reveals its adjoining town on the map
  zoneTxt.textContent = r.name + ' · Lv ' + r.lvl; townBtn.style.display = 'inline-block'; placeCamera(player); showMsg(r.name); saveProgress(false);
  warmScene(r.name + ' · Lv ' + r.lvl);
}
/* ---- shrines: individually-addressable, single-use buff altars, rebuilt each floor (outside the biome cache) ---- */
const SHRINE_COL = { empowered: 0xff5040, fleet: 0x6affa0, blessed: 0xffd24d, cursed: 0xb060ff };
function buildShrineMesh(type) {
  const col = SHRINE_COL[type] || 0xffffff; const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.5, 0.5, 8), new THREE.MeshPhongMaterial({ specular: 0x111111, color: 0x33303a, flatShading: true })); base.position.y = 0.25; base.castShadow = true; g.add(base);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.85, 0), new THREE.MeshPhongMaterial({ color: col, emissive: col, emissiveIntensity: 0.9, flatShading: true })); crystal.position.y = 1.7; g.add(crystal); g.userData.crystal = crystal;
  return g; // emissive-only (no per-shrine PointLight) — avoids light-set-swap shader recompiles; player aura lights it
}
function placeShrines() {
  if (!shrineGroup) { shrineGroup = new THREE.Group(); dungeonGroup.add(shrineGroup); }
  for (const s of shrines) { shrineGroup.remove(s.mesh); disposeObj(s.mesh); }
  shrines.length = 0; if (zone !== 'dungeon') return;
  const cnt = randi(2, 3);
  for (let i = 0; i < cnt; i++) {
    let x = 0, z = 0, tries = 0;
    do { const ang = rand(0, 6.28), dd = rand(22, DUNG_HALF - 12); x = Math.cos(ang) * dd; z = Math.sin(ang) * dd; tries++; } while (tries < 12 && (Math.hypot(x, z) < 14 || Math.hypot(x, z + 50) < 12)); // keep clear of spawn (0,0) and portal (0,-50)
    const type = (Math.random() < 0.25) ? 'cursed' : choice(['empowered', 'fleet', 'blessed']);
    const mesh = buildShrineMesh(type); mesh.position.set(x, 0, z); shrineGroup.add(mesh);
    shrines.push({ x, z, type, used: false, mesh });
  }
}
function activateShrine(s) {
  if (!s || s.used) return; s.used = true;
  const cr = s.mesh.userData.crystal; if (cr) { cr.material.color.setHex(0x555555); cr.material.emissive.setHex(0x222222); cr.material.emissiveIntensity = 0.05; }
  spawnExplosion(s.x, s.z, SHRINE_COL[s.type] || 0xffffff); sfx('level');
  if (s.type === 'empowered') { player.buffs.empUntil = now() + 30000; player.buffs.empMul = 1.25; floatText('Empowered!', player.x, player.z - 1, '#ff8a6a'); showMsg('Shrine of Power — +25% damage (30s)'); }
  else if (s.type === 'fleet') { player.buffs.fleetUntil = now() + 30000; player.buffs.fleetMul = 1.3; floatText('Fleet!', player.x, player.z - 1, '#6affa0'); showMsg('Shrine of Haste — +30% speed (30s)'); }
  else if (s.type === 'blessed') { const amt = Math.round(player.hpMax * 0.4); player.hp = Math.min(player.hpMax, player.hp + amt); if (player.statuses) player.statuses = player.statuses.filter(x => x.type !== 'burn' && x.type !== 'poison' && x.type !== 'bleed'); player.chillUntil = 0; updateGlobes(); floatText('+' + amt, player.x, player.z, '#ff6b5b'); showMsg('Blessed Shrine — restored & cleansed'); }
  else { showMsg('Cursed Shrine — they come!'); spawnPack(); let best = rollItem(curScale.ilvl + 3, null, 0.3); for (let k = 0; k < 2; k++) { const c = rollItem(curScale.ilvl + 3, null, 0.3); if (itemScore(c) > itemScore(best)) best = c; } dropLoot(s.x, s.z, 'item', best); dropLoot(s.x + 1, s.z, 'gold', Math.round(rand(100, 200) + depth * 16)); }
}
/* ---- floor bounty payout + HUD ---- */
function payBounty() {
  for (let i = 0; i < 2; i++) { const ang = i / 2 * 6.28 + 0.6; let best = rollItem(curScale.ilvl + 2, null, 0.25); for (let k = 0; k < 2; k++) { const c = rollItem(curScale.ilvl + 2, null, 0.25); if (itemScore(c) > itemScore(best)) best = c; } dropLoot(player.x + Math.cos(ang) * 3, player.z + Math.sin(ang) * 3, 'item', best); }
  dropLoot(player.x, player.z, 'gold', Math.round(rand(60, 120) + depth * 10)); dropLoot(player.x + rand(-2, 2), player.z + rand(-2, 2), 'potion', 1);
  gainXP(Math.round(player.xpNext * 0.15)); showMsg('Bounty complete!'); sfx('level');
}
let _objTxt = null;
function renderObjective() {
  if (!_objTxt) _objTxt = document.getElementById('objTxt'); if (!_objTxt) return;
  let s = '';
  if (zone === 'dungeon' && floorObj && !floorObj.done) s = floorObj.kind === 'champion' ? 'Bounty — Slay the Champion' : ('Bounty — Slay foes ' + floorObj.count + '/' + floorObj.target);
  if (s !== _objTxt._s) { _objTxt._s = s; _objTxt.textContent = s; _objTxt.style.display = s ? 'block' : 'none'; }
}
function enterDungeon(d) {
  zone = 'dungeon'; depth = d; if (d > character.maxDepth) { character.maxDepth = d; } buildDungeon(d); clearField(); setZoneVisuals(); setScale(); player.x = 0; player.z = 0; waveTimer = 0; zoneTxt.textContent = (curTheme ? curTheme.name : 'Dungeon') + ' — Depth ' + d; townBtn.style.display = 'inline-block'; placeCamera(player); showMsg((curTheme ? curTheme.name + ' · ' : '') + 'Depth ' + d);
  if (depth === 666) { floorObj = null; if (d_deeperPortal) d_deeperPortal.group.visible = false; spawnDevil(depth); bossActive = true; setTimeout(() => showMsg('The Devil of the Inferno bars the way…'), 900); }
  else if (depth % 5 === 0) { floorObj = null; if (d_deeperPortal) d_deeperPortal.group.visible = false; spawnBoss(depth); bossActive = true; setTimeout(() => showMsg('A guardian blocks the way down…'), 900); }
  else { if (d_deeperPortal) d_deeperPortal.group.visible = true; floorObj = rollFloorObjective(depth); if (floorObj && floorObj.kind === 'champion') { spawnChampion(depth); setTimeout(() => showMsg('A Champion stalks this floor…'), 900); } }
  placeShrines(); renderObjective();
  saveProgress(false);
  warmScene((curTheme ? curTheme.name : 'Dungeon') + ' — Depth ' + depth);
}

/* ---------- interaction ---------- */
/* shops stay walkable: opening one records the NPC spot, and update() closes it once the player wanders off. */
const SHOP_KINDS = new Set(['vendor', 'stash', 'smith', 'alchemist', 'enchanter', 'gambler', 'jeweler', 'premiumVendor']);
let shopAnchor = null;
/* The town interactable list (NPC filter + portals) is static for a whole town visit but was rebuilt — with a
   fresh filter/map and one object per NPC — twice a frame (nearest() + drawMinimap()). Cache it and rebuild only
   on town entry (invalidateTownInter). Wild/dungeon lists stay live: they're a few literals and carry dynamic
   state (bossActive gate, shrine `used`) that must be re-read each frame. */
let _townInter = null;
function invalidateTownInter() { _townInter = null; }
/** @returns {Interactable[]} */
function interactables() {
  if (zone === 'town') return _townInter || (_townInter = [...npcs.filter(n => !n.towns || (curTownArea && n.towns.includes(curTownArea.id))).map(n => ({ kind: n.kind, x: n.x, z: n.z })), { kind: 'wild', x: t_wildPortal.x, z: t_wildPortal.z }, { kind: 'waypoint', x: t_waypoint.x, z: t_waypoint.z }, { kind: 'cauldron', x: t_cauldron.x, z: t_cauldron.z }]);
  if (zone === 'wild') {
    const r = curRegion || REGIONS[0];
    /** @type {Interactable[]} */
    const arr = [{ kind: 'towngate', x: wpTown.x, z: wpTown.z, area: r.town }, { kind: 'cave', x: wpCave.x, z: wpCave.z }, { kind: 'waypoint', x: w_waypoint.x, z: w_waypoint.z }];
    if (r.next) arr.push({ kind: 'wildnext', x: wpNext.x, z: wpNext.z, to: r.next });
    if (r.prev) arr.push({ kind: 'wildprev', x: wpPrev.x, z: wpPrev.z, to: r.prev });
    return arr;
  }
  if (bossActive) return [];
  const arr = [{ kind: 'deeper', x: d_deeperPortal.x, z: d_deeperPortal.z }];
  for (const s of shrines) if (!s.used) arr.push({ kind: 'shrine', x: s.x, z: s.z, ref: s });
  return arr;
}
function markDiscovered(id) { if (character && character.discovered && !character.discovered[id]) { character.discovered[id] = true; showMsg('Discovered ' + ((AREAS.find(a => a.id === id) || {}).name || id) + '!'); saveProgress(false); } }
function wildForTown(townId) { const w = REGIONS.find(r => r.town === townId); return w ? w.id : REGIONS[0].id; }
function nearest() { let best = null, bd = 6; for (const o of interactables()) { const d = Math.hypot(o.x - player.x, o.z - player.z); if (d < bd) { bd = d; best = o; } } return best; }
function refillPotions() { const cap = character.potionCap || 10; if (player.hpPotions >= cap && player.mpPotions >= cap && player.hp >= player.hpMax && player.mp >= player.mpMax) { showMsg('Already fully rested'); floatText('Full', player.x, player.z, '#9affc8'); return; } player.hpPotions = cap; player.mpPotions = cap; player.hp = player.hpMax; player.mp = player.mpMax; updateGlobes(); showMsg('Rested — HP, mana & potions restored'); floatText('+Restored', player.x, player.z, '#9affc8'); sfx('potion'); saveProgress(false); }
function interact() {
  if (anyPanel()) { closeAll(); return; } const o = nearest(); if (!o) return;
  if (o.kind === 'vendor') openVendor(); else if (o.kind === 'stash') openStash(); else if (o.kind === 'smith') openSmith(); else if (o.kind === 'alchemist') openAlchemist();
  else if (o.kind === 'enchanter') openEnchanter(); else if (o.kind === 'gambler') openGambler(); else if (o.kind === 'jeweler') openJeweler(); else if (o.kind === 'premiumVendor') openVendor(2);
  else if (o.kind === 'wild') enterWild(wildForTown(curTownArea.id)); else if (o.kind === 'towngate') { markDiscovered(o.area); enterTown(AREAS.find(a => a.id === o.area)); }
  else if (o.kind === 'cave') enterDungeon(1); else if (o.kind === 'deeper') enterDungeon(depth + 1); else if (o.kind === 'shrine') activateShrine(o.ref);
  else if (o.kind === 'wildnext') { const w = wildById(o.to); if (curRegion && curRegion.nextGate && ((character && character.maxDepth) || 0) < curRegion.nextGate) showMsg('Reach Depth ' + curRegion.nextGate + ' in the Descent to breach ' + (w ? w.name : 'the way') + '…'); else enterWild(o.to); }
  else if (o.kind === 'wildprev') enterWild(o.to);
  else if (o.kind === 'waypoint') openWaypoints(); else if (o.kind === 'cauldron') refillPotions();
  // set AFTER opening — each open*() calls closeAll(), which clears shopAnchor
  if (SHOP_KINDS.has(o.kind)) { shopAnchor = { x: o.x, z: o.z }; moveTarget = target = null; }
}
function travelTo(id, mode, depthArg) {
  closeAll(); closeWaypoints();
  if (wildById(id)) { enterWild(id); return; }                 // a specific biome (greenwilds/frostfen/ashlands)
  const a = AREAS.find(x => x.id === id); if (!a) return;
  if (a.kind === 'town') enterTown(a); else if (a.kind === 'wild') enterWild(REGIONS[0].id);   // legacy 'wilds' → Greenwilds
  else if (a.kind === 'dungeon') { const max = Math.max(1, (character && character.maxDepth) || 1); const d = mode === 'depth' ? clamp(Math.round(depthArg || 1), 1, max) : (mode === 'deep' && character.maxDepth > 1 ? character.maxDepth : 1); enterDungeon(d); }
}

let last = now(), waveTimer = 0, running = false, saveTimer = 0, invOpen = false, skillOpen = false, vendorOpen = false, stashOpen = false, smithOpen = false, enchantOpen = false, gambleOpen = false, jewelerOpen = false, alchemistOpen = false;
function anyPanel() { return invOpen || skillOpen || vendorOpen || stashOpen || smithOpen || enchantOpen || gambleOpen || jewelerOpen || alchemistOpen; }
/* Move/fight stay live with the inventory OR any shop open, so the player can walk away (update() auto-closes
   a shop once they leave shopAnchor). Only the full-screen skill forest pauses input. */
function busyPanel() { return skillOpen; }
function anyModal() { try { return (wpModal && wpModal.style.display === 'block') || (mpModal && mpModal.style.display === 'block') || (settingsModal && settingsModal.style.display === 'block') || (helpModal && helpModal.style.display === 'block'); } catch (_) { return false; } }
function syncBackdrop() { const b = document.getElementById('backdrop'); if (b) b.style.display = anyModal() ? 'block' : 'none'; }
function update(dt) {
  const T = now(); /* Phase 1: one frame timestamp reused for all same-frame sine anims + time-gates below (was ~30-60 performance.now() calls/frame) */
  const fr = dt * 60 / 1000; /* elapsed time in 60ths-of-a-second. Frame-count timers (atkCd/slow/life/…) are decremented by `fr` instead of 1 so their reset constants stay tuned to 60fps while ticking in real time — enemy DPS and projectile range no longer scale with the player's refresh rate. */
  shake *= 0.85;
  if (running && !busyPanel()) {
    if (rmbDown && isCombat() && !player.stunned) { const hid = character.loadout[1], hd = SKILLDEFS[hid]; if (hd && hd.kind !== 'melee' && player.mp >= Math.round(hd.cost * resolveSkill(hid).costMult)) castActive(hid, { x: mouseWorld.x, z: mouseWorld.z }); }
    if (lmbDown) {
      const hm = isCombat() ? monsterAt() : null; if (hm) { target = hm; moveTarget = null; }
      else if (Math.hypot(mouseWorld.x - player.x, mouseWorld.z - player.z) > 1.0) { moveTarget = { x: mouseWorld.x, z: mouseWorld.z }; target = null; } else { target = null; }
    }
  }
  if (isCombat()) {
    if (player.stunned) { /* stunned: cannot move or attack */ }
    else if (target) {
      const d = Math.hypot(target.x - player.x, target.z - player.z); const reach = player.range + (target.r || 0); if (d > reach) moveToward(target.x, target.z, dt);
      else { player.dir = Math.atan2(target.x - player.x, target.z - player.z); if (T - player.attackCd > player.attackRate) { player.attackCd = T; player.swing = T; hitMonster(target, player); } }
    }
    else if (moveTarget) { moveToward(moveTarget.x, moveTarget.z, dt); if (Math.hypot(moveTarget.x - player.x, moveTarget.z - player.z) < 0.5) moveTarget = null; }
  } else { if (moveTarget) { moveToward(moveTarget.x, moveTarget.z, dt); if (Math.hypot(moveTarget.x - player.x, moveTarget.z - player.z) < 0.5) moveTarget = null; } }
  if (running && shopAnchor && Math.hypot(player.x - shopAnchor.x, player.z - shopAnchor.z) > 7) closeAll();
  player.mp = Math.min(player.mpMax, player.mp + dt * player.mpRegen);
  if (player.hpRegen > 0 && player.hp > 0 && player.hp < player.hpMax) player.hp = Math.min(player.hpMax, player.hp + dt * player.hpRegen);
  if (running) tickStatuses(player, dt, true);
  /* each wild is now a single-biome bounded map (no walk-between-biomes) — region is fixed on entry by enterWild */

  if (isCombat()) for (const m of monsters) {
    if (m.hp <= 0) continue; if (m.flash > 0) m.flash -= fr; tickStatuses(m, dt, false); if (m.hp <= 0) continue; if (player.effects.chillaura && Math.hypot(m.x - player.x, m.z - player.z) < 14 && m.slow < 12) m.slow = 12; const sp = m.speed * (m.speedMult || 1) * Math.min(m.slow > 0 ? 0.45 : 1, m.chilled ? 0.5 : 1) * 60 * dt / 1000; if (m.slow > 0) m.slow -= fr; const d = Math.hypot(m.x - player.x, m.z - player.z);
    if (m.flee) { m.ttl -= dt; if (m.ttl <= 0) { removeMob(m.mesh); monsters = monsters.filter(x => x !== m); if (target === m) target = null; showMsg('The goblin escaped!'); continue; } } // escape: clean vanish (no death anim), drops NOTHING (must not route through killMonster)
    if (!m.stunned) {
      if (m.elite && m.elite.includes('arcane')) { m.arcaneCd -= fr; if (m.arcaneCd <= 0 && d < 55) { m.arcaneCd = 90; const a = Math.atan2(player.x - m.x, player.z - m.z); const pm = makeOrb(m.x, 2, m.z, 0xc06aff, 0.5); scene.add(pm); projectiles.push({ x: m.x, z: m.z, vx: Math.sin(a) * 0.5, vz: Math.cos(a) * 0.5, dmg: m.dmg, kind: 'enemy', life: 150, mesh: pm, mods: m.elite }); } }
      if (m.flee) { stepEnt(m, 2 * m.x - player.x, 2 * m.z - player.z, sp); } else if (m.boss) { bossAI(m, dt, d, sp); } else if (m.ranged) {
        if (d > 34) stepEnt(m, player.x, player.z, sp); else if (d < 20) stepEnt(m, m.x - (player.x - m.x), m.z - (player.z - m.z), sp);
        m.atkCd -= fr; if (d < 42 && m.atkCd <= 0) { m.atkCd = 110; const a = Math.atan2(player.x - m.x, player.z - m.z); const mesh = makeOrb(m.x, 2, m.z, 0xb06aff, 0.45); scene.add(mesh); projectiles.push({ x: m.x, z: m.z, vx: Math.sin(a) * 0.55, vz: Math.cos(a) * 0.55, dmg: m.dmg, kind: 'enemy', life: 150, mesh }); }
      }
      else { if (d > m.r + player.r - 0.4) stepEnt(m, player.x, player.z, sp); else { m.atkCd -= fr; if (m.atkCd <= 0) { m.atkCd = 60; damagePlayer(m.dmg, m.elite); if (player.effects.thorns > 0) { m.hp -= player.effects.thorns; m.flash = 8; if (m.hp <= 0) killMonster(m); } } } }
    }
    resolveCircles(m, m.r, activeColliders(), 1); { const dx = m.x - player.x, dz = m.z - player.z; let d = Math.hypot(dx, dz); const min = m.r + player.r; if (d < min && d > 0.0001) { m.x += dx / d * (min - d); m.z += dz / d * (min - d); } } clampEntToZone(m);
    m.mesh.position.set(m.x, m.mesh.userData.glb ? 0 : Math.abs(Math.sin(T * 0.004 + m.bob)) * 0.3, m.z); m.mesh.lookAt(player.x, m.mesh.position.y, player.z); if (m.mesh.userData.body) m.mesh.userData.body.material.emissive.setHex(m.flash > 0 ? 0x884400 : 0x000000); if (m.mesh.userData.mixer) m.mesh.userData.mixer.update(dt * 0.001); if (m.mesh.userData.aura) { m.mesh.userData.aura.rotation.z += 0.05; const s2 = 1 + Math.sin(T * 0.006) * 0.12; m.mesh.userData.aura.scale.set(s2, s2, s2); }
  }

  for (const p of projectiles) {
    if (p.homing && monsters.length) { let hb = null, hd = 1e9; for (const m of monsters) { const d = Math.hypot(m.x - p.x, m.z - p.z); if (d < hd) { hd = d; hb = m; } } if (hb) { const sp = Math.hypot(p.vx, p.vz) || 0.8, ca = Math.atan2(p.vx, p.vz), rel = Math.atan2(hb.x - p.x, hb.z - p.z) - ca, da = Math.atan2(Math.sin(rel), Math.cos(rel)), na = ca + clamp(da, -0.09, 0.09); p.vx = Math.sin(na) * sp; p.vz = Math.cos(na) * sp; } }
    p.x += p.vx * 60 * dt / 1000; p.z += p.vz * 60 * dt / 1000; p.life -= fr; p.mesh.position.set(p.x, 2, p.z);
    if (p.kind === 'enemy') { if (Math.hypot(p.x - player.x, p.z - player.z) < player.r + 0.6) { damagePlayer(p.dmg, p.mods); if (p.chill) applyStatus(player, 'chill', 1400, 0); p.life = 0; } }
    else { for (const m of monsters) { if (Math.hypot(p.x - m.x, p.z - m.z) < m.r + 0.6) { if (p.hit && p.hit.has(m)) continue; hitMonsterProj(m, p.dmg, p.kind); if (m.hp > 0) { if (p.kind === 'frost') m.slow = p.slow; if (p.onHit) applyOnHit(m, p.onHit, p.dmg); if (p.freeze) applyStatus(m, 'chill', 1500, 0); if (p.knockback) { const a = Math.atan2(m.x - p.x, m.z - p.z); m.x += Math.sin(a) * 2.2; m.z += Math.cos(a) * 2.2; } } if (p.vampiric) player.hp = Math.min(player.hpMax, player.hp + p.dmg * 0.12); projBurst(p); if (p.hit) p.hit.add(m); if (p.pierce && p.pierce > 0) { p.pierce--; } else { p.life = 0; break; } } } }
    if (Math.abs(p.x) > MAP || Math.abs(p.z) > MAP) p.life = 0;
  }
  _compact(projectiles, _deadLife0, _killMesh);
  for (const e of fx) {
    e.life -= fr;
    if (e.life0) { const t = Math.max(0, e.life / e.life0); if (e.vx != null) { const k = dt * 0.001; e.mesh.position.x += e.vx * k; e.mesh.position.y += e.vy * k; e.mesh.position.z += e.vz * k; e.vy -= e.grav * k; if (e.spin) { e.mesh.rotation.x += e.spin; e.mesh.rotation.z += e.spin * 0.8; } } e.mesh.scale.setScalar(e.scale0 * t); }
    else if (e.mesh.material) { e.mesh.material.opacity = e.life / 14; }
  }
  _compact(fx, _deadLife0, _killMesh);
  for (let i = _dying.length - 1; i >= 0; i--) { const d = _dying[i]; if (d.g.userData.mixer) d.g.userData.mixer.update(dt * 0.001); d.t -= dt; if (d.t <= 0) { if (d.g.userData.mixer) d.g.userData.mixer.stopAllAction(); removeMesh(d.g); _dying.splice(i, 1); } }

  for (const l of loots) {
    l.t += dt * 0.005; l.icon.position.y = 1 + Math.sin(l.t) * 0.25; l.icon.rotation.y += 0.04; if (l.ring) { l.ring.rotation.z += 0.02; const ps = 1 + Math.sin(l.t * 1.4) * 0.12; l.ring.scale.set(ps, ps, ps); } if (l.beam && l.tier >= 4) l.beam.material.opacity = 0.4 + Math.sin(l.t * 2) * 0.12; if (Math.hypot(l.x - player.x, l.z - player.z) < player.r + 1.4) {
      if (l.kind === 'gold') { player.gold += l.payload; goldTxt.textContent = player.gold + ' g'; floatText(l.payload + 'g', player.x, player.z, '#ffe27a'); sfx('gold'); l.dead = true; }
      else if (l.kind === 'potion') { player.hpPotions = Math.min(character.potionCap, player.hpPotions + 1); floatText('+Potion', player.x, player.z, '#ff6b5b'); l.dead = true; }
      else if (l.kind === 'manapotion') { player.mpPotions = Math.min(character.potionCap, player.mpPotions + 1); floatText('+Mana', player.x, player.z, '#5a9bff'); l.dead = true; }
      else if (l.kind === 'gem') { const k = l.payload.t + ':' + l.payload.q; character.gems = character.gems || {}; character.gems[k] = (character.gems[k] || 0) + 1; floatText('+' + gemName(l.payload), player.x, player.z, '#9fe8ff'); sfx('gold'); l.dead = true; if (invOpen) renderInv(); }
      else { const lf = SAVE._data && SAVE._data.settings && SAVE._data.settings.lootFilter; if (lf && !lootPasses(lf, l.payload)) { const g = sellValue(l.payload), du = dustValue(l.payload); player.gold += g; character.materials = (character.materials || 0) + du; goldTxt.textContent = player.gold + ' g'; floatText('+' + g + 'g · +' + du + '✦', player.x, player.z, '#caa84a'); l.dead = true; } else if (character.inventory.length < character.invMax) { character.inventory.push(l.payload); floatText(l.payload.name, player.x, player.z, '#' + RCOL[l.payload.rarity].toString(16).padStart(6, '0')); l.dead = true; if (invOpen) renderInv(); updatePips(); } else if (T - _bagFullAt > 2500) { _bagFullAt = T; floatText('Bag full!', player.x, player.z, '#ff8'); } }
    }
  }
  _compact(loots, _deadFlag, _killMesh);

  for (const f of floats) { f.y += dt * 0.002; f.life -= fr; } _compact(floats, _deadLife0, null);

  hero.position.set(player.x, Math.abs(Math.sin(player.bob)) * 0.15, player.z); hero.rotation.y = player.dir;
  const sw = clamp((T - player.swing) / 150, 0, 1); if (hero.userData.sword) hero.userData.sword.rotation.z = sw < 1 ? (-1.4 + sw * 2.4) : -0.2;
  if (hero.userData.mixer) { hero.userData.mixer.update(dt * 0.001); const _mv = (player._px !== undefined) && (Math.hypot(player.x - player._px, player.z - player._pz) > 0.03); if ((T - player.swing) < 300) glbPlay(hero, 'attack', true); else glbPlay(hero, _mv ? 'walk' : 'idle'); player._px = player.x; player._pz = player.z; }
  const activeFires = zone === 'town' ? townFires : zone === 'wild' ? wildFires : dungeonFires;
  for (const f of activeFires) { f.light.intensity = f.base + Math.sin(T * 0.02 + f.x) * 1.26; f.flame.scale.y = 1 + Math.sin(T * 0.03 + f.z) * 0.15; f.flame.rotation.y += 0.03; } /* Phase 1a: flicker amplitude scaled by ~Math.PI (0.4->1.26); f.base already scales with the x-pi construction intensity. */
  for (const c of waypointMarks) { c.rotation.y += 0.03; c.position.y = 5.4 + Math.sin(T * 0.003) * 0.18; }
  if (zone === 'wild') { wpTown.ring.rotation.z += 0.02; wpCave.ring.rotation.z += 0.02; if (wpNext.group.visible) wpNext.ring.rotation.z += 0.02; if (wpPrev.group.visible) wpPrev.ring.rotation.z += 0.02; }
  else if (zone === 'town') { t_wildPortal.ring.rotation.z += 0.02; for (const n of npcs) { n.group.userData.marker.rotation.y += 0.04; n.group.userData.marker.position.y = 4.6 + Math.sin(T * 0.004) * 0.2; if (n.group.userData.npcEnt) n.group.userData.npcEnt.userData.mixer.update(dt * 0.001); } for (const v of townVillagers) { if (v.userData.mixer) v.userData.mixer.update(dt * 0.001); } if (t_cauldron) { t_cauldron.marker.rotation.y += 0.05; t_cauldron.marker.position.y = 3.4 + Math.sin(T * 0.004) * 0.22; t_cauldron.brew.position.y = 2.02 + Math.sin(T * 0.008) * 0.05; } }
  else if (d_deeperPortal) { d_deeperPortal.ring.rotation.z += 0.02; }
  torch.position.set(player.x, 9, player.z); playerGlow.position.set(player.x, 14, player.z); updateAmbient(dt); if (typeof NET !== 'undefined') NET.tick(dt);

  if (isCombat() && !bossActive) { waveTimer -= dt; if (_spawnQueue.length === 0 && monsters.length < MOB_CAP && (waveTimer <= 0 || monsters.length < 3)) { spawnWave(); waveTimer = 4200; } drainSpawns(dt); }
  saveTimer -= dt; if (saveTimer <= 0) { saveTimer = 8000; saveProgress(false); }

  const o = nearest(); const pr = promptEl;
  if (o && !anyPanel()) {
    const lbl = (o.kind === 'deeper') ? ('descend deeper (Depth ' + (depth + 1) + ')') : (o.kind === 'towngate') ? ('enter ' + ((AREAS.find(a => a.id === o.area) || {}).name || 'the town')) : (o.kind === 'wildnext' || o.kind === 'wildprev') ? ('travel to ' + ((wildById(o.to) || {}).name || 'the wilds')) : PROMPT_LABELS[o.kind];
    const html = `Press <b>E</b> to ${lbl}`; if (html !== _promptHtml) { _promptHtml = html; pr.innerHTML = html; pr.style.display = 'block'; }
  } else if (_promptHtml !== null) { _promptHtml = null; pr.style.display = 'none'; }

  const bb = bossBarEl;
  if (bossActive && boss) {
    if (_bbShown !== true) { _bbShown = true; bb.style.display = 'block'; }
    if (boss.name !== _bbName) { _bbName = boss.name; document.getElementById('bossName').textContent = boss.name; }
    const pct = clamp(boss.hp / boss.hpMax * 100, 0, 100); if (pct !== _bbPct) { _bbPct = pct; document.getElementById('bossFill').style.width = pct + '%'; }
  } else if (_bbShown !== false) { _bbShown = false; bb.style.display = 'none'; }
  renderObjective();

  placeCamera(player); updateGlobes();
  _floatAcc -= dt; if (_floatAcc <= 0) { _floatAcc = 33; renderFloats(); }
  _plAcc -= dt; if (_plAcc <= 0) { _plAcc = 120; cullLights(); }
  _uiAcc -= dt; if (_uiAcc <= 0) { _uiAcc = 66; renderSkillCd(); drawMinimap(); updateDebug(); }
}
let _floatAcc = 0, _uiAcc = 0, _plAcc = 0, _dbgOn = false, _bagFullAt = -9999;
/* ---- Phase 0 perf rig: frame-time ring buffer + GPU-timestamp sampling. recordFrame() is a single typed-array
   write per frame (~free), so it always runs; GPU ms only sampled in perf mode (_tsSupported). ---- */
let _gpuMs = 0, _tsSupported = false;
const _ftBuf = new Float32Array(240), _ftScratch = new Float32Array(240); let _ftIdx = 0, _ftCount = 0;
function recordFrame(dt) { _ftBuf[_ftIdx] = dt; _ftIdx = (_ftIdx + 1) % _ftBuf.length; if (_ftCount < _ftBuf.length) _ftCount++; }
function framePctl() {
  const n = _ftCount; if (!n) return { p50: 0, p95: 0, p99: 0, max: 0 };
  _ftScratch.set(_ftBuf.subarray(0, n)); const s = _ftScratch.subarray(0, n); s.sort(); /* TypedArray.sort is numeric-ascending, in place, no alloc/comparator */
  const at = q => s[Math.min(n - 1, Math.floor(q * n))];
  return { p50: at(0.5), p95: at(0.95), p99: at(0.99), max: s[n - 1] };
}
function updateDebug() {
  if (!_dbgOn) return; const el = document.getElementById('dbg'); if (!el) return;
  const lights = (() => { let n = 0; scene.traverse(o => { if (o.isLight && o.visible) n++; }); return n; })();
  const ft = framePctl(); /* Phase 0 rig: draws/tris come from _lastDraws/_lastTris captured post-render (ri.calls is a broken lifetime accumulator under WebGPU r184; live drawCalls reads 0 here because info resets before this runs) */
  el.innerHTML = `FPS ${_fps.toFixed(0)}  gpu ${_tsSupported ? _gpuMs.toFixed(2) + 'ms' : (_perf ? '—' : 'off')}\nframe p50 ${ft.p50.toFixed(1)} p95 ${ft.p95.toFixed(1)} p99 ${ft.p99.toFixed(1)} max ${ft.max.toFixed(1)}ms\nzone ${zone}${zone === 'dungeon' ? ' d' + depth : ''}\ndraws ${_lastDraws}  tris ${(_lastTris / 1000).toFixed(1)}k\nmonsters ${monsters.length}  proj ${projectiles.length}\nloot ${loots.length}  fx ${fx.length}  floats ${floats.length}\nscene objs ${scene.children.length}  lights ${lights}\nremotes ${typeof NET !== 'undefined' ? NET.remotes.size : 0}` +
    (_errCount ? `\n<span class="err">errors ${_errCount}: ${escapeHtml(_lastErr).slice(0, 60)}</span>` : '');
}
function clampEntToZone(e) { if (zone === 'town') { const d = Math.hypot(e.x, e.z); if (d > TOWN_R) { e.x = e.x / d * TOWN_R; e.z = e.z / d * TOWN_R; } } else if (zone === 'dungeon') { if (e.x > DUNG_HALF) e.x = DUNG_HALF; else if (e.x < -DUNG_HALF) e.x = -DUNG_HALF; if (e.z > DUNG_HALF) e.z = DUNG_HALF; else if (e.z < -DUNG_HALF) e.z = -DUNG_HALF; } else { const d = Math.hypot(e.x, e.z); if (d > WILD_R) { e.x = e.x / d * WILD_R; e.z = e.z / d * WILD_R; } } }
function clampToZone() { clampEntToZone(player); }
function moveToward(tx, tz, dt) {
  const a = Math.atan2(tx - player.x, tz - player.z); const fr = Math.min(dt || 16.667, 50) / 16.667; const sp = player.speed * 0.96 * fr * (now() < player.chillUntil ? 0.5 : 1) * (player.buffs.fleetUntil > now() ? player.buffs.fleetMul : 1); player.x += Math.sin(a) * sp; player.z += Math.cos(a) * sp; player.dir = a; player.bob += 0.3;
  resolveCircles(player, player.r, activeColliders(), 2);
  if (isCombat()) resolveCircles(player, player.r, monsters, 1);
  clampEntToZone(player);
}
function stepEnt(e, tx, tz, sp) { const a = Math.atan2(tx - e.x, tz - e.z); e.x += Math.sin(a) * sp; e.z += Math.cos(a) * sp; clampEntToZone(e); }
function damagePlayer(d, mods) {
  if (_perfGod) return; /* perf rig: invincible under the perftest harness */
  if (Math.random() < (player.effects.dodge || 0)) { floatText('Dodge', player.x, player.z, '#9ff'); return; }
  const dr = player.armor / (player.armor + 40); d = d * (1 - Math.min(dr, 0.75));
  if (player.effects.flatDR > 0) d *= (1 - player.effects.flatDR);
  { const e = player.effects; let res = e.allRes || 0; if (mods && mods.includes) { if (mods.includes('fiery')) res += e.fireRes || 0; else if (mods.includes('frozen')) res += e.frostRes || 0; else if (mods.includes('arcane')) res += e.lightningRes || 0; else if (mods.includes('toxic')) res += e.poisonRes || 0; } if (res > 0) d *= (1 - Math.min(res, 75) / 100); } if (player.buffs.cryUntil > now()) d *= (1 - player.buffs.cryDR); if (player.effects.manaShield > 0 && player.mp > 0) { const ab = Math.min(d * player.effects.manaShield, player.mp); player.mp -= ab; d -= ab; } player.hp -= d; if (player.hp < 0) player.hp = 0; floatText('-' + Math.round(d), player.x, player.z, '#ff5b4b'); sfx('hurt'); shake = Math.min(1.6, shake + 0.6); const hf = document.getElementById('hurtFlash'); hf.style.opacity = Math.min(0.6, 0.25 + d / player.hpMax); clearTimeout(hf._t); hf._t = setTimeout(() => hf.style.opacity = 0, 120); if (mods && mods.includes && mods.includes('frozen')) { player.chillUntil = now() + 1500; floatText('Chilled', player.x, player.z - 1, '#9ff'); } updateGlobes(); if (player.hp <= 0) { sfx('die'); gameOver(); }
}

function saveProgress(showNote) { if (currentSlot === null || !character) return false; character.level = player.level; character.xp = player.xp; character.xpNext = player.xpNext; character.gold = player.gold; character.kills = player.kills; character.potions = player.hpPotions; character.hpPotions = player.hpPotions; character.mpPotions = player.mpPotions; const ok = SAVE.saveCharacter(currentSlot, character); if (showNote || !ok) flashSaved(ok); return ok; } /* surface a failure even on a silent autosave — a full localStorage quietly loses progress otherwise */
function flashSaved(ok) { const n = document.getElementById('saveNote'); if (ok === false) { n.textContent = '⚠ Save failed — storage full'; n.style.color = '#e07a5a'; } else { n.textContent = 'Saved'; n.style.color = ''; } n.style.opacity = 1; clearTimeout(n._t); n._t = setTimeout(() => n.style.opacity = 0, ok === false ? 2600 : 900); }

/* ---------- MINIMAP ---------- */
const mm = document.getElementById('minimap'), mctx = mm.getContext('2d'); const MMR = 85, MM_RANGE = 120, MM_SCALE = MMR / MM_RANGE;
function mmDot(wx, wz, col, size) { const dx = (wx - player.x) * MM_SCALE, dz = (wz - player.z) * MM_SCALE; if (dx * dx + dz * dz > MMR * MMR) return; mctx.fillStyle = col; mctx.beginPath(); mctx.arc(MMR + dx, MMR + dz, size, 0, 7); mctx.fill(); }
function drawMinimap() {
  mctx.clearRect(0, 0, 170, 170); mctx.save(); mctx.beginPath(); mctx.arc(MMR, MMR, MMR, 0, 7); mctx.clip();
  mctx.fillStyle = 'rgba(10,8,6,0.4)'; mctx.fillRect(0, 0, 170, 170);
  // interactables
  const colMap = { vendor: '#9f6aff', stash: '#ffd24d', smith: '#ff8a3a', wild: '#6affa0', town: '#9f6aff', cave: '#ff8a3a', deeper: '#c04aff', cauldron: '#55ffa0', towngate: '#ffd24d', waypoint: '#6ab0ff', wildnext: '#bcd0ff', wildprev: '#9ad86a' };
  for (const o of interactables()) { let col = colMap[o.kind] || '#fff'; if (o.kind === 'towngate') col = (character && character.discovered && character.discovered[o.area]) ? '#ffd24d' : '#777'; mmDot(o.x, o.z, col, o.kind === 'towngate' ? 4.5 : 3.5); }
  // loot
  for (const l of loots) mmDot(l.x, l.z, l.kind === 'item' ? '#' + RCOL[l.payload.rarity].toString(16).padStart(6, '0') : '#ffe27a', 2);
  // monsters
  for (const m of monsters) mmDot(m.x, m.z, m.boss ? '#ff3020' : (m.elite ? '#ff9a3a' : '#e05040'), m.boss ? 6 : (m.elite ? 4 : 2.5));
  // player arrow
  mctx.fillStyle = '#ffe6a0'; mctx.save(); mctx.translate(MMR, MMR); mctx.rotate(-player.dir + Math.PI);
  mctx.beginPath(); mctx.moveTo(0, -5); mctx.lineTo(4, 4); mctx.lineTo(-4, 4); mctx.closePath(); mctx.fill(); mctx.restore();
  mctx.restore();
}

/* ---------- HUD ---------- */
const healthFill = document.getElementById('healthFill'), manaFill = document.getElementById('manaFill');
const hpTxt = document.getElementById('hpTxt'), mpTxt = document.getElementById('mpTxt'), xpfill = document.getElementById('xpfill');
const lvlNum = document.getElementById('lvlNum'), killsTxt = document.getElementById('killsTxt'), charName = document.getElementById('charName'), goldTxt = document.getElementById('goldTxt'), zoneTxt = document.getElementById('zoneTxt'), townBtn = document.getElementById('townBtn');
const lvlBadgeNum = document.getElementById('lvlBadgeNum');
const promptEl = document.getElementById('prompt'), bossBarEl = document.getElementById('bossBar'); /* static HUD nodes — cached once instead of a getElementById every frame in update() */
function setLevelText(n) { const s = String(n); lvlNum.textContent = s; if (lvlBadgeNum) lvlBadgeNum.textContent = s; }
/* Phase 1: HUD dirty-cache — updateGlobes/prompt/boss-bar ran ~8 DOM style+text writes EVERY frame
   (each forces style recalc/layout). Now each write is gated on its value actually changing. Reset on
   zone entry via _resetHudCache() (covers character load) so a fresh char never inherits stale cache. */
let _gHpPct = NaN, _gHpN = -1, _gHpMax = -1, _gMpPct = NaN, _gMpN = -1, _gMpMax = -1, _gXpPct = NaN, _gHpP = -1, _gMpP = -1;
let _promptHtml = null, _bbShown = null, _bbName = '', _bbPct = -1;
function _resetHudCache() { _gHpPct = NaN; _gHpN = -1; _gHpMax = -1; _gMpPct = NaN; _gMpN = -1; _gMpMax = -1; _gXpPct = NaN; _gHpP = -1; _gMpP = -1; _promptHtml = null; _bbShown = null; _bbName = ''; _bbPct = -1; }
/* Phase 1: hoisted out of the per-frame prompt block (was a ~13-key object literal allocated every frame while near an interactable). Dynamic labels (deeper/towngate) computed inline. */
const PROMPT_LABELS = { vendor: 'trade with the Merchant', stash: 'open your Stash', smith: 'upgrade gear at the Smith', enchanter: 'enchant gear at the Enchanter', gambler: 'gamble with the Gambler', jeweler: 'visit the Jeweler', premiumVendor: 'trade with the Exotic Merchant', wild: 'enter the Wilderness', town: 'return to Town', cave: 'descend into the Dungeon', waypoint: 'use the Waypoint (fast travel)', cauldron: 'refill Health & Mana potions', shrine: 'commune with the Shrine' };
function updateGlobes() {
  const hpPct = player.hp / player.hpMax * 100; if (hpPct !== _gHpPct) { _gHpPct = hpPct; healthFill.style.height = hpPct + '%'; }
  const hpN = Math.round(player.hp); if (hpN !== _gHpN || player.hpMax !== _gHpMax) { _gHpN = hpN; _gHpMax = player.hpMax; hpTxt.textContent = hpN + '/' + player.hpMax; }
  const mpPct = player.mp / player.mpMax * 100; if (mpPct !== _gMpPct) { _gMpPct = mpPct; manaFill.style.height = mpPct + '%'; }
  const mpN = Math.round(player.mp); if (mpN !== _gMpN || player.mpMax !== _gMpMax) { _gMpN = mpN; _gMpMax = player.mpMax; mpTxt.textContent = mpN + '/' + player.mpMax; }
  const xpPct = player.xp / player.xpNext * 100; if (xpPct !== _gXpPct) { _gXpPct = xpPct; xpfill.style.width = xpPct + '%'; }
  if (player.hpPotions !== _gHpP || player.mpPotions !== _gMpP) {
    _gHpP = player.hpPotions; _gMpP = player.mpPotions;
    const pc = document.getElementById('potCount'); if (pc) { pc.textContent = player.hpPotions; const pm = document.getElementById('potCountM'); if (pm) pm.textContent = player.mpPotions; document.getElementById('potionInd').classList.toggle('empty', player.hpPotions <= 0 && player.mpPotions <= 0); }
  }
}
function updatePips() { const ip = document.getElementById('invPip'), sp = document.getElementById('skillPip'); if (character) { const tot = (character.skillPoints || 0) + (character.abilityPoints || 0); sp.style.display = tot > 0 ? 'flex' : 'none'; sp.textContent = tot; ip.style.display = 'none'; } }
function slotKeyLabel(i) { if (i === 0) return 'LMB'; if (i === 1) return 'RMB'; return (KEYBINDS['skill' + (i - 1)] || []).map(keyLabel)[0] || '—'; }
function unlockedActives() { return ACTIVE_ORDER.filter(id => id !== 'strike' && character.skills[id] >= 1); }
// Spend one ability point to learn a class ability whose level requirement is met (shared pool with rune nodes).
function unlockAbility(id) {
  const req = (CLASS_ACTIVES[character.class] || {})[id];
  if (req == null || (character.skills[id] || 0) >= 1) return;
  if (player.level < req) { showMsg('Requires level ' + req); return; }
  if ((character.abilityPoints || 0) < 1) { showMsg('Not enough ability points'); return; }
  character.skills[id] = 1; character.abilityPoints -= 1;
  recompute(); renderSkillbar(); renderAbilities(); updatePips(); sfx('level'); saveProgress(false);
}
// Assign a skill to a bar slot (1..5; slot 0 is the fixed basic attack). Dedupes across slots; RMB (1) drives activeSkillId.
function setLoadoutSlot(slot, id) {
  if (slot < 1 || slot > 5) return;
  if (!Array.isArray(character.loadout) || character.loadout.length !== 6) character.loadout = defaultLoadout(character);
  if (id) for (let i = 1; i < 6; i++) if (i !== slot && character.loadout[i] === id) character.loadout[i] = null;
  character.loadout[slot] = id || null;
  if (slot === 1) character.activeSkillId = character.loadout[1] || null;
  renderSkillbar(); SAVE.persist();
}
// Computes the live damage a skill deals right now, using the SAME inputs castActive uses (player.dmg, the
// spell/melee multipliers, skM with the active-skill bonus, and SKILL_COEF). Returns null for passives/unknown.
function skillDamageInfo(id) {
  const def = SKILLDEFS[id]; if (!def || def.type !== 'active') return null; const c = SKILL_COEF[def.kind]; if (!c) return null;
  let rank = (character.skills[id] || 0) + ((player.effects && player.effects.allskills) || 0); if (rank < 1) rank = 1;
  const skM = (player.skillMult || 1) * ((id === character.activeSkillId) ? (player.activeSkillDmg || 1) : 1);
  let mult; if (c.school === 'spell') mult = (player.spellMult || 1) * skM; else if (c.school === 'melee') mult = (player.meleeMult || 1) * skM; else if (c.school === 'skill') mult = skM; else mult = 0;
  const R = resolveSkill(id);
  const coef = c.coef ? c.coef(rank) : 0; const critM = c.critMult ? ((player.effects && player.effects.critdmg) ? 3 : 2) : 1;
  const dmg = Math.round((player.dmg || 0) * coef * mult * critM * R.dmgMult);
  const hits = ((typeof c.hits === 'function') ? c.hits(rank) : (c.hits || 1)) + (R.addProj || 0) + (R.addHits || 0);
  return { dmg, school: c.school, hits, perTick: c.perTick, note: c.note, isActive: (id === character.activeSkillId), onHit: def.onHit };
}
function skillTip(id) {
  const def = SKILLDEFS[id]; if (!def) return ''; const rank = character.skills[id] || 0; const R = resolveSkill(id);
  const rCost = Math.round((def.cost || 0) * R.costMult), rCd = (def.cd || 0) * R.cdrMult;
  const meta = []; if (def.cost) meta.push(rCost + ' mana'); if (def.cd) meta.push((rCd / 1000).toFixed(rCd % 1000 ? 1 : 0) + 's cd'); meta.push(def.maxRank > 1 ? ('Rank ' + rank + '/' + def.maxRank) : (rank >= 1 ? 'Learned' : 'Locked'));
  let html = `<div class="tname">${def.ico} ${def.name}</div><div class="tslot">${def.type === 'passive' ? 'Passive' : 'Active'}${def.elem ? ' · ' + def.elem : ''} · ${meta.join(' · ')}</div>`;
  html += `<div class="base" style="margin:4px 0">${def.desc}</div>`;
  const info = skillDamageInfo(id);
  if (info) {
    let dl;
    if (info.school === 'none') dl = '<span style="color:#9fd0ff">Utility skill</span>';
    else if (info.perTick) dl = `Damage <span class="aff">~${info.dmg}</span> / tick`;
    else if (info.hits > 1) dl = `Damage <span class="aff">~${info.dmg}</span> × ${info.hits} hits`;
    else dl = `Damage <span class="aff">~${info.dmg}</span>`;
    if (info.note) dl += ` <span style="color:#8a7a5a">(${info.note})</span>`;
    html += `<div>${dl}</div>`;
    if (info.isActive && info.school !== 'none' && (player.activeSkillDmg > 1)) html += `<div style="color:#7fd07f;font-size:11px">▲ selected-skill bonus applied</div>`;
    if (info.onHit) html += `<div style="color:#ff9a5b;font-size:11px">On hit: ${info.onHit}</div>`;
  }
  const _al = character.skillRunes && character.skillRunes[id], _tr = SKILL_RUNES[id];
  if (_al && _tr) { const labels = []; for (const nid in _al) { if (_al[nid] && _tr.nodes[nid]) labels.push(_tr.nodes[nid].label + (_tr.nodes[nid].max > 1 ? ' ' + _al[nid] : '')); } if (labels.length) html += `<div style="color:#9f6aff;font-size:11px;margin-top:3px">✦ Runes: ${labels.join(', ')}</div>`; }
  if (rank < 1 && def.req) html += `<div style="color:#d07f7f;font-size:11px;margin-top:3px">Requires level ${def.req}</div>`;
  return html;
}
// D3/D4 action bar: 6 fixed slots from character.loadout — [0]=LMB basic (locked), [1]=RMB, [2..5]=key1..4.
function renderSkillbar() {
  const bar = document.getElementById('skillbar'); if (!bar || !character) return;
  if (!Array.isArray(character.loadout) || character.loadout.length !== 6) character.loadout = defaultLoadout(character);
  character.loadout[0] = 'strike';
  bar.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const id = character.loadout[i], def = id ? SKILLDEFS[id] : null;
    const d = document.createElement('div');
    const isActive = (i === 1 && id && id === character.activeSkillId);
    d.className = 'skill' + (i === 0 ? ' basic' : '') + (isActive ? ' active' : '') + (!def ? ' empty' : '');
    d.dataset.slot = i;
    if (def) {
      d.innerHTML = `<span class="key">${slotKeyLabel(i)}</span><span class="ico">${def.ico}</span>` +
        (def.cost ? `<span class="cost">${def.cost}mp</span>` : '') +
        (def.maxRank > 1 ? `<span class="rank">R${character.skills[id] || 1}</span>` : '') +
        `<div class="cd" data-id="${id}"></div>`;
      d.onmouseenter = ev => { tooltip.innerHTML = skillTip(id); tooltip.style.display = 'block'; moveTip(ev); };
      d.onmousemove = moveTip; d.onmouseleave = () => tooltip.style.display = 'none';
    } else {
      d.innerHTML = `<span class="key">${slotKeyLabel(i)}</span><span class="ico" style="opacity:.3">＋</span>`;
      d.onmouseenter = ev => { tooltip.innerHTML = '<div class="tname">Empty slot</div><div class="tslot">Open Skills to assign an ability</div>'; tooltip.style.display = 'block'; moveTip(ev); };
      d.onmousemove = moveTip; d.onmouseleave = () => tooltip.style.display = 'none';
    }
    d.onmousedown = ev => { ev.stopPropagation(); if (i >= 1) openSkillPanel('abilities'); };
    bar.appendChild(d);
  }
}
function renderSkillCd() { document.querySelectorAll('.cd').forEach(el => { const id = el.dataset.id; const def = SKILLDEFS[id]; const cd = skillCd(def, id); const rem = cd - (now() - (_cd[id] || -9999)); if (rem > 50) { el.style.display = 'flex'; const prog = clamp(1 - rem / cd, 0, 1) * 360; el.style.background = `conic-gradient(transparent ${prog}deg, rgba(0,0,0,.7) ${prog}deg)`; el.textContent = (rem / 1000).toFixed(1); } else el.style.display = 'none'; }); }
function showMsg(t) { const m = document.getElementById('msg'); m.textContent = t; m.style.opacity = 1; clearTimeout(m._t); m._t = setTimeout(() => m.style.opacity = 0, 1400); }
const floatLayer = document.createElement('div'); floatLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:4;overflow:hidden;'; document.body.appendChild(floatLayer);
/* Phase 1: pooled labels — was innerHTML='' + createElement per float/elite/remote every 33ms (full DOM
   teardown + element GC). Now a persistent pool of reused <div>s: overwrite text/cssText on existing nodes,
   hide the unused tail. Byte-identical DOM/CSS output (exact visual parity), no tree mutation, no per-tick garbage. */
const _floatPool = [];
function _floatEl(i) { let el = _floatPool[i]; if (!el) { el = document.createElement('div'); floatLayer.appendChild(el); _floatPool[i] = el; } return el; }
function renderFloats() {
  let n = 0;
  if (SAVE._data.settings.dmgnum) {
    for (const f of floats) {
      tmpV.set(f.x, f.y, f.z); tmpV.project(camera); if (tmpV.z > 1) continue; const sx = (tmpV.x * 0.5 + 0.5) * innerWidth, sy = (-tmpV.y * 0.5 + 0.5) * innerHeight;
      const age = 55 - f.life; const crit = (String(f.txt).charAt(0) === '✸'); const rise = age * 0.9; if (f.dx == null) f.dx = (Math.random() - 0.5) * 26; const pop = age < 6 ? 1 + (6 - age) * 0.10 : 1; const sc = (crit ? 1.5 : 1) * pop; const op = clamp(f.life / 22, 0, 1);
      const el = _floatEl(n++); el.className = 'float'; el.textContent = f.txt; el.style.cssText = `left:${sx}px;top:${sy}px;transform:translate(-50%,-50%) translate(${f.dx * age / 55}px,${-rise}px) scale(${sc.toFixed(2)});color:${f.col};font-size:${crit ? 22 : 15}px;opacity:${op};text-shadow:0 0 5px #000,0 1px 2px #000${crit ? ',0 0 12px ' + f.col : ''};`;
    }
  }
  for (const m of monsters) { if (!m.elite && !m.showName) continue; tmpV.set(m.x, m.r * 2.6 + 1.6, m.z); tmpV.project(camera); if (tmpV.z > 1) continue; const sx = (tmpV.x * 0.5 + 0.5) * innerWidth, sy = (-tmpV.y * 0.5 + 0.5) * innerHeight; const col = '#' + (m.nameCol != null ? m.nameCol : ELITE_MODS[m.elite[0]].col).toString(16).padStart(6, '0'); const lab = _floatEl(n++); lab.className = ''; lab.textContent = m.name; lab.style.cssText = `position:absolute;left:${sx}px;top:${sy}px;transform:translate(-50%,-50%);color:${col};font:bold 12px Georgia;text-shadow:0 0 4px #000,0 0 4px #000;white-space:nowrap;`; }
  if (typeof NET !== 'undefined' && NET.connected) { for (const [, r] of NET.remotes) { if (!r.mesh.visible) continue; tmpV.set(r.x, 5.4, r.z); tmpV.project(camera); if (tmpV.z > 1) continue; const sx = (tmpV.x * 0.5 + 0.5) * innerWidth, sy = (-tmpV.y * 0.5 + 0.5) * innerHeight; const lab = _floatEl(n++); lab.className = ''; lab.textContent = (r.name || 'Player') + ' · Lv' + (r.level || 1); lab.style.cssText = `position:absolute;left:${sx}px;top:${sy}px;transform:translate(-50%,-50%);color:#9fd8ff;font:bold 12px Georgia;text-shadow:0 0 4px #000,0 0 5px #000;white-space:nowrap;`; } }
  for (let i = n; i < _floatPool.length; i++) { if (_floatPool[i].style.display !== 'none') _floatPool[i].style.display = 'none'; }
}

/* ---------- panels (inventory/skills/vendor/stash) ---------- */
const invPanel = document.getElementById('invPanel'), statsPanel = document.getElementById('statsPanel'), skillPanel = document.getElementById('skillPanel'), vendorPanel = document.getElementById('vendorPanel'), stashPanel = document.getElementById('stashPanel'), smithPanel = document.getElementById('smithPanel'), enchantPanel = document.getElementById('enchantPanel'), gamblePanel = document.getElementById('gamblePanel'), jewelerPanel = document.getElementById('jewelerPanel'), alchemistPanel = document.getElementById('alchemistPanel'), tooltip = document.getElementById('tooltip');
function closeAll() { shopAnchor = null; invOpen = skillOpen = vendorOpen = stashOpen = smithOpen = enchantOpen = gambleOpen = jewelerOpen = alchemistOpen = false;[invPanel, statsPanel, skillPanel, vendorPanel, stashPanel, smithPanel, enchantPanel, gamblePanel, jewelerPanel, alchemistPanel].forEach(p => p.style.display = 'none'); tooltip.style.display = 'none'; }
/* Diablo-3 dual-pane: shops dock left and open the inventory on the right so gear + trading sit side by side.
   Only one shop is open at a time, so renderOpenShop() refreshes whichever it is — call it after any
   inventory mutation from the right pane to keep the shop's item indices fresh (see equipFromInv/unequip). */
function openShopWithInv() { invOpen = true; invPanel.style.display = 'block'; statsPanel.style.display = 'block'; setInvTab('items'); }
function renderOpenShop() { if (vendorOpen) renderVendor(); else if (smithOpen) renderSmith(); else if (enchantOpen) renderEnchanter(); else if (gambleOpen) renderGamble(); else if (jewelerOpen) renderJeweler(); else if (alchemistOpen) renderAlchemist(); }
function toggleInv() { const o = !invOpen; closeAll(); if (o) { invOpen = true; invPanel.style.display = 'block'; statsPanel.style.display = 'block'; setInvTab('items'); } }
let _skTab = 'abilities';
function setSkillTab(name) {
  _skTab = name;
  document.querySelectorAll('#skillTabs .tab').forEach(t => t.classList.toggle('on', t.dataset.sktab === name));
  document.querySelectorAll('#skillPanel .skPane').forEach(p => p.style.display = (p.dataset.skpane === name) ? 'block' : 'none');
  if (name === 'forest') renderSkillTree(); else renderAbilities();
}
function toggleSkill(tab) { const o = !skillOpen; closeAll(); if (o) { skillOpen = true; skillPanel.style.display = 'block'; setSkillTab(tab || _skTab); } }
function openSkillPanel(tab) { if (!skillOpen) toggleSkill(tab); else setSkillTab(tab); }
function openVendor(tier) { closeAll(); openShopWithInv(); vendorTier = tier || 1; vendorOpen = true; vendorPanel.style.display = 'block'; if (!vendorStock.length || vendorStockTier !== vendorTier) refreshVendor(vendorTier); setVendorTab('buy'); }
function openStash() { closeAll(); stashOpen = true; stashPanel.style.display = 'block'; renderStash(); }
function openSmith() { closeAll(); openShopWithInv(); smithOpen = true; smithPick = null; smithPanel.style.display = 'block'; setSmithTab('upgrade'); }
function openAlchemist() { closeAll(); openShopWithInv(); alchemistOpen = true; alchemistPanel.style.display = 'block'; renderAlchemist(); }
function renderAlchemist() {
  const body = document.getElementById('alchemistBody');
  let html = `<div style="color:#ffe27a;margin-bottom:10px">Your gold: ${player.gold}</div><div class="tier">Potions</div>`;
  const ptCost = 200 * Math.pow(2, character.potionTier || 0), ptMax = (character.potionTier || 0) >= POTION_TIER_MAX, ptPct = Math.round((POTION_PCT + (character.potionTier || 0) * POTION_TIER_PCT) * 100);
  html += `<div class="row"><div class="ric">⚗️</div><div class="rname">Potion Strength <span style="color:#8a7a5a;font-size:11px">(tier ${character.potionTier || 0} · restores ${ptPct}% of max)</span></div>${ptMax ? '<div class="rprice">MAX</div>' : `<div class="rprice">${ptCost} g</div><div class="rbtn${player.gold >= ptCost ? '' : ' dis'}" id="upPotTier">Upgrade</div>`}</div>`;
  const pcCost = 150 + ((character.potionCap || 10) - 10) * 40, pcMax = (character.potionCap || 10) >= POTION_CAP_MAX;
  html += `<div class="row"><div class="ric">🎒</div><div class="rname">Potion Capacity <span style="color:#8a7a5a;font-size:11px">(carry ${character.potionCap || 10} of each)</span></div>${pcMax ? '<div class="rprice">MAX</div>' : `<div class="rprice">${pcCost} g</div><div class="rbtn${player.gold >= pcCost ? '' : ' dis'}" id="upPotCap">+2</div>`}</div>`;
  body.innerHTML = html;
  const upt = document.getElementById('upPotTier'); if (upt) upt.onclick = () => { if (player.gold < ptCost || (character.potionTier || 0) >= POTION_TIER_MAX) return; player.gold -= ptCost; character.potionTier = (character.potionTier || 0) + 1; goldTxt.textContent = player.gold + ' g'; sfx('potion'); renderAlchemist(); updateGlobes(); saveProgress(false); };
  const upc = document.getElementById('upPotCap'); if (upc) upc.onclick = () => { if (player.gold < pcCost || (character.potionCap || 10) >= POTION_CAP_MAX) return; player.gold -= pcCost; character.potionCap = (character.potionCap || 10) + 2; goldTxt.textContent = player.gold + ' g'; renderAlchemist(); saveProgress(false); };
}
const ENCHANT_POOL = ['dmg', 'hp', 'mp', 'armor', 'str', 'dex', 'vit', 'eng', 'crit', 'ias', 'ms', 'allstats', 'allRes', 'critDmg', 'leech', 'manaLeech', 'skillranks', 'skilldmg', 'activeskill', 'fireDmg', 'coldDmg', 'lightDmg', 'poisonDmg', 'hpregen', 'mpregen', 'mf', 'gf', 'dodge', 'flatDR', 'cdr', 'lifeOnHit'];
/* Anvil pattern (same as the Smith): no gear list — click a piece in the inventory pane (renderInv routes
   clicks here while enchantOpen) and the Enchanter acts on that one selection. enchantPickWhere() doubles as a
   liveness check: if the picked item was dropped/equipped-away it returns null and we drop the selection. */
let enchantPick = null;
function openEnchanter() { closeAll(); openShopWithInv(); enchantOpen = true; enchantPanel.style.display = 'block'; enchantPick = null; renderEnchanter(); }
function enchantPickWhere() { if (!enchantPick) return null; for (const s of SLOTS) { if (character.equipment[s] === enchantPick) return 'eq'; } return character.inventory.indexOf(enchantPick) >= 0 ? 'inv' : null; }
function selectEnchantItem(it) { enchantPick = it; renderEnchanter(); }
function renderEnchanter() {
  if (invOpen) renderInv(); /* paired inventory pane: refresh contents + selection highlight */
  const body = document.getElementById('enchantBody'), where = enchantPickWhere(); if (!where) enchantPick = null; const it = enchantPick;
  let html = `<div style="color:#ffe27a;margin-bottom:8px">Your gold: ${player.gold}</div>`;
  if (!it) { html += `<div class="smithSlot empty">Click an item in your inventory →</div>`; }
  else {
    const ecost = enchantCost(it), cur = it.enchant && AFFIXES[it.enchant.key] ? `<div class="aff" style="color:#9f6aff">✦ +${it.enchant.val} ${AFFIXES[it.enchant.key].label} (current)</div>` : '';
    html += `<div class="smithSlot"><div class="ric" style="font-size:30px">${SLOT_ICON[it.slot]}</div><div style="flex:1"><div class="rname rc-${it.rarity}">${it.name}</div><div style="color:#8a7a5a;font-size:11px;text-transform:capitalize">${RARITY_NAME[it.rarity] || it.rarity} · ${it.slot}${where === 'eq' ? ' · equipped' : ''}</div>${cur}</div></div>`;
    html += `<div class="smithAct"><span>Imbue a stat${it.enchant ? ' (overwrites current)' : ''}</span><span class="rprice">${ecost} g</span></div>`;
    html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">`;
    ENCHANT_POOL.forEach(k => { if (!AFFIXES[k]) return; html += `<div class="rbtn${player.gold >= ecost ? '' : ' dis'}" data-aff="${k}" style="flex:0 0 auto;border-color:#6a4aa0">${AFFIXES[k].label}</div>`; });
    html += `</div>`;
  }
  body.innerHTML = html;
  if (it) { const rn = body.querySelector('.smithSlot .rname'); if (rn) bindTip(rn, it); }
  body.querySelectorAll('[data-aff]').forEach(b => b.onclick = () => { const tgt = enchantPick; if (!tgt) return; const k = b.dataset.aff, ecost = enchantCost(tgt); if (player.gold < ecost) return; player.gold -= ecost; tgt.enchant = { key: k, val: affixRoll(k, tgt.ilvl, tgt.rarity) }; goldTxt.textContent = player.gold + ' g'; if (enchantPickWhere() === 'eq') recompute(); sfx('potion'); showMsg(tgt.name + ' · enchanted: +' + tgt.enchant.val + ' ' + AFFIXES[k].label); renderEnchanter(); saveProgress(false); });
}
let jewelerStock = [], socketPick = null;
/* Jeweler socketing uses the same anvil liveness pattern as the Smith: socketWhere() returns where the picked
   item lives, or null if it was dropped/sold/equipped-away (then we drop the selection). */
function selectSocketItem(it) { socketPick = it; renderJeweler(); }
function socketWhere() { if (!socketPick) return null; for (const s of SLOTS) if (character.equipment[s] === socketPick) return 'eq'; return character.inventory.indexOf(socketPick) >= 0 ? 'inv' : null; }
function openGambler() { closeAll(); openShopWithInv(); gambleOpen = true; gamblePanel.style.display = 'block'; renderGamble(); }
function renderGamble() {
  if (invOpen) renderInv(); /* show the gambled item in the paired inventory pane */
  const body = document.getElementById('gambleBody'); const tier = (curTownArea && curTownArea.tier) || 0; const il = player.level + 1 + tier * 2, cost = 50 + player.level * 15 + tier * 150;
  body.innerHTML = `<div style="color:#ffe27a;margin-bottom:10px">Your gold: ${player.gold}</div>`;
  const row = document.createElement('div'); row.className = 'row'; row.innerHTML = `<div class="ric">🎲</div><div class="rname">Mystery Item <span style="color:#8a7a5a;font-size:11px">(ilvl ~${il}${tier ? ' · improved odds' : ''})</span></div><div class="rprice">${cost} g</div><div class="rbtn${player.gold >= cost && character.inventory.length < character.invMax ? '' : ' dis'}" id="gambleRoll">Roll</div>`; body.appendChild(row);
  const gb = document.getElementById('gambleRoll'); if (gb) gb.onclick = () => { if (player.gold < cost || character.inventory.length >= character.invMax) return; player.gold -= cost; const it = rollItem(il, null, 0.1 + tier * 0.12); character.inventory.push(it); goldTxt.textContent = player.gold + ' g'; sfx('potion'); showMsg('Gambled: ' + it.name); renderGamble(); updatePips(); saveProgress(false); };
}
function refreshJeweler(tier) { jewelerStock = []; const il = Math.max(1, player.level) + tier * 3; jewelerStock.push(rollItem(il, 'ring', 0.15 + tier * 0.1)); jewelerStock.push(rollItem(il, 'amulet', 0.15 + tier * 0.1)); jewelerStock.push(rollItem(il, 'ring', 0.05)); jewelerStock.push(rollItem(il, 'amulet', 0.05)); }
function openJeweler() { closeAll(); openShopWithInv(); jewelerOpen = true; socketPick = null; jewelerPanel.style.display = 'block'; refreshJeweler((curTownArea && curTownArea.tier) || 0); setJewelerTab('buy'); }
let jewelerTab = 'buy';
function setJewelerTab(t) { if (!['buy', 'reroll', 'socket', 'combine'].includes(t)) t = 'buy'; jewelerTab = t;['Buy', 'Reroll', 'Socket', 'Combine'].forEach(n => { const el = document.getElementById('jewelerTab' + n); if (el) el.classList.toggle('on', t === n.toLowerCase()); }); renderJeweler(); }
function renderJeweler() {
  if (invOpen) renderInv(); /* show jewelry changes in the paired inventory pane */
  const body = document.getElementById('jewelerBody');
  const DESC = { buy: 'Fresh rings &amp; amulets, restocked each visit — better towns stock better pieces.', reroll: 'Reroll every affix value on a ring or amulet you own, for gold.', socket: 'Click a socketed item in your inventory, then slot pouch gems into it or pop them back out. Add sockets at the Smith.', combine: 'Fuse 3 identical gems into 1 of the next quality, up to Perfect.' };
  body.innerHTML = `<div style="color:#ffe27a;margin-bottom:6px">Your gold: ${player.gold}</div><div style="color:#8a7a5a;font-size:12px;margin-bottom:12px">${DESC[jewelerTab]}</div>`;
  if (jewelerTab === 'buy') {
    jewelerStock.forEach((it, idx) => { const price = buyPrice(it); const row = document.createElement('div'); row.className = 'row'; row.innerHTML = `<div class="ric">${SLOT_ICON[it.slot]}</div><div class="rname rc-${it.rarity}">${it.name}</div><div class="rprice">${price} g</div><div class="rbtn${player.gold >= price && character.inventory.length < character.invMax ? '' : ' dis'}" data-jbuy="${idx}">Buy</div>`; bindTip(row.querySelector('.rname'), it); body.appendChild(row); });
    if (!jewelerStock.length) { const d = document.createElement('div'); d.style.color = '#6a5a44'; d.textContent = 'Sold out — come back next visit.'; body.appendChild(d); }
    body.querySelectorAll('[data-jbuy]').forEach(b => b.onclick = () => { const idx = +b.dataset.jbuy; const it = jewelerStock[idx]; if (!it) return; const price = buyPrice(it); if (player.gold < price || character.inventory.length >= character.invMax) return; player.gold -= price; character.inventory.push(it); jewelerStock.splice(idx, 1); goldTxt.textContent = player.gold + ' g'; sfx('potion'); showMsg('Bought: ' + it.name); renderJeweler(); updatePips(); saveProgress(false); });
  } else if (jewelerTab === 'reroll') {
    const accs = []; for (const s of ['ring', 'amulet']) { if (character.equipment[s]) accs.push({ it: character.equipment[s], where: 'eq' }); } character.inventory.forEach(it => { if (it.slot === 'ring' || it.slot === 'amulet') accs.push({ it, where: 'inv' }); });
    if (!accs.length) { const d = document.createElement('div'); d.style.color = '#6a5a44'; d.textContent = 'No rings or amulets to reroll.'; body.appendChild(d); }
    accs.forEach((e, i) => { const it = e.it, cost = enchantCost(it), hasAff = Object.keys(it.affixes || {}).length > 0; const row = document.createElement('div'); row.className = 'row'; row.innerHTML = `<div class="ric">${SLOT_ICON[it.slot]}</div><div class="rname rc-${it.rarity}">${it.name}<span style="color:#8a7a5a;font-size:11px"> ${e.where === 'eq' ? '· equipped' : ''}</span></div>${hasAff ? `<div class="rprice">${cost} g</div><div class="rbtn${player.gold >= cost ? '' : ' dis'}" data-jrr="${i}">Reroll</div>` : '<div class="rprice" style="color:#6a5a44">no affixes</div>'}`; bindTip(row.querySelector('.rname'), it); body.appendChild(row); });
    body.querySelectorAll('[data-jrr]').forEach(b => b.onclick = () => { const e = accs[+b.dataset.jrr], it = e.it; const keys = Object.keys(it.affixes || {}); const cost = enchantCost(it); if (!keys.length || player.gold < cost) return; player.gold -= cost; for (const k of keys) it.affixes[k] = affixRoll(k, it.ilvl, it.rarity); goldTxt.textContent = player.gold + ' g'; if (e.where === 'eq') recompute(); sfx('potion'); showMsg(it.name + ' · stats rerolled'); renderJeweler(); saveProgress(false); });
  } else if (jewelerTab === 'socket') {
    const gems = character.gems || {}; const pouchKeys = Object.keys(gems).filter(k => gems[k] > 0);
    const sw = socketWhere(); if (!sw) socketPick = null; const sit = socketPick;
    if (!sit) { const d = document.createElement('div'); d.style.color = '#6a5a44'; d.textContent = pouchKeys.length ? 'Click a socketed item in your inventory →' : 'Find gems from monsters, then click an item with sockets →'; body.appendChild(d); }
    else if (!(sit.sockets && sit.sockets.length)) { const d = document.createElement('div'); d.style.color = '#6a5a44'; d.innerHTML = `<span class="rname rc-${sit.rarity}">${sit.name}</span> has no sockets — add one at the Smith.`; body.appendChild(d); }
    else {
      const hdr = document.createElement('div'); hdr.className = 'row'; hdr.innerHTML = `<div class="ric">${SLOT_ICON[sit.slot]}</div><div class="rname rc-${sit.rarity}" style="flex:1">${sit.name}${sw === 'eq' ? ' <span style="color:#8a7a5a;font-size:11px">· equipped</span>' : ''}</div>`; bindTip(hdr.querySelector('.rname'), sit); body.appendChild(hdr);
      sit.sockets.forEach((g, i) => { const row = document.createElement('div'); row.className = 'row'; if (g) { const e = gemEff(sit.slot, g); row.innerHTML = `<div class="ric">${GEMS[g.t].ico}</div><div class="rname" style="flex:1">${gemName(g)} <span style="color:#8a7a5a;font-size:11px">+${e.vals[g.q]} ${AFFIXES[e.key].label}</span></div><div class="rbtn" data-unsock="${i}" style="border-color:#6a4aa0">Remove</div>`; } else { row.innerHTML = `<div class="ric">◯</div><div class="rname" style="flex:1;color:#8a7a5a">Empty socket</div>`; } body.appendChild(row); });
      if (sit.sockets.some(g => !g)) {
        if (pouchKeys.length) { const pk = document.createElement('div'); pk.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:6px'; pouchKeys.forEach(k => { const t = k.split(':')[0], q = +k.split(':')[1]; if (!GEMS[t]) return; const e = gemEff(sit.slot, { t, q }); pk.innerHTML += `<div class="rbtn" data-gem="${k}" style="flex:0 0 auto;border-color:#3a6a8a">${GEMS[t].ico} ${gemName({ t, q })} ×${gems[k]} <span style="color:#8a7a5a">+${e.vals[q]} ${AFFIXES[e.key].label}</span></div>`; }); body.appendChild(pk); }
        else { const d = document.createElement('div'); d.style.color = '#6a5a44'; d.textContent = 'No gems in your pouch.'; body.appendChild(d); }
      }
    }
    body.querySelectorAll('[data-gem]').forEach(b => b.onclick = () => { const tgt = socketPick; if (!tgt || !tgt.sockets) return; const k = b.dataset.gem, t = k.split(':')[0], q = +k.split(':')[1], g = character.gems || {}; if (!g[k]) return; const idx = tgt.sockets.findIndex(x => !x); if (idx < 0) return; tgt.sockets[idx] = { t, q }; g[k]--; if (g[k] <= 0) delete g[k]; if (socketWhere() === 'eq') recompute(); sfx('potion'); showMsg(tgt.name + ' · socketed ' + gemName({ t, q })); renderJeweler(); updatePips(); saveProgress(false); });
    body.querySelectorAll('[data-unsock]').forEach(b => b.onclick = () => { const tgt = socketPick; if (!tgt || !tgt.sockets) return; const i = +b.dataset.unsock, g = tgt.sockets[i]; if (!g) return; const k = g.t + ':' + g.q; character.gems = character.gems || {}; character.gems[k] = (character.gems[k] || 0) + 1; tgt.sockets[i] = null; if (socketWhere() === 'eq') recompute(); sfx('potion'); showMsg('Removed ' + gemName(g)); renderJeweler(); saveProgress(false); });
  } else {
    const gems = character.gems || {}; const combineable = Object.keys(gems).filter(k => gems[k] >= 3 && +k.split(':')[1] < 4);
    if (!combineable.length) { const d = document.createElement('div'); d.style.color = '#6a5a44'; d.textContent = 'Nothing to combine — you need 3 of the same gem at the same quality.'; body.appendChild(d); }
    combineable.forEach(k => { const t = k.split(':')[0], q = +k.split(':')[1]; if (!GEMS[t]) return; const row = document.createElement('div'); row.className = 'row'; row.innerHTML = `<div class="ric">${GEMS[t].ico}</div><div class="rname" style="flex:1">${gemName({ t, q })} ×${gems[k]} → ${gemName({ t, q: q + 1 })}</div><div class="rbtn" data-comb="${k}" style="border-color:#6a4aa0">Combine 3→1</div>`; body.appendChild(row); });
    body.querySelectorAll('[data-comb]').forEach(b => b.onclick = () => { const k = b.dataset.comb, t = k.split(':')[0], q = +k.split(':')[1], g = character.gems; if (!g || g[k] < 3 || q >= 4) return; g[k] -= 3; if (g[k] <= 0) delete g[k]; const nk = t + ':' + (q + 1); g[nk] = (g[nk] || 0) + 1; sfx('level'); showMsg('Combined → ' + gemName({ t, q: q + 1 })); renderJeweler(); saveProgress(false); });
  }
}
const POTION_TIER_MAX = 8, POTION_CAP_MAX = 30;
let smithTab = 'upgrade', smithPick = null;
function setSmithTab(t) { if (t !== 'reforge' && t !== 'salvage' && t !== 'socket') t = 'upgrade';smithTab = t;['Upgrade', 'Reforge', 'Salvage', 'Socket'].forEach(n => { const el = document.getElementById('smithTab' + n); if (el) el.classList.toggle('on', t === n.toLowerCase()); }); renderSmith(); }
/* Diablo-3/4 anvil: the Smith no longer lists gear — you click a piece in the inventory pane (renderInv
   routes clicks here while smithOpen) and the Smith acts on that one selection. smithPickWhere() doubles as a
   liveness check: if the picked item was salvaged/dropped it returns null and we drop the selection. */
function smithPickWhere() { if (!smithPick) return null; for (const s of SLOTS) { if (character.equipment[s] === smithPick) return 'eq'; } return character.inventory.indexOf(smithPick) >= 0 ? 'inv' : null; }
function selectSmithItem(it) { smithPick = it; renderSmith(); }
function smithAction() {
  const it = smithPick, where = smithPickWhere(); if (!it || !where) { smithPick = null; renderSmith(); return; }
  if (smithTab === 'upgrade') { if ((it.upgrade || 0) >= upgradeMax(it)) return; const cost = upgradeCost(it); if (player.gold < cost) return; player.gold -= cost; it.upgrade = (it.upgrade || 0) + 1; if (where === 'eq') recompute(); sfx('level'); showMsg(it.name + ' → +' + it.upgrade); }
  else if (smithTab === 'reforge') { if (!reforgeable(it)) return; const rc = reforgeCost(it); if (player.gold < rc.gold || (character.materials || 0) < rc.dust) return; player.gold -= rc.gold; character.materials = (character.materials || 0) - rc.dust; const before = it.rarity; reforgeItem(it); if (where === 'eq') { recompute(); attachHeroWeapon(); } sfx('level'); showMsg(it.rarity !== before ? (it.name + ' → ' + (RARITY_NAME[it.rarity] || it.rarity) + '!') : ('Reforged: ' + it.name)); }
  else if (smithTab === 'socket') { const max = SOCKET_MAX[it.slot] || 0, cur = (it.sockets || []).length; if (cur >= max) return; const cost = { dust: 6 + (RTIER[it.rarity] || 1) * 4, gold: Math.round(itemScore(it) * 0.2) + 20 }; if (player.gold < cost.gold || (character.materials || 0) < cost.dust) return; player.gold -= cost.gold; character.materials = (character.materials || 0) - cost.dust; (it.sockets = it.sockets || []).push(null); if (where === 'eq') recompute(); sfx('level'); showMsg(it.name + ' → socket added'); }
  else { if (where !== 'inv') return; const du = dustValue(it); if ((RTIER[it.rarity] || 1) >= 3 && !confirm('Salvage ' + it.name + ' (' + (RARITY_NAME[it.rarity] || it.rarity) + ') into ' + du + ' Dust? This destroys the item.')) return; const idx = character.inventory.indexOf(it); if (idx < 0) return; character.materials = (character.materials || 0) + du; character.inventory.splice(idx, 1); smithPick = null; sfx('potion'); showMsg('Salvaged: +' + du + '✦'); }
  goldTxt.textContent = player.gold + ' g'; renderSmith(); updatePips(); saveProgress(false);
}
function renderSmith() {
  if (invOpen) renderInv(); /* paired inventory pane: refresh contents + selection highlight */
  const body = document.getElementById('smithBody'), where = smithPickWhere(); if (!where) smithPick = null; const it = smithPick;
  const DESC = { upgrade: 'Select a piece from your inventory, then forge it stronger — each upgrade adds raw power. Higher rarity upgrades further.', reforge: `Select a piece, then reroll its affixes for gold + ✦ Dust — ${Math.round(REFORGE_RARITY_UP * 100)}% chance to raise its rarity. Set &amp; unique gear can't be reforged.`, salvage: 'Select a backpack piece, then break it down into ✦ Dust — no gold. Equipped gear can\'t be salvaged.', socket: 'Select a piece, then add an empty socket for gold + ✦ Dust. Caps per slot (weapon/armor 3, helm/gloves/boots 2, jewelry 1). Fill sockets with gems at the Jeweler.' };
  let html = `<div style="color:#ffe27a;margin-bottom:8px">Your gold: ${player.gold} <span style="color:#b9a6ff">· ✦ ${character.materials || 0} Dust</span></div>`;
  html += `<div style="color:#8a7a5a;font-size:12px;margin-bottom:12px">${DESC[smithTab]}</div>`;
  if (!it) { html += `<div class="smithSlot empty">Click an item in your inventory →</div>`; }
  else {
    html += `<div class="smithSlot"><div class="ric" style="font-size:30px">${SLOT_ICON[it.slot]}</div><div style="flex:1"><div class="rname rc-${it.rarity}">${it.name}${it.upgrade ? ' <span style="color:#ffcf6a">+' + it.upgrade + '</span>' : ''}</div><div style="color:#8a7a5a;font-size:11px;text-transform:capitalize">${RARITY_NAME[it.rarity] || it.rarity} · ${it.slot}${where === 'eq' ? ' · equipped' : ''}</div>${affixLines(it)}</div></div>`;
    if (smithTab === 'upgrade') {
      const lvl = it.upgrade || 0, max = upgradeMax(it), atMax = lvl >= max, cost = upgradeCost(it), cur = Math.round((upFactor(it) - 1) * 100), nxt = Math.round((upFactor({ upgrade: lvl + 1 }) - 1) * 100);
      html += atMax ? `<div class="smithAct">Fully upgraded — <b>+${cur}%</b> (MAX ${max})</div>` : `<div class="smithAct"><span>+${cur}% → <b>+${nxt}%</b></span><span class="rprice">${cost} g</span><div class="rbtn${player.gold >= cost ? '' : ' dis'}" id="smithDo">Upgrade</div></div>`;
    } else if (smithTab === 'reforge') {
      if (!reforgeable(it)) html += `<div class="smithAct" style="color:#6a5a44">${RARITY_NAME[it.rarity] || it.rarity} gear can't be reforged — only common, magic &amp; rare.</div>`;
      else { const rc = reforgeCost(it), can = player.gold >= rc.gold && (character.materials || 0) >= rc.dust; html += `<div class="smithAct"><span>Reroll all affixes</span><span class="rprice">${rc.gold}g · ${rc.dust}✦</span><div class="rbtn${can ? '' : ' dis'}" id="smithDo" style="border-color:#6a4aa0">Reforge</div></div>`; }
    } else if (smithTab === 'socket') {
      const max = SOCKET_MAX[it.slot] || 0, cur = (it.sockets || []).length;
      if (!max) html += `<div class="smithAct" style="color:#6a5a44">This slot can't hold sockets.</div>`;
      else if (cur >= max) html += `<div class="smithAct" style="color:#6a5a44">Sockets full — ${cur}/${max}.</div>`;
      else { const cost = { dust: 6 + (RTIER[it.rarity] || 1) * 4, gold: Math.round(itemScore(it) * 0.2) + 20 }, can = player.gold >= cost.gold && (character.materials || 0) >= cost.dust; html += `<div class="smithAct"><span>Add socket (${cur}/${max})</span><span class="rprice">${cost.gold}g · ${cost.dust}✦</span><div class="rbtn${can ? '' : ' dis'}" id="smithDo" style="border-color:#3a6a8a">Add Socket</div></div>`; }
    } else {
      if (where === 'eq') html += `<div class="smithAct" style="color:#6a5a44">Equipped — unequip it first to salvage.</div>`;
      else html += `<div class="smithAct"><span>Break down into Dust</span><span class="rprice">+${dustValue(it)}✦</span><div class="rbtn" id="smithDo" style="border-color:#7a3a28">Salvage</div></div>`;
    }
  }
  body.innerHTML = html;
  if (it) { const rn = body.querySelector('.smithSlot .rname'); if (rn) bindTip(rn, it); const db = document.getElementById('smithDo'); if (db) db.onclick = smithAction; }
  if (smithTab === 'salvage') {
    const junk = character.inventory.filter(j => j.rarity === 'common' || j.rarity === 'magic');
    if (junk.length) {
      const jd = junk.reduce((s, j) => s + dustValue(j), 0); const bar = document.createElement('div'); bar.className = 'row'; bar.style.marginTop = '14px'; bar.style.background = 'rgba(40,30,16,.55)';
      bar.innerHTML = `<div class="rname" style="flex:1">Backpack junk <span style="color:#8a7a5a;font-size:11px">(${junk.length} common/magic)</span></div><div class="rbtn" id="smithSalvageJunk" style="border-color:#6a4aa0">Salvage Junk +${jd}✦</div>`; body.appendChild(bar);
      document.getElementById('smithSalvageJunk').onclick = () => { const jk = character.inventory.filter(j => j.rarity === 'common' || j.rarity === 'magic'); if (!jk.length) return; const d = jk.reduce((s, j) => s + dustValue(j), 0); if (jk.includes(smithPick)) smithPick = null; character.materials = (character.materials || 0) + d; character.inventory = character.inventory.filter(j => !(j.rarity === 'common' || j.rarity === 'magic')); sfx('potion'); showMsg('Salvaged junk: +' + d + '✦'); renderSmith(); updatePips(); saveProgress(false); };
    }
  }
}
function affixLines(it) { let s = ''; if (it.slot === 'weapon' && it.baseStat) s += `<div class="base">${it.baseStat} Damage</div>`; else if (it.baseStat) s += `<div class="base">${it.baseStat} Armor</div>`; const keys = Object.keys(it.affixes).sort((a, b) => (AFFIX_CAT_ORD[AFFIX_CAT[a]] || 5) - (AFFIX_CAT_ORD[AFFIX_CAT[b]] || 5)); for (const k of keys) s += `<div class="aff aff-${AFFIX_CAT[k] || 'util'}">+${it.affixes[k]} ${AFFIXES[k].label}</div>`; if (it.enchant && it.enchant.key && AFFIXES[it.enchant.key]) s += `<div class="aff" style="color:#9f6aff">✦ +${it.enchant.val} ${AFFIXES[it.enchant.key].label} (enchant)</div>`; if (it.sockets && it.sockets.length) s += `<div class="aff aff-util">` + it.sockets.map(g => { if (!g) return '◯ (empty)'; const e = gemEff(it.slot, g); return `${GEMS[g.t].ico} +${e.vals[g.q]} ${AFFIXES[e.key].label}`; }).join(' · ') + `</div>`; return s; }
function statBundle(it) { const b = {}; if (it.baseStat) b[it.slot === 'weapon' ? 'Damage' : 'Armor'] = (b[it.slot === 'weapon' ? 'Damage' : 'Armor'] || 0) + it.baseStat; for (const k in it.affixes) { const l = AFFIXES[k] ? AFFIXES[k].label : k; b[l] = (b[l] || 0) + it.affixes[k]; } if (it.enchant && it.enchant.key && AFFIXES[it.enchant.key]) { const l = AFFIXES[it.enchant.key].label; b[l] = (b[l] || 0) + (it.enchant.val || 0); } if (it.sockets) for (const g of it.sockets) { if (g) { const e = gemEff(it.slot, g); if (e) { const l = AFFIXES[e.key].label; b[l] = (b[l] || 0) + e.vals[g.q]; } } } return b; }
function tooltipHTML(it) {
  const eq = character.equipment[it.slot]; let html = `<div class="tname rc-${it.rarity}">${it.name}${it.upgrade ? ' <span style="color:#ffcf6a">+' + it.upgrade + '</span>' : ''}</div><div class="tslot rc-${it.rarity}">${RARITY_NAME[it.rarity] || it.rarity} · ${it.slot} · ilvl ${it.ilvl}${it.upgrade ? ' · +' + Math.round((upFactor(it) - 1) * 100) + '% upgraded' : ''}</div>${affixLines(it)}`;
  if (it.effect) html += `<div style="color:#ffcf6a;margin-top:4px">★ ${it.effectDesc}</div>`;
  if (it.set) {
    const sd = SET_DEFS[it.set]; if (sd) {
      const owned = SLOTS.reduce((n, s) => n + (character.equipment[s] && character.equipment[s].set === it.set ? 1 : 0), 0); html += `<div style="color:#5ad65a;margin-top:6px">${sd.name} (${owned}/${sd.pieces.length})</div>`;
      for (const thr in sd.bonuses) { const bb = sd.bonuses[thr]; const parts = []; for (const k in bb) { if (k === 'effect') parts.push(bb.effect + (bb.effVal ? ' ' + bb.effVal : '')); else if (k !== 'effVal') parts.push('+' + bb[k] + ' ' + k); } html += `<div style="font-size:11px;color:${owned >= +thr ? '#5ad65a' : '#5a6a5a'}">${thr}pc: ${parts.join(', ')}</div>`; }
    }
  }
  if (eq && eq !== it) {
    const a = statBundle(it), b = statBundle(eq); const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])]; let rows = '';
    for (const k of keys) { const d = (a[k] || 0) - (b[k] || 0); if (d === 0) continue; const c = d > 0 ? '#7fd07f' : '#d07f7f'; rows += `<div style="color:${c};font-size:11px">${d > 0 ? '▲ +' : '▼ '}${d} ${k}</div>`; }
    const ds = itemScore(it) - itemScore(eq); const v = ds > 0 ? `<span style="color:#7fd07f">▲ Upgrade (+${ds})</span>` : ds < 0 ? `<span style="color:#d07f7f">▼ Downgrade (${ds})</span>` : `<span style="color:#c8b89a">≈ Sidegrade</span>`;
    html += `<div class="cmp"><div style="margin-bottom:3px">vs equipped <span class="rc-${eq.rarity}">${eq.name}</span></div>${rows}<div style="margin-top:4px">${v}</div></div>`;
  }
  return html;
}
function bindTip(el, it) { el.onmouseenter = e => { tooltip.innerHTML = tooltipHTML(it); tooltip.style.display = 'block'; moveTip(e); }; el.onmousemove = moveTip; el.onmouseleave = () => tooltip.style.display = 'none'; }
function moveTip(e) { const pad = 14; let x = e.clientX - tooltip.offsetWidth - pad; if (x < 8) x = e.clientX + pad; x = clamp(x, 8, Math.max(8, innerWidth - tooltip.offsetWidth - 8)); tooltip.style.left = x + 'px'; tooltip.style.top = clamp(e.clientY - 20, 8, Math.max(8, innerHeight - tooltip.offsetHeight - 8)) + 'px'; }
function charSheetHTML() {
  /** @type {Effects} */ const e = player.effects || {};
  const em = player.elemMult || {};
  const pct = v => Math.round(v) + '%';
  const row = (lbl, val, cls) => `<div class="statrow${cls ? ' ' + cls : ''}"><span>${lbl}</span><b>${val}</b></div>`;
  const sec = (title, rows) => rows ? `<div class="statsec"><div class="statsec-h">${title}</div><div class="statgrid">${rows}</div></div>` : '';
  // Offense — every item-grantable stat always shown, 0/baseline when nothing grants it
  let off = row('Damage', player.dmg) + row('Crit Chance', pct(player.crit * 100)) + row('Crit Damage', '×' + ((e.critdmg ? 3 : 2) + (e.critDmgPct || 0) / 100).toFixed(2)) + row('Attack Speed', (1000 / player.attackRate).toFixed(2) + '/s');
  off += row('Life Leech', pct((e.lifesteal || 0) * 100));
  off += row('Skill Damage', '+' + pct(((player.skillMult || 1) - 1) * 100));
  off += row('Active Skill', '+' + pct(((player.activeSkillDmg || 1) - 1) * 100));
  off += row('+ All Skills', e.allskills || 0);
  off += row('Cooldown Reduction', '+' + pct((player.cdr || 0) * 100));
  off += row('Life on Hit', Math.round(e.lifeOnHit || 0));
  for (const [k, lbl] of [['fire', 'Fire Damage'], ['frost', 'Cold Damage'], ['lightning', 'Lightning Damage'], ['poison', 'Poison Damage']]) off += row(lbl, '+' + pct(((em[k] || 1) - 1) * 100));
  // Defense
  const redux = Math.min(75, Math.round(player.armor / (player.armor + 40) * 100));
  let def = row('Life', player.hpMax) + row('Armor', player.armor + ' (' + redux + '% red.)');
  def += row('Thorns', Math.round(e.thorns || 0));
  def += row('Mana Shield', pct((e.manaShield || 0) * 100));
  def += row('Life Regen', ((player.hpRegen || 0) * 1000).toFixed(1) + '/s');
  def += row('Dodge', pct((e.dodge || 0) * 100));
  def += row('Damage Reduction', pct((e.flatDR || 0) * 100));
  // Resistances — effective = element + all, capped at 75%
  const ar = e.allRes || 0, rres = k => Math.min(75, Math.round((e[k] || 0) + ar));
  const res = row('Fire', rres('fireRes') + '%', 'res-fire') + row('Cold', rres('frostRes') + '%', 'res-cold') + row('Lightning', rres('lightningRes') + '%', 'res-light') + row('Poison', rres('poisonRes') + '%', 'res-poison');
  // Utility
  let util = row('Mana', player.mpMax);
  util += row('Move Speed', '+' + pct((e.movespeed || 0) * 100));
  util += row('Mana Leech', pct((e.manaleech || 0) * 100));
  util += row('Mana Regen', ((player.mpRegen || 0) * 1000).toFixed(1) + '/s');
  util += row('Magic Find', '+' + pct((lootLuck || 0) * 100));
  util += row('Gold Find', '+' + pct((player.goldFind || 0) * 100));
  util += row('STR', player.str) + row('DEX', player.dex) + row('VIT', player.vit) + row('ENG', player.eng);
  return `<div class="statname"><b>${escapeHtml(character.name)}</b> · Level ${player.level}</div>` + sec('Offense', off) + sec('Defense', def) + sec('Resistances', res) + sec('Utility', util);
}
let invTab = 'items';
function setInvTab(t) {
  invTab = t === 'gems' ? 'gems' : 'items';
  document.querySelectorAll('#invTabs .tab').forEach(el => el.classList.toggle('on', el.dataset.invtab === invTab));
  const ig = document.getElementById('invGrid'), gg = document.getElementById('gemGrid'), hint = document.getElementById('invHint');
  if (ig) ig.style.display = invTab === 'items' ? 'grid' : 'none';
  if (gg) gg.style.display = invTab === 'gems' ? 'grid' : 'none';
  if (hint) hint.textContent = invTab === 'gems' ? 'Gems stack with no limit — hover to see their stats. Socket them into gear at the Jeweler.' : 'Click a backpack item to equip • Click equipped item to remove • Hover to compare';
  renderInv();
}
/* Gems aren't equippable — they show their effect for each socket category (a gem grants a different stat in a
   weapon vs armor vs jewelry), so the tooltip lists all three at the gem's quality. */
function gemTipHTML(t, q, n) {
  const G = GEMS[t]; if (!G) return '';
  const qn = ['Chipped', 'Flawed', 'Normal', 'Flawless', 'Perfect'][q] || 'Normal';
  let rows = '';
  for (const [c, lbl] of [['weapon', 'In a Weapon'], ['gear', 'In Armor / Gear'], ['jewelry', 'In a Ring / Amulet']]) { const e = G[c]; if (!e) continue; const a = AFFIXES[e.key]; rows += `<div class="aff aff-util">${lbl}: <b>+${e.vals[q]}</b> ${a ? a.label : e.key}</div>`; }
  return `<div class="tname" style="color:#9fe8ff">${G.ico} ${gemName({ t, q })}</div><div class="tslot">Gem · ${qn} quality · ×${n} held</div>${rows}`;
}
function renderInv() {
  const eg = document.getElementById('equipGrid'); eg.innerHTML = '';
  for (const s of SLOTS) { const it = character.equipment[s]; const c = document.createElement('div'); c.className = 'cell' + (it ? ' r-' + it.rarity : ''); c.style.gridArea = s; c.innerHTML = `<span class="lbl">${s}</span>${it ? SLOT_ICON[s] : '<span style="opacity:.25">' + SLOT_ICON[s] + '</span>'}`; if (it) { bindTip(c, it); c.onclick = () => smithOpen ? selectSmithItem(it) : enchantOpen ? selectEnchantItem(it) : jewelerOpen && jewelerTab === 'socket' ? selectSocketItem(it) : unequip(s); if ((smithOpen && smithPick === it) || (enchantOpen && enchantPick === it) || (jewelerOpen && jewelerTab === 'socket' && socketPick === it)) c.classList.add('smithSel'); } eg.appendChild(c); }
  document.getElementById('charStats').innerHTML = charSheetHTML();
  const ig = document.getElementById('invGrid'); ig.innerHTML = ''; for (let i = 0; i < character.invMax; i++) { const it = character.inventory[i]; const c = document.createElement('div'); c.className = 'cell' + (it ? ' r-' + it.rarity : ''); if (it) { const up = itemScore(it) > itemScore(character.equipment[it.slot]); c.innerHTML = (up ? '<span class="upg">▲</span>' : '') + SLOT_ICON[it.slot]; if (up) c.classList.add('isupg'); bindTip(c, it); c.onclick = () => smithOpen ? selectSmithItem(it) : enchantOpen ? selectEnchantItem(it) : jewelerOpen && jewelerTab === 'socket' ? selectSocketItem(it) : equipFromInv(i); if ((smithOpen && smithPick === it) || (enchantOpen && enchantPick === it) || (jewelerOpen && jewelerTab === 'socket' && socketPick === it)) c.classList.add('smithSel'); } ig.appendChild(c); }
  const gg = document.getElementById('gemGrid');
  if (gg) {
    gg.innerHTML = ''; const gems = character.gems || {}; const keys = Object.keys(gems).filter(k => gems[k] > 0).sort();
    if (!keys.length) gg.innerHTML = '<div class="invHint" style="grid-column:1/-1;text-align:center;padding:10px 0">No gems yet — slain foes drop them.</div>';
    else for (const k of keys) { const t = k.split(':')[0], q = +k.split(':')[1], n = gems[k]; if (!GEMS[t]) continue; const c = document.createElement('div'); c.className = 'cell'; c.style.cursor = 'default'; c.innerHTML = `${GEMS[t].ico}<span class="gcount">${n}</span>`; const html = gemTipHTML(t, q, n); c.onmouseenter = e => { tooltip.innerHTML = html; tooltip.style.display = 'block'; moveTip(e); }; c.onmousemove = moveTip; c.onmouseleave = () => tooltip.style.display = 'none'; gg.appendChild(c); }
  }
  goldTxt.textContent = player.gold + ' g'; const _dt = document.getElementById('dustTxt'); if (_dt) _dt.textContent = (character.materials || 0) + ' Dust'; /* currency bar lives at the bottom of the inventory now */
}
function equipFromInv(i) { const it = character.inventory[i]; if (!it) return; const prev = character.equipment[it.slot]; character.equipment[it.slot] = it; character.inventory.splice(i, 1); if (prev) character.inventory.push(prev); recompute(); attachHeroWeapon(); renderInv(); renderOpenShop(); tooltip.style.display = 'none'; saveProgress(false); }
function unequip(s) { const it = character.equipment[s]; if (!it) return; if (character.inventory.length >= character.invMax) { showMsg('Bag full'); return; } character.inventory.push(it); character.equipment[s] = null; recompute(); attachHeroWeapon(); renderInv(); renderOpenShop(); tooltip.style.display = 'none'; saveProgress(false); }
let ptT = { x: 0, y: 0, s: 1 };
const PT_NAMES = { str: 'Strength', dex: 'Dexterity', vit: 'Vitality', eng: 'Energy', hp: 'Life', mp: 'Mana', dmg: 'Damage', armor: 'Armor', crit: 'Crit Chance', meleePct: '% Melee Damage', spellPct: '% Spell Damage', armorPct: '% Armor', hpPct: '% Life', allskills: 'to All Skills', pierce: 'Pierce', lifesteal: 'Life Leech', movespeed: '% Move Speed', thorns: 'Thorns' };
function ptNote() { document.getElementById('skillPtsNote').textContent = character.skillPoints + ' point' + (character.skillPoints === 1 ? '' : 's') + ' to spend · drag to pan · scroll to zoom'; }
function renderSkillTree() {
  ptNote(); const start = PTREE.nodes[PTREE.starts[character.class]]; ptT = { x: -start.x, y: -start.y, s: 1.1 };
  const c = document.getElementById('skillTree');
  c.innerHTML = `<div id="ptVp" style="position:relative;width:100%;height:calc(100vh - 250px);min-height:340px;overflow:hidden;border:1px solid #2a2218;border-radius:8px;background:radial-gradient(circle at 50% 45%,#161109,#080604);cursor:grab"><svg id="ptSvg" width="100%" height="100%" viewBox="-260 -260 520 520"><defs><filter id="pg" x="-90%" y="-90%" width="280%" height="280%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g id="ptG"></g></svg></div>`;
  buildPTreeSvg(); attachPTreeEvents();
}
function applyPT() { const g = document.getElementById('ptG'); if (g) g.setAttribute('transform', `scale(${ptT.s}) translate(${ptT.x} ${ptT.y})`); }
function buildPTreeSvg() {
  const g = document.getElementById('ptG'); if (!g) return; const alloc = new Set(character.passives || []); let edges = '', circles = '', drawn = new Set();
  for (const id in PTREE.adj) { for (const nb of PTREE.adj[id]) { const key = id < nb ? id + '|' + nb : nb + '|' + id; if (drawn.has(key)) continue; drawn.add(key); const a = PTREE.nodes[id], b = PTREE.nodes[nb]; if (!a || !b) continue; const on = alloc.has(id) && alloc.has(nb); edges += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${on ? '#c4a060' : '#2a241c'}" stroke-width="${on ? 3 : 2}"/>`; } }
  for (const id in PTREE.nodes) {
    const n = PTREE.nodes[id]; const allocated = alloc.has(id); const adjA = PTREE.adj[id].some(x => alloc.has(x)); const can = !allocated && character.skillPoints > 0 && adjA;
    const r = n.type === 'keystone' ? 15 : n.type === 'notable' ? 11 : n.type === 'start' ? 12 : 6.5;
    const fill = allocated ? (n.type === 'keystone' ? '#ffcf3a' : n.type === 'notable' ? '#e6b84d' : '#c8ad7a') : '#16110a';
    const stroke = n.type === 'start' ? '#ffe27a' : allocated ? '#ffe9a8' : can ? '#e6b84d' : adjA ? '#7a663f' : '#352c20';
    circles += `<circle data-pt="${id}" cx="${n.x}" cy="${n.y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${can ? 3 : 2}" ${can ? 'filter="url(#pg)"' : ''} style="cursor:pointer"/>`;
    if (n.type === 'notable' || n.type === 'keystone') circles += `<text x="${n.x}" y="${n.y - r - 3}" text-anchor="middle" fill="#cdb084" font-size="9" font-family="Georgia" style="pointer-events:none">${n.label}</text>`;
  }
  g.innerHTML = edges + circles; applyPT();
  g.querySelectorAll('[data-pt]').forEach(el => {
    const id = el.getAttribute('data-pt'); const n = PTREE.nodes[id];
    el.onmouseenter = e => { tooltip.innerHTML = ptTip(n); tooltip.style.display = 'block'; moveTip(e); }; el.onmousemove = moveTip; el.onmouseleave = () => tooltip.style.display = 'none';
    el.onclick = ev => { ev.stopPropagation(); ptClick(id); };
  });
}
function ptTip(n) {
  let lines = ''; for (const k in n.mods) { if (k === 'critdmg') { lines += '<div style="color:#b8a888">Critical hits deal 3x damage</div>'; continue; } let v = n.mods[k]; if (k === 'movespeed' || k === 'lifesteal') v = Math.round(v * 100) + '%'; lines += `<div style="color:#b8a888">+${v} ${PT_NAMES[k] || k}</div>`; }
  const t = n.type === 'keystone' ? 'Keystone' : n.type === 'notable' ? 'Notable' : n.type === 'start' ? 'Class Start' : 'Passive';
  return `<div class="tname" style="color:${n.type === 'keystone' ? '#ffcf3a' : '#e6b84d'}">${n.label || t}</div><div class="tslot">${t}</div>${lines || '<div style="color:#8a7a5a">Pathway node</div>'}`;
}
function ptClick(id) {
  const start = PTREE.starts[character.class]; const alloc = character.passives || (character.passives = []); const has = alloc.includes(id);
  if (!has) { if (character.skillPoints <= 0) return; if (!PTREE.adj[id].some(x => alloc.includes(x))) return; alloc.push(id); character.skillPoints--; }
  else { if (id === start) return; const rest = new Set(alloc.filter(x => x !== id)); const seen = new Set([start]), q = [start]; while (q.length) { const cur = q.shift(); for (const nb of PTREE.adj[cur]) if (rest.has(nb) && !seen.has(nb)) { seen.add(nb); q.push(nb); } } if (seen.size !== rest.size) return; character.passives = alloc.filter(x => x !== id); character.skillPoints++; }
  recompute(); buildPTreeSvg(); renderSkillbar(); updatePips(); ptNote(); saveProgress(false);
}
function attachPTreeEvents() {
  // Use element-level on* handlers (like attachRuneEvents) — every panel render used to add fresh anonymous
  // window mousemove/mouseup listeners that were never removed, leaking listeners and pinning each detached tree.
  const vp = document.getElementById('ptVp'); if (!vp) return; let drag = false, lx = 0, ly = 0;
  vp.onmousedown = e => { drag = true; lx = e.clientX; ly = e.clientY; vp.style.cursor = 'grabbing'; };
  vp.onmousemove = e => { if (!drag) return; const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; const rect = vp.getBoundingClientRect(); ptT.x += dx / rect.width * 520 / ptT.s; ptT.y += dy / rect.height * 520 / ptT.s; applyPT(); };
  vp.onmouseup = () => { drag = false; vp.style.cursor = 'grab'; }; vp.onmouseleave = () => { drag = false; vp.style.cursor = 'grab'; };
  vp.onwheel = e => { e.preventDefault(); ptT.s = clamp(ptT.s * (e.deltaY < 0 ? 1.12 : 0.89), 0.55, 2.4); applyPT(); };
}
document.getElementById('resetSkills').onclick = () => { const start = PTREE.starts[character.class]; const refund = (character.passives || []).filter(x => x !== start).length; character.passives = [start]; character.skillPoints += refund; recompute(); buildPTreeSvg(); renderSkillbar(); updatePips(); ptNote(); saveProgress(false); };
/* ---------- Abilities tab: loadout assignment + per-skill rune trees ---------- */
let _abilSlotSel = 1, _runeViewId = null, rT = { x: 0, y: 0, s: 1 };
function renderAbilities() {
  const host = document.getElementById('abilTree'); if (!host || !character) return;
  if (!Array.isArray(character.loadout) || character.loadout.length !== 6) character.loadout = defaultLoadout(character);
  const owned = unlockedActives();
  if (!_runeViewId || (_runeViewId !== 'strike' && owned.indexOf(_runeViewId) < 0)) _runeViewId = character.loadout[_abilSlotSel] || owned[0] || 'strike';
  const ap = character.abilityPoints || 0;
  const note = document.getElementById('abilNote'); if (note) note.textContent = `${ap} ability point${ap === 1 ? '' : 's'} · unlock an ability or spend in a rune tree`;
  const slotLab = ['LMB', 'RMB', slotKeyLabel(2), slotKeyLabel(3), slotKeyLabel(4), slotKeyLabel(5)];
  let h = '<div class="abilSlots">';
  for (let i = 0; i < 6; i++) {
    const id = character.loadout[i], def = id ? SKILLDEFS[id] : null;
    h += `<div class="abilSlot${i === 0 ? ' basic' : ''}${i === _abilSlotSel ? ' sel' : ''}" data-slot="${i}"><span class="slk">${slotLab[i]}</span>${def ? `<span class="sli">${def.ico}</span>` : '<span class="sle">＋</span>'}</div>`;
  }
  h += '</div>';
  h += `<div class="abilBar"><span class="abilHint">Put a skill into the <b>${slotLab[_abilSlotSel]}</b> slot, or click a slot to view its rune tree.</span><span id="runeReset">↺ Refund all runes (free)</span></div>`;
  h += '<div class="abilPick">';
  const acts = (CLASS_ACTIVES[character.class] || {});
  const list = classAbilities();
  for (const id of owned) if (list.indexOf(id) < 0) list.push(id); // keep any owned active not in the class list assignable
  for (const id of list) {
    const def = SKILLDEFS[id]; if (!def) continue;
    const req = acts[id] || def.req || 1;
    const ownedSkill = (character.skills[id] || 0) >= 1, onBar = character.loadout.indexOf(id) >= 0;
    let cls = 'abilChip', tag = '';
    if (ownedSkill) { if (onBar) cls += ' on'; }
    else if (player.level >= req) { cls += ' unlock'; tag = '<span class="ct">Unlock · 1 pt</span>'; }
    else { cls += ' locked'; tag = `<span class="ct">Lv ${req}</span>`; }
    h += `<div class="${cls}" data-skill="${id}">${def.ico} ${def.name}${tag}</div>`;
  }
  h += '</div><div id="runeWrap"></div>';
  host.innerHTML = h;
  host.querySelectorAll('.abilSlot').forEach(el => { const i = +el.dataset.slot; el.onclick = () => { if (i === 0) { _runeViewId = 'strike'; } else { _abilSlotSel = i; if (character.loadout[i]) _runeViewId = character.loadout[i]; } renderAbilities(); }; });
  host.querySelectorAll('.abilChip').forEach(el => { const id = el.dataset.skill; el.onmouseenter = ev => { tooltip.innerHTML = skillTip(id); tooltip.style.display = 'block'; moveTip(ev); }; el.onmousemove = moveTip; el.onmouseleave = () => tooltip.style.display = 'none'; el.onclick = () => { if ((character.skills[id] || 0) >= 1) { setLoadoutSlot(_abilSlotSel, id); _runeViewId = id; saveProgress(false); renderAbilities(); } else { unlockAbility(id); } }; });
  const rr = document.getElementById('runeReset'); if (rr) rr.onclick = refundRunes;
  renderRuneView();
}
function renderRuneView() {
  const wrap = document.getElementById('runeWrap'); if (!wrap) return; const id = _runeViewId, tree = id && SKILL_RUNES[id];
  if (!tree) { wrap.innerHTML = `<div class="abilHint" style="text-align:center;padding:20px">${id === 'strike' ? 'Basic attack — always on Left-click, no runes to spend.' : 'Select a skill to view its rune tree.'}</div>`; return; }
  if ((character.skills[id] || 0) < 1) { wrap.innerHTML = `<div class="abilHint" style="text-align:center;padding:20px">Unlock this ability to spend runes on it.</div>`; return; }
  const def = SKILLDEFS[id]; rT = { x: 0, y: -20, s: 1 };
  wrap.innerHTML = `<div class="ptsNote" style="margin:8px 0 4px">${def.ico} ${def.name} — rune tree</div><div id="rVp" style="position:relative;width:100%;height:calc(100vh - 400px);min-height:240px;overflow:hidden;border:1px solid #2a2218;border-radius:8px;background:radial-gradient(circle at 50% 45%,#161109,#080604);cursor:grab"><svg id="rSvg" width="100%" height="100%" viewBox="-200 -150 400 380"><defs><filter id="rg" x="-90%" y="-90%" width="280%" height="280%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g id="rG"></g></svg></div>`;
  buildRuneSvg(id); attachRuneEvents();
}
function applyR() { const g = document.getElementById('rG'); if (g) g.setAttribute('transform', `scale(${rT.s}) translate(${rT.x} ${rT.y})`); }
function attachRuneEvents() {
  const vp = document.getElementById('rVp'); if (!vp) return; let drag = false, lx = 0, ly = 0;
  vp.onmousedown = e => { drag = true; lx = e.clientX; ly = e.clientY; vp.style.cursor = 'grabbing'; };
  vp.onmousemove = e => { if (!drag) return; const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; const r = vp.getBoundingClientRect(); rT.x += dx / r.width * 400 / rT.s; rT.y += dy / r.height * 380 / rT.s; applyR(); };
  vp.onmouseup = () => { drag = false; vp.style.cursor = 'grab'; }; vp.onmouseleave = () => { drag = false; vp.style.cursor = 'grab'; };
  vp.onwheel = e => { e.preventDefault(); rT.s = clamp(rT.s * (e.deltaY < 0 ? 1.12 : 0.89), 0.6, 2.2); applyR(); };
}
function canAllocRune(id, nid) {
  const tree = SKILL_RUNES[id]; if (!tree) return false; const node = tree.nodes[nid]; const alloc = (character.skillRunes && character.skillRunes[id]) || {};
  if ((alloc[nid] || 0) >= node.max) return false;
  if ((character.abilityPoints || 0) < node.cost) return false;
  if (player.level < (node.lvlreq || 0)) return false;
  if (nid !== tree.root && !tree.adj[nid].some(x => (alloc[x] || 0) > 0)) return false;
  if (node.excl) for (const o in tree.nodes) { if (o !== nid && tree.nodes[o].excl === node.excl && (alloc[o] || 0) > 0) return false; }
  return true;
}
function buildRuneSvg(id) {
  const g = document.getElementById('rG'); if (!g) return; const tree = SKILL_RUNES[id]; const alloc = (character.skillRunes && character.skillRunes[id]) || {};
  let edges = '', circles = '', drawn = new Set();
  for (const a in tree.adj) for (const b of tree.adj[a]) { const key = a < b ? a + '|' + b : b + '|' + a; if (drawn.has(key)) continue; drawn.add(key); const na = tree.nodes[a], nb = tree.nodes[b]; if (!na || !nb) continue; const on = (alloc[a] > 0) && (alloc[b] > 0); edges += `<line x1="${na.x}" y1="${na.y}" x2="${nb.x}" y2="${nb.y}" stroke="${on ? '#c4a060' : '#2a241c'}" stroke-width="${on ? 3 : 2}"/>`; }
  for (const nid in tree.nodes) {
    const n = tree.nodes[nid]; const ranks = alloc[nid] || 0; const allocated = ranks > 0; const can = canAllocRune(id, nid);
    const r = n.type === 'keystone' ? 14 : n.type === 'notable' ? 11 : 7;
    const fill = allocated ? (n.type === 'keystone' ? '#ffcf3a' : n.type === 'notable' ? '#e6b84d' : '#c8ad7a') : '#16110a';
    const stroke = allocated ? '#ffe9a8' : can ? '#e6b84d' : '#352c20';
    circles += `<circle data-rn="${nid}" cx="${n.x}" cy="${n.y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${can ? 3 : 2}" ${can ? 'filter="url(#rg)"' : ''} style="cursor:pointer"/>`;
    circles += `<text x="${n.x}" y="${n.y - r - 3}" text-anchor="middle" fill="#cdb084" font-size="8.5" font-family="Georgia" style="pointer-events:none">${n.label}${n.max > 1 ? ' ' + ranks + '/' + n.max : ''}</text>`;
  }
  g.innerHTML = edges + circles; applyR();
  g.querySelectorAll('[data-rn]').forEach(el => { const nid = el.getAttribute('data-rn'), n = tree.nodes[nid]; el.onmouseenter = e => { tooltip.innerHTML = runeTip(n, id, nid); tooltip.style.display = 'block'; moveTip(e); }; el.onmousemove = moveTip; el.onmouseleave = () => tooltip.style.display = 'none'; el.onclick = ev => { ev.stopPropagation(); runeClick(id, nid); }; });
}
function runeTip(node, id, nid) {
  const ranks = (character.skillRunes && character.skillRunes[id] && character.skillRunes[id][nid]) || 0; const m = node.mod || {};
  const t = node.type === 'keystone' ? 'Keystone' : node.type === 'notable' ? 'Notable Rune' : 'Rune'; const per = node.max > 1 ? ' / rank' : '';
  let lines = '';
  if (m.dmgMult) lines += `<div style="color:#b8a888">+${Math.round(m.dmgMult * 100)}% damage${per}</div>`;
  if (m.cdrMult) lines += `<div style="color:#b8a888">${Math.round(m.cdrMult * 100)}% cooldown${per}</div>`;
  if (m.costMult) lines += `<div style="color:#b8a888">${Math.round(m.costMult * 100)}% mana cost${per}</div>`;
  if (m.addProj) lines += `<div style="color:#b8a888">+${m.addProj} projectile/jump${per}</div>`;
  if (m.addHits) lines += `<div style="color:#b8a888">+${m.addHits} hits${per}</div>`;
  if (m.addRadius) lines += `<div style="color:#b8a888">+${m.addRadius} area${per}</div>`;
  if (m.addSlow) lines += `<div style="color:#b8a888">stronger slow${per}</div>`;
  if (m.addDuration) lines += `<div style="color:#b8a888">+${(m.addDuration / 1000).toFixed(1)}s duration${per}</div>`;
  if (m.pierce) lines += `<div style="color:#b8a888">+${m.pierce} pierce${per}</div>`;
  if (node.flags) for (const f of node.flags) { const fi = RUNE_FLAG_INFO[f]; if (fi) lines += `<div style="color:#9f6aff">${fi[1]}</div>`; }
  let foot = '';
  if (player.level < (node.lvlreq || 0)) foot = `<div style="color:#d07f7f;font-size:11px;margin-top:3px">Requires level ${node.lvlreq}</div>`;
  else if (node.excl) foot = `<div style="color:#8a7a5a;font-size:11px;margin-top:3px">Exclusive — only one of this set</div>`;
  return `<div class="tname" style="color:${node.type === 'keystone' ? '#ffcf3a' : '#e6b84d'}">${node.label}</div><div class="tslot">${t} · ${node.cost} pt${node.cost > 1 ? 's' : ''}${node.max > 1 ? ' · ' + ranks + '/' + node.max : ''}</div>${lines || '<div style="color:#8a7a5a">Pathway node</div>'}${foot}`;
}
function runeClick(id, nid) {
  const tree = SKILL_RUNES[id]; if (!tree) return; const node = tree.nodes[nid];
  if (!canAllocRune(id, nid)) { if (player.level < (node.lvlreq || 0)) showMsg('Requires level ' + node.lvlreq); else if ((character.abilityPoints || 0) < node.cost) showMsg('Not enough ability points'); else if (node.excl) showMsg('Already chose a rune in this slot'); return; }
  if (!character.skillRunes[id]) character.skillRunes[id] = {};
  character.skillRunes[id][nid] = (character.skillRunes[id][nid] || 0) + 1; character.abilityPoints -= node.cost;
  invalidateRunes(); buildRuneSvg(id); renderSkillbar(); updatePips();
  const ap = character.abilityPoints || 0, note = document.getElementById('abilNote'); if (note) note.textContent = `${ap} ability point${ap === 1 ? '' : 's'} · click a slot, then a skill to assign it`;
  sfx('potion'); saveProgress(false);
}
function refundRunes() {
  let refunded = 0; for (const sid in (character.skillRunes || {})) { const tree = SKILL_RUNES[sid]; if (!tree) continue; for (const nid in character.skillRunes[sid]) { const node = tree.nodes[nid]; if (node) refunded += (character.skillRunes[sid][nid] || 0) * node.cost; } }
  character.skillRunes = {}; character.abilityPoints = (character.abilityPoints || 0) + refunded; invalidateRunes(); renderSkillbar(); updatePips(); renderAbilities(); showMsg('Refunded ' + refunded + ' ability point' + (refunded === 1 ? '' : 's')); saveProgress(false);
}
let vendorStock = [], vendorTab = 'buy', vendorTier = 1, vendorStockTier = 1;
function refreshVendor(tier) { tier = tier || 1; vendorStockTier = tier; vendorStock = []; const bump = (tier - 1) * 7, q = tier >= 2 ? 0.35 : 0; for (let i = 0; i < 6; i++) vendorStock.push(rollItem(Math.max(1, player.level + randi(-1, 2)) + bump, null, q)); }
function renderVendor() {
  if (invOpen) renderInv(); /* keep the paired inventory pane in sync after a buy/sell */
  const body = document.getElementById('vendorBody'); body.innerHTML = `<div style="color:#ffe27a;margin-bottom:10px">Your gold: ${player.gold} <span style="color:#b9a6ff">· ✦ ${character.materials || 0} Dust</span></div>`;
  if (vendorTier >= 2) body.innerHTML += `<div style="color:#ff6ad0;margin-bottom:8px;font-size:13px">✦ Exotic wares — rarer, higher item level, premium prices.</div>`;
  if (vendorTab === 'buy') {
    body.innerHTML += `<div style="color:#9a8a6a;margin-bottom:8px;font-size:13px">Need potions? Visit the 🔥 cauldron in town to refill for free.</div>`;
    const reCost = 40 + player.level * 8; const reRow = document.createElement('div'); reRow.className = 'row'; reRow.innerHTML = `<div class="ric">🔄</div><div class="rname">Restock wares <span style="color:#8a7a5a;font-size:11px">(reroll the merchant's items)</span></div><div class="rprice">${reCost} g</div><div class="rbtn${player.gold >= reCost ? '' : ' dis'}" id="restockBtn">Reroll</div>`; body.appendChild(reRow);
    document.getElementById('restockBtn').onclick = () => { if (player.gold < reCost) return; player.gold -= reCost; refreshVendor(vendorTier); goldTxt.textContent = player.gold + ' g'; renderVendor(); saveProgress(false); }; /* pass the active tier so a paid reroll at an Exotic (tier ≥ 2) merchant keeps its premium stock instead of silently dropping to tier 1 */
    vendorStock.forEach((it, idx) => { const price = buyPrice(it); const row = document.createElement('div'); row.className = 'row'; row.innerHTML = `<div class="ric">${SLOT_ICON[it.slot]}</div><div class="rname rc-${it.rarity}">${it.name}</div><div class="rprice">${price} g</div><div class="rbtn${player.gold >= price && character.inventory.length < character.invMax ? '' : ' dis'}" data-buy="${idx}">Buy</div>`; bindTip(row.querySelector('.rname'), it); body.appendChild(row); });
    body.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const idx = +b.dataset.buy; const it = vendorStock[idx]; const price = buyPrice(it); if (player.gold < price || character.inventory.length >= character.invMax) return; player.gold -= price; character.inventory.push(it); vendorStock.splice(idx, 1); goldTxt.textContent = player.gold + ' g'; renderVendor(); updatePips(); saveProgress(false); });
  } else if (vendorTab === 'sell') {
    if (!character.inventory.length) body.innerHTML += `<div style="color:#6a5a44">Your backpack is empty.</div>`;
    const isJunk = it => it.rarity === 'common' || it.rarity === 'magic'; const junkTotal = character.inventory.filter(isJunk).reduce((s, it) => s + sellValue(it), 0), allTotal = character.inventory.reduce((s, it) => s + sellValue(it), 0), junkCnt = character.inventory.filter(isJunk).length;
    const junkDust = character.inventory.filter(isJunk).reduce((s, it) => s + dustValue(it), 0), allDust = character.inventory.reduce((s, it) => s + dustValue(it), 0);
    if (character.inventory.length) {
      const bar = document.createElement('div'); bar.className = 'row'; bar.style.background = 'rgba(40,30,16,.55)';
      bar.innerHTML = `<div class="rname" style="flex:1">Bulk sell <span style="color:#8a7a5a;font-size:11px">(also salvages into ✦ Dust)</span></div><div class="rbtn${junkCnt ? '' : ' dis'}" id="sellJunk">Sell Junk (${junkTotal}g · ${junkDust}✦)</div><div class="rbtn${allTotal ? '' : ' dis'}" id="sellAll" style="margin-left:6px;border-color:#7a3a28">Sell All (${allTotal}g · ${allDust}✦)</div>`; body.appendChild(bar);
      const sj = document.getElementById('sellJunk'); if (sj) sj.onclick = () => { if (!junkCnt) return; player.gold += junkTotal; character.materials = (character.materials || 0) + junkDust; character.inventory = character.inventory.filter(it => !isJunk(it)); goldTxt.textContent = player.gold + ' g'; showMsg('Salvaged junk: +' + junkTotal + 'g · +' + junkDust + '✦'); renderVendor(); updatePips(); saveProgress(false); };
      const sa = document.getElementById('sellAll'); if (sa) sa.onclick = () => { if (!allTotal) return; if (!confirm('Sell ALL ' + character.inventory.length + ' backpack items for ' + allTotal + 'g + ' + allDust + ' Dust?\nThis includes rare, set and unique gear.')) return; player.gold += allTotal; character.materials = (character.materials || 0) + allDust; character.inventory = []; goldTxt.textContent = player.gold + ' g'; showMsg('Salvaged all: +' + allTotal + 'g · +' + allDust + '✦'); renderVendor(); updatePips(); saveProgress(false); };
    }
    character.inventory.forEach((it, idx) => { const price = sellValue(it); const row = document.createElement('div'); row.className = 'row'; row.innerHTML = `<div class="ric">${SLOT_ICON[it.slot]}</div><div class="rname rc-${it.rarity}">${it.name}</div><div class="rprice">${price} g · ${dustValue(it)}✦</div><div class="rbtn" data-sell="${idx}">Sell</div>`; bindTip(row.querySelector('.rname'), it); body.appendChild(row); });
    body.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => { const idx = +b.dataset.sell; const it = character.inventory[idx]; player.gold += sellValue(it); character.materials = (character.materials || 0) + dustValue(it); character.inventory.splice(idx, 1); goldTxt.textContent = player.gold + ' g'; renderVendor(); updatePips(); saveProgress(false); });
  }
}
function setVendorTab(t) { if (t !== 'sell') t = 'buy'; vendorTab = t;['Buy', 'Sell'].forEach(n => document.getElementById('tab' + n).classList.toggle('on', t === n.toLowerCase())); renderVendor(); }
document.getElementById('tabBuy').onclick = () => setVendorTab('buy');
document.getElementById('tabSell').onclick = () => setVendorTab('sell');
document.getElementById('smithTabUpgrade').onclick = () => setSmithTab('upgrade');
document.getElementById('smithTabReforge').onclick = () => setSmithTab('reforge');
document.getElementById('smithTabSocket').onclick = () => setSmithTab('socket');
document.getElementById('smithTabSalvage').onclick = () => setSmithTab('salvage');
document.getElementById('jewelerTabBuy').onclick = () => setJewelerTab('buy');
document.getElementById('jewelerTabReroll').onclick = () => setJewelerTab('reroll');
document.getElementById('jewelerTabSocket').onclick = () => setJewelerTab('socket');
document.getElementById('jewelerTabCombine').onclick = () => setJewelerTab('combine');
document.querySelectorAll('#invTabs .tab').forEach(el => el.onclick = () => setInvTab(el.dataset.invtab));
function renderStash() {
  const bp = document.getElementById('bpGrid'), st = document.getElementById('stGrid'); bp.innerHTML = ''; st.innerHTML = '';
  for (let i = 0; i < character.invMax; i++) { const it = character.inventory[i]; const c = document.createElement('div'); c.className = 'cell' + (it ? ' r-' + it.rarity : ''); c.innerHTML = it ? SLOT_ICON[it.slot] : ''; if (it) { bindTip(c, it); c.onclick = () => { if (character.stash.length >= character.stashMax) { showMsg('Stash full'); return; } character.stash.push(it); character.inventory.splice(i, 1); renderStash(); saveProgress(false); }; } bp.appendChild(c); }
  for (let i = 0; i < character.stashMax; i++) { const it = character.stash[i]; const c = document.createElement('div'); c.className = 'cell' + (it ? ' r-' + it.rarity : ''); c.innerHTML = it ? SLOT_ICON[it.slot] : ''; if (it) { bindTip(c, it); c.onclick = () => { if (character.inventory.length >= character.invMax) { showMsg('Bag full'); return; } character.inventory.push(it); character.stash.splice(i, 1); renderStash(); updatePips(); saveProgress(false); }; } st.appendChild(c); }
  const sb = document.getElementById('slotBuyBar'); if (sb) {
    const bpCost = 100 + (character.invMax - 40) * 25, stCost = 100 + (character.stashMax - 40) * 25, bpMax = character.invMax >= INV_CAP, stMax = character.stashMax >= STASH_CAP;
    sb.innerHTML = `<div class="row" style="flex:1"><div class="rname">🎒 Backpack ${character.invMax}/${INV_CAP}</div>${bpMax ? '<div class="rprice">MAX</div>' : `<div class="rprice">${bpCost} g</div><div class="rbtn${player.gold >= bpCost ? '' : ' dis'}" id="buyBp">+4</div>`}</div>` +
      `<div class="row" style="flex:1"><div class="rname">📦 Stash ${character.stashMax}/${STASH_CAP}</div>${stMax ? '<div class="rprice">MAX</div>' : `<div class="rprice">${stCost} g</div><div class="rbtn${player.gold >= stCost ? '' : ' dis'}" id="buySt">+4</div>`}</div>`;
    const bbp = document.getElementById('buyBp'); if (bbp) bbp.onclick = () => { if (player.gold < bpCost || character.invMax >= INV_CAP) return; player.gold -= bpCost; character.invMax = Math.min(INV_CAP, character.invMax + 4); goldTxt.textContent = player.gold + ' g'; renderStash(); saveProgress(false); };
    const bst = document.getElementById('buySt'); if (bst) bst.onclick = () => { if (player.gold < stCost || character.stashMax >= STASH_CAP) return; player.gold -= stCost; character.stashMax = Math.min(STASH_CAP, character.stashMax + 4); goldTxt.textContent = player.gold + ' g'; renderStash(); saveProgress(false); };
  }
}

let _fps = 60, _errCount = 0, _lastErr = '', _lastErrAt = 0, _frame = 0;
function loop() {
  if (!running) return; requestAnimationFrame(loop); if (_warming) return; /* paused while pre-warming a new scene's GPU pipelines (see warmScene) */ const t = now(); const dt = Math.min(50, t - last); last = t; _fps = _fps * 0.9 + (1000 / Math.max(1, dt)) * 0.1; recordFrame(dt);
  _frame++; if (renderer.shadowMap.enabled && (_frame & 1)) moon.shadow.needsUpdate = true; /* Phase 1b: per-light one-shot refresh; keep the (_frame&1) every-other-frame throttle. */
  const _spkHB = _SPK.on && performance.memory ? performance.memory.usedJSHeapSize : 0, _spkT0 = _SPK.on ? performance.now() : 0; let _spkU = _spkT0;
  try { update(dt); if (_SPK.on) _spkU = performance.now(); renderFrame(); }
  catch (err) { _errCount++; _lastErr = (err && err.message) || String(err); if (now() - _lastErrAt > 1000) { _lastErrAt = now(); console.error('frame error #' + _errCount + ':', err); } }
  if (_SPK.on) { const _tend = performance.now(), _ft = _tend - _spkT0; if (_ft > _SPK.thresh) { const _hA = performance.memory ? performance.memory.usedJSHeapSize : 0, _dH = (_hA - _spkHB) / 1048576, _lcNew = !_SPK.lcSeen.has(_plVisN); const rec = { f: _frame, ft: +_ft.toFixed(1), uMs: +(_spkU - _spkT0).toFixed(1), rMs: +(_tend - _spkU).toFixed(1), dt: +dt.toFixed(1), gc: _dH < -0.25, dHeapMB: +_dH.toFixed(2), heapMB: +(_hA / 1048576).toFixed(1), lc: _plVisN, lcNew: _lcNew, mon: monsters.length, fx: fx.length, proj: projectiles.length, loot: loots.length, dying: _dying.length, draws: _lastDraws, zone: zone, ev: Object.assign({}, _SPK.ev) }; _SPK.spikes.push(rec); if (_SPK.spikes.length > 400) _SPK.spikes.shift(); console.warn('[SPIKE] ' + rec.ft + 'ms (u' + rec.uMs + '/r' + rec.rMs + ') ' + (rec.gc ? 'GC' + rec.dHeapMB : 'cpu+' + rec.dHeapMB) + ' lc' + rec.lc + (_lcNew ? '(NEW)' : '') + ' mon' + rec.mon + ' ' + JSON.stringify(rec.ev)); } _SPK.lcSeen.add(_plVisN); _SPK.ev = {}; }
}

/* ---- Phase 0 rig: deterministic perf harness (perftest mode only). Load a fixed-L1 char, then call
   perfRun() in the console. It scripts town→wild→dungeon→boss, and for each stage clears the frame ring
   AFTER reveal then samples a window — so maxFrameMs captures the first-encounter GPU-compile spike (the
   Phase 3 freeze gate). Run after a COLD reload (disk cache empty) to see the real freeze; seeded RNG
   keeps spawns/biomes identical across runs for clean A/B. ---- */
if (_perftest) {
  const _raf = () => new Promise(r => requestAnimationFrame(() => r()));
  const _frames = async n => { for (let i = 0; i < n; i++) await _raf(); };
  const _waitUntil = async (pred, ms) => { const t0 = performance.now(); while (!pred() && performance.now() - t0 < ms) await _raf(); };
  const _ftReset = () => { _ftIdx = 0; _ftCount = 0; };
  const _sampleStage = async (label, enterFn, sampleFrames) => {
    enterFn();
    await _waitUntil(() => !_warming, 15000);   /* warmScene pauses the loop; wait for reveal */
    await _frames(8);                            /* let the first revealed frames settle */
    _ftReset();                                  /* clean window so framePctl.max == this stage's worst frame */
    await _frames(sampleFrames || 220);
    const p = framePctl();
    return { stage: label, fps: +_fps.toFixed(0), gpuMs: +_gpuMs.toFixed(2), draws: _lastDraws, trisK: +(_lastTris / 1000).toFixed(1), monsters: monsters.length, p50: +p.p50.toFixed(1), p95: +p.p95.toFixed(1), p99: +p.p99.toFixed(1), maxFrameMs: +p.max.toFixed(1) };
  };
  window.perfRun = async () => {
    if (typeof running === 'undefined' || !running) { console.warn('[perfRun] load a character first (need a running game loop).'); return; }
    const out = [];
    out.push(await _sampleStage('town', () => enterTown()));
    out.push(await _sampleStage('wild+combat', () => enterWild(), 260));        /* waveTimer=0 on entry → first wave spawns inside the window */
    out.push(await _sampleStage('dungeon-d1+combat', () => enterDungeon(1), 260));
    out.push(await _sampleStage('dungeon-d5-boss', () => enterDungeon(5), 220));
    console.log('[perfRun] results (seed-deterministic):\n' + JSON.stringify(out, null, 2));
    return out;
  };
  /* ---- walking harness: standing-still doesn't trigger the freeze, so auto-patrol a diamond loop and
     measure standing vs lap1 vs lap2. lap2-clean ⇒ one-time cached first-render compile; lap2≈lap1 ⇒ a
     recurring per-walk cost (cull/GC/draw-call/CPU). Drives moveTarget directly (module-scoped click target). ---- */
  let _gpuMax = 0;
  const _visLights = () => { let n = 0; scene.traverse(o => { if (o.isLight && o.visible) n++; }); return n; };
  const _walkTo = async (x, z, maxMs) => {
    moveTarget = { x, z }; const t0 = performance.now();
    while (performance.now() - t0 < (maxMs || 6000)) { await _raf(); if (_gpuMs > _gpuMax) _gpuMax = _gpuMs; if (Math.hypot(player.x - x, player.z - z) < 1.4) break; }
  };
  const _wp = r => [[0, 0], [r, 0], [0, r], [-r, 0], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, -r * 0.7], [0, 0]];
  const _metrics = phase => { const p = framePctl(); return { phase, fps: +_fps.toFixed(0), p50: +p.p50.toFixed(1), p95: +p.p95.toFixed(1), p99: +p.p99.toFixed(1), max: +p.max.toFixed(1), gpuNow: +_gpuMs.toFixed(2), gpuMax: +_gpuMax.toFixed(2), draws: _lastDraws, trisK: +(_lastTris / 1000).toFixed(1), lights: _visLights(), monsters: monsters.length }; };
  window.perfWalk = async (label, enterFn, r) => {
    enterFn(); await _waitUntil(() => !_warming, 15000); await _frames(10);
    const out = { zone: label };
    _ftReset(); _gpuMax = 0; await _frames(150); out.stand = _metrics('stand');   /* baseline: stationary */
    const path = _wp(r);
    for (let lap = 1; lap <= 2; lap++) {
      const x0 = player.x, z0 = player.z; _ftReset(); _gpuMax = 0;
      for (const [x, z] of path) await _walkTo(x, z, 6000);
      if (lap === 1 && Math.hypot(player.x - x0, player.z - z0) < 0.5) console.warn('[perfWalk] player barely moved — harness may be broken (check moveTarget wiring)');
      out['lap' + lap] = _metrics('lap' + lap);
    }
    moveTarget = null; return out;
  };
  window.perfWalkAll = async () => {
    if (typeof running === 'undefined' || !running) { console.warn('[perfWalk] load a character first.'); return; }
    const res = [];
    res.push(await window.perfWalk('town', () => enterTown(), 30));        /* spawn-free control zone */
    res.push(await window.perfWalk('wild', () => enterWild(), 110));
    res.push(await window.perfWalk('dungeon-d1', () => enterDungeon(1), 60));
    enterTown();   /* park in a spawn-free zone so the harness doesn't keep spawning monsters after it returns */
    console.log('[perfWalkAll] results:\n' + JSON.stringify(res, null, 2));
    return res;
  };
  console.log('[perfRun] deterministic harness ready — load a character, then call perfRun() (zone-entry) or perfWalkAll() (walking) in the console.');
  Object.assign(window, { enterDungeon, enterTown, enterWild }); /* perftest-only: lets the QA harness jump zones/biomes from the console (pairs with window.perfRun) */
  Object.defineProperty(window, '__perfGod', { get: () => _perfGod, set: v => { _perfGod = !!v; } }); /* toggle god-mode from console (default on under ?perftest) */
  window.__spikeStart = thresh => { _SPK.thresh = thresh || 35; _SPK.on = true; _SPK.spikes.length = 0; _SPK.ev = {}; _SPK.rates = {}; _SPK.seen = new Set(); _SPK.lcSeen = new Set(); _SPK.t0 = performance.now(); console.log('[spike] logging ON. thresh=' + _SPK.thresh + 'ms. Play/fight to reproduce the stutter, then call __spikeStop().'); };
  window.__spikeStop = () => { _SPK.on = false; const secs = Math.max(0.001, (performance.now() - _SPK.t0) / 1000); const ratesPerSec = {}; for (const k in _SPK.rates) ratesPerSec[k] = +(_SPK.rates[k] / secs).toFixed(2); const out = { secs: +secs.toFixed(1), spikeCount: _SPK.spikes.length, gcSpikes: _SPK.spikes.filter(s => s.gc).length, worst: _SPK.spikes.slice().sort((a, b) => b.ft - a.ft).slice(0, 15), ratesPerSec, allSpikes: _SPK.spikes }; console.log('[spike] STOP — ' + out.spikeCount + ' spikes (' + out.gcSpikes + ' GC) in ' + out.secs + 's'); return out; };
  window.__spikeStart(); /* auto-on under ?perftest: captures real-play hitches from first load (call __spikeStop() to read) */
}
function show(id) { ['selectScreen', 'createScreen', 'overScreen'].forEach(s => document.getElementById(s).style.display = 'none'); if (id) document.getElementById(id).style.display = 'flex'; }
function setHud(on) { document.getElementById('hud').style.display = on ? 'block' : 'none'; document.getElementById('topbar').style.display = on ? 'flex' : 'none'; document.getElementById('xpbar').style.display = on ? 'block' : 'none'; document.getElementById('minimap').style.display = on ? 'block' : 'none'; document.getElementById('prompt').style.display = 'none'; document.getElementById('bossBar').style.display = 'none'; if (!on) closeAll(); }
function enterGame() {
  invalidateRunes(); /* rune struct cache is keyed on the live `character`; clear it on every character switch so a newly loaded hero can't inherit the previous one's cached rune bonuses */
  stopMenu(); Object.assign(player, { level: character.level, xp: character.xp, xpNext: character.xpNext, gold: character.gold, kills: character.kills, potions: character.hpPotions, hpPotions: character.hpPotions, mpPotions: character.mpPotions, attackCd: 0, bob: 0 });
  recompute(); syncActives(); player.hp = player.hpMax; player.mp = player.mpMax;
  charName.textContent = character.name; setLevelText(player.level); killsTxt.textContent = 'Slain: ' + player.kills; goldTxt.textContent = player.gold + ' g';
  hero.userData.cloak.material.color.setHex((CLASSES[character.class] || CLASSES.warrior).col);
  swapHeroToGLB(); /* re-pick hero mesh by class — roster loaded on the title screen before a class was chosen, so the per-class swap must fire again here */
  show(null); setHud(true);
  if (!Array.isArray(character.loadout) || character.loadout.length !== 6) character.loadout = defaultLoadout(character);
  if (!character.activeSkillId && character.loadout[1]) character.activeSkillId = character.loadout[1];
  renderSkillbar(); updateGlobes(); updatePips(); saveTimer = 8000; enterTown(); applyGraphics(); running = true; last = now(); loop();
  Audio2.init(); Audio2.muted = SAVE._data.settings.muted; applySettings(); document.getElementById('soundBtn').textContent = Audio2.muted ? '🔇' : '🔊'; if (!Audio2.muted) MUSIC.start();
  try { if (!localStorage.getItem('sanctuary_helpseen')) { openHelp(); localStorage.setItem('sanctuary_helpseen', '1'); } } catch (_) { }
}
function gameOver() { running = false; saveProgress(false); show('overScreen'); document.getElementById('overTitle').textContent = 'YOU DIED'; document.getElementById('overStats').textContent = `${character.name} — Level ${player.level} • Slain ${player.kills} • Deepest Depth ${character.maxDepth}`; setHud(false); startMenu(); }

function renderSlots() {
  const wrap = document.getElementById('slots'); wrap.innerHTML = '';
  for (let i = 0; i < SAVE.NUM_SLOTS; i++) {
    const ch = SAVE.getSlot(i); const div = document.createElement('div'); div.className = 'slot';
    if (ch) { div.innerHTML = `<div class="info"><div class="cname">${escapeHtml(ch.name)}</div><div class="cmeta">${(CLASSES[ch.class] || CLASSES.warrior).name} • Level ${ch.level} • depth ${ch.maxDepth || 0}</div></div><div class="del" data-del="${i}">Delete</div>`; div.onclick = e => { if (e.target.dataset.del !== undefined) return; currentSlot = i; character = ch; enterGame(); }; }
    else { div.innerHTML = `<div class="info"><div class="empty">Empty Slot ${i + 1}</div></div><div class="cname">+ New</div>`; div.onclick = () => { pendingSlot = i; selectedClass = 'warrior'; renderClassPick(); show('createScreen'); document.getElementById('nameInput').value = ''; document.getElementById('nameInput').focus(); }; }
    wrap.appendChild(div);
  }
  wrap.querySelectorAll('[data-del]').forEach(b => b.onclick = e => { e.stopPropagation(); if (confirm('Delete this hero permanently?')) { SAVE.deleteSlot(+b.dataset.del); renderSlots(); } });
}
let pendingSlot = null, selectedClass = 'warrior';
function renderClassPick() { const wrap = document.getElementById('classPick'); wrap.innerHTML = ''; for (const id in CLASSES) { const c = CLASSES[id]; const d = document.createElement('div'); d.className = 'classCard' + (id === selectedClass ? ' sel' : ''); d.innerHTML = `<div class="cn">${c.name}</div><div class="cb">${c.blurb}</div>`; d.onclick = () => { selectedClass = id; renderClassPick(); }; wrap.appendChild(d); } }
document.getElementById('createBtn').onclick = () => { const name = (document.getElementById('nameInput').value || '').trim() || 'Wanderer'; character = SAVE.newCharacter(name, selectedClass); currentSlot = pendingSlot; SAVE.saveCharacter(currentSlot, character); enterGame(); };
document.getElementById('nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('createBtn').click(); });
document.getElementById('backBtn').onclick = () => { renderSlots(); show('selectScreen'); startMenu(); };
document.getElementById('reviveBtn').onclick = () => { enterGame(); };
document.getElementById('quitBtn').onclick = () => { renderSlots(); show('selectScreen'); startMenu(); };
document.getElementById('saveBtn').onclick = () => { saveProgress(true); running = false; setHud(false); renderSlots(); show('selectScreen'); startMenu(); };
document.getElementById('invBtn').onclick = () => toggleInv(); document.getElementById('invClose').onclick = () => toggleInv();
document.getElementById('skillBtn').onclick = () => toggleSkill(); document.getElementById('skillClose').onclick = () => toggleSkill();
document.querySelectorAll('#skillTabs .tab').forEach(t => t.onclick = () => setSkillTab(t.dataset.sktab));
document.getElementById('vendorClose').onclick = () => closeAll(); document.getElementById('stashClose').onclick = () => closeAll(); document.getElementById('smithClose').onclick = () => closeAll(); document.getElementById('enchantClose').onclick = () => closeAll(); document.getElementById('gambleClose').onclick = () => closeAll(); document.getElementById('jewelerClose').onclick = () => closeAll(); document.getElementById('alchemistClose').onclick = () => closeAll();
document.getElementById('townBtn').onclick = () => { if (zone !== 'town') enterTown(); };
document.getElementById('diffBtn').onclick = () => { const order = DIFF_ORDER; difficulty = order[(order.indexOf(difficulty) + 1) % order.length]; SAVE._data.settings.difficulty = difficulty; SAVE.persist(); document.getElementById('diffBtn').textContent = difficulty; setScale(); showMsg('Difficulty: ' + difficulty); };
function toggleSound() { Audio2.init(); Audio2.muted = !Audio2.muted; SAVE._data.settings.muted = Audio2.muted; SAVE.persist(); document.getElementById('soundBtn').textContent = Audio2.muted ? '🔇' : '🔊'; if (Audio2.muted) MUSIC.stop(); else MUSIC.start(); }
document.getElementById('soundBtn').onclick = toggleSound;
const helpModal = document.getElementById('helpModal');
function openHelp() { helpModal.style.display = 'block'; syncBackdrop(); }
function closeHelp() { helpModal.style.display = 'none'; syncBackdrop(); }
document.getElementById('helpBtn').onclick = openHelp;
document.getElementById('helpClose').onclick = closeHelp;
document.getElementById('helpGo').onclick = closeHelp;
document.getElementById('ptRecenter').onclick = () => { if (character && typeof PTREE !== 'undefined') { const s = PTREE.nodes[PTREE.starts[character.class]]; ptT = { x: -s.x, y: -s.y, s: 1.1 }; applyPT(); } };
// Escape / Help handled by the unified keybind dispatcher above

// ---- living main-menu scene ----
let menuActive = false, menuRAF = null, menuT = 0, _menuShadowDirty = true;
function startMenu() { if (menuActive) return; menuActive = true; _menuShadowDirty = true; try { townGroup.visible = true; wildGroup.visible = false; dungeonGroup.visible = false; } catch (_) { } menuLoop(); }
function stopMenu() { menuActive = false; if (menuRAF) { cancelAnimationFrame(menuRAF); menuRAF = null; } }
/* The menu scene is static (only the camera orbits), so the moon shadow map only needs re-rendering while the
   roster is still streaming in (!GLB_READY, swaps happening) plus one final pass after any scenery rebuild —
   not every frame. This still satisfies the one-shot refresh that keeps the sampler2DShadow from sampling an
   unrendered placeholder (the reason it was per-frame). */
function menuLoop() { if (!menuActive) return; menuT += 0.0032; const r = 44; camera.position.set(Math.sin(menuT) * r, 30, Math.cos(menuT) * r + 6); camera.lookAt(0, 2, -2); if (renderer.shadowMap.enabled && (_menuShadowDirty || !GLB_READY)) { moon.shadow.needsUpdate = true; _menuShadowDirty = false; } renderFrame(); menuRAF = requestAnimationFrame(menuLoop); }

// ---- settings ----
/* ---------- Phase 2: quality presets + auto-downgrade ----------
   Bundle the existing graphics settings (+ new plMax/shadowSize knobs) into Low/Medium/High, plus Auto
   (resolve by backend — no low-end device to profile, so this is a design principle not a measured target)
   and Custom (manual). Big low-end levers: resolution, shadows, AO, reflections, light budget, shadow-map
   size. postfx/colorgrade/vfx stay on across tiers (cheap and core to the art style). */
const QUALITY_PRESETS = {
  low: { resScale: 70, shadows: false, ssao: false, reflections: false, bloom: 0.6, postfx: true, colorgrade: true, vfx: true, plMax: 4, shadowSize: 512, particles: false, groundTex: false },
  medium: { resScale: 90, shadows: true, ssao: false, reflections: true, bloom: 0.9, postfx: true, colorgrade: true, vfx: true, plMax: 7, shadowSize: 1024, particles: false, groundTex: true },
  high: { resScale: 100, shadows: true, ssao: true, reflections: true, bloom: 0.9, postfx: true, colorgrade: true, vfx: true, plMax: 9, shadowSize: 1024, particles: true, groundTex: true },
};
function autoTier() { return isWebGPUBackend ? 'high' : 'medium'; } /* WebGL2 fallback => Medium (conservative); WebGPU => High. (A GPU-time probe could refine later — deferred; no low-end device to calibrate against.) */
function applyLights() { const s = SAVE._data.settings; PL_MAX = (s.plMax != null ? s.plMax : 9); if (typeof cullLights === 'function') cullLights(); }
function applyShadowSize() { const s = SAVE._data.settings; const sz = (s.shadowSize === 512 || s.shadowSize === 2048) ? s.shadowSize : 1024; if (moon.shadow.mapSize.width !== sz) { moon.shadow.mapSize.set(sz, sz); if (moon.shadow.map) { moon.shadow.map.dispose(); moon.shadow.map = null; } moon.shadow.needsUpdate = true; } } /* resize requires disposing the existing depth target so it regenerates */
function applyAllGfx() { applyGraphics(); applyShadowSize(); applyLights(); if (typeof buildPipeline === 'function') buildPipeline(); applyPostFX(); applyReflections(); applyGrade(); if (typeof applyParticles === 'function') applyParticles(); if (typeof refreshGroundTex === 'function') refreshGroundTex(); }
/* Resolve s.quality into concrete settings. 'auto' re-resolves by backend each boot; 'custom' leaves the
   individual settings untouched. Returns the bundle applied (or null for custom). */
function resolveQuality() { const s = SAVE._data.settings; if (!s.quality) s.quality = 'auto'; if (s.quality === 'custom') return null; const tier = (s.quality === 'auto') ? autoTier() : s.quality; const p = QUALITY_PRESETS[tier]; if (p) Object.assign(s, p); return p || null; }
function setQuality(q) { SAVE._data.settings.quality = q; resolveQuality(); SAVE.persist(); applyAllGfx(); if (typeof renderSettings === 'function') renderSettings(); }
function markCustomQuality() { SAVE._data.settings.quality = 'custom'; } /* called when a graphics setting is changed by hand so the preset chip reflects reality */
const settingsModal = document.getElementById('settingsModal');
function applySettings() { const s = SAVE._data.settings; if (Audio2.master) Audio2.master.gain.value = (s.muted ? 0 : s.volume / 100); }
function renderSettings() {
  const s = SAVE._data.settings; document.getElementById('setVol').value = s.volume;
  [['setMusic', 'music'], ['setSfx', 'sfx'], ['setShake', 'shake'], ['setDmg', 'dmgnum'], ['setShadows', 'shadows'], ['setPostfx', 'postfx'], ['setReflect', 'reflections'], ['setSsao', 'ssao'], ['setColorGrade', 'colorgrade'], ['setVfx', 'vfx']].forEach(([id, k]) => document.getElementById(id).classList.toggle('on', s[k] !== false));
  document.getElementById('setRes').value = s.resScale || 100; document.getElementById('setResVal').textContent = (s.resScale || 100) + '%';
  const _bl = (s.bloom != null ? s.bloom : 0.9), _ex = (s.exposure != null ? s.exposure : 1.0); document.getElementById('setBloom').value = Math.round(_bl * 100); document.getElementById('setBloomVal').textContent = _bl.toFixed(2); document.getElementById('setExpo').value = Math.round(_ex * 100); document.getElementById('setExpoVal').textContent = _ex.toFixed(2);
  const qseg = document.getElementById('setQuality'); if (qseg) { qseg.innerHTML = ''; const aq = s.quality || 'auto'; const opts = ['low', 'medium', 'high', 'auto']; if (aq === 'custom') opts.push('custom'); opts.forEach(q => { const b = document.createElement('button'); b.textContent = q.charAt(0).toUpperCase() + q.slice(1); if (aq === q) b.classList.add('on'); if (q !== 'custom') b.onclick = () => setQuality(q); qseg.appendChild(b); }); }
  const seg = document.getElementById('setDiff'); seg.innerHTML = ''; DIFF_ORDER.forEach(d => { const b = document.createElement('button'); b.textContent = d; if (difficulty === d) b.classList.add('on'); b.onclick = () => { difficulty = d; s.difficulty = d; SAVE.persist(); if (typeof setScale === 'function') setScale(); document.getElementById('diffBtn').textContent = d; renderSettings(); }; seg.appendChild(b); });
}
function openSettings() { Audio2.init(); applySettings(); renderSettings(); setSettingsTab('audio'); settingsModal.style.display = 'block'; syncBackdrop(); }
function closeSettings() { capturingAction = null; captureCb = null; settingsModal.style.display = 'none'; syncBackdrop(); }
document.getElementById('setBtn').onclick = openSettings;
document.getElementById('menuSettings').onclick = openSettings;
document.getElementById('settingsClose').onclick = closeSettings;
document.getElementById('setDone').onclick = closeSettings;
document.getElementById('setVol').oninput = e => { SAVE._data.settings.volume = +e.target.value; applySettings(); SAVE.persist(); };
function bindToggle(id, k, after) { document.getElementById(id).onclick = () => { const s = SAVE._data.settings; s[k] = !s[k]; SAVE.persist(); renderSettings(); if (after) after(s); }; }
bindToggle('setMusic', 'music', s => { if (s.music && !s.muted) MUSIC.start(); else MUSIC.stop(); });
bindToggle('setSfx', 'sfx'); bindToggle('setShake', 'shake'); bindToggle('setDmg', 'dmgnum');
/* Phase 2: graphics toggles flip the quality chip to Custom (set BEFORE persist+render so it sticks and shows immediately). */
function bindGfxToggle(id, k, after) { document.getElementById(id).onclick = () => { const s = SAVE._data.settings; s[k] = !s[k]; s.quality = 'custom'; SAVE.persist(); renderSettings(); if (after) after(s); }; }
bindGfxToggle('setShadows', 'shadows', () => applyGraphics());
bindGfxToggle('setPostfx', 'postfx', () => applyPostFX());
bindGfxToggle('setReflect', 'reflections', () => applyReflections());
bindGfxToggle('setSsao', 'ssao', () => applySSAO());
bindGfxToggle('setColorGrade', 'colorgrade', () => applyGrade());
bindGfxToggle('setVfx', 'vfx');
document.getElementById('setRes').oninput = e => { SAVE._data.settings.resScale = +e.target.value; SAVE._data.settings.quality = 'custom'; document.getElementById('setResVal').textContent = (+e.target.value) + '%'; SAVE.persist(); applyGraphics(); if (typeof sizeComposer === 'function') sizeComposer(); };
document.getElementById('setBloom').oninput = e => { SAVE._data.settings.bloom = (+e.target.value) / 100; SAVE._data.settings.quality = 'custom'; document.getElementById('setBloomVal').textContent = ((+e.target.value) / 100).toFixed(2); SAVE.persist(); applyPostFX(); };
document.getElementById('setExpo').oninput = e => { SAVE._data.settings.exposure = (+e.target.value) / 100; document.getElementById('setExpoVal').textContent = ((+e.target.value) / 100).toFixed(2); SAVE.persist(); applyPostFX(); };
/* ---------- settings tabs + controls (rebinding) ---------- */
function setSettingsTab(name) { document.querySelectorAll('#setTabs .tab').forEach(t => t.classList.toggle('on', t.dataset.stab === name)); document.querySelectorAll('#settingsModal .setPane').forEach(p => p.style.display = (p.dataset.pane === name) ? 'block' : 'none'); if (name === 'controls') renderControls(); if (name === 'loot') renderLootFilter(); if (name === 'saves') renderSavesIO(); }
/* ---------- save export / import ---------- */
function _saveIoMsg(t, ok) { const m = document.getElementById('saveIoMsg'); if (m) { m.textContent = t || ''; m.style.color = (ok === false) ? '#e07a5a' : (ok === true ? '#7ad08a' : '#7a6a4a'); } }
function renderSavesIO() { const ta = document.getElementById('saveExportText'); if (ta) ta.value = JSON.stringify(SAVE._data); _saveIoMsg(''); }
function downloadSave() { try { const blob = new Blob([JSON.stringify(SAVE._data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'); a.href = url; a.download = 'sanctuarys_end_save_' + ts + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); _saveIoMsg('Save file downloaded.', true); } catch (e) { _saveIoMsg('Download failed: ' + e.message, false); } }
function _fallbackCopy(text, done) { const ta = document.getElementById('saveExportText'); if (ta) { ta.value = text; ta.focus(); ta.select(); try { if (document.execCommand('copy')) { done(); return; } } catch (_) { } } _saveIoMsg('Select the export text and press Ctrl+C to copy.'); }
function copySave() { const data = JSON.stringify(SAVE._data); const done = () => _saveIoMsg('Copied to clipboard.', true); if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(data).then(done).catch(() => _fallbackCopy(data, done)); } else _fallbackCopy(data, done); }
/* Sanitize an imported save in place. Imported JSON is fully attacker-controlled, so before it is persisted
   we (a) drop any slot that isn't a plain character object — a non-object slot makes SAVE.load()'s migrate()
   throw at boot and brick the game — and (b) neutralize the only values that ever reach innerHTML from item
   data: name/base/effectDesc are HTML-escaped, slot/rarity are whitelisted to known keys, and the gem pouch
   is rebuilt from well-formed keys only (data-gem attribute injection). In-game item construction always uses
   safe constant tables, so import is the sole XSS vector for item strings. */
const _RARITY_OK = { common: 1, magic: 1, rare: 1, set: 1, unique: 1 };
function _sanitizeImportedItem(it) {
  if (!it || typeof it !== 'object' || Array.isArray(it)) return null;
  if (typeof it.name === 'string') it.name = escapeHtml(it.name);
  if (typeof it.base === 'string') it.base = escapeHtml(it.base);
  if (typeof it.effectDesc === 'string') it.effectDesc = escapeHtml(it.effectDesc);
  if (!SLOTS.includes(it.slot)) it.slot = 'weapon';
  if (!_RARITY_OK[it.rarity]) it.rarity = 'common';
  return it;
}
function _sanitizeImportedSlot(ch) {
  if (!ch || typeof ch !== 'object' || Array.isArray(ch)) return null;
  if (Array.isArray(ch.inventory)) ch.inventory = ch.inventory.map(_sanitizeImportedItem).filter(Boolean);
  if (Array.isArray(ch.stash)) ch.stash = ch.stash.map(_sanitizeImportedItem).filter(Boolean);
  if (ch.equipment && typeof ch.equipment === 'object') { for (const s in ch.equipment) ch.equipment[s] = ch.equipment[s] ? _sanitizeImportedItem(ch.equipment[s]) : null; }
  if (ch.gems && typeof ch.gems === 'object') { const g = {}; for (const k in ch.gems) { const p = String(k).split(':'), t = p[0], q = +p[1], n = +ch.gems[k]; if (GEMS[t] && q >= 0 && q <= 4 && Number.isFinite(n) && n > 0) g[t + ':' + q] = Math.floor(n); } ch.gems = g; }
  return ch;
}
function importSave() {
  const ta = document.getElementById('saveImportText'); const raw = ((ta && ta.value) || '').trim(); if (!raw) { _saveIoMsg('Paste save text or load a file first.', false); return; }
  let data; try { data = JSON.parse(raw); } catch (e) { _saveIoMsg('Invalid JSON: ' + e.message, false); return; }
  if (!data || typeof data !== 'object' || !Array.isArray(data.slots)) { _saveIoMsg('Not a valid Sanctuary save (missing "slots").', false); return; }
  data.slots = data.slots.map(_sanitizeImportedSlot);
  if (!confirm('Import will REPLACE all local characters and settings, then reload the game. Continue?')) return;
  try { localStorage.setItem(SAVE.KEY, JSON.stringify(data)); } catch (e) { _saveIoMsg('Could not write save: ' + e.message, false); return; }
  _saveIoMsg('Imported — reloading…', true); setTimeout(() => location.reload(), 450);
}
function renderLootFilter() {
  const host = document.getElementById('lootFilterBody'); if (!host) return; const lf = SAVE._data.settings.lootFilter; if (!lf) return;
  let h = `<div class="ptsNote">Pick up these rarities</div><div style="display:flex;flex-wrap:wrap;gap:10px;margin:6px 0 12px">`;
  for (const r of RARITY_LADDER) { h += `<label style="display:flex;align-items:center;gap:5px;cursor:pointer"><input type="checkbox" data-lr="${r}" ${lf.rarity[r] !== false ? 'checked' : ''}> <span class="rc-${r}">${RARITY_NAME[r]}</span></label>`; }
  h += `</div><div class="ptsNote">Pick up these slots</div><div style="display:flex;flex-wrap:wrap;gap:10px;margin:6px 0 12px">`;
  for (const s of SLOTS) { h += `<label style="display:flex;align-items:center;gap:5px;cursor:pointer"><input type="checkbox" data-ls="${s}" ${lf.slot[s] !== false ? 'checked' : ''}> <span>${SLOT_ICON[s]} ${s}</span></label>`; }
  h += `</div><div class="ptsNote">Minimum item level</div><div style="margin:6px 0"><input type="number" id="lootMinIlvl" min="0" value="${lf.minIlvl || 0}" style="width:80px"> <span style="color:#7a6a4a;font-size:12px">items below this are salvaged</span></div>`;
  host.innerHTML = h;
  host.querySelectorAll('[data-lr]').forEach(c => c.onchange = () => { lf.rarity[c.dataset.lr] = c.checked; SAVE.persist(); });
  host.querySelectorAll('[data-ls]').forEach(c => c.onchange = () => { lf.slot[c.dataset.ls] = c.checked; SAVE.persist(); });
  const mi = document.getElementById('lootMinIlvl'); if (mi) mi.onchange = () => { lf.minIlvl = Math.max(0, parseInt(mi.value) || 0); SAVE.persist(); };
}
document.querySelectorAll('#setTabs .tab').forEach(t => { t.onclick = () => setSettingsTab(t.dataset.stab); });
document.getElementById('saveDownload').onclick = downloadSave;
document.getElementById('saveCopy').onclick = copySave;
document.getElementById('saveImport').onclick = importSave;
document.getElementById('saveImportFile').onchange = e => { const f = e.target.files && e.target.files[0]; if (!f) { return; } const r = new FileReader(); r.onload = () => { const ta = document.getElementById('saveImportText'); if (ta) ta.value = String(r.result); _saveIoMsg('File loaded — click Import & Reload to apply.'); }; r.onerror = () => _saveIoMsg('Could not read that file.', false); r.readAsText(f); e.target.value = ''; };
function kbChips(a) { return (KEYBINDS[a] || []).map(k => `<span class="kbd">${keyLabel(k)}</span>`).join(' ') || '<span class="kbd" style="opacity:.5">—</span>'; }
function renderControls() {
  capturingAction = null; captureCb = null; const host = document.getElementById('ctrlList'); if (!host) return; let h = '';
  KEYBIND_ORDER.forEach(a => { h += `<div class="setRow"><label>${KEYBIND_LABELS[a]}</label><span class="ctrlKeys">${kbChips(a)}<button class="rbtn ctrlEdit" data-act="${a}">✎</button></span></div>`; });
  h += `<div class="setRow"><label style="color:#9a8a6a">Move / Basic Attack</label><span class="ctrlKeys"><span class="kbd">Left-click</span></span></div>`;
  h += `<div class="setRow"><label style="color:#9a8a6a">Cast (Right slot)</label><span class="ctrlKeys"><span class="kbd">Right-click</span></span></div>`;
  h += `<div class="setRow"><label style="color:#9a8a6a">Close / Cancel</label><span class="ctrlKeys"><span class="kbd">Esc</span></span></div>`;
  host.innerHTML = h; host.querySelectorAll('.ctrlEdit').forEach(b => { b.onclick = () => startCapture(b.dataset.act, b); });
}
function startCapture(a, btn) { if (capturingAction === a) { capturingAction = null; captureCb = null; renderControls(); return; } capturingAction = a; captureCb = onCaptureKey; document.querySelectorAll('.ctrlEdit').forEach(x => x.classList.remove('capturing')); if (btn) { btn.textContent = '…'; btn.classList.add('capturing'); } }
function onCaptureKey(e) {
  const k = normalizeKey(e); const a = capturingAction; capturingAction = null; captureCb = null;
  if (k === 'Escape') { renderControls(); return; }
  for (const b in KEYBINDS) { if (b !== a && KEYBINDS[b].indexOf(k) >= 0) { showMsg('"' + keyLabel(k) + '" already bound to ' + KEYBIND_LABELS[b]); renderControls(); return; } }
  if (!SAVE._data.settings.keybinds) SAVE._data.settings.keybinds = {}; SAVE._data.settings.keybinds[a] = [k]; buildKeybinds(); SAVE.persist(); renderControls(); renderHelpKeys(); updatePotionHint(); if (typeof renderSkillbar === 'function' && character) renderSkillbar(); showMsg(KEYBIND_LABELS[a] + ' → ' + keyLabel(k));
}
document.getElementById('ctrlReset').onclick = () => { SAVE._data.settings.keybinds = {}; buildKeybinds(); SAVE.persist(); renderControls(); renderHelpKeys(); updatePotionHint(); showMsg('Keybinds reset to defaults'); };
const HELP_KEY_MAP = { hkHp: 'hpPotion', hkMana: 'manaPotion', hkInteract: 'interact', hkTown: 'enterTown', hkMap: 'toggleMap', hkInv: 'toggleInv', hkSkill: 'toggleSkill', hkSound: 'toggleSound', hkClose: 'close' };
function renderHelpKeys() { for (const id in HELP_KEY_MAP) { const el = document.getElementById(id); if (el) el.textContent = (KEYBINDS[HELP_KEY_MAP[id]] || []).map(keyLabel).join(' / '); } const hs = document.getElementById('hkSkills'); if (hs) hs.textContent = ['skill1', 'skill2', 'skill3', 'skill4'].map(a => (KEYBINDS[a] || []).map(keyLabel)[0] || '—').join(' '); }
function updatePotionHint() { const el = document.getElementById('potKeys'); if (el) el.textContent = (KEYBINDS.hpPotion || []).map(keyLabel).join('/') + ' · ' + (KEYBINDS.manaPotion || []).map(keyLabel).join('/'); }
renderHelpKeys(); updatePotionHint();

// ---- multiplayer (co-op presence over WebSocket relay) ----
const NET = {
  ws: null, id: 0, connected: false, name: '', remotes: new Map(), sendT: 0,
  connect(host, port, name) {
    this.name = (name || 'Hero').slice(0, 14); if (!host) { this.status('Enter a host address'); return; }
    // Tear down any prior socket first, or a repeat Connect orphans it — its handlers keep firing and its
    // remote ghosts leak. Null the handlers before close() so the old socket's onclose can't clobber new state.
    if (this.ws) { try { this.ws.onopen = this.ws.onmessage = this.ws.onclose = this.ws.onerror = null; this.ws.close(); } catch (_) { } }
    this.clearRemotes(); this.connected = false;
    try { this.ws = new WebSocket('ws://' + host + ':' + (port || 8787)); } catch (e) { this.status('Invalid address'); return; }
    this.status('Connecting…');
    this.ws.onopen = () => { this.connected = true; this.status('Connected — adventuring together'); this.refreshUI(); };
    this.ws.onclose = () => { this.connected = false; this.clearRemotes(); this.status('Disconnected'); this.refreshUI(); };
    this.ws.onerror = () => { this.status('Connection failed (is the server running & port open?)'); };
    this.ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (_) { return; } this.onMsg(m); };
  },
  disconnect() { if (this.ws) { try { this.ws.close(); } catch (_) { } } this.ws = null; this.connected = false; this.clearRemotes(); this.refreshUI(); this.status('Not connected'); },
  send(o) { if (this.connected && this.ws && this.ws.readyState === 1) { try { this.ws.send(JSON.stringify(o)); } catch (_) { } } },
  onMsg(m) { if (m.t === 'welcome') { this.id = m.id; } else if (m.t === 'state') { this.upsert(m); } else if (m.t === 'leave') { this.removeRemote(m.id); } else if (m.t === 'chat') { this.chat(m.name, m.msg); } },
  upsert(m) {
    let r = this.remotes.get(m.id); if (!r) { const mesh = buildHero(); mesh.scale.set(0.96, 0.96, 0.96); mesh.visible = false; scene.add(mesh); r = { mesh }; this.remotes.set(m.id, r); }
    // Coerce every relayed field — the relay forwards peer payloads verbatim, so a NaN/string x/z/dir would
    // poison the scene-graph transform (and the projected nameplate), and an unknown class must not recolor.
    r.x = +m.x || 0; r.z = +m.z || 0; r.dir = +m.dir || 0; r.zone = m.zone; r.depth = +m.depth || 0; r.name = String(m.name || 'Player').slice(0, 24); r.cls = m.cls; r.level = +m.level || 1; r.hp = +m.hp || 0; r.hpMax = +m.hpMax || 1;
    if (r.mesh.userData.cloak && Object.prototype.hasOwnProperty.call(CLASSES, m.cls)) r.mesh.userData.cloak.material.color.setHex(CLASSES[m.cls].col);
  },
  removeRemote(id) { const r = this.remotes.get(id); if (r) { removeMesh(r.mesh); this.remotes.delete(id); } },
  clearRemotes() { for (const [, r] of this.remotes) removeMesh(r.mesh); this.remotes.clear(); },
  tick(dt) {
    if (!this.connected) return; this.sendT -= dt; if (this.sendT <= 0 && character && running) { this.sendT = 110; this.send({ t: 'state', x: +player.x.toFixed(2), z: +player.z.toFixed(2), dir: +player.dir.toFixed(2), zone, depth, name: this.name || character.name, cls: character.class, level: player.level, hp: Math.round(player.hp), hpMax: player.hpMax }); }
    for (const [, r] of this.remotes) { const vis = (running && r.zone === zone && r.depth === depth); r.mesh.visible = vis; if (vis) { r.mesh.position.set(r.x, Math.abs(Math.sin(now() * 0.005)) * 0.12, r.z); r.mesh.rotation.y = r.dir || 0; } }
  },
  status(s) { const el = document.getElementById('mpStatus'); if (el) el.textContent = s; },
  refreshUI() { const c = this.connected; document.getElementById('mpConnect').style.display = c ? 'none' : 'block'; document.getElementById('mpDisconnect').style.display = c ? 'block' : 'none'; document.getElementById('mpChatWrap').style.display = c ? 'block' : 'none'; },
  chat(name, msg) { const log = document.getElementById('mpChatLog'); if (log) { const d = document.createElement('div'); d.innerHTML = '<b style="color:#9fd8ff">' + escapeHtml(name) + ':</b> ' + escapeHtml(msg); log.appendChild(d); while (log.childNodes.length > 200) log.removeChild(log.firstChild); log.scrollTop = log.scrollHeight; } if (running) showMsg(name + ': ' + msg); }
};
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const mpModal = document.getElementById('mpModal');
function openMP() { document.getElementById('mpName').value = NET.name || (character ? character.name : ''); mpModal.style.display = 'block'; NET.refreshUI(); syncBackdrop(); }
function closeMP() { mpModal.style.display = 'none'; syncBackdrop(); }
document.getElementById('mpBtn').onclick = openMP;
document.getElementById('menuMP').onclick = openMP;
document.getElementById('mpClose').onclick = closeMP;
document.getElementById('mpConnect').onclick = () => NET.connect(document.getElementById('mpHost').value.trim(), document.getElementById('mpPort').value.trim(), document.getElementById('mpName').value.trim());
document.getElementById('mpDisconnect').onclick = () => NET.disconnect();
function mpSendChat() { const inp = document.getElementById('mpChatInput'); const v = inp.value.trim(); if (!v || !NET.connected) return; const nm = NET.name || (character ? character.name : 'Hero'); NET.send({ t: 'chat', name: nm, msg: v }); NET.chat(nm, v); inp.value = ''; }
document.getElementById('mpChatSend').onclick = mpSendChat;
document.getElementById('mpChatInput').addEventListener('keydown', e => { if (e.key === 'Enter') mpSendChat(); });

// ---- waypoint fast-travel ----
const wpModal = document.getElementById('wpModal');
function addWpRow(icon, name, sub, fn) { const d = document.createElement('div'); d.className = 'wprow'; d.innerHTML = `<div class="wic">${icon}</div><div class="winfo"><div class="wn">${name}</div><div class="ws">${sub}</div></div><div class="wbtn">Travel</div>`; d.querySelector('.wbtn').onclick = fn; document.getElementById('wpList').appendChild(d); }
// Depth picker: lets the player jump to ANY depth they've already reached (1..maxDepth), via quick chips,
// a clamped number input, or Enter. Never allows exceeding maxDepth, so it can't be used to skip ahead.
function addDepthRow() {
  const max = Math.max(1, (character && character.maxDepth) || 1); const d = document.createElement('div'); d.className = 'wprow';
  const bosses = []; for (let b = 5; b <= max; b += 5) bosses.push(b); const quick = [...new Set([1, ...bosses.slice(-3), max])].filter(n => n >= 1 && n <= max).sort((a, b) => a - b);
  let chips = ''; for (const n of quick) chips += `<span class="wbtn dpchip" data-d="${n}" style="padding:3px 9px;margin:0 4px 4px 0;display:inline-block">${n === max ? '★ ' : ''}${n}</span>`;
  d.innerHTML = `<div class="wic">⬇️</div><div class="winfo"><div class="wn">Jump to Depth</div><div class="ws">Travel to any depth you've reached (1–${max})</div><div style="margin-top:6px">${chips}</div></div><div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end"><input id="dpInput" type="number" min="1" max="${max}" value="${max}" style="width:66px;background:#0d0a06;border:1px solid #3a5a7a;color:#cfe2ff;border-radius:4px;padding:5px 6px;font-size:13px"><div class="wbtn" id="dpGo">Descend</div></div>`;
  document.getElementById('wpList').appendChild(d);
  const go = v => travelTo('descent', 'depth', clamp(Math.round(+v || 1), 1, max));
  d.querySelector('#dpGo').onclick = () => go(document.getElementById('dpInput').value);
  d.querySelector('#dpInput').onkeydown = e => { if (e.key === 'Enter') go(e.target.value); };
  d.querySelectorAll('.dpchip').forEach(el => { el.onclick = () => go(el.dataset.d); });
}
function renderWaypoints() {
  const list = document.getElementById('wpList'); list.innerHTML = '';
  for (const r of REGIONS) {
    const here = (zone === 'wild' && curRegion && curRegion.id === r.id);
    const disc = r.town === 'town' || (character && character.discovered && character.discovered[r.town]);
    if (!disc) { addWpRow('❓', r.name + ' — undiscovered', 'Press onward through the wilds to reach it', () => showMsg('Press deeper through the wilds to find ' + r.name)); continue; }
    addWpRow('🌲', r.name + (here ? ' (here)' : ''), 'Wilderness · Lv ' + r.lvl, () => travelTo(r.id));
  }
  for (const a of AREAS) {
    if (a.kind === 'wild') continue;
    if (a.kind === 'dungeon') { addWpRow('🕳️', 'The Descent — Depth 1', 'Dungeon entrance', () => travelTo('descent', 'start')); if (character && character.maxDepth > 1) { addWpRow('🔥', 'The Descent — Depth ' + character.maxDepth, 'Your deepest checkpoint', () => travelTo('descent', 'deep')); addDepthRow(); } continue; }
    if (character && character.discovered && !character.discovered[a.id]) { addWpRow('❓', a.name + ' — undiscovered', 'Find its portal out in the wilds', () => showMsg('Search the wilderness for ' + a.name)); continue; }
    const here = (zone === 'town' && curTownArea && curTownArea.id === a.id);
    const icon = a.tier >= 2 ? '🔥' : a.tier >= 1 ? '🏰' : '🏡'; const sub = a.tier >= 2 ? 'Endgame hub · exotic wares' : a.tier >= 1 ? 'Hub · premium wares' : 'Safe hub · merchant & stash';
    addWpRow(icon, a.name + (here ? ' (here)' : ''), sub, () => travelTo(a.id));
  }
}
function openWaypoints() { if (!running) return; renderWaypoints(); wpModal.style.display = 'block'; syncBackdrop(); }
function closeWaypoints() { wpModal.style.display = 'none'; syncBackdrop(); }
document.getElementById('wpBtn').onclick = openWaypoints;
document.getElementById('wpClose').onclick = closeWaypoints;
// Waypoint / Sound / Debug hotkeys handled by the unified keybind dispatcher above
addEventListener('beforeunload', () => { if (running) saveProgress(false); });
document.getElementById('backdrop').onclick = () => { if (wpModal && wpModal.style.display === 'block') closeWaypoints(); else if (mpModal && mpModal.style.display === 'block') closeMP(); else if (settingsModal && settingsModal.style.display === 'block') closeSettings(); else if (helpModal && helpModal.style.display === 'block') closeHelp(); };

/* ---- async GPU bootstrap (Phase 1b / R4) ----
   WebGPURenderer.init() is async; ALL GPU-dependent setup must run AFTER it resolves on BOTH backends (the WebGL2 fallback is
   just as uninitialized at parse time). So buildEnv (PMREM/env), applyPostFX + buildPipeline (RenderPipeline), the first shadow
   render, the first frame, and the menu loop are all gated behind init().then(...). renderer.backend (and isWebGPUBackend) does
   not exist to read until init resolves. Non-GPU DOM (slots, diff/sound labels) is fine to set synchronously. */
renderSlots();
document.getElementById('diffBtn').textContent = difficulty; document.getElementById('soundBtn').textContent = SAVE._data.settings.muted ? '🔇' : '🔊';
renderer.init().then(() => {
  isWebGPUBackend = !!(renderer.backend && renderer.backend.isWebGPUBackend); /* read ONCE, post-init; pre-init always reports WebGPU even on fallback. */
  _tsSupported = _perf && !!(renderer.hasFeature && renderer.hasFeature('timestamp-query')); /* Phase 0 rig: GPU timestamps only when perf mode AND the backend supports them (WebGL2 fallback often won't). */
  if (_perf) { _dbgOn = true; const _d = document.getElementById('dbg'); if (_d) _d.style.display = 'block'; } /* perf mode auto-shows the HUD */
  console.log('[Sanctuary] renderer backend:', isWebGPUBackend ? 'WebGPU' : 'WebGL2 (fallback)', _perf ? ('· perf rig ON, gpu-timestamps ' + (_tsSupported ? 'supported' : 'unavailable')) : '');
  _refreshAnisotropy();             /* re-resolve max anisotropy now that the backend is known (parse-time read may have been 1). */
  buildEnv();                       /* IBL env (PMREM via EnvironmentNode) - GPU-dependent. */
  resolveQuality(); SAVE.persist(); /* Phase 2: resolve the quality tier (Auto auto-downgrades on the WebGL2 fallback) before applying graphics. */
  applyAllGfx();                    /* applyGraphics + shadowSize + lights + buildPipeline + applyPostFX + reflections + grade (GPU-dependent — runs post-init). */
  placeCamera(player);
  if (renderer.shadowMap.enabled) moon.shadow.needsUpdate = true; /* render the moon shadow map on the first frame (sampler2DShadow placeholder fix; see menuLoop). */
  renderFrame();
  document.getElementById('loading').style.display = 'none';
  show('selectScreen'); startMenu();
}).catch(err => { console.error('[Sanctuary] renderer.init() failed:', err); document.getElementById('loading').textContent = 'Renderer init failed - see console. (WebGPU/WebGL2 unavailable?)'; });
