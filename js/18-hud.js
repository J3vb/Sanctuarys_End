function drawMinimap() {
  mctx.clearRect(0, 0, 170, 170); mctx.save(); mctx.beginPath(); mctx.arc(MMR, MMR, MMR, 0, 7); mctx.clip();
  mctx.fillStyle = 'rgba(10,8,6,0.4)'; mctx.fillRect(0, 0, 170, 170);
  // interactables
  const colMap = { vendor: '#9f6aff', stash: '#ffd24d', smith: '#ff8a3a', wild: '#6affa0', town: '#9f6aff', cave: '#ff8a3a', deeper: '#c04aff', cauldron: '#55ffa0', towngate: '#ffd24d', waypoint: '#6ab0ff', wildnext: '#bcd0ff', wildprev: '#9ad86a' };
  for (const o of interactables()) { let col = colMap[o.kind] || '#fff'; if (o.kind === 'towngate') col = (character && character.discovered && character.discovered[o.area]) ? '#ffd24d' : '#777'; mmDot(o.x, o.z, col, o.kind === 'towngate' ? 4.5 : 3.5); }
  // loot
  for (const l of loots) mmDot(l.x, l.z, l.kind === 'item' ? '#' + RCOL[l.payload.rarity].toString(16).padStart(6, '0') : '#ffe27a', 2);
  // monsters
  for (const m of monsters) mmDot(m.x, m.z, m.boss ? '#ff3020' : (m.elite ? '#ff9a3a' : '#e05040'), m.boss ? 6 : (m.elite ? 4 : 2.5));
  // player arrow
  mctx.fillStyle = '#ffe6a0'; mctx.save(); mctx.translate(MMR, MMR); mctx.rotate(-player.dir + Math.PI);
  mctx.beginPath(); mctx.moveTo(0, -5); mctx.lineTo(4, 4); mctx.lineTo(-4, 4); mctx.closePath(); mctx.fill(); mctx.restore();
  mctx.restore();
}

/* ---------- HUD ---------- */
const healthFill = document.getElementById('healthFill'), manaFill = document.getElementById('manaFill');
const hpTxt = document.getElementById('hpTxt'), mpTxt = document.getElementById('mpTxt'), xpfill = document.getElementById('xpfill');
const lvlNum = document.getElementById('lvlNum'), killsTxt = document.getElementById('killsTxt'), charName = document.getElementById('charName'), goldTxt = document.getElementById('goldTxt'), zoneTxt = document.getElementById('zoneTxt'), townBtn = document.getElementById('townBtn');
const lvlBadgeNum = document.getElementById('lvlBadgeNum');
const promptEl = document.getElementById('prompt'), bossBarEl = document.getElementById('bossBar'); /* static HUD nodes — cached once instead of a getElementById every frame in update() */
function setLevelText(n) { const s = String(n); lvlNum.textContent = s; if (lvlBadgeNum) lvlBadgeNum.textContent = s; }
/* Phase 1: HUD dirty-cache — updateGlobes/prompt/boss-bar ran ~8 DOM style+text writes EVERY frame
   (each forces style recalc/layout). Now each write is gated on its value actually changing. Reset on
   zone entry via _resetHudCache() (covers character load) so a fresh char never inherits stale cache. */
let _gHpPct = NaN, _gHpN = -1, _gHpMax = -1, _gMpPct = NaN, _gMpN = -1, _gMpMax = -1, _gXpPct = NaN, _gHpP = -1, _gMpP = -1;
let _promptHtml = null, _bbShown = null, _bbName = '', _bbPct = -1;
function _resetHudCache() { _gHpPct = NaN; _gHpN = -1; _gHpMax = -1; _gMpPct = NaN; _gMpN = -1; _gMpMax = -1; _gXpPct = NaN; _gHpP = -1; _gMpP = -1; _promptHtml = null; _bbShown = null; _bbName = ''; _bbPct = -1; }
/* Phase 1: hoisted out of the per-frame prompt block (was a ~13-key object literal allocated every frame while near an interactable). Dynamic labels (deeper/towngate) computed inline. */
const PROMPT_LABELS = { vendor: 'trade with the Merchant', stash: 'open your Stash', smith: 'upgrade gear at the Smith', enchanter: 'enchant gear at the Enchanter', gambler: 'gamble with the Gambler', jeweler: 'visit the Jeweler', premiumVendor: 'trade with the Exotic Merchant', wild: 'enter the Wilderness', town: 'return to Town', cave: 'descend into the Dungeon', waypoint: 'use the Waypoint (fast travel)', cauldron: 'refill Health & Mana potions', shrine: 'commune with the Shrine' };
function updateGlobes() {
  const hpPct = player.hp / player.hpMax * 100; if (hpPct !== _gHpPct) { _gHpPct = hpPct; healthFill.style.height = hpPct + '%'; }
  const hpN = Math.round(player.hp); if (hpN !== _gHpN || player.hpMax !== _gHpMax) { _gHpN = hpN; _gHpMax = player.hpMax; hpTxt.textContent = hpN + '/' + player.hpMax; }
  const mpPct = player.mp / player.mpMax * 100; if (mpPct !== _gMpPct) { _gMpPct = mpPct; manaFill.style.height = mpPct + '%'; }
  const mpN = Math.round(player.mp); if (mpN !== _gMpN || player.mpMax !== _gMpMax) { _gMpN = mpN; _gMpMax = player.mpMax; mpTxt.textContent = mpN + '/' + player.mpMax; }
  const xpPct = player.xp / player.xpNext * 100; if (xpPct !== _gXpPct) { _gXpPct = xpPct; xpfill.style.width = xpPct + '%'; }
  if (player.hpPotions !== _gHpP || player.mpPotions !== _gMpP) {
    _gHpP = player.hpPotions; _gMpP = player.mpPotions;
    const pc = document.getElementById('potCount'); if (pc) { pc.textContent = player.hpPotions; const pm = document.getElementById('potCountM'); if (pm) pm.textContent = player.mpPotions; document.getElementById('potionInd').classList.toggle('empty', player.hpPotions <= 0 && player.mpPotions <= 0); }
  }
}
function updatePips() { const ip = document.getElementById('invPip'), sp = document.getElementById('skillPip'); if (character) { const tot = (character.skillPoints || 0) + (character.abilityPoints || 0); sp.style.display = tot > 0 ? 'flex' : 'none'; sp.textContent = tot; ip.style.display = 'none'; } }
function slotKeyLabel(i) { if (i === 0) return 'LMB'; if (i === 1) return 'RMB'; return (KEYBINDS['skill' + (i - 1)] || []).map(keyLabel)[0] || '—'; }
function unlockedActives() { return ACTIVE_ORDER.filter(id => id !== 'strike' && character.skills[id] >= 1); }
// Spend one ability point to learn a class ability whose level requirement is met (shared pool with rune nodes).
function unlockAbility(id) {
  const req = (CLASS_ACTIVES[character.class] || {})[id];
  if (req == null || (character.skills[id] || 0) >= 1) return;
  if (player.level < req) { showMsg('Requires level ' + req); return; }
  if ((character.abilityPoints || 0) < 1) { showMsg('Not enough ability points'); return; }
  character.skills[id] = 1; character.abilityPoints -= 1;
  recompute(); renderSkillbar(); renderAbilities(); updatePips(); sfx('level'); saveProgress(false);
}
// Assign a skill to a bar slot (1..5; slot 0 is the fixed basic attack). Dedupes across slots; RMB (1) drives activeSkillId.
function setLoadoutSlot(slot, id) {
  if (slot < 1 || slot > 5) return;
  if (!Array.isArray(character.loadout) || character.loadout.length !== 6) character.loadout = defaultLoadout(character);
  if (id) for (let i = 1; i < 6; i++) if (i !== slot && character.loadout[i] === id) character.loadout[i] = null;
  character.loadout[slot] = id || null;
  if (slot === 1) character.activeSkillId = character.loadout[1] || null;
  renderSkillbar(); SAVE.persist();
}
// Computes the live damage a skill deals right now, using the SAME inputs castActive uses (player.dmg, the
// spell/melee multipliers, skM with the active-skill bonus, and SKILL_COEF). Returns null for passives/unknown.
function skillDamageInfo(id) {
  const def = SKILLDEFS[id]; if (!def || def.type !== 'active') return null; const c = SKILL_COEF[def.kind]; if (!c) return null;
  let rank = (character.skills[id] || 0) + ((player.effects && player.effects.allskills) || 0); if (rank < 1) rank = 1;
  const skM = (player.skillMult || 1) * ((id === character.activeSkillId) ? (player.activeSkillDmg || 1) : 1);
  let mult; if (c.school === 'spell') mult = (player.spellMult || 1) * skM; else if (c.school === 'melee') mult = (player.meleeMult || 1) * skM; else if (c.school === 'skill') mult = skM; else mult = 0;
  const R = resolveSkill(id);
  const coef = c.coef ? c.coef(rank) : 0; const critM = c.critMult ? ((player.effects && player.effects.critdmg) ? 3 : 2) : 1;
  const dmg = Math.round((player.dmg || 0) * coef * mult * critM * R.dmgMult);
  const hits = ((typeof c.hits === 'function') ? c.hits(rank) : (c.hits || 1)) + (R.addProj || 0) + (R.addHits || 0);
  return { dmg, school: c.school, hits, perTick: c.perTick, note: c.note, isActive: (id === character.activeSkillId), onHit: def.onHit };
}
function skillTip(id) {
  const def = SKILLDEFS[id]; if (!def) return ''; const rank = character.skills[id] || 0; const R = resolveSkill(id);
  const rCost = Math.round((def.cost || 0) * R.costMult), rCd = (def.cd || 0) * R.cdrMult;
  const meta = []; if (def.cost) meta.push(rCost + ' mana'); if (def.cd) meta.push((rCd / 1000).toFixed(rCd % 1000 ? 1 : 0) + 's cd'); meta.push(def.maxRank > 1 ? ('Rank ' + rank + '/' + def.maxRank) : (rank >= 1 ? 'Learned' : 'Locked'));
  let html = `<div class="tname">${def.ico} ${def.name}</div><div class="tslot">${def.type === 'passive' ? 'Passive' : 'Active'}${def.elem ? ' · ' + def.elem : ''} · ${meta.join(' · ')}</div>`;
  html += `<div class="base" style="margin:4px 0">${def.desc}</div>`;
  const info = skillDamageInfo(id);
  if (info) {
    let dl;
    if (info.school === 'none') dl = '<span style="color:#9fd0ff">Utility skill</span>';
    else if (info.perTick) dl = `Damage <span class="aff">~${info.dmg}</span> / tick`;
    else if (info.hits > 1) dl = `Damage <span class="aff">~${info.dmg}</span> × ${info.hits} hits`;
    else dl = `Damage <span class="aff">~${info.dmg}</span>`;
    if (info.note) dl += ` <span style="color:#8a7a5a">(${info.note})</span>`;
    html += `<div>${dl}</div>`;
    if (info.isActive && info.school !== 'none' && (player.activeSkillDmg > 1)) html += `<div style="color:#7fd07f;font-size:11px">▲ selected-skill bonus applied</div>`;
    if (info.onHit) html += `<div style="color:#ff9a5b;font-size:11px">On hit: ${info.onHit}</div>`;
  }
  const _al = character.skillRunes && character.skillRunes[id], _tr = SKILL_RUNES[id];
  if (_al && _tr) { const labels = []; for (const nid in _al) { if (_al[nid] && _tr.nodes[nid]) labels.push(_tr.nodes[nid].label + (_tr.nodes[nid].max > 1 ? ' ' + _al[nid] : '')); } if (labels.length) html += `<div style="color:#9f6aff;font-size:11px;margin-top:3px">✦ Runes: ${labels.join(', ')}</div>`; }
  if (rank < 1 && def.req) html += `<div style="color:#d07f7f;font-size:11px;margin-top:3px">Requires level ${def.req}</div>`;
  return html;
}
// D3/D4 action bar: 6 fixed slots from character.loadout — [0]=LMB basic (locked), [1]=RMB, [2..5]=key1..4.
function renderSkillbar() {
  const bar = document.getElementById('skillbar'); if (!bar || !character) return;
  if (!Array.isArray(character.loadout) || character.loadout.length !== 6) character.loadout = defaultLoadout(character);
  character.loadout[0] = 'strike';
  bar.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const id = character.loadout[i], def = id ? SKILLDEFS[id] : null;
    const d = document.createElement('div');
    const isActive = (i === 1 && id && id === character.activeSkillId);
    d.className = 'skill' + (i === 0 ? ' basic' : '') + (isActive ? ' active' : '') + (!def ? ' empty' : '');
    d.dataset.slot = i;
    if (def) {
      d.innerHTML = `<span class="key">${slotKeyLabel(i)}</span><span class="ico">${def.ico}</span>` +
        (def.cost ? `<span class="cost">${def.cost}mp</span>` : '') +
        (def.maxRank > 1 ? `<span class="rank">R${character.skills[id] || 1}</span>` : '') +
        `<div class="cd" data-id="${id}"></div>`;
      d.onmouseenter = ev => { tooltip.innerHTML = skillTip(id); tooltip.style.display = 'block'; moveTip(ev); };
      d.onmousemove = moveTip; d.onmouseleave = () => tooltip.style.display = 'none';
    } else {
      d.innerHTML = `<span class="key">${slotKeyLabel(i)}</span><span class="ico" style="opacity:.3">＋</span>`;
      d.onmouseenter = ev => { tooltip.innerHTML = '<div class="tname">Empty slot</div><div class="tslot">Open Skills to assign an ability</div>'; tooltip.style.display = 'block'; moveTip(ev); };
      d.onmousemove = moveTip; d.onmouseleave = () => tooltip.style.display = 'none';
    }
    d.onmousedown = ev => { ev.stopPropagation(); if (i >= 1) openSkillPanel('abilities'); };
    bar.appendChild(d);
  }
}
function renderSkillCd() { document.querySelectorAll('.cd').forEach(el => { const id = el.dataset.id; const def = SKILLDEFS[id]; const cd = skillCd(def, id); const rem = cd - (now() - (_cd[id] || -9999)); if (rem > 50) { el.style.display = 'flex'; const prog = clamp(1 - rem / cd, 0, 1) * 360; el.style.background = `conic-gradient(transparent ${prog}deg, rgba(0,0,0,.7) ${prog}deg)`; el.textContent = (rem / 1000).toFixed(1); } else el.style.display = 'none'; }); }
function showMsg(t) { const m = document.getElementById('msg'); m.textContent = t; m.style.opacity = 1; clearTimeout(m._t); m._t = setTimeout(() => m.style.opacity = 0, 1400); }
const floatLayer = document.createElement('div'); floatLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:4;overflow:hidden;'; document.body.appendChild(floatLayer);
/* Phase 1: pooled labels — was innerHTML='' + createElement per float/elite/remote every 33ms (full DOM
   teardown + element GC). Now a persistent pool of reused <div>s: overwrite text/cssText on existing nodes,
   hide the unused tail. Byte-identical DOM/CSS output (exact visual parity), no tree mutation, no per-tick garbage. */
const _floatPool = [];
function _floatEl(i) { let el = _floatPool[i]; if (!el) { el = document.createElement('div'); floatLayer.appendChild(el); _floatPool[i] = el; } return el; }
function renderFloats() {
  let n = 0;
  if (SAVE._data.settings.dmgnum) {
    for (const f of floats) {
      tmpV.set(f.x, f.y, f.z); tmpV.project(camera); if (tmpV.z > 1) continue; const sx = (tmpV.x * 0.5 + 0.5) * innerWidth, sy = (-tmpV.y * 0.5 + 0.5) * innerHeight;
      const age = 55 - f.life; const crit = (String(f.txt).charAt(0) === '✸'); const rise = age * 0.9; if (f.dx == null) f.dx = (Math.random() - 0.5) * 26; const pop = age < 6 ? 1 + (6 - age) * 0.10 : 1; const sc = (crit ? 1.5 : 1) * pop; const op = clamp(f.life / 22, 0, 1);
      const el = _floatEl(n++); el.className = 'float'; el.textContent = f.txt; el.style.cssText = `left:${sx}px;top:${sy}px;transform:translate(-50%,-50%) translate(${f.dx * age / 55}px,${-rise}px) scale(${sc.toFixed(2)});color:${f.col};font-size:${crit ? 22 : 15}px;opacity:${op};text-shadow:0 0 5px #000,0 1px 2px #000${crit ? ',0 0 12px ' + f.col : ''};`;
    }
  }
  for (const m of monsters) { if (!m.elite && !m.showName) continue; tmpV.set(m.x, m.r * 2.6 + 1.6, m.z); tmpV.project(camera); if (tmpV.z > 1) continue; const sx = (tmpV.x * 0.5 + 0.5) * innerWidth, sy = (-tmpV.y * 0.5 + 0.5) * innerHeight; const col = '#' + (m.nameCol != null ? m.nameCol : ELITE_MODS[m.elite[0]].col).toString(16).padStart(6, '0'); const lab = _floatEl(n++); lab.className = ''; lab.textContent = m.name; lab.style.cssText = `position:absolute;left:${sx}px;top:${sy}px;transform:translate(-50%,-50%);color:${col};font:bold 12px Georgia;text-shadow:0 0 4px #000,0 0 4px #000;white-space:nowrap;`; }
  if (typeof NET !== 'undefined' && NET.connected) { for (const [, r] of NET.remotes) { if (!r.mesh.visible) continue; tmpV.set(r.x, 5.4, r.z); tmpV.project(camera); if (tmpV.z > 1) continue; const sx = (tmpV.x * 0.5 + 0.5) * innerWidth, sy = (-tmpV.y * 0.5 + 0.5) * innerHeight; const lab = _floatEl(n++); lab.className = ''; lab.textContent = (r.name || 'Player') + ' · Lv' + (r.level || 1); lab.style.cssText = `position:absolute;left:${sx}px;top:${sy}px;transform:translate(-50%,-50%);color:#9fd8ff;font:bold 12px Georgia;text-shadow:0 0 4px #000,0 0 5px #000;white-space:nowrap;`; } }
  for (let i = n; i < _floatPool.length; i++) { if (_floatPool[i].style.display !== 'none') _floatPool[i].style.display = 'none'; }
}

/* ---------- panels (inventory/skills/vendor/stash) ---------- */
const invPanel = document.getElementById('invPanel'), statsPanel = document.getElementById('statsPanel'), skillPanel = document.getElementById('skillPanel'), vendorPanel = document.getElementById('vendorPanel'), stashPanel = document.getElementById('stashPanel'), smithPanel = document.getElementById('smithPanel'), enchantPanel = document.getElementById('enchantPanel'), gamblePanel = document.getElementById('gamblePanel'), jewelerPanel = document.getElementById('jewelerPanel'), alchemistPanel = document.getElementById('alchemistPanel'), tooltip = document.getElementById('tooltip');
