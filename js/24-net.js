const NET = {
  ws: null, id: 0, connected: false, name: '', remotes: new Map(), sendT: 0,
  connect(host, port, name) {
    this.name = (name || 'Hero').slice(0, 14); if (!host) { this.status('Enter a host address'); return; }
    // Tear down any prior socket first, or a repeat Connect orphans it — its handlers keep firing and its
    // remote ghosts leak. Null the handlers before close() so the old socket's onclose can't clobber new state.
    if (this.ws) { try { this.ws.onopen = this.ws.onmessage = this.ws.onclose = this.ws.onerror = null; this.ws.close(); } catch (_) { } }
    this.clearRemotes(); this.connected = false;
    try { this.ws = new WebSocket('ws://' + host + ':' + (port || 8787)); } catch (e) { this.status('Invalid address'); return; }
    this.status('Connecting…');
    this.ws.onopen = () => { this.connected = true; this.status('Connected — adventuring together'); this.refreshUI(); };
    this.ws.onclose = () => { this.connected = false; this.clearRemotes(); this.status('Disconnected'); this.refreshUI(); };
    this.ws.onerror = () => { this.status('Connection failed (is the server running & port open?)'); };
    this.ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (_) { return; } this.onMsg(m); };
  },
  disconnect() { if (this.ws) { try { this.ws.close(); } catch (_) { } } this.ws = null; this.connected = false; this.clearRemotes(); this.refreshUI(); this.status('Not connected'); },
  send(o) { if (this.connected && this.ws && this.ws.readyState === 1) { try { this.ws.send(JSON.stringify(o)); } catch (_) { } } },
  onMsg(m) { if (m.t === 'welcome') { this.id = m.id; } else if (m.t === 'state') { this.upsert(m); } else if (m.t === 'leave') { this.removeRemote(m.id); } else if (m.t === 'chat') { this.chat(m.name, m.msg); } },
  upsert(m) {
    let r = this.remotes.get(m.id); if (!r) { const mesh = buildHero(); mesh.scale.set(0.96, 0.96, 0.96); mesh.visible = false; scene.add(mesh); r = { mesh }; this.remotes.set(m.id, r); }
    // Coerce every relayed field — the relay forwards peer payloads verbatim, so a NaN/string x/z/dir would
    // poison the scene-graph transform (and the projected nameplate), and an unknown class must not recolor.
    r.x = +m.x || 0; r.z = +m.z || 0; r.dir = +m.dir || 0; r.zone = m.zone; r.depth = +m.depth || 0; r.name = String(m.name || 'Player').slice(0, 24); r.cls = m.cls; r.level = +m.level || 1; r.hp = +m.hp || 0; r.hpMax = +m.hpMax || 1;
    if (r.mesh.userData.cloak && Object.prototype.hasOwnProperty.call(CLASSES, m.cls)) r.mesh.userData.cloak.material.color.setHex(CLASSES[m.cls].col);
  },
  removeRemote(id) { const r = this.remotes.get(id); if (r) { removeMesh(r.mesh); this.remotes.delete(id); } },
  clearRemotes() { for (const [, r] of this.remotes) removeMesh(r.mesh); this.remotes.clear(); },
  tick(dt) {
    if (!this.connected) return; this.sendT -= dt; if (this.sendT <= 0 && character && running) { this.sendT = 110; this.send({ t: 'state', x: +player.x.toFixed(2), z: +player.z.toFixed(2), dir: +player.dir.toFixed(2), zone, depth, name: this.name || character.name, cls: character.class, level: player.level, hp: Math.round(player.hp), hpMax: player.hpMax }); }
    for (const [, r] of this.remotes) { const vis = (running && r.zone === zone && r.depth === depth); r.mesh.visible = vis; if (vis) { r.mesh.position.set(r.x, Math.abs(Math.sin(now() * 0.005)) * 0.12, r.z); r.mesh.rotation.y = r.dir || 0; } }
  },
  status(s) { const el = document.getElementById('mpStatus'); if (el) el.textContent = s; },
  refreshUI() { const c = this.connected; document.getElementById('mpConnect').style.display = c ? 'none' : 'block'; document.getElementById('mpDisconnect').style.display = c ? 'block' : 'none'; document.getElementById('mpChatWrap').style.display = c ? 'block' : 'none'; },
  chat(name, msg) { const log = document.getElementById('mpChatLog'); if (log) { const d = document.createElement('div'); d.innerHTML = '<b style="color:#9fd8ff">' + escapeHtml(name) + ':</b> ' + escapeHtml(msg); log.appendChild(d); while (log.childNodes.length > 200) log.removeChild(log.firstChild); log.scrollTop = log.scrollHeight; } if (running) showMsg(name + ': ' + msg); }
};
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const mpModal = document.getElementById('mpModal');
function openMP() { document.getElementById('mpName').value = NET.name || (character ? character.name : ''); mpModal.style.display = 'block'; NET.refreshUI(); syncBackdrop(); }
function closeMP() { mpModal.style.display = 'none'; syncBackdrop(); }
document.getElementById('mpBtn').onclick = openMP;
document.getElementById('menuMP').onclick = openMP;
document.getElementById('mpClose').onclick = closeMP;
document.getElementById('mpConnect').onclick = () => NET.connect(document.getElementById('mpHost').value.trim(), document.getElementById('mpPort').value.trim(), document.getElementById('mpName').value.trim());
document.getElementById('mpDisconnect').onclick = () => NET.disconnect();
function mpSendChat() { const inp = document.getElementById('mpChatInput'); const v = inp.value.trim(); if (!v || !NET.connected) return; const nm = NET.name || (character ? character.name : 'Hero'); NET.send({ t: 'chat', name: nm, msg: v }); NET.chat(nm, v); inp.value = ''; }
document.getElementById('mpChatSend').onclick = mpSendChat;
document.getElementById('mpChatInput').addEventListener('keydown', e => { if (e.key === 'Enter') mpSendChat(); });
