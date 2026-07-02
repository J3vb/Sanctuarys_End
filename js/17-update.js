function update(dt) {
  const T = now(); /* Phase 1: one frame timestamp reused for all same-frame sine anims + time-gates below (was ~30-60 performance.now() calls/frame) */
  const fr = dt * 60 / 1000; /* elapsed time in 60ths-of-a-second. Frame-count timers (atkCd/slow/life/…) are decremented by `fr` instead of 1 so their reset constants stay tuned to 60fps while ticking in real time — enemy DPS and projectile range no longer scale with the player's refresh rate. */
  shake *= 0.85;
  if (running && !busyPanel()) {
    if (rmbDown && isCombat() && !player.stunned) { const hid = character.loadout[1], hd = SKILLDEFS[hid]; if (hd && hd.kind !== 'melee' && player.mp >= Math.round(hd.cost * resolveSkill(hid).costMult)) castActive(hid, { x: mouseWorld.x, z: mouseWorld.z }); }
    if (lmbDown) {
      const hm = isCombat() ? monsterAt() : null; if (hm) { target = hm; moveTarget = null; }
      else if (Math.hypot(mouseWorld.x - player.x, mouseWorld.z - player.z) > 1.0) { moveTarget = { x: mouseWorld.x, z: mouseWorld.z }; target = null; } else { target = null; }
    }
  }
  if (isCombat()) {
    if (player.stunned) { /* stunned: cannot move or attack */ }
    else if (target) {
      const d = Math.hypot(target.x - player.x, target.z - player.z); const reach = player.range + (target.r || 0); if (d > reach) moveToward(target.x, target.z, dt);
      else { player.dir = Math.atan2(target.x - player.x, target.z - player.z); if (T - player.attackCd > player.attackRate) { player.attackCd = T; player.swing = T; hitMonster(target, player); } }
    }
    else if (moveTarget) { moveToward(moveTarget.x, moveTarget.z, dt); if (Math.hypot(moveTarget.x - player.x, moveTarget.z - player.z) < 0.5) moveTarget = null; }
  } else { if (moveTarget) { moveToward(moveTarget.x, moveTarget.z, dt); if (Math.hypot(moveTarget.x - player.x, moveTarget.z - player.z) < 0.5) moveTarget = null; } }
  if (running && shopAnchor && Math.hypot(player.x - shopAnchor.x, player.z - shopAnchor.z) > 7) closeAll();
  player.mp = Math.min(player.mpMax, player.mp + dt * player.mpRegen);
  if (player.hpRegen > 0 && player.hp > 0 && player.hp < player.hpMax) player.hp = Math.min(player.hpMax, player.hp + dt * player.hpRegen);
  if (running) tickStatuses(player, dt, true);
  /* each wild is now a single-biome bounded map (no walk-between-biomes) — region is fixed on entry by enterWild */

  if (isCombat()) for (const m of monsters) {
    if (m.hp <= 0) continue; if (m.flash > 0) m.flash -= fr; tickStatuses(m, dt, false); if (m.hp <= 0) continue; if (player.effects.chillaura && Math.hypot(m.x - player.x, m.z - player.z) < 14 && m.slow < 12) m.slow = 12; const sp = m.speed * (m.speedMult || 1) * Math.min(m.slow > 0 ? 0.45 : 1, m.chilled ? 0.5 : 1) * 60 * dt / 1000; if (m.slow > 0) m.slow -= fr; const d = Math.hypot(m.x - player.x, m.z - player.z);
    if (m.flee) { m.ttl -= dt; if (m.ttl <= 0) { removeMob(m.mesh); monsters = monsters.filter(x => x !== m); if (target === m) target = null; showMsg('The goblin escaped!'); continue; } } // escape: clean vanish (no death anim), drops NOTHING (must not route through killMonster)
    if (!m.stunned) {
      if (m.elite && m.elite.includes('arcane')) { m.arcaneCd -= fr; if (m.arcaneCd <= 0 && d < 55) { m.arcaneCd = 90; const a = Math.atan2(player.x - m.x, player.z - m.z); const pm = makeOrb(m.x, 2, m.z, 0xc06aff, 0.5); scene.add(pm); projectiles.push({ x: m.x, z: m.z, vx: Math.sin(a) * 0.5, vz: Math.cos(a) * 0.5, dmg: m.dmg, kind: 'enemy', life: 150, mesh: pm, mods: m.elite }); } }
      if (m.flee) { stepEnt(m, 2 * m.x - player.x, 2 * m.z - player.z, sp); } else if (m.boss) { bossAI(m, dt, d, sp); } else if (m.ranged) {
        if (d > 34) stepEnt(m, player.x, player.z, sp); else if (d < 20) stepEnt(m, m.x - (player.x - m.x), m.z - (player.z - m.z), sp);
        m.atkCd -= fr; if (d < 42 && m.atkCd <= 0) { m.atkCd = 110; const a = Math.atan2(player.x - m.x, player.z - m.z); const mesh = makeOrb(m.x, 2, m.z, 0xb06aff, 0.45); scene.add(mesh); projectiles.push({ x: m.x, z: m.z, vx: Math.sin(a) * 0.55, vz: Math.cos(a) * 0.55, dmg: m.dmg, kind: 'enemy', life: 150, mesh }); }
      }
      else { if (d > m.r + player.r - 0.4) stepEnt(m, player.x, player.z, sp); else { m.atkCd -= fr; if (m.atkCd <= 0) { m.atkCd = 60; damagePlayer(m.dmg, m.elite); if (player.effects.thorns > 0) { m.hp -= player.effects.thorns; m.flash = 8; if (m.hp <= 0) killMonster(m); } } } }
    }
    resolveCircles(m, m.r, activeColliders(), 1); { const dx = m.x - player.x, dz = m.z - player.z; let d = Math.hypot(dx, dz); const min = m.r + player.r; if (d < min && d > 0.0001) { m.x += dx / d * (min - d); m.z += dz / d * (min - d); } } clampEntToZone(m);
    m.mesh.position.set(m.x, m.mesh.userData.glb ? 0 : Math.abs(Math.sin(T * 0.004 + m.bob)) * 0.3, m.z); m.mesh.lookAt(player.x, m.mesh.position.y, player.z); if (m.mesh.userData.body) m.mesh.userData.body.material.emissive.setHex(m.flash > 0 ? 0x884400 : 0x000000); if (m.mesh.userData.mixer) m.mesh.userData.mixer.update(dt * 0.001); if (m.mesh.userData.aura) { m.mesh.userData.aura.rotation.z += 0.05; const s2 = 1 + Math.sin(T * 0.006) * 0.12; m.mesh.userData.aura.scale.set(s2, s2, s2); }
  }

  for (const p of projectiles) {
    if (p.homing && monsters.length) { let hb = null, hd = 1e9; for (const m of monsters) { const d = Math.hypot(m.x - p.x, m.z - p.z); if (d < hd) { hd = d; hb = m; } } if (hb) { const sp = Math.hypot(p.vx, p.vz) || 0.8, ca = Math.atan2(p.vx, p.vz), rel = Math.atan2(hb.x - p.x, hb.z - p.z) - ca, da = Math.atan2(Math.sin(rel), Math.cos(rel)), na = ca + clamp(da, -0.09, 0.09); p.vx = Math.sin(na) * sp; p.vz = Math.cos(na) * sp; } }
    p.x += p.vx * 60 * dt / 1000; p.z += p.vz * 60 * dt / 1000; p.life -= fr; p.mesh.position.set(p.x, 2, p.z);
    if (p.kind === 'enemy') { if (Math.hypot(p.x - player.x, p.z - player.z) < player.r + 0.6) { damagePlayer(p.dmg, p.mods); if (p.chill) applyStatus(player, 'chill', 1400, 0); p.life = 0; } }
    else { for (const m of monsters) { if (Math.hypot(p.x - m.x, p.z - m.z) < m.r + 0.6) { if (p.hit && p.hit.has(m)) continue; hitMonsterProj(m, p.dmg, p.kind); if (m.hp > 0) { if (p.kind === 'frost') m.slow = p.slow; if (p.onHit) applyOnHit(m, p.onHit, p.dmg); if (p.freeze) applyStatus(m, 'chill', 1500, 0); if (p.knockback) { const a = Math.atan2(m.x - p.x, m.z - p.z); m.x += Math.sin(a) * 2.2; m.z += Math.cos(a) * 2.2; } } if (p.vampiric) player.hp = Math.min(player.hpMax, player.hp + p.dmg * 0.12); projBurst(p); if (p.hit) p.hit.add(m); if (p.pierce && p.pierce > 0) { p.pierce--; } else { p.life = 0; break; } } } }
    if (Math.abs(p.x) > MAP || Math.abs(p.z) > MAP) p.life = 0;
  }
  _compact(projectiles, _deadLife0, _killMesh);
  for (const e of fx) {
    e.life -= fr;
    if (e.life0) { const t = Math.max(0, e.life / e.life0); if (e.vx != null) { const k = dt * 0.001; e.mesh.position.x += e.vx * k; e.mesh.position.y += e.vy * k; e.mesh.position.z += e.vz * k; e.vy -= e.grav * k; if (e.spin) { e.mesh.rotation.x += e.spin; e.mesh.rotation.z += e.spin * 0.8; } } e.mesh.scale.setScalar(e.scale0 * t); }
    else if (e.mesh.material) { e.mesh.material.opacity = e.life / 14; }
  }
  _compact(fx, _deadLife0, _killMesh);
  for (let i = _dying.length - 1; i >= 0; i--) { const d = _dying[i]; if (d.g.userData.mixer) d.g.userData.mixer.update(dt * 0.001); d.t -= dt; if (d.t <= 0) { if (d.g.userData.mixer) d.g.userData.mixer.stopAllAction(); removeMesh(d.g); _dying.splice(i, 1); } }

  for (const l of loots) {
    l.t += dt * 0.005; l.icon.position.y = 1 + Math.sin(l.t) * 0.25; l.icon.rotation.y += 0.04; if (l.ring) { l.ring.rotation.z += 0.02; const ps = 1 + Math.sin(l.t * 1.4) * 0.12; l.ring.scale.set(ps, ps, ps); } if (l.beam && l.tier >= 4) l.beam.material.opacity = 0.4 + Math.sin(l.t * 2) * 0.12; if (Math.hypot(l.x - player.x, l.z - player.z) < player.r + 1.4) {
      if (l.kind === 'gold') { player.gold += l.payload; goldTxt.textContent = player.gold + ' g'; floatText(l.payload + 'g', player.x, player.z, '#ffe27a'); sfx('gold'); l.dead = true; }
      else if (l.kind === 'potion') { player.hpPotions = Math.min(character.potionCap, player.hpPotions + 1); floatText('+Potion', player.x, player.z, '#ff6b5b'); l.dead = true; }
      else if (l.kind === 'manapotion') { player.mpPotions = Math.min(character.potionCap, player.mpPotions + 1); floatText('+Mana', player.x, player.z, '#5a9bff'); l.dead = true; }
      else if (l.kind === 'gem') { const k = l.payload.t + ':' + l.payload.q; character.gems = character.gems || {}; character.gems[k] = (character.gems[k] || 0) + 1; floatText('+' + gemName(l.payload), player.x, player.z, '#9fe8ff'); sfx('gold'); l.dead = true; if (invOpen) renderInv(); }
      else { const lf = SAVE._data && SAVE._data.settings && SAVE._data.settings.lootFilter; if (lf && !lootPasses(lf, l.payload)) { const g = sellValue(l.payload), du = dustValue(l.payload); player.gold += g; character.materials = (character.materials || 0) + du; goldTxt.textContent = player.gold + ' g'; floatText('+' + g + 'g · +' + du + '✦', player.x, player.z, '#caa84a'); l.dead = true; } else if (character.inventory.length < character.invMax) { character.inventory.push(l.payload); floatText(l.payload.name, player.x, player.z, '#' + RCOL[l.payload.rarity].toString(16).padStart(6, '0')); l.dead = true; if (invOpen) renderInv(); updatePips(); } else if (T - _bagFullAt > 2500) { _bagFullAt = T; floatText('Bag full!', player.x, player.z, '#ff8'); } }
    }
  }
  _compact(loots, _deadFlag, _killMesh);

  for (const f of floats) { f.y += dt * 0.002; f.life -= fr; } _compact(floats, _deadLife0, null);

  hero.position.set(player.x, Math.abs(Math.sin(player.bob)) * 0.15, player.z); hero.rotation.y = player.dir;
  const sw = clamp((T - player.swing) / 150, 0, 1); if (hero.userData.sword) hero.userData.sword.rotation.z = sw < 1 ? (-1.4 + sw * 2.4) : -0.2;
  if (hero.userData.mixer) { hero.userData.mixer.update(dt * 0.001); const _mv = (player._px !== undefined) && (Math.hypot(player.x - player._px, player.z - player._pz) > 0.03); if ((T - player.swing) < 300) glbPlay(hero, 'attack', true); else glbPlay(hero, _mv ? 'walk' : 'idle'); player._px = player.x; player._pz = player.z; }
  const activeFires = zone === 'town' ? townFires : zone === 'wild' ? wildFires : dungeonFires;
  for (const f of activeFires) { f.light.intensity = f.base + Math.sin(T * 0.02 + f.x) * 1.26; f.flame.scale.y = 1 + Math.sin(T * 0.03 + f.z) * 0.15; f.flame.rotation.y += 0.03; } /* Phase 1a: flicker amplitude scaled by ~Math.PI (0.4->1.26); f.base already scales with the x-pi construction intensity. */
  for (const c of waypointMarks) { c.rotation.y += 0.03; c.position.y = 5.4 + Math.sin(T * 0.003) * 0.18; }
  if (zone === 'wild') { wpTown.ring.rotation.z += 0.02; wpCave.ring.rotation.z += 0.02; if (wpNext.group.visible) wpNext.ring.rotation.z += 0.02; if (wpPrev.group.visible) wpPrev.ring.rotation.z += 0.02; }
  else if (zone === 'town') { t_wildPortal.ring.rotation.z += 0.02; for (const n of npcs) { n.group.userData.marker.rotation.y += 0.04; n.group.userData.marker.position.y = 4.6 + Math.sin(T * 0.004) * 0.2; if (n.group.userData.npcEnt) n.group.userData.npcEnt.userData.mixer.update(dt * 0.001); } for (const v of townVillagers) { if (v.userData.mixer) v.userData.mixer.update(dt * 0.001); } if (t_cauldron) { t_cauldron.marker.rotation.y += 0.05; t_cauldron.marker.position.y = 3.4 + Math.sin(T * 0.004) * 0.22; t_cauldron.brew.position.y = 2.02 + Math.sin(T * 0.008) * 0.05; } }
  else if (d_deeperPortal) { d_deeperPortal.ring.rotation.z += 0.02; }
  torch.position.set(player.x, 9, player.z); playerGlow.position.set(player.x, 14, player.z); updateAmbient(dt); if (typeof NET !== 'undefined') NET.tick(dt);

  if (isCombat() && !bossActive) { waveTimer -= dt; if (_spawnQueue.length === 0 && monsters.length < MOB_CAP && (waveTimer <= 0 || monsters.length < 3)) { spawnWave(); waveTimer = 4200; } drainSpawns(dt); }
  saveTimer -= dt; if (saveTimer <= 0) { saveTimer = 8000; saveProgress(false); }

  const o = nearest(); const pr = promptEl;
  if (o && !anyPanel()) {
    const lbl = (o.kind === 'deeper') ? ('descend deeper (Depth ' + (depth + 1) + ')') : (o.kind === 'towngate') ? ('enter ' + ((AREAS.find(a => a.id === o.area) || {}).name || 'the town')) : (o.kind === 'wildnext' || o.kind === 'wildprev') ? ('travel to ' + ((wildById(o.to) || {}).name || 'the wilds')) : PROMPT_LABELS[o.kind];
    const html = `Press <b>E</b> to ${lbl}`; if (html !== _promptHtml) { _promptHtml = html; pr.innerHTML = html; pr.style.display = 'block'; }
  } else if (_promptHtml !== null) { _promptHtml = null; pr.style.display = 'none'; }

  const bb = bossBarEl;
  if (bossActive && boss) {
    if (_bbShown !== true) { _bbShown = true; bb.style.display = 'block'; }
    if (boss.name !== _bbName) { _bbName = boss.name; document.getElementById('bossName').textContent = boss.name; }
    const pct = clamp(boss.hp / boss.hpMax * 100, 0, 100); if (pct !== _bbPct) { _bbPct = pct; document.getElementById('bossFill').style.width = pct + '%'; }
  } else if (_bbShown !== false) { _bbShown = false; bb.style.display = 'none'; }
  renderObjective();

  placeCamera(player); updateGlobes();
  _floatAcc -= dt; if (_floatAcc <= 0) { _floatAcc = 33; renderFloats(); }
  _plAcc -= dt; if (_plAcc <= 0) { _plAcc = 120; cullLights(); }
  _uiAcc -= dt; if (_uiAcc <= 0) { _uiAcc = 66; renderSkillCd(); drawMinimap(); updateDebug(); }
}
let _floatAcc = 0, _uiAcc = 0, _plAcc = 0, _dbgOn = false, _bagFullAt = -9999;
/* ---- Phase 0 perf rig: frame-time ring buffer + GPU-timestamp sampling. recordFrame() is a single typed-array
   write per frame (~free), so it always runs; GPU ms only sampled in perf mode (_tsSupported). ---- */
let _gpuMs = 0, _tsSupported = false;
const _ftBuf = new Float32Array(240), _ftScratch = new Float32Array(240); let _ftIdx = 0, _ftCount = 0;
function recordFrame(dt) { _ftBuf[_ftIdx] = dt; _ftIdx = (_ftIdx + 1) % _ftBuf.length; if (_ftCount < _ftBuf.length) _ftCount++; }
function framePctl() {
  const n = _ftCount; if (!n) return { p50: 0, p95: 0, p99: 0, max: 0 };
  _ftScratch.set(_ftBuf.subarray(0, n)); const s = _ftScratch.subarray(0, n); s.sort(); /* TypedArray.sort is numeric-ascending, in place, no alloc/comparator */
  const at = q => s[Math.min(n - 1, Math.floor(q * n))];
  return { p50: at(0.5), p95: at(0.95), p99: at(0.99), max: s[n - 1] };
}
function updateDebug() {
  if (!_dbgOn) return; const el = document.getElementById('dbg'); if (!el) return;
  const lights = (() => { let n = 0; scene.traverse(o => { if (o.isLight && o.visible) n++; }); return n; })();
  const ft = framePctl(); /* Phase 0 rig: draws/tris come from _lastDraws/_lastTris captured post-render (ri.calls is a broken lifetime accumulator under WebGPU r184; live drawCalls reads 0 here because info resets before this runs) */
  el.innerHTML = `FPS ${_fps.toFixed(0)}  gpu ${_tsSupported ? _gpuMs.toFixed(2) + 'ms' : (_perf ? '—' : 'off')}\nframe p50 ${ft.p50.toFixed(1)} p95 ${ft.p95.toFixed(1)} p99 ${ft.p99.toFixed(1)} max ${ft.max.toFixed(1)}ms\nzone ${zone}${zone === 'dungeon' ? ' d' + depth : ''}\ndraws ${_lastDraws}  tris ${(_lastTris / 1000).toFixed(1)}k\nmonsters ${monsters.length}  proj ${projectiles.length}\nloot ${loots.length}  fx ${fx.length}  floats ${floats.length}\nscene objs ${scene.children.length}  lights ${lights}\nremotes ${typeof NET !== 'undefined' ? NET.remotes.size : 0}` +
    (_errCount ? `\n<span class="err">errors ${_errCount}: ${escapeHtml(_lastErr).slice(0, 60)}</span>` : '');
}
function clampEntToZone(e) { if (zone === 'town') { const d = Math.hypot(e.x, e.z); if (d > TOWN_R) { e.x = e.x / d * TOWN_R; e.z = e.z / d * TOWN_R; } } else if (zone === 'dungeon') { if (e.x > DUNG_HALF) e.x = DUNG_HALF; else if (e.x < -DUNG_HALF) e.x = -DUNG_HALF; if (e.z > DUNG_HALF) e.z = DUNG_HALF; else if (e.z < -DUNG_HALF) e.z = -DUNG_HALF; } else { const d = Math.hypot(e.x, e.z); if (d > WILD_R) { e.x = e.x / d * WILD_R; e.z = e.z / d * WILD_R; } } }
function clampToZone() { clampEntToZone(player); }
function moveToward(tx, tz, dt) {
  const a = Math.atan2(tx - player.x, tz - player.z); const fr = Math.min(dt || 16.667, 50) / 16.667; const sp = player.speed * 0.96 * fr * (now() < player.chillUntil ? 0.5 : 1) * (player.buffs.fleetUntil > now() ? player.buffs.fleetMul : 1); player.x += Math.sin(a) * sp; player.z += Math.cos(a) * sp; player.dir = a; player.bob += 0.3;
  resolveCircles(player, player.r, activeColliders(), 2);
  if (isCombat()) resolveCircles(player, player.r, monsters, 1);
  clampEntToZone(player);
}
function stepEnt(e, tx, tz, sp) { const a = Math.atan2(tx - e.x, tz - e.z); e.x += Math.sin(a) * sp; e.z += Math.cos(a) * sp; clampEntToZone(e); }
function damagePlayer(d, mods) {
  if (_perfGod) return; /* perf rig: invincible under the perftest harness */
  if (Math.random() < (player.effects.dodge || 0)) { floatText('Dodge', player.x, player.z, '#9ff'); return; }
  const dr = player.armor / (player.armor + 40); d = d * (1 - Math.min(dr, 0.75));
  if (player.effects.flatDR > 0) d *= (1 - player.effects.flatDR);
  { const e = player.effects; let res = e.allRes || 0; if (mods && mods.includes) { if (mods.includes('fiery')) res += e.fireRes || 0; else if (mods.includes('frozen')) res += e.frostRes || 0; else if (mods.includes('arcane')) res += e.lightningRes || 0; else if (mods.includes('toxic')) res += e.poisonRes || 0; } if (res > 0) d *= (1 - Math.min(res, 75) / 100); } if (player.buffs.cryUntil > now()) d *= (1 - player.buffs.cryDR); if (player.effects.manaShield > 0 && player.mp > 0) { const ab = Math.min(d * player.effects.manaShield, player.mp); player.mp -= ab; d -= ab; } player.hp -= d; if (player.hp < 0) player.hp = 0; floatText('-' + Math.round(d), player.x, player.z, '#ff5b4b'); sfx('hurt'); shake = Math.min(1.6, shake + 0.6); const hf = document.getElementById('hurtFlash'); hf.style.opacity = Math.min(0.6, 0.25 + d / player.hpMax); clearTimeout(hf._t); hf._t = setTimeout(() => hf.style.opacity = 0, 120); if (mods && mods.includes && mods.includes('frozen')) { player.chillUntil = now() + 1500; floatText('Chilled', player.x, player.z - 1, '#9ff'); } updateGlobes(); if (player.hp <= 0) { sfx('die'); gameOver(); }
}

function saveProgress(showNote) { if (currentSlot === null || !character) return false; character.level = player.level; character.xp = player.xp; character.xpNext = player.xpNext; character.gold = player.gold; character.kills = player.kills; character.potions = player.hpPotions; character.hpPotions = player.hpPotions; character.mpPotions = player.mpPotions; const ok = SAVE.saveCharacter(currentSlot, character); if (showNote || !ok) flashSaved(ok); return ok; } /* surface a failure even on a silent autosave — a full localStorage quietly loses progress otherwise */
function flashSaved(ok) { const n = document.getElementById('saveNote'); if (ok === false) { n.textContent = '⚠ Save failed — storage full'; n.style.color = '#e07a5a'; } else { n.textContent = 'Saved'; n.style.color = ''; } n.style.opacity = 1; clearTimeout(n._t); n._t = setTimeout(() => n.style.opacity = 0, ok === false ? 2600 : 900); }

/* ---------- MINIMAP ---------- */
const mm = document.getElementById('minimap'), mctx = mm.getContext('2d'); const MMR = 85, MM_RANGE = 120, MM_SCALE = MMR / MM_RANGE;
function mmDot(wx, wz, col, size) { const dx = (wx - player.x) * MM_SCALE, dz = (wz - player.z) * MM_SCALE; if (dx * dx + dz * dz > MMR * MMR) return; mctx.fillStyle = col; mctx.beginPath(); mctx.arc(MMR + dx, MMR + dz, size, 0, 7); mctx.fill(); }
