// Stat definitions: keys, labels and formatting.
// fmt: 'int' (flat integer), 'pct' (+x%), 'f1' (one decimal), 'hps' (per second)
export const STAT_DEFS = {
  maxHp: { name: 'Points de vie', fmt: 'int' },
  maxHpPct: { name: 'Points de vie max', fmt: 'pct' },
  regen: { name: 'Régénération de PV', fmt: 'hps' },
  regenPct: { name: 'Régénération (% PV max/s)', fmt: 'pctf' },
  armor: { name: 'Armure', fmt: 'int' },
  armorPct: { name: 'Armure', fmt: 'pct' },
  res: { name: 'Résistance élémentaire', fmt: 'pct', cap: 75 },
  dodge: { name: "Chance d'esquive", fmt: 'pctf', cap: 50 },
  dmgReduc: { name: 'Réduction des dégâts', fmt: 'pct', cap: 60 },
  power: { name: 'Dégâts de l\'arme', fmt: 'int' },
  dmgPct: { name: 'Dégâts', fmt: 'pct' },
  atkSpd: { name: "Vitesse d'attaque", fmt: 'pct' },
  critChance: { name: 'Chance de coup critique', fmt: 'pctf', cap: 100 },
  critDmg: { name: 'Dégâts critiques', fmt: 'pct' },
  cdr: { name: 'Réduction des temps de recharge', fmt: 'pct', cap: 60 },
  moveSpd: { name: 'Vitesse de déplacement', fmt: 'pct' },
  area: { name: "Taille des zones d'effet", fmt: 'pct' },
  dur: { name: 'Durée des compétences', fmt: 'pct' },
  lifeSteal: { name: 'Vol de vie', fmt: 'pctf' },
  lifeOnKill: { name: 'PV par élimination', fmt: 'int' },
  thorns: { name: 'Épines', fmt: 'int' },
  summonDmg: { name: 'Dégâts des serviteurs et structures', fmt: 'pct' },
  summonHp: { name: 'PV des serviteurs et structures', fmt: 'pct' },
  dmgPhys: { name: 'Dégâts physiques', fmt: 'pct' },
  dmgFire: { name: 'Dégâts de feu', fmt: 'pct' },
  dmgCold: { name: 'Dégâts de froid', fmt: 'pct' },
  dmgLight: { name: 'Dégâts de foudre', fmt: 'pct' },
  dmgPoison: { name: 'Dégâts de poison', fmt: 'pct' },
  dmgHoly: { name: 'Dégâts sacrés', fmt: 'pct' },
  dmgShadow: { name: "Dégâts d'ombre", fmt: 'pct' },
  dmgArcane: { name: 'Dégâts arcaniques', fmt: 'pct' },
  dmgElite: { name: 'Dégâts contre élites et boss', fmt: 'pct' },
  dmgCC: { name: 'Dégâts contre les ennemis entravés', fmt: 'pct' },
  dotDmg: { name: 'Dégâts sur la durée', fmt: 'pct' },
  burnChance: { name: 'Chance d\'embraser', fmt: 'pctf' },
  chillChance: { name: 'Chance de geler', fmt: 'pctf' },
  shockChance: { name: "Chance d'électrocuter", fmt: 'pctf' },
  poisonChance: { name: "Chance d'empoisonner", fmt: 'pctf' },
  bleedChance: { name: 'Chance de faire saigner', fmt: 'pctf' },
  healRecv: { name: 'Soins reçus', fmt: 'pct' },
  goldFind: { name: 'Or gagné', fmt: 'pct' },
  xpGain: { name: 'Expérience gagnée', fmt: 'pct' },
  luck: { name: "Découverte d'objets magiques", fmt: 'pct' },
  pickup: { name: 'Rayon de ramassage', fmt: 'pct' },
  potionCharges: { name: 'Charges de potion', fmt: 'int' },
  potionHeal: { name: 'Soins des potions', fmt: 'pct' },
};

export const TYPE_STAT = {
  phys: 'dmgPhys', fire: 'dmgFire', cold: 'dmgCold', light: 'dmgLight',
  poison: 'dmgPoison', holy: 'dmgHoly', shadow: 'dmgShadow', arcane: 'dmgArcane',
};

export function fmtStatValue(key, v) {
  const def = STAT_DEFS[key];
  const fmt = def ? def.fmt : 'int';
  const r1 = Math.round(v * 10) / 10;
  switch (fmt) {
    case 'pct': return `${v >= 0 ? '+' : ''}${Math.round(v)}%`;
    case 'pctf': return `${v >= 0 ? '+' : ''}${r1}%`;
    case 'hps': return `${v >= 0 ? '+' : ''}${r1}/s`;
    case 'f1': return `${v >= 0 ? '+' : ''}${r1}`;
    default: return `${v >= 0 ? '+' : ''}${Math.round(v)}`;
  }
}

/** "+12% Dégâts de feu" */
export function fmtStatLine(key, v) {
  const def = STAT_DEFS[key];
  if (!def) return `${key}: ${v}`;
  return `${fmtStatValue(key, v)} ${def.name}`;
}
