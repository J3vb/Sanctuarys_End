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
