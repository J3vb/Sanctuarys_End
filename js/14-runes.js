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
// canAllocRune lives here (not with the abilities UI) so it stays browser-free: it reads only
// SKILL_RUNES/character/player and is called at runtime by the UI, which loads later.
function canAllocRune(id, nid) {
  const tree = SKILL_RUNES[id]; if (!tree) return false; const node = tree.nodes[nid]; const alloc = (character.skillRunes && character.skillRunes[id]) || {};
  if ((alloc[nid] || 0) >= node.max) return false;
  if ((character.abilityPoints || 0) < node.cost) return false;
  if (player.level < (node.lvlreq || 0)) return false;
  if (nid !== tree.root && !tree.adj[nid].some(x => (alloc[x] || 0) > 0)) return false;
  if (node.excl) for (const o in tree.nodes) { if (o !== nid && tree.nodes[o].excl === node.excl && (alloc[o] || 0) > 0) return false; }
  return true;
}
