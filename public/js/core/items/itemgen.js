// Item generation: bases, rarities, affixes, legendary aspects and uniques.
import {
  WEAPON_BASES, ARMOR_BASES, AFFIXES, AFFIX_BY_ID, MAGIC_SUFFIXES, RARE_NAME_A, RARE_NAME_B,
  RARITY_INFO, BASE_WEAPON_POWER, BASE_ARMOR, ilvlScale, pctScale,
} from '../data/items.js';
import { ASPECTS_LIST } from '../data/aspects.js';
import { UNIQUES_LIST } from '../data/uniques.js';
import { CLASSES, ABILITIES } from '../data/classes/index.js';

export const SLOT_WEIGHTS = { weapon: 18, helm: 14, chest: 14, gloves: 13, boots: 13, amulet: 12, ring: 16 };

// Rarity weight tables by source
export const RARITY_TABLES = {
  monster: { common: 55, magic: 30, rare: 12, legendary: 2.4, unique: 0.6 },
  elite: { common: 8, magic: 38, rare: 38, legendary: 12.5, unique: 3.5 },
  chest: { common: 0, magic: 42, rare: 42, legendary: 12.5, unique: 3.5 },
  cursed: { common: 0, magic: 22, rare: 46, legendary: 24, unique: 8 },
  shop: { common: 0, magic: 52, rare: 38, legendary: 9, unique: 1 },
  boss: { common: 0, magic: 0, rare: 0, legendary: 72, unique: 28 },
};

export function goldScale(ilvl) {
  return Math.pow(1.09, Math.max(0, ilvl - 1));
}

export function rollRarity(rng, table, luck = 0, lootMul = 1) {
  const t = RARITY_TABLES[table] || RARITY_TABLES.monster;
  const L = Math.max(0, luck);
  const w = {
    common: t.common,
    magic: t.magic * (1 + L / 300),
    rare: t.rare * (1 + L / 120),
    legendary: t.legendary * (1 + L / 90) * lootMul,
    unique: t.unique * (1 + L / 90) * lootMul,
  };
  return rng.weighted(Object.keys(w), (k) => w[k]);
}

function roundTo(v, dec) {
  const p = Math.pow(10, dec);
  return Math.round(v * p) / p;
}

export function rollAffixValue(rng, aff, ilvl, mul = 1) {
  const base = aff.min + (aff.max - aff.min) * rng.next();
  const scaled = base * (aff.scale ? ilvlScale(ilvl) : pctScale(ilvl)) * mul;
  return roundTo(scaled, aff.dec ?? (aff.scale ? 0 : 1));
}

/**
 * ctx: { rng, ilvl, rarity, slot?, cls?, classes (party class ids), luck, unlocked(kind, def), uid() }
 */
export function generateItem(ctx) {
  const { rng } = ctx;
  let rarity = ctx.rarity || 'common';
  const ilvl = Math.max(1, ctx.ilvl | 0);
  const classes = ctx.classes && ctx.classes.length ? ctx.classes : ['warrior'];
  const cls = ctx.cls || rng.pick(classes);

  if (rarity === 'unique') {
    const u = pickUnique(ctx, cls);
    if (u) return makeUnique(ctx, u, ilvl);
    rarity = 'legendary';
  }
  if (rarity === 'legendary' && !ASPECTS_LIST.some((a) => ctx.unlocked('aspects', a))) rarity = 'rare';

  const slot = ctx.slot || rng.weighted(Object.keys(SLOT_WEIGHTS), (s) => SLOT_WEIGHTS[s]);
  let base;
  if (slot === 'weapon') base = rng.pick(WEAPON_BASES[cls]);
  else base = rng.pick(ARMOR_BASES[slot]);

  const info = RARITY_INFO[rarity];
  const item = {
    uid: ctx.uid(),
    base: base.id,
    slot,
    cls: slot === 'weapon' ? cls : null,
    name: base.name,
    icon: base.icon,
    rarity,
    ilvl,
    implicit: base.implicit ? { ...base.implicit } : null,
    affixes: [],
  };
  if (slot === 'weapon') {
    item.power = Math.round(BASE_WEAPON_POWER * ilvlScale(ilvl) * rng.range(0.92, 1.08) * info.powerMul);
  } else if (base.armor > 0) {
    item.armor = Math.round(BASE_ARMOR * ilvlScale(ilvl) * base.armor * rng.range(0.9, 1.1) * info.powerMul);
  }
  const [a0, a1] = info.affixes;
  const nAff = rng.int(a0, a1);
  rollAffixes(ctx, item, nAff, cls, rarity === 'legendary' ? 1.1 : 1);

  if (rarity === 'magic' && item.affixes.length) {
    item.name = `${base.name} ${MAGIC_SUFFIXES[item.affixes[0].id] || ''}`.trim();
  } else if (rarity === 'rare') {
    item.name = `${rng.pick(RARE_NAME_A)} ${rng.pick(RARE_NAME_B)}`;
    item.baseName = base.name;
  } else if (rarity === 'legendary') {
    const pool = ASPECTS_LIST.filter((a) => ctx.unlocked('aspects', a));
    const asp = rng.pick(pool);
    const v = {};
    for (const k in asp.vals) {
      const [lo, hi] = asp.vals[k];
      v[k] = roundTo(lo + (hi - lo) * rng.next(), asp.dec ?? (Math.abs(hi) < 1 ? 2 : Math.abs(hi) < 10 ? 1 : 0));
    }
    item.aspect = { id: asp.id, v };
    item.name = `${base.name} ${asp.name}`;
  }
  item.value = itemValue(item);
  return item;
}

function rollAffixes(ctx, item, n, cls, mul) {
  const { rng } = ctx;
  const used = new Set();
  const slotKey = item.slot;
  const pool = AFFIXES.filter((a) => a.slots.includes(slotKey) && (!a.cls || a.cls.includes(cls)));
  for (let i = 0; i < n && pool.length; i++) {
    const cands = pool.filter((a) => !used.has(a.id));
    if (!cands.length) break;
    const aff = rng.weighted(cands, (a) => a.w);
    used.add(aff.id);
    if (aff.special === 'ability') {
      const c = CLASSES[cls];
      const abil = rng.pick(c.abilities.slice(0, 5));
      item.affixes.push({ id: 'abil', ab: abil, v: rollAffixValue(rng, aff, item.ilvl, mul) });
    } else {
      item.affixes.push({ id: aff.id, v: rollAffixValue(rng, aff, item.ilvl, mul) });
    }
  }
}

export function pickUnique(ctx, preferCls) {
  const { rng } = ctx;
  const classes = ctx.classes || [];
  let pool = UNIQUES_LIST.filter((u) => ctx.unlocked('uniques', u) && (!u.cls || classes.includes(u.cls)));
  if (ctx.slot) pool = pool.filter((u) => u.slot === ctx.slot);
  if (!pool.length) return null;
  return rng.weighted(pool, (u) => (u.cls && u.cls === preferCls ? 2 : 1) * (ctx.owned && ctx.owned.has(u.id) ? 0.5 : 1));
}

export function makeUnique(ctx, def, ilvl) {
  const { rng } = ctx;
  let base;
  if (def.slot === 'weapon') {
    base = WEAPON_BASES[def.cls || rng.pick(ctx.classes || ['warrior'])][0];
  } else {
    base = ARMOR_BASES[def.slot][0];
  }
  const item = {
    uid: ctx.uid(),
    base: base.id,
    slot: def.slot,
    cls: def.cls || (def.slot === 'weapon' ? null : null),
    name: def.name,
    icon: def.icon || base.icon,
    rarity: 'unique',
    ilvl,
    implicit: null,
    affixes: [],
    unique: def.id,
    uv: {},
  };
  const info = RARITY_INFO.unique;
  if (def.slot === 'weapon') item.power = Math.round(BASE_WEAPON_POWER * ilvlScale(ilvl) * rng.range(0.95, 1.08) * info.powerMul);
  else if (base.armor > 0) item.armor = Math.round(BASE_ARMOR * ilvlScale(ilvl) * base.armor * rng.range(0.95, 1.1) * info.powerMul);
  for (const [id, lo, hi] of def.affixes || []) {
    const aff = AFFIX_BY_ID[id];
    const raw = lo + (hi - lo) * rng.next();
    const scaled = aff && aff.scale ? raw * ilvlScale(ilvl) : raw * pctScale(ilvl);
    item.affixes.push({ id, v: roundTo(scaled, aff ? (aff.dec ?? (aff.scale ? 0 : 1)) : 1) });
  }
  for (const k in def.vals || {}) {
    const [lo, hi] = def.vals[k];
    const dec = def.dec ?? (Math.max(Math.abs(lo), Math.abs(hi)) < 1 ? 2 : Math.max(Math.abs(lo), Math.abs(hi)) < 10 ? 1 : 0);
    item.uv[k] = roundTo(lo + (hi - lo) * rng.next(), dec);
  }
  item.value = itemValue(item);
  return item;
}

export function itemValue(item) {
  const info = RARITY_INFO[item.rarity] || RARITY_INFO.common;
  return Math.round(info.value * goldScale(item.ilvl) * (1 + item.affixes.length * 0.05));
}

export function sellValue(item) {
  return Math.max(1, Math.round(item.value * 0.3));
}

export function buyPrice(item) {
  return Math.round(item.value * (item.rarity === 'unique' ? 1.6 : 1.15));
}

/** Class restriction check */
export function canEquip(item, classId) {
  if (!item) return false;
  if (item.slot === 'weapon' && item.cls && item.cls !== classId) return false;
  if (item.unique) {
    const u = UNIQUES_LIST.find((x) => x.id === item.unique);
    if (u && u.cls && u.cls !== classId) return false;
  }
  return true;
}

export function starterWeapon(classId, uid) {
  const base = WEAPON_BASES[classId][0];
  const item = {
    uid, base: base.id, slot: 'weapon', cls: classId, name: base.name, icon: base.icon, rarity: 'common', ilvl: 1,
    implicit: base.implicit ? { ...base.implicit } : null, affixes: [], power: BASE_WEAPON_POWER,
  };
  item.value = itemValue(item);
  return item;
}

export { ABILITIES };
