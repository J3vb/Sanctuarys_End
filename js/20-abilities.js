function renderAbilities() {
  const host = document.getElementById('abilTree'); if (!host || !character) return;
  if (!Array.isArray(character.loadout) || character.loadout.length !== 6) character.loadout = defaultLoadout(character);
  const owned = unlockedActives();
  if (!_runeViewId || (_runeViewId !== 'strike' && owned.indexOf(_runeViewId) < 0)) _runeViewId = character.loadout[_abilSlotSel] || owned[0] || 'strike';
  const ap = character.abilityPoints || 0;
  const note = document.getElementById('abilNote'); if (note) note.textContent = `${ap} ability point${ap === 1 ? '' : 's'} · unlock an ability or spend in a rune tree`;
  const slotLab = ['LMB', 'RMB', slotKeyLabel(2), slotKeyLabel(3), slotKeyLabel(4), slotKeyLabel(5)];
  let h = '<div class="abilSlots">';
  for (let i = 0; i < 6; i++) {
    const id = character.loadout[i], def = id ? SKILLDEFS[id] : null;
    h += `<div class="abilSlot${i === 0 ? ' basic' : ''}${i === _abilSlotSel ? ' sel' : ''}" data-slot="${i}"><span class="slk">${slotLab[i]}</span>${def ? `<span class="sli">${def.ico}</span>` : '<span class="sle">＋</span>'}</div>`;
  }
  h += '</div>';
  h += `<div class="abilBar"><span class="abilHint">Put a skill into the <b>${slotLab[_abilSlotSel]}</b> slot, or click a slot to view its rune tree.</span><span id="runeReset">↺ Refund all runes (free)</span></div>`;
  h += '<div class="abilPick">';
  const acts = (CLASS_ACTIVES[character.class] || {});
  const list = classAbilities();
  for (const id of owned) if (list.indexOf(id) < 0) list.push(id); // keep any owned active not in the class list assignable
  for (const id of list) {
    const def = SKILLDEFS[id]; if (!def) continue;
    const req = acts[id] || def.req || 1;
    const ownedSkill = (character.skills[id] || 0) >= 1, onBar = character.loadout.indexOf(id) >= 0;
    let cls = 'abilChip', tag = '';
    if (ownedSkill) { if (onBar) cls += ' on'; }
    else if (player.level >= req) { cls += ' unlock'; tag = '<span class="ct">Unlock · 1 pt</span>'; }
    else { cls += ' locked'; tag = `<span class="ct">Lv ${req}</span>`; }
    h += `<div class="${cls}" data-skill="${id}">${def.ico} ${def.name}${tag}</div>`;
  }
  h += '</div><div id="runeWrap"></div>';
  host.innerHTML = h;
  host.querySelectorAll('.abilSlot').forEach(el => { const i = +el.dataset.slot; el.onclick = () => { if (i === 0) { _runeViewId = 'strike'; } else { _abilSlotSel = i; if (character.loadout[i]) _runeViewId = character.loadout[i]; } renderAbilities(); }; });
  host.querySelectorAll('.abilChip').forEach(el => { const id = el.dataset.skill; el.onmouseenter = ev => { tooltip.innerHTML = skillTip(id); tooltip.style.display = 'block'; moveTip(ev); }; el.onmousemove = moveTip; el.onmouseleave = () => tooltip.style.display = 'none'; el.onclick = () => { if ((character.skills[id] || 0) >= 1) { setLoadoutSlot(_abilSlotSel, id); _runeViewId = id; saveProgress(false); renderAbilities(); } else { unlockAbility(id); } }; });
  const rr = document.getElementById('runeReset'); if (rr) rr.onclick = refundRunes;
  renderRuneView();
}
function renderRuneView() {
  const wrap = document.getElementById('runeWrap'); if (!wrap) return; const id = _runeViewId, tree = id && SKILL_RUNES[id];
  if (!tree) { wrap.innerHTML = `<div class="abilHint" style="text-align:center;padding:20px">${id === 'strike' ? 'Basic attack — always on Left-click, no runes to spend.' : 'Select a skill to view its rune tree.'}</div>`; return; }
  if ((character.skills[id] || 0) < 1) { wrap.innerHTML = `<div class="abilHint" style="text-align:center;padding:20px">Unlock this ability to spend runes on it.</div>`; return; }
  const def = SKILLDEFS[id]; rT = { x: 0, y: -20, s: 1 };
  wrap.innerHTML = `<div class="ptsNote" style="margin:8px 0 4px">${def.ico} ${def.name} — rune tree</div><div id="rVp" style="position:relative;width:100%;height:calc(100vh - 400px);min-height:240px;overflow:hidden;border:1px solid #2a2218;border-radius:8px;background:radial-gradient(circle at 50% 45%,#161109,#080604);cursor:grab"><svg id="rSvg" width="100%" height="100%" viewBox="-200 -150 400 380"><defs><filter id="rg" x="-90%" y="-90%" width="280%" height="280%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g id="rG"></g></svg></div>`;
  buildRuneSvg(id); attachRuneEvents();
}
function applyR() { const g = document.getElementById('rG'); if (g) g.setAttribute('transform', `scale(${rT.s}) translate(${rT.x} ${rT.y})`); }
function attachRuneEvents() {
  const vp = document.getElementById('rVp'); if (!vp) return; let drag = false, lx = 0, ly = 0;
  vp.onmousedown = e => { drag = true; lx = e.clientX; ly = e.clientY; vp.style.cursor = 'grabbing'; };
  vp.onmousemove = e => { if (!drag) return; const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; const r = vp.getBoundingClientRect(); rT.x += dx / r.width * 400 / rT.s; rT.y += dy / r.height * 380 / rT.s; applyR(); };
  vp.onmouseup = () => { drag = false; vp.style.cursor = 'grab'; }; vp.onmouseleave = () => { drag = false; vp.style.cursor = 'grab'; };
  vp.onwheel = e => { e.preventDefault(); rT.s = clamp(rT.s * (e.deltaY < 0 ? 1.12 : 0.89), 0.6, 2.2); applyR(); };
}
function buildRuneSvg(id) {
  const g = document.getElementById('rG'); if (!g) return; const tree = SKILL_RUNES[id]; const alloc = (character.skillRunes && character.skillRunes[id]) || {};
  let edges = '', circles = '', drawn = new Set();
  for (const a in tree.adj) for (const b of tree.adj[a]) { const key = a < b ? a + '|' + b : b + '|' + a; if (drawn.has(key)) continue; drawn.add(key); const na = tree.nodes[a], nb = tree.nodes[b]; if (!na || !nb) continue; const on = (alloc[a] > 0) && (alloc[b] > 0); edges += `<line x1="${na.x}" y1="${na.y}" x2="${nb.x}" y2="${nb.y}" stroke="${on ? '#c4a060' : '#2a241c'}" stroke-width="${on ? 3 : 2}"/>`; }
  for (const nid in tree.nodes) {
    const n = tree.nodes[nid]; const ranks = alloc[nid] || 0; const allocated = ranks > 0; const can = canAllocRune(id, nid);
    const r = n.type === 'keystone' ? 14 : n.type === 'notable' ? 11 : 7;
    const fill = allocated ? (n.type === 'keystone' ? '#ffcf3a' : n.type === 'notable' ? '#e6b84d' : '#c8ad7a') : '#16110a';
    const stroke = allocated ? '#ffe9a8' : can ? '#e6b84d' : '#352c20';
    circles += `<circle data-rn="${nid}" cx="${n.x}" cy="${n.y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${can ? 3 : 2}" ${can ? 'filter="url(#rg)"' : ''} style="cursor:pointer"/>`;
    circles += `<text x="${n.x}" y="${n.y - r - 3}" text-anchor="middle" fill="#cdb084" font-size="8.5" font-family="Georgia" style="pointer-events:none">${n.label}${n.max > 1 ? ' ' + ranks + '/' + n.max : ''}</text>`;
  }
  g.innerHTML = edges + circles; applyR();
  g.querySelectorAll('[data-rn]').forEach(el => { const nid = el.getAttribute('data-rn'), n = tree.nodes[nid]; el.onmouseenter = e => { tooltip.innerHTML = runeTip(n, id, nid); tooltip.style.display = 'block'; moveTip(e); }; el.onmousemove = moveTip; el.onmouseleave = () => tooltip.style.display = 'none'; el.onclick = ev => { ev.stopPropagation(); runeClick(id, nid); }; });
}
function runeTip(node, id, nid) {
  const ranks = (character.skillRunes && character.skillRunes[id] && character.skillRunes[id][nid]) || 0; const m = node.mod || {};
  const t = node.type === 'keystone' ? 'Keystone' : node.type === 'notable' ? 'Notable Rune' : 'Rune'; const per = node.max > 1 ? ' / rank' : '';
  let lines = '';
  if (m.dmgMult) lines += `<div style="color:#b8a888">+${Math.round(m.dmgMult * 100)}% damage${per}</div>`;
  if (m.cdrMult) lines += `<div style="color:#b8a888">${Math.round(m.cdrMult * 100)}% cooldown${per}</div>`;
  if (m.costMult) lines += `<div style="color:#b8a888">${Math.round(m.costMult * 100)}% mana cost${per}</div>`;
  if (m.addProj) lines += `<div style="color:#b8a888">+${m.addProj} projectile/jump${per}</div>`;
  if (m.addHits) lines += `<div style="color:#b8a888">+${m.addHits} hits${per}</div>`;
  if (m.addRadius) lines += `<div style="color:#b8a888">+${m.addRadius} area${per}</div>`;
  if (m.addSlow) lines += `<div style="color:#b8a888">stronger slow${per}</div>`;
  if (m.addDuration) lines += `<div style="color:#b8a888">+${(m.addDuration / 1000).toFixed(1)}s duration${per}</div>`;
  if (m.pierce) lines += `<div style="color:#b8a888">+${m.pierce} pierce${per}</div>`;
  if (node.flags) for (const f of node.flags) { const fi = RUNE_FLAG_INFO[f]; if (fi) lines += `<div style="color:#9f6aff">${fi[1]}</div>`; }
  let foot = '';
  if (player.level < (node.lvlreq || 0)) foot = `<div style="color:#d07f7f;font-size:11px;margin-top:3px">Requires level ${node.lvlreq}</div>`;
  else if (node.excl) foot = `<div style="color:#8a7a5a;font-size:11px;margin-top:3px">Exclusive — only one of this set</div>`;
  return `<div class="tname" style="color:${node.type === 'keystone' ? '#ffcf3a' : '#e6b84d'}">${node.label}</div><div class="tslot">${t} · ${node.cost} pt${node.cost > 1 ? 's' : ''}${node.max > 1 ? ' · ' + ranks + '/' + node.max : ''}</div>${lines || '<div style="color:#8a7a5a">Pathway node</div>'}${foot}`;
}
function runeClick(id, nid) {
  const tree = SKILL_RUNES[id]; if (!tree) return; const node = tree.nodes[nid];
  if (!canAllocRune(id, nid)) { if (player.level < (node.lvlreq || 0)) showMsg('Requires level ' + node.lvlreq); else if ((character.abilityPoints || 0) < node.cost) showMsg('Not enough ability points'); else if (node.excl) showMsg('Already chose a rune in this slot'); return; }
  if (!character.skillRunes[id]) character.skillRunes[id] = {};
  character.skillRunes[id][nid] = (character.skillRunes[id][nid] || 0) + 1; character.abilityPoints -= node.cost;
  invalidateRunes(); buildRuneSvg(id); renderSkillbar(); updatePips();
  const ap = character.abilityPoints || 0, note = document.getElementById('abilNote'); if (note) note.textContent = `${ap} ability point${ap === 1 ? '' : 's'} · click a slot, then a skill to assign it`;
  sfx('potion'); saveProgress(false);
}
function refundRunes() {
  let refunded = 0; for (const sid in (character.skillRunes || {})) { const tree = SKILL_RUNES[sid]; if (!tree) continue; for (const nid in character.skillRunes[sid]) { const node = tree.nodes[nid]; if (node) refunded += (character.skillRunes[sid][nid] || 0) * node.cost; } }
  character.skillRunes = {}; character.abilityPoints = (character.abilityPoints || 0) + refunded; invalidateRunes(); renderSkillbar(); updatePips(); renderAbilities(); showMsg('Refunded ' + refunded + ' ability point' + (refunded === 1 ? '' : 's')); saveProgress(false);
}
let vendorStock = [], vendorTab = 'buy', vendorTier = 1, vendorStockTier = 1;
function refreshVendor(tier) { tier = tier || 1; vendorStockTier = tier; vendorStock = []; const bump = (tier - 1) * 7, q = tier >= 2 ? 0.35 : 0; for (let i = 0; i < 6; i++) vendorStock.push(rollItem(Math.max(1, player.level + randi(-1, 2)) + bump, null, q)); }
function renderVendor() {
  if (invOpen) renderInv(); /* keep the paired inventory pane in sync after a buy/sell */
  const body = document.getElementById('vendorBody'); body.innerHTML = `<div style="color:#ffe27a;margin-bottom:10px">Your gold: ${player.gold} <span style="color:#b9a6ff">· ✦ ${character.materials || 0} Dust</span></div>`;
  if (vendorTier >= 2) body.innerHTML += `<div style="color:#ff6ad0;margin-bottom:8px;font-size:13px">✦ Exotic wares — rarer, higher item level, premium prices.</div>`;
  if (vendorTab === 'buy') {
    body.innerHTML += `<div style="color:#9a8a6a;margin-bottom:8px;font-size:13px">Need potions? Visit the 🔥 cauldron in town to refill for free.</div>`;
    const reCost = 40 + player.level * 8; const reRow = document.createElement('div'); reRow.className = 'row'; reRow.innerHTML = `<div class="ric">🔄</div><div class="rname">Restock wares <span style="color:#8a7a5a;font-size:11px">(reroll the merchant's items)</span></div><div class="rprice">${reCost} g</div><div class="rbtn${player.gold >= reCost ? '' : ' dis'}" id="restockBtn">Reroll</div>`; body.appendChild(reRow);
    document.getElementById('restockBtn').onclick = () => { if (player.gold < reCost) return; player.gold -= reCost; refreshVendor(vendorTier); goldTxt.textContent = player.gold + ' g'; renderVendor(); saveProgress(false); }; /* pass the active tier so a paid reroll at an Exotic (tier ≥ 2) merchant keeps its premium stock instead of silently dropping to tier 1 */
    vendorStock.forEach((it, idx) => { const price = buyPrice(it); const row = document.createElement('div'); row.className = 'row'; row.innerHTML = `<div class="ric">${SLOT_ICON[it.slot]}</div><div class="rname rc-${it.rarity}">${it.name}</div><div class="rprice">${price} g</div><div class="rbtn${player.gold >= price && character.inventory.length < character.invMax ? '' : ' dis'}" data-buy="${idx}">Buy</div>`; bindTip(row.querySelector('.rname'), it); body.appendChild(row); });
    body.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const idx = +b.dataset.buy; const it = vendorStock[idx]; const price = buyPrice(it); if (player.gold < price || character.inventory.length >= character.invMax) return; player.gold -= price; character.inventory.push(it); vendorStock.splice(idx, 1); goldTxt.textContent = player.gold + ' g'; renderVendor(); updatePips(); saveProgress(false); });
  } else if (vendorTab === 'sell') {
    if (!character.inventory.length) body.innerHTML += `<div style="color:#6a5a44">Your backpack is empty.</div>`;
    const isJunk = it => it.rarity === 'common' || it.rarity === 'magic'; const junkTotal = character.inventory.filter(isJunk).reduce((s, it) => s + sellValue(it), 0), allTotal = character.inventory.reduce((s, it) => s + sellValue(it), 0), junkCnt = character.inventory.filter(isJunk).length;
    const junkDust = character.inventory.filter(isJunk).reduce((s, it) => s + dustValue(it), 0), allDust = character.inventory.reduce((s, it) => s + dustValue(it), 0);
    if (character.inventory.length) {
      const bar = document.createElement('div'); bar.className = 'row'; bar.style.background = 'rgba(40,30,16,.55)';
      bar.innerHTML = `<div class="rname" style="flex:1">Bulk sell <span style="color:#8a7a5a;font-size:11px">(also salvages into ✦ Dust)</span></div><div class="rbtn${junkCnt ? '' : ' dis'}" id="sellJunk">Sell Junk (${junkTotal}g · ${junkDust}✦)</div><div class="rbtn${allTotal ? '' : ' dis'}" id="sellAll" style="margin-left:6px;border-color:#7a3a28">Sell All (${allTotal}g · ${allDust}✦)</div>`; body.appendChild(bar);
      const sj = document.getElementById('sellJunk'); if (sj) sj.onclick = () => { if (!junkCnt) return; player.gold += junkTotal; character.materials = (character.materials || 0) + junkDust; character.inventory = character.inventory.filter(it => !isJunk(it)); goldTxt.textContent = player.gold + ' g'; showMsg('Salvaged junk: +' + junkTotal + 'g · +' + junkDust + '✦'); renderVendor(); updatePips(); saveProgress(false); };
      const sa = document.getElementById('sellAll'); if (sa) sa.onclick = () => { if (!allTotal) return; if (!confirm('Sell ALL ' + character.inventory.length + ' backpack items for ' + allTotal + 'g + ' + allDust + ' Dust?\nThis includes rare, set and unique gear.')) return; player.gold += allTotal; character.materials = (character.materials || 0) + allDust; character.inventory = []; goldTxt.textContent = player.gold + ' g'; showMsg('Salvaged all: +' + allTotal + 'g · +' + allDust + '✦'); renderVendor(); updatePips(); saveProgress(false); };
    }
    character.inventory.forEach((it, idx) => { const price = sellValue(it); const row = document.createElement('div'); row.className = 'row'; row.innerHTML = `<div class="ric">${SLOT_ICON[it.slot]}</div><div class="rname rc-${it.rarity}">${it.name}</div><div class="rprice">${price} g · ${dustValue(it)}✦</div><div class="rbtn" data-sell="${idx}">Sell</div>`; bindTip(row.querySelector('.rname'), it); body.appendChild(row); });
    body.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => { const idx = +b.dataset.sell; const it = character.inventory[idx]; player.gold += sellValue(it); character.materials = (character.materials || 0) + dustValue(it); character.inventory.splice(idx, 1); goldTxt.textContent = player.gold + ' g'; renderVendor(); updatePips(); saveProgress(false); });
  }
}
function setVendorTab(t) { if (t !== 'sell') t = 'buy'; vendorTab = t;['Buy', 'Sell'].forEach(n => document.getElementById('tab' + n).classList.toggle('on', t === n.toLowerCase())); renderVendor(); }
document.getElementById('tabBuy').onclick = () => setVendorTab('buy');
document.getElementById('tabSell').onclick = () => setVendorTab('sell');
document.getElementById('smithTabUpgrade').onclick = () => setSmithTab('upgrade');
document.getElementById('smithTabReforge').onclick = () => setSmithTab('reforge');
document.getElementById('smithTabSocket').onclick = () => setSmithTab('socket');
document.getElementById('smithTabSalvage').onclick = () => setSmithTab('salvage');
document.getElementById('jewelerTabBuy').onclick = () => setJewelerTab('buy');
document.getElementById('jewelerTabReroll').onclick = () => setJewelerTab('reroll');
document.getElementById('jewelerTabSocket').onclick = () => setJewelerTab('socket');
document.getElementById('jewelerTabCombine').onclick = () => setJewelerTab('combine');
document.querySelectorAll('#invTabs .tab').forEach(el => el.onclick = () => setInvTab(el.dataset.invtab));
function renderStash() {
  const bp = document.getElementById('bpGrid'), st = document.getElementById('stGrid'); bp.innerHTML = ''; st.innerHTML = '';
  for (let i = 0; i < character.invMax; i++) { const it = character.inventory[i]; const c = document.createElement('div'); c.className = 'cell' + (it ? ' r-' + it.rarity : ''); c.innerHTML = it ? SLOT_ICON[it.slot] : ''; if (it) { bindTip(c, it); c.onclick = () => { if (character.stash.length >= character.stashMax) { showMsg('Stash full'); return; } character.stash.push(it); character.inventory.splice(i, 1); renderStash(); saveProgress(false); }; } bp.appendChild(c); }
  for (let i = 0; i < character.stashMax; i++) { const it = character.stash[i]; const c = document.createElement('div'); c.className = 'cell' + (it ? ' r-' + it.rarity : ''); c.innerHTML = it ? SLOT_ICON[it.slot] : ''; if (it) { bindTip(c, it); c.onclick = () => { if (character.inventory.length >= character.invMax) { showMsg('Bag full'); return; } character.inventory.push(it); character.stash.splice(i, 1); renderStash(); updatePips(); saveProgress(false); }; } st.appendChild(c); }
  const sb = document.getElementById('slotBuyBar'); if (sb) {
    const bpCost = 100 + (character.invMax - 40) * 25, stCost = 100 + (character.stashMax - 40) * 25, bpMax = character.invMax >= INV_CAP, stMax = character.stashMax >= STASH_CAP;
    sb.innerHTML = `<div class="row" style="flex:1"><div class="rname">🎒 Backpack ${character.invMax}/${INV_CAP}</div>${bpMax ? '<div class="rprice">MAX</div>' : `<div class="rprice">${bpCost} g</div><div class="rbtn${player.gold >= bpCost ? '' : ' dis'}" id="buyBp">+4</div>`}</div>` +
      `<div class="row" style="flex:1"><div class="rname">📦 Stash ${character.stashMax}/${STASH_CAP}</div>${stMax ? '<div class="rprice">MAX</div>' : `<div class="rprice">${stCost} g</div><div class="rbtn${player.gold >= stCost ? '' : ' dis'}" id="buySt">+4</div>`}</div>`;
    const bbp = document.getElementById('buyBp'); if (bbp) bbp.onclick = () => { if (player.gold < bpCost || character.invMax >= INV_CAP) return; player.gold -= bpCost; character.invMax = Math.min(INV_CAP, character.invMax + 4); goldTxt.textContent = player.gold + ' g'; renderStash(); saveProgress(false); };
    const bst = document.getElementById('buySt'); if (bst) bst.onclick = () => { if (player.gold < stCost || character.stashMax >= STASH_CAP) return; player.gold -= stCost; character.stashMax = Math.min(STASH_CAP, character.stashMax + 4); goldTxt.textContent = player.gold + ' g'; renderStash(); saveProgress(false); };
  }
}

let _fps = 60, _errCount = 0, _lastErr = '', _lastErrAt = 0, _frame = 0;
