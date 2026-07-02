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
