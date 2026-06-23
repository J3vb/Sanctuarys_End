# Incoming source downloads — status

The source zips/folders in this directory are **git-ignored and not published** (see
`.gitignore`). Sorted picks live in `assets/models/` + `assets/animations/`. Full mapping
is in `assets/CREDITS.md`.

## Imported ✅ (sorted into assets/)
- [x] KayKit Adventurers → `models/heroes/` (Knight/Mage/Rogue) + `models/npcs/` (Barbarian/Ranger/Rogue_Hooded)
- [x] KayKit Skeletons → `models/monsters/` (Skeleton_Minion/Warrior/Mage/Rogue)
- [x] KayKit Character Animations → `animations/` (14 shared-rig GLBs)
- [x] KayKit Dungeon Remastered → `models/dungeon/` (211 pieces) + `models/props/` (chest/coin/potion/torch)
- [x] KayKit Forest Nature Pack → `models/nature/` (105 trees/bushes/grass/rocks)
- [x] Quaternius Ultimate Monsters → `models/monsters/` (7 archetypes) + `models/bosses/` (5 + Belphegor)

- [x] Weapons → `models/weapons/` (28 KayKit Adventurers weapon/equipment glTFs + 5 palette
      textures; mugs → props/). The Quaternius *Medieval Weapons* pack was FBX/OBJ-only and
      unused — KayKit's glTF weapons (already downloaded, hero-matched) were used instead.

## Nothing open
All requested packs are imported. Dungeon + nature kits are now packed into single
`models/dungeon.glb` + `models/nature.glb` (634 loose files → 2; loose originals preserved
in gitignored `_source/models/`).

## Auto-downloaded earlier (no action needed)
- 3 Poly Haven HDRIs (`assets/hdri/`), 8 ambientCG PBR texture sets (`assets/textures/`).
