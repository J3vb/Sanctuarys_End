// ---- waypoint fast-travel ----
const wpModal = document.getElementById('wpModal');
function addWpRow(icon, name, sub, fn) { const d = document.createElement('div'); d.className = 'wprow'; d.innerHTML = `<div class="wic">${icon}</div><div class="winfo"><div class="wn">${name}</div><div class="ws">${sub}</div></div><div class="wbtn">Travel</div>`; d.querySelector('.wbtn').onclick = fn; document.getElementById('wpList').appendChild(d); }
// Depth picker: lets the player jump to ANY depth they've already reached (1..maxDepth), via quick chips,
// a clamped number input, or Enter. Never allows exceeding maxDepth, so it can't be used to skip ahead.
function addDepthRow() {
  const max = Math.max(1, (character && character.maxDepth) || 1); const d = document.createElement('div'); d.className = 'wprow';
  const bosses = []; for (let b = 5; b <= max; b += 5) bosses.push(b); const quick = [...new Set([1, ...bosses.slice(-3), max])].filter(n => n >= 1 && n <= max).sort((a, b) => a - b);
  let chips = ''; for (const n of quick) chips += `<span class="wbtn dpchip" data-d="${n}" style="padding:3px 9px;margin:0 4px 4px 0;display:inline-block">${n === max ? '★ ' : ''}${n}</span>`;
  d.innerHTML = `<div class="wic">⬇️</div><div class="winfo"><div class="wn">Jump to Depth</div><div class="ws">Travel to any depth you've reached (1–${max})</div><div style="margin-top:6px">${chips}</div></div><div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end"><input id="dpInput" type="number" min="1" max="${max}" value="${max}" style="width:66px;background:#0d0a06;border:1px solid #3a5a7a;color:#cfe2ff;border-radius:4px;padding:5px 6px;font-size:13px"><div class="wbtn" id="dpGo">Descend</div></div>`;
  document.getElementById('wpList').appendChild(d);
  const go = v => travelTo('descent', 'depth', clamp(Math.round(+v || 1), 1, max));
  d.querySelector('#dpGo').onclick = () => go(document.getElementById('dpInput').value);
  d.querySelector('#dpInput').onkeydown = e => { if (e.key === 'Enter') go(e.target.value); };
  d.querySelectorAll('.dpchip').forEach(el => { el.onclick = () => go(el.dataset.d); });
}
function renderWaypoints() {
  const list = document.getElementById('wpList'); list.innerHTML = '';
  for (const r of REGIONS) {
    const here = (zone === 'wild' && curRegion && curRegion.id === r.id);
    const disc = r.town === 'town' || (character && character.discovered && character.discovered[r.town]);
    if (!disc) { addWpRow('❓', r.name + ' — undiscovered', 'Press onward through the wilds to reach it', () => showMsg('Press deeper through the wilds to find ' + r.name)); continue; }
    addWpRow('🌲', r.name + (here ? ' (here)' : ''), 'Wilderness · Lv ' + r.lvl, () => travelTo(r.id));
  }
  for (const a of AREAS) {
    if (a.kind === 'wild') continue;
    if (a.kind === 'dungeon') { addWpRow('🕳️', 'The Descent — Depth 1', 'Dungeon entrance', () => travelTo('descent', 'start')); if (character && character.maxDepth > 1) { addWpRow('🔥', 'The Descent — Depth ' + character.maxDepth, 'Your deepest checkpoint', () => travelTo('descent', 'deep')); addDepthRow(); } continue; }
    if (character && character.discovered && !character.discovered[a.id]) { addWpRow('❓', a.name + ' — undiscovered', 'Find its portal out in the wilds', () => showMsg('Search the wilderness for ' + a.name)); continue; }
    const here = (zone === 'town' && curTownArea && curTownArea.id === a.id);
    const icon = a.tier >= 2 ? '🔥' : a.tier >= 1 ? '🏰' : '🏡'; const sub = a.tier >= 2 ? 'Endgame hub · exotic wares' : a.tier >= 1 ? 'Hub · premium wares' : 'Safe hub · merchant & stash';
    addWpRow(icon, a.name + (here ? ' (here)' : ''), sub, () => travelTo(a.id));
  }
}
function openWaypoints() { if (!running) return; renderWaypoints(); wpModal.style.display = 'block'; syncBackdrop(); }
function closeWaypoints() { wpModal.style.display = 'none'; syncBackdrop(); }
document.getElementById('wpBtn').onclick = openWaypoints;
document.getElementById('wpClose').onclick = closeWaypoints;
// Waypoint / Sound / Debug hotkeys handled by the unified keybind dispatcher above
addEventListener('beforeunload', () => { if (running) saveProgress(false); });
document.getElementById('backdrop').onclick = () => { if (wpModal && wpModal.style.display === 'block') closeWaypoints(); else if (mpModal && mpModal.style.display === 'block') closeMP(); else if (settingsModal && settingsModal.style.display === 'block') closeSettings(); else if (helpModal && helpModal.style.display === 'block') closeHelp(); };
