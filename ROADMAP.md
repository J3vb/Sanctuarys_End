# Sanctuary's End — Roadmap

A prioritized plan for where the game goes next, grounded in a full audit of the
v49 codebase. Every item names the code it builds on (`file:line` refs are into
`js/`), so any item can be picked up and executed directly. Tiers are ordered by
leverage: Tier 0 is nearly free, Tier 3 is the long game.

## Snapshot — what v49 is

A complete Diablo-style loop: 3 classes drawing from a shared pool of 22 active
skills on a 6-slot action bar, per-skill rune trees, a ~67-node passive forest,
5-rarity loot across 7 slots with gems/sockets/crafting, 3 towns with 8 NPC
services, 3 open-world biome regions, and an endless dungeon with bosses every
5 floors. The systems are cleanly data-driven — most tables below can grow
without engine work.

| System | Count | Where |
| --- | --- | --- |
| Classes | 3 | `02-skills.js:38` `CLASSES` |
| Active skills | 22 (≈10 mechanical archetypes) | `02-skills.js:2` `SKILLDEFS` |
| Rune trees | 21 (~6–7 nodes each) | `14-runes.js:31` `buildSkillTree` |
| Passive forest | ~67 nodes, 12 keystones | `02-skills.js:54` `PTREE` |
| Monster types | 8 (2 AI archetypes) | `12-monsters.js:7` `MTYPES` |
| Elite affixes | 7 (3 with active behavior) | `12-monsters.js:14` `ELITE_MODS` |
| Bosses | 6 named + the depth-666 Devil | `12-monsters.js:166` `BOSS_DEFS` |
| Gear affixes | 39 | `01-items.js:31` |
| Uniques / sets | 21 / 5 | `01-items.js:66` / `:89` |
| Gems | 7 types × 5 qualities | `01-items.js:99` `GEMS` |
| Dungeon biomes | 7 + reserved hell biome | `09-dungeon.js:7` `BIOMES` |
| Regions / towns | 3 / 3 | `05-worldmap.js:10` `REGIONS` |
| Difficulty tiers | 4 (multipliers only) | `00-core.js:43` `DIFF` |

---

## Tier 0 — Free wins: ship what's already coded

Finished mechanics sitting unreachable in the codebase. Each is data/wiring
only — hours, not days — and together they visibly deepen the game.

- **Wire the 4 dead rune behaviors.** `chillNova`, `knockback`, `vampiric`, and
  `lingering` are declared (`14-runes.js:5-16`) and fully handled in
  `applyRuneProj`/`projBurst` (`14-runes.js:70-92`), but `_runeShape`/`_runeKey`
  (`14-runes.js:19-30`) never place them on any tree. Adding them to those
  tables instantly diversifies all 21 rune trees.
- **Let something stun.** The stun status is implemented end-to-end
  (`15-combat.js:91,106`; blocks actions in `17-update.js`), but no skill,
  rune, affix, or monster inflicts it. Give Ground Slam / Leap an
  `onHit: 'stun'` tag or add a "Concussive" rune keystone.
- **Make the Devil reachable.** Belphegor and the reserved `HELL_BIOME` are
  built (`spawnDevil`, `12-monsters.js:214`) but the waypoint depth-jump clamps
  to `maxDepth` (`25-waypoints.js:5`, `16-zones.js:215`) — ~660 grind floors.
  Add a keyed portal / milestone unlock (e.g. drop a "Sigil of the Inferno"
  from Pyraxis on Inferno difficulty).
- **Activate `dungeonTheme(depth)`.** A complete depth→biome-tier map exists
  (`09-dungeon.js:17`) but only feeds a lighting fallback; `pickBiome`
  (`09-dungeon.js:18`) rolls pure random. Blend the two so depth has thematic
  identity while keeping variety.
- **Give the Exotic Merchant a reason to exist.** `premiumVendor` is a dead
  alias for `openVendor(2)` (`16-zones.js:201`) — same panel, same stock. Turn
  it into a Dust-currency shop, a rotating unique/recipe vendor, or a gambling
  house for high stakes.
- **Render the party's health.** Remote-player HP already arrives over the
  relay (`24-net.js:23`) but nameplates draw only name + level
  (`18-hud.js:146`). Draw the bar; while there, lerp remote positions instead
  of snapping at ~9 Hz (`24-net.js:29-30`).
- **Un-gate the event stream.** `_ev` emits kill/killElite/killBoss/loot/cast
  signals but only when the perf-test hook is on (`15-combat.js:41-45`). Un-gate
  it in normal play — it's the ready-made backbone for Tier 2's
  achievements/quests.
- **Surface the 10 legacy passive skills or cut them.** `toughness`,
  `precision`, etc. (`02-skills.js:8-25`) are still consumed by `recompute`
  (`11-player.js:57-59`) but no UI can rank them. Either expose them (e.g. as
  rare tome drops) or delete the dead defs.

## Tier 1 — Work better: fixes, feel, and reliability

The engine is in good shape after the perf/leak passes; what's left is combat
feel, a few real bugs, and platform reliability.

**Combat feel (highest impact on moment-to-moment play)**

- **Give the 8 monster types signature abilities.** The update loop has exactly
  two behaviors — chase-melee and ranged-kite (`17-update.js:29-35`). Add
  optional per-type `onAI` hooks reusing existing player-skill math: brute
  charge, hellhound leap, shaman heal-totem (summon already exists), wraith
  phase/blink. Type identity today is only stats + resists.
- **Boss telegraphs + signature moves.** All bosses share one 4-ability palette
  (volley/slam/teleport/summon, `12-monsters.js:224-248`) and damage resolves
  the same frame as the VFX — no dodge window. Spawn the AoE marker N ms before
  damage, and extend `BOSS_DEFS` with a data-driven ability list so Cinderwing
  gets a breath cone (a `bossVolley` arc) and the Mycelial Throne gets an
  add-phase, instead of every boss playing the same.
- **Make difficulty tiers real.** `DIFF` (`00-core.js:43`) only multiplies
  hp/dmg/xp, and any level-1 character can toggle Inferno (`22-screens.js:42`).
  Add fields like `eliteAffixCount` / `monsterDensity` / `resistFloor` consumed
  in `spawnPack` (`12-monsters.js:133-139`), and gate tiers behind
  `character.maxDepth` (already tracked per hero).
- **Elite-affix behavior as data.** The 3 behavioral affixes are wired via
  scattered `m.elite.includes(...)` string checks across 3 files
  (`15-combat.js:135`, `17-update.js:30,136`). Convert `ELITE_MODS` to
  `onSpawn/onHit/onTick/onDeath` callbacks — the prerequisite for Tier 2's new
  affixes.

**Real bugs / economy**

- **Magic Find is order-dependent.** `lootLuck` is set from depth on zone entry
  (`16-zones.js:31`) then overwritten by gear MF in `recompute`
  (`11-player.js:70`, the comment admits it) — last writer wins. Compose them
  (`depthLuck + gearMF`) instead.
- **Dust economy is inverted.** Vendor sales grant gold *and* Dust
  (`20-abilities.js:119-123`), making the Smith's Salvage tab strictly worse,
  while only reforge/add-socket consume Dust. Make salvage the Dust path and
  sales the gold path, then give Dust the targeted-crafting sinks in Tier 2.
- **Protect build-defining gear.** "Sell All" liquidates rares/sets/uniques
  behind one confirm (`20-abilities.js:120`) and the loot filter auto-salvages
  on pickup (`17-update.js:63`). Add an item lock/favorite flag both paths
  respect.

**QoL & platform**

- **Buff-timer HUD.** War Cry / shrine / chill timers exist on the player
  (`11-player.js:25-26`) but nothing shows remaining duration. A small chip row
  by the globes, using the existing HUD dirty-cache pattern (`18-hud.js:24-42`).
- **Death recap.** `gameOver()` shows name/level/kills/depth only
  (`22-screens.js:17`); the killing blow is computed then discarded
  (`17-update.js:136`). Record "slain by X" + run stats.
- **Vendor three.js.** r184 loads from unpkg at runtime
  (`sanctuary.html` import map) — a single point of failure for a game whose
  pitch is "plain static files." Self-host the two pinned builds next to the
  game.
- **Own the WebGPU story.** The engine is WebGPU-first with WebGL2 fallback
  (`04-render.js:8`, `26-boot.js:9`); docs still say "WebGL required." Document
  the supported-browser matrix and test the WebGL2 path deliberately — it's the
  reach path for Firefox/Safari. *(README correction ships with this roadmap.)*

## Tier 2 — More content: the systems exist, feed them

The data-driven tables make content the cheapest axis. Ordered by impact:

- **Dungeon layout generation — the single biggest quality multiplier.** Every
  floor of the endless Descent is one rectangular hall with reshuffled props
  (`09-dungeon.js:34-49,113-154`). A room-graph/corridor generator slotting
  into `_fillDungeonBiome` (`09-dungeon.js:70`) transforms the core loop's feel
  more than any other single change. Higher effort; worth it.
- **Fill the depth-25 → 666 void.** The last new boss (Pyraxis) gates at
  `minDepth: 25` (`12-monsters.js:172`); beyond that the infinite dungeon is
  pure stat inflation. Add `BOSS_DEFS` entries in new depth bands (procedural
  fallback mesh means no new art required), plus new elite affixes — the
  classic zoning set (waller, vortex, molten trail via the existing
  `spawnLingerField`, `14-runes.js:92`) — new shrine types
  (`16-zones.js:116,136`), bounty kinds beyond slay/champion (`01-items.js:6`),
  and a second goblin variant.
- **Give the wilds goals.** The 3 open-world regions have zero objectives —
  `renderObjective` renders nothing outside the dungeon (`16-zones.js:152-155`).
  Add wild bounties, roaming mini-bosses, and events to make the overworld more
  than a leveling antechamber.
- **Achievements / quest log.** Drive it from the un-gated `_ev` stream
  (Tier 0): kill/loot/depth/class challenges with Dust or cosmetic rewards —
  the game's first persistent goal layer beyond level and `maxDepth`.
- **Itemization depth, using existing hooks:**
  - Activate `item.base` — currently cosmetic (`01-items.js:20-26`). Weapon
    subtypes (attack-speed classes, 1H/2H) and a shield/offhand slot make loot
    identity real.
  - Legendary affixes on rares: the unique `effect`/`effVal` fields already
    resolve in combat (`01-items.js:129`); let rare drops occasionally roll
    one, and author more *skill-transforming* effects (only ~9 of 21 uniques
    are mechanically distinct).
  - Class-themed 6-piece sets — `SET_DEFS` bonuses are threshold-keyed
    (`01-items.js:90-94`); only 2/3/4 are authored today.
  - Targeted Dust crafting at the reforge chokepoint (`01-items.js:170`):
    "reroll one affix," "imbue chosen affix," "guarantee sockets" — the Dust
    sink Tier 1's economy fix needs.
  - Stash tabs + a materials view — the stash is a flat 80-cap array
    (`03-save.js:48`).
- **A 4th class.** `CLASSES`/`CLASS_ACTIVES`/GLB manifest are all data-keyed
  (`02-skills.js:38-48`, `10-assets.js:2`); the real work is a 4th `PTREE`
  sector (`02-skills.js:59-64`) and a handful of new actives. Pairs well with
  skill-rank spending: `maxRank: 5` and `SKILL_COEF.coef(rank)`
  (`13-input.js:87`) already exist — nothing spends points past rank 1 today.

## Tier 3 — The future: where this game could go

**Endgame: "Greater Descents."** A keyed, timed rift mode built from parts that
already exist — `enterDungeon` + `pickBiome` + `spawnWave`, the waypoint
depth-jump UI (`25-waypoints.js:6-16`), the `maxDepth` ladder, and the reserved
hell biome. Keys drop in the regular Descent; clearing one under time upgrades
the key. This gives the endless dungeon a reason to be endless, and is the
natural home for the Tier 2 boss/affix content.

**Stakes & integrity → seasons.** Hardcore mode is nearly free (flag in
`newCharacter`, branch `gameOver()` to `deleteSlot` instead of revive,
`22-screens.js:17,34`). But saves are unsigned plaintext localStorage
(`03-save.js:3,33`) — trivially edited — so any leaderboard/season/ladder future
needs a save checksum first. Then: seasonal characters, a depth ladder, "share
your deepest run."

**Co-op that's actually playable.** Two-step path:
1. *Transport:* the client hardcodes `ws://` (`24-net.js:9`), so co-op is
   blocked as mixed content from the hosted https build — LAN-only today. Host
   a tiny `wss://` relay (the whole server is ~70 lines, `Server/server.js`)
   and co-op becomes real for the public build.
2. *Shared world:* the relay broadcasts and the client has an extensible
   message switch (`24-net.js:18`) — layer host-authoritative monster/loot
   state on top, then party UI, trading, and shared floor events. The biggest
   lift on this roadmap; step 1 alone already makes the current
   presence-and-chat co-op reachable.

**Reach.** The click-to-move isometric scheme suits touch and gamepad, yet
input is mouse+keyboard only (zero pointer/touch/gamepad handlers in the
repo). Touch targets + a virtual stick, gamepad bindings through the existing
centralized dispatcher (`13-input.js:55-77`), a PWA manifest for
installability/offline (pairs with vendoring three.js), an itch.io page for
discoverability, and an accessibility pane (colorblind-safe rarity palette,
UI scale, reduce-motion) — the MIT+CC0 licensing makes distribution friction
essentially zero.

**Cloud saves.** The save is one JSON blob with a working, sanitized
export/import path (`23-settings.js:56-92`) — an optional sync backend can
reuse that serialization verbatim.

**Sound.** All audio is procedural oscillator beeps plus a 6-note ambient loop
(`00-core.js:16-42`). Sampled SFX and a few looping music tracks
(CC0 libraries fit the asset pipeline already in use) would raise perceived
quality more per hour than almost anything else at this stage.

**Content as data.** Everything is hardcoded JS literals, so every content add
is a code edit + save-version discipline. If Tier 2 content authoring becomes
a bottleneck, split the big tables (skills, monsters, bosses, affixes, uniques)
into JSON loaded at boot — which is also the doorway to community mods.

---

*Generated from a full-code audit of v49. Corrections to stale docs
(README WebGPU note, CREDITS CDN name, wiki boss roster) shipped alongside
this file.*
