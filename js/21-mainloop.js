function loop() {
  if (!running) return; requestAnimationFrame(loop); if (_warming) return; /* paused while pre-warming a new scene's GPU pipelines (see warmScene) */ const t = now(); const dt = Math.min(50, t - last); last = t; _fps = _fps * 0.9 + (1000 / Math.max(1, dt)) * 0.1; recordFrame(dt);
  _frame++; if (renderer.shadowMap.enabled && (_frame & 1)) moon.shadow.needsUpdate = true; /* Phase 1b: per-light one-shot refresh; keep the (_frame&1) every-other-frame throttle. */
  const _spkHB = _SPK.on && performance.memory ? performance.memory.usedJSHeapSize : 0, _spkT0 = _SPK.on ? performance.now() : 0; let _spkU = _spkT0;
  try { update(dt); if (_SPK.on) _spkU = performance.now(); renderFrame(); }
  catch (err) { _errCount++; _lastErr = (err && err.message) || String(err); if (now() - _lastErrAt > 1000) { _lastErrAt = now(); console.error('frame error #' + _errCount + ':', err); } }
  if (_SPK.on) { const _tend = performance.now(), _ft = _tend - _spkT0; if (_ft > _SPK.thresh) { const _hA = performance.memory ? performance.memory.usedJSHeapSize : 0, _dH = (_hA - _spkHB) / 1048576, _lcNew = !_SPK.lcSeen.has(_plVisN); const rec = { f: _frame, ft: +_ft.toFixed(1), uMs: +(_spkU - _spkT0).toFixed(1), rMs: +(_tend - _spkU).toFixed(1), dt: +dt.toFixed(1), gc: _dH < -0.25, dHeapMB: +_dH.toFixed(2), heapMB: +(_hA / 1048576).toFixed(1), lc: _plVisN, lcNew: _lcNew, mon: monsters.length, fx: fx.length, proj: projectiles.length, loot: loots.length, dying: _dying.length, draws: _lastDraws, zone: zone, ev: Object.assign({}, _SPK.ev) }; _SPK.spikes.push(rec); if (_SPK.spikes.length > 400) _SPK.spikes.shift(); console.warn('[SPIKE] ' + rec.ft + 'ms (u' + rec.uMs + '/r' + rec.rMs + ') ' + (rec.gc ? 'GC' + rec.dHeapMB : 'cpu+' + rec.dHeapMB) + ' lc' + rec.lc + (_lcNew ? '(NEW)' : '') + ' mon' + rec.mon + ' ' + JSON.stringify(rec.ev)); } _SPK.lcSeen.add(_plVisN); _SPK.ev = {}; }
}

/* ---- Phase 0 rig: deterministic perf harness (perftest mode only). Load a fixed-L1 char, then call
   perfRun() in the console. It scripts town→wild→dungeon→boss, and for each stage clears the frame ring
   AFTER reveal then samples a window — so maxFrameMs captures the first-encounter GPU-compile spike (the
   Phase 3 freeze gate). Run after a COLD reload (disk cache empty) to see the real freeze; seeded RNG
   keeps spawns/biomes identical across runs for clean A/B. ---- */
if (_perftest) {
  const _raf = () => new Promise(r => requestAnimationFrame(() => r()));
  const _frames = async n => { for (let i = 0; i < n; i++) await _raf(); };
  const _waitUntil = async (pred, ms) => { const t0 = performance.now(); while (!pred() && performance.now() - t0 < ms) await _raf(); };
  const _ftReset = () => { _ftIdx = 0; _ftCount = 0; };
  const _sampleStage = async (label, enterFn, sampleFrames) => {
    enterFn();
    await _waitUntil(() => !_warming, 15000);   /* warmScene pauses the loop; wait for reveal */
    await _frames(8);                            /* let the first revealed frames settle */
    _ftReset();                                  /* clean window so framePctl.max == this stage's worst frame */
    await _frames(sampleFrames || 220);
    const p = framePctl();
    return { stage: label, fps: +_fps.toFixed(0), gpuMs: +_gpuMs.toFixed(2), draws: _lastDraws, trisK: +(_lastTris / 1000).toFixed(1), monsters: monsters.length, p50: +p.p50.toFixed(1), p95: +p.p95.toFixed(1), p99: +p.p99.toFixed(1), maxFrameMs: +p.max.toFixed(1) };
  };
  window.perfRun = async () => {
    if (typeof running === 'undefined' || !running) { console.warn('[perfRun] load a character first (need a running game loop).'); return; }
    const out = [];
    out.push(await _sampleStage('town', () => enterTown()));
    out.push(await _sampleStage('wild+combat', () => enterWild(), 260));        /* waveTimer=0 on entry → first wave spawns inside the window */
    out.push(await _sampleStage('dungeon-d1+combat', () => enterDungeon(1), 260));
    out.push(await _sampleStage('dungeon-d5-boss', () => enterDungeon(5), 220));
    console.log('[perfRun] results (seed-deterministic):\n' + JSON.stringify(out, null, 2));
    return out;
  };
  /* ---- walking harness: standing-still doesn't trigger the freeze, so auto-patrol a diamond loop and
     measure standing vs lap1 vs lap2. lap2-clean ⇒ one-time cached first-render compile; lap2≈lap1 ⇒ a
     recurring per-walk cost (cull/GC/draw-call/CPU). Drives moveTarget directly (module-scoped click target). ---- */
  let _gpuMax = 0;
  const _visLights = () => { let n = 0; scene.traverse(o => { if (o.isLight && o.visible) n++; }); return n; };
  const _walkTo = async (x, z, maxMs) => {
    moveTarget = { x, z }; const t0 = performance.now();
    while (performance.now() - t0 < (maxMs || 6000)) { await _raf(); if (_gpuMs > _gpuMax) _gpuMax = _gpuMs; if (Math.hypot(player.x - x, player.z - z) < 1.4) break; }
  };
  const _wp = r => [[0, 0], [r, 0], [0, r], [-r, 0], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, -r * 0.7], [0, 0]];
  const _metrics = phase => { const p = framePctl(); return { phase, fps: +_fps.toFixed(0), p50: +p.p50.toFixed(1), p95: +p.p95.toFixed(1), p99: +p.p99.toFixed(1), max: +p.max.toFixed(1), gpuNow: +_gpuMs.toFixed(2), gpuMax: +_gpuMax.toFixed(2), draws: _lastDraws, trisK: +(_lastTris / 1000).toFixed(1), lights: _visLights(), monsters: monsters.length }; };
  window.perfWalk = async (label, enterFn, r) => {
    enterFn(); await _waitUntil(() => !_warming, 15000); await _frames(10);
    const out = { zone: label };
    _ftReset(); _gpuMax = 0; await _frames(150); out.stand = _metrics('stand');   /* baseline: stationary */
    const path = _wp(r);
    for (let lap = 1; lap <= 2; lap++) {
      const x0 = player.x, z0 = player.z; _ftReset(); _gpuMax = 0;
      for (const [x, z] of path) await _walkTo(x, z, 6000);
      if (lap === 1 && Math.hypot(player.x - x0, player.z - z0) < 0.5) console.warn('[perfWalk] player barely moved — harness may be broken (check moveTarget wiring)');
      out['lap' + lap] = _metrics('lap' + lap);
    }
    moveTarget = null; return out;
  };
  window.perfWalkAll = async () => {
    if (typeof running === 'undefined' || !running) { console.warn('[perfWalk] load a character first.'); return; }
    const res = [];
    res.push(await window.perfWalk('town', () => enterTown(), 30));        /* spawn-free control zone */
    res.push(await window.perfWalk('wild', () => enterWild(), 110));
    res.push(await window.perfWalk('dungeon-d1', () => enterDungeon(1), 60));
    enterTown();   /* park in a spawn-free zone so the harness doesn't keep spawning monsters after it returns */
    console.log('[perfWalkAll] results:\n' + JSON.stringify(res, null, 2));
    return res;
  };
  console.log('[perfRun] deterministic harness ready — load a character, then call perfRun() (zone-entry) or perfWalkAll() (walking) in the console.');
  Object.assign(window, { enterDungeon, enterTown, enterWild }); /* perftest-only: lets the QA harness jump zones/biomes from the console (pairs with window.perfRun) */
  Object.defineProperty(window, '__perfGod', { get: () => _perfGod, set: v => { _perfGod = !!v; } }); /* toggle god-mode from console (default on under ?perftest) */
  window.__spikeStart = thresh => { _SPK.thresh = thresh || 35; _SPK.on = true; _SPK.spikes.length = 0; _SPK.ev = {}; _SPK.rates = {}; _SPK.seen = new Set(); _SPK.lcSeen = new Set(); _SPK.t0 = performance.now(); console.log('[spike] logging ON. thresh=' + _SPK.thresh + 'ms. Play/fight to reproduce the stutter, then call __spikeStop().'); };
  window.__spikeStop = () => { _SPK.on = false; const secs = Math.max(0.001, (performance.now() - _SPK.t0) / 1000); const ratesPerSec = {}; for (const k in _SPK.rates) ratesPerSec[k] = +(_SPK.rates[k] / secs).toFixed(2); const out = { secs: +secs.toFixed(1), spikeCount: _SPK.spikes.length, gcSpikes: _SPK.spikes.filter(s => s.gc).length, worst: _SPK.spikes.slice().sort((a, b) => b.ft - a.ft).slice(0, 15), ratesPerSec, allSpikes: _SPK.spikes }; console.log('[spike] STOP — ' + out.spikeCount + ' spikes (' + out.gcSpikes + ' GC) in ' + out.secs + 's'); return out; };
  window.__spikeStart(); /* auto-on under ?perftest: captures real-play hitches from first load (call __spikeStop() to read) */
}
