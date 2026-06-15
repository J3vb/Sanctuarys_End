# Changelog

Version history for Sanctuary's End, newest first. The expansion program began
from the **v26** baseline; the performance pass and the eight endgame features
were applied in place and that file became **v30**, so there are no separate
v27–v29 snapshots. The in-game codex (`sanctuary_wiki.html` → Version History)
holds the authoritative, fully detailed version.

> Note: releases are published as `sanctuary.html`. The `vNN` labels below are
> the development version numbers tracked via git tags.

## v48 — Open World & Save I/O
- Three separate wilderness maps merged into one large open world (~2.4× bigger),
  split into three concentric biome rings: Greenwilds (Lv 1) → Frostfen (Lv 7) →
  Ashlands (Lv 14); danger scales with distance.
- Towns reached by finding their portals in the wilds; roads & signposts guide you.
- Fast-travel Waypoints are discovery-gated (a town joins the network only once
  physically reached). Denser region-flavoured scenery; true per-biome ground
  colour; roads conform to rolling terrain.
- New **Settings → Saves** tab: export/import all characters & settings
  (download / copy / load-file / paste) for backups and moving between devices.

## v47 — Skills, Dungeons, Towns & a Secret Boss
- Live skill tooltips on the action bar (damage, cost, cooldown, effect).
- Dungeon rolls a random biome each entry; jump to any already-reached depth via Waypoint.
- Four new monsters: Skeleton, Imp, Hellhound, Wraith.
- Secret final boss **Belphegor, Lord of the Inferno** at Depth 666 (descend-only).
- Town overhaul: new **Alchemist** owns potion upgrades; vendors no longer sell
  potions (free Cauldron refills); gambling consolidated to the Gambler; three
  themed town layouts; bigger, scroll-free Settings panel.

## v46 — Itemization & Towns
- Kit-empowering affixes: +to Skills, Skill Damage %, Active Skill Damage %, and
  Fire / Cold / Lightning / Poison Damage %.
- Health & Mana regeneration (from VIT/ENG and new regen affixes).
- New **Enchanter** (imbues a chosen stat); Smith split into Upgrade / Consumables.
- New tier-2 town **Emberhold** (Depth 10) with **Jeweler** and **Premium Vendor**;
  Gambler added to Highreach & Emberhold.
- **Loot Filter** auto-salvages unwanted drops to gold on pickup; Cauldron now
  also fully heals HP and restores mana.

## v45 — Keybinds, Settings & UX
- Fully rebindable keys (Settings → Controls) via one centralized input dispatcher.
- Settings reorganized into Audio / Graphics / Gameplay / Controls tabs.
- Modal click-through fixed with a dimmed backdrop; selected skill remembered;
  10th slot selectable with `0`; UI polish.
- Fix: melee reliably lands on large enemies (brutes, bosses) by accounting for size.

## v44 — glTF town NPCs & QoL
- Town NPCs swapped to imported models (vendor = Mage, smith = Barbarian, stash = Rogue).
- Mouse wheel no longer zooms while a panel/modal is open; stash widened to 8×80.
- New Cauldron prop refills both potion types free; fixed a freeze on champion-pack
  spawns (elite/boss lights respect the light budget).

## v43 — Imported model roster
- Procedural cast replaced with embedded animated glTF models — hero = KayKit Knight;
  monsters = Quaternius (Orc, Spiky Blob, Yeti, Wizard, Demon boss). Per-spawn
  skinned clones, per-creature animation, death animations.

## v42 — glTF proof-of-concept
- Proved embedded animated glTF works under the single-file / `file://` constraint
  (Khronos Fox, base64-baked, via GLTFLoader + AnimationMixer).

## v41 — Richer procedural models
- Low-poly "blob" models replaced with articulated monsters, a hulking demon boss,
  a more detailed hero, and richer props — still procedural and performance-safe.

## v40 — Item & rarity overhaul
- Rarity now multiplies base stat and every affix (not just affix count).
- Drop tables rebalanced; depth/elites/bosses bias toward better rarities.
- More base items, +8 uniques, +1 set (Emberwalker); fixed uniques rolling without
  their signature effect.

## v39 — Graphics polish
- Per-biome color grading + vignette, combat hit VFX (sparks + impact flash), PBR
  materials on hero armor.

## v38 — Performance fixes
- Eliminated the hitch/freeze on ability use and pack kills (removed unbudgeted
  transient lights forcing shader recompiles; pooled/cached loot & FX geo/materials).
- Capped floating combat text; de-duplicated level-up saves.

## v37 — Ambient occlusion & soft shadows
- Added SSAO and soft (PCF) shadows, both toggleable in Settings.

## v36 — PBR loot & reflections
- Physically-based metal on weapons, gold and loot, lit by a procedural image-based
  environment map (reflections toggle).

## v35 — Post-processing
- Bloom, SMAA, ACES tone-mapping with an exposure slider (A/B toggle); torch
  brightens with depth; fixed movement speed on high-refresh monitors.

## v34 — Content depth
- Status effects (Burn, Bleed, Poison, Chill, Stun) on a stacking DoT framework;
  elemental damage types and depth-scaling monster resistances; +10 affixes; boss
  variants (Brute / Caster / Summoner); the Smith's affix re-roll (enchant).

## v33 — Detail & biomes
- Re-enabled ambient particles (snow, embers, dust, spores) + rubble scatter;
  depth-banded dungeon biomes (Frozen Wastes, Sunken Swamp, Bone Cathedral).

## v32 — Procedural textures (cont.)
- Extended the canvas-texture factory to characters and glowing effects (cloth,
  skin, metal, crystal, lava, energy, flame, water) — no external image files.

## v31 — Procedural textures
- Canvas-based texture factory; detail maps on big surfaces and props (ground
  normal map, stone, wood), tinted per zone to preserve palettes.

## v30 — Performance pass + endgame features
- Performance: cheaper scene materials, a point-light budget, instanced scenery.
- Endgame: split Health/Mana potions with a Mana-potion key; the **Smith** (gear &
  potion upgrades); per-character inventory/stash with buyable slots; gold sinks;
  Sell Junk / Sell All; **Inferno** difficulty + steeper late-depth scaling, Loot
  Luck, empowered deep monsters, faster deep bosses; 9 new active skills. Save
  format bumped to v5. (The v26 working file after in-place perf + endgame work.)

## v26 — Baseline
- The pre-expansion build this history starts from, kept as the baseline snapshot.
