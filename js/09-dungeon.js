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
