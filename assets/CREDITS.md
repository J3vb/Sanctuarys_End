# Asset Credits — Sanctuary's End

All third-party assets used here are **CC0 1.0 (public domain)**. Attribution is **not
required** by the licence, but every source is recorded below as good practice.

Licence reference: https://creativecommons.org/publicdomain/zero/1.0/

---

## Auto-downloaded (this pass)

### HDRIs — Poly Haven (CC0)
Source site: https://polyhaven.com · API: https://api.polyhaven.com
2K `.hdr`, used for image-based lighting / sky per biome.

| File (`assets/hdri/`)                  | Poly Haven slug      | Page                                            | Biome mood            |
|----------------------------------------|----------------------|-------------------------------------------------|-----------------------|
| `greenwilds_alps_field_2k.hdr`         | `alps_field`         | https://polyhaven.com/a/alps_field              | Greenwilds — green daytime |
| `frostfen_frozen_lake_2k.hdr`          | `frozen_lake`        | https://polyhaven.com/a/frozen_lake             | Frostfen — cold / overcast |
| `ashlands_the_sky_is_on_fire_2k.hdr`   | `the_sky_is_on_fire` | https://polyhaven.com/a/the_sky_is_on_fire      | Ashlands — fiery dusk |

### PBR textures — ambientCG (CC0)
Source site: https://ambientcg.com · API: https://ambientcg.com/api/v2/full_json
2K sets. Each folder under `assets/textures/` holds the maps the game needs, renamed
canonically: `albedo`, `normal` (OpenGL convention), `roughness`, `ao` (and `emission`
where the source provides it). Displacement / DirectX normal / preview / DCC files from
the source zip were dropped.

**Compressed to KTX2 / Basis Universal** (toktx 4.4.2, `--genmipmap`):
- `albedo`, `emission` → ETC1S, `--assign_oetf srgb`
- `roughness`, `ao` → ETC1S, `--assign_oetf linear`
- `normal` → UASTC (`--uastc_quality 2 --zcmp 18`), `--assign_oetf linear`

146 MB JPG → **50 MB `.ktx2`**. Original JPGs preserved in **gitignored** `assets/_source/textures/`
(not published). **Runtime note:** these `.ktx2` need three.js `KTX2Loader` + a Basis transcoder
wired in — that game-side wiring is a separate step.

| Folder (`assets/textures/`)   | ambientCG ID        | View page                                       | Intended use                  |
|-------------------------------|---------------------|-------------------------------------------------|-------------------------------|
| `greenwilds_grass`            | `Grass005`          | https://ambientcg.com/view?id=Grass005          | Greenwilds ground             |
| `greenwilds_forest_floor`     | `Ground037`         | https://ambientcg.com/view?id=Ground037         | Greenwilds mossy forest floor |
| `frostfen_snow`               | `Snow015`           | https://ambientcg.com/view?id=Snow015           | Frostfen snow ground          |
| `frostfen_rock`               | `Rock035`           | https://ambientcg.com/view?id=Rock035           | Frostfen frozen rock          |
| `ashlands_lava`               | `Lava004`           | https://ambientcg.com/view?id=Lava004           | Ashlands scorched/lava (emissive) |
| `ashlands_dark_rock`          | `Rock051`           | https://ambientcg.com/view?id=Rock051           | Ashlands dark rock            |
| `dungeon_floor_cobble`        | `PavingStones150`   | https://ambientcg.com/view?id=PavingStones150   | Dungeon floor                 |
| `dungeon_wall_brick`          | `Bricks097`         | https://ambientcg.com/view?id=Bricks097         | Dungeon walls                 |

> Texture picks are by category match; swap any ID by re-running the same
> `https://ambientcg.com/get?file=<ID>_2K-JPG.zip` download if a different look is wanted.

---

## Manual packs (IMPORTED — sorted into `assets/models/` + `assets/animations/`)

Downloaded by hand into `assets/_incoming/`, then sorted. Source zips/folders are kept
in `assets/_incoming/` but **git-ignored / not published** (`assets/_incoming/.gitignore`).

### Sources
| Pack | Source | Licence |
|------|--------|---------|
| KayKit Adventurers 2.0 (FREE)        | https://kaylousberg.itch.io/kaykit-adventurers          | CC0 |
| KayKit Skeletons 1.1 (FREE)          | https://kaylousberg.itch.io/kaykit-skeletons            | CC0 |
| KayKit Character Animations 1.1      | https://kaylousberg.itch.io/kaykit-character-animations | CC0 |
| KayKit Dungeon Remastered 1.1 (FREE) | https://kaylousberg.itch.io/kaykit-dungeon-remastered   | CC0 |
| KayKit Forest Nature Pack 1.0 (FREE) | https://kaylousberg.com/game-assets                     | CC0 |
| KayKit Medieval Builder Pack 1.0     | https://kaylousberg.itch.io/kaykit-medieval-builder-pack | CC0 |
| Kenney Castle Kit (downloaded, unused) | https://kenney.nl/assets/castle-kit                   | CC0 |
| Quaternius Ultimate Monsters         | https://quaternius.com/packs/ultimatemonsters.html      | CC0 |
| Quaternius Medieval Weapons          | https://quaternius.com                                  | CC0 |

**Buildings** (`models/buildings.glb`) — 18 KayKit Medieval Builder objects (house/castle/barracks/
market/mill/watermill/lumbermill/mine/well/watchtower/archeryrange/farm_plot/wall_*/bridge*) packed into
one `.glb` (`gltf-transform merge --merge-scenes → dedup → prune`, ~920 KB). Multi-material vertex-colour
(no atlas). Loaded once; addressed by node name (`getObjectByName('castle')`), cloned per town placement.

### In-game entity → source file mapping (as sorted)
**Heroes** (`models/heroes/`, self-contained `.glb`)
- Warrior → `Knight.glb` · Mage → `Mage.glb` · Rogue → `Rogue.glb`

**NPC mesh pool** (`models/npcs/`) — spare KayKit characters; the game reuses/tints these for
Merchant/Smith/Alchemist/Stash/Enchanter/Jeweler/Gambler/Premium (only ~3 distinct meshes exist in the FREE pack):
- `Barbarian.glb`, `Ranger.glb`, `Rogue_Hooded.glb`

**Monsters** (`models/monsters/`)
- skeleton → KayKit `Skeleton_Minion/Warrior/Mage/Rogue.glb` (4 variants, self-contained `.glb`)
- fallen → `Orc.gltf` · zombie → `Orc_Skull.gltf` · shaman → `Tribal.gltf` · brute → `Yeti.gltf`
  · imp → `Demon.gltf` · hellhound → `Dino.gltf` · wraith → `Ghost.gltf`
  *(Quaternius Ultimate Monsters; geometry + texture both embedded — no external atlas needed)*

**Bosses** (`models/bosses/`, Quaternius, self-contained)
- `Dragon.gltf`, `Dragon_Evolved.gltf`, `MushroomKing.gltf`, `Goleling_Evolved.gltf`, `Mushnub_Evolved.gltf`
- **Belphegor (large demon) → `BlueDemon.gltf`**

**Dungeon** (`models/dungeon.glb`) — full KayKit kit, **211 pieces packed into one `.glb`** (one scene,
each piece a uniquely-named root node, one shared embedded texture). Load once, address pieces by name
(e.g. `scene.getObjectByName('chest')`). Loads with a plain `GLTFLoader` — no KTX2/decoder needed.
**Nature** (`models/nature.glb`) — full KayKit kit, **105 pieces packed into one `.glb`** (same scheme).
**Props** (`models/props/`) — kept loose/addressable: chest, chest_gold, coin, coin_stack_large, bottle_A_labeled_green (potion), torch_lit, mugs (+`dungeon_texture.png`).

> Packed with gltf-transform 4.4.0: `merge --merge-scenes` → `dedup` → `prune`. Cut the dungeon+nature
> footprint from **634 loose files (6.4+2.0 MB) to 2 glbs (4.7+1.3 MB)** — i.e. ~634 HTTP requests → 2 on
> GitHub Pages. The 316 original `.gltf`+`.bin` pairs are preserved in **gitignored** `assets/_source/models/`.
**Animations** (`assets/animations/`) — KayKit shared set, 14 `.glb` (Rig_Medium_* + Rig_Large_*).

> Monster/boss picks are best-effort style matches against a whimsical creature pack — swap any
> by copying a different `<Name>.gltf` from the source pack into the same folder.

### Weapons ✅ (from KayKit Adventurers)
`models/weapons/` — 28 weapon/equipment `.gltf`+`.bin` from the KayKit Adventurers
`Assets/gltf/` set (style-matched to the heroes): sword_1handed/2handed, axe_1handed/2handed,
dagger, bow (+withString), crossbow_1handed/2handed, arrows, quiver, staff, wand,
spellbook_open/closed, smokebomb, and shields (round/square/badge/spikes + color variants).
They reference per-class palette atlases — all 5 (`knight/mage/ranger/rogue/barbarian_texture.png`,
~13 KB each) are co-located so every piece resolves. The 2 mugs went to `models/props/`.

> The downloaded *Quaternius Medieval Weapons* pack was **not used** — it ships only `.fbx`/`.obj`,
> which three.js `GLTFLoader` can't load. It remains in the (git-ignored) `_incoming/`.

---

## Pre-existing models (`assets/models/*.glb`, flat)

These 9 GLBs (hero, fallen, zombie, shaman, brute, boss, vendor, smith, stash) predate
this asset pass and are the **live game roster** loaded via `assets/models/manifest.json`.
Per project history they derive from KayKit (heroes/NPCs) and Quaternius (monsters/boss),
all CC0. They were **not modified** by this asset-prep pass.
