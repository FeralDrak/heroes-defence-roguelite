import { TEAM_HEROES } from '../../constants.js';

export const CLASS = {
  id: 'paladin',
  name: 'Paladin',
  title: 'Lame de l\'Aube',
  icon: '🛡️',
  color: '#f2d36b',
  role: 'Mêlée · Soutien',
  difficulty: 2,
  desc: "Champion de la lumière, il protège ses alliés par des boucliers et des terres consacrées, et peut même ramener les morts au combat.",
  base: { hp: 142, armor: 28, res: 15, regen: 1.5, speed: 6.0, crit: 5, critDmg: 50 },
  abilities: ['p_hammer', 'p_shield', 'p_consecrate', 'p_aegis', 'p_judgment', 'p_charge'],
  locked: true,
};

export function consecration(g, h, P, x, z, follow, mult = 1, scale = 1) {
  return g.spawnArea({
    owner: h, team: TEAM_HEROES, shape: 'circle', x, z, follow: follow ? h : null, r: P.radius * scale, dur: P.dur, tick: P.tick,
    vis: 'consecrate', ability: 'p_consecrate',
    onTick: (g2, a) => {
      g.areaHit(a, P.coef * mult, { type: 'holy' });
      for (const o of g.heroesInRadius(a.x, a.z, a.r)) g.heal(o, o.maxHp * P.heal / 100 * mult, h);
    },
  });
}

export const ABILITIES = {
  p_hammer: {
    id: 'p_hammer', slot: 'primary', name: 'Coup de marteau', icon: '🔨', dmgType: 'holy',
    p: { interval: 0.75, coef: 1.15, range: 2.6, arc: 110, wave: 0 },
    desc: (P, d) => `Frappe devant vous avec votre marteau béni, infligeant ${d(P.coef)} dégâts sacrés.${P.wave > 0 ? ' Libère une onde de lumière.' : ''}`,
    cast(g, h, P, ctx) {
      g.meleeSwing(h, ctx, { range: P.range, arc: P.arc, coef: P.coef, type: 'holy', ability: 'p_hammer', color: 'holy' });
      if (P.wave > 0) {
        g.fireProjectile({ owner: h, x: ctx.ox, z: ctx.oz, a: ctx.a, speed: 18, range: 9, radius: 0.9, vis: 'holywave', coef: P.coef * P.wave / 100, type: 'holy', ability: 'p_hammer', pierce: 99, aoe: true, mult: ctx.mult });
      }
      if (h.fl('dawnHammer') > 0) {
        const list = g.areas.filter((a) => a.alive && a.owner === h && a.data.dawn);
        if (list.length < 6) {
          const start = ctx.a;
          g.fx('spiral', { u: h.id, a: +start.toFixed(2), d: 4, c: 'holy' });
          g.spawnArea({
            owner: h, team: TEAM_HEROES, shape: 'circle', x: h.x, z: h.z, r: 0.9, dur: 4, tick: 0.1, vis: 'hammerorb', hidden: true,
            data: { dawn: true, a: start, d: 1.5, hit: new Map() }, ability: 'p_hammer',
            onTick: (g2, a) => {
              a.data.a += 0.42;
              a.data.d = Math.min(7, a.data.d + 0.12);
              a.x = h.x + Math.cos(a.data.a) * a.data.d;
              a.z = h.z + Math.sin(a.data.a) * a.data.d;
              for (const m of g.enemiesInRadius(TEAM_HEROES, a.x, a.z, 0.9)) {
                const last = a.data.hit.get(m.id) || 0;
                if (g.time - last < 0.5) continue;
                a.data.hit.set(m.id, g.time);
                g.hit(h, m, P.coef * 0.6, { type: 'holy', ability: 'p_hammer', proc: true });
              }
            },
          });
        }
      }
      return true;
    },
  },
  p_shield: {
    id: 'p_shield', slot: 'secondary', name: 'Bouclier vengeur', icon: '🛡️', dmgType: 'holy',
    p: { cd: 4, coef: 1.4, speed: 22, range: 14, bounces: 4, stun: 0.5 },
    intParams: ['bounces'],
    desc: (P, d) => `Lance votre bouclier qui rebondit sur ${P.bounces} ennemis, infligeant ${d(P.coef)} dégâts sacrés et étourdissant ${P.stun.toFixed(1)} s.`,
    cast(g, h, P, ctx) {
      const split = h.fl('shieldSplit') > 0;
      g.fireProjectile({
        owner: h, x: ctx.ox + Math.cos(ctx.a) * 0.6, z: ctx.oz + Math.sin(ctx.a) * 0.6, a: ctx.a, speed: P.speed, range: P.range,
        radius: 0.5, vis: 'shield', coef: P.coef, type: 'holy', ability: 'p_shield', bounce: P.bounces, bounceRange: 8, mult: ctx.mult,
        status: ['stun', { dur: P.stun }], data: { split },
        onHit: split ? (g2, p, u) => {
          if (p.data.done) return;
          p.data.done = true;
          for (const off of [-0.7, 0.7]) {
            const s = g.fireProjectile({ owner: h, x: u.x, z: u.z, a: p.a + off, speed: P.speed, range: 10, radius: 0.45, vis: 'shield', coef: P.coef * 0.7, type: 'holy', ability: 'p_shield', bounce: Math.max(0, P.bounces - 2), bounceRange: 8, data: { done: true } });
            s.hitSet.add(u.id);
          }
        } : null,
      });
      g.snd('throw', h.x, h.z);
      return true;
    },
  },
  p_consecrate: {
    id: 'p_consecrate', slot: 'skill1', name: 'Consécration', icon: '✴️', dmgType: 'holy',
    p: { cd: 14, radius: 5, dur: 6, tick: 0.5, coef: 0.35, heal: 1.5, follow: 0 },
    durParams: ['dur'],
    desc: (P, d) => `Consacre le sol autour de vous pendant ${P.dur.toFixed(1)} s : ${d(P.coef)} dégâts sacrés toutes les ${P.tick}s aux ennemis, et soigne les alliés de ${P.heal.toFixed(1)}% de leurs PV max à chaque impulsion.`,
    cast(g, h, P, ctx) {
      consecration(g, h, P, ctx.ox, ctx.oz, P.follow > 0, ctx.mult);
      g.snd('holy', h.x, h.z);
      return true;
    },
  },
  p_aegis: {
    id: 'p_aegis', slot: 'skill2', name: 'Égide', icon: '🔰', dmgType: 'holy',
    p: { cd: 18, radius: 9, self: 30, ally: 25, dur: 5, invuln: 0 },
    durParams: ['dur'],
    desc: (P) => `Octroie un bouclier de ${Math.round(P.self)}% de vos PV max (${Math.round(P.ally)}% aux alliés dans un rayon de ${P.radius.toFixed(0)} m) pendant ${P.dur.toFixed(1)} s.`,
    cast(g, h, P) {
      for (const o of g.heroesInRadius(h.x, h.z, P.radius)) {
        g.addShield(o, o.maxHp * (o === h ? P.self : P.ally) / 100, P.dur);
        g.fx('shield', { u: o.id });
        if (P.invuln > 0) o.invulnT = Math.max(o.invulnT, P.invuln);
      }
      g.snd('aegis', h.x, h.z);
      return true;
    },
  },
  p_judgment: {
    id: 'p_judgment', slot: 'ultimate', name: 'Jugement céleste', icon: '🌟', dmgType: 'holy',
    p: { cd: 70, range: 16, delay: 1.0, radius: 7, coef: 8, heal: 40 },
    desc: (P, d) => `Un pilier de lumière frappe après ${P.delay.toFixed(1)} s : ${d(P.coef)} dégâts sacrés dans un rayon de ${P.radius.toFixed(1)} m, soigne les alliés de ${Math.round(P.heal)}% et ranime les alliés tombés.`,
    cast(g, h, P, ctx) {
      const [x, z] = g.aimPoint(ctx, P.range);
      judgment(g, h, P, x, z, ctx.mult);
      return true;
    },
  },
  p_charge: {
    id: 'p_charge', slot: 'dash', name: 'Charge sacrée', icon: '🐎', dmgType: 'holy',
    p: { cd: 6, dist: 6, dashDur: 0.25, coef: 0, stun: 0 },
    move: { kind: 'dash', dist: 'dist', dur: 'dashDur' },
    desc: (P, d) => `Charge sur ${P.dist.toFixed(1)} m et réduit les dégâts subis de 30% pendant 2 s.${P.coef > 0 ? ` Inflige ${d(P.coef)} dégâts sacrés et étourdit.` : ''}`,
    cast(g, h, P, ctx) {
      g.addBuff(h, 'holycharge', 2);
      const trail = h.fl('crusadeTrail') > 0;
      g.heroDash(h, P, ctx, {
        coef: P.coef, type: 'holy', ability: 'p_charge', knock: 4, color: 'holy',
        onTouch: P.stun > 0 ? (g2, hh, m) => g.applyStatus(m, 'stun', { dur: P.stun }) : null,
        trail: trail ? (g2, hh) => {
          const C = h.P.p_consecrate;
          g.spawnArea({
            owner: h, team: TEAM_HEROES, shape: 'circle', x: h.x, z: h.z, r: 1.6, dur: 3, tick: 0.5, vis: 'consecrate_s', ability: 'p_consecrate',
            onTick: (g3, a) => g.areaHit(a, C.coef * 0.6, { type: 'holy' }),
          });
        } : null,
      });
      return true;
    },
  },
};

export function judgment(g, h, P, x, z, mult = 1) {
  g.spawnArea({
    owner: h, team: TEAM_HEROES, shape: 'circle', x, z, r: P.radius, delay: P.delay, vis: 'judgment', ability: 'p_judgment',
    onResolve: () => {
      g.explode(h, x, z, P.radius, P.coef, { type: 'holy', ability: 'p_judgment', color: 'holy', snd: 'judgment', mult });
      g.fx('pillar', { x, z, r: P.radius, c: 'holy' });
      for (const o of g.heroes) {
        if (!o.alive) continue;
        if ((o.x - x) ** 2 + (o.z - z) ** 2 > (P.radius + 1) ** 2) continue;
        if (o.downed) g.reviveHero(o, 0.5, h);
        else g.heal(o, o.maxHp * P.heal / 100, h);
      }
    },
  });
  g.snd('holycall', x, z);
}

const R5 = (a, b, c, d, e) => [a, b, c, d, e];

export const TALENTS = [
  { id: 'pal_hammer', cls: 'paladin', name: 'Marteau béni', icon: '🔨', max: 5,
    desc: 'Coup de marteau inflige +{v}% de dégâts.', vals: { v: R5(12, 18, 26, 36, 50) },
    stats(B, v) { B.amod('p_hammer', 'dmg', v.v); } },
  { id: 'pal_hammer_wave', cls: 'paladin', name: 'Onde sacrée', icon: '🌊', max: 1, minR: 2, locked: true,
    desc: 'Coup de marteau libère une onde de lumière ({v}% des dégâts).', vals: { v: R5(0, 0, 45, 65, 90) },
    stats(B, v) { B.amod('p_hammer', 'wave', v.v); } },
  { id: 'pal_shield', cls: 'paladin', name: 'Bouclier ricochet', icon: '↪️', max: 3,
    desc: 'Bouclier vengeur rebondit +{v} fois.', vals: { v: R5(1, 1, 2, 2, 3) },
    stats(B, v) { B.amod('p_shield', 'bounces', v.v); } },
  { id: 'pal_shield_dmg', cls: 'paladin', name: 'Bouclier lesté', icon: '🛡️', max: 3,
    desc: 'Bouclier vengeur inflige +{v}% de dégâts.', vals: { v: R5(15, 22, 32, 45, 62) },
    stats(B, v) { B.amod('p_shield', 'dmg', v.v); } },
  { id: 'pal_consecrate', cls: 'paladin', name: 'Terre sainte', icon: '✴️', max: 3,
    desc: 'Consécration : zone +{v}% et durée +{v}%.', vals: { v: R5(12, 18, 26, 36, 50) },
    stats(B, v) { B.amod('p_consecrate', 'radius', 0, v.v); B.amod('p_consecrate', 'dur', 0, v.v); } },
  { id: 'pal_consecrate_follow', cls: 'paladin', name: 'Aura consacrée', icon: '😇', max: 1, minR: 3, locked: true,
    desc: 'Consécration vous suit et inflige +{v}% de dégâts.', vals: { v: R5(0, 0, 0, 20, 35) },
    stats(B, v) { B.amod('p_consecrate', 'follow', 1); B.amod('p_consecrate', 'dmg', v.v); } },
  { id: 'pal_aegis', cls: 'paladin', name: 'Égide renforcée', icon: '🔰', max: 3,
    desc: 'Égide octroie +{v}% de bouclier.', vals: { v: R5(15, 22, 32, 45, 62) },
    stats(B, v) { B.amod('p_aegis', 'self', 0, v.v); B.amod('p_aegis', 'ally', 0, v.v); } },
  { id: 'pal_aegis_thorns', cls: 'paladin', name: 'Châtiment', icon: '⚡', max: 2,
    desc: 'Tant que vous avez un bouclier, les attaquants subissent {v}% de votre arme en dégâts sacrés.', vals: { v: R5(40, 60, 85, 120, 165) },
    hooks: {
      onHurt(g, h, src, info, acc, v) {
        if (h.shield > 0 && src && src.kind === 'monster' && src.alive && !info.dot) g.hit(h, src, v.v / 100, { type: 'holy', proc: true });
      },
    } },
  { id: 'pal_holy', cls: 'paladin', name: 'Ferveur', icon: '🙏', max: 5,
    desc: '+{v}% de dégâts sacrés.', vals: { v: R5(10, 15, 22, 30, 42) },
    stats(B, v) { B.add('dmgHoly', v.v); } },
  { id: 'pal_armor', cls: 'paladin', name: 'Armure bénie', icon: '🛡️', max: 3,
    desc: "+{v}% d'armure.", vals: { v: R5(8, 12, 17, 24, 33) },
    stats(B, v) { B.add('armorPct', v.v); } },
  { id: 'pal_heal', cls: 'paladin', name: 'Imposition des mains', icon: '🤲', max: 3,
    desc: 'Consécration soigne +{v}% et vos soins reçus augmentent de {v}%.', vals: { v: R5(12, 18, 26, 36, 50) },
    stats(B, v) { B.amod('p_consecrate', 'heal', 0, v.v); B.add('healRecv', v.v); } },
  { id: 'pal_judgment', cls: 'paladin', name: 'Jugement imminent', icon: '⏳', max: 3,
    desc: 'Jugement céleste : temps de recharge -{v}%.', vals: { v: R5(8, 12, 17, 23, 30) },
    stats(B, v) { B.amod('p_judgment', 'cd', 0, -v.v); } },
  { id: 'pal_avatar', cls: 'paladin', name: 'Avatar de lumière', icon: '👼', max: 1, minR: 4, locked: true,
    desc: 'Égide rend aussi invulnérable pendant {v} s.', vals: { v: R5(0, 0, 0, 0, 1.5) },
    stats(B, v) { B.amod('p_aegis', 'invuln', v.v); } },
  { id: 'pal_regen', cls: 'paladin', name: 'Foi inébranlable', icon: '✝️', max: 3,
    desc: 'Régénère {v}% de vos PV max par seconde.', vals: { v: R5(0.2, 0.3, 0.45, 0.65, 0.9) },
    stats(B, v) { B.add('regenPct', v.v); } },
  { id: 'pal_smite', cls: 'paladin', name: 'Châtiment divin', icon: '⚔️', max: 3,
    desc: '+{v}% de dégâts contre les élites et les boss.', vals: { v: R5(10, 15, 22, 30, 42) },
    stats(B, v) { B.add('dmgElite', v.v); } },
  { id: 'pal_zeal', cls: 'paladin', name: 'Zèle', icon: '🔥', max: 4,
    desc: "+{v}% de vitesse d'attaque.", vals: { v: R5(6, 9, 13, 18, 25) },
    stats(B, v) { B.add('atkSpd', v.v); } },
  { id: 'pal_retribution', cls: 'paladin', name: 'Rétribution', icon: '⚡', max: 1, minR: 2, locked: true,
    desc: 'Charge sacrée inflige {v}% de dégâts sacrés aux ennemis traversés et les étourdit 1 s.', vals: { v: R5(0, 0, 150, 220, 300) },
    stats(B, v) { B.amod('p_charge', 'coef', v.v / 100); B.amod('p_charge', 'stun', 1); } },
];
