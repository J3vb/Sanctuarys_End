// ---- settings ----
/* ---------- Phase 2: quality presets + auto-downgrade ----------
   Bundle the existing graphics settings (+ new plMax/shadowSize knobs) into Low/Medium/High, plus Auto
   (resolve by backend — no low-end device to profile, so this is a design principle not a measured target)
   and Custom (manual). Big low-end levers: resolution, shadows, AO, reflections, light budget, shadow-map
   size. postfx/colorgrade/vfx stay on across tiers (cheap and core to the art style). */
const QUALITY_PRESETS = {
  low: { resScale: 70, shadows: false, ssao: false, reflections: false, bloom: 0.6, postfx: true, colorgrade: true, vfx: true, plMax: 4, shadowSize: 512, particles: false, groundTex: false },
  medium: { resScale: 90, shadows: true, ssao: false, reflections: true, bloom: 0.9, postfx: true, colorgrade: true, vfx: true, plMax: 7, shadowSize: 1024, particles: false, groundTex: true },
  high: { resScale: 100, shadows: true, ssao: true, reflections: true, bloom: 0.9, postfx: true, colorgrade: true, vfx: true, plMax: 9, shadowSize: 1024, particles: true, groundTex: true },
};
function autoTier() { return isWebGPUBackend ? 'high' : 'medium'; } /* WebGL2 fallback => Medium (conservative); WebGPU => High. (A GPU-time probe could refine later — deferred; no low-end device to calibrate against.) */
function applyLights() { const s = SAVE._data.settings; PL_MAX = (s.plMax != null ? s.plMax : 9); if (typeof cullLights === 'function') cullLights(); }
function applyShadowSize() { const s = SAVE._data.settings; const sz = (s.shadowSize === 512 || s.shadowSize === 2048) ? s.shadowSize : 1024; if (moon.shadow.mapSize.width !== sz) { moon.shadow.mapSize.set(sz, sz); if (moon.shadow.map) { moon.shadow.map.dispose(); moon.shadow.map = null; } moon.shadow.needsUpdate = true; } } /* resize requires disposing the existing depth target so it regenerates */
function applyAllGfx() { applyGraphics(); applyShadowSize(); applyLights(); if (typeof buildPipeline === 'function') buildPipeline(); applyPostFX(); applyReflections(); applyGrade(); if (typeof applyParticles === 'function') applyParticles(); if (typeof refreshGroundTex === 'function') refreshGroundTex(); }
/* Resolve s.quality into concrete settings. 'auto' re-resolves by backend each boot; 'custom' leaves the
   individual settings untouched. Returns the bundle applied (or null for custom). */
function resolveQuality() { const s = SAVE._data.settings; if (!s.quality) s.quality = 'auto'; if (s.quality === 'custom') return null; const tier = (s.quality === 'auto') ? autoTier() : s.quality; const p = QUALITY_PRESETS[tier]; if (p) Object.assign(s, p); return p || null; }
function setQuality(q) { SAVE._data.settings.quality = q; resolveQuality(); SAVE.persist(); applyAllGfx(); if (typeof renderSettings === 'function') renderSettings(); }
function markCustomQuality() { SAVE._data.settings.quality = 'custom'; } /* called when a graphics setting is changed by hand so the preset chip reflects reality */
const settingsModal = document.getElementById('settingsModal');
function applySettings() { const s = SAVE._data.settings; if (Audio2.master) Audio2.master.gain.value = (s.muted ? 0 : s.volume / 100); }
function renderSettings() {
  const s = SAVE._data.settings; document.getElementById('setVol').value = s.volume;
  [['setMusic', 'music'], ['setSfx', 'sfx'], ['setShake', 'shake'], ['setDmg', 'dmgnum'], ['setShadows', 'shadows'], ['setPostfx', 'postfx'], ['setReflect', 'reflections'], ['setSsao', 'ssao'], ['setColorGrade', 'colorgrade'], ['setVfx', 'vfx']].forEach(([id, k]) => document.getElementById(id).classList.toggle('on', s[k] !== false));
  document.getElementById('setRes').value = s.resScale || 100; document.getElementById('setResVal').textContent = (s.resScale || 100) + '%';
  const _bl = (s.bloom != null ? s.bloom : 0.9), _ex = (s.exposure != null ? s.exposure : 1.0); document.getElementById('setBloom').value = Math.round(_bl * 100); document.getElementById('setBloomVal').textContent = _bl.toFixed(2); document.getElementById('setExpo').value = Math.round(_ex * 100); document.getElementById('setExpoVal').textContent = _ex.toFixed(2);
  const qseg = document.getElementById('setQuality'); if (qseg) { qseg.innerHTML = ''; const aq = s.quality || 'auto'; const opts = ['low', 'medium', 'high', 'auto']; if (aq === 'custom') opts.push('custom'); opts.forEach(q => { const b = document.createElement('button'); b.textContent = q.charAt(0).toUpperCase() + q.slice(1); if (aq === q) b.classList.add('on'); if (q !== 'custom') b.onclick = () => setQuality(q); qseg.appendChild(b); }); }
  const seg = document.getElementById('setDiff'); seg.innerHTML = ''; DIFF_ORDER.forEach(d => { const b = document.createElement('button'); b.textContent = d; if (difficulty === d) b.classList.add('on'); b.onclick = () => { difficulty = d; s.difficulty = d; SAVE.persist(); if (typeof setScale === 'function') setScale(); document.getElementById('diffBtn').textContent = d; renderSettings(); }; seg.appendChild(b); });
}
function openSettings() { Audio2.init(); applySettings(); renderSettings(); setSettingsTab('audio'); settingsModal.style.display = 'block'; syncBackdrop(); }
function closeSettings() { capturingAction = null; captureCb = null; settingsModal.style.display = 'none'; syncBackdrop(); }
document.getElementById('setBtn').onclick = openSettings;
document.getElementById('menuSettings').onclick = openSettings;
document.getElementById('settingsClose').onclick = closeSettings;
document.getElementById('setDone').onclick = closeSettings;
document.getElementById('setVol').oninput = e => { SAVE._data.settings.volume = +e.target.value; applySettings(); SAVE.persist(); };
function bindToggle(id, k, after) { document.getElementById(id).onclick = () => { const s = SAVE._data.settings; s[k] = !s[k]; SAVE.persist(); renderSettings(); if (after) after(s); }; }
bindToggle('setMusic', 'music', s => { if (s.music && !s.muted) MUSIC.start(); else MUSIC.stop(); });
bindToggle('setSfx', 'sfx'); bindToggle('setShake', 'shake'); bindToggle('setDmg', 'dmgnum');
/* Phase 2: graphics toggles flip the quality chip to Custom (set BEFORE persist+render so it sticks and shows immediately). */
function bindGfxToggle(id, k, after) { document.getElementById(id).onclick = () => { const s = SAVE._data.settings; s[k] = !s[k]; s.quality = 'custom'; SAVE.persist(); renderSettings(); if (after) after(s); }; }
bindGfxToggle('setShadows', 'shadows', () => applyGraphics());
bindGfxToggle('setPostfx', 'postfx', () => applyPostFX());
bindGfxToggle('setReflect', 'reflections', () => applyReflections());
bindGfxToggle('setSsao', 'ssao', () => applySSAO());
bindGfxToggle('setColorGrade', 'colorgrade', () => applyGrade());
bindGfxToggle('setVfx', 'vfx');
document.getElementById('setRes').oninput = e => { SAVE._data.settings.resScale = +e.target.value; SAVE._data.settings.quality = 'custom'; document.getElementById('setResVal').textContent = (+e.target.value) + '%'; SAVE.persist(); applyGraphics(); if (typeof sizeComposer === 'function') sizeComposer(); };
document.getElementById('setBloom').oninput = e => { SAVE._data.settings.bloom = (+e.target.value) / 100; SAVE._data.settings.quality = 'custom'; document.getElementById('setBloomVal').textContent = ((+e.target.value) / 100).toFixed(2); SAVE.persist(); applyPostFX(); };
document.getElementById('setExpo').oninput = e => { SAVE._data.settings.exposure = (+e.target.value) / 100; document.getElementById('setExpoVal').textContent = ((+e.target.value) / 100).toFixed(2); SAVE.persist(); applyPostFX(); };
/* ---------- settings tabs + controls (rebinding) ---------- */
function setSettingsTab(name) { document.querySelectorAll('#setTabs .tab').forEach(t => t.classList.toggle('on', t.dataset.stab === name)); document.querySelectorAll('#settingsModal .setPane').forEach(p => p.style.display = (p.dataset.pane === name) ? 'block' : 'none'); if (name === 'controls') renderControls(); if (name === 'loot') renderLootFilter(); if (name === 'saves') renderSavesIO(); }
/* ---------- save export / import ---------- */
function _saveIoMsg(t, ok) { const m = document.getElementById('saveIoMsg'); if (m) { m.textContent = t || ''; m.style.color = (ok === false) ? '#e07a5a' : (ok === true ? '#7ad08a' : '#7a6a4a'); } }
function renderSavesIO() { const ta = document.getElementById('saveExportText'); if (ta) ta.value = JSON.stringify(SAVE._data); _saveIoMsg(''); }
function downloadSave() { try { const blob = new Blob([JSON.stringify(SAVE._data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'); a.href = url; a.download = 'sanctuarys_end_save_' + ts + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); _saveIoMsg('Save file downloaded.', true); } catch (e) { _saveIoMsg('Download failed: ' + e.message, false); } }
function _fallbackCopy(text, done) { const ta = document.getElementById('saveExportText'); if (ta) { ta.value = text; ta.focus(); ta.select(); try { if (document.execCommand('copy')) { done(); return; } } catch (_) { } } _saveIoMsg('Select the export text and press Ctrl+C to copy.'); }
function copySave() { const data = JSON.stringify(SAVE._data); const done = () => _saveIoMsg('Copied to clipboard.', true); if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(data).then(done).catch(() => _fallbackCopy(data, done)); } else _fallbackCopy(data, done); }
/* Sanitize an imported save in place. Imported JSON is fully attacker-controlled, so before it is persisted
   we (a) drop any slot that isn't a plain character object — a non-object slot makes SAVE.load()'s migrate()
   throw at boot and brick the game — and (b) neutralize the only values that ever reach innerHTML from item
   data: name/base/effectDesc are HTML-escaped, slot/rarity are whitelisted to known keys, and the gem pouch
   is rebuilt from well-formed keys only (data-gem attribute injection). In-game item construction always uses
   safe constant tables, so import is the sole XSS vector for item strings. */
const _RARITY_OK = { common: 1, magic: 1, rare: 1, set: 1, unique: 1 };
function _sanitizeImportedItem(it) {
  if (!it || typeof it !== 'object' || Array.isArray(it)) return null;
  if (typeof it.name === 'string') it.name = escapeHtml(it.name);
  if (typeof it.base === 'string') it.base = escapeHtml(it.base);
  if (typeof it.effectDesc === 'string') it.effectDesc = escapeHtml(it.effectDesc);
  if (!SLOTS.includes(it.slot)) it.slot = 'weapon';
  if (!_RARITY_OK[it.rarity]) it.rarity = 'common';
  return it;
}
function _sanitizeImportedSlot(ch) {
  if (!ch || typeof ch !== 'object' || Array.isArray(ch)) return null;
  if (Array.isArray(ch.inventory)) ch.inventory = ch.inventory.map(_sanitizeImportedItem).filter(Boolean);
  if (Array.isArray(ch.stash)) ch.stash = ch.stash.map(_sanitizeImportedItem).filter(Boolean);
  if (ch.equipment && typeof ch.equipment === 'object') { for (const s in ch.equipment) ch.equipment[s] = ch.equipment[s] ? _sanitizeImportedItem(ch.equipment[s]) : null; }
  if (ch.gems && typeof ch.gems === 'object') { const g = {}; for (const k in ch.gems) { const p = String(k).split(':'), t = p[0], q = +p[1], n = +ch.gems[k]; if (GEMS[t] && q >= 0 && q <= 4 && Number.isFinite(n) && n > 0) g[t + ':' + q] = Math.floor(n); } ch.gems = g; }
  return ch;
}
function importSave() {
  const ta = document.getElementById('saveImportText'); const raw = ((ta && ta.value) || '').trim(); if (!raw) { _saveIoMsg('Paste save text or load a file first.', false); return; }
  let data; try { data = JSON.parse(raw); } catch (e) { _saveIoMsg('Invalid JSON: ' + e.message, false); return; }
  if (!data || typeof data !== 'object' || !Array.isArray(data.slots)) { _saveIoMsg('Not a valid Sanctuary save (missing "slots").', false); return; }
  data.slots = data.slots.map(_sanitizeImportedSlot);
  if (!confirm('Import will REPLACE all local characters and settings, then reload the game. Continue?')) return;
  try { localStorage.setItem(SAVE.KEY, JSON.stringify(data)); } catch (e) { _saveIoMsg('Could not write save: ' + e.message, false); return; }
  _saveIoMsg('Imported — reloading…', true); setTimeout(() => location.reload(), 450);
}
function renderLootFilter() {
  const host = document.getElementById('lootFilterBody'); if (!host) return; const lf = SAVE._data.settings.lootFilter; if (!lf) return;
  let h = `<div class="ptsNote">Pick up these rarities</div><div style="display:flex;flex-wrap:wrap;gap:10px;margin:6px 0 12px">`;
  for (const r of RARITY_LADDER) { h += `<label style="display:flex;align-items:center;gap:5px;cursor:pointer"><input type="checkbox" data-lr="${r}" ${lf.rarity[r] !== false ? 'checked' : ''}> <span class="rc-${r}">${RARITY_NAME[r]}</span></label>`; }
  h += `</div><div class="ptsNote">Pick up these slots</div><div style="display:flex;flex-wrap:wrap;gap:10px;margin:6px 0 12px">`;
  for (const s of SLOTS) { h += `<label style="display:flex;align-items:center;gap:5px;cursor:pointer"><input type="checkbox" data-ls="${s}" ${lf.slot[s] !== false ? 'checked' : ''}> <span>${SLOT_ICON[s]} ${s}</span></label>`; }
  h += `</div><div class="ptsNote">Minimum item level</div><div style="margin:6px 0"><input type="number" id="lootMinIlvl" min="0" value="${lf.minIlvl || 0}" style="width:80px"> <span style="color:#7a6a4a;font-size:12px">items below this are salvaged</span></div>`;
  host.innerHTML = h;
  host.querySelectorAll('[data-lr]').forEach(c => c.onchange = () => { lf.rarity[c.dataset.lr] = c.checked; SAVE.persist(); });
  host.querySelectorAll('[data-ls]').forEach(c => c.onchange = () => { lf.slot[c.dataset.ls] = c.checked; SAVE.persist(); });
  const mi = document.getElementById('lootMinIlvl'); if (mi) mi.onchange = () => { lf.minIlvl = Math.max(0, parseInt(mi.value) || 0); SAVE.persist(); };
}
document.querySelectorAll('#setTabs .tab').forEach(t => { t.onclick = () => setSettingsTab(t.dataset.stab); });
document.getElementById('saveDownload').onclick = downloadSave;
document.getElementById('saveCopy').onclick = copySave;
document.getElementById('saveImport').onclick = importSave;
document.getElementById('saveImportFile').onchange = e => { const f = e.target.files && e.target.files[0]; if (!f) { return; } const r = new FileReader(); r.onload = () => { const ta = document.getElementById('saveImportText'); if (ta) ta.value = String(r.result); _saveIoMsg('File loaded — click Import & Reload to apply.'); }; r.onerror = () => _saveIoMsg('Could not read that file.', false); r.readAsText(f); e.target.value = ''; };
function kbChips(a) { return (KEYBINDS[a] || []).map(k => `<span class="kbd">${keyLabel(k)}</span>`).join(' ') || '<span class="kbd" style="opacity:.5">—</span>'; }
function renderControls() {
  capturingAction = null; captureCb = null; const host = document.getElementById('ctrlList'); if (!host) return; let h = '';
  KEYBIND_ORDER.forEach(a => { h += `<div class="setRow"><label>${KEYBIND_LABELS[a]}</label><span class="ctrlKeys">${kbChips(a)}<button class="rbtn ctrlEdit" data-act="${a}">✎</button></span></div>`; });
  h += `<div class="setRow"><label style="color:#9a8a6a">Move / Basic Attack</label><span class="ctrlKeys"><span class="kbd">Left-click</span></span></div>`;
  h += `<div class="setRow"><label style="color:#9a8a6a">Cast (Right slot)</label><span class="ctrlKeys"><span class="kbd">Right-click</span></span></div>`;
  h += `<div class="setRow"><label style="color:#9a8a6a">Close / Cancel</label><span class="ctrlKeys"><span class="kbd">Esc</span></span></div>`;
  host.innerHTML = h; host.querySelectorAll('.ctrlEdit').forEach(b => { b.onclick = () => startCapture(b.dataset.act, b); });
}
function startCapture(a, btn) { if (capturingAction === a) { capturingAction = null; captureCb = null; renderControls(); return; } capturingAction = a; captureCb = onCaptureKey; document.querySelectorAll('.ctrlEdit').forEach(x => x.classList.remove('capturing')); if (btn) { btn.textContent = '…'; btn.classList.add('capturing'); } }
function onCaptureKey(e) {
  const k = normalizeKey(e); const a = capturingAction; capturingAction = null; captureCb = null;
  if (k === 'Escape') { renderControls(); return; }
  for (const b in KEYBINDS) { if (b !== a && KEYBINDS[b].indexOf(k) >= 0) { showMsg('"' + keyLabel(k) + '" already bound to ' + KEYBIND_LABELS[b]); renderControls(); return; } }
  if (!SAVE._data.settings.keybinds) SAVE._data.settings.keybinds = {}; SAVE._data.settings.keybinds[a] = [k]; buildKeybinds(); SAVE.persist(); renderControls(); renderHelpKeys(); updatePotionHint(); if (typeof renderSkillbar === 'function' && character) renderSkillbar(); showMsg(KEYBIND_LABELS[a] + ' → ' + keyLabel(k));
}
document.getElementById('ctrlReset').onclick = () => { SAVE._data.settings.keybinds = {}; buildKeybinds(); SAVE.persist(); renderControls(); renderHelpKeys(); updatePotionHint(); showMsg('Keybinds reset to defaults'); };
const HELP_KEY_MAP = { hkHp: 'hpPotion', hkMana: 'manaPotion', hkInteract: 'interact', hkTown: 'enterTown', hkMap: 'toggleMap', hkInv: 'toggleInv', hkSkill: 'toggleSkill', hkSound: 'toggleSound', hkClose: 'close' };
function renderHelpKeys() { for (const id in HELP_KEY_MAP) { const el = document.getElementById(id); if (el) el.textContent = (KEYBINDS[HELP_KEY_MAP[id]] || []).map(keyLabel).join(' / '); } const hs = document.getElementById('hkSkills'); if (hs) hs.textContent = ['skill1', 'skill2', 'skill3', 'skill4'].map(a => (KEYBINDS[a] || []).map(keyLabel)[0] || '—').join(' '); }
function updatePotionHint() { const el = document.getElementById('potKeys'); if (el) el.textContent = (KEYBINDS.hpPotion || []).map(keyLabel).join('/') + ' · ' + (KEYBINDS.manaPotion || []).map(keyLabel).join('/'); }
renderHelpKeys(); updatePotionHint();

// ---- multiplayer (co-op presence over WebSocket relay) ----
