function _mkTex(cv, rx, ry) { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; /* Phase 2: these procedural canvases are albedo/color maps -> decode sRGB. Data maps (texGroundNormal) override back to NoColorSpace. */ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.anisotropy = _MAXANI; t.needsUpdate = true; return t; }
function _cobbleH(u, v) { u -= Math.floor(u); v -= Math.floor(v); const cell = 5, gx = u * cell, gy = v * cell, cx = Math.floor(gx), cy = Math.floor(gy), px = gx - cx - 0.5, py = gy - cy - 0.5, dist = Math.min(1, Math.hypot(px, py) * 2); let h = 1 - dist * dist; if (h < 0) h = 0; return h * (0.82 + 0.18 * _fbm(u, v, 3)); }
function texGround(rep) {
  const k = 'g' + (rep || 30); if (_texCache[k]) return _texCache[k];
  if (!_texCache._gcv) _texCache._gcv = _paint(256, (u, v) => { const h = _cobbleH(u, v), cx = Math.floor((((u % 1) + 1) % 1) * 5), cy = Math.floor((((v % 1) + 1) % 1) * 5), ps = _hash2(cx, cy, 2); let s = 0.7 + 0.28 * h + (ps - 0.5) * 0.12; s = Math.max(0, Math.min(1, s)); const g = s * 240; return [g, g * 0.97, g * 0.92]; });
  return _texCache[k] = _mkTex(_texCache._gcv, rep || 30, rep || 30);
}
function texGroundNormal(rep) {
  const k = 'gn' + (rep || 30); if (_texCache[k]) return _texCache[k];
  if (!_texCache._gncv) { const e = 1 / 256; _texCache._gncv = _paint(256, (u, v) => { const hl = _cobbleH(u - e, v), hr = _cobbleH(u + e, v), hd = _cobbleH(u, v - e), hu = _cobbleH(u, v + e), nx = (hl - hr) * 3, ny = (hd - hu) * 3, nz = 1, L = Math.hypot(nx, ny, nz); return [(nx / L * 0.5 + 0.5) * 255, (ny / L * 0.5 + 0.5) * 255, (nz / L * 0.5 + 0.5) * 255]; }); }
  const t = _mkTex(_texCache._gncv, rep || 30, rep || 30); t.colorSpace = THREE.NoColorSpace; /* Phase 2: normal map = linear data, NOT a color map. */ return _texCache[k] = t;
}
function texStone(rx, ry) {
  const k = 's' + (rx || 2) + 'x' + (ry || 2); if (_texCache[k]) return _texCache[k];
  if (!_texCache._scv) _texCache._scv = _paint(256, (u, v) => { const n = _fbm(u, v, 11), cr = _fbm(u, v, 23), crack = Math.abs(cr - 0.5) < 0.025 ? 0.55 : 1; let g = (0.64 + 0.34 * n) * crack; g = Math.max(0, Math.min(1, g)) * 235; return [g, g * 0.98, g * 0.94]; });
  return _texCache[k] = _mkTex(_texCache._scv, rx || 2, ry || 2);
}
function texWood(rx, ry) {
  const k = 'w' + (rx || 1) + 'x' + (ry || 2); if (_texCache[k]) return _texCache[k];
  if (!_texCache._wcv) _texCache._wcv = _paint(256, (u, v) => { const plank = Math.floor(v * 5), f = (v * 5) % 1, seam = (f < 0.05 || f > 0.95) ? 0.55 : 1, grain = _fbm(u, v, plank * 13 + 1); let g = (0.66 + 0.3 * grain) * seam; g = Math.max(0, Math.min(1, g)) * 230; return [g, g * 0.95, g * 0.9]; });
  return _texCache[k] = _mkTex(_texCache._wcv, rx || 1, ry || 2);
}
// detail textures for organics / glowing FX — glow ones are bright-biased so the glow survives the multiply
function texCloth(rx, ry) {
  const k = 'cl' + (rx || 2) + 'x' + (ry || 2); if (_texCache[k]) return _texCache[k];
  if (!_texCache._clcv) _texCache._clcv = _paint(128, (u, v) => { const tt = 16, a = Math.abs(Math.sin(u * Math.PI * tt)), b = Math.abs(Math.sin(v * Math.PI * tt)), w = Math.max(a, b); let g = 0.62 + 0.3 * w + 0.06 * _fbm(u, v, 61); g = Math.max(0, Math.min(1, g)) * 230; return [g, g * 0.99, g * 0.97]; });
  return _texCache[k] = _mkTex(_texCache._clcv, rx || 2, ry || 2);
}
function texMetal(rx, ry) {
  const k = 'mt' + (rx || 1) + 'x' + (ry || 3); if (_texCache[k]) return _texCache[k];
  if (!_texCache._mtcv) _texCache._mtcv = _paint(128, (u, v) => { let g = 0.74 + 0.18 * _tileNoise(u, v, 64, 5) + 0.06 * _fbm(u, v, 6); g = Math.max(0, Math.min(1, g)) * 245; return [g, g, g]; });
  return _texCache[k] = _mkTex(_texCache._mtcv, rx || 1, ry || 3);
}
function texSkin(rx, ry) {
  const k = 'sk' + (rx || 1) + 'x' + (ry || 1); if (_texCache[k]) return _texCache[k];
  if (!_texCache._skcv) _texCache._skcv = _paint(128, (u, v) => { let g = 0.85 + 0.12 * _fbm(u, v, 9); g = Math.max(0, Math.min(1, g)) * 235; return [g, g * 0.98, g * 0.95]; });
  return _texCache[k] = _mkTex(_texCache._skcv, rx || 1, ry || 1);
}
function texCrystal(rx, ry) {
  const k = 'cr' + (rx || 1) + 'x' + (ry || 1); if (_texCache[k]) return _texCache[k];
  if (!_texCache._crcv) _texCache._crcv = _paint(128, (u, v) => { const n = _fbm(u, v, 12), edge = Math.abs(_tileNoise(u, v, 6, 13) - 0.5) < 0.06 ? 0.72 : 1; let g = (0.8 + 0.2 * n) * edge; g = Math.max(0, Math.min(1, g)) * 245; return [g, g, g]; });
  return _texCache[k] = _mkTex(_texCache._crcv, rx || 1, ry || 1);
}
function texLava(rx, ry) {
  const k = 'lv' + (rx || 2) + 'x' + (ry || 2); if (_texCache[k]) return _texCache[k];
  if (!_texCache._lvcv) _texCache._lvcv = _paint(128, (u, v) => { const n = _fbm(u, v, 30), crust = Math.abs(_fbm(u, v, 31) - 0.5) < 0.06 ? 0.5 : 1; let g = (0.82 + 0.18 * n) * crust; g = Math.max(0, Math.min(1, g)) * 250; return [g, g * 0.92, g * 0.85]; });
  return _texCache[k] = _mkTex(_texCache._lvcv, rx || 2, ry || 2);
}
function texWater(rx, ry) {
  const k = 'wt' + (rx || 2) + 'x' + (ry || 2); if (_texCache[k]) return _texCache[k];
  if (!_texCache._wtcv) _texCache._wtcv = _paint(128, (u, v) => { let g = 0.82 + 0.16 * _fbm(u, v, 41) + 0.04 * Math.sin((u + v) * Math.PI * 8); g = Math.max(0, Math.min(1, g)) * 240; return [g * 0.95, g * 0.98, g]; });
  return _texCache[k] = _mkTex(_texCache._wtcv, rx || 2, ry || 2);
}
function texEnergy(rx, ry) {
  const k = 'en' + (rx || 2) + 'x' + (ry || 1); if (_texCache[k]) return _texCache[k];
  if (!_texCache._encv) _texCache._encv = _paint(128, (u, v) => { const tt = 10; let g = 0.7 + 0.3 * Math.abs(Math.sin((u + v) * Math.PI * tt)); g = Math.max(0, Math.min(1, g)) * 250; return [g, g, g]; });
  return _texCache[k] = _mkTex(_texCache._encv, rx || 2, ry || 1);
}
function texFlame(rx, ry) {
  const k = 'fl' + (rx || 1) + 'x' + (ry || 1); if (_texCache[k]) return _texCache[k];
  if (!_texCache._flcv) _texCache._flcv = _paint(128, (u, v) => { let g = 0.84 + 0.16 * _fbm(u, v, 50); g = Math.max(0, Math.min(1, g)) * 252; return [g, g, g]; });
  return _texCache[k] = _mkTex(_texCache._flcv, rx || 1, ry || 1);
}
function texSpots(rx, ry) {
  const k = 'sp' + (rx || 1) + 'x' + (ry || 1); if (_texCache[k]) return _texCache[k];
  if (!_texCache._spcv) _texCache._spcv = _paint(128, (u, v) => { const cell = 5, gx = u * cell, gy = v * cell, cx = Math.floor(gx), cy = Math.floor(gy), px = gx - cx - 0.5, py = gy - cy - 0.5, d = Math.hypot(px, py); let g = (d < 0.26 ? 1.0 : 0.72); g = Math.max(0, Math.min(1, g)) * 245; return [g, g, g]; });
  return _texCache[k] = _mkTex(_texCache._spcv, rx || 1, ry || 1);
}
