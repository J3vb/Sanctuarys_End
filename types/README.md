# Type-checking (zero build)

This repo type-checks the game's `js/` scripts with TypeScript's checker **without any build step**.
Nothing is compiled or emitted — the scripts ship to GitHub Pages byte-for-byte. Because they are classic
(non-module) scripts, tsc treats them as one shared global program, exactly as the browser does. The setup
is just three files:

- `jsconfig.json` — turns on `checkJs` over `js/**/*.js` with loose settings (no `strict`, no
  `noImplicitAny`, no `strictNullChecks`) so it catches *real* mistakes (typos, wrong shapes, bad calls)
  without drowning you in `null`/`any` noise on day one.
- `types/globals.d.ts` — declares the ambient globals the scripts rely on: `THREE`, `TSL`, and a few
  `window.*` debug hooks (the co-op `NET` global is intentionally **not** declared here — `js/24-net.js`
  declares it itself, and re-declaring it would collide). `THREE`/`TSL` are typed `any` (see below to upgrade).
- `types/game.d.ts` — interfaces for the core data shapes (`Item`, `Character`, `SaveData`, `Affixes`,
  `SkillDef`, …) that mirror the literals in the scripts.

## How to use it

- **In your editor (VS Code):** nothing to install. The bundled TypeScript language service reads
  `jsconfig.json` automatically and shows errors/autocomplete as you type.
- **From the command line (optional):** `npx -p typescript tsc -p jsconfig.json --noEmit`
  (downloads `typescript` on demand; not a project dependency, not shipped).

## Adding types as you go

Describe a function's inputs/outputs with JSDoc — these are comments, invisible to the browser:

```js
/** @param {Item} it @returns {number} */
function sellValue(it) { return Math.max(2, Math.round(itemScore(it) * 0.5)); }
```

The interfaces in `types/game.d.ts` are referenceable by bare name (`{Item}`, `{Character}`). A few
item-scoring functions in `js/01-items.js` are already annotated as worked examples.

To silence a noisy region while you migrate it, add `// @ts-nocheck` at the top of a block's file or
`// @ts-ignore` above a single line. Keep `types/game.d.ts` in sync when the game-data shapes change.

## Upgrading `THREE`/`TSL` to real types (optional)

They're `any` to keep this dependency-free. For real three.js types at dev time only (still nothing
shipped):

```
npm i -D three   # three ships its own .d.ts since ~r150; @types/three is NOT needed
```

then in `types/globals.d.ts` replace the `any` declarations with:

```ts
declare const THREE: typeof import("three/webgpu") & Record<string, any>;
declare const TSL: typeof import("three/tsl");
```
