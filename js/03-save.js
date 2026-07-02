/* ================= SAVE ================= */
const SAVE = {
  KEY: 'sanctuarys_end_saves', VERSION: 7, NUM_SLOTS: 3, _data: null,
  load() {
    try { this._data = JSON.parse(localStorage.getItem(this.KEY)); } catch (e) { this._data = null; }
    if (!this._data) this._data = { version: this.VERSION, slots: Array(this.NUM_SLOTS).fill(null) };
    this._data.version = this.VERSION; if (!Array.isArray(this._data.slots)) this._data.slots = Array(this.NUM_SLOTS).fill(null);
    // Guard every slot: a corrupt/hand-edited/imported slot that isn't a valid character object must not
    // throw out of migrate() — this runs at top level, so an unhandled throw here bricks the whole game
    // on every boot (blank page until localStorage is cleared by hand). Bad slots degrade to empty.
    this._data.slots = this._data.slots.map(s => { if (!s || typeof s !== 'object' || Array.isArray(s)) return null; try { return this.migrate(s); } catch (e) { return null; } }); this._data.settings = Object.assign({ difficulty: 'Normal', muted: false, volume: 60, music: true, sfx: true, shake: true, dmgnum: true, resScale: 100, shadows: true, postfx: true, bloom: 0.9, exposure: 1.0, reflections: true, ssao: true, colorgrade: true, vfx: true, particles: true, lootFilter: { rarity: { common: true, magic: true, rare: true, set: true, unique: true }, slot: { weapon: true, helm: true, armor: true, gloves: true, boots: true, ring: true, amulet: true }, minIlvl: 0 }, keybinds: {} }, this._data.settings || {}); this.persist(); return this._data;
  },
  migrate(ch) {
    ch.base = ch.base || { hpMax: ch.hpMax || 100, mpMax: ch.mpMax || 50, dmg: (ch.dmg || 10) };
    ch.stats = ch.stats || { str: 10, dex: 10, vit: 10, eng: 10 };['str', 'dex', 'vit', 'eng'].forEach(k => { if (ch.stats[k] == null) ch.stats[k] = 10; });
    if (ch.statPoints == null) ch.statPoints = 0; if (ch.skillPoints == null) ch.skillPoints = 0;
    ch.inventory = ch.inventory || []; ch.stash = ch.stash || [];
    ch.equipment = Object.assign({ weapon: null, helm: null, armor: null, gloves: null, boots: null, ring: null, amulet: null }, ch.equipment || {});
    ch.skills = Object.assign(defaultSkillRanks(), ch.skills || {});
    if (ch.potions == null) ch.potions = 4;
    if (ch.hpPotions == null) ch.hpPotions = (ch.potions != null ? ch.potions : 4); if (ch.mpPotions == null) ch.mpPotions = 2;
    if (ch.potionTier == null) ch.potionTier = 0; if (ch.potionCap == null) ch.potionCap = 10;
    if (ch.invMax == null) ch.invMax = 40; if (ch.stashMax == null) ch.stashMax = 40; if (ch.activeSkillId === undefined) ch.activeSkillId = null; if (ch.materials == null) ch.materials = 0;
    if (ch.xpNext == null) ch.xpNext = 30; if (ch.maxDepth == null) ch.maxDepth = 0; if (!ch.class) ch.class = 'warrior'; if (!ch.passives || !ch.passives.length) ch.passives = [PTREE.starts[ch.class] || 'start_str']; if (ch.statPoints > 0) { ch.skillPoints = (ch.skillPoints || 0) + ch.statPoints; ch.statPoints = 0; }
    if (ch.discovered == null) ch.discovered = { town: true, highreach: false, emberhold: false };
    if (ch.gems == null) ch.gems = {};
    // ---- V7: ability loadout + per-skill rune trees (additive; never touches skills/passives/skillPoints/gems) ----
    if (!Array.isArray(ch.loadout) || ch.loadout.length !== 6) ch.loadout = defaultLoadout(ch); else ch.loadout[0] = 'strike';
    ch.skillRunes = ch.skillRunes || {};
    if (ch.abilityPoints == null) ch.abilityPoints = Math.max(0, (ch.level || 1) - 1); // retroactive +1/lvl from L2
    return ch;
  },
  persist() { try { localStorage.setItem(this.KEY, JSON.stringify(this._data)); return true; } catch (e) { return false; } },
  getSlot(i) { return this._data.slots[i]; },
  newCharacter(name, cls) {
    cls = CLASSES[cls] ? cls : 'warrior'; const c = CLASSES[cls]; const skills = {}; for (const id in SKILLDEFS) skills[id] = 0;
    return {
      name, class: cls, version: this.VERSION, created: Date.now(), lastPlayed: Date.now(), level: 1, xp: 0, xpNext: 30, gold: 0, materials: 0, gems: {}, kills: 0, potions: 4, hpPotions: 4, mpPotions: 2, potionTier: 0, potionCap: 10, invMax: 40, stashMax: 40, maxDepth: 0, activeSkillId: null, discovered: { town: true, highreach: false, emberhold: false },
      base: { hpMax: 100, mpMax: 50, dmg: 10 }, stats: { str: c.base.str, dex: c.base.dex, vit: c.base.vit, eng: c.base.eng }, statPoints: 0, skillPoints: 0,
      inventory: [], stash: [], equipment: { weapon: null, helm: null, armor: null, gloves: null, boots: null, ring: null, amulet: null }, skills, passives: [PTREE.starts[cls]],
      loadout: ['strike', (c.granted && c.granted[0]) || null, null, null, null, null], skillRunes: {}, abilityPoints: 0
    };
  },
  saveCharacter(i, ch) { ch.lastPlayed = Date.now(); this._data.slots[i] = ch; return this.persist(); },
  deleteSlot(i) { this._data.slots[i] = null; this.persist(); }
};
SAVE.load();
let currentSlot = null, character = null; const INV_CAP = 80, STASH_CAP = 80;
let difficulty = SAVE._data.settings.difficulty;
