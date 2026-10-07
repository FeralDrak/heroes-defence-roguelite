import { TEAM_HEROES } from '../../constants.js';

export const CLASS = {
  id: 'engineer',
  name: 'Ingénieur',
  title: 'Génie de la poudre',
  icon: '🔧',
  color: '#f0a030',
  role: 'Structures · Explosifs',
  difficulty: 2,
  desc: "Un bricoleur de génie qui transforme l'arène en forteresse : tourelles, bobines Tesla, grenades et frappes orbitales.",
  base: { hp: 108, armor: 16, res: 10, regen: 1.0, speed: 6.3, crit: 5, critDmg: 50 },
  abilities: ['e_rivet', 'e_turret', 'e_grenade', 'e_tesla', 'e_orbital', 'e_jump'],
  locked: true,
};

function lobGrenade(g, h, P, x0, z0, x, z, mult, mini = false, bounces = 0) {
  const r = mini ? P.radius * 0.55 : P.radius;
  const coef = mini ? P.coef * 0.4 : P.coef;
  g.fireProjectile({
    owner: h, x: x0, z: z0, vis: mini ? 'grenade_s' : 'grenade', coef: 0, type: 'fire', ability: 'e_grenade', ghost: true,
    lob: { x, z, dur: mini ? 0.45 : P.flight, h: mini ? 1.5 : 3 },
    onEnd: (g2, p) => {
      g.explode(h, x, z, r, coef, { type: 'fire', ability: 'e_grenade', knock: mini ? 3 : 7, color: 'fire', mult, snd: mini ? 'pop' : 'boom' });
      if (!mini && P.cluster > 0) {
        for (let i = 0; i < P.cluster; i++) {
          const [cx, cz] = g.randomPointNear(x, z, 2, 4.5);
          lobGrenade(g, h, P, x, z, cx, cz, mult, true);
        }
      }
      if (bounces > 0) {
        const a = Math.atan2(z - z0, x - x0);
        const [bx, bz] = g.clampToArena(x + Math.cos(a) * 3.5, z + Math.sin(a) * 3.5, 0.3);
        lobGrenade(g, h, P, x, z, bx, bz, mult * 0.8, false, bounces - 1);
      }
    },
  });
}

export function orbitalStrike(g, h, P, x, z, missiles, mult = 1) {
  for (let i = 0; i < missiles; i++) {
    const delay = 0.6 + (i / Math.max(1, missiles)) * P.dur;
    const [mx, mz] = g.randomPointNear(x, z, 0, P.radius);
    g.spawnArea({
      owner: h, team: TEAM_HEROES, shape: 'circle', x: mx, z: mz, r: P.mRadius, delay, vis: 'missile', ability: 'e_orbital',
      onResolve: () => g.explode(h, mx, mz, P.mRadius, P.coef, { type: 'fire', ability: 'e_orbital', color: 'fire', knock: 3, mult, snd: i % 3 ? false : 'boom' }),
    });
  }
}

export const ABILITIES = {
  e_rivet: {
    id: 'e_rivet', slot: 'primary', name: 'Pistolet à rivets', icon: '🔩', dmgType: 'phys',
    p: { interval: 0.28, coef: 0.5, speed: 30, range: 18, pierce: 0 },
    intParams: ['pierce'],
    desc: (P, d) => `Tire des rivets à haute cadence, chacun infligeant ${d(P.coef)} dégâts physiques.`,
    cast(g, h, P, ctx) {
      const spread = (g.rng.next() - 0.5) * 0.08;
      g.fireProjectile({
        owner: h, x: ctx.ox + Math.cos(ctx.a) * 0.6, z: ctx.oz + Math.sin(ctx.a) * 0.6, a: ctx.a + spread, speed: P.speed, range: P.range,
        radius: 0.2, vis: 'rivet', coef: P.coef, type: 'phys', ability: 'e_rivet', pierce: P.pierce, mult: ctx.mult,
      });
      g.snd('rivet', h.x, h.z);
      return true;
    },
  },
  e_turret: {
    id: 'e_turret', slot: 'secondary', name: 'Tourelle', icon: '🏗️', dmgType: 'phys',
    p: { cd: 6, range: 10, max: 2, dur: 35, coef: 0.55, rate: 0.5, reach: 15, rocket: 0, slow: 0 },
    intParams: ['max'],
    durParams: ['dur'],
    desc: (P, d) => `Déploie une tourelle (maximum ${P.max}) pendant ${P.dur.toFixed(0)} s. Elle tire toutes les ${P.rate.toFixed(2)} s pour ${d(P.coef)} dégâts physiques.`,
    cast(g, h, P, ctx) {
      const [x, z] = g.aimPoint(ctx, P.range);
      const list = g.allies.filter((a) => a.alive && a.owner === h && a.type === 'turret');
      if (list.length >= P.max) g.killAlly(list[0], null);
      g.spawnAlly(h, 'turret', x, z, { ttl: P.dur });
      g.snd('build', x, z);
      return true;
    },
  },
  e_grenade: {
    id: 'e_grenade', slot: 'skill1', name: 'Grenade', icon: '💣', dmgType: 'fire',
    p: { cd: 5, range: 14, flight: 0.6, radius: 3.5, coef: 2.0, cluster: 0 },
    intParams: ['cluster'],
    desc: (P, d) => `Lance une grenade qui explose : ${d(P.coef)} dégâts de feu dans un rayon de ${P.radius.toFixed(1)} m et repousse les ennemis.${P.cluster > 0 ? ` Libère ${P.cluster} mini-grenades.` : ''}`,
    cast(g, h, P, ctx) {
      const [x, z] = g.aimPoint(ctx, P.range);
      lobGrenade(g, h, P, ctx.ox, ctx.oz, x, z, ctx.mult, false, h.fl('grenadeBounce'));
      g.snd('throw', h.x, h.z);
      return true;
    },
  },
  e_tesla: {
    id: 'e_tesla', slot: 'skill2', name: 'Bobine Tesla', icon: '🗼', dmgType: 'light',
    p: { cd: 14, range: 10, max: 1, dur: 15, targets: 3, zapRange: 7, coef: 0.9, zapRate: 0.8 },
    intParams: ['max', 'targets'],
    durParams: ['dur'],
    desc: (P, d) => `Déploie une bobine Tesla pendant ${P.dur.toFixed(0)} s qui électrocute ${P.targets} ennemis toutes les ${P.zapRate.toFixed(1)} s pour ${d(P.coef)} dégâts de foudre.`,
    cast(g, h, P, ctx) {
      const list = g.allies.filter((a) => a.alive && a.owner === h && a.type === 'tesla');
      if (list.length >= P.max) g.killAlly(list[0], null);
      const carried = h.fl('teslaCarry') > 0;
      const [x, z] = carried ? [h.x, h.z] : g.aimPoint(ctx, P.range);
      const u = g.spawnAlly(h, 'tesla', x, z, { ttl: P.dur, data: { carried } });
      if (carried) { u.untargetable = true; }
      g.snd('build', x, z);
      return true;
    },
  },
  e_orbital: {
    id: 'e_orbital', slot: 'ultimate', name: 'Frappe orbitale', icon: '🛰️', dmgType: 'fire',
    p: { cd: 45, range: 20, radius: 6, missiles: 12, mRadius: 2.5, coef: 2.0, dur: 2.4 },
    intParams: ['missiles'],
    desc: (P, d) => `Fait pleuvoir ${P.missiles} missiles sur une zone de ${P.radius.toFixed(0)} m, chacun infligeant ${d(P.coef)} dégâts de feu.`,
    cast(g, h, P, ctx) {
      const [x, z] = g.aimPoint(ctx, P.range);
      orbitalStrike(g, h, P, x, z, P.missiles, ctx.mult);
      g.snd('orbital', h.x, h.z);
      return true;
    },
  },
  e_jump: {
    id: 'e_jump', slot: 'dash', name: 'Saut propulsé', icon: '🚀', dmgType: 'fire',
    p: { cd: 6, dist: 7, air: 0.45, radius: 3, coef: 1.0, mines: 0 },
    intParams: ['mines'],
    move: { kind: 'leap', dist: 'dist', dur: 'air' },
    desc: (P, d) => `Propulse l'ingénieur sur ${P.dist.toFixed(1)} m ; l'explosion au décollage inflige ${d(P.coef)} dégâts de feu et repousse les ennemis.`,
    cast(g, h, P, ctx) {
      const x0 = h.x, z0 = h.z;
      g.explode(h, x0, z0, P.radius, P.coef, { type: 'fire', ability: 'e_jump', knock: 8, color: 'fire' });
      for (let i = 0; i < P.mines; i++) {
        const [mx, mz] = g.randomPointNear(x0, z0, 0.6, 2.2);
        g.spawnArea({
          owner: h, team: TEAM_HEROES, shape: 'circle', x: mx, z: mz, r: 0.5, dur: 20, trigger: 1.3, armT: 0.5, vis: 'mine', ability: 'e_jump',
          onTrigger: (g2, a) => { g.explode(h, a.x, a.z, 2.5, P.coef * 1.2, { type: 'fire', ability: 'e_jump', color: 'fire', snd: 'pop' }); g.removeArea(a); },
        });
      }
      const land = h.fl('jetLand') > 0;
      g.heroLeap(h, P, ctx, {
        onLand: land ? () => g.explode(h, h.x, h.z, P.radius, P.coef, { type: 'fire', ability: 'e_jump', knock: 8, color: 'fire' }) : null,
      });
      return true;
    },
  },
};

const R5 = (a, b, c, d, e) => [a, b, c, d, e];

export const TALENTS = [
  { id: 'eng_turret_max', cls: 'engineer', name: 'Ligne de défense', icon: '🏗️', max: 2,
    desc: '+{v} tourelle(s) maximum.', vals: { v: R5(1, 1, 1, 1, 2) },
    stats(B, v) { B.amod('e_turret', 'max', v.v); } },
  { id: 'eng_turret_dmg', cls: 'engineer', name: 'Calibre supérieur', icon: '🎯', max: 5,
    desc: 'Vos tourelles infligent +{v}% de dégâts.', vals: { v: R5(15, 22, 32, 45, 62) },
    stats(B, v) { B.amod('e_turret', 'coef', 0, v.v); } },
  { id: 'eng_turret_rate', cls: 'engineer', name: 'Cadence accrue', icon: '⏱️', max: 3,
    desc: 'Vos tourelles tirent +{v}% plus vite.', vals: { v: R5(10, 15, 22, 30, 42) },
    stats(B, v) { B.amod('e_turret', 'rate', 0, -v.v / (1 + v.v / 100)); } },
  { id: 'eng_turret_rocket', cls: 'engineer', name: 'Lance-roquettes', icon: '🚀', max: 1, minR: 2, locked: true,
    desc: 'Vos tourelles tirent une roquette explosive toutes les {v} s.', vals: { v: R5(0, 0, 4, 3, 2) },
    stats(B, v) { B.amod('e_turret', 'rocket', v.v); } },
  { id: 'eng_turret_slow', cls: 'engineer', name: 'Munitions cryo', icon: '🧊', max: 2,
    desc: 'Les tirs de tourelle ralentissent de {v}%.', vals: { v: R5(10, 15, 20, 27, 35) },
    stats(B, v) { B.amod('e_turret', 'slow', v.v); } },
  { id: 'eng_grenade', cls: 'engineer', name: 'Grappe', icon: '🍇', max: 2,
    desc: 'Grenade libère {v} mini-grenade(s) en explosant.', vals: { v: R5(1, 2, 2, 3, 4) },
    stats(B, v) { B.amod('e_grenade', 'cluster', v.v); } },
  { id: 'eng_grenade_dmg', cls: 'engineer', name: 'Explosifs instables', icon: '💥', max: 3,
    desc: 'Grenade : +{v}% de dégâts et de zone.', vals: { v: R5(12, 18, 26, 36, 50) },
    stats(B, v) { B.amod('e_grenade', 'dmg', v.v); B.amod('e_grenade', 'radius', 0, v.v / 2); } },
  { id: 'eng_tesla_chain', cls: 'engineer', name: 'Arc électrique', icon: '⚡', max: 3,
    desc: 'Bobine Tesla touche +{v} cible(s) supplémentaire(s).', vals: { v: R5(1, 1, 2, 2, 3) },
    stats(B, v) { B.amod('e_tesla', 'targets', v.v); } },
  { id: 'eng_tesla_dur', cls: 'engineer', name: 'Condensateurs', icon: '🔋', max: 3,
    desc: 'Bobine Tesla : durée +{v}% et dégâts +{v}%.', vals: { v: R5(15, 22, 32, 45, 62) },
    stats(B, v) { B.amod('e_tesla', 'dur', 0, v.v); B.amod('e_tesla', 'coef', 0, v.v); } },
  { id: 'eng_orbital', cls: 'engineer', name: 'Salve étendue', icon: '🛰️', max: 3,
    desc: 'Frappe orbitale tire +{v} missiles.', vals: { v: R5(2, 3, 4, 6, 8) },
    stats(B, v) { B.amod('e_orbital', 'missiles', v.v); } },
  { id: 'eng_rivet', cls: 'engineer', name: 'Rivets perforants', icon: '📌', max: 2,
    desc: 'Pistolet à rivets transperce +{v} ennemi(s).', vals: { v: R5(1, 1, 1, 2, 2) },
    stats(B, v) { B.amod('e_rivet', 'pierce', v.v); } },
  { id: 'eng_rivet_dmg', cls: 'engineer', name: 'Rivets trempés', icon: '🔩', max: 5,
    desc: 'Pistolet à rivets inflige +{v}% de dégâts.', vals: { v: R5(12, 18, 26, 36, 50) },
    stats(B, v) { B.amod('e_rivet', 'dmg', v.v); } },
  { id: 'eng_overclock', cls: 'engineer', name: 'Surcadençage', icon: '🌡️', max: 2, locked: true,
    desc: 'Vos structures à moins de 7 m de vous agissent {v}% plus vite.', vals: { v: R5(15, 22, 32, 45, 62) },
    stats(B, v) { B.flag('overclock', v.v); } },
  { id: 'eng_repair', cls: 'engineer', name: 'Nano-réparation', icon: '🩹', max: 3,
    desc: 'À moins de 7 m d\'une de vos structures, vous régénérez {v}% de vos PV max par seconde.', vals: { v: R5(0.4, 0.6, 0.9, 1.25, 1.7) },
    hooks: {
      tick(g, h, dt, v) {
        for (const s of h.structures) {
          if (s.alive && (s.x - h.x) ** 2 + (s.z - h.z) ** 2 < 49) { g.heal(h, h.maxHp * v.v / 100 * dt, h); break; }
        }
      },
    } },
  { id: 'eng_mines', cls: 'engineer', name: 'Mines de proximité', icon: '🧨', max: 1, minR: 2, locked: true,
    desc: 'Saut propulsé laisse {v} mines au point de départ.', vals: { v: R5(0, 0, 2, 3, 4) },
    stats(B, v) { B.amod('e_jump', 'mines', v.v); } },
  { id: 'eng_armor', cls: 'engineer', name: 'Blindage', icon: '🛡️', max: 3,
    desc: '+{v}% d\'armure et +{v}% de PV des structures.', vals: { v: R5(10, 15, 22, 30, 42) },
    stats(B, v) { B.add('armorPct', v.v); B.add('summonHp', v.v); } },
  { id: 'eng_drone', cls: 'engineer', name: 'Drone de combat', icon: '🛸', max: 1, minR: 4, locked: true,
    desc: 'Un drone vous accompagne et tire sur les ennemis proches.', vals: { v: R5(0, 0, 0, 0, 1) },
    hooks: {
      tick(g, h, dt, v, st) {
        if (st.drone && st.drone.alive) return;
        st.cd = (st.cd ?? 0) - dt;
        if (st.cd > 0) return;
        st.cd = 5;
        st.drone = g.spawnAlly(h, 'drone', h.x + 1, h.z + 1, {});
      },
    } },
];
