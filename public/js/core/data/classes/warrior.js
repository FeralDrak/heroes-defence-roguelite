import { TEAM_HEROES, ANIM } from '../../constants.js';

export const CLASS = {
  id: 'warrior',
  name: 'Guerrier',
  title: "Rempart d'acier",
  icon: '⚔️',
  color: '#e05050',
  role: 'Mêlée · Résistant',
  difficulty: 1,
  desc: "Un colosse en armure qui fend les hordes au corps-à-corps. Robuste, il encaisse, provoque et brise les lignes ennemies.",
  base: { hp: 155, armor: 26, res: 10, regen: 1.6, speed: 6.2, crit: 5, critDmg: 50 },
  abilities: ['w_cleave', 'w_whirl', 'w_warcry', 'w_leap', 'w_titan', 'w_charge'],
};

function shockwave(g, h, ctx, coef) {
  g.fireProjectile({
    owner: h, x: ctx.ox, z: ctx.oz, a: ctx.a, speed: 20, range: 8, radius: 1.1, vis: 'shockwave',
    coef, type: 'phys', ability: 'w_cleave', pierce: 99, aoe: true, mult: ctx.mult,
  });
}

export const ABILITIES = {
  w_cleave: {
    id: 'w_cleave', slot: 'primary', name: 'Fendoir', icon: '🪓', dmgType: 'phys',
    p: { interval: 0.7, coef: 1.0, range: 2.8, arc: 130, bleed: 0, double: 0 },
    desc: (P, d) => `Frappe en arc de ${Math.round(P.arc)}° devant vous, infligeant ${d(P.coef)} dégâts physiques à tous les ennemis touchés.`,
    cast(g, h, P, ctx) {
      const onHit = P.bleed > 0
        ? (m) => g.applyStatus(m, 'bleed', { dps: g.heroDps(h, P.coef, 'phys', 'w_cleave') * (P.bleed / 100) / 3, dur: 3, hero: h })
        : null;
      g.meleeSwing(h, ctx, { range: P.range, arc: P.arc, coef: P.coef, type: 'phys', ability: 'w_cleave', color: 'steel', onHit });
      if (h.fl('warWave') > 0) shockwave(g, h, ctx, P.coef * 0.8 * h.fl('warWave'));
      if (P.double > 0) {
        g.later(0.16, () => {
          if (!h.alive || h.downed) return;
          const c2 = Object.assign({}, ctx, { ox: h.x, oz: h.z, mult: ctx.mult * (P.double / 100) });
          g.meleeSwing(h, c2, { range: P.range, arc: P.arc, coef: P.coef, type: 'phys', ability: 'w_cleave', color: 'steel', onHit });
        });
      }
      return true;
    },
  },
  w_whirl: {
    id: 'w_whirl', slot: 'secondary', name: 'Tourbillon', icon: '🌀', dmgType: 'phys',
    p: { cd: 7, dur: 2.0, tick: 0.25, coef: 0.45, radius: 3.0, heal: 0, pull: 0 },
    durParams: ['dur'],
    desc: (P, d) => `Tournoie pendant ${P.dur.toFixed(1)} s, infligeant ${d(P.coef)} dégâts physiques toutes les ${P.tick}s aux ennemis dans un rayon de ${P.radius.toFixed(1)} m. Vous pouvez vous déplacer.`,
    cast(g, h, P, ctx) {
      g.addBuff(h, 'whirl', P.dur);
      g.spawnArea({
        owner: h, team: TEAM_HEROES, shape: 'circle', follow: h, r: P.radius, dur: P.dur, tick: P.tick,
        vis: 'whirl', ability: 'w_whirl',
        onTick: (g2, a) => {
          let total = 0;
          for (const m of g.enemiesInRadius(TEAM_HEROES, a.x, a.z, a.r)) {
            total += g.hit(h, m, P.coef, { type: 'phys', ability: 'w_whirl', melee: true, aoe: true, mult: ctx.mult });
            if (P.pull > 0 && m.alive && !m.boss) {
              const dx = h.x - m.x, dz = h.z - m.z, dd = Math.hypot(dx, dz) || 1;
              if (dd > 1.2) { m.vx += (dx / dd) * 3; m.vz += (dz / dd) * 3; }
            }
          }
          if (P.heal > 0 && total > 0) g.heal(h, total * P.heal / 100, h);
        },
      });
      g.snd('whirl', h.x, h.z);
      return true;
    },
  },
  w_warcry: {
    id: 'w_warcry', slot: 'skill1', name: 'Cri de guerre', icon: '📯', dmgType: 'phys',
    p: { cd: 16, dur: 6, radius: 10, bonus: 25, fear: 0, atkSpd: 0 },
    durParams: ['dur'],
    desc: (P) => `Galvanise les alliés dans un rayon de ${P.radius.toFixed(0)} m : +${Math.round(P.bonus)}% de dégâts et -20% de dégâts subis pendant ${P.dur.toFixed(1)} s. ${P.fear > 0 ? `Terrifie les ennemis proches pendant ${P.fear.toFixed(1)} s.` : 'Provoque les ennemis proches pendant 3 s.'}`,
    cast(g, h, P, ctx) {
      for (const o of g.heroesInRadius(h.x, h.z, P.radius)) {
        g.addBuff(o, 'warcry', P.dur, { bonus: P.bonus, atkSpd: P.atkSpd });
      }
      for (const m of g.enemiesInRadius(TEAM_HEROES, h.x, h.z, 8)) {
        if (P.fear > 0) g.applyStatus(m, 'fear', { dur: P.fear, x: h.x, z: h.z });
        else g.applyStatus(m, 'taunt', { dur: 3, by: h });
      }
      g.fx('nova', { x: h.x, z: h.z, r: P.radius, c: 'war' });
      g.snd('warcry', h.x, h.z);
      return true;
    },
  },
  w_leap: {
    id: 'w_leap', slot: 'skill2', name: 'Bond', icon: '🦘', dmgType: 'phys',
    p: { cd: 9, dist: 10, air: 0.55, radius: 3.5, coef: 2.2, stun: 1.0, waves: 0 },
    move: { kind: 'leap', dist: 'dist', dur: 'air' },
    desc: (P, d) => `Bondit jusqu'à ${P.dist.toFixed(0)} m. À l'atterrissage, inflige ${d(P.coef)} dégâts physiques dans un rayon de ${P.radius.toFixed(1)} m et étourdit ${P.stun.toFixed(1)} s. Invulnérable pendant le saut.`,
    cast(g, h, P, ctx) {
      g.heroLeap(h, P, ctx, {
        onLand: (g2, hh) => {
          g.explode(h, h.x, h.z, P.radius, P.coef, { type: 'phys', ability: 'w_leap', status: 'stun', statusOpts: { dur: P.stun }, color: 'earth', snd: 'slam', knock: 4 });
          g.fx('shake', { x: h.x, z: h.z, s: 0.5 });
          const waves = Math.round(P.waves);
          for (let i = 0; i < waves; i++) {
            const a = (i / waves) * Math.PI * 2;
            g.fireProjectile({ owner: h, x: h.x, z: h.z, a, speed: 16, range: 10, radius: 1.0, vis: 'shockwave', coef: P.coef * 0.6, type: 'phys', ability: 'w_leap', pierce: 99, aoe: true });
          }
          if (h.fl('leapResetCharge') > 0) {
            h.cd[5] = g.time;
            h.dashCharges = h.dashMax;
            g.events.push({ e: 'cd', pid: h.pid, s: 5, d: 0, r: 0, ch: h.dashCharges });
          }
        },
      });
      return true;
    },
  },
  w_titan: {
    id: 'w_titan', slot: 'ultimate', name: 'Colère du Titan', icon: '🗿', dmgType: 'phys',
    p: { cd: 55, dur: 8 },
    durParams: ['dur'],
    desc: (P) => `Devenez un titan pendant ${P.dur.toFixed(1)} s : taille accrue, +30% vitesse d'attaque, -30% dégâts subis, et Fendoir libère une onde de choc.`,
    cast(g, h, P) {
      g.addBuff(h, 'titan', P.dur);
      g.fx('nova', { x: h.x, z: h.z, r: 5, c: 'war' });
      g.snd('titan', h.x, h.z);
      return true;
    },
  },
  w_charge: {
    id: 'w_charge', slot: 'dash', name: 'Charge', icon: '🐂', dmgType: 'phys',
    p: { cd: 5, dist: 7, dashDur: 0.25, coef: 0.6, stun: 0 },
    move: { kind: 'dash', dist: 'dist', dur: 'dashDur' },
    desc: (P, d) => `Charge sur ${P.dist.toFixed(1)} m, repoussant les ennemis traversés et leur infligeant ${d(P.coef)} dégâts physiques.${P.stun > 0 ? ` Étourdit ${P.stun.toFixed(1)} s.` : ''}`,
    cast(g, h, P, ctx) {
      g.heroDash(h, P, ctx, {
        coef: P.coef, type: 'phys', ability: 'w_charge', knock: 7, r: 1.5, color: 'war',
        onTouch: P.stun > 0 ? (g2, hh, m) => g.applyStatus(m, 'stun', { dur: P.stun }) : null,
      });
      return true;
    },
    anim: ANIM.ATTACK,
  },
};

const R5 = (a, b, c, d, e) => [a, b, c, d, e];

export const TALENTS = [
  { id: 'war_sharp', cls: 'warrior', name: 'Lame affûtée', icon: '🗡️', max: 5,
    desc: 'Fendoir inflige +{v}% de dégâts.', vals: { v: R5(12, 18, 26, 36, 50) },
    stats(B, v) { B.amod('w_cleave', 'dmg', v.v); } },
  { id: 'war_reach', cls: 'warrior', name: 'Allonge', icon: '📏', max: 3,
    desc: 'Fendoir : portée +{v}% et angle +{a}°.', vals: { v: R5(8, 12, 16, 22, 30), a: R5(10, 15, 20, 28, 40) },
    stats(B, v) { B.amod('w_cleave', 'range', 0, v.v); B.amod('w_cleave', 'arc', v.a); } },
  { id: 'war_bleed', cls: 'warrior', name: 'Saignée', icon: '🩸', max: 3,
    desc: 'Fendoir fait saigner : {v}% des dégâts infligés en plus sur 3 s.', vals: { v: R5(25, 35, 50, 70, 95) },
    stats(B, v) { B.amod('w_cleave', 'bleed', v.v); } },
  { id: 'war_whirl_dur', cls: 'warrior', name: "Ouragan d'acier", icon: '🌪️', max: 3,
    desc: 'Tourbillon dure +{v} s.', vals: { v: R5(0.4, 0.6, 0.9, 1.3, 1.8) },
    stats(B, v) { B.amod('w_whirl', 'dur', v.v); } },
  { id: 'war_whirl_pull', cls: 'warrior', name: 'Œil du cyclone', icon: '🌀', max: 1, minR: 2, locked: true,
    desc: 'Tourbillon attire les ennemis vers vous et inflige +{v}% de dégâts.', vals: { v: R5(0, 0, 20, 30, 45) },
    stats(B, v) { B.amod('w_whirl', 'pull', 1); B.amod('w_whirl', 'dmg', v.v); } },
  { id: 'war_whirl_heal', cls: 'warrior', name: 'Sang bouillant', icon: '💓', max: 3,
    desc: 'Tourbillon vous soigne de {v}% des dégâts infligés.', vals: { v: R5(2, 3, 4.5, 6.5, 9) },
    stats(B, v) { B.amod('w_whirl', 'heal', v.v); } },
  { id: 'war_iron', cls: 'warrior', name: 'Peau de fer', icon: '🛡️', max: 5,
    desc: '+{v}% d\'armure.', vals: { v: R5(8, 12, 17, 24, 33) },
    stats(B, v) { B.add('armorPct', v.v); } },
  { id: 'war_leap_radius', cls: 'warrior', name: 'Impact sismique', icon: '💥', max: 3,
    desc: 'Bond : zone +{v}% et dégâts +{d}%.', vals: { v: R5(12, 18, 26, 36, 50), d: R5(15, 22, 32, 45, 62) },
    stats(B, v) { B.amod('w_leap', 'radius', 0, v.v); B.amod('w_leap', 'dmg', v.d); } },
  { id: 'war_leap_waves', cls: 'warrior', name: 'Faille', icon: '⚡', max: 1, minR: 3, locked: true,
    desc: "Bond libère {v} ondes de choc tout autour du point d'impact.", vals: { v: R5(0, 0, 0, 6, 10) },
    stats(B, v) { B.amod('w_leap', 'waves', v.v); } },
  { id: 'war_cry_fear', cls: 'warrior', name: 'Cri terrifiant', icon: '😱', max: 1, minR: 2,
    desc: 'Cri de guerre terrifie les ennemis pendant {v} s au lieu de les provoquer.', vals: { v: R5(0, 0, 1.5, 2.2, 3) },
    stats(B, v) { B.amod('w_warcry', 'fear', v.v); } },
  { id: 'war_cry_power', cls: 'warrior', name: 'Hurlement de guerre', icon: '📢', max: 3,
    desc: 'Cri de guerre octroie +{v}% de dégâts supplémentaires.', vals: { v: R5(8, 12, 18, 25, 35) },
    stats(B, v) { B.amod('w_warcry', 'bonus', v.v); } },
  { id: 'war_berserk', cls: 'warrior', name: 'Rage du berserker', icon: '😡', max: 3,
    desc: "Sous 50% de PV : +{v}% de dégâts et de vitesse d'attaque.", vals: { v: R5(10, 15, 22, 30, 42) },
    hooks: {
      dmgMod(g, h, t, o, acc, v) { if (h.hp < h.maxHp * 0.5) acc.inc += v.v; },
      tick(g, h, dt, v, st) {
        const low = h.hp < h.maxHp * 0.5;
        if (low !== !!st.low) { st.low = low; h.statsDirty = true; }
      },
    },
    stats(B, v, h, g) { if (h && h.hp < h.maxHp * 0.5) B.add('atkSpd', v.v); } },
  { id: 'war_charge', cls: 'warrior', name: 'Charge brutale', icon: '🐃', max: 3,
    desc: 'Charge : +{v}% de dégâts et étourdit 1 s.', vals: { v: R5(25, 40, 60, 85, 120) },
    stats(B, v) { B.amod('w_charge', 'dmg', v.v); B.amod('w_charge', 'stun', 1); } },
  { id: 'war_riposte', cls: 'warrior', name: 'Riposte', icon: '🤺', max: 3,
    desc: 'Quand vous êtes touché, {v}% de chances de riposter avec un Fendoir gratuit.', vals: { v: R5(8, 12, 17, 24, 33) },
    hooks: {
      onHurt(g, h, src, info, acc, v, st) {
        if (!src || src.kind !== 'monster' || info.dot) return;
        if ((st.t || 0) > g.time) return;
        if (g.rng.next() * 100 < v.v) {
          st.t = g.time + 0.4;
          g.castFrom(h, 0, h.x, h.z, src.x, src.z, 1);
        }
      },
    } },
  { id: 'war_execute', cls: 'warrior', name: 'Exécution', icon: '⚰️', max: 2, minR: 2, locked: true,
    desc: '+{v}% de dégâts contre les ennemis sous 30% de PV.', vals: { v: R5(0, 0, 30, 45, 70) },
    hooks: { dmgMod(g, h, t, o, acc, v) { if (t.hp < t.maxHp * 0.3) acc.inc += v.v; } } },
  { id: 'war_titan_dur', cls: 'warrior', name: 'Titan éternel', icon: '⏳', max: 3,
    desc: 'Colère du Titan dure +{v} s.', vals: { v: R5(1, 1.5, 2.2, 3, 4) },
    stats(B, v) { B.amod('w_titan', 'dur', v.v); } },
  { id: 'war_double', cls: 'warrior', name: 'Seconde lame', icon: '⚔️', max: 1, minR: 4, locked: true,
    desc: 'Fendoir frappe une seconde fois ({v}% des dégâts).', vals: { v: R5(0, 0, 0, 0, 60) },
    stats(B, v) { B.amod('w_cleave', 'double', v.v); } },
  { id: 'war_unstoppable', cls: 'warrior', name: 'Inébranlable', icon: '🏔️', max: 3,
    desc: '-{v}% de dégâts subis.', vals: { v: R5(3, 4.5, 6.5, 9, 12) },
    stats(B, v) { B.add('dmgReduc', v.v); } },
];
