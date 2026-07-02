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
