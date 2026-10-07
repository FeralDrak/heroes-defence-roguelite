import { TEAM_HEROES } from '../../constants.js';

export const CLASS = {
  id: 'assassin',
  name: 'Assassine',
  title: 'Lame silencieuse',
  icon: '🗡️',
  color: '#38c9b8',
  role: 'Mêlée · Critiques',
  difficulty: 3,
  desc: "Rapide et létale, elle frappe depuis l'ombre, empoisonne ses cibles et enchaîne les coups critiques. Esquive innée (10%) et vol de vie (2%), mais fragile si elle est encerclée.",
  base: { hp: 112, armor: 15, res: 10, regen: 1.0, speed: 7.0, crit: 15, critDmg: 75, dodge: 10, lifeSteal: 2 },
  abilities: ['x_blades', 'x_fan', 'x_smoke', 'x_mark', 'x_dance', 'x_shadowdash'],
  locked: true,
};

function fanKnives(g, h, P, x, z, mult = 1) {
  const n = P.count;
  const ret = h.fl('knifeReturn') > 0;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    g.fireProjectile({
      owner: h, x, z, a, speed: P.speed, range: P.range, radius: 0.3, vis: 'knife', coef: P.coef, type: 'phys', ability: 'x_fan',
      pierce: 1, returning: ret ? 1 : 0, mult, aoe: true,
    });
  }
}

export const ABILITIES = {
  x_blades: {
    id: 'x_blades', slot: 'primary', name: 'Lames jumelles', icon: '🔪', dmgType: 'phys',
    p: { interval: 0.45, coef: 0.55, range: 2.6, arc: 110, hits: 2, poison: 20 },
    intParams: ['hits'],
    desc: (P, d) => `Frappe ${P.hits} fois devant vous, chaque coup infligeant ${d(P.coef)} dégâts physiques et empoisonnant (${Math.round(P.poison)}% des dégâts sur 4 s).`,
    cast(g, h, P, ctx) {
      const knives = h.fl('shadowBlade') > 0;
      const swing = (k) => {
        if (!h.alive || h.downed) return;
        const c = Object.assign({}, ctx, { ox: h.x, oz: h.z });
        g.meleeSwing(h, c, {
          range: P.range, arc: P.arc, coef: P.coef, type: 'phys', ability: 'x_blades', color: 'teal',
          onHit: (m) => {
            if (m.alive && P.poison > 0) g.applyStatus(m, 'poison', { dps: g.heroDps(h, P.coef, 'poison', 'x_blades') * P.poison / 100 / 4, dur: 4 * h.S.poisonDur, hero: h });
          },
        });
        if (knives && k === 0) {
          const t = g.nearestEnemy(TEAM_HEROES, h.x, h.z, 10);
          if (t) {
            const a = Math.atan2(t.z - h.z, t.x - h.x);
            g.fireProjectile({ owner: h, x: h.x, z: h.z, a, speed: 26, range: 12, radius: 0.25, vis: 'knife', coef: P.coef, type: 'phys', ability: 'x_blades', hitOpts: { proc: true } });
          }
        }
      };
      swing(0);
      for (let k = 1; k < P.hits; k++) g.later(0.12 * k, () => swing(k));
      return true;
    },
  },
  x_fan: {
    id: 'x_fan', slot: 'secondary', name: 'Éventail de lames', icon: '✴️', dmgType: 'phys',
    p: { cd: 5, count: 12, coef: 0.8, speed: 22, range: 9 },
    intParams: ['count'],
    desc: (P, d) => `Projette ${P.count} couteaux tout autour de vous, chacun infligeant ${d(P.coef)} dégâts physiques.`,
    cast(g, h, P, ctx) {
      fanKnives(g, h, P, ctx.ox, ctx.oz, ctx.mult);
      g.snd('knives', h.x, h.z);
      return true;
    },
  },
  x_smoke: {
    id: 'x_smoke', slot: 'skill1', name: 'Bombe fumigène', icon: '💨', dmgType: 'poison',
    p: { cd: 14, dur: 3, radius: 4 },
    durParams: ['dur'],
    keepStealth: true,
    desc: (P) => `Disparaît dans un nuage de fumée : invisible pendant ${P.dur.toFixed(1)} s (les monstres vous perdent de vue), les ennemis dans la fumée sont ralentis. Votre prochaine attaque inflige un coup critique.`,
    cast(g, h, P, ctx) {
      h.stealthT = P.dur;
      h.stateDirty = true;
      for (const m of g.monsters) if (m.target === h) m.target = null;
      const shroud = h.fl('mistShroud') > 0;
      g.spawnArea({
        owner: h, team: TEAM_HEROES, shape: 'circle', x: h.x, z: h.z, r: P.radius, dur: P.dur + 1, tick: 0.5, vis: 'smoke', ability: 'x_smoke',
        onTick: (g2, a) => {
          for (const m of g.enemiesInRadius(TEAM_HEROES, a.x, a.z, a.r)) {
            g.applyStatus(m, 'slow', { v: 0.4, dur: 0.7 });
            if (shroud) g.applyStatus(m, 'poison', { dps: g.heroDps(h, 0.4, 'poison'), dur: 4, hero: h });
          }
          if (shroud) for (const o of g.heroesInRadius(a.x, a.z, a.r)) g.heal(o, o.maxHp * 0.02, h);
        },
      });
      g.addBuff(h, 'ambush', P.dur + 2);
      g.snd('smoke', h.x, h.z);
      return true;
    },
  },
  x_mark: {
    id: 'x_mark', slot: 'skill2', name: 'Marque mortelle', icon: '🎯', dmgType: 'shadow',
    p: { cd: 9, range: 20, dur: 6, pct: 40, radius: 4, spread: 0 },
    durParams: ['dur'],
    desc: (P) => `Marque l'ennemi visé pendant ${P.dur.toFixed(1)} s. La marque accumule ${Math.round(P.pct)}% des dégâts qu'il subit, puis explose sur les ennemis proches (rayon ${P.radius.toFixed(1)} m).`,
    cast(g, h, P, ctx) {
      let t = g.nearestEnemy(TEAM_HEROES, ctx.ax, ctx.az, 5);
      if (!t || Math.hypot(t.x - h.x, t.z - h.z) > P.range) t = g.nearestEnemy(TEAM_HEROES, h.x, h.z, P.range);
      if (!t) return false;
      g.applyStatus(t, 'mark', { dur: P.dur, pct: P.pct / 100, hero: h, radius: P.radius, spread: P.spread });
      g.fx('mark', { u: t.id });
      g.snd('mark', t.x, t.z);
      return true;
    },
  },
  x_dance: {
    id: 'x_dance', slot: 'ultimate', name: 'Danse des ombres', icon: '🌘', dmgType: 'phys',
    p: { cd: 50, targets: 8, coef: 3.0, range: 12, step: 0.22 },
    intParams: ['targets'],
    noEcho: true,
    desc: (P, d) => `Devient intouchable et se téléporte sur ${P.targets} ennemis successifs à moins de ${P.range} m, infligeant ${d(P.coef)} dégâts physiques à chacun.`,
    cast(g, h, P) {
      if (!g.nearestEnemy(TEAM_HEROES, h.x, h.z, P.range)) return false;
      const extra = h.fl('eclipse') > 0 ? 2 : 1;
      g.addBuff(h, 'dance', 6, { targets: Math.round(P.targets * extra), coef: P.coef, range: P.range, step: P.step, heal: extra > 1 ? 5 : 0 });
      g.snd('dance', h.x, h.z);
      return true;
    },
  },
  x_shadowdash: {
    id: 'x_shadowdash', slot: 'dash', name: "Ruée de l'ombre", icon: '💫', dmgType: 'phys',
    p: { cd: 3.5, dist: 7, dashDur: 0.2, coef: 0.6 },
    move: { kind: 'dash', dist: 'dist', dur: 'dashDur' },
    desc: (P, d) => `Fonce sur ${P.dist.toFixed(1)} m à travers les ennemis, leur infligeant ${d(P.coef)} dégâts physiques.`,
    cast(g, h, P, ctx) {
      const decoy = h.fl('phantomDecoy') > 0;
      if (decoy) g.spawnAlly(h, 'decoy', h.x, h.z, { ttl: 2.5 });
      g.heroDash(h, P, ctx, { coef: P.coef, type: 'phys', ability: 'x_shadowdash', r: 1.5, color: 'teal', snd: 'shadowstep' });
      return true;
    },
  },
};

const R5 = (a, b, c, d, e) => [a, b, c, d, e];

export const TALENTS = [
  { id: 'asn_blades', cls: 'assassin', name: 'Lames effilées', icon: '🔪', max: 5,
    desc: 'Lames jumelles inflige +{v}% de dégâts.', vals: { v: R5(12, 18, 26, 36, 50) },
    stats(B, v) { B.amod('x_blades', 'dmg', v.v); } },
  { id: 'asn_poison', cls: 'assassin', name: 'Venin concentré', icon: '🧪', max: 3,
    desc: 'Vos poisons infligent +{v}% de dégâts.', vals: { v: R5(15, 22, 32, 45, 62) },
    stats(B, v) { B.mul.poison *= 1 + v.v / 100; B.amod('x_blades', 'poison', v.v / 5); } },
  { id: 'asn_crit', cls: 'assassin', name: 'Point vital', icon: '🎯', max: 5,
    desc: '+{v}% de chance de coup critique.', vals: { v: R5(3, 4.5, 6.5, 9, 12) },
    stats(B, v) { B.add('critChance', v.v); } },
  { id: 'asn_critdmg', cls: 'assassin', name: 'Coup de grâce', icon: '💀', max: 5,
    desc: '+{v}% de dégâts critiques.', vals: { v: R5(10, 15, 22, 30, 42) },
    stats(B, v) { B.add('critDmg', v.v); } },
  { id: 'asn_fan', cls: 'assassin', name: "Tempête d'acier", icon: '✴️', max: 3,
    desc: 'Éventail de lames : +{v} couteaux et +{d}% de dégâts.', vals: { v: R5(2, 3, 4, 6, 8), d: R5(10, 15, 22, 30, 42) },
    stats(B, v) { B.amod('x_fan', 'count', v.v); B.amod('x_fan', 'dmg', v.d); } },
  { id: 'asn_fan_return', cls: 'assassin', name: 'Lames boomerang', icon: '↩️', max: 1, minR: 3, locked: true,
    desc: 'Les couteaux de l\'Éventail reviennent vers vous en touchant à nouveau.', vals: { v: R5(0, 0, 0, 1, 1) },
    stats(B) { B.flag('knifeReturn'); } },
  { id: 'asn_smoke', cls: 'assassin', name: 'Écran de fumée', icon: '💨', max: 3,
    desc: 'Bombe fumigène dure +{v} s.', vals: { v: R5(0.5, 0.8, 1.2, 1.7, 2.4) },
    stats(B, v) { B.amod('x_smoke', 'dur', v.v); } },
  { id: 'asn_ambush', cls: 'assassin', name: 'Embuscade', icon: '🗡️', max: 3,
    desc: "Vos attaques depuis l'invisibilité infligent +{v}% de dégâts.", vals: { v: R5(25, 40, 60, 85, 120) },
    hooks: { dmgMod(g, h, t, o, acc, v) { if (h.stealthT > 0) acc.inc += v.v; } } },
  { id: 'asn_mark', cls: 'assassin', name: 'Marque profonde', icon: '🩸', max: 3,
    desc: 'Marque mortelle accumule +{v}% de dégâts supplémentaires.', vals: { v: R5(10, 15, 22, 30, 42) },
    stats(B, v) { B.amod('x_mark', 'pct', v.v); } },
  { id: 'asn_mark_spread', cls: 'assassin', name: 'Contagion', icon: '🦠', max: 1, minR: 2, locked: true,
    desc: "L'explosion de la Marque marque à son tour les ennemis touchés.", vals: { v: R5(0, 0, 1, 1, 1) },
    stats(B) { B.amod('x_mark', 'spread', 1); } },
  { id: 'asn_dance', cls: 'assassin', name: 'Ballet mortel', icon: '💃', max: 3,
    desc: 'Danse des ombres frappe +{v} cible(s).', vals: { v: R5(1, 2, 3, 4, 5) },
    stats(B, v) { B.amod('x_dance', 'targets', v.v); } },
  { id: 'asn_dash', cls: 'assassin', name: 'Ombre furtive', icon: '💫', max: 3,
    desc: "Ruée de l'ombre : temps de recharge -{v}% et +{v}% de dégâts.", vals: { v: R5(8, 12, 17, 23, 30) },
    stats(B, v) { B.amod('x_shadowdash', 'cd', 0, -v.v); B.amod('x_shadowdash', 'dmg', v.v); } },
  { id: 'asn_evasion', cls: 'assassin', name: 'Évasion', icon: '🌫️', max: 4,
    desc: "+{v}% de chance d'esquive.", vals: { v: R5(2, 3, 4.5, 6.5, 9) },
    stats(B, v) { B.add('dodge', v.v); } },
  { id: 'asn_triple', cls: 'assassin', name: 'Troisième lame', icon: '🔪', max: 1, minR: 4, locked: true,
    desc: 'Lames jumelles frappe {v} fois de plus.', vals: { v: R5(0, 0, 0, 0, 1) },
    stats(B, v) { B.amod('x_blades', 'hits', v.v); } },
  { id: 'asn_bleed', cls: 'assassin', name: 'Hémorragie', icon: '🩸', max: 3,
    desc: 'Vos coups critiques font saigner ({v}% des dégâts sur 3 s).', vals: { v: R5(20, 30, 45, 65, 90) },
    hooks: {
      onCrit(g, h, t, info, dealt, v) {
        if (t.alive) g.applyStatus(t, 'bleed', { dps: dealt * v.v / 100 / 3, dur: 3, hero: h });
      },
    } },
  { id: 'asn_speed', cls: 'assassin', name: 'Pas léger', icon: '👟', max: 3,
    desc: '+{v}% de vitesse de déplacement.', vals: { v: R5(3, 4.5, 6.5, 9, 12) },
    stats(B, v) { B.add('moveSpd', v.v); } },
  { id: 'asn_execute', cls: 'assassin', name: 'Assassinat', icon: '☠️', max: 1, minR: 3, locked: true,
    desc: 'Vos coups exécutent instantanément les ennemis (hors boss) sous {v}% de PV.', vals: { v: R5(0, 0, 0, 7, 11) },
    hooks: {
      onHit(g, h, t, info, dealt, v) {
        if (t.alive && !t.boss && t.hp < t.maxHp * v.v / 100) {
          g.dealDamage(h, t, t.hp + 1, { type: 'phys', hero: h, ally: true, proc: true });
          g.fx('text', { u: t.id, s: 'Exécuté', c: '#ff5050' });
        }
      },
    } },
];
