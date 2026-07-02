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
