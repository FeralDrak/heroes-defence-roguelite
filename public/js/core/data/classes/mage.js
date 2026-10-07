import { TEAM_HEROES } from '../../constants.js';
import { chainLightning, orbitTick } from '../../sim/helpers.js';

export const CLASS = {
  id: 'mage',
  name: 'Mage',
  title: 'Tisseuse de tempêtes',
  icon: '🔮',
  color: '#5aa0ff',
  role: 'Distance · Zones',
  difficulty: 2,
  desc: "Maîtresse des éléments, elle déchaîne le feu, la glace et la foudre sur des groupes entiers. Fragile, elle doit garder ses distances.",
  base: { hp: 85, armor: 6, res: 15, regen: 1.0, speed: 6.4, crit: 6, critDmg: 50 },
  abilities: ['m_bolt', 'm_fireball', 'm_nova', 'm_chain', 'm_meteor', 'm_blink'],
  locked: true,
};

export function frostNova(g, h, P, x, z, mult = 1) {
  g.explode(h, x, z, P.radius, P.coef, { type: 'cold', ability: 'm_nova', status: 'freeze', statusOpts: { dur: P.freeze }, color: 'cold', snd: 'freeze', mult });
  g.fx('nova', { x, z, r: P.radius, c: 'cold' });
  if (P.field > 0) {
    g.spawnArea({
      owner: h, team: TEAM_HEROES, shape: 'circle', x, z, r: P.radius, dur: 4, tick: 0.5, vis: 'frostfield', ability: 'm_nova',
      onTick: (g2, a) => g.areaHit(a, P.coef * P.field / 100 * 0.5, { type: 'cold', status: 'chill', statusOpts: { v: 0.35, dur: 1 } }),
    });
  }
}

function castMeteor(g, h, P, x, z, delay, mult = 1, small = false) {
  const r = small ? P.radius * 0.6 : P.radius;
  g.spawnArea({
    owner: h, team: TEAM_HEROES, shape: 'circle', x, z, r, delay, vis: 'meteor', ability: 'm_meteor',
    onResolve: () => {
      g.explode(h, x, z, r, P.coef * mult, { type: 'fire', ability: 'm_meteor', color: 'fire', snd: 'meteor', knock: 5 });
      g.fx('shake', { x, z, s: small ? 0.3 : 0.8 });
      g.spawnArea({
        owner: h, team: TEAM_HEROES, shape: 'circle', x, z, r: r * 0.8, dur: P.burnDur, tick: 0.5, vis: 'fireground', ability: 'm_meteor',
        onTick: (g2, a) => g.areaHit(a, P.burnCoef * mult * 0.5, { type: 'fire' }),
      });
    },
  });
  g.fx('meteor', { x, z, r, d: delay });
}

export const ABILITIES = {
  m_bolt: {
    id: 'm_bolt', slot: 'primary', name: 'Projectile arcanique', icon: '✨', dmgType: 'arcane',
    p: { interval: 0.5, coef: 0.9, speed: 24, range: 22, shards: 0 },
    intParams: ['shards'],
    desc: (P, d) => `Lance un projectile arcanique infligeant ${d(P.coef)} dégâts arcaniques.${P.shards > 0 ? ` Se divise en ${P.shards} éclats à l'impact.` : ''}`,
    cast(g, h, P, ctx) {
      const inferno = h.fl('boltInferno') > 0;
      const shards = P.shards;
      g.fireProjectile({
        owner: h, x: ctx.ox + Math.cos(ctx.a) * 0.6, z: ctx.oz + Math.sin(ctx.a) * 0.6, a: ctx.a, speed: P.speed, range: P.range,
        radius: inferno ? 0.4 : 0.3, vis: inferno ? 'fireball_s' : 'arcane', coef: P.coef, type: inferno ? 'fire' : 'arcane', ability: 'm_bolt', mult: ctx.mult,
        explode: inferno ? { r: 1.8, coef: P.coef * 0.5, type: 'fire', excludeDirect: true } : null,
        onHit: shards > 0 ? (g2, p, u) => {
          for (let i = 0; i < shards; i++) {
            const a = p.a + (i - (shards - 1) / 2) * 0.6;
            const s = g.fireProjectile({ owner: h, x: u.x, z: u.z, a, speed: 22, range: 6, radius: 0.2, vis: 'arcane_s', coef: P.coef * 0.35, type: 'arcane', ability: 'm_bolt', hitOpts: { proc: true } });
            s.hitSet.add(u.id);
          }
        } : null,
      });
      g.snd('arcane', h.x, h.z);
      return true;
    },
  },
  m_fireball: {
    id: 'm_fireball', slot: 'secondary', name: 'Boule de feu', icon: '🔥', dmgType: 'fire',
    p: { cd: 3.5, coef: 2.2, speed: 18, range: 22, radius: 3.0, burn: 40, count: 1 },
    intParams: ['count'],
    desc: (P, d) => `Lance ${P.count > 1 ? P.count + ' boules' : 'une boule'} de feu qui explose${P.count > 1 ? 'nt' : ''} en infligeant ${d(P.coef)} dégâts de feu dans un rayon de ${P.radius.toFixed(1)} m et enflamme les ennemis.`,
    cast(g, h, P, ctx) {
      const meteorChance = h.fl('fireballMeteor');
      g.shootFan(h, ctx, P.count, P.count > 1 ? 18 * (P.count - 1) : 0, {
        speed: P.speed, range: P.range, radius: 0.5, vis: 'fireball', coef: 0, type: 'fire', ability: 'm_fireball',
        explode: {
          r: P.radius, coef: P.coef, type: 'fire', color: 'fire',
          onExplode: (g2, p, x, z) => {
            for (const m of g.enemiesInRadius(TEAM_HEROES, x, z, P.radius)) {
              g.applyStatus(m, 'burn', { dps: g.heroDps(h, P.coef, 'fire', 'm_fireball') * (P.burn / 100) / 3, dur: 3, hero: h });
            }
            if (meteorChance > 0 && g.rng.next() * 100 < meteorChance) castMeteor(g, h, h.P.m_meteor, x, z, 0.8, 0.5, true);
          },
        },
      });
      g.snd('fireball', h.x, h.z);
      return true;
    },
  },
  m_nova: {
    id: 'm_nova', slot: 'skill1', name: 'Nova de givre', icon: '❄️', dmgType: 'cold',
    p: { cd: 10, radius: 5.5, coef: 1.0, freeze: 2.0, field: 0 },
    desc: (P, d) => `Libère une onde de froid autour de vous : ${d(P.coef)} dégâts de froid dans un rayon de ${P.radius.toFixed(1)} m, gèle les ennemis ${P.freeze.toFixed(1)} s.`,
    cast(g, h, P, ctx) {
      frostNova(g, h, P, ctx.ox, ctx.oz, ctx.mult);
      return true;
    },
  },
  m_chain: {
    id: 'm_chain', slot: 'skill2', name: "Chaîne d'éclairs", icon: '⚡', dmgType: 'light',
    p: { cd: 5, range: 14, bounces: 5, jump: 7, coef: 1.4, shock: 15 },
    intParams: ['bounces'],
    desc: (P, d) => `Un éclair frappe l'ennemi visé puis rebondit ${P.bounces} fois, infligeant ${d(P.coef)} dégâts de foudre et électrocutant (+${Math.round(P.shock)}% de dégâts subis).`,
    cast(g, h, P, ctx) {
      let first = g.nearestEnemy(TEAM_HEROES, ctx.ax, ctx.az, 5);
      if (!first || Math.hypot(first.x - ctx.ox, first.z - ctx.oz) > P.range + 2) first = g.nearestEnemy(TEAM_HEROES, ctx.ox, ctx.oz, P.range);
      if (!first) return false;
      chainLightning(g, h, P, ctx.ox, ctx.oz, first, P.coef, P.bounces, P.jump, { repeat: h.fl('chainRepeat') > 0, mult: ctx.mult });
      return true;
    },
  },
  m_meteor: {
    id: 'm_meteor', slot: 'ultimate', name: 'Météore', icon: '☄️', dmgType: 'fire',
    p: { cd: 40, range: 20, delay: 1.0, radius: 6, coef: 9, burnCoef: 0.5, burnDur: 4, extra: 0 },
    intParams: ['extra'],
    desc: (P, d) => `Invoque un météore qui s'écrase après ${P.delay.toFixed(1)} s : ${d(P.coef)} dégâts de feu dans un rayon de ${P.radius.toFixed(1)} m, puis laisse un sol brûlant.${P.extra > 0 ? ` ${P.extra} météores supplémentaires.` : ''}`,
    cast(g, h, P, ctx) {
      const [x, z] = g.aimPoint(ctx, P.range);
      castMeteor(g, h, P, x, z, P.delay, ctx.mult);
      for (let i = 0; i < P.extra; i++) {
        const [px, pz] = g.randomPointNear(x, z, 3, 8);
        castMeteor(g, h, P, px, pz, P.delay + 0.35 * (i + 1), ctx.mult * 0.6, true);
      }
      g.snd('meteorcall', h.x, h.z);
      return true;
    },
  },
  m_blink: {
    id: 'm_blink', slot: 'dash', name: 'Transfert', icon: '🌌', dmgType: 'arcane',
    p: { cd: 5, dist: 8, hpCost: 0 },
    move: { kind: 'blink', dist: 'dist' },
    desc: (P) => `Vous téléporte jusqu'à ${P.dist.toFixed(1)} m dans la direction visée.`,
    cast(g, h, P, ctx) {
      const x0 = h.x, z0 = h.z;
      const [x, z] = g.moveTarget(h, ctx, P.dist);
      h.x = x; h.z = z;
      h.invulnT = Math.max(h.invulnT, 0.15);
      g.fx('blink', { x1: +x0.toFixed(2), z1: +z0.toFixed(2), x2: +x.toFixed(2), z2: +z.toFixed(2), c: 'arcane' });
      g.snd('blink', x, z);
      if (h.fl('blinkNova') > 0) frostNova(g, h, Object.assign({}, h.P.m_nova, { radius: h.P.m_nova.radius * 0.7, field: 0 }), x0, z0, 0.6);
      if (P.hpCost > 0) h.hp = Math.max(1, h.hp - h.maxHp * P.hpCost / 100);
      return true;
    },
  },
};

const R5 = (a, b, c, d, e) => [a, b, c, d, e];

export const TALENTS = [
  { id: 'mag_bolt', cls: 'mage', name: 'Arcanes concentrées', icon: '✨', max: 5,
    desc: 'Projectile arcanique inflige +{v}% de dégâts.', vals: { v: R5(12, 18, 26, 36, 50) },
    stats(B, v) { B.amod('m_bolt', 'dmg', v.v); } },
  { id: 'mag_bolt_split', cls: 'mage', name: 'Éclats arcaniques', icon: '💠', max: 1, minR: 2, locked: true,
    desc: "Projectile arcanique se divise en {v} éclats à l'impact.", vals: { v: R5(0, 0, 2, 3, 4) },
    stats(B, v) { B.amod('m_bolt', 'shards', v.v); } },
  { id: 'mag_fire', cls: 'mage', name: 'Pyromanie', icon: '🔥', max: 5,
    desc: '+{v}% de dégâts de feu.', vals: { v: R5(10, 15, 22, 30, 42) },
    stats(B, v) { B.add('dmgFire', v.v); } },
  { id: 'mag_fireball_count', cls: 'mage', name: 'Boules jumelles', icon: '♊', max: 2, minR: 3, locked: true,
    desc: 'Boule de feu lance +{v} projectile(s).', vals: { v: R5(0, 0, 0, 1, 2) },
    stats(B, v) { B.amod('m_fireball', 'count', v.v); } },
  { id: 'mag_fireball_radius', cls: 'mage', name: 'Combustion', icon: '💥', max: 3,
    desc: "Boule de feu : zone +{v}% et dégâts +{v}%.", vals: { v: R5(12, 18, 26, 36, 50) },
    stats(B, v) { B.amod('m_fireball', 'radius', 0, v.v); B.amod('m_fireball', 'dmg', v.v); } },
  { id: 'mag_ignite', cls: 'mage', name: 'Embrasement', icon: '🕯️', max: 3,
    desc: 'Vos brûlures infligent +{v}% de dégâts.', vals: { v: R5(20, 30, 45, 62, 85) },
    stats(B, v) { B.mul.burn *= 1 + v.v / 100; } },
  { id: 'mag_nova_cd', cls: 'mage', name: 'Hiver précoce', icon: '🧊', max: 3,
    desc: 'Nova de givre : temps de recharge -{v}%.', vals: { v: R5(8, 12, 17, 23, 30) },
    stats(B, v) { B.amod('m_nova', 'cd', 0, -v.v); } },
  { id: 'mag_nova_field', cls: 'mage', name: 'Hiver éternel', icon: '🌨️', max: 1, minR: 2,
    desc: 'Nova de givre laisse un champ glacial pendant 4 s (ralentit, {v}% des dégâts par seconde).', vals: { v: R5(0, 0, 30, 45, 65) },
    stats(B, v) { B.amod('m_nova', 'field', v.v); } },
  { id: 'mag_shatter', cls: 'mage', name: 'Fracassement', icon: '🔨', max: 3,
    desc: '+{v}% de dégâts contre les ennemis gelés ou glacés.', vals: { v: R5(15, 22, 32, 45, 62) },
    hooks: { dmgMod(g, h, t, o, acc, v) { if (t.st.freeze > 0 || (t.st.chill && t.st.chill.t > 0)) acc.inc += v.v; } } },
  { id: 'mag_chain', cls: 'mage', name: 'Conductivité', icon: '🔗', max: 3,
    desc: "Chaîne d'éclairs rebondit +{v} fois.", vals: { v: R5(1, 2, 2, 3, 4) },
    stats(B, v) { B.amod('m_chain', 'bounces', v.v); } },
  { id: 'mag_overload', cls: 'mage', name: 'Surcharge', icon: '⚡', max: 3,
    desc: "Chaîne d'éclairs inflige +{v}% de dégâts.", vals: { v: R5(15, 22, 32, 45, 62) },
    stats(B, v) { B.amod('m_chain', 'dmg', v.v); } },
  { id: 'mag_meteor_shower', cls: 'mage', name: 'Pluie de météores', icon: '🌠', max: 1, minR: 4, locked: true,
    desc: 'Météore fait tomber {v} météores supplémentaires autour de la cible.', vals: { v: R5(0, 0, 0, 0, 3) },
    stats(B, v) { B.amod('m_meteor', 'extra', v.v); } },
  { id: 'mag_meteor', cls: 'mage', name: 'Impact cataclysmique', icon: '☄️', max: 3,
    desc: 'Météore : +{v}% de dégâts et temps de recharge -{c}%.', vals: { v: R5(15, 22, 32, 45, 62), c: R5(5, 8, 11, 15, 20) },
    stats(B, v) { B.amod('m_meteor', 'dmg', v.v); B.amod('m_meteor', 'cd', 0, -v.c); } },
  { id: 'mag_mana_shield', cls: 'mage', name: 'Bouclier de mana', icon: '🛡️', max: 3,
    desc: 'Toutes les 10 s, gagnez un bouclier de {v}% de vos PV max.', vals: { v: R5(8, 12, 17, 24, 33) },
    hooks: {
      tick(g, h, dt, v, st) {
        st.t = (st.t ?? 0) - dt;
        if (st.t <= 0) { st.t = 10; g.addShield(h, h.maxHp * v.v / 100, 10); }
      },
    } },
  { id: 'mag_blink_nova', cls: 'mage', name: 'Transfert glacé', icon: '🌬️', max: 1, minR: 2,
    desc: 'Transfert déclenche une Nova de givre affaiblie à votre point de départ.', vals: { v: R5(0, 0, 1, 1, 1) },
    stats(B) { B.flag('blinkNova'); } },
  { id: 'mag_cdr', cls: 'mage', name: 'Esprit vif', icon: '🧠', max: 4,
    desc: '+{v}% de réduction des temps de recharge.', vals: { v: R5(3, 4.5, 6.5, 9, 12) },
    stats(B, v) { B.add('cdr', v.v); } },
  { id: 'mag_orbit', cls: 'mage', name: 'Orbes arcaniques', icon: '🪐', max: 2, minR: 3, locked: true,
    desc: '{v} orbes arcaniques tournent autour de vous et frappent les ennemis.', vals: { v: R5(0, 0, 0, 2, 3) },
    hooks: {
      tick(g, h, dt, v, st) { orbitTick(g, h, dt, st, Math.round(v.v), 2.6, 0.45, 'arcane', 'arcane'); },
    } },
];
