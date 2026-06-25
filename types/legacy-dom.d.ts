// Legacy DOM-looseness shim for Sanctuary's End — zero-build type-checking. See types/README.md.
//
// game.js predates type-checking and accesses the DOM the way hand-written game code usually does:
//   - reads `.value` / `.checked` / `.files` off a generic element instead of casting to HTMLInputElement,
//   - reads `.dataset` / `.style` / `.onclick` off `querySelector()`'s `Element` (not HTMLElement),
//   - stashes its own expandos on nodes (e.g. `el._t = setTimeout(...)`),
//   - reads vendor extras (`performance.memory`).
//
// Rather than sprinkle ~80 `/** @type {HTMLInputElement} */(el)` casts through game.js (the ~1.5 days of
// DOM-cast churn the conversion assessment flagged), this file loosens exactly those access patterns to
// `any` in ONE place. It is deliberate "training wheels": it trades some DOM type-safety for a quiet
// baseline so the *game-data* types (Item/Character/SaveData/…) — where the real value is — check cleanly.
//
// To tighten later: delete entries here and replace the corresponding game.js accesses with proper casts
// to HTMLInputElement / HTMLCanvasElement / etc. No import/export => this stays a global declaration file.

interface Element {
  // present on HTMLElement but not the base Element that querySelector() returns:
  style?: any;
  dataset?: any;
  onclick?: any;
  onchange?: any;
  onkeydown?: any;
  onmouseenter?: any;
  onmousemove?: any;
  onmouseleave?: any;
  // form-control conveniences read off generic elements:
  value?: any;
  checked?: any;
  files?: any;
  select?: any;
  // canvas / misc accessed via getElementById/querySelector:
  getContext?: any;
  tagName?: any;
  /** game expando: cached timeout handle / transient state stashed on the node. */
  _t?: any;
}

interface EventTarget {
  // event.target is typed `EventTarget`; this legacy code reads input/element fields straight off it:
  value?: any;
  checked?: any;
  files?: any;
  dataset?: any;
  tagName?: any;
}

interface Performance {
  /** Non-standard Chrome heap stats read by the perf HUD (`performance.memory`). */
  memory?: any;
}
