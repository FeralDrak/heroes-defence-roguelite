import { TEAM_HEROES } from '../../constants.js';

export const CLASS = {
  id: 'summoner',
  name: 'Invocateur',
  title: 'Seigneur des morts',
  icon: '💀',
  color: '#a070e8',
  role: 'Invocations · Contrôle',
  difficulty: 2,
  desc: "Il relève les morts pour combattre à sa place : squelettes, mages d'os et golem. Il fait exploser les cadavres laissés par les hordes.",
  base: { hp: 92, armor: 9, res: 12, regen: 1.0, speed: 6.3, crit: 5, critDmg: 50 },
  abilities: ['n_bolt', 'n_skel', 'n_mage', 'n_corpse', 'n_golem', 'n_step'],
  locked: true,
};

export function raiseSkeleton(g, h, x, z, opts = {}) {
  const P = h.P.n_skel;
  return g.spawnAlly(h, 'skeleton', x, z, {
    hpMul: (opts.hpMul ?? 1) * (P.hpMul ?? 1), dmgMul: (opts.dmgMul ?? 1) * (P.dmgMul ?? 1), ttl: opts.ttl ?? Infinity,
    data: { temp: !!opts.ttl },
  });
}

export const ABILITIES = {
  n_bolt: {
    id: 'n_bolt', slot: 'primary', name: "Trait d'ombre", icon: '🌑', dmgType: 'shadow',
    p: { interval: 0.6, coef: 0.75, speed: 22, range: 20 },
    desc: (P, d) => `Lance un trait d'ombre infligeant ${d(P.coef)} dégâts d'ombre.`,
    cast(g, h, P, ctx) {
      const reaper = h.fl('reaperBolt') > 0;
      g.fireProjectile({
        owner: h, x: ctx.ox + Math.cos(ctx.a) * 0.6, z: ctx.oz + Math.sin(ctx.a) * 0.6, a: ctx.a, speed: P.speed, range: P.range,
        radius: 0.3, vis: 'shadowbolt', coef: P.coef, type: 'shadow', ability: 'n_bolt', mult: ctx.mult,
        onHit: reaper ? (g2, p, u) => { if (!u.alive && g.countAllies(h, 'skeleton') < h.P.n_skel.max + 4) raiseSkeleton(g, h, u.x, u.z, { ttl: 8, hpMul: 0.6, dmgMul: 0.7 }); } : null,
      });
      g.snd('shadow', h.x, h.z);
      return true;
    },
  },
  n_skel: {
    id: 'n_skel', slot: 'secondary', name: 'Lever les morts', icon: '🦴', dmgType: 'phys',
    p: { cd: 2.5, range: 12, max: 4, count: 1, hpMul: 1, dmgMul: 1 },
    intParams: ['max', 'count'],
    desc: (P) => `Relève ${P.count > 1 ? P.count + ' squelettes guerriers' : 'un squelette guerrier'} au point visé (maximum ${P.max}). Les squelettes restent jusqu'à leur destruction.`,
    cast(g, h, P, ctx) {
      const [x, z] = g.aimPoint(ctx, P.range);
      for (let i = 0; i < P.count; i++) {
        const perm = g.allies.filter((a) => a.alive && a.owner === h && a.type === 'skeleton' && !a.data.temp);
        if (perm.length >= P.max) g.killAlly(perm[0], null);
        const [sx, sz] = i === 0 ? [x, z] : g.randomPointNear(x, z, 0.8, 1.6);
        raiseSkeleton(g, h, sx, sz);
      }
      g.snd('raise', x, z);
      return true;
    },
  },
  n_mage: {
    id: 'n_mage', slot: 'skill1', name: 'Mage squelette', icon: '🧙', dmgType: 'shadow',
    p: { cd: 8, max: 2, dur: 20, frost: 0 },
    intParams: ['max'],
    durParams: ['dur'],
    desc: (P) => `Invoque un mage squelette qui bombarde les ennemis pendant ${P.dur.toFixed(0)} s (maximum ${P.max}).`,
    cast(g, h, P, ctx) {
      const list = g.allies.filter((a) => a.alive && a.owner === h && a.type === 'skelmage');
      if (list.length >= P.max) g.killAlly(list[0], null);
      const [x, z] = g.randomPointNear(h.x, h.z, 1.2, 2.2);
      g.spawnAlly(h, 'skelmage', x, z, { ttl: h.fl('permMages') > 0 ? Infinity : P.dur, data: { frost: P.frost } });
      g.snd('raise', x, z);
      return true;
    },
  },
  n_corpse: {
    id: 'n_corpse', slot: 'skill2', name: 'Explosion de cadavres', icon: '💥', dmgType: 'shadow',
    p: { cd: 6, range: 14, search: 8, radius: 3, coef: 1.6, max: 8 },
    intParams: ['max'],
    areaParams: ['radius', 'search'],
    desc: (P, d) => `Fait exploser jusqu'à ${P.max} cadavres à ${P.search.toFixed(0)} m du point visé, chacun infligeant ${d(P.coef)} dégâts d'ombre dans un rayon de ${P.radius.toFixed(1)} m.`,
    cast(g, h, P, ctx) {
      const [x, z] = g.aimPoint(ctx, P.range);
      let corpses = g.takeCorpses(x, z, P.search, P.max);
      if (h.fl('graveShroud') > 0 && corpses.length < 3) {
        for (let i = corpses.length; i < 3; i++) {
          const [cx, cz] = g.randomPointNear(x, z, 0.5, 2.5);
          corpses.push({ x: cx, z: cz });
        }
      }
      if (!corpses.length) {
        g.events.push({ e: 'msg', s: 'Aucun cadavre à proximité', c: '#aaa', to: h.pid });
        return false;
      }
      corpses.forEach((c, i) => {
        g.later(i * 0.06, () => {
          g.explode(h, c.x, c.z, P.radius, P.coef, { type: 'shadow', ability: 'n_corpse', color: 'blood', snd: i % 2 ? false : 'corpse', mult: ctx.mult });
        });
      });
      return true;
    },
  },
  n_golem: {
    id: 'n_golem', slot: 'ultimate', name: "Golem d'os", icon: '🗿', dmgType: 'phys',
    p: { cd: 60, dur: 25, hpMul: 1, dmgMul: 1 },
    durParams: ['dur'],
    desc: (P) => `Invoque un golem d'os massif pendant ${P.dur.toFixed(0)} s. Il provoque les ennemis et écrase tout autour de lui.`,
    cast(g, h, P, ctx) {
      const old = g.allies.filter((a) => a.alive && a.owner === h && a.type === 'golem');
      for (const o of old) g.killAlly(o, null);
      const [x, z] = g.aimPoint(ctx, 8);
      g.spawnAlly(h, 'golem', x, z, { ttl: h.fl('golemPerm') > 0 ? Infinity : P.dur, hpMul: P.hpMul, dmgMul: P.dmgMul });
      g.fx('shake', { x, z, s: 0.4 });
      g.snd('golem', x, z);
      return true;
    },
  },
  n_step: {
    id: 'n_step', slot: 'dash', name: "Pas de l'ombre", icon: '👣', dmgType: 'shadow',
    p: { cd: 5, dist: 6, dashDur: 0.2 },
    move: { kind: 'dash', dist: 'dist', dur: 'dashDur' },
    desc: (P) => `Glisse dans les ombres sur ${P.dist.toFixed(1)} m, invulnérable.`,
    cast(g, h, P, ctx) {
      g.heroDash(h, P, ctx, { color: 'shadow', snd: 'shadowstep' });
      if (h.fl('ghoulBoots') > 0) {
        const [tx, tz] = g.moveTarget(h, ctx, P.dist);
        for (const a of h.summons) {
          if (!a.alive) continue;
          const [x, z] = g.randomPointNear(tx, tz, 1, 2.5);
          a.x = x; a.z = z;
          g.heal(a, a.maxHp * 0.25, h);
          g.fx('summon', { x, z, c: 'shadow' });
        }
      }
      return true;
    },
  },
};

const R5 = (a, b, c, d, e) => [a, b, c, d, e];

export const TALENTS = [
  { id: 'sum_skel_max', cls: 'summoner', name: 'Légion', icon: '🦴', max: 3,
    desc: '+{v} squelette(s) maximum.', vals: { v: R5(1, 1, 1, 2, 2) },
    stats(B, v) { B.amod('n_skel', 'max', v.v); } },
  { id: 'sum_skel_dmg', cls: 'summoner', name: 'Os aiguisés', icon: '🗡️', max: 5,
    desc: 'Vos squelettes infligent +{v}% de dégâts.', vals: { v: R5(15, 22, 32, 45, 62) },
    stats(B, v) { B.amod('n_skel', 'dmgMul', 0, v.v); } },
  { id: 'sum_hp', cls: 'summoner', name: 'Os renforcés', icon: '🛡️', max: 4,
    desc: 'Vos serviteurs ont +{v}% de PV.', vals: { v: R5(15, 22, 32, 45, 62) },
    stats(B, v) { B.add('summonHp', v.v); } },
  { id: 'sum_skel_explode', cls: 'summoner', name: 'Os explosifs', icon: '💣', max: 1, minR: 2, locked: true,
    desc: 'Vos squelettes explosent à leur mort ({v}% de dégâts de votre arme dans un rayon de 3 m).', vals: { v: R5(0, 0, 150, 220, 300) },
    hooks: {
      onMinionDeath(g, h, u, v) {
        if (u.type !== 'skeleton') return;
        g.explode(h, u.x, u.z, 3, v.v / 100, { type: 'shadow', summon: true, color: 'blood' });
      },
    } },
  { id: 'sum_mage_max', cls: 'summoner', name: 'Cercle des mages', icon: '🧙', max: 2,
    desc: '+{v} mage(s) squelette(s) maximum et durée +{d}%.', vals: { v: R5(1, 1, 1, 1, 2), d: R5(15, 22, 32, 45, 62) },
    stats(B, v) { B.amod('n_mage', 'max', v.v); B.amod('n_mage', 'dur', 0, v.d); } },
  { id: 'sum_mage_frost', cls: 'summoner', name: 'Mages de givre', icon: '🧊', max: 1, minR: 2,
    desc: 'Les projectiles de vos mages squelettes glacent fortement les ennemis.', vals: { v: R5(0, 0, 1, 1, 1) },
    stats(B) { B.amod('n_mage', 'frost', 1); } },
  { id: 'sum_corpse', cls: 'summoner', name: 'Déflagration nécrotique', icon: '☠️', max: 3,
    desc: 'Explosion de cadavres : +{v}% de dégâts et de zone.', vals: { v: R5(15, 22, 32, 45, 62) },
    stats(B, v) { B.amod('n_corpse', 'dmg', v.v); B.amod('n_corpse', 'radius', 0, v.v / 2); } },
  { id: 'sum_corpse_chain', cls: 'summoner', name: 'Réaction en chaîne', icon: '⛓️', max: 1, minR: 3, locked: true,
    desc: 'Les ennemis tués par Explosion de cadavres explosent à leur tour.', vals: { v: R5(0, 0, 0, 1, 1) },
    hooks: {
      onKill(g, h, m, info) {
        if (info.ability !== 'n_corpse' || info.chained > 3) return;
        const P = h.P.n_corpse;
        g.later(0.12, () => g.explode(h, m.x, m.z, P.radius, P.coef * 0.7, { type: 'shadow', ability: 'n_corpse', color: 'blood', chained: (info.chained || 0) + 1, snd: false }));
      },
    } },
  { id: 'sum_golem', cls: 'summoner', name: 'Golem titanesque', icon: '🏔️', max: 3,
    desc: "Golem d'os : +{v}% de PV et de dégâts, +{d} s de durée.", vals: { v: R5(20, 30, 45, 65, 90), d: R5(3, 4, 6, 8, 11) },
    stats(B, v) { B.amod('n_golem', 'hpMul', 0, v.v); B.amod('n_golem', 'dmgMul', 0, v.v); B.amod('n_golem', 'dur', v.d); } },
  { id: 'sum_army', cls: 'summoner', name: 'Armée des morts', icon: '⚰️', max: 1, minR: 4, locked: true,
    desc: 'Les ennemis que vous tuez ont {v}% de chances de se relever en squelette pendant 10 s.', vals: { v: R5(0, 0, 0, 0, 18) },
    hooks: {
      onKill(g, h, m, info, v) {
        if (m.boss || g.rng.next() * 100 >= v.v) return;
        if (g.allies.filter((a) => a.alive && a.owner === h && a.data.temp).length >= 8) return;
        raiseSkeleton(g, h, m.x, m.z, { ttl: 10, hpMul: 0.6, dmgMul: 0.8 });
      },
    } },
  { id: 'sum_harvest', cls: 'summoner', name: "Moisson d'âmes", icon: '🌾', max: 3,
    desc: "Quand un de vos serviteurs tue un ennemi, vous récupérez {v}% de vos PV max.", vals: { v: R5(0.4, 0.6, 0.9, 1.3, 1.8) },
    hooks: { onKill(g, h, m, info, v) { if (info.src && info.src !== h) g.heal(h, h.maxHp * v.v / 100, h); } } },
  { id: 'sum_bolt', cls: 'summoner', name: 'Ombre dévorante', icon: '🌑', max: 5,
    desc: "Trait d'ombre inflige +{v}% de dégâts.", vals: { v: R5(12, 18, 26, 36, 50) },
    stats(B, v) { B.amod('n_bolt', 'dmg', v.v); } },
  { id: 'sum_command', cls: 'summoner', name: 'Maître des morts', icon: '👑', max: 3,
    desc: "Vos serviteurs gagnent +{v}% de vitesse d'attaque et de déplacement.", vals: { v: R5(8, 12, 17, 24, 33) },
    stats(B, v) { B.add('summonAtkSpd', v.v); B.add('summonSpd', v.v); } },
  { id: 'sum_soul_link', cls: 'summoner', name: "Lien d'âme", icon: '🔗', max: 1, minR: 2, locked: true,
    desc: '{v}% des dégâts que vous subissez sont transférés à vos serviteurs.', vals: { v: R5(0, 0, 20, 28, 36) },
    hooks: {
      onHurt(g, h, src, info, acc, v) {
        const list = h.summons.filter((s) => s.alive);
        if (!list.length) return;
        const share = acc.amount * v.v / 100;
        acc.amount -= share;
        const each = share / list.length;
        for (const s of list) g.dealDamage(null, s, each, { type: 'phys', unavoidable: true });
      },
    } },
  { id: 'sum_dmg', cls: 'summoner', name: 'Pouvoir occulte', icon: '🔮', max: 5,
    desc: "+{v}% de dégâts d'ombre et des serviteurs.", vals: { v: R5(8, 12, 17, 24, 33) },
    stats(B, v) { B.add('dmgShadow', v.v); B.add('summonDmg', v.v); } },
  { id: 'sum_leech', cls: 'summoner', name: 'Liche naissante', icon: '🩸', max: 3,
    desc: 'Vos serviteurs vous soignent de {v}% des dégâts qu\'ils infligent.', vals: { v: R5(1, 1.5, 2.2, 3, 4) },
    stats(B, v) { B.add('minionLeech', v.v); } },
];
