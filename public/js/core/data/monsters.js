// Monster definitions. Stats are base values at wave 1 (scaled by wave, difficulty and party size).
// ai: behaviour implemented in sim/monsterai.js
export const MONSTERS = {
  skeleton: {
    id: 'skeleton', name: 'Squelette', vis: 'mon_skeleton', hp: 30, dmg: 8, speed: 3.4, radius: 0.45,
    xp: 3, gold: 2, cost: 1, minWave: 1, weight: 10, ai: 'melee',
    atk: { range: 1.35, windup: 0.45, cd: 1.3, arc: 100 },
  },
  bat: {
    id: 'bat', name: 'Chauve-souris vampire', vis: 'mon_bat', hp: 12, dmg: 5, speed: 5.9, radius: 0.35,
    xp: 1.5, gold: 1, cost: 0.5, minWave: 2, weight: 7, ai: 'melee', flying: true, erratic: true, group: [3, 5],
    atk: { range: 1.0, windup: 0.25, cd: 0.9, arc: 120 },
  },
  ghoul: {
    id: 'ghoul', name: 'Goule', vis: 'mon_ghoul', hp: 78, dmg: 13, speed: 2.5, radius: 0.6, mass: 2,
    xp: 5, gold: 3, cost: 2, minWave: 3, weight: 7, ai: 'melee',
    atk: { range: 1.5, windup: 0.6, cd: 1.6, arc: 110 },
  },
  skelarcher: {
    id: 'skelarcher', name: 'Archer squelette', vis: 'mon_skelarcher', hp: 24, dmg: 10, speed: 3.2, radius: 0.45,
    xp: 4, gold: 2, cost: 1.8, minWave: 4, weight: 6, ai: 'ranged', keep: [7, 11],
    atk: { range: 13, windup: 0.75, cd: 2.4, proj: 'e_arrow', pspeed: 14 },
  },
  bomber: {
    id: 'bomber', name: 'Gobelin kamikaze', vis: 'mon_bomber', hp: 18, dmg: 34, speed: 4.9, radius: 0.4,
    xp: 3, gold: 2, cost: 1.8, minWave: 5, weight: 5, ai: 'bomber', noCorpse: true, dmgType: 'fire',
    atk: { range: 2.0, fuse: 0.85, radius: 2.7 },
  },
  spider: {
    id: 'spider', name: 'Araignée venimeuse', vis: 'mon_spider', hp: 24, dmg: 6, speed: 5.2, radius: 0.45,
    xp: 2.5, gold: 1.5, cost: 1.2, minWave: 6, weight: 6, ai: 'melee', poison: 0.5, group: [3, 6],
    atk: { range: 1.2, windup: 0.3, cd: 1.0, arc: 100 },
  },
  brute: {
    id: 'brute', name: 'Ogre brutal', vis: 'mon_brute', hp: 290, dmg: 30, speed: 2.6, radius: 1.0, mass: 5, scale: 1,
    xp: 18, gold: 10, cost: 8, minWave: 8, weight: 3, ai: 'charger', cleave: true,
    atk: { range: 2.3, windup: 0.75, cd: 2.2, arc: 120 },
    charge: { min: 5, max: 14, windup: 0.95, speed: 17, cd: 7, mult: 1.6 },
  },
  cultist: {
    id: 'cultist', name: 'Cultiste du feu', vis: 'mon_cultist', hp: 46, dmg: 24, speed: 3.0, radius: 0.45,
    xp: 6, gold: 4, cost: 3, minWave: 9, weight: 4, ai: 'caster', keep: [9, 13], dmgType: 'fire',
    atk: { range: 15, windup: 0.5, cd: 3.6, radius: 2.3, delay: 1.15 },
  },
  wraith: {
    id: 'wraith', name: 'Spectre', vis: 'mon_wraith', hp: 52, dmg: 15, speed: 3.9, radius: 0.5,
    xp: 6, gold: 4, cost: 3, minWave: 11, weight: 4, ai: 'teleporter', flying: true, dmgType: 'cold',
    atk: { range: 1.4, windup: 0.4, cd: 1.2, arc: 100 }, tp: { cd: 6, range: 16 },
  },
  slime: {
    id: 'slime', name: 'Slime acide', vis: 'mon_slime', hp: 66, dmg: 11, speed: 2.8, radius: 0.65, mass: 1.5,
    xp: 5, gold: 3, cost: 2.5, minWave: 12, weight: 4, ai: 'melee', split: 'slimelet', splitN: 2, dmgType: 'poison', noCorpse: true,
    atk: { range: 1.4, windup: 0.5, cd: 1.4, arc: 100 },
  },
  slimelet: {
    id: 'slimelet', name: 'Petit slime', vis: 'mon_slimelet', hp: 20, dmg: 6, speed: 3.7, radius: 0.4,
    xp: 1, gold: 0.5, cost: 0, minWave: 999, weight: 0, ai: 'melee', dmgType: 'poison', noCorpse: true,
    atk: { range: 1.1, windup: 0.35, cd: 1.1, arc: 100 },
  },
  shielder: {
    id: 'shielder', name: 'Gardien au bouclier', vis: 'mon_shielder', hp: 135, dmg: 17, speed: 2.7, radius: 0.6, mass: 3,
    xp: 9, gold: 5, cost: 4, minWave: 14, weight: 3, ai: 'melee', shield: true,
    atk: { range: 1.6, windup: 0.55, cd: 1.5, arc: 100 },
  },
  necro: {
    id: 'necro', name: 'Nécromancien', vis: 'mon_necro', hp: 82, dmg: 12, speed: 3.0, radius: 0.5,
    xp: 12, gold: 8, cost: 6, minWave: 16, weight: 2, ai: 'summoner', keep: [10, 15], dmgType: 'shadow',
    summon: { cd: 9, n: 3, type: 'skeleton' },
    atk: { range: 14, windup: 0.6, cd: 3, proj: 'e_shadow', pspeed: 12 },
  },
  demon: {
    id: 'demon', name: 'Démon berserker', vis: 'mon_demon', hp: 150, dmg: 25, speed: 4.3, radius: 0.65, mass: 2.5,
    xp: 12, gold: 8, cost: 6, minWave: 18, weight: 3, ai: 'leaper', dmgType: 'fire',
    atk: { range: 1.6, windup: 0.4, cd: 1.1, arc: 120 },
    leap: { min: 4, max: 11, windup: 0.85, cd: 6, radius: 2.8, mult: 1.5 },
  },
  gargoyle: {
    id: 'gargoyle', name: 'Gargouille', vis: 'mon_gargoyle', hp: 92, dmg: 16, speed: 3.5, radius: 0.6,
    xp: 9, gold: 6, cost: 4, minWave: 20, weight: 3, ai: 'ranged', flying: true, keep: [6, 10],
    atk: { range: 12, windup: 0.65, cd: 2.6, proj: 'e_stone', pspeed: 13, spread: 3, spreadAng: 0.32 },
  },
  knight: {
    id: 'knight', name: 'Chevalier maudit', vis: 'mon_knight', hp: 430, dmg: 40, speed: 2.9, radius: 0.8, mass: 5,
    xp: 25, gold: 15, cost: 10, minWave: 22, weight: 2, ai: 'knight', cleave: true, dmgType: 'shadow',
    atk: { range: 2.6, windup: 0.85, cd: 2.0, arc: 180 },
    spin: { cd: 8, windup: 1.0, radius: 3.8, mult: 1.4 },
  },
  // ---- summoned by bosses ----
  spiderling: {
    id: 'spiderling', name: 'Araignéeau', vis: 'mon_spiderling', hp: 9, dmg: 4, speed: 5.6, radius: 0.32,
    xp: 0.5, gold: 0.3, cost: 0, minWave: 999, weight: 0, ai: 'melee', poison: 0.3, noCorpse: true,
    atk: { range: 1.0, windup: 0.25, cd: 0.9, arc: 120 },
  },
  phylactery: {
    id: 'phylactery', name: 'Phylactère', vis: 'mon_phylactery', hp: 600, dmg: 0, speed: 0, radius: 0.9, mass: 99,
    xp: 10, gold: 10, cost: 0, minWave: 999, weight: 0, ai: 'static', noCorpse: true,
  },
  // ---- bosses (scripts in bosses.js) ----
  boneking: {
    id: 'boneking', name: 'Le Roi des Os', vis: 'boss_boneking', hp: 2200, dmg: 22, speed: 3.1, radius: 1.4, mass: 50, scale: 1,
    xp: 150, gold: 120, cost: 0, minWave: 999, weight: 0, ai: 'boss', boss: true,
  },
  broodmother: {
    id: 'broodmother', name: 'La Matriarche Arachnide', vis: 'boss_broodmother', hp: 4300, dmg: 26, speed: 4.0, radius: 1.8, mass: 50,
    xp: 260, gold: 200, cost: 0, minWave: 999, weight: 0, ai: 'boss', boss: true, dmgType: 'poison',
  },
  colossus: {
    id: 'colossus', name: 'Le Colosse de Pierre', vis: 'boss_colossus', hp: 8800, dmg: 38, speed: 2.5, radius: 2.1, mass: 80,
    xp: 400, gold: 320, cost: 0, minWave: 999, weight: 0, ai: 'boss', boss: true,
  },
  lich: {
    id: 'lich', name: 'La Liche Éternelle', vis: 'boss_lich', hp: 13500, dmg: 46, speed: 3.0, radius: 1.3, mass: 50,
    xp: 600, gold: 480, cost: 0, minWave: 999, weight: 0, ai: 'boss', boss: true, dmgType: 'cold',
  },
  infernal_lord: {
    id: 'infernal_lord', name: 'Le Seigneur Infernal', vis: 'boss_infernal', hp: 21000, dmg: 55, speed: 3.4, radius: 1.9, mass: 80,
    xp: 850, gold: 700, cost: 0, minWave: 999, weight: 0, ai: 'boss', boss: true, dmgType: 'fire',
  },
  devourer: {
    id: 'devourer', name: 'Le Dévoreur', vis: 'boss_devourer', hp: 36000, dmg: 64, speed: 3.2, radius: 2.4, mass: 99,
    xp: 1300, gold: 1000, cost: 0, minWave: 999, weight: 0, ai: 'boss', boss: true, dmgType: 'shadow',
  },
};

export const SPAWNABLE = Object.values(MONSTERS).filter((m) => m.weight > 0);
export const BOSS_ORDER = ['boneking', 'broodmother', 'colossus', 'lich', 'infernal_lord', 'devourer'];
