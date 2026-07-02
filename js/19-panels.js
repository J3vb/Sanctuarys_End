function closeAll() { shopAnchor = null; invOpen = skillOpen = vendorOpen = stashOpen = smithOpen = enchantOpen = gambleOpen = jewelerOpen = alchemistOpen = false;[invPanel, statsPanel, skillPanel, vendorPanel, stashPanel, smithPanel, enchantPanel, gamblePanel, jewelerPanel, alchemistPanel].forEach(p => p.style.display = 'none'); tooltip.style.display = 'none'; }
/* Diablo-3 dual-pane: shops dock left and open the inventory on the right so gear + trading sit side by side.
   Only one shop is open at a time, so renderOpenShop() refreshes whichever it is — call it after any
   inventory mutation from the right pane to keep the shop's item indices fresh (see equipFromInv/unequip). */
function openShopWithInv() { invOpen = true; invPanel.style.display = 'block'; statsPanel.style.display = 'block'; setInvTab('items'); }
function renderOpenShop() { if (vendorOpen) renderVendor(); else if (smithOpen) renderSmith(); else if (enchantOpen) renderEnchanter(); else if (gambleOpen) renderGamble(); else if (jewelerOpen) renderJeweler(); else if (alchemistOpen) renderAlchemist(); }
function toggleInv() { const o = !invOpen; closeAll(); if (o) { invOpen = true; invPanel.style.display = 'block'; statsPanel.style.display = 'block'; setInvTab('items'); } }
let _skTab = 'abilities';
function setSkillTab(name) {
  _skTab = name;
  document.querySelectorAll('#skillTabs .tab').forEach(t => t.classList.toggle('on', t.dataset.sktab === name));
  document.querySelectorAll('#skillPanel .skPane').forEach(p => p.style.display = (p.dataset.skpane === name) ? 'block' : 'none');
  if (name === 'forest') renderSkillTree(); else renderAbilities();
}
function toggleSkill(tab) { const o = !skillOpen; closeAll(); if (o) { skillOpen = true; skillPanel.style.display = 'block'; setSkillTab(tab || _skTab); } }
function openSkillPanel(tab) { if (!skillOpen) toggleSkill(tab); else setSkillTab(tab); }
function openVendor(tier) { closeAll(); openShopWithInv(); vendorTier = tier || 1; vendorOpen = true; vendorPanel.style.display = 'block'; if (!vendorStock.length || vendorStockTier !== vendorTier) refreshVendor(vendorTier); setVendorTab('buy'); }
function openStash() { closeAll(); stashOpen = true; stashPanel.style.display = 'block'; renderStash(); }
function openSmith() { closeAll(); openShopWithInv(); smithOpen = true; smithPick = null; smithPanel.style.display = 'block'; setSmithTab('upgrade'); }
function openAlchemist() { closeAll(); openShopWithInv(); alchemistOpen = true; alchemistPanel.style.display = 'block'; renderAlchemist(); }
function renderAlchemist() {
  const body = document.getElementById('alchemistBody');
  let html = `<div style="color:#ffe27a;margin-bottom:10px">Your gold: ${player.gold}</div><div class="tier">Potions</div>`;
  const ptCost = 200 * Math.pow(2, character.potionTier || 0), ptMax = (character.potionTier || 0) >= POTION_TIER_MAX, ptPct = Math.round((POTION_PCT + (character.potionTier || 0) * POTION_TIER_PCT) * 100);
  html += `<div class="row"><div class="ric">⚗️</div><div class="rname">Potion Strength <span style="color:#8a7a5a;font-size:11px">(tier ${character.potionTier || 0} · restores ${ptPct}% of max)</span></div>${ptMax ? '<div class="rprice">MAX</div>' : `<div class="rprice">${ptCost} g</div><div class="rbtn${player.gold >= ptCost ? '' : ' dis'}" id="upPotTier">Upgrade</div>`}</div>`;
  const pcCost = 150 + ((character.potionCap || 10) - 10) * 40, pcMax = (character.potionCap || 10) >= POTION_CAP_MAX;
  html += `<div class="row"><div class="ric">🎒</div><div class="rname">Potion Capacity <span style="color:#8a7a5a;font-size:11px">(carry ${character.potionCap || 10} of each)</span></div>${pcMax ? '<div class="rprice">MAX</div>' : `<div class="rprice">${pcCost} g</div><div class="rbtn${player.gold >= pcCost ? '' : ' dis'}" id="upPotCap">+2</div>`}</div>`;
  body.innerHTML = html;
  const upt = document.getElementById('upPotTier'); if (upt) upt.onclick = () => { if (player.gold < ptCost || (character.potionTier || 0) >= POTION_TIER_MAX) return; player.gold -= ptCost; character.potionTier = (character.potionTier || 0) + 1; goldTxt.textContent = player.gold + ' g'; sfx('potion'); renderAlchemist(); updateGlobes(); saveProgress(false); };
  const upc = document.getElementById('upPotCap'); if (upc) upc.onclick = () => { if (player.gold < pcCost || (character.potionCap || 10) >= POTION_CAP_MAX) return; player.gold -= pcCost; character.potionCap = (character.potionCap || 10) + 2; goldTxt.textContent = player.gold + ' g'; renderAlchemist(); saveProgress(false); };
}
const ENCHANT_POOL = ['dmg', 'hp', 'mp', 'armor', 'str', 'dex', 'vit', 'eng', 'crit', 'ias', 'ms', 'allstats', 'allRes', 'critDmg', 'leech', 'manaLeech', 'skillranks', 'skilldmg', 'activeskill', 'fireDmg', 'coldDmg', 'lightDmg', 'poisonDmg', 'hpregen', 'mpregen', 'mf', 'gf', 'dodge', 'flatDR', 'cdr', 'lifeOnHit'];
/* Anvil pattern (same as the Smith): no gear list — click a piece in the inventory pane (renderInv routes
   clicks here while enchantOpen) and the Enchanter acts on that one selection. enchantPickWhere() doubles as a
   liveness check: if the picked item was dropped/equipped-away it returns null and we drop the selection. */
let enchantPick = null;
function openEnchanter() { closeAll(); openShopWithInv(); enchantOpen = true; enchantPanel.style.display = 'block'; enchantPick = null; renderEnchanter(); }
function enchantPickWhere() { if (!enchantPick) return null; for (const s of SLOTS) { if (character.equipment[s] === enchantPick) return 'eq'; } return character.inventory.indexOf(enchantPick) >= 0 ? 'inv' : null; }
function selectEnchantItem(it) { enchantPick = it; renderEnchanter(); }
function renderEnchanter() {
  if (invOpen) renderInv(); /* paired inventory pane: refresh contents + selection highlight */
  const body = document.getElementById('enchantBody'), where = enchantPickWhere(); if (!where) enchantPick = null; const it = enchantPick;
  let html = `<div style="color:#ffe27a;margin-bottom:8px">Your gold: ${player.gold}</div>`;
  if (!it) { html += `<div class="smithSlot empty">Click an item in your inventory →</div>`; }
  else {
    const ecost = enchantCost(it), cur = it.enchant && AFFIXES[it.enchant.key] ? `<div class="aff" style="color:#9f6aff">✦ +${it.enchant.val} ${AFFIXES[it.enchant.key].label} (current)</div>` : '';
    html += `<div class="smithSlot"><div class="ric" style="font-size:30px">${SLOT_ICON[it.slot]}</div><div style="flex:1"><div class="rname rc-${it.rarity}">${it.name}</div><div style="color:#8a7a5a;font-size:11px;text-transform:capitalize">${RARITY_NAME[it.rarity] || it.rarity} · ${it.slot}${where === 'eq' ? ' · equipped' : ''}</div>${cur}</div></div>`;
    html += `<div class="smithAct"><span>Imbue a stat${it.enchant ? ' (overwrites current)' : ''}</span><span class="rprice">${ecost} g</span></div>`;
    html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">`;
    ENCHANT_POOL.forEach(k => { if (!AFFIXES[k]) return; html += `<div class="rbtn${player.gold >= ecost ? '' : ' dis'}" data-aff="${k}" style="flex:0 0 auto;border-color:#6a4aa0">${AFFIXES[k].label}</div>`; });
    html += `</div>`;
  }
  body.innerHTML = html;
  if (it) { const rn = body.querySelector('.smithSlot .rname'); if (rn) bindTip(rn, it); }
  body.querySelectorAll('[data-aff]').forEach(b => b.onclick = () => { const tgt = enchantPick; if (!tgt) return; const k = b.dataset.aff, ecost = enchantCost(tgt); if (player.gold < ecost) return; player.gold -= ecost; tgt.enchant = { key: k, val: affixRoll(k, tgt.ilvl, tgt.rarity) }; goldTxt.textContent = player.gold + ' g'; if (enchantPickWhere() === 'eq') recompute(); sfx('potion'); showMsg(tgt.name + ' · enchanted: +' + tgt.enchant.val + ' ' + AFFIXES[k].label); renderEnchanter(); saveProgress(false); });
}
let jewelerStock = [], socketPick = null;
/* Jeweler socketing uses the same anvil liveness pattern as the Smith: socketWhere() returns where the picked
   item lives, or null if it was dropped/sold/equipped-away (then we drop the selection). */
function selectSocketItem(it) { socketPick = it; renderJeweler(); }
function socketWhere() { if (!socketPick) return null; for (const s of SLOTS) if (character.equipment[s] === socketPick) return 'eq'; return character.inventory.indexOf(socketPick) >= 0 ? 'inv' : null; }
function openGambler() { closeAll(); openShopWithInv(); gambleOpen = true; gamblePanel.style.display = 'block'; renderGamble(); }
function renderGamble() {
  if (invOpen) renderInv(); /* show the gambled item in the paired inventory pane */
  const body = document.getElementById('gambleBody'); const tier = (curTownArea && curTownArea.tier) || 0; const il = player.level + 1 + tier * 2, cost = 50 + player.level * 15 + tier * 150;
  body.innerHTML = `<div style="color:#ffe27a;margin-bottom:10px">Your gold: ${player.gold}</div>`;
  const row = document.createElement('div'); row.className = 'row'; row.innerHTML = `<div class="ric">🎲</div><div class="rname">Mystery Item <span style="color:#8a7a5a;font-size:11px">(ilvl ~${il}${tier ? ' · improved odds' : ''})</span></div><div class="rprice">${cost} g</div><div class="rbtn${player.gold >= cost && character.inventory.length < character.invMax ? '' : ' dis'}" id="gambleRoll">Roll</div>`; body.appendChild(row);
  const gb = document.getElementById('gambleRoll'); if (gb) gb.onclick = () => { if (player.gold < cost || character.inventory.length >= character.invMax) return; player.gold -= cost; const it = rollItem(il, null, 0.1 + tier * 0.12); character.inventory.push(it); goldTxt.textContent = player.gold + ' g'; sfx('potion'); showMsg('Gambled: ' + it.name); renderGamble(); updatePips(); saveProgress(false); };
}
function refreshJeweler(tier) { jewelerStock = []; const il = Math.max(1, player.level) + tier * 3; jewelerStock.push(rollItem(il, 'ring', 0.15 + tier * 0.1)); jewelerStock.push(rollItem(il, 'amulet', 0.15 + tier * 0.1)); jewelerStock.push(rollItem(il, 'ring', 0.05)); jewelerStock.push(rollItem(il, 'amulet', 0.05)); }
function openJeweler() { closeAll(); openShopWithInv(); jewelerOpen = true; socketPick = null; jewelerPanel.style.display = 'block'; refreshJeweler((curTownArea && curTownArea.tier) || 0); setJewelerTab('buy'); }
let jewelerTab = 'buy';
function setJewelerTab(t) { if (!['buy', 'reroll', 'socket', 'combine'].includes(t)) t = 'buy'; jewelerTab = t;['Buy', 'Reroll', 'Socket', 'Combine'].forEach(n => { const el = document.getElementById('jewelerTab' + n); if (el) el.classList.toggle('on', t === n.toLowerCase()); }); renderJeweler(); }
function renderJeweler() {
  if (invOpen) renderInv(); /* show jewelry changes in the paired inventory pane */
  const body = document.getElementById('jewelerBody');
  const DESC = { buy: 'Fresh rings &amp; amulets, restocked each visit — better towns stock better pieces.', reroll: 'Reroll every affix value on a ring or amulet you own, for gold.', socket: 'Click a socketed item in your inventory, then slot pouch gems into it or pop them back out. Add sockets at the Smith.', combine: 'Fuse 3 identical gems into 1 of the next quality, up to Perfect.' };
  body.innerHTML = `<div style="color:#ffe27a;margin-bottom:6px">Your gold: ${player.gold}</div><div style="color:#8a7a5a;font-size:12px;margin-bottom:12px">${DESC[jewelerTab]}</div>`;
  if (jewelerTab === 'buy') {
    jewelerStock.forEach((it, idx) => { const price = buyPrice(it); const row = document.createElement('div'); row.className = 'row'; row.innerHTML = `<div class="ric">${SLOT_ICON[it.slot]}</div><div class="rname rc-${it.rarity}">${it.name}</div><div class="rprice">${price} g</div><div class="rbtn${player.gold >= price && character.inventory.length < character.invMax ? '' : ' dis'}" data-jbuy="${idx}">Buy</div>`; bindTip(row.querySelector('.rname'), it); body.appendChild(row); });
    if (!jewelerStock.length) { const d = document.createElement('div'); d.style.color = '#6a5a44'; d.textContent = 'Sold out — come back next visit.'; body.appendChild(d); }
    body.querySelectorAll('[data-jbuy]').forEach(b => b.onclick = () => { const idx = +b.dataset.jbuy; const it = jewelerStock[idx]; if (!it) return; const price = buyPrice(it); if (player.gold < price || character.inventory.length >= character.invMax) return; player.gold -= price; character.inventory.push(it); jewelerStock.splice(idx, 1); goldTxt.textContent = player.gold + ' g'; sfx('potion'); showMsg('Bought: ' + it.name); renderJeweler(); updatePips(); saveProgress(false); });
  } else if (jewelerTab === 'reroll') {
    const accs = []; for (const s of ['ring', 'amulet']) { if (character.equipment[s]) accs.push({ it: character.equipment[s], where: 'eq' }); } character.inventory.forEach(it => { if (it.slot === 'ring' || it.slot === 'amulet') accs.push({ it, where: 'inv' }); });
    if (!accs.length) { const d = document.createElement('div'); d.style.color = '#6a5a44'; d.textContent = 'No rings or amulets to reroll.'; body.appendChild(d); }
    accs.forEach((e, i) => { const it = e.it, cost = enchantCost(it), hasAff = Object.keys(it.affixes || {}).length > 0; const row = document.createElement('div'); row.className = 'row'; row.innerHTML = `<div class="ric">${SLOT_ICON[it.slot]}</div><div class="rname rc-${it.rarity}">${it.name}<span style="color:#8a7a5a;font-size:11px"> ${e.where === 'eq' ? '· equipped' : ''}</span></div>${hasAff ? `<div class="rprice">${cost} g</div><div class="rbtn${player.gold >= cost ? '' : ' dis'}" data-jrr="${i}">Reroll</div>` : '<div class="rprice" style="color:#6a5a44">no affixes</div>'}`; bindTip(row.querySelector('.rname'), it); body.appendChild(row); });
    body.querySelectorAll('[data-jrr]').forEach(b => b.onclick = () => { const e = accs[+b.dataset.jrr], it = e.it; const keys = Object.keys(it.affixes || {}); const cost = enchantCost(it); if (!keys.length || player.gold < cost) return; player.gold -= cost; for (const k of keys) it.affixes[k] = affixRoll(k, it.ilvl, it.rarity); goldTxt.textContent = player.gold + ' g'; if (e.where === 'eq') recompute(); sfx('potion'); showMsg(it.name + ' · stats rerolled'); renderJeweler(); saveProgress(false); });
  } else if (jewelerTab === 'socket') {
    const gems = character.gems || {}; const pouchKeys = Object.keys(gems).filter(k => gems[k] > 0);
    const sw = socketWhere(); if (!sw) socketPick = null; const sit = socketPick;
    if (!sit) { const d = document.createElement('div'); d.style.color = '#6a5a44'; d.textContent = pouchKeys.length ? 'Click a socketed item in your inventory →' : 'Find gems from monsters, then click an item with sockets →'; body.appendChild(d); }
    else if (!(sit.sockets && sit.sockets.length)) { const d = document.createElement('div'); d.style.color = '#6a5a44'; d.innerHTML = `<span class="rname rc-${sit.rarity}">${sit.name}</span> has no sockets — add one at the Smith.`; body.appendChild(d); }
    else {
      const hdr = document.createElement('div'); hdr.className = 'row'; hdr.innerHTML = `<div class="ric">${SLOT_ICON[sit.slot]}</div><div class="rname rc-${sit.rarity}" style="flex:1">${sit.name}${sw === 'eq' ? ' <span style="color:#8a7a5a;font-size:11px">· equipped</span>' : ''}</div>`; bindTip(hdr.querySelector('.rname'), sit); body.appendChild(hdr);
      sit.sockets.forEach((g, i) => { const row = document.createElement('div'); row.className = 'row'; if (g) { const e = gemEff(sit.slot, g); row.innerHTML = `<div class="ric">${GEMS[g.t].ico}</div><div class="rname" style="flex:1">${gemName(g)} <span style="color:#8a7a5a;font-size:11px">+${e.vals[g.q]} ${AFFIXES[e.key].label}</span></div><div class="rbtn" data-unsock="${i}" style="border-color:#6a4aa0">Remove</div>`; } else { row.innerHTML = `<div class="ric">◯</div><div class="rname" style="flex:1;color:#8a7a5a">Empty socket</div>`; } body.appendChild(row); });
      if (sit.sockets.some(g => !g)) {
        if (pouchKeys.length) { const pk = document.createElement('div'); pk.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:6px'; pouchKeys.forEach(k => { const t = k.split(':')[0], q = +k.split(':')[1]; if (!GEMS[t]) return; const e = gemEff(sit.slot, { t, q }); pk.innerHTML += `<div class="rbtn" data-gem="${k}" style="flex:0 0 auto;border-color:#3a6a8a">${GEMS[t].ico} ${gemName({ t, q })} ×${gems[k]} <span style="color:#8a7a5a">+${e.vals[q]} ${AFFIXES[e.key].label}</span></div>`; }); body.appendChild(pk); }
        else { const d = document.createElement('div'); d.style.color = '#6a5a44'; d.textContent = 'No gems in your pouch.'; body.appendChild(d); }
      }
    }
    body.querySelectorAll('[data-gem]').forEach(b => b.onclick = () => { const tgt = socketPick; if (!tgt || !tgt.sockets) return; const k = b.dataset.gem, t = k.split(':')[0], q = +k.split(':')[1], g = character.gems || {}; if (!g[k]) return; const idx = tgt.sockets.findIndex(x => !x); if (idx < 0) return; tgt.sockets[idx] = { t, q }; g[k]--; if (g[k] <= 0) delete g[k]; if (socketWhere() === 'eq') recompute(); sfx('potion'); showMsg(tgt.name + ' · socketed ' + gemName({ t, q })); renderJeweler(); updatePips(); saveProgress(false); });
    body.querySelectorAll('[data-unsock]').forEach(b => b.onclick = () => { const tgt = socketPick; if (!tgt || !tgt.sockets) return; const i = +b.dataset.unsock, g = tgt.sockets[i]; if (!g) return; const k = g.t + ':' + g.q; character.gems = character.gems || {}; character.gems[k] = (character.gems[k] || 0) + 1; tgt.sockets[i] = null; if (socketWhere() === 'eq') recompute(); sfx('potion'); showMsg('Removed ' + gemName(g)); renderJeweler(); saveProgress(false); });
  } else {
    const gems = character.gems || {}; const combineable = Object.keys(gems).filter(k => gems[k] >= 3 && +k.split(':')[1] < 4);
    if (!combineable.length) { const d = document.createElement('div'); d.style.color = '#6a5a44'; d.textContent = 'Nothing to combine — you need 3 of the same gem at the same quality.'; body.appendChild(d); }
    combineable.forEach(k => { const t = k.split(':')[0], q = +k.split(':')[1]; if (!GEMS[t]) return; const row = document.createElement('div'); row.className = 'row'; row.innerHTML = `<div class="ric">${GEMS[t].ico}</div><div class="rname" style="flex:1">${gemName({ t, q })} ×${gems[k]} → ${gemName({ t, q: q + 1 })}</div><div class="rbtn" data-comb="${k}" style="border-color:#6a4aa0">Combine 3→1</div>`; body.appendChild(row); });
    body.querySelectorAll('[data-comb]').forEach(b => b.onclick = () => { const k = b.dataset.comb, t = k.split(':')[0], q = +k.split(':')[1], g = character.gems; if (!g || g[k] < 3 || q >= 4) return; g[k] -= 3; if (g[k] <= 0) delete g[k]; const nk = t + ':' + (q + 1); g[nk] = (g[nk] || 0) + 1; sfx('level'); showMsg('Combined → ' + gemName({ t, q: q + 1 })); renderJeweler(); saveProgress(false); });
  }
}
const POTION_TIER_MAX = 8, POTION_CAP_MAX = 30;
let smithTab = 'upgrade', smithPick = null;
function setSmithTab(t) { if (t !== 'reforge' && t !== 'salvage' && t !== 'socket') t = 'upgrade';smithTab = t;['Upgrade', 'Reforge', 'Salvage', 'Socket'].forEach(n => { const el = document.getElementById('smithTab' + n); if (el) el.classList.toggle('on', t === n.toLowerCase()); }); renderSmith(); }
/* Diablo-3/4 anvil: the Smith no longer lists gear — you click a piece in the inventory pane (renderInv
   routes clicks here while smithOpen) and the Smith acts on that one selection. smithPickWhere() doubles as a
   liveness check: if the picked item was salvaged/dropped it returns null and we drop the selection. */
function smithPickWhere() { if (!smithPick) return null; for (const s of SLOTS) { if (character.equipment[s] === smithPick) return 'eq'; } return character.inventory.indexOf(smithPick) >= 0 ? 'inv' : null; }
function selectSmithItem(it) { smithPick = it; renderSmith(); }
function smithAction() {
  const it = smithPick, where = smithPickWhere(); if (!it || !where) { smithPick = null; renderSmith(); return; }
  if (smithTab === 'upgrade') { if ((it.upgrade || 0) >= upgradeMax(it)) return; const cost = upgradeCost(it); if (player.gold < cost) return; player.gold -= cost; it.upgrade = (it.upgrade || 0) + 1; if (where === 'eq') recompute(); sfx('level'); showMsg(it.name + ' → +' + it.upgrade); }
  else if (smithTab === 'reforge') { if (!reforgeable(it)) return; const rc = reforgeCost(it); if (player.gold < rc.gold || (character.materials || 0) < rc.dust) return; player.gold -= rc.gold; character.materials = (character.materials || 0) - rc.dust; const before = it.rarity; reforgeItem(it); if (where === 'eq') { recompute(); attachHeroWeapon(); } sfx('level'); showMsg(it.rarity !== before ? (it.name + ' → ' + (RARITY_NAME[it.rarity] || it.rarity) + '!') : ('Reforged: ' + it.name)); }
  else if (smithTab === 'socket') { const max = SOCKET_MAX[it.slot] || 0, cur = (it.sockets || []).length; if (cur >= max) return; const cost = { dust: 6 + (RTIER[it.rarity] || 1) * 4, gold: Math.round(itemScore(it) * 0.2) + 20 }; if (player.gold < cost.gold || (character.materials || 0) < cost.dust) return; player.gold -= cost.gold; character.materials = (character.materials || 0) - cost.dust; (it.sockets = it.sockets || []).push(null); if (where === 'eq') recompute(); sfx('level'); showMsg(it.name + ' → socket added'); }
  else { if (where !== 'inv') return; const du = dustValue(it); if ((RTIER[it.rarity] || 1) >= 3 && !confirm('Salvage ' + it.name + ' (' + (RARITY_NAME[it.rarity] || it.rarity) + ') into ' + du + ' Dust? This destroys the item.')) return; const idx = character.inventory.indexOf(it); if (idx < 0) return; character.materials = (character.materials || 0) + du; character.inventory.splice(idx, 1); smithPick = null; sfx('potion'); showMsg('Salvaged: +' + du + '✦'); }
  goldTxt.textContent = player.gold + ' g'; renderSmith(); updatePips(); saveProgress(false);
}
function renderSmith() {
  if (invOpen) renderInv(); /* paired inventory pane: refresh contents + selection highlight */
  const body = document.getElementById('smithBody'), where = smithPickWhere(); if (!where) smithPick = null; const it = smithPick;
  const DESC = { upgrade: 'Select a piece from your inventory, then forge it stronger — each upgrade adds raw power. Higher rarity upgrades further.', reforge: `Select a piece, then reroll its affixes for gold + ✦ Dust — ${Math.round(REFORGE_RARITY_UP * 100)}% chance to raise its rarity. Set &amp; unique gear can't be reforged.`, salvage: 'Select a backpack piece, then break it down into ✦ Dust — no gold. Equipped gear can\'t be salvaged.', socket: 'Select a piece, then add an empty socket for gold + ✦ Dust. Caps per slot (weapon/armor 3, helm/gloves/boots 2, jewelry 1). Fill sockets with gems at the Jeweler.' };
  let html = `<div style="color:#ffe27a;margin-bottom:8px">Your gold: ${player.gold} <span style="color:#b9a6ff">· ✦ ${character.materials || 0} Dust</span></div>`;
  html += `<div style="color:#8a7a5a;font-size:12px;margin-bottom:12px">${DESC[smithTab]}</div>`;
  if (!it) { html += `<div class="smithSlot empty">Click an item in your inventory →</div>`; }
  else {
    html += `<div class="smithSlot"><div class="ric" style="font-size:30px">${SLOT_ICON[it.slot]}</div><div style="flex:1"><div class="rname rc-${it.rarity}">${it.name}${it.upgrade ? ' <span style="color:#ffcf6a">+' + it.upgrade + '</span>' : ''}</div><div style="color:#8a7a5a;font-size:11px;text-transform:capitalize">${RARITY_NAME[it.rarity] || it.rarity} · ${it.slot}${where === 'eq' ? ' · equipped' : ''}</div>${affixLines(it)}</div></div>`;
    if (smithTab === 'upgrade') {
      const lvl = it.upgrade || 0, max = upgradeMax(it), atMax = lvl >= max, cost = upgradeCost(it), cur = Math.round((upFactor(it) - 1) * 100), nxt = Math.round((upFactor({ upgrade: lvl + 1 }) - 1) * 100);
      html += atMax ? `<div class="smithAct">Fully upgraded — <b>+${cur}%</b> (MAX ${max})</div>` : `<div class="smithAct"><span>+${cur}% → <b>+${nxt}%</b></span><span class="rprice">${cost} g</span><div class="rbtn${player.gold >= cost ? '' : ' dis'}" id="smithDo">Upgrade</div></div>`;
    } else if (smithTab === 'reforge') {
      if (!reforgeable(it)) html += `<div class="smithAct" style="color:#6a5a44">${RARITY_NAME[it.rarity] || it.rarity} gear can't be reforged — only common, magic &amp; rare.</div>`;
      else { const rc = reforgeCost(it), can = player.gold >= rc.gold && (character.materials || 0) >= rc.dust; html += `<div class="smithAct"><span>Reroll all affixes</span><span class="rprice">${rc.gold}g · ${rc.dust}✦</span><div class="rbtn${can ? '' : ' dis'}" id="smithDo" style="border-color:#6a4aa0">Reforge</div></div>`; }
    } else if (smithTab === 'socket') {
      const max = SOCKET_MAX[it.slot] || 0, cur = (it.sockets || []).length;
      if (!max) html += `<div class="smithAct" style="color:#6a5a44">This slot can't hold sockets.</div>`;
      else if (cur >= max) html += `<div class="smithAct" style="color:#6a5a44">Sockets full — ${cur}/${max}.</div>`;
      else { const cost = { dust: 6 + (RTIER[it.rarity] || 1) * 4, gold: Math.round(itemScore(it) * 0.2) + 20 }, can = player.gold >= cost.gold && (character.materials || 0) >= cost.dust; html += `<div class="smithAct"><span>Add socket (${cur}/${max})</span><span class="rprice">${cost.gold}g · ${cost.dust}✦</span><div class="rbtn${can ? '' : ' dis'}" id="smithDo" style="border-color:#3a6a8a">Add Socket</div></div>`; }
    } else {
      if (where === 'eq') html += `<div class="smithAct" style="color:#6a5a44">Equipped — unequip it first to salvage.</div>`;
      else html += `<div class="smithAct"><span>Break down into Dust</span><span class="rprice">+${dustValue(it)}✦</span><div class="rbtn" id="smithDo" style="border-color:#7a3a28">Salvage</div></div>`;
    }
  }
  body.innerHTML = html;
  if (it) { const rn = body.querySelector('.smithSlot .rname'); if (rn) bindTip(rn, it); const db = document.getElementById('smithDo'); if (db) db.onclick = smithAction; }
  if (smithTab === 'salvage') {
    const junk = character.inventory.filter(j => j.rarity === 'common' || j.rarity === 'magic');
    if (junk.length) {
      const jd = junk.reduce((s, j) => s + dustValue(j), 0); const bar = document.createElement('div'); bar.className = 'row'; bar.style.marginTop = '14px'; bar.style.background = 'rgba(40,30,16,.55)';
      bar.innerHTML = `<div class="rname" style="flex:1">Backpack junk <span style="color:#8a7a5a;font-size:11px">(${junk.length} common/magic)</span></div><div class="rbtn" id="smithSalvageJunk" style="border-color:#6a4aa0">Salvage Junk +${jd}✦</div>`; body.appendChild(bar);
      document.getElementById('smithSalvageJunk').onclick = () => { const jk = character.inventory.filter(j => j.rarity === 'common' || j.rarity === 'magic'); if (!jk.length) return; const d = jk.reduce((s, j) => s + dustValue(j), 0); if (jk.includes(smithPick)) smithPick = null; character.materials = (character.materials || 0) + d; character.inventory = character.inventory.filter(j => !(j.rarity === 'common' || j.rarity === 'magic')); sfx('potion'); showMsg('Salvaged junk: +' + d + '✦'); renderSmith(); updatePips(); saveProgress(false); };
    }
  }
}
function affixLines(it) { let s = ''; if (it.slot === 'weapon' && it.baseStat) s += `<div class="base">${it.baseStat} Damage</div>`; else if (it.baseStat) s += `<div class="base">${it.baseStat} Armor</div>`; const keys = Object.keys(it.affixes).sort((a, b) => (AFFIX_CAT_ORD[AFFIX_CAT[a]] || 5) - (AFFIX_CAT_ORD[AFFIX_CAT[b]] || 5)); for (const k of keys) s += `<div class="aff aff-${AFFIX_CAT[k] || 'util'}">+${it.affixes[k]} ${AFFIXES[k].label}</div>`; if (it.enchant && it.enchant.key && AFFIXES[it.enchant.key]) s += `<div class="aff" style="color:#9f6aff">✦ +${it.enchant.val} ${AFFIXES[it.enchant.key].label} (enchant)</div>`; if (it.sockets && it.sockets.length) s += `<div class="aff aff-util">` + it.sockets.map(g => { if (!g) return '◯ (empty)'; const e = gemEff(it.slot, g); return `${GEMS[g.t].ico} +${e.vals[g.q]} ${AFFIXES[e.key].label}`; }).join(' · ') + `</div>`; return s; }
function statBundle(it) { const b = {}; if (it.baseStat) b[it.slot === 'weapon' ? 'Damage' : 'Armor'] = (b[it.slot === 'weapon' ? 'Damage' : 'Armor'] || 0) + it.baseStat; for (const k in it.affixes) { const l = AFFIXES[k] ? AFFIXES[k].label : k; b[l] = (b[l] || 0) + it.affixes[k]; } if (it.enchant && it.enchant.key && AFFIXES[it.enchant.key]) { const l = AFFIXES[it.enchant.key].label; b[l] = (b[l] || 0) + (it.enchant.val || 0); } if (it.sockets) for (const g of it.sockets) { if (g) { const e = gemEff(it.slot, g); if (e) { const l = AFFIXES[e.key].label; b[l] = (b[l] || 0) + e.vals[g.q]; } } } return b; }
function tooltipHTML(it) {
  const eq = character.equipment[it.slot]; let html = `<div class="tname rc-${it.rarity}">${it.name}${it.upgrade ? ' <span style="color:#ffcf6a">+' + it.upgrade + '</span>' : ''}</div><div class="tslot rc-${it.rarity}">${RARITY_NAME[it.rarity] || it.rarity} · ${it.slot} · ilvl ${it.ilvl}${it.upgrade ? ' · +' + Math.round((upFactor(it) - 1) * 100) + '% upgraded' : ''}</div>${affixLines(it)}`;
  if (it.effect) html += `<div style="color:#ffcf6a;margin-top:4px">★ ${it.effectDesc}</div>`;
  if (it.set) {
    const sd = SET_DEFS[it.set]; if (sd) {
      const owned = SLOTS.reduce((n, s) => n + (character.equipment[s] && character.equipment[s].set === it.set ? 1 : 0), 0); html += `<div style="color:#5ad65a;margin-top:6px">${sd.name} (${owned}/${sd.pieces.length})</div>`;
      for (const thr in sd.bonuses) { const bb = sd.bonuses[thr]; const parts = []; for (const k in bb) { if (k === 'effect') parts.push(bb.effect + (bb.effVal ? ' ' + bb.effVal : '')); else if (k !== 'effVal') parts.push('+' + bb[k] + ' ' + k); } html += `<div style="font-size:11px;color:${owned >= +thr ? '#5ad65a' : '#5a6a5a'}">${thr}pc: ${parts.join(', ')}</div>`; }
    }
  }
  if (eq && eq !== it) {
    const a = statBundle(it), b = statBundle(eq); const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])]; let rows = '';
    for (const k of keys) { const d = (a[k] || 0) - (b[k] || 0); if (d === 0) continue; const c = d > 0 ? '#7fd07f' : '#d07f7f'; rows += `<div style="color:${c};font-size:11px">${d > 0 ? '▲ +' : '▼ '}${d} ${k}</div>`; }
    const ds = itemScore(it) - itemScore(eq); const v = ds > 0 ? `<span style="color:#7fd07f">▲ Upgrade (+${ds})</span>` : ds < 0 ? `<span style="color:#d07f7f">▼ Downgrade (${ds})</span>` : `<span style="color:#c8b89a">≈ Sidegrade</span>`;
    html += `<div class="cmp"><div style="margin-bottom:3px">vs equipped <span class="rc-${eq.rarity}">${eq.name}</span></div>${rows}<div style="margin-top:4px">${v}</div></div>`;
  }
  return html;
}
function bindTip(el, it) { el.onmouseenter = e => { tooltip.innerHTML = tooltipHTML(it); tooltip.style.display = 'block'; moveTip(e); }; el.onmousemove = moveTip; el.onmouseleave = () => tooltip.style.display = 'none'; }
function moveTip(e) { const pad = 14; let x = e.clientX - tooltip.offsetWidth - pad; if (x < 8) x = e.clientX + pad; x = clamp(x, 8, Math.max(8, innerWidth - tooltip.offsetWidth - 8)); tooltip.style.left = x + 'px'; tooltip.style.top = clamp(e.clientY - 20, 8, Math.max(8, innerHeight - tooltip.offsetHeight - 8)) + 'px'; }
function charSheetHTML() {
  /** @type {Effects} */ const e = player.effects || {};
  const em = player.elemMult || {};
  const pct = v => Math.round(v) + '%';
  const row = (lbl, val, cls) => `<div class="statrow${cls ? ' ' + cls : ''}"><span>${lbl}</span><b>${val}</b></div>`;
  const sec = (title, rows) => rows ? `<div class="statsec"><div class="statsec-h">${title}</div><div class="statgrid">${rows}</div></div>` : '';
  // Offense — every item-grantable stat always shown, 0/baseline when nothing grants it
  let off = row('Damage', player.dmg) + row('Crit Chance', pct(player.crit * 100)) + row('Crit Damage', '×' + ((e.critdmg ? 3 : 2) + (e.critDmgPct || 0) / 100).toFixed(2)) + row('Attack Speed', (1000 / player.attackRate).toFixed(2) + '/s');
  off += row('Life Leech', pct((e.lifesteal || 0) * 100));
  off += row('Skill Damage', '+' + pct(((player.skillMult || 1) - 1) * 100));
  off += row('Active Skill', '+' + pct(((player.activeSkillDmg || 1) - 1) * 100));
  off += row('+ All Skills', e.allskills || 0);
  off += row('Cooldown Reduction', '+' + pct((player.cdr || 0) * 100));
  off += row('Life on Hit', Math.round(e.lifeOnHit || 0));
  for (const [k, lbl] of [['fire', 'Fire Damage'], ['frost', 'Cold Damage'], ['lightning', 'Lightning Damage'], ['poison', 'Poison Damage']]) off += row(lbl, '+' + pct(((em[k] || 1) - 1) * 100));
  // Defense
  const redux = Math.min(75, Math.round(player.armor / (player.armor + 40) * 100));
  let def = row('Life', player.hpMax) + row('Armor', player.armor + ' (' + redux + '% red.)');
  def += row('Thorns', Math.round(e.thorns || 0));
  def += row('Mana Shield', pct((e.manaShield || 0) * 100));
  def += row('Life Regen', ((player.hpRegen || 0) * 1000).toFixed(1) + '/s');
  def += row('Dodge', pct((e.dodge || 0) * 100));
  def += row('Damage Reduction', pct((e.flatDR || 0) * 100));
  // Resistances — effective = element + all, capped at 75%
  const ar = e.allRes || 0, rres = k => Math.min(75, Math.round((e[k] || 0) + ar));
  const res = row('Fire', rres('fireRes') + '%', 'res-fire') + row('Cold', rres('frostRes') + '%', 'res-cold') + row('Lightning', rres('lightningRes') + '%', 'res-light') + row('Poison', rres('poisonRes') + '%', 'res-poison');
  // Utility
  let util = row('Mana', player.mpMax);
  util += row('Move Speed', '+' + pct((e.movespeed || 0) * 100));
  util += row('Mana Leech', pct((e.manaleech || 0) * 100));
  util += row('Mana Regen', ((player.mpRegen || 0) * 1000).toFixed(1) + '/s');
  util += row('Magic Find', '+' + pct((lootLuck || 0) * 100));
  util += row('Gold Find', '+' + pct((player.goldFind || 0) * 100));
  util += row('STR', player.str) + row('DEX', player.dex) + row('VIT', player.vit) + row('ENG', player.eng);
  return `<div class="statname"><b>${escapeHtml(character.name)}</b> · Level ${player.level}</div>` + sec('Offense', off) + sec('Defense', def) + sec('Resistances', res) + sec('Utility', util);
}
let invTab = 'items';
function setInvTab(t) {
  invTab = t === 'gems' ? 'gems' : 'items';
  document.querySelectorAll('#invTabs .tab').forEach(el => el.classList.toggle('on', el.dataset.invtab === invTab));
  const ig = document.getElementById('invGrid'), gg = document.getElementById('gemGrid'), hint = document.getElementById('invHint');
  if (ig) ig.style.display = invTab === 'items' ? 'grid' : 'none';
  if (gg) gg.style.display = invTab === 'gems' ? 'grid' : 'none';
  if (hint) hint.textContent = invTab === 'gems' ? 'Gems stack with no limit — hover to see their stats. Socket them into gear at the Jeweler.' : 'Click a backpack item to equip • Click equipped item to remove • Hover to compare';
  renderInv();
}
/* Gems aren't equippable — they show their effect for each socket category (a gem grants a different stat in a
   weapon vs armor vs jewelry), so the tooltip lists all three at the gem's quality. */
function gemTipHTML(t, q, n) {
  const G = GEMS[t]; if (!G) return '';
  const qn = ['Chipped', 'Flawed', 'Normal', 'Flawless', 'Perfect'][q] || 'Normal';
  let rows = '';
  for (const [c, lbl] of [['weapon', 'In a Weapon'], ['gear', 'In Armor / Gear'], ['jewelry', 'In a Ring / Amulet']]) { const e = G[c]; if (!e) continue; const a = AFFIXES[e.key]; rows += `<div class="aff aff-util">${lbl}: <b>+${e.vals[q]}</b> ${a ? a.label : e.key}</div>`; }
  return `<div class="tname" style="color:#9fe8ff">${G.ico} ${gemName({ t, q })}</div><div class="tslot">Gem · ${qn} quality · ×${n} held</div>${rows}`;
}
function renderInv() {
  const eg = document.getElementById('equipGrid'); eg.innerHTML = '';
  for (const s of SLOTS) { const it = character.equipment[s]; const c = document.createElement('div'); c.className = 'cell' + (it ? ' r-' + it.rarity : ''); c.style.gridArea = s; c.innerHTML = `<span class="lbl">${s}</span>${it ? SLOT_ICON[s] : '<span style="opacity:.25">' + SLOT_ICON[s] + '</span>'}`; if (it) { bindTip(c, it); c.onclick = () => smithOpen ? selectSmithItem(it) : enchantOpen ? selectEnchantItem(it) : jewelerOpen && jewelerTab === 'socket' ? selectSocketItem(it) : unequip(s); if ((smithOpen && smithPick === it) || (enchantOpen && enchantPick === it) || (jewelerOpen && jewelerTab === 'socket' && socketPick === it)) c.classList.add('smithSel'); } eg.appendChild(c); }
  document.getElementById('charStats').innerHTML = charSheetHTML();
  const ig = document.getElementById('invGrid'); ig.innerHTML = ''; for (let i = 0; i < character.invMax; i++) { const it = character.inventory[i]; const c = document.createElement('div'); c.className = 'cell' + (it ? ' r-' + it.rarity : ''); if (it) { const up = itemScore(it) > itemScore(character.equipment[it.slot]); c.innerHTML = (up ? '<span class="upg">▲</span>' : '') + SLOT_ICON[it.slot]; if (up) c.classList.add('isupg'); bindTip(c, it); c.onclick = () => smithOpen ? selectSmithItem(it) : enchantOpen ? selectEnchantItem(it) : jewelerOpen && jewelerTab === 'socket' ? selectSocketItem(it) : equipFromInv(i); if ((smithOpen && smithPick === it) || (enchantOpen && enchantPick === it) || (jewelerOpen && jewelerTab === 'socket' && socketPick === it)) c.classList.add('smithSel'); } ig.appendChild(c); }
  const gg = document.getElementById('gemGrid');
  if (gg) {
    gg.innerHTML = ''; const gems = character.gems || {}; const keys = Object.keys(gems).filter(k => gems[k] > 0).sort();
    if (!keys.length) gg.innerHTML = '<div class="invHint" style="grid-column:1/-1;text-align:center;padding:10px 0">No gems yet — slain foes drop them.</div>';
    else for (const k of keys) { const t = k.split(':')[0], q = +k.split(':')[1], n = gems[k]; if (!GEMS[t]) continue; const c = document.createElement('div'); c.className = 'cell'; c.style.cursor = 'default'; c.innerHTML = `${GEMS[t].ico}<span class="gcount">${n}</span>`; const html = gemTipHTML(t, q, n); c.onmouseenter = e => { tooltip.innerHTML = html; tooltip.style.display = 'block'; moveTip(e); }; c.onmousemove = moveTip; c.onmouseleave = () => tooltip.style.display = 'none'; gg.appendChild(c); }
  }
  goldTxt.textContent = player.gold + ' g'; const _dt = document.getElementById('dustTxt'); if (_dt) _dt.textContent = (character.materials || 0) + ' Dust'; /* currency bar lives at the bottom of the inventory now */
}
function equipFromInv(i) { const it = character.inventory[i]; if (!it) return; const prev = character.equipment[it.slot]; character.equipment[it.slot] = it; character.inventory.splice(i, 1); if (prev) character.inventory.push(prev); recompute(); attachHeroWeapon(); renderInv(); renderOpenShop(); tooltip.style.display = 'none'; saveProgress(false); }
function unequip(s) { const it = character.equipment[s]; if (!it) return; if (character.inventory.length >= character.invMax) { showMsg('Bag full'); return; } character.inventory.push(it); character.equipment[s] = null; recompute(); attachHeroWeapon(); renderInv(); renderOpenShop(); tooltip.style.display = 'none'; saveProgress(false); }
let ptT = { x: 0, y: 0, s: 1 };
const PT_NAMES = { str: 'Strength', dex: 'Dexterity', vit: 'Vitality', eng: 'Energy', hp: 'Life', mp: 'Mana', dmg: 'Damage', armor: 'Armor', crit: 'Crit Chance', meleePct: '% Melee Damage', spellPct: '% Spell Damage', armorPct: '% Armor', hpPct: '% Life', allskills: 'to All Skills', pierce: 'Pierce', lifesteal: 'Life Leech', movespeed: '% Move Speed', thorns: 'Thorns' };
function ptNote() { document.getElementById('skillPtsNote').textContent = character.skillPoints + ' point' + (character.skillPoints === 1 ? '' : 's') + ' to spend · drag to pan · scroll to zoom'; }
function renderSkillTree() {
  ptNote(); const start = PTREE.nodes[PTREE.starts[character.class]]; ptT = { x: -start.x, y: -start.y, s: 1.1 };
  const c = document.getElementById('skillTree');
  c.innerHTML = `<div id="ptVp" style="position:relative;width:100%;height:calc(100vh - 250px);min-height:340px;overflow:hidden;border:1px solid #2a2218;border-radius:8px;background:radial-gradient(circle at 50% 45%,#161109,#080604);cursor:grab"><svg id="ptSvg" width="100%" height="100%" viewBox="-260 -260 520 520"><defs><filter id="pg" x="-90%" y="-90%" width="280%" height="280%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g id="ptG"></g></svg></div>`;
  buildPTreeSvg(); attachPTreeEvents();
}
function applyPT() { const g = document.getElementById('ptG'); if (g) g.setAttribute('transform', `scale(${ptT.s}) translate(${ptT.x} ${ptT.y})`); }
function buildPTreeSvg() {
  const g = document.getElementById('ptG'); if (!g) return; const alloc = new Set(character.passives || []); let edges = '', circles = '', drawn = new Set();
  for (const id in PTREE.adj) { for (const nb of PTREE.adj[id]) { const key = id < nb ? id + '|' + nb : nb + '|' + id; if (drawn.has(key)) continue; drawn.add(key); const a = PTREE.nodes[id], b = PTREE.nodes[nb]; if (!a || !b) continue; const on = alloc.has(id) && alloc.has(nb); edges += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${on ? '#c4a060' : '#2a241c'}" stroke-width="${on ? 3 : 2}"/>`; } }
  for (const id in PTREE.nodes) {
    const n = PTREE.nodes[id]; const allocated = alloc.has(id); const adjA = PTREE.adj[id].some(x => alloc.has(x)); const can = !allocated && character.skillPoints > 0 && adjA;
    const r = n.type === 'keystone' ? 15 : n.type === 'notable' ? 11 : n.type === 'start' ? 12 : 6.5;
    const fill = allocated ? (n.type === 'keystone' ? '#ffcf3a' : n.type === 'notable' ? '#e6b84d' : '#c8ad7a') : '#16110a';
    const stroke = n.type === 'start' ? '#ffe27a' : allocated ? '#ffe9a8' : can ? '#e6b84d' : adjA ? '#7a663f' : '#352c20';
    circles += `<circle data-pt="${id}" cx="${n.x}" cy="${n.y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${can ? 3 : 2}" ${can ? 'filter="url(#pg)"' : ''} style="cursor:pointer"/>`;
    if (n.type === 'notable' || n.type === 'keystone') circles += `<text x="${n.x}" y="${n.y - r - 3}" text-anchor="middle" fill="#cdb084" font-size="9" font-family="Georgia" style="pointer-events:none">${n.label}</text>`;
  }
  g.innerHTML = edges + circles; applyPT();
  g.querySelectorAll('[data-pt]').forEach(el => {
    const id = el.getAttribute('data-pt'); const n = PTREE.nodes[id];
    el.onmouseenter = e => { tooltip.innerHTML = ptTip(n); tooltip.style.display = 'block'; moveTip(e); }; el.onmousemove = moveTip; el.onmouseleave = () => tooltip.style.display = 'none';
    el.onclick = ev => { ev.stopPropagation(); ptClick(id); };
  });
}
function ptTip(n) {
  let lines = ''; for (const k in n.mods) { if (k === 'critdmg') { lines += '<div style="color:#b8a888">Critical hits deal 3x damage</div>'; continue; } let v = n.mods[k]; if (k === 'movespeed' || k === 'lifesteal') v = Math.round(v * 100) + '%'; lines += `<div style="color:#b8a888">+${v} ${PT_NAMES[k] || k}</div>`; }
  const t = n.type === 'keystone' ? 'Keystone' : n.type === 'notable' ? 'Notable' : n.type === 'start' ? 'Class Start' : 'Passive';
  return `<div class="tname" style="color:${n.type === 'keystone' ? '#ffcf3a' : '#e6b84d'}">${n.label || t}</div><div class="tslot">${t}</div>${lines || '<div style="color:#8a7a5a">Pathway node</div>'}`;
}
function ptClick(id) {
  const start = PTREE.starts[character.class]; const alloc = character.passives || (character.passives = []); const has = alloc.includes(id);
  if (!has) { if (character.skillPoints <= 0) return; if (!PTREE.adj[id].some(x => alloc.includes(x))) return; alloc.push(id); character.skillPoints--; }
  else { if (id === start) return; const rest = new Set(alloc.filter(x => x !== id)); const seen = new Set([start]), q = [start]; while (q.length) { const cur = q.shift(); for (const nb of PTREE.adj[cur]) if (rest.has(nb) && !seen.has(nb)) { seen.add(nb); q.push(nb); } } if (seen.size !== rest.size) return; character.passives = alloc.filter(x => x !== id); character.skillPoints++; }
  recompute(); buildPTreeSvg(); renderSkillbar(); updatePips(); ptNote(); saveProgress(false);
}
function attachPTreeEvents() {
  // Use element-level on* handlers (like attachRuneEvents) — every panel render used to add fresh anonymous
  // window mousemove/mouseup listeners that were never removed, leaking listeners and pinning each detached tree.
  const vp = document.getElementById('ptVp'); if (!vp) return; let drag = false, lx = 0, ly = 0;
  vp.onmousedown = e => { drag = true; lx = e.clientX; ly = e.clientY; vp.style.cursor = 'grabbing'; };
  vp.onmousemove = e => { if (!drag) return; const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; const rect = vp.getBoundingClientRect(); ptT.x += dx / rect.width * 520 / ptT.s; ptT.y += dy / rect.height * 520 / ptT.s; applyPT(); };
  vp.onmouseup = () => { drag = false; vp.style.cursor = 'grab'; }; vp.onmouseleave = () => { drag = false; vp.style.cursor = 'grab'; };
  vp.onwheel = e => { e.preventDefault(); ptT.s = clamp(ptT.s * (e.deltaY < 0 ? 1.12 : 0.89), 0.55, 2.4); applyPT(); };
}
document.getElementById('resetSkills').onclick = () => { const start = PTREE.starts[character.class]; const refund = (character.passives || []).filter(x => x !== start).length; character.passives = [start]; character.skillPoints += refund; recompute(); buildPTreeSvg(); renderSkillbar(); updatePips(); ptNote(); saveProgress(false); };
/* ---------- Abilities tab: loadout assignment + per-skill rune trees ---------- */
let _abilSlotSel = 1, _runeViewId = null, rT = { x: 0, y: 0, s: 1 };
