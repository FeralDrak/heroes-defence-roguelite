// Level-up talents: generic pool + class pools (from class files).
import { CLASS_TALENTS } from './classes/index.js';

const R5 = (a, b, c, d, e) => [a, b, c, d, e];

export const GENERIC_TALENTS = [
  { id: 'gen_vigor', name: 'Vigueur', icon: '❤️', max: 5,
    desc: '+{v}% de PV max.', vals: { v: R5(6, 9, 13, 18, 25) },
    stats(B, v) { B.add('maxHpPct', v.v); } },
  { id: 'gen_power', name: 'Puissance brute', icon: '💪', max: 5,
    desc: '+{v}% de dégâts.', vals: { v: R5(6, 9, 13, 18, 25) },
    stats(B, v) { B.add('dmgPct', v.v); } },
  { id: 'gen_haste', name: 'Célérité', icon: '⚡', max: 5,
    desc: "+{v}% de vitesse d'attaque.", vals: { v: R5(5, 7.5, 11, 15, 21) },
    stats(B, v) { B.add('atkSpd', v.v); } },
  { id: 'gen_crit', name: 'Précision', icon: '🎯', max: 5,
    desc: '+{v}% de chance de coup critique.', vals: { v: R5(2, 3, 4.5, 6.5, 9) },
    stats(B, v) { B.add('critChance', v.v); } },
  { id: 'gen_critdmg', name: 'Brutalité', icon: '💢', max: 5,
    desc: '+{v}% de dégâts critiques.', vals: { v: R5(8, 12, 17, 24, 33) },
    stats(B, v) { B.add('critDmg', v.v); } },
  { id: 'gen_cdr', name: 'Concentration', icon: '⏳', max: 4,
    desc: '+{v}% de réduction des temps de recharge.', vals: { v: R5(2.5, 3.75, 5.5, 8, 11) },
    stats(B, v) { B.add('cdr', v.v); } },
  { id: 'gen_speed', name: 'Agilité', icon: '👟', max: 3,
    desc: '+{v}% de vitesse de déplacement.', vals: { v: R5(3, 4.5, 6.5, 9, 12) },
    stats(B, v) { B.add('moveSpd', v.v); } },
  { id: 'gen_armor', name: 'Cuirasse', icon: '🛡️', max: 4,
    desc: "+{v}% d'armure.", vals: { v: R5(8, 12, 17, 24, 33) },
    stats(B, v) { B.add('armorPct', v.v); } },
  { id: 'gen_res', name: 'Résilience', icon: '🌈', max: 4,
    desc: '+{v}% de résistance élémentaire.', vals: { v: R5(4, 6, 8.5, 12, 16) },
    stats(B, v) { B.add('res', v.v); } },
  { id: 'gen_regen', name: 'Récupération', icon: '💚', max: 4,
    desc: 'Régénère {v}% de vos PV max par seconde.', vals: { v: R5(0.15, 0.22, 0.33, 0.48, 0.7) },
    stats(B, v) { B.add('regenPct', v.v); } },
  { id: 'gen_leech', name: 'Vampirisme', icon: '🦇', max: 4,
    desc: '+{v}% de vol de vie.', vals: { v: R5(0.6, 0.9, 1.3, 1.9, 2.6) },
    stats(B, v) { B.add('lifeSteal', v.v); } },
  { id: 'gen_area', name: 'Ampleur', icon: '⭕', max: 4,
    desc: "+{v}% de taille des zones d'effet.", vals: { v: R5(5, 7.5, 11, 15, 21) },
    stats(B, v) { B.add('area', v.v); } },
  { id: 'gen_dur', name: 'Persistance', icon: '⌛', max: 3,
    desc: '+{v}% de durée des compétences.', vals: { v: R5(6, 9, 13, 18, 25) },
    stats(B, v) { B.add('dur', v.v); } },
  { id: 'gen_gold', name: 'Cupidité', icon: '💰', max: 3,
    desc: "+{v}% d'or gagné.", vals: { v: R5(8, 12, 17, 24, 33) },
    stats(B, v) { B.add('goldFind', v.v); } },
  { id: 'gen_luck', name: 'Chance', icon: '🍀', max: 3,
    desc: "+{v}% de découverte d'objets magiques.", vals: { v: R5(10, 15, 22, 30, 42) },
    stats(B, v) { B.add('luck', v.v); } },
  { id: 'gen_xp', name: 'Érudition', icon: '📚', max: 3,
    desc: "+{v}% d'expérience gagnée.", vals: { v: R5(6, 9, 13, 18, 25) },
    stats(B, v) { B.add('xpGain', v.v); } },
  { id: 'gen_potion', name: 'Alchimiste', icon: '⚗️', max: 3,
    desc: 'Vos potions soignent +{v}%.', vals: { v: R5(10, 15, 22, 30, 42) },
    stats(B, v) { B.add('potionHeal', v.v); } },
  { id: 'gen_flask', name: 'Ceinture garnie', icon: '🧴', max: 2, minR: 2, locked: true,
    desc: '+{v} charge(s) de potion par vague.', vals: { v: R5(0, 0, 1, 1, 2) },
    stats(B, v) { B.add('potionCharges', v.v); } },
  { id: 'gen_elite', name: 'Tueur de géants', icon: '🐉', max: 4,
    desc: '+{v}% de dégâts contre les élites et les boss.', vals: { v: R5(6, 9, 13, 18, 25) },
    stats(B, v) { B.add('dmgElite', v.v); } },
  { id: 'gen_dodge', name: 'Réflexes', icon: '🌀', max: 4,
    desc: "+{v}% de chance d'esquive.", vals: { v: R5(1.5, 2.25, 3.3, 4.8, 6.5) },
    stats(B, v) { B.add('dodge', v.v); } },
  { id: 'gen_thorns', name: 'Épines', icon: '🌵', max: 3,
    desc: 'Les ennemis qui vous frappent en mêlée subissent {v}% de vos dégâts d\'arme.', vals: { v: R5(40, 60, 85, 120, 165) },
    stats(B, v, h) { if (h) B.add('thorns', (h.equip.weapon ? h.equip.weapon.power : 6) * v.v / 100); } },
  { id: 'gen_secondwind', name: 'Second souffle', icon: '💨', max: 1, minR: 4, locked: true,
    desc: 'Une fois par vague, une blessure mortelle vous laisse à 1 PV et vous rend invulnérable 2 s.', vals: { v: R5(0, 0, 0, 0, 1) },
    hooks: {
      onLethal(g, h, acc, v, st) {
        if (st.wave === g.wave) return;
        st.wave = g.wave;
        acc.prevent = true;
        h.hp = 1;
        h.invulnT = 2;
        g.fx('text', { u: h.id, s: 'Second souffle !', c: '#9ff' });
      },
    } },
  { id: 'gen_pickup', name: 'Magnétisme', icon: '🧲', max: 2,
    desc: '+{v}% de rayon de ramassage.', vals: { v: R5(25, 40, 60, 85, 120) },
    stats(B, v) { B.add('pickup', v.v); } },
  { id: 'gen_killheal', name: 'Soif de combat', icon: '🍖', max: 3,
    desc: 'Chaque élimination vous rend {v}% de vos PV max.', vals: { v: R5(0.15, 0.22, 0.33, 0.48, 0.7) },
    stats(B, v) { B.add('killHealPct', v.v); } },
  { id: 'gen_elemental', name: 'Maîtrise élémentaire', icon: '☯️', max: 3,
    desc: "+{v}% de chance d'appliquer les effets élémentaires (brûlure, gel, électrocution, poison).", vals: { v: R5(4, 6, 8.5, 12, 16) },
    stats(B, v) { B.add('statusBonus', v.v); } },
  { id: 'gen_laststand', name: 'Dos au mur', icon: '🧱', max: 3,
    desc: '+{v}% de dégâts quand vous êtes sous 35% de PV.', vals: { v: R5(12, 18, 26, 36, 50) },
    hooks: { dmgMod(g, h, t, o, acc, v) { if (h.hp < h.maxHp * 0.35) acc.inc += v.v; } } },
  { id: 'gen_firststrike', name: 'Premier sang', icon: '🩸', max: 3,
    desc: '+{v}% de dégâts contre les ennemis à plus de 90% de PV.', vals: { v: R5(12, 18, 26, 36, 50) },
    hooks: { dmgMod(g, h, t, o, acc, v) { if (t.hp > t.maxHp * 0.9) acc.inc += v.v; } } },
  { id: 'gen_cc', name: 'Tortionnaire', icon: '⛓️', max: 3,
    desc: '+{v}% de dégâts contre les ennemis entravés (ralentis, gelés, étourdis).', vals: { v: R5(10, 15, 22, 30, 42) },
    stats(B, v) { B.add('dmgCC', v.v); } },
  { id: 'gen_dot', name: 'Gangrène', icon: '🦠', max: 3,
    desc: '+{v}% de dégâts sur la durée.', vals: { v: R5(10, 15, 22, 30, 42) },
    stats(B, v) { B.add('dotDmg', v.v); } },
];

export const TALENT_LIST = [...GENERIC_TALENTS, ...CLASS_TALENTS];
export const TALENTS = Object.fromEntries(TALENT_LIST.map((t) => [t.id, t]));

// Rarity odds for level-up offers (index: common..legendary)
export const TALENT_RARITY_WEIGHTS = [52, 27, 13, 6, 2];

/** Format a talent description with values (array index by rarity or summed values object) */
export function talentText(def, vals) {
  return def.desc.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vals[k];
    if (v === undefined) return '?';
    return (Math.round(v * 100) / 100).toString().replace('.', ',');
  });
}

export function talentValsAt(def, rarity) {
  const out = {};
  for (const k in def.vals) out[k] = def.vals[k][rarity];
  return out;
}
