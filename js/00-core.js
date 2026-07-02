/* Phase 0 perf rig: in ?perftest=1 mode, seed Math.random (mulberry32) so spawnWave/pickBiome/biome rolls
   are reproducible across cold runs — kills the ±~1s spawn/leveling noise the old PERF-FINDINGS doc flagged.
   Must run before any Math.random() call. ?seed=N overrides the default seed. No effect in normal play. */
(() => {
  if (typeof location === 'undefined' || !/[?&]perftest=1\b/.test(location.search)) return;
  let s = (parseInt((location.search.match(/[?&]seed=(\d+)/) || [])[1], 10) || 12345) >>> 0;
  Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
})();
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => performance.now();
const choice = a => a[Math.floor(Math.random() * a.length)];

/* ================= AUDIO ================= */
const Audio2 = {
  ctx: null, master: null, muted: false,
  init() { if (this.ctx) return; try { const AC = window.AudioContext || window.webkitAudioContext; this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination); } catch (e) { } },
  beep(freq, dur, type, vol, slideTo) { if (!this.ctx || this.muted) return; const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type || 'sine'; o.frequency.value = freq; if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), this.ctx.currentTime + dur); g.gain.value = vol || 0.18; g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur); o.connect(g); g.connect(this.master); o.start(); o.stop(this.ctx.currentTime + dur); },
  noise(dur, vol) { if (!this.ctx || this.muted) return; const n = this.ctx.createBufferSource(); const buf = this.ctx.createBuffer(1, Math.max(1, this.ctx.sampleRate * dur), this.ctx.sampleRate); const data = buf.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2); n.buffer = buf; const g = this.ctx.createGain(); g.gain.value = vol || 0.18; n.connect(g); g.connect(this.master); n.start(); }
};
function sfx(t) {
  const A = Audio2; if (!A.ctx || A.muted || !SAVE._data.settings.sfx) return;
  if (t === 'melee') { A.noise(0.08, 0.14); A.beep(180, 0.08, 'square', 0.1, 90); }
  else if (t === 'fire') { A.beep(620, 0.25, 'sawtooth', 0.15, 160); }
  else if (t === 'frost') { A.beep(900, 0.25, 'triangle', 0.13, 420); }
  else if (t === 'nova') { A.beep(300, 0.3, 'square', 0.15, 120); }
  else if (t === 'chain') { A.beep(1300, 0.18, 'sawtooth', 0.15, 300); }
  else if (t === 'hurt') { A.beep(200, 0.18, 'square', 0.2, 70); A.noise(0.1, 0.12); }
  else if (t === 'gold') { A.beep(1200, 0.08, 'sine', 0.1, 1600); }
  else if (t === 'potion') { A.beep(500, 0.18, 'sine', 0.13, 820); }
  else if (t === 'death') { A.beep(160, 0.14, 'sawtooth', 0.1, 60); }
  else if (t === 'level') { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => A.beep(f, 0.18, 'triangle', 0.18), i * 90)); }
  else if (t === 'boss') { A.beep(90, 0.7, 'sawtooth', 0.25, 60); A.noise(0.5, 0.18); }
  else if (t === 'bossdie') { [400, 300, 200, 120].forEach((f, i) => setTimeout(() => { A.beep(f, 0.3, 'sawtooth', 0.2, f * 0.6); A.noise(0.2, 0.15); }, i * 120)); }
  else if (t === 'die') { [300, 240, 180, 120, 80].forEach((f, i) => setTimeout(() => A.beep(f, 0.3, 'sawtooth', 0.2), i * 150)); }
}
const MUSIC = {
  scale: [220, 261.63, 293.66, 329.63, 392, 440], timer: null,
  start() { if (this.timer || Audio2.muted || !Audio2.ctx || !SAVE._data.settings.music) return; this.timer = setInterval(() => { if (Audio2.muted || !Audio2.ctx) return; const f = choice(this.scale) * (Math.random() < 0.3 ? 0.5 : 1); const o = Audio2.ctx.createOscillator(), g = Audio2.ctx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.value = 0; g.gain.linearRampToValueAtTime(0.045, Audio2.ctx.currentTime + 0.6); g.gain.linearRampToValueAtTime(0.001, Audio2.ctx.currentTime + 2.6); o.connect(g); g.connect(Audio2.master); o.start(); o.stop(Audio2.ctx.currentTime + 2.7); }, 1900); },
  stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
};
const DIFF = { Normal: { hp: 1, dmg: 1, xp: 1 }, Hard: { hp: 1.6, dmg: 1.4, xp: 1.3 }, Hell: { hp: 2.6, dmg: 2, xp: 1.8 }, Inferno: { hp: 4, dmg: 3, xp: 2.5 } };
const DIFF_ORDER = ['Normal', 'Hard', 'Hell', 'Inferno'];
// endgame depth scaling (data-driven; early floors stay ~linear, late floors ramp up via the quadratic terms)
const DSCALE = { hpLin: 0.4, hpQuad: 0.05, dmgLin: 0.28, dmgQuad: 0.04, xpLin: 0.5, xpQuad: 0.04, ilvlPerDepth: 2 };
const BOSS_SCALE = { hpBase: 380, hpLin: 0.5, hpQuad: 0.05, dmgBase: 14, dmgLin: 0.3, dmgQuad: 0.03, xpBase: 300, xpLin: 0.6 };
let shake = 0;
