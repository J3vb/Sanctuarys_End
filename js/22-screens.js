function show(id) { ['selectScreen', 'createScreen', 'overScreen'].forEach(s => document.getElementById(s).style.display = 'none'); if (id) document.getElementById(id).style.display = 'flex'; }
function setHud(on) { document.getElementById('hud').style.display = on ? 'block' : 'none'; document.getElementById('topbar').style.display = on ? 'flex' : 'none'; document.getElementById('xpbar').style.display = on ? 'block' : 'none'; document.getElementById('minimap').style.display = on ? 'block' : 'none'; document.getElementById('prompt').style.display = 'none'; document.getElementById('bossBar').style.display = 'none'; if (!on) closeAll(); }
function enterGame() {
  invalidateRunes(); /* rune struct cache is keyed on the live `character`; clear it on every character switch so a newly loaded hero can't inherit the previous one's cached rune bonuses */
  stopMenu(); Object.assign(player, { level: character.level, xp: character.xp, xpNext: character.xpNext, gold: character.gold, kills: character.kills, potions: character.hpPotions, hpPotions: character.hpPotions, mpPotions: character.mpPotions, attackCd: 0, bob: 0 });
  recompute(); syncActives(); player.hp = player.hpMax; player.mp = player.mpMax;
  charName.textContent = character.name; setLevelText(player.level); killsTxt.textContent = 'Slain: ' + player.kills; goldTxt.textContent = player.gold + ' g';
  hero.userData.cloak.material.color.setHex((CLASSES[character.class] || CLASSES.warrior).col);
  swapHeroToGLB(); /* re-pick hero mesh by class — roster loaded on the title screen before a class was chosen, so the per-class swap must fire again here */
  show(null); setHud(true);
  if (!Array.isArray(character.loadout) || character.loadout.length !== 6) character.loadout = defaultLoadout(character);
  if (!character.activeSkillId && character.loadout[1]) character.activeSkillId = character.loadout[1];
  renderSkillbar(); updateGlobes(); updatePips(); saveTimer = 8000; enterTown(); applyGraphics(); running = true; last = now(); loop();
  Audio2.init(); Audio2.muted = SAVE._data.settings.muted; applySettings(); document.getElementById('soundBtn').textContent = Audio2.muted ? '🔇' : '🔊'; if (!Audio2.muted) MUSIC.start();
  try { if (!localStorage.getItem('sanctuary_helpseen')) { openHelp(); localStorage.setItem('sanctuary_helpseen', '1'); } } catch (_) { }
}
function gameOver() { running = false; saveProgress(false); show('overScreen'); document.getElementById('overTitle').textContent = 'YOU DIED'; document.getElementById('overStats').textContent = `${character.name} — Level ${player.level} • Slain ${player.kills} • Deepest Depth ${character.maxDepth}`; setHud(false); startMenu(); }

function renderSlots() {
  const wrap = document.getElementById('slots'); wrap.innerHTML = '';
  for (let i = 0; i < SAVE.NUM_SLOTS; i++) {
    const ch = SAVE.getSlot(i); const div = document.createElement('div'); div.className = 'slot';
    if (ch) { div.innerHTML = `<div class="info"><div class="cname">${escapeHtml(ch.name)}</div><div class="cmeta">${(CLASSES[ch.class] || CLASSES.warrior).name} • Level ${ch.level} • depth ${ch.maxDepth || 0}</div></div><div class="del" data-del="${i}">Delete</div>`; div.onclick = e => { if (e.target.dataset.del !== undefined) return; currentSlot = i; character = ch; enterGame(); }; }
    else { div.innerHTML = `<div class="info"><div class="empty">Empty Slot ${i + 1}</div></div><div class="cname">+ New</div>`; div.onclick = () => { pendingSlot = i; selectedClass = 'warrior'; renderClassPick(); show('createScreen'); document.getElementById('nameInput').value = ''; document.getElementById('nameInput').focus(); }; }
    wrap.appendChild(div);
  }
  wrap.querySelectorAll('[data-del]').forEach(b => b.onclick = e => { e.stopPropagation(); if (confirm('Delete this hero permanently?')) { SAVE.deleteSlot(+b.dataset.del); renderSlots(); } });
}
let pendingSlot = null, selectedClass = 'warrior';
function renderClassPick() { const wrap = document.getElementById('classPick'); wrap.innerHTML = ''; for (const id in CLASSES) { const c = CLASSES[id]; const d = document.createElement('div'); d.className = 'classCard' + (id === selectedClass ? ' sel' : ''); d.innerHTML = `<div class="cn">${c.name}</div><div class="cb">${c.blurb}</div>`; d.onclick = () => { selectedClass = id; renderClassPick(); }; wrap.appendChild(d); } }
document.getElementById('createBtn').onclick = () => { const name = (document.getElementById('nameInput').value || '').trim() || 'Wanderer'; character = SAVE.newCharacter(name, selectedClass); currentSlot = pendingSlot; SAVE.saveCharacter(currentSlot, character); enterGame(); };
document.getElementById('nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('createBtn').click(); });
document.getElementById('backBtn').onclick = () => { renderSlots(); show('selectScreen'); startMenu(); };
document.getElementById('reviveBtn').onclick = () => { enterGame(); };
document.getElementById('quitBtn').onclick = () => { renderSlots(); show('selectScreen'); startMenu(); };
document.getElementById('saveBtn').onclick = () => { saveProgress(true); running = false; setHud(false); renderSlots(); show('selectScreen'); startMenu(); };
document.getElementById('invBtn').onclick = () => toggleInv(); document.getElementById('invClose').onclick = () => toggleInv();
document.getElementById('skillBtn').onclick = () => toggleSkill(); document.getElementById('skillClose').onclick = () => toggleSkill();
document.querySelectorAll('#skillTabs .tab').forEach(t => t.onclick = () => setSkillTab(t.dataset.sktab));
document.getElementById('vendorClose').onclick = () => closeAll(); document.getElementById('stashClose').onclick = () => closeAll(); document.getElementById('smithClose').onclick = () => closeAll(); document.getElementById('enchantClose').onclick = () => closeAll(); document.getElementById('gambleClose').onclick = () => closeAll(); document.getElementById('jewelerClose').onclick = () => closeAll(); document.getElementById('alchemistClose').onclick = () => closeAll();
document.getElementById('townBtn').onclick = () => { if (zone !== 'town') enterTown(); };
document.getElementById('diffBtn').onclick = () => { const order = DIFF_ORDER; difficulty = order[(order.indexOf(difficulty) + 1) % order.length]; SAVE._data.settings.difficulty = difficulty; SAVE.persist(); document.getElementById('diffBtn').textContent = difficulty; setScale(); showMsg('Difficulty: ' + difficulty); };
function toggleSound() { Audio2.init(); Audio2.muted = !Audio2.muted; SAVE._data.settings.muted = Audio2.muted; SAVE.persist(); document.getElementById('soundBtn').textContent = Audio2.muted ? '🔇' : '🔊'; if (Audio2.muted) MUSIC.stop(); else MUSIC.start(); }
document.getElementById('soundBtn').onclick = toggleSound;
const helpModal = document.getElementById('helpModal');
function openHelp() { helpModal.style.display = 'block'; syncBackdrop(); }
function closeHelp() { helpModal.style.display = 'none'; syncBackdrop(); }
document.getElementById('helpBtn').onclick = openHelp;
document.getElementById('helpClose').onclick = closeHelp;
document.getElementById('helpGo').onclick = closeHelp;
document.getElementById('ptRecenter').onclick = () => { if (character && typeof PTREE !== 'undefined') { const s = PTREE.nodes[PTREE.starts[character.class]]; ptT = { x: -s.x, y: -s.y, s: 1.1 }; applyPT(); } };
// Escape / Help handled by the unified keybind dispatcher above

// ---- living main-menu scene ----
let menuActive = false, menuRAF = null, menuT = 0, _menuShadowDirty = true;
function startMenu() { if (menuActive) return; menuActive = true; _menuShadowDirty = true; try { townGroup.visible = true; wildGroup.visible = false; dungeonGroup.visible = false; } catch (_) { } menuLoop(); }
function stopMenu() { menuActive = false; if (menuRAF) { cancelAnimationFrame(menuRAF); menuRAF = null; } }
/* The menu scene is static (only the camera orbits), so the moon shadow map only needs re-rendering while the
   roster is still streaming in (!GLB_READY, swaps happening) plus one final pass after any scenery rebuild —
   not every frame. This still satisfies the one-shot refresh that keeps the sampler2DShadow from sampling an
   unrendered placeholder (the reason it was per-frame). */
function menuLoop() { if (!menuActive) return; menuT += 0.0032; const r = 44; camera.position.set(Math.sin(menuT) * r, 30, Math.cos(menuT) * r + 6); camera.lookAt(0, 2, -2); if (renderer.shadowMap.enabled && (_menuShadowDirty || !GLB_READY)) { moon.shadow.needsUpdate = true; _menuShadowDirty = false; } renderFrame(); menuRAF = requestAnimationFrame(menuLoop); }
