import { TEAM_HEROES } from '../../constants.js';

export const CLASS = {
  id: 'warlock',
  name: 'Démoniste',
  title: 'Pacte des abysses',
  icon: '😈',
  color: '#7bd84a',
  role: 'Distance · Malédictions',
  difficulty: 3,
  desc: "Il corrompt ses ennemis de maléfices qui les rongent lentement, draine leur vie et invoque un infernal des abysses.",
  base: { hp: 98, armor: 9, res: 15, regen: 1.0, speed: 6.3, crit: 5, critDmg: 50 },
  abilities: ['k_bolt', 'k_drain', 'k_plague', 'k_curse', 'k_infernal', 'k_shadowstep'],
  locked: true,
};

export function corrupt(g, h, t, stacks) {
  const P = h.P.k_bolt;
  g.applyStatus(t, 'corrupt', { stacks, max: P.max, dps: g.heroDps(h, P.cdot, 'shadow', 'k_bolt'), dur: 5, hero: h });
  if (h.fl('pactCurse') > 0 && !(t.st.curse && t.st.curse.t > 0)) {
    const C = h.P.k_curse;
    g.applyStatus(t, 'curse', { dealt: C.dealt / 100, taken: C.taken / 100, dur: 4, hero: h });
  }
}

export const ABILITIES = {
  k_bolt: {
    id: 'k_bolt', slot: 'primary', name: 'Trait corrompu', icon: '🟢', dmgType: 'shadow',
    p: { interval: 0.6, coef: 0.7, speed: 20, range: 20, stacks: 1, max: 5, cdot: 0.16 },
    intParams: ['stacks', 'max'],
    desc: (P, d) => `Lance un trait qui inflige ${d(P.coef)} dégâts d'ombre et applique ${P.stacks} cumul(s) de Corruption (${d(P.cdot)} dégâts/s par cumul pendant 5 s, max ${P.max}).`,
    cast(g, h, P, ctx) {
      const abyss = h.fl('abyssBolt') > 0;
      g.fireProjectile({
        owner: h, x: ctx.ox + Math.cos(ctx.a) * 0.6, z: ctx.oz + Math.sin(ctx.a) * 0.6, a: ctx.a, speed: P.speed, range: P.range,
        radius: 0.32, vis: 'corrupt', coef: P.coef, type: 'shadow', ability: 'k_bolt', pierce: abyss ? 99 : 0, mult: ctx.mult,
        onHit: (g2, p, u) => { if (u.alive) corrupt(g, h, u, P.stacks + (abyss ? 1 : 0)); },
      });
      g.snd('shadow', h.x, h.z);
      return true;
    },
  },
  k_drain: {
    id: 'k_drain', slot: 'secondary', name: 'Drain de vie', icon: '🩸', dmgType: 'shadow',
    p: { cd: 6, range: 12, tick: 0.25, coef: 0.4, heal: 35, max: 3, targets: 1 },
    intParams: ['targets'],
    cdAfterChannel: true,
    desc: (P, d) => `Canalisez jusqu'à ${P.max.toFixed(1)} s : draine la vie de la cible (${d(P.coef)} dégâts d'ombre toutes les ${P.tick}s) et vous soigne de ${Math.round(P.heal)}% des dégâts infligés. Maintenez le bouton.`,
    cast(g, h, P, ctx) {
      const t = g.nearestEnemy(TEAM_HEROES, ctx.ax, ctx.az, 4) || g.nearestEnemy(TEAM_HEROES, h.x, h.z, P.range);
      if (!t || Math.hypot(t.x - h.x, t.z - h.z) > P.range + 1) return false;
      const endless = h.fl('soulTome') > 0;
      g.startChannel(h, 1, 'k_drain', P, { tick: P.tick, max: endless ? 999 : P.max, data: { target: t } });
      g.addBuff(h, 'channeling', endless ? 999 : P.max);
      g.snd('drain', h.x, h.z);
      return true;
    },
    channelTick(g, h, P, ch) {
      const targets = [];
      let t = ch.data.target;
      if (!t || !t.alive || Math.hypot(t.x - h.x, t.z - h.z) > P.range + 2) {
        t = g.nearestEnemy(TEAM_HEROES, h.input.ax, h.input.az, 5) || g.nearestEnemy(TEAM_HEROES, h.x, h.z, P.range);
        ch.data.target = t;
      }
      if (!t) { g.endChannel(h); return; }
      targets.push(t);
      for (let i = 1; i < P.targets; i++) {
        const o = g.nearestEnemy(TEAM_HEROES, h.x, h.z, P.range, (m) => !targets.includes(m));
        if (o) targets.push(o);
      }
      let total = 0;
      for (const u of targets) {
        total += g.hit(h, u, P.coef, { type: 'shadow', ability: 'k_drain' });
        g.fx('beam', { a: h.id, b: u.id, d: P.tick + 0.08, c: 'drain' });
      }
      if (total > 0) g.heal(h, total * P.heal / 100, h);
    },
    channelEnd(g, h) { g.removeBuff(h, 'channeling'); },
  },
  k_plague: {
    id: 'k_plague', slot: 'skill1', name: 'Fléau', icon: '☣️', dmgType: 'shadow',
    p: { cd: 8, range: 16, radius: 4, coef: 0.8, stacks: 3, slow: 30 },
    intParams: ['stacks'],
    desc: (P, d) => `Répand un fléau sur une zone de ${P.radius.toFixed(1)} m : ${d(P.coef)} dégâts d'ombre, ${P.stacks} cumuls de Corruption et ralentit de ${Math.round(P.slow)}%.`,
    cast(g, h, P, ctx) {
      const [x, z] = g.aimPoint(ctx, P.range);
      const pulse = () => {
        for (const m of g.enemiesInRadius(TEAM_HEROES, x, z, P.radius)) {
          g.hit(h, m, P.coef, { type: 'shadow', ability: 'k_plague', aoe: true, mult: ctx.mult });
          if (m.alive) { corrupt(g, h, m, P.stacks); g.applyStatus(m, 'slow', { v: P.slow / 100, dur: 3 }); }
        }
      };
      pulse();
      g.fx('boom', { x, z, r: P.radius, c: 'plague' });
      if (h.fl('plagueHands') > 0) {
        g.spawnArea({ owner: h, team: TEAM_HEROES, shape: 'circle', x, z, r: P.radius, dur: 4, tick: 1, vis: 'plague', ability: 'k_plague',
          onTick: () => { for (const m of g.enemiesInRadius(TEAM_HEROES, x, z, P.radius)) corrupt(g, h, m, 1); } });
      }
      g.snd('plague', x, z);
      return true;
    },
  },
  k_curse: {
    id: 'k_curse', slot: 'skill2', name: 'Malédiction de faiblesse', icon: '🕯️', dmgType: 'shadow',
    p: { cd: 14, range: 16, radius: 6, dur: 6, dealt: 30, taken: 20 },
    durParams: ['dur'],
    desc: (P) => `Maudit les ennemis dans une zone de ${P.radius.toFixed(1)} m pendant ${P.dur.toFixed(1)} s : ils infligent ${Math.round(P.dealt)}% de dégâts en moins et subissent ${Math.round(P.taken)}% de dégâts en plus.`,
    cast(g, h, P, ctx) {
      const [x, z] = g.aimPoint(ctx, P.range);
      for (const m of g.enemiesInRadius(TEAM_HEROES, x, z, P.radius)) {
        g.applyStatus(m, 'curse', { dealt: P.dealt / 100, taken: P.taken / 100, dur: P.dur, hero: h });
      }
      g.fx('nova', { x, z, r: P.radius, c: 'curse' });
      g.snd('curse', x, z);
      return true;
    },
  },
  k_infernal: {
    id: 'k_infernal', slot: 'ultimate', name: 'Portail infernal', icon: '👹', dmgType: 'fire',
    p: { cd: 60, range: 14, delay: 0.8, radius: 4, coef: 4, dur: 20, hpMul: 1, dmgMul: 1, count: 1 },
    intParams: ['count'],
    durParams: ['dur'],
    desc: (P, d) => `Un infernal s'écrase au point visé après ${P.delay.toFixed(1)} s (${d(P.coef)} dégâts de feu, étourdit) puis combat à vos côtés pendant ${P.dur.toFixed(0)} s.`,
    cast(g, h, P, ctx) {
      const [x, z] = g.aimPoint(ctx, P.range);
      const n = P.count;
      g.spawnArea({
        owner: h, team: TEAM_HEROES, shape: 'circle', x, z, r: P.radius, delay: P.delay, vis: 'meteor', ability: 'k_infernal',
        onResolve: () => {
          g.explode(h, x, z, P.radius, P.coef, { type: 'fire', ability: 'k_infernal', status: 'stun', statusOpts: { dur: 1.5 }, color: 'fel', snd: 'meteor' });
          g.fx('shake', { x, z, s: 0.6 });
          for (const o of g.allies.filter((a) => a.alive && a.owner === h && a.type === 'infernal')) g.killAlly(o, null);
          for (let i = 0; i < n; i++) {
            const [sx, sz] = i === 0 ? [x, z] : g.randomPointNear(x, z, 1.5, 2.5);
            g.spawnAlly(h, 'infernal', sx, sz, { ttl: P.dur, hpMul: P.hpMul * (n > 1 ? 0.6 : 1), dmgMul: P.dmgMul * (n > 1 ? 0.6 : 1) });
          }
        },
      });
      g.fx('meteor', { x, z, r: P.radius, d: P.delay, c: 'fel' });
      return true;
    },
  },
  k_shadowstep: {
    id: 'k_shadowstep', slot: 'dash', name: 'Pas démoniaque', icon: '🌀', dmgType: 'shadow',
    p: { cd: 5, dist: 7, poolDur: 3, poolCoef: 0.3 },
    durParams: ['poolDur'],
    move: { kind: 'blink', dist: 'dist' },
    desc: (P, d) => `Se téléporte de ${P.dist.toFixed(1)} m en laissant une flaque d'ombre (${d(P.poolCoef)} dégâts toutes les 0,5 s pendant ${P.poolDur.toFixed(1)} s).`,
    cast(g, h, P, ctx) {
      const x0 = h.x, z0 = h.z;
      const [x, z] = g.moveTarget(h, ctx, P.dist);
      h.x = x; h.z = z;
      h.invulnT = Math.max(h.invulnT, 0.15);
      g.fx('blink', { x1: +x0.toFixed(2), z1: +z0.toFixed(2), x2: +x.toFixed(2), z2: +z.toFixed(2), c: 'fel' });
      const pull = h.fl('voidBoots') > 0;
      g.spawnArea({
        owner: h, team: TEAM_HEROES, shape: 'circle', x: x0, z: z0, r: 2.6, dur: P.poolDur, tick: 0.5, vis: 'shadowpool', ability: 'k_shadowstep',
        onTick: (g2, a) => {
          const foes = g.areaHit(a, P.poolCoef, { type: 'shadow' });
          if (pull) for (const m of foes) if (m.alive && !m.boss) { const dx = a.x - m.x, dz = a.z - m.z, dd = Math.hypot(dx, dz) || 1; m.vx += dx / dd * 4; m.vz += dz / dd * 4; }
        },
      });
      g.snd('blink', x, z);
      return true;
    },
  },
};

const R5 = (a, b, c, d, e) => [a, b, c, d, e];

export const TALENTS = [
  { id: 'wlk_bolt', cls: 'warlock', name: 'Corruption vorace', icon: '🟢', max: 5,
    desc: 'Trait corrompu inflige +{v}% de dégâts.', vals: { v: R5(12, 18, 26, 36, 50) },
    stats(B, v) { B.amod('k_bolt', 'dmg', v.v); } },
  { id: 'wlk_stacks', cls: 'warlock', name: 'Corruption profonde', icon: '🟢', max: 3,
    desc: 'Corruption : +{v} cumul(s) maximum et +{d}% de dégâts.', vals: { v: R5(1, 1, 2, 2, 3), d: R5(10, 15, 22, 30, 42) },
    stats(B, v) { B.amod('k_bolt', 'max', v.v); B.amod('k_bolt', 'cdot', 0, v.d); } },
  { id: 'wlk_spread', cls: 'warlock', name: 'Contagion', icon: '🦠', max: 1, minR: 2, locked: true,
    desc: "Quand un ennemi corrompu meurt, sa Corruption se propage à {v} ennemis proches.", vals: { v: R5(0, 0, 2, 3, 4) },
    hooks: {
      onKill(g, h, m, info, v) {
        const c = m.st.corrupt;
        if (!c || c.stacks <= 0) return;
        const near = g.enemiesInRadius(TEAM_HEROES, m.x, m.z, 6).slice(0, Math.round(v.v));
        for (const o of near) corrupt(g, h, o, c.stacks);
        if (near.length) g.fx('chain', { pts: [m.x, m.z, ...near.flatMap((o) => [o.x, o.z])], c: 'fel' });
      },
    } },
  { id: 'wlk_drain', cls: 'warlock', name: 'Soif de sang', icon: '🩸', max: 3,
    desc: 'Drain de vie : +{v}% de dégâts et de soins.', vals: { v: R5(15, 22, 32, 45, 62) },
    stats(B, v) { B.amod('k_drain', 'dmg', v.v); B.amod('k_drain', 'heal', 0, v.v); } },
  { id: 'wlk_drain_chain', cls: 'warlock', name: 'Drain multiple', icon: '🕸️', max: 2, minR: 3, locked: true,
    desc: 'Drain de vie touche {v} cible(s) supplémentaire(s).', vals: { v: R5(0, 0, 0, 1, 2) },
    stats(B, v) { B.amod('k_drain', 'targets', v.v); } },
  { id: 'wlk_plague', cls: 'warlock', name: 'Pestilence', icon: '☣️', max: 3,
    desc: 'Fléau : zone +{v}% et +1 cumul de Corruption.', vals: { v: R5(12, 18, 26, 36, 50) },
    stats(B, v) { B.amod('k_plague', 'radius', 0, v.v); B.amod('k_plague', 'stacks', 1); } },
  { id: 'wlk_curse', cls: 'warlock', name: 'Malédiction aggravée', icon: '🕯️', max: 3,
    desc: 'Les ennemis maudits subissent +{v}% de dégâts supplémentaires.', vals: { v: R5(5, 8, 11, 15, 20) },
    stats(B, v) { B.amod('k_curse', 'taken', v.v); } },
  { id: 'wlk_infernal', cls: 'warlock', name: 'Seigneur des abysses', icon: '👹', max: 3,
    desc: 'Infernal : +{v}% de PV, de dégâts et de durée.', vals: { v: R5(15, 22, 32, 45, 62) },
    stats(B, v) { B.amod('k_infernal', 'hpMul', 0, v.v); B.amod('k_infernal', 'dmgMul', 0, v.v); B.amod('k_infernal', 'dur', 0, v.v); } },
  { id: 'wlk_dot', cls: 'warlock', name: 'Malveillance', icon: '☠️', max: 5,
    desc: '+{v}% de dégâts sur la durée.', vals: { v: R5(10, 15, 22, 30, 42) },
    stats(B, v) { B.add('dotDmg', v.v); } },
  { id: 'wlk_leech', cls: 'warlock', name: 'Pacte de sang', icon: '🍷', max: 3,
    desc: 'Vos dégâts sur la durée vous soignent de {v}% de leur montant.', vals: { v: R5(1, 1.5, 2.2, 3, 4) },
    stats(B, v) { B.add('dotLeech', v.v); } },
  { id: 'wlk_shadow', cls: 'warlock', name: 'Ténèbres', icon: '🌑', max: 5,
    desc: "+{v}% de dégâts d'ombre.", vals: { v: R5(10, 15, 22, 30, 42) },
    stats(B, v) { B.add('dmgShadow', v.v); } },
  { id: 'wlk_pool', cls: 'warlock', name: "Flaque d'ombre", icon: '🕳️', max: 2,
    desc: 'Pas démoniaque : la flaque dure +{v} s et inflige +{d}% de dégâts.', vals: { v: R5(1, 1.5, 2, 3, 4), d: R5(25, 40, 60, 85, 120) },
    stats(B, v) { B.amod('k_shadowstep', 'poolDur', v.v); B.amod('k_shadowstep', 'poolCoef', 0, v.d); } },
  { id: 'wlk_haunt', cls: 'warlock', name: 'Esprits hanteurs', icon: '👻', max: 1, minR: 4, locked: true,
    desc: 'Les ennemis que vous tuez libèrent un esprit qui traque un ennemi proche ({v}% de dégâts de votre arme).', vals: { v: R5(0, 0, 0, 0, 100) },
    hooks: {
      onKill(g, h, m, info, v) {
        if (info.ability === 'haunt') return;
        g.fireProjectile({ owner: h, x: m.x, z: m.z, a: g.rng.angle(), speed: 12, range: 18, radius: 0.35, vis: 'spirit', coef: v.v / 100, type: 'shadow', ability: 'haunt', homing: 6, ghost: true, hitOpts: { proc: true } });
      },
    } },
  { id: 'wlk_soul', cls: 'warlock', name: "Récolte d'âmes", icon: '👻', max: 3,
    desc: 'Tuer un ennemi corrompu octroie +{v}% de dégâts jusqu\'à la fin de la vague (max 25 cumuls).', vals: { v: R5(0.5, 0.8, 1.1, 1.5, 2) },
    hooks: {
      onKill(g, h, m, info, v, st) {
        if (!m.st.corrupt || m.st.corrupt.stacks <= 0) return;
        st.n = Math.min(25, (st.n || 0) + 1);
        st.wave = g.wave;
      },
      dmgMod(g, h, t, o, acc, v, st) { if (st.n && st.wave === g.wave) acc.inc += st.n * v.v; },
      onWaveEnd(g, h, v, st) { st.n = 0; },
    } },
  { id: 'wlk_armor', cls: 'warlock', name: 'Peau démoniaque', icon: '🧱', max: 3,
    desc: '+{v}% de résistance élémentaire.', vals: { v: R5(4, 6, 9, 13, 18) },
    stats(B, v) { B.add('res', v.v); } },
  { id: 'wlk_pact', cls: 'warlock', name: 'Pacte démoniaque', icon: '📜', max: 2, minR: 2, locked: true,
    desc: '+{v}% de dégâts (multiplicatif), mais -10% de PV max.', vals: { v: R5(0, 0, 15, 22, 30) },
    stats(B, v) { B.more(1 + v.v / 100); B.add('maxHpPct', -10); } },
];
