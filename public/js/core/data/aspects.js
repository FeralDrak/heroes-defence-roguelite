// Legendary aspects: one random power on each legendary item.
import { TEAM_HEROES } from '../constants.js';
import { chainLightning, orbitTick, reduceCooldowns } from '../sim/helpers.js';

export const ASPECTS_LIST = [
  { id: 'asp_flame', name: 'du Brasier', desc: 'Vos coups critiques enflamment la cible ({v}% des dégâts par seconde pendant 3 s).', vals: { v: [30, 60] },
    hooks: { onCrit(g, h, t, info, dealt, v) { if (t.alive) g.applyStatus(t, 'burn', { dps: dealt * v.v / 100, dur: 3, hero: h }); } } },
  { id: 'asp_winter', name: "de l'Hiver", desc: 'Vos coups ont {v}% de chances de geler la cible pendant 1 s.', vals: { v: [5, 10] },
    hooks: { onHit(g, h, t, info, dealt, v) { if (t.alive && g.rng.next() * 100 < v.v) g.applyStatus(t, 'freeze', { dur: 1, hero: h }); } } },
  { id: 'asp_static', name: 'Statique', desc: "Vos coups ont {v}% de chances de déclencher un éclair qui rebondit sur 3 ennemis (100% des dégâts de l'arme).", vals: { v: [8, 15] },
    hooks: { onHit(g, h, t, info, dealt, v) { if (g.rng.next() * 100 < v.v) chainLightning(g, h, null, t.x, t.z, t, 1, 2, 6, { ability: 'proc', proc: true }); } } },
  { id: 'asp_vampire', name: 'du Vampire', desc: '+{v}% de vol de vie.', vals: { v: [2, 4] }, dec: 1,
    stats(B, v) { B.add('lifeSteal', v.v); } },
  { id: 'asp_berserker', name: 'du Berserker', desc: "Chaque élimination octroie +{v}% de vitesse d'attaque pendant 3 s (cumulable 5 fois).", vals: { v: [3, 6] },
    hooks: { onKill(g, h, m, info, v) { g.addBuff(h, 'berserkKill', 3, { v: v.v }); } } },
  { id: 'asp_detonation', name: 'Détonant', desc: "Les ennemis que vous tuez ont {v}% de chances d'exploser (100% des dégâts de l'arme, rayon 3 m).", vals: { v: [12, 22] },
    hooks: { onKill(g, h, m, info, v) { if (!info.proc && g.rng.next() * 100 < v.v) g.explode(h, m.x, m.z, 3, 1, { type: 'fire', proc: true, color: 'fire', snd: 'pop' }); } } },
  { id: 'asp_guardian', name: 'du Gardien', desc: 'Toutes les 8 s, gagnez un bouclier de {v}% de vos PV max.', vals: { v: [8, 15] },
    hooks: { tick(g, h, dt, v, st) { st.t = (st.t ?? 0) - dt; if (st.t <= 0) { st.t = 8; g.addShield(h, h.maxHp * v.v / 100, 8); } } } },
  { id: 'asp_executioner', name: 'du Bourreau', desc: '+{v}% de dégâts contre les ennemis sous 35% de PV.', vals: { v: [20, 40] },
    hooks: { dmgMod(g, h, t, o, acc, v) { if (t.hp < t.maxHp * 0.35) acc.inc += v.v; } } },
  { id: 'asp_giant', name: 'du Tueur de titans', desc: '+{v}% de dégâts contre les élites et les boss.', vals: { v: [20, 40] },
    stats(B, v) { B.add('dmgElite', v.v); } },
  { id: 'asp_wind', name: 'du Vent', desc: "+{v}% de vitesse de déplacement et d'esquive.", vals: { v: [6, 12] },
    stats(B, v) { B.add('moveSpd', v.v); B.add('dodge', v.v / 2); } },
  { id: 'asp_thorns', name: 'des Ronces', desc: 'Les ennemis qui vous frappent en mêlée subissent {v}% de vos PV max en dégâts.', vals: { v: [8, 15] },
    stats(B, v, h) { if (h) B.add('thorns', h.maxHp * v.v / 100 / Math.max(1, h.levelMul)); } },
  { id: 'asp_time', name: 'du Temps', desc: '+{v}% de réduction des temps de recharge.', vals: { v: [8, 14] },
    stats(B, v) { B.add('cdr', v.v); } },
  { id: 'asp_expansion', name: "de l'Expansion", desc: "+{v}% de taille des zones d'effet.", vals: { v: [15, 25] },
    stats(B, v) { B.add('area', v.v); } },
  { id: 'asp_glass', name: 'du Canon de verre', desc: '+{v}% de dégâts (multiplicatif), mais -15% de PV max.', vals: { v: [25, 40] },
    stats(B, v) { B.more(1 + v.v / 100); B.add('maxHpPct', -15); } },
  { id: 'asp_fortress', name: 'de la Forteresse', desc: "+{v}% d'armure, mais -8% de vitesse de déplacement.", vals: { v: [40, 70] },
    stats(B, v) { B.add('armorPct', v.v); B.add('moveSpd', -8); } },
  { id: 'asp_fortune', name: 'de la Fortune', desc: "+{v}% d'or gagné et de découverte d'objets magiques.", vals: { v: [20, 40] },
    stats(B, v) { B.add('goldFind', v.v); B.add('luck', v.v); } },
  { id: 'asp_bloom', name: 'de Floraison', desc: 'Les orbes de soin soignent +{v}% et soignent aussi les alliés proches.', vals: { v: [40, 80] },
    stats(B, v) { B.add('orbBonus', v.v); B.set('orbShare'); } },
  { id: 'asp_harvest', name: 'de la Moisson', desc: 'Chaque élimination réduit les temps de recharge de vos compétences de {v} s.', vals: { v: [0.08, 0.16] }, dec: 2,
    hooks: { onKill(g, h, m, info, v) { reduceCooldowns(g, h, v.v); } } },
  { id: 'asp_evasion', name: "de l'Évasion", desc: "Votre esquive (dash) se recharge {v}% plus vite et vous soigne de 5% de vos PV max.", vals: { v: [20, 35] },
    stats(B, v, h) { if (h) B.amod(h.cls.abilities[5], 'cd', 0, -v.v); },
    hooks: { onDash(g, h) { g.heal(h, h.maxHp * 0.05, h); } } },
  { id: 'asp_shock', name: 'du Choc', desc: "Votre esquive libère une onde de choc ({v}% des dégâts de l'arme, rayon 4 m).", vals: { v: [150, 250] },
    hooks: { onDash(g, h, ctx, v) { g.explode(h, h.x, h.z, 4, v.v / 100, { type: 'light', proc: true, color: 'light', snd: 'zap' }); } } },
  { id: 'asp_commander', name: 'du Commandeur', desc: '+{v}% de dégâts et de PV des serviteurs et structures.', vals: { v: [20, 40] },
    stats(B, v) { B.add('summonDmg', v.v); B.add('summonHp', v.v); } },
  { id: 'asp_venom', name: 'du Venin', desc: 'Vos coups empoisonnent ({v}% des dégâts en plus sur 4 s).', vals: { v: [20, 40] },
    hooks: { onHit(g, h, t, info, dealt, v) { if (t.alive) g.applyStatus(t, 'poison', { dps: dealt * v.v / 100 / 4, dur: 4, hero: h }); } } },
  { id: 'asp_blood', name: "de l'Hémorragie", desc: 'Vos coups critiques font saigner ({v}% des dégâts sur 3 s).', vals: { v: [40, 70] },
    hooks: { onCrit(g, h, t, info, dealt, v) { if (t.alive) g.applyStatus(t, 'bleed', { dps: dealt * v.v / 100 / 3, dur: 3, hero: h }); } } },
  { id: 'asp_thunder', name: 'du Tonnerre', desc: "Vos coups ont 20% de chances d'électrocuter (+{v}% de dégâts subis pendant 3 s).", vals: { v: [10, 18] },
    hooks: { onHit(g, h, t, info, dealt, v) { if (t.alive && g.rng.next() < 0.2) g.applyStatus(t, 'shock', { v: v.v / 100, dur: 3 }); } } },
  { id: 'asp_avenger', name: 'du Vengeur', desc: 'Quand vous subissez des dégâts, +{v}% de dégâts pendant 4 s (cumulable 3 fois).', vals: { v: [6, 12] },
    hooks: { onHurt(g, h, src, info, acc, v, st) { if (info.dot || (st.t || 0) > g.time) return; st.t = g.time + 0.5; g.addBuff(h, 'avenger', 4, { v: v.v }); } } },
  { id: 'asp_lastbreath', name: 'du Dernier souffle', desc: 'Sous 30% de PV, vous subissez {v}% de dégâts en moins.', vals: { v: [20, 35] },
    hooks: { onHurt(g, h, src, info, acc, v) { if (h.hp < h.maxHp * 0.3) acc.amount *= 1 - v.v / 100; } } },
  { id: 'asp_overkill', name: "de l'Excès", desc: "Les dégâts excédentaires d'une élimination sont infligés à l'ennemi le plus proche ({v}%).", vals: { v: [50, 100] },
    hooks: {
      onKill(g, h, m, info, v) {
        const over = -m.hp;
        if (info.proc || over <= 1) return;
        const n = g.nearestEnemy(TEAM_HEROES, m.x, m.z, 6);
        if (n) { g.dealDamage(h, n, over * v.v / 100, { type: info.type || 'phys', hero: h, ally: true, proc: true }); g.fx('zap', { x1: m.x, z1: m.z, x2: n.x, z2: n.z, c: 'blood' }); }
      },
    } },
  { id: 'asp_frenzy', name: 'de la Frénésie', desc: 'Vos coups critiques réduisent les temps de recharge de vos compétences de {v} s.', vals: { v: [0.1, 0.25] }, dec: 2,
    hooks: { onCrit(g, h, t, info, dealt, v, st) { if ((st.t || 0) > g.time) return; st.t = g.time + 0.1; reduceCooldowns(g, h, v.v); } } },
  { id: 'asp_ashes', name: 'des Cendres', desc: "Vos compétences de zone laissent un sol brûlant ({v}% des dégâts de l'arme par seconde pendant 3 s).", vals: { v: [25, 45] },
    hooks: {
      onCast(g, h, abId, slot, ctx, v, st) {
        if (slot < 1 || slot > 4) return;
        const [x, z] = g.aimPoint(ctx, 16);
        g.spawnArea({ owner: h, team: TEAM_HEROES, shape: 'circle', x, z, r: 2.5, dur: 3, tick: 0.5, vis: 'fireground',
          onTick: (g2, a) => g.areaHit(a, v.v / 100 * 0.5, { type: 'fire', proc: true }) });
      },
    } },
  { id: 'asp_blades', name: 'des Lames tournoyantes', desc: "{v} lames tournent autour de vous (50% des dégâts de l'arme par coup).", vals: { v: [2, 3] }, dec: 0,
    hooks: { tick(g, h, dt, v, st) { orbitTick(g, h, dt, st, Math.round(v.v), 2.3, 0.5, 'phys', 'blade'); } } },
  { id: 'asp_ricochet', name: 'du Ricochet', desc: 'Vos projectiles ont {v}% de chances de rebondir vers un autre ennemi.', vals: { v: [20, 35] },
    hooks: {
      onHit(g, h, t, info, dealt, v) {
        if (!info.projectile || info.proc || g.rng.next() * 100 >= v.v) return;
        const n = g.nearestEnemy(TEAM_HEROES, t.x, t.z, 8, (m) => m !== t);
        if (!n) return;
        const p = g.fireProjectile({ owner: h, x: t.x, z: t.z, a: Math.atan2(n.z - t.z, n.x - t.x), speed: 26, range: 9, radius: 0.3, vis: 'spark', coef: 0.6, type: info.type, hitOpts: { proc: true } });
        p.hitSet.add(t.id);
      },
    } },
  { id: 'asp_echo', name: "de l'Écho", desc: 'Vos attaques de base ont {v}% de chances de se répéter instantanément.', vals: { v: [12, 22] },
    hooks: {
      onCast(g, h, abId, slot, ctx, v) {
        if (slot !== 0 || ctx.recast || g.rng.next() * 100 >= v.v) return;
        g.later(0.1, () => { if (h.alive && !h.downed) g.castFrom(h, 0, h.x, h.z, h.input.ax, h.input.az, 1); });
      },
    } },
  { id: 'asp_sanctuary', name: 'du Sanctuaire', desc: 'Rester immobile 1 s octroie {v}% de réduction des dégâts.', vals: { v: [15, 25] },
    hooks: {
      tick(g, h, dt, v, st) {
        const still = !h.moving;
        st.s = still ? (st.s || 0) + dt : 0;
        const on = st.s >= 1;
        if (on && !g.hasBuff(h, 'sanctuary')) g.addBuff(h, 'sanctuary', 999, { v: v.v });
        else if (!on && g.hasBuff(h, 'sanctuary')) g.removeBuff(h, 'sanctuary');
      },
    } },
  { id: 'asp_momentum', name: "de l'Élan", desc: '+{v}% de dégâts tant que vous vous déplacez.', vals: { v: [12, 20] },
    hooks: { dmgMod(g, h, t, o, acc, v) { if (h.moving) acc.inc += v.v; } } },
  { id: 'asp_immortal', name: "de l'Immortel", desc: 'Quand vous tombez sous 20% de PV, vous récupérez {v}% de vos PV max (une fois toutes les 45 s).', vals: { v: [30, 50] },
    hooks: {
      tick(g, h, dt, v, st) {
        if (h.hp < h.maxHp * 0.2 && (st.t || -99) + 45 < g.time) {
          st.t = g.time;
          g.heal(h, h.maxHp * v.v / 100, h);
          g.fx('text', { u: h.id, s: 'Immortel !', c: '#ffd76a' });
        }
      },
    } },
  { id: 'asp_celestial', name: 'Céleste', desc: "Vos coups critiques ont 4% de chances d'invoquer une comète ({v}% des dégâts de l'arme, rayon 3 m).", vals: { v: [200, 350] },
    hooks: {
      onCrit(g, h, t, info, dealt, v, st) {
        if (info.proc || g.rng.next() >= 0.04 || (st.t || 0) > g.time) return;
        st.t = g.time + 0.5;
        const x = t.x, z = t.z;
        g.spawnArea({ owner: h, team: TEAM_HEROES, shape: 'circle', x, z, r: 3, delay: 0.6, vis: 'meteor',
          onResolve: () => g.explode(h, x, z, 3, v.v / 100, { type: 'fire', proc: true, color: 'arcane', snd: 'meteor' }) });
        g.fx('meteor', { x, z, r: 3, d: 0.6, c: 'arcane' });
      },
    } },
];

// 25% unlocked from the start
const DEFAULT_UNLOCKED = new Set(['asp_vampire', 'asp_guardian', 'asp_giant', 'asp_wind', 'asp_time', 'asp_expansion', 'asp_fortune', 'asp_venom', 'asp_executioner']);
for (const a of ASPECTS_LIST) a.locked = !DEFAULT_UNLOCKED.has(a.id);

export const ASPECTS = Object.fromEntries(ASPECTS_LIST.map((a) => [a.id, a]));
