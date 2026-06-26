// Ambient globals for Sanctuary's End — zero-build type-checking. See jsconfig.json and types/README.md.
//
// game.js is a CLASSIC (non-module) `<script defer>` that reads THREE / TSL as globals populated by the
// module shim in sanctuary.html (the importmap loads three from the CDN, the shim flattens it onto
// window.THREE / window.TSL), plus an optional NET co-op global. Declaring them here lets the TypeScript
// language service (VS Code, or `tsc --noEmit`) check game.js without any build step or node_modules.
//
// NOTE: this file has NO import/export on purpose — that keeps it a *global* (script) declaration file so
// these names are visible everywhere in game.js. Adding an import/export would turn it into a module and
// the globals would stop resolving.

// --- Three.js + TSL (from the CDN importmap shim in sanctuary.html) -----------------------------------
// Typed `any` to keep the scaffold dependency-free (no node_modules, nothing shipped changes). The WebGPU
// + TSL surface this game leans on is also the least-typed part of three, so `any` here is pragmatic.
//
// To upgrade THREE/TSL from `any` to real three.js types later (dev-time only — NOT shipped to Pages):
//   npm i -D three           # three ships its own .d.ts since ~r150; @types/three is NOT needed
// then replace the two lines below with:
//   declare const THREE: typeof import("three/webgpu") & Record<string, any>;
//   declare const TSL: typeof import("three/tsl");
declare const THREE: any;
declare const TSL: any;

// NOTE: the optional co-op `NET` global is declared by game.js itself (`const NET = {…}`), so it is NOT
// declared here — game.js's own declaration is what the `typeof NET !== 'undefined'` guards resolve against.

interface Window {
  THREE: any;
  TSL: any;
  /** Safari/legacy prefix used in the AudioContext feature-detect (`window.AudioContext || window.webkitAudioContext`). */
  webkitAudioContext?: typeof AudioContext;

  // Perf/debug + dev URL-flag harness hooks read/attached by game.js (e.g. ?perftest=1, ?forceBiome=…).
  perfRun?: (...args: any[]) => any;
  perfWalk?: (...args: any[]) => any;
  perfWalkAll?: (...args: any[]) => any;
  __spikeStart?: (...args: any[]) => any;
  __spikeStop?: (...args: any[]) => any;
  __perfGod?: boolean;
  __forceBiome?: any;
  __skipCombatWarm?: any;
}
