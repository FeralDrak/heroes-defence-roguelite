// Serializable views of a hero for clients (inventory, shop, talents, stats, ability params).

export function heroItemsState(g, h) {
  return {
    pid: h.pid,
    inv: h.inv,
    equip: h.equip,
    shop: h.shop ? h.shop.map((o) => ({ item: o.item, price: o.price, sold: o.sold })) : null,
    costs: {
      reroll: g.shopRerollCost(h),
      tome: g.tomeCost(h),
      potion: g.potionCost(),
      talentReroll: g.talentRerollCost(h),
    },
    choice: h.choice,
    talents: Object.fromEntries(h.talentOrder.map((id) => [id, h.talents[id].picks])),
    talentOrder: h.talentOrder,
  };
}

const STAT_KEYS = [
  'power', 'maxHp', 'armor', 'res', 'dodge', 'dmgReduc', 'regen', 'dmgPct', 'atkSpd', 'critChance', 'critMult', 'cdr',
  'moveSpeed', 'area', 'dur', 'lifeSteal', 'lifeOnKill', 'thorns', 'summonDmg', 'summonHp', 'dmgPhys', 'dmgFire',
  'dmgCold', 'dmgLight', 'dmgPoison', 'dmgHoly', 'dmgShadow', 'dmgArcane', 'dmgElite', 'dmgCC', 'dotDmg',
  'burnChance', 'chillChance', 'shockChance', 'poisonChance', 'bleedChance', 'healRecv', 'goldFind', 'xpGain',
  'luck', 'pickup', 'potionCharges', 'potionHeal', 'more', 'taken', 'ghostWalk', 'ccImmune', 'slowImmune',
];

export function heroStatsState(g, h) {
  const S = {};
  for (const k of STAT_KEYS) {
    const v = h.S[k];
    if (v === undefined) continue;
    S[k] = typeof v === 'number' ? Math.round(v * 100) / 100 : v;
  }
  const P = {};
  for (const [id, params] of Object.entries(h.P)) {
    const o = {};
    for (const [k, v] of Object.entries(params)) o[k] = Math.round(v * 1000) / 1000;
    P[id] = o;
  }
  return {
    pid: h.pid,
    cls: h.classId,
    S,
    P,
    levelMul: Math.round(h.levelMul * 1000) / 1000,
    scale: h.scale,
    run: h.run,
  };
}

/** Events that rebuild persistent client state (for reconnects / late joins) */
export function fullSyncEvents(g) {
  const out = [];
  for (const a of g.areas) {
    if (!a.alive || a.hidden) continue;
    out.push({
      e: 'area+', id: a.id, sh: a.shape, x: a.x, z: a.z, r: a.r, r2: a.r2, a: a.a, arc: a.arc, len: a.len, w: a.w,
      d: a.resolved ? 0 : Math.max(0, a.delay - a.t), dur: a.dur > 0 ? Math.max(0.1, a.dur - (a.resolved ? a.t : 0)) : 0,
      v: a.vis, f: a.follow ? a.follow.id : 0, rs: a.rotSpd, tm: a.team,
    });
  }
  for (const pk of g.pickups.values()) {
    out.push({ e: 'pick+', id: pk.id, k: pk.kind, x: pk.x, z: pk.z, it: pk.item, tier: pk.tier });
  }
  for (const m of g.monsters) {
    if (m.alive && (m.elite || m.boss)) out.push({ e: 'info', u: m.id, n: m.name, af: m.affixes, boss: m.boss ? 1 : 0 });
  }
  for (const a of g.allies) {
    if (a.alive) out.push({ e: 'info', u: a.id, n: a.def.name, o: a.owner.pid });
  }
  return out;
}
