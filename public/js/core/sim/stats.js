// Stat accumulation for heroes: base class + items + talents + buffs -> final stats.
export const HOOK_NAMES = [
  'dmgMod', 'onHit', 'onCrit', 'onKill', 'onHurt', 'onLethal', 'onOverheal', 'onCast', 'onDash',
  'tick', 'onWaveStart', 'onWaveEnd', 'onPotion', 'onSummon', 'onMinionDeath', 'onLevel', 'onOrb',
  'onHealOther', 'onAllyDown',
];

export function emptyHooks() {
  const h = {};
  for (const n of HOOK_NAMES) h[n] = [];
  return h;
}

export class StatBuilder {
  constructor() {
    this.s = {
      maxHp: 0, maxHpPct: 0, regen: 0, regenPct: 0, armor: 0, armorPct: 0, res: 0, dodge: 0, dmgReduc: 0,
      dmgPct: 0, atkSpd: 0, critChance: 0, critDmg: 0, cdr: 0, moveSpd: 0, area: 0, dur: 0,
      lifeSteal: 0, lifeOnKill: 0, thorns: 0, summonDmg: 0, summonHp: 0,
      dmgPhys: 0, dmgFire: 0, dmgCold: 0, dmgLight: 0, dmgPoison: 0, dmgHoly: 0, dmgShadow: 0, dmgArcane: 0,
      dmgElite: 0, dmgCC: 0, dotDmg: 0,
      burnChance: 0, chillChance: 0, shockChance: 0, poisonChance: 0, bleedChance: 0,
      healRecv: 0, goldFind: 0, xpGain: 0, luck: 0, pickup: 0, potionCharges: 0, potionHeal: 0,
      // extended (effects only)
      summonAtkSpd: 0, summonSpd: 0, minionLeech: 0, dotLeech: 0, bleedLeech: 0, killHealPct: 0,
      reflect: 0, dashCharges: 0, orbBonus: 0, statusBonus: 0, freezeBonus: 0, poisonStacks: 0,
      talentChoices: 0, echo: 0, freeCast: 0, minRarity: 0, scale: 0,
    };
    this.am = {}; // ability mods: id -> param -> {add, pct}
    this.fl = {}; // numeric flags
    this.moreDmg = 1;
    this.moreTaken = 1;
    this.moreHp = 1;
    this.moreSpeed = 1;
    this.bool = {}; // boolean switches (ccImmune, ...)
    this.mul = { burn: 1, shock: 1, shockDur: 1, poison: 1, poisonDur: 1 };
  }

  add(k, v) { this.s[k] = (this.s[k] || 0) + v; return this; }
  more(m) { this.moreDmg *= m; return this; }
  taken(m) { this.moreTaken *= m; return this; }
  hpMore(m) { this.moreHp *= m; return this; }
  speedMore(m) { this.moreSpeed *= m; return this; }
  set(k, v = true) { this.bool[k] = v; return this; }
  flag(k, v = 1) { this.fl[k] = (this.fl[k] || 0) + v; return this; }

  /** ability param modifier: value = (base + add) * (1 + pct/100) */
  amod(abil, param, add = 0, pct = 0) {
    const a = this.am[abil] || (this.am[abil] = {});
    const m = a[param] || (a[param] = { add: 0, pct: 0 });
    m.add += add;
    m.pct += pct;
    return this;
  }
}

/** Compute final ability parameters for one ability */
export function computeAbilityParams(ab, B, S) {
  const P = {};
  const mods = B.am[ab.id] || {};
  for (const k in ab.p) {
    let v = ab.p[k];
    const m = mods[k];
    if (m) v = (v + m.add) * (1 + m.pct / 100);
    P[k] = v;
  }
  for (const k in mods) {
    if (k in P) continue;
    const m = mods[k];
    P[k] = m.add * (1 + m.pct / 100);
  }
  if (P.dmg === undefined) P.dmg = 0;
  if ('cd' in P) P.cd = Math.max(ab.slot === 'dash' ? 0.6 : 0.25, P.cd * (1 - Math.min(60, S.cdr) / 100));
  if ('interval' in P) P.interval = Math.max(0.08, P.interval / Math.max(0.1, 1 + S.atkSpd / 100));
  const areaKeys = ab.areaParams || ['radius'];
  for (const k of areaKeys) if (k in P) P[k] *= 1 + S.area / 100;
  const durKeys = ab.durParams || [];
  for (const k of durKeys) if (k in P) P[k] *= 1 + S.dur / 100;
  for (const k of ab.intParams || []) if (k in P) P[k] = Math.round(P[k]);
  return P;
}
