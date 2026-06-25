// Ambient domain types for Sanctuary's End — zero-build type-checking. See jsconfig.json and types/README.md.
//
// These describe the core game-data shapes so JSDoc annotations in game.js (e.g. `/** @param {Item} it */`)
// and editor IntelliSense catch field typos and wrong shapes. Plain .d.ts: no runtime impact, nothing is
// emitted, the shipped game.js is byte-for-byte unchanged.
//
// No import/export => these are GLOBAL types, referenceable by bare name from game.js JSDoc (`{Item}`,
// `{Character}`, ...). They mirror the literals in game.js (AFFIXES, SLOTS, CLASSES, SAVE.newCharacter, …);
// keep them in sync when those shapes change.

// --- enumerations (mirror the const literals / key sets in game.js) ----------------------------------
type Slot = 'weapon' | 'helm' | 'armor' | 'gloves' | 'boots' | 'ring' | 'amulet';
type Rarity = 'common' | 'magic' | 'rare' | 'set' | 'unique';
type ClassId = 'warrior' | 'mage' | 'rogue';
type Difficulty = 'Normal' | 'Hard' | 'Hell' | 'Inferno';

/** Keys of the AFFIXES table (game.js). */
type AffixKey =
  | 'dmg'
  | 'hp'
  | 'mp'
  | 'armor'
  | 'str'
  | 'dex'
  | 'vit'
  | 'eng'
  | 'crit'
  | 'ias'
  | 'ms'
  | 'leech'
  | 'allstats'
  | 'thorns'
  | 'fireRes'
  | 'coldRes'
  | 'poisonRes'
  | 'lightRes'
  | 'allRes'
  | 'critDmg'
  | 'manaLeech'
  | 'leechAll'
  | 'burnOnHit'
  | 'bleedOnHit'
  | 'skillranks'
  | 'skilldmg'
  | 'activeskill'
  | 'fireDmg'
  | 'coldDmg'
  | 'lightDmg'
  | 'poisonDmg'
  | 'hpregen'
  | 'mpregen';

/** Rolled affixes on an item: a subset of affix keys mapped to magnitudes. */
type Affixes = Partial<Record<AffixKey, number>>;

interface Stats {
  str: number;
  dex: number;
  vit: number;
  eng: number;
}

// --- items -------------------------------------------------------------------------------------------
interface Item {
  id: number;
  slot: Slot;
  rarity: Rarity;
  ilvl: number;
  /** Base item name (e.g. "Sword", "Plate"); cosmetic, does not affect stats. */
  base: string;
  /** Primary stat (weapon damage / armor); 0 for rings & amulets. */
  baseStat: number;
  affixes: Affixes;
  /** Upgrade level applied at the smith (0..UPGRADE_CAP[rarity]). */
  upgrade: number;
  /** Display name; present once the item is fully rolled. */
  name?: string;
  /** Unique/set special-effect id (e.g. "lifesteal", "thorns", "critdmg", "allskills", "movespeed"). */
  effect?: string;
  /** Magnitude for `effect`. */
  effVal?: number;
  /** Human-readable description of `effect` (uniques). */
  effectDesc?: string;
  /** Set id (key into SET_DEFS) when this is a set piece. */
  set?: string;
  /** Enchant added at the enchanter. */
  enchant?: { key: string; val: number };
}

/** Equipped items by slot (null when empty). */
type Equipment = Record<Slot, Item | null>;

/** A world interaction point returned by interactables() (town gates, caves, waypoints, portals, vendors). */
interface Interactable {
  /** Discriminator: 'vendor' | 'towngate' | 'cave' | 'deeper' | 'wildnext' | 'wildprev' | 'waypoint' | … */
  kind: string;
  x: number;
  z: number;
  /** Town/area id (on 'towngate'). */
  area?: string;
  /** Destination region id (on 'wildnext' / 'wildprev'). */
  to?: string;
}

/** Player loot filter (Settings.lootFilter). */
interface LootFilter {
  rarity: Record<Rarity, boolean>;
  slot: Record<Slot, boolean>;
  minIlvl: number;
}

// --- skills ------------------------------------------------------------------------------------------
/** An entry in the SKILLDEFS table (active and passive variants share this shape). */
interface SkillDef {
  name: string;
  ico: string;
  type: 'active' | 'passive';
  maxRank: number;
  req: number;
  granted: boolean;
  desc: string;
  // active-only fields:
  kind?: string;
  elem?: string;
  onHit?: string;
  cost?: number;
  cd?: number;
}

// --- character / save --------------------------------------------------------------------------------
interface CharBase {
  hpMax: number;
  mpMax: number;
  dmg: number;
}

/** A saved hero (built by SAVE.newCharacter, backfilled by SAVE.migrate). */
interface Character {
  name: string;
  class: ClassId;
  version: number;
  created: number;
  lastPlayed: number;
  level: number;
  xp: number;
  xpNext: number;
  gold: number;
  kills: number;
  potions: number;
  hpPotions: number;
  mpPotions: number;
  potionTier: number;
  potionCap: number;
  invMax: number;
  stashMax: number;
  maxDepth: number;
  /** Currently-selected active skill id, or null. */
  activeSkillId: string | null;
  /** Discovered zones (zone id -> revealed). */
  discovered: Record<string, boolean>;
  base: CharBase;
  stats: Stats;
  statPoints: number;
  skillPoints: number;
  inventory: Item[];
  stash: Item[];
  equipment: Equipment;
  /** Skill id -> allocated rank. */
  skills: Record<string, number>;
  /** Allocated passive-tree node ids. */
  passives: string[];
}

/** Global game settings (SAVE._data.settings). */
interface Settings {
  difficulty: Difficulty;
  muted: boolean;
  volume: number;
  music: boolean;
  sfx: boolean;
  shake: boolean;
  dmgnum: boolean;
  resScale: number;
  shadows: boolean;
  postfx: boolean;
  bloom: number;
  exposure: number;
  reflections: boolean;
  ssao: boolean;
  colorgrade: boolean;
  vfx: boolean;
  particles: boolean;
  lootFilter: LootFilter;
  keybinds: Record<string, string>;
}

/** The persisted save blob (localStorage, JSON). */
interface SaveData {
  version: number;
  slots: Array<Character | null>;
  settings: Settings;
}
