function pick(ev) {
  ndc.x = (ev.clientX / innerWidth) * 2 - 1; ndc.y = -(ev.clientY / innerHeight) * 2 + 1; ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObject(ground); if (hit.length) mouseWorld.copy(hit[0].point); return monsterAt();
}
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
renderer.domElement.addEventListener('mousedown', e => {
  if (!running || busyPanel() || anyModal()) return; e.preventDefault(); const m = pick(e);
  if (e.button === 2) { rmbDown = true; if (isCombat()) castActive(character.loadout[1], { x: mouseWorld.x, z: mouseWorld.z }); return; }
  if (e.button === 0) { lmbDown = true; if (m && isCombat()) { target = m; moveTarget = null; } else { moveTarget = { x: mouseWorld.x, z: mouseWorld.z }; target = null; } }
});
renderer.domElement.addEventListener('mousemove', e => { if (running && !busyPanel() && !anyModal()) pick(e); });
addEventListener('mouseup', e => { if (e.button === 2) rmbDown = false; else if (e.button === 0) lmbDown = false; });
renderer.domElement.addEventListener('mouseleave', () => { lmbDown = rmbDown = false; });
addEventListener('blur', () => { lmbDown = rmbDown = false; });
addEventListener('wheel', e => { if (!running || busyPanel() || anyModal()) return; camDist = clamp(camDist + Math.sign(e.deltaY) * 4, 28, 72); camHeight = camDist * 0.9; });
/* ---------- centralized keybinds + single dispatcher ---------- */
/* Keybinds use KeyboardEvent.code (PHYSICAL key) so they're AZERTY/QWERTZ-safe — e.key would shift with layout. */
const DEFAULT_KEYBINDS = { toggleInv: ['KeyI', 'KeyB'], toggleSkill: ['KeyK'], enterTown: ['KeyT'], interact: ['KeyE'], hpPotion: ['Space'], manaPotion: ['KeyQ'], toggleMap: ['KeyG'], toggleSound: ['KeyM'], toggleDebug: ['Backquote'], toggleHelp: ['KeyH', 'Slash'], close: ['Escape'], skill1: ['Digit1'], skill2: ['Digit2'], skill3: ['Digit3'], skill4: ['Digit4'] };
const KEYBIND_LABELS = { toggleInv: 'Inventory', toggleSkill: 'Skills', enterTown: 'Return to Town', interact: 'Interact', hpPotion: 'Health Potion', manaPotion: 'Mana Potion', toggleMap: 'Waypoint Map', toggleSound: 'Toggle Sound', toggleDebug: 'Debug Overlay', toggleHelp: 'Help', close: 'Close / Cancel', skill1: 'Skill Slot 1', skill2: 'Skill Slot 2', skill3: 'Skill Slot 3', skill4: 'Skill Slot 4' };
const KEYBIND_ORDER = ['skill1', 'skill2', 'skill3', 'skill4', 'toggleInv', 'toggleSkill', 'enterTown', 'interact', 'hpPotion', 'manaPotion', 'toggleMap', 'toggleSound', 'toggleHelp', 'toggleDebug'];
let KEYBINDS = {};
// Convert a legacy e.key-char bind (pre-V7 saves) to an event.code; returns null if unmappable (caller falls back to default).
function migrateKey(k) {
  if (typeof k !== 'string' || !k) return null;
  if (/^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Arrow(Up|Down|Left|Right)|Space|Escape|Backquote|Slash|Minus|Equal|Comma|Period|Semicolon|Quote|Backslash|Bracket(Left|Right)|F\d{1,2}|Enter|Tab)$/.test(k)) return k;
  if (k === ' ') return 'Space';
  if (k === 'Escape') return 'Escape';
  if (k === '`' || k === '~') return 'Backquote';
  if (k === '?' || k === '/') return 'Slash';
  if (k.length === 1) { const c = k.toLowerCase(); if (c >= 'a' && c <= 'z') return 'Key' + c.toUpperCase(); if (c >= '0' && c <= '9') return 'Digit' + c; }
  return null;
}
function buildKeybinds() {
  const u = (SAVE._data.settings && SAVE._data.settings.keybinds) || {}; KEYBINDS = {}; let dirty = false;
  for (const a in DEFAULT_KEYBINDS) {
    let arr = Array.isArray(u[a]) ? u[a].map(migrateKey).filter(Boolean) : null;
    if (Array.isArray(u[a]) && (!arr || arr.length !== u[a].length)) dirty = true;
    KEYBINDS[a] = (arr && arr.length) ? arr : DEFAULT_KEYBINDS[a].slice();
  }
  if (dirty && SAVE._data.settings) { const out = {}; for (const a in u) if (KEYBINDS[a]) out[a] = KEYBINDS[a].slice(); SAVE._data.settings.keybinds = out; SAVE.persist(); }
  return KEYBINDS;
}
buildKeybinds();
function normalizeKey(e) { return e.code || e.key; }
function keyLabel(c) {
  if (!c) return '?';
  if (/^Key[A-Z]$/.test(c)) return c.slice(3);
  if (/^Digit[0-9]$/.test(c)) return c.slice(5);
  if (/^Numpad[0-9]$/.test(c)) return 'Num ' + c.slice(6);
  const M = { Space: 'Space', Escape: 'Esc', Backquote: '`', Slash: '/', Minus: '-', Equal: '=', Comma: ',', Period: '.', Semicolon: ';', Quote: "'", Backslash: '\\', BracketLeft: '[', BracketRight: ']', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Tab: 'Tab' };
  return M[c] || c;
}
function actionForKey(e) { const k = normalizeKey(e); for (const a in KEYBINDS) { if (KEYBINDS[a].indexOf(k) >= 0) return a; } return null; }
let capturingAction = null, captureCb = null;
addEventListener('keydown', e => {
  if (capturingAction) { e.preventDefault(); if (captureCb) captureCb(e); return; }
  const a = actionForKey(e);
  const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && a !== 'close') return;
  if (a === 'close') { if (wpModal && wpModal.style.display === 'block') { closeWaypoints(); } else if (mpModal && mpModal.style.display === 'block') { closeMP(); } else if (settingsModal && settingsModal.style.display === 'block') { closeSettings(); } else if (helpModal && helpModal.style.display === 'block') { closeHelp(); } else if (running && anyPanel()) { closeAll(); } return; }
  if (a === 'toggleDebug') { _dbgOn = !_dbgOn; const el = document.getElementById('dbg'); if (el) { el.style.display = _dbgOn ? 'block' : 'none'; if (_dbgOn) updateDebug(); } return; }
  if (a === 'toggleHelp') { if (helpModal.style.display === 'block') { closeHelp(); } else if (running && !anyModal()) { openHelp(); } return; }
  if (a === 'toggleMap') { if (wpModal.style.display === 'block') { closeWaypoints(); } else if (running && !anyModal() && !anyPanel()) { openWaypoints(); } return; }
  if (anyModal()) return;
  if (!running) return;
  if (a === 'toggleSound') { toggleSound(); return; }
  if (a === 'toggleInv') { toggleInv(); return; }
  if (a === 'toggleSkill') { toggleSkill(); return; }
  if (a === 'enterTown') { if (zone !== 'town') enterTown(); return; }
  if (a === 'interact') { interact(); return; }
  if (busyPanel()) return; /* inventory stays live: skill-select + potions work with it open */
  if (a === 'skill1') { if (isCombat() && !player.stunned) castActive(character.loadout[2], { x: mouseWorld.x, z: mouseWorld.z }); return; }
  if (a === 'skill2') { if (isCombat() && !player.stunned) castActive(character.loadout[3], { x: mouseWorld.x, z: mouseWorld.z }); return; }
  if (a === 'skill3') { if (isCombat() && !player.stunned) castActive(character.loadout[4], { x: mouseWorld.x, z: mouseWorld.z }); return; }
  if (a === 'skill4') { if (isCombat() && !player.stunned) castActive(character.loadout[5], { x: mouseWorld.x, z: mouseWorld.z }); return; }
  if (a === 'hpPotion') { drinkPotion(); return; }
  if (a === 'manaPotion') { drinkManaPotion(); return; }
});

/* ---------- casting / combat ---------- */
const _cd = {};
const SPELLKINDS = new Set(['fire', 'frost', 'nova', 'chain', 'meteor', 'frostnova', 'arcaneorb', 'blizzard']);
const SFX_FOR = { cleave: 'melee', multishot: 'melee', whirl: 'melee', groundslam: 'nova', charge: 'melee', warcry: 'level', shadowstep: 'melee', fanofknives: 'melee', arcaneorb: 'fire', blizzard: 'frost', teleportstorm: 'nova', secondwind: 'potion' };
/* Single source of truth for per-skill damage coefficients — consumed by castActive (the live damage)
   AND by skillDamageInfo (the hover tooltip), so the displayed number can never drift from the dealt number.
   coef(rank) → damage multiplier on player.dmg. school: spell=spellMult·skM, melee=meleeMult·skM, skill=skM only, none=no damage.
   hits/perTick/note/critMult are display metadata only. */
const SKILL_COEF = {
  strike: { coef: r => 1, school: 'melee', note: 'basic attack' },
  fire: { coef: r => 1.4 + 0.2 * r, school: 'spell' },
  frost: { coef: r => 0.9 + 0.15 * r, school: 'spell', note: 'slows' },
  nova: { coef: r => 0.9 + 0.12 * r, school: 'spell', hits: r => 12 + 2 * r, note: 'ring of bolts' },
  chain: { coef: r => 1.2 + 0.2 * r, school: 'skill', hits: r => 3 + r, note: '−15% per jump' },
  multishot: { coef: r => 0.8, school: 'melee', hits: 3 },
  volley: { coef: r => 0.6 + 0.1 * r, school: 'melee', hits: 5 },
  cleave: { coef: r => 1.3, school: 'melee', note: 'cone AoE' },
  whirl: { coef: r => 0.9 + 0.15 * r, school: 'melee', note: 'AoE' },
  leap: { coef: r => 1.0 + 0.2 * r, school: 'melee', note: 'AoE on landing' },
  blink: { school: 'none', note: 'teleport' },
  meteor: { coef: r => 1.6 + 0.3 * r, school: 'spell', note: 'AoE' },
  frostnova: { coef: r => 0.8 + 0.12 * r, school: 'spell', note: 'AoE slow' },
  groundslam: { coef: r => 1.2 + 0.25 * r, school: 'melee', note: 'cone · knockback' },
  charge: { coef: r => 1.1 + 0.2 * r, school: 'melee', note: 'dash' },
  warcry: { school: 'none', note: '+dmg / −dmg taken, 8s' },
  arcaneorb: { coef: r => 1.6 + 0.3 * r, school: 'spell', note: 'pierces' },
  blizzard: { coef: r => 0.4 + 0.08 * r, school: 'spell', perTick: true, note: 'over time' },
  teleportstorm: { coef: r => 0.7 + 0.15 * r, school: 'spell', hits: 2, note: 'blasts both ends' },
  shadowstep: { coef: r => 1.6 + 0.3 * r, school: 'melee', critMult: true, note: 'guaranteed crit' },
  fanofknives: { coef: r => 0.5 + 0.1 * r, school: 'melee', hits: r => 10 + 2 * r },
  secondwind: { school: 'none', note: 'heals from spent mana' },
};
