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
