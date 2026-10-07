// Shared constants (simulation + client).
export const GAME_TITLE = 'Heroes Defence';
export const GAME_SUBTITLE = "L'Arène des Damnés";
export const VERSION = '1.0.0';

export const TICK_RATE = 30;
export const DT = 1 / TICK_RATE;
export const NET_SNAPSHOT_EVERY = 2; // remote snapshot every N ticks (15 Hz)

export const MAX_PLAYERS = 4;
export const TEAM_HEROES = 0;
export const TEAM_MONSTERS = 1;

export const ARENA_RADIUS = 30; // walkable radius
export const WORLD_HALF = 40;

export const READY_COUNTDOWN = 30;
export const ALL_READY_COUNTDOWN = 3;
export const FINAL_WAVE = 30;
export const BOSS_EVERY = 5;

export const INVENTORY_SIZE = 24;
export const SHOP_SIZE = 6;
export const PICKUP_RANGE = 2.2;
export const ITEM_PICK_RANGE = 3.2;
export const REVIVE_RANGE = 2.6;
export const REVIVE_TIME = 3;
export const CHEST_OPEN_TIME = 1.2;

export const PHASE = Object.freeze({
  PREP: 'prep',
  WAVE: 'wave',
  VICTORY: 'victory',
  DEFEAT: 'defeat',
});

// Ability slots, in input-bit order
export const SLOTS = ['primary', 'secondary', 'skill1', 'skill2', 'ultimate', 'dash'];
export const SLOT_INDEX = Object.fromEntries(SLOTS.map((s, i) => [s, i]));

// Input bits
export const IN = Object.freeze({
  PRIMARY: 1 << 0,
  SECONDARY: 1 << 1,
  SKILL1: 1 << 2,
  SKILL2: 1 << 3,
  ULTIMATE: 1 << 4,
  DASH: 1 << 5,
  INTERACT: 1 << 6,
  POTION: 1 << 7,
});

// Damage types (3 bits in snapshots)
export const DMG_TYPES = ['phys', 'fire', 'cold', 'light', 'poison', 'holy', 'shadow', 'arcane'];
export const DMG_TYPE_INDEX = Object.fromEntries(DMG_TYPES.map((t, i) => [t, i]));
export const DMG_TYPE_NAMES = {
  phys: 'physiques', fire: 'de feu', cold: 'de froid', light: 'de foudre',
  poison: 'de poison', holy: 'sacrés', shadow: "d'ombre", arcane: 'arcaniques',
};
export const DMG_TYPE_COLORS = {
  phys: '#f2f2f2', fire: '#ff8a3d', cold: '#8fd8ff', light: '#fff27a',
  poison: '#8ef06a', holy: '#ffe9a8', shadow: '#c58cff', arcane: '#ff8cf0',
};

// Unit flags (u16 in snapshots)
export const UF = Object.freeze({
  ELITE: 1 << 0,
  BOSS: 1 << 1,
  STUN: 1 << 2,
  FROZEN: 1 << 3,
  CHILL: 1 << 4,
  BURN: 1 << 5,
  POISON: 1 << 6,
  SHOCK: 1 << 7,
  SHIELD: 1 << 8,
  INVULN: 1 << 9,
  DOWN: 1 << 10,
  STEALTH: 1 << 11,
  ROOT: 1 << 12,
  MARK: 1 << 13,
  CURSE: 1 << 14,
  SPAWNING: 1 << 15,
});

// Animation states (3 high bits of anim byte)
export const ANIM = Object.freeze({
  IDLE: 0, MOVE: 1, ATTACK: 2, CAST: 3, CHANNEL: 4, STUN: 5, SPAWN: 6, SPECIAL: 7,
});

// Damage event flags (u8)
export const DF = Object.freeze({
  TYPE_MASK: 0b111,
  CRIT: 1 << 3,
  HEAL: 1 << 4,
  DOT: 1 << 5,
  MISS: 1 << 6, // dodge / immune
  ALLY_SRC: 1 << 7, // dealt by heroes / their minions
});

export const ITEM_RARITIES = ['common', 'magic', 'rare', 'legendary', 'unique'];
export const ITEM_RARITY_NAMES = {
  common: 'Commun', magic: 'Magique', rare: 'Rare', legendary: 'Légendaire', unique: 'Unique',
};
export const ITEM_RARITY_COLORS = {
  common: '#d6d6d6', magic: '#6c9dff', rare: '#ffe14d', legendary: '#ff9a2a', unique: '#e2b86b',
};

export const TALENT_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const TALENT_RARITY_NAMES = {
  common: 'Commun', uncommon: 'Peu commun', rare: 'Rare', epic: 'Épique', legendary: 'Légendaire',
};
export const TALENT_RARITY_COLORS = {
  common: '#bdbdbd', uncommon: '#5fd46e', rare: '#4aa3ff', epic: '#b67bff', legendary: '#ff9a2e',
};

export const PLAYER_COLORS = ['#ffd24a', '#4ac8ff', '#ff5ea0', '#7dff6a'];

export const EQUIP_SLOTS = ['weapon', 'helm', 'chest', 'gloves', 'boots', 'amulet', 'ring1', 'ring2'];
export const SLOT_NAMES = {
  weapon: 'Arme', helm: 'Casque', chest: 'Torse', gloves: 'Gants', boots: 'Bottes',
  amulet: 'Amulette', ring: 'Anneau', ring1: 'Anneau', ring2: 'Anneau',
};
