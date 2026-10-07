import { TEAM_HEROES } from '../../constants.js';

export const CLASS = {
  id: 'archer',
  name: 'Archère',
  title: 'Œil du faucon',
  icon: '🏹',
  color: '#4fc46a',
  role: 'Distance · Précision',
  difficulty: 1,
  desc: "Une tireuse d'élite agile qui crible ses ennemis de flèches, pose des pièges et garde ses distances grâce à sa roulade.",
  base: { hp: 100, armor: 10, res: 10, regen: 1.0, speed: 6.8, crit: 10, critDmg: 60 },
  abilities: ['a_shot', 'a_multi', 'a_rain', 'a_trap', 'a_focus', 'a_roll'],
};

function arrowOnHit(g, h, P) {
  const poison = P.poison || 0;
  const explo = P.explosive || 0;
  const split = h.fl('arrowSplit');
  if (!poison && !explo && !split) return null;
  return (g2, p, u) => {
    if (poison > 0 && u.alive) g.applyStatus(u, 'poison', { dps: g.heroDps(h, P.coef, 'poison', 'a_shot') * (poison / 100) / 4, dur: 4, hero: h });
    if (explo > 0) g.explode(h, u.x, u.z, 2, P.coef * explo / 100, { type: 'fire', ability: 'a_shot', proc: true, color: 'fire', snd: 'pop' });
    if (split > 0 && !p.data.split) {
      for (const off of [-0.5, 0.5, Math.PI]) {
        g.fireProjectile({ owner: h, x: u.x, z: u.z, a: p.a + off, speed: 26, range: 7, radius: 0.22, vis: 'arrow', coef: P.coef * 0.3, type: 'phys', ability: 'a_shot', data: { split: 1 }, hitOpts: { proc: true } }).hitSet.add(u.id);
      }
    }
  };
}

export const ABILITIES = {
  a_shot: {
    id: 'a_shot', slot: 'primary', name: 'Tir', icon: '➶', dmgType: 'phys',
    p: { interval: 0.55, coef: 1.0, speed: 32, range: 24, pierce: 0, count: 1, poison: 0, ricochet: 0, explosive: 0 },
    intParams: ['pierce', 'count', 'ricochet'],
    desc: (P, d) => `Décoche une flèche infligeant ${d(P.coef)} dégâts physiques.${P.pierce > 0 ? ` Transperce ${P.pierce} ennemi(s).` : ''}${P.count > 1 ? ` Tire ${P.count} flèches.` : ''}`,
    cast(g, h, P, ctx) {
      const n = P.count + h.fl('focusExtra');
      const crit = h.fl('quickdraw') > 0 && h.quickdraw > 0;
      if (crit) h.quickdraw--;
      g.shootFan(h, ctx, n, n > 1 ? 7 * (n - 1) : 0, {
        speed: P.speed, range: P.range, radius: 0.25, vis: 'arrow', coef: P.coef, type: 'phys', ability: 'a_shot',
        pierce: P.pierce + h.fl('focusPierce'), bounce: P.ricochet, homing: h.fl('homing') > 0 ? 7 : 0,
        onHit: arrowOnHit(g, h, P), hitOpts: crit ? { forceCrit: true } : null,
      });
      g.snd('bow', h.x, h.z);
      return true;
    },
  },
  a_multi: {
    id: 'a_multi', slot: 'secondary', name: 'Tir multiple', icon: '🎯', dmgType: 'phys',
    p: { cd: 4, count: 5, spread: 45, coef: 0.75, speed: 30, range: 18 },
    intParams: ['count'],
    desc: (P, d) => `Tire ${P.count} flèches en éventail, chacune infligeant ${d(P.coef)} dégâts physiques.`,
    cast(g, h, P, ctx) {
      const ring = h.fl('multiRing') > 0;
      const n = ring ? Math.max(16, P.count * 2) : P.count;
      g.shootFan(h, ctx, n, ring ? 360 - 360 / n : P.spread, {
        speed: P.speed, range: P.range, radius: 0.25, vis: 'arrow', coef: P.coef, type: 'phys', ability: 'a_multi',
        pierce: h.fl('focusPierce'), homing: h.fl('homing') > 0 ? 5 : 0, aoe: true,
      });
      g.snd('volley', h.x, h.z);
      return true;
    },
  },
  a_rain: {
    id: 'a_rain', slot: 'skill1', name: 'Pluie de flèches', icon: '🌧️', dmgType: 'phys',
    p: { cd: 10, range: 18, radius: 4, dur: 2.0, tick: 0.25, coef: 0.45, slow: 30, fire: 0 },
    durParams: ['dur'],
    desc: (P, d) => `Fait pleuvoir des flèches pendant ${P.dur.toFixed(1)} s dans une zone de ${P.radius.toFixed(1)} m : ${d(P.coef)} dégâts toutes les ${P.tick}s, ralentit de ${Math.round(P.slow)}%.`,
    cast(g, h, P, ctx) {
      const [x, z] = g.aimPoint(ctx, P.range);
      g.spawnArea({
        owner: h, team: TEAM_HEROES, shape: 'circle', x, z, r: P.radius, dur: P.dur, tick: P.tick, vis: P.fire > 0 ? 'firerain' : 'arrowrain', ability: 'a_rain',
        onTick: (g2, a) => {
          const foes = g.areaHit(a, P.coef, { type: 'phys', mult: ctx.mult, status: 'slow', statusOpts: { v: P.slow / 100, dur: 0.6 } });
          if (P.fire > 0) for (const m of foes) if (m.alive) g.applyStatus(m, 'burn', { dps: g.heroDps(h, P.coef, 'fire', 'a_rain') * P.fire / 100, dur: 3, hero: h });
        },
      });
      g.snd('rain', x, z);
      return true;
    },
  },
  a_trap: {
    id: 'a_trap', slot: 'skill2', name: 'Piège givrant', icon: '❄️', dmgType: 'cold',
    p: { cd: 7, range: 12, max: 3, arm: 0.6, trigger: 1.5, radius: 3.5, coef: 1.8, freeze: 2, life: 30, fire: 0 },
    intParams: ['max'],
    desc: (P, d) => `Pose un piège (max ${P.max}) qui explose au contact : ${d(P.coef)} dégâts de ${P.fire > 0 ? 'feu' : 'froid'} dans un rayon de ${P.radius.toFixed(1)} m et gèle ${P.freeze.toFixed(1)} s.`,
    cast(g, h, P, ctx) {
      const [x, z] = g.aimPoint(ctx, P.range);
      placeTrap(g, h, P, x, z);
      g.snd('trap', x, z);
      return true;
    },
  },
  a_focus: {
    id: 'a_focus', slot: 'ultimate', name: 'Concentration mortelle', icon: '👁️', dmgType: 'phys',
    p: { cd: 45, dur: 6, atkSpd: 100, extra: 2, pierce: 2 },
    durParams: ['dur'],
    desc: (P) => `Pendant ${P.dur.toFixed(1)} s : +${Math.round(P.atkSpd)}% vitesse d'attaque, Tir lance ${Math.round(P.extra)} flèches supplémentaires qui transpercent ${Math.round(P.pierce)} ennemis.`,
    cast(g, h, P) {
      g.addBuff(h, 'focus', P.dur, { atkSpd: P.atkSpd, extra: P.extra, pierce: P.pierce });
      g.fx('nova', { x: h.x, z: h.z, r: 3, c: 'nature' });
      g.snd('focus', h.x, h.z);
      return true;
    },
  },
  a_roll: {
    id: 'a_roll', slot: 'dash', name: 'Roulade', icon: '🤸', dmgType: 'phys',
    p: { cd: 4, dist: 6, dashDur: 0.22 },
    move: { kind: 'dash', dist: 'dist', dur: 'dashDur' },
    desc: (P) => `Roule sur ${P.dist.toFixed(1)} m, invulnérable pendant la roulade.`,
    cast(g, h, P, ctx) {
      g.heroDash(h, P, ctx, { color: 'nature', snd: 'roll' });
      if (h.fl('rollTrap') > 0) placeTrap(g, h, h.P.a_trap, h.x, h.z);
      if (h.fl('quickdraw') > 0) h.quickdraw = 3;
      return true;
    },
  },
};

export function placeTrap(g, h, P, x, z) {
  const mine = g.areas.filter((a) => a.alive && a.owner === h && a.data.trap);
  while (mine.length >= P.max) g.removeArea(mine.shift());
  const fire = P.fire > 0;
  const uses = h.fl('trapDouble') > 0 ? 2 : 1;
  g.spawnArea({
    owner: h, team: TEAM_HEROES, shape: 'circle', x, z, r: 0.9, dur: P.life, trigger: P.trigger, armT: P.arm,
    vis: fire ? 'firetrap' : 'frosttrap', data: { trap: true, uses }, ability: 'a_trap',
    onTrigger: (g2, a) => {
      const type = fire ? 'fire' : 'cold';
      const r = P.radius * (fire ? 1 + P.fire / 100 : 1);
      g.explode(h, a.x, a.z, r, P.coef, { type, ability: 'a_trap', status: fire ? null : 'freeze', statusOpts: { dur: P.freeze }, color: type, snd: fire ? 'boom' : 'freeze' });
      if (fire) for (const m of g.enemiesInRadius(TEAM_HEROES, a.x, a.z, r)) g.applyStatus(m, 'burn', { dps: g.heroDps(h, P.coef, 'fire', 'a_trap') * 0.3, dur: 3, hero: h });
      a.data.uses--;
      if (a.data.uses <= 0) g.removeArea(a);
      else { a.armT = a.t + 0.8; }
    },
  });
}

const R5 = (a, b, c, d, e) => [a, b, c, d, e];

export const TALENTS = [
  { id: 'arc_dmg', cls: 'archer', name: 'Pointes barbelées', icon: '➶', max: 5,
    desc: 'Tir inflige +{v}% de dégâts.', vals: { v: R5(12, 18, 26, 36, 50) },
    stats(B, v) { B.amod('a_shot', 'dmg', v.v); } },
  { id: 'arc_pierce', cls: 'archer', name: 'Flèches perforantes', icon: '📌', max: 3,
    desc: 'Tir transperce +{v} ennemi(s).', vals: { v: R5(1, 1, 1, 2, 2) },
    stats(B, v) { B.amod('a_shot', 'pierce', v.v); } },
  { id: 'arc_split', cls: 'archer', name: 'Tir fourchu', icon: '🔱', max: 2, minR: 2, locked: true,
    desc: 'Tir lance +{v} flèche(s) supplémentaire(s).', vals: { v: R5(0, 0, 1, 1, 2) },
    stats(B, v) { B.amod('a_shot', 'count', v.v); } },
  { id: 'arc_speed', cls: 'archer', name: 'Doigts agiles', icon: '✋', max: 5,
    desc: "+{v}% de vitesse d'attaque.", vals: { v: R5(6, 9, 13, 18, 25) },
    stats(B, v) { B.add('atkSpd', v.v); } },
  { id: 'arc_crit', cls: 'archer', name: 'Œil de faucon', icon: '🦅', max: 5,
    desc: '+{v}% de chance de coup critique.', vals: { v: R5(3, 4.5, 6.5, 9, 12) },
    stats(B, v) { B.add('critChance', v.v); } },
  { id: 'arc_multi', cls: 'archer', name: 'Volée', icon: '🎯', max: 3,
    desc: 'Tir multiple lance +{v} flèche(s) et inflige +{d}% de dégâts.', vals: { v: R5(1, 2, 2, 3, 4), d: R5(10, 15, 22, 30, 42) },
    stats(B, v) { B.amod('a_multi', 'count', v.v); B.amod('a_multi', 'dmg', v.d); } },
  { id: 'arc_rain', cls: 'archer', name: 'Déluge', icon: '🌧️', max: 3,
    desc: 'Pluie de flèches : zone +{v}% et durée +{v}%.', vals: { v: R5(12, 18, 26, 36, 50) },
    stats(B, v) { B.amod('a_rain', 'radius', 0, v.v); B.amod('a_rain', 'dur', 0, v.v); } },
  { id: 'arc_rain_fire', cls: 'archer', name: 'Pluie incendiaire', icon: '🔥', max: 1, minR: 2,
    desc: 'Pluie de flèches enflamme les ennemis ({v}% des dégâts par seconde).', vals: { v: R5(0, 0, 40, 60, 90) },
    stats(B, v) { B.amod('a_rain', 'fire', v.v); } },
  { id: 'arc_trap', cls: 'archer', name: 'Pièges en série', icon: '🕸️', max: 3,
    desc: '+{v} piège(s) maximum et +{d}% de dégâts des pièges.', vals: { v: R5(1, 1, 1, 2, 2), d: R5(10, 15, 22, 30, 42) },
    stats(B, v) { B.amod('a_trap', 'max', v.v); B.amod('a_trap', 'dmg', v.d); } },
  { id: 'arc_trap_explo', cls: 'archer', name: 'Pièges explosifs', icon: '🧨', max: 1, minR: 3, locked: true,
    desc: 'Les pièges infligent des dégâts de feu, enflamment et ont +{v}% de zone.', vals: { v: R5(0, 0, 0, 40, 60) },
    stats(B, v) { B.amod('a_trap', 'fire', v.v); } },
  { id: 'arc_poison', cls: 'archer', name: 'Flèches empoisonnées', icon: '🧪', max: 3,
    desc: 'Tir empoisonne : {v}% des dégâts en plus sur 4 s.', vals: { v: R5(20, 30, 45, 62, 85) },
    stats(B, v) { B.amod('a_shot', 'poison', v.v); } },
  { id: 'arc_ricochet', cls: 'archer', name: 'Ricochet', icon: '↩️', max: 2, minR: 3, locked: true,
    desc: 'Tir rebondit vers {v} ennemi(s) proche(s).', vals: { v: R5(0, 0, 0, 1, 2) },
    stats(B, v) { B.amod('a_shot', 'ricochet', v.v); } },
  { id: 'arc_wind', cls: 'archer', name: 'Vent arrière', icon: '🍃', max: 3,
    desc: "Après une Roulade : +{v}% de vitesse de déplacement et d'attaque pendant 3 s.", vals: { v: R5(10, 15, 22, 30, 40) },
    hooks: { onDash(g, h, ctx, v) { g.addBuff(h, 'wind', 3, { v: v.v }); } } },
  { id: 'arc_focus', cls: 'archer', name: 'Concentration absolue', icon: '⏳', max: 3,
    desc: 'Concentration mortelle dure +{v} s.', vals: { v: R5(1, 1.5, 2, 3, 4) },
    stats(B, v) { B.amod('a_focus', 'dur', v.v); } },
  { id: 'arc_kite', cls: 'archer', name: "Tireuse d'élite", icon: '🔭', max: 3,
    desc: '+{v}% de dégâts contre les ennemis à plus de 8 m.', vals: { v: R5(10, 15, 22, 30, 42) },
    hooks: { dmgMod(g, h, t, o, acc, v) { const dx = t.x - h.x, dz = t.z - h.z; if (dx * dx + dz * dz > 64) acc.inc += v.v; } } },
  { id: 'arc_roll', cls: 'archer', name: 'Acrobate', icon: '🤸', max: 3,
    desc: 'Roulade : temps de recharge -{v}%.', vals: { v: R5(8, 12, 17, 23, 30) },
    stats(B, v) { B.amod('a_roll', 'cd', 0, -v.v); } },
  { id: 'arc_explosive', cls: 'archer', name: 'Flèches explosives', icon: '💣', max: 1, minR: 4, locked: true,
    desc: 'Tir explose à l\'impact (rayon 2 m, {v}% des dégâts en feu).', vals: { v: R5(0, 0, 0, 0, 60) },
    stats(B, v) { B.amod('a_shot', 'explosive', v.v); } },
];
