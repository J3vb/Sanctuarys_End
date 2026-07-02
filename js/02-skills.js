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
