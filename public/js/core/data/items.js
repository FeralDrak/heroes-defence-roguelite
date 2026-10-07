// Item bases and affix pool (Diablo-like, simplified).

// Weapon bases per class. `implicit` is a fixed bonus of the base type.
export const WEAPON_BASES = {
  warrior: [
    { id: 'w_sword', name: 'Épée longue', icon: '🗡️', implicit: { atkSpd: 6 } },
    { id: 'w_axe', name: 'Hache de guerre', icon: '🪓', implicit: { critDmg: 15 } },
    { id: 'w_mace', name: "Masse d'armes", icon: '🔨', implicit: { dmgElite: 10 } },
  ],
  archer: [
    { id: 'a_longbow', name: 'Arc long', icon: '🏹', implicit: { critChance: 3 } },
    { id: 'a_crossbow', name: 'Arbalète', icon: '🏹', implicit: { dmgPct: 8 } },
    { id: 'a_shortbow', name: 'Arc court', icon: '🏹', implicit: { atkSpd: 8 } },
  ],
  mage: [
    { id: 'm_staff', name: 'Bâton', icon: '🔮', implicit: { area: 8 } },
    { id: 'm_wand', name: 'Baguette', icon: '🔮', implicit: { cdr: 4 } },
    { id: 'm_orb', name: 'Orbe', icon: '🔮', implicit: { dmgArcane: 10 } },
  ],
  summoner: [
    { id: 'n_scythe', name: 'Faux', icon: '⚰️', implicit: { summonDmg: 10 } },
    { id: 'n_sceptre', name: 'Sceptre', icon: '💀', implicit: { summonHp: 12 } },
    { id: 'n_tome', name: 'Grimoire', icon: '📕', implicit: { dmgShadow: 10 } },
  ],
  engineer: [
    { id: 'e_wrench', name: 'Clé à molette', icon: '🔧', implicit: { summonDmg: 10 } },
    { id: 'e_arquebus', name: 'Arquebuse', icon: '🔫', implicit: { critChance: 3 } },
    { id: 'e_riveter', name: 'Lance-rivets', icon: '🔩', implicit: { atkSpd: 8 } },
  ],
  paladin: [
    { id: 'p_hammer', name: 'Marteau de guerre', icon: '🔨', implicit: { dmgHoly: 10 } },
    { id: 'p_flail', name: 'Fléau', icon: '⛓️', implicit: { atkSpd: 6 } },
    { id: 'p_holymace', name: 'Masse sacrée', icon: '🔱', implicit: { healRecv: 10 } },
  ],
  assassin: [
    { id: 'x_daggers', name: 'Dagues jumelles', icon: '🔪', implicit: { critChance: 4 } },
    { id: 'x_kris', name: 'Kriss', icon: '🗡️', implicit: { poisonChance: 8 } },
    { id: 'x_claws', name: 'Griffes', icon: '🐾', implicit: { atkSpd: 8 } },
  ],
  warlock: [
    { id: 'k_cursedstaff', name: 'Bâton maudit', icon: '🦯', implicit: { dotDmg: 10 } },
    { id: 'k_grimoire', name: 'Grimoire impie', icon: '📓', implicit: { dmgShadow: 10 } },
    { id: 'k_skull', name: 'Crâne rituel', icon: '💀', implicit: { cdr: 4 } },
  ],
};

export const ARMOR_BASES = {
  helm: [
    { id: 'h_helm', name: 'Heaume', icon: '⛑️', armor: 0.6 },
    { id: 'h_hood', name: 'Capuche', icon: '🎩', armor: 0.45, implicit: { dodge: 1.5 } },
    { id: 'h_circlet', name: 'Diadème', icon: '👑', armor: 0.35, implicit: { cdr: 3 } },
  ],
  chest: [
    { id: 'c_plate', name: 'Cuirasse', icon: '🛡️', armor: 1.0 },
    { id: 'c_robe', name: 'Robe', icon: '🥻', armor: 0.65, implicit: { res: 6 } },
    { id: 'c_leather', name: 'Brigandine', icon: '🦺', armor: 0.8, implicit: { dodge: 2 } },
  ],
  gloves: [
    { id: 'g_gauntlets', name: 'Gantelets', icon: '🧤', armor: 0.4 },
    { id: 'g_gloves', name: 'Gants', icon: '🧤', armor: 0.3, implicit: { atkSpd: 3 } },
  ],
  boots: [
    { id: 'b_greaves', name: 'Grèves', icon: '🥾', armor: 0.4, implicit: { moveSpd: 4 } },
    { id: 'b_boots', name: 'Bottes', icon: '👢', armor: 0.3, implicit: { moveSpd: 7 } },
  ],
  amulet: [
    { id: 'am_amulet', name: 'Amulette', icon: '📿', armor: 0, implicit: { res: 4 } },
    { id: 'am_talisman', name: 'Talisman', icon: '🧿', armor: 0, implicit: { dmgPct: 4 } },
    { id: 'am_pendant', name: 'Pendentif', icon: '💠', armor: 0, implicit: { maxHpPct: 4 } },
  ],
  ring: [
    { id: 'r_ring', name: 'Anneau', icon: '💍', armor: 0, implicit: { critChance: 1.5 } },
    { id: 'r_band', name: 'Bague', icon: '💍', armor: 0, implicit: { lifeSteal: 0.5 } },
    { id: 'r_seal', name: 'Sceau', icon: '💍', armor: 0, implicit: { goldFind: 5 } },
  ],
};

export const ITEM_SLOT_TYPES = ['weapon', 'helm', 'chest', 'gloves', 'boots', 'amulet', 'ring'];

const W = ['weapon'];
const ARM = ['helm', 'chest', 'gloves', 'boots'];
const JEW = ['amulet', 'ring'];

// Affix pool. `scale`: flat value grows with item level. `dec`: decimals kept.
// `cls`: only rolls for these classes (class-specific affixes).
export const AFFIXES = [
  { id: 'dmgPct', min: 5, max: 12, slots: [...W, ...JEW, 'gloves'], w: 10 },
  { id: 'atkSpd', min: 4, max: 9, slots: [...W, 'gloves', ...JEW], w: 8 },
  { id: 'critChance', min: 2, max: 5, slots: [...W, 'gloves', 'helm', ...JEW], w: 8, dec: 1 },
  { id: 'critDmg', min: 8, max: 20, slots: [...W, 'gloves', ...JEW], w: 7 },
  { id: 'maxHp', min: 12, max: 26, scale: true, slots: [...ARM, ...JEW], w: 12 },
  { id: 'maxHpPct', min: 4, max: 9, slots: ['chest', 'helm', 'amulet'], w: 6 },
  { id: 'armor', min: 6, max: 14, scale: true, slots: [...ARM, 'amulet'], w: 10 },
  { id: 'res', min: 4, max: 10, slots: ['helm', 'chest', 'boots', ...JEW], w: 8 },
  { id: 'regenPct', min: 0.15, max: 0.4, slots: ['helm', 'chest', ...JEW], w: 6, dec: 2 },
  { id: 'lifeSteal', min: 0.8, max: 2, slots: [...W, ...JEW, 'gloves'], w: 5, dec: 1 },
  { id: 'lifeOnKill', min: 2, max: 5, scale: true, slots: [...W, 'gloves', 'ring'], w: 5 },
  { id: 'moveSpd', min: 3, max: 8, slots: ['boots'], w: 14 },
  { id: 'cdr', min: 3, max: 7, slots: ['helm', ...JEW, ...W], w: 7 },
  { id: 'area', min: 5, max: 12, slots: [...W, 'amulet', 'chest'], w: 5 },
  { id: 'dur', min: 6, max: 14, slots: ['helm', 'amulet', 'chest'], w: 4 },
  { id: 'summonDmg', min: 8, max: 18, slots: [...W, 'amulet', 'helm', 'gloves'], w: 6, cls: ['summoner', 'engineer', 'warlock'] },
  { id: 'summonHp', min: 10, max: 22, slots: ['chest', 'helm', 'amulet'], w: 5, cls: ['summoner', 'engineer', 'warlock'] },
  { id: 'dmgPhys', min: 8, max: 18, slots: [...W, ...JEW, 'gloves'], w: 4, cls: ['warrior', 'archer', 'engineer', 'assassin'] },
  { id: 'dmgFire', min: 8, max: 18, slots: [...W, ...JEW, 'gloves'], w: 4, cls: ['mage', 'engineer', 'warlock'] },
  { id: 'dmgCold', min: 8, max: 18, slots: [...W, ...JEW, 'gloves'], w: 4, cls: ['mage', 'archer'] },
  { id: 'dmgLight', min: 8, max: 18, slots: [...W, ...JEW, 'gloves'], w: 4, cls: ['mage', 'engineer'] },
  { id: 'dmgPoison', min: 8, max: 18, slots: [...W, ...JEW, 'gloves'], w: 4, cls: ['assassin', 'archer'] },
  { id: 'dmgHoly', min: 8, max: 18, slots: [...W, ...JEW, 'gloves'], w: 4, cls: ['paladin'] },
  { id: 'dmgShadow', min: 8, max: 18, slots: [...W, ...JEW, 'gloves'], w: 4, cls: ['summoner', 'warlock'] },
  { id: 'dmgArcane', min: 8, max: 18, slots: [...W, ...JEW, 'gloves'], w: 4, cls: ['mage'] },
  { id: 'dmgElite', min: 8, max: 18, slots: [...W, ...JEW], w: 5 },
  { id: 'dmgCC', min: 8, max: 18, slots: [...W, 'gloves', 'ring'], w: 4 },
  { id: 'dotDmg', min: 8, max: 18, slots: [...W, ...JEW], w: 4 },
  { id: 'dodge', min: 1.5, max: 4, slots: ['boots', 'chest', 'helm'], w: 4, dec: 1 },
  { id: 'dmgReduc', min: 2, max: 5, slots: ['chest', 'helm', 'amulet'], w: 3 },
  { id: 'thorns', min: 4, max: 10, scale: true, slots: ['chest', 'gloves', 'boots'], w: 4 },
  { id: 'goldFind', min: 6, max: 15, slots: ['helm', ...JEW, 'boots'], w: 4 },
  { id: 'xpGain', min: 5, max: 12, slots: ['helm', ...JEW], w: 3 },
  { id: 'luck', min: 6, max: 15, slots: ['helm', ...JEW, 'gloves'], w: 4 },
  { id: 'pickup', min: 15, max: 35, slots: ['boots', 'amulet'], w: 2 },
  { id: 'burnChance', min: 4, max: 10, slots: [...W, 'gloves', 'ring'], w: 3 },
  { id: 'chillChance', min: 4, max: 10, slots: [...W, 'gloves', 'ring'], w: 3 },
  { id: 'shockChance', min: 4, max: 10, slots: [...W, 'gloves', 'ring'], w: 3 },
  { id: 'poisonChance', min: 4, max: 10, slots: [...W, 'gloves', 'ring'], w: 3 },
  { id: 'bleedChance', min: 4, max: 10, slots: [...W, 'gloves', 'ring'], w: 3 },
  { id: 'healRecv', min: 6, max: 14, slots: ['chest', ...JEW], w: 3 },
  { id: 'potionHeal', min: 10, max: 25, slots: ['amulet', 'chest', 'gloves'], w: 2 },
  // "+X% dégâts de <compétence>" (class ability), rolled with the class context
  { id: 'abil', min: 10, max: 25, slots: [...W, 'helm', 'gloves', 'amulet'], w: 7, special: 'ability' },
];

export const AFFIX_BY_ID = Object.fromEntries(AFFIXES.map((a) => [a.id, a]));

// Name fragments for magic & rare items
export const MAGIC_SUFFIXES = {
  dmgPct: 'de Puissance', atkSpd: 'de Célérité', critChance: 'de Précision', critDmg: 'de Brutalité',
  maxHp: 'de Vitalité', maxHpPct: 'du Colosse', armor: 'du Rempart', res: 'de Résilience',
  regenPct: 'de Régénération', lifeSteal: 'du Vampire', lifeOnKill: 'du Charognard', moveSpd: 'du Vent',
  cdr: 'de Concentration', area: "d'Ampleur", dur: 'de Persistance', summonDmg: 'du Maître',
  summonHp: 'du Berger', dmgPhys: 'du Bretteur', dmgFire: 'des Flammes', dmgCold: 'du Givre',
  dmgLight: "de l'Orage", dmgPoison: 'de la Vipère', dmgHoly: "de l'Aube", dmgShadow: 'des Ombres',
  dmgArcane: 'des Arcanes', dmgElite: 'du Tueur de géants', dmgCC: 'du Geôlier', dotDmg: 'de la Gangrène',
  dodge: 'du Renard', dmgReduc: 'du Bastion', thorns: 'des Ronces', goldFind: 'de Fortune',
  xpGain: "de l'Érudit", luck: 'du Trèfle', pickup: "de l'Aimant", burnChance: 'de Braise',
  chillChance: 'de Gel', shockChance: 'des Étincelles', poisonChance: 'du Venin', bleedChance: 'du Boucher',
  healRecv: 'de Guérison', potionHeal: "de l'Alchimiste", abil: 'du Virtuose',
};

export const RARE_NAME_A = [
  'Croc', 'Ombre', 'Fléau', 'Murmure', 'Cendre', 'Rage', 'Gloire', 'Brume', 'Écho', 'Lune', 'Sang',
  'Tempête', 'Givre', 'Destin', 'Serment', 'Plainte', 'Aube', 'Crépuscule', 'Épine', 'Faille', 'Braise',
  'Tonnerre', 'Silence', 'Vertige', 'Sépulcre', 'Fureur', 'Rune', 'Éclat', 'Spectre', 'Venin',
];
export const RARE_NAME_B = [
  'Funeste', 'Éternel', 'Sanglant', 'Maudit', 'Hurlant', 'Brisé', 'Sombre', 'Ardent', 'Glacial',
  'Céleste', 'Impie', 'Sauvage', 'Royal', 'Oublié', 'Fendu', 'Rugissant', 'Écarlate', 'Vorace',
  'Spectral', 'Solennel', 'Fiévreux', 'Silencieux', 'Démoniaque', 'Antique', 'Infini',
];

// Rarity tuning
export const RARITY_INFO = {
  common: { affixes: [0, 0], powerMul: 1.0, value: 20 },
  magic: { affixes: [1, 2], powerMul: 1.05, value: 45 },
  rare: { affixes: [3, 4], powerMul: 1.12, value: 110 },
  legendary: { affixes: [3, 4], powerMul: 1.2, value: 320 },
  unique: { affixes: [0, 0], powerMul: 1.25, value: 520 },
};

export const BASE_WEAPON_POWER = 10;
export const BASE_ARMOR = 7;
export const ILVL_GROWTH = 1.1; // weapon damage / armor / flat affixes per item level

export function ilvlScale(ilvl) {
  return Math.pow(ILVL_GROWTH, Math.max(0, ilvl - 1));
}

/** Percent affixes grow slowly with item level */
export function pctScale(ilvl) {
  return 1 + Math.max(0, ilvl - 1) / 45;
}
