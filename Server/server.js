/*
 * Sanctuary's End — co-op relay server
 * -------------------------------------
 * A tiny WebSocket relay. It does NOT run the game; it just forwards
 * presence/chat messages between everyone connected, so players can see
 * each other moving and fighting in the same world.
 *
 * SETUP (host machine, needs Node.js 16+):
 *     npm install ws
 *     node server.js
 *
 * Then in the game's Multiplayer menu, everyone (including the host)
 * enters the HOST machine's IP address and this port (default 8787).
 *
 *   - Same LAN/Wi-Fi: use the host's local IP (e.g. 192.168.1.10).
 *     Find it with `ipconfig` (Windows) or `ipconfig getifaddr en0` (macOS).
 *   - Over the internet: forward this port (TCP 8787) on the host's
 *     router to the host machine, and players use the host's public IP.
 *
 * The game now loads Three.js as ES modules, so it must be served over
 * http:// (a local static server) -- file:// no longer works. Serve the repo
 * and open it at http://localhost:8000 (not https://) so the browser allows
 * the ws:// connection. See the project README "Play it -> Locally".
 */
const WebSocket = require('ws');
const PORT = process.env.PORT || 8787;

const wss = new WebSocket.Server({ port: PORT, host: '0.0.0.0' });
let nextId = 1;

wss.on('connection', (ws) => {
  const id = nextId++;
  ws._id = id;
  ws.send(JSON.stringify({ t: 'welcome', id }));
  console.log(`[+] player ${id} connected (${wss.clients.size} online)`);

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch (e) { return; }
    msg.id = id; // stamp sender id; ignore any client-claimed id
    const out = JSON.stringify(msg);
    for (const c of wss.clients) {
      if (c !== ws && c.readyState === WebSocket.OPEN) c.send(out);
    }
  });

  ws.on('close', () => {
    const out = JSON.stringify({ t: 'leave', id });
    for (const c of wss.clients) {
      if (c.readyState === WebSocket.OPEN) c.send(out);
    }
    console.log(`[-] player ${id} left (${wss.clients.size} online)`);
  });

  ws.on('error', () => {});
});

console.log(`Sanctuary relay listening on ws://0.0.0.0:${PORT}`);
console.log('Share your IP + this port with friends, then Connect from the game.');
