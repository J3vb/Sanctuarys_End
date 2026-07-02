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
