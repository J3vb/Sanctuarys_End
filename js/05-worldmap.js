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
