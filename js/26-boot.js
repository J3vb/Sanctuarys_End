/* ---- async GPU bootstrap (Phase 1b / R4) ----
   WebGPURenderer.init() is async; ALL GPU-dependent setup must run AFTER it resolves on BOTH backends (the WebGL2 fallback is
   just as uninitialized at parse time). So buildEnv (PMREM/env), applyPostFX + buildPipeline (RenderPipeline), the first shadow
   render, the first frame, and the menu loop are all gated behind init().then(...). renderer.backend (and isWebGPUBackend) does
   not exist to read until init resolves. Non-GPU DOM (slots, diff/sound labels) is fine to set synchronously. */
renderSlots();
document.getElementById('diffBtn').textContent = difficulty; document.getElementById('soundBtn').textContent = SAVE._data.settings.muted ? '🔇' : '🔊';
renderer.init().then(() => {
  isWebGPUBackend = !!(renderer.backend && renderer.backend.isWebGPUBackend); /* read ONCE, post-init; pre-init always reports WebGPU even on fallback. */
  _tsSupported = _perf && !!(renderer.hasFeature && renderer.hasFeature('timestamp-query')); /* Phase 0 rig: GPU timestamps only when perf mode AND the backend supports them (WebGL2 fallback often won't). */
  if (_perf) { _dbgOn = true; const _d = document.getElementById('dbg'); if (_d) _d.style.display = 'block'; } /* perf mode auto-shows the HUD */
  console.log('[Sanctuary] renderer backend:', isWebGPUBackend ? 'WebGPU' : 'WebGL2 (fallback)', _perf ? ('· perf rig ON, gpu-timestamps ' + (_tsSupported ? 'supported' : 'unavailable')) : '');
  _refreshAnisotropy();             /* re-resolve max anisotropy now that the backend is known (parse-time read may have been 1). */
  buildEnv();                       /* IBL env (PMREM via EnvironmentNode) - GPU-dependent. */
  resolveQuality(); SAVE.persist(); /* Phase 2: resolve the quality tier (Auto auto-downgrades on the WebGL2 fallback) before applying graphics. */
  applyAllGfx();                    /* applyGraphics + shadowSize + lights + buildPipeline + applyPostFX + reflections + grade (GPU-dependent — runs post-init). */
  placeCamera(player);
  if (renderer.shadowMap.enabled) moon.shadow.needsUpdate = true; /* render the moon shadow map on the first frame (sampler2DShadow placeholder fix; see menuLoop). */
  renderFrame();
  document.getElementById('loading').style.display = 'none';
  show('selectScreen'); startMenu();
}).catch(err => { console.error('[Sanctuary] renderer.init() failed:', err); document.getElementById('loading').textContent = 'Renderer init failed - see console. (WebGPU/WebGL2 unavailable?)'; });
