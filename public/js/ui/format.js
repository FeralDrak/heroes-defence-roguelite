// Text/HTML formatting of items, abilities, talents, rewards.
import { esc } from './dom.js';
import { fmtNum } from '../core/util/math.js';
import { fmtStatLine, STAT_DEFS, TYPE_STAT } from '../core/data/stats.js';
import {
  ITEM_RARITY_NAMES, ITEM_RARITY_COLORS, SLOT_NAMES, TALENT_RARITY_NAMES, TALENT_RARITY_COLORS, TALENT_RARITIES, DMG_TYPE_NAMES,
} from '../core/constants.js';
import { ABILITIES, CLASSES } from '../core/data/classes/index.js';
import { ASPECTS } from '../core/data/aspects.js';
import { UNIQUES } from '../core/data/uniques.js';
import { TALENTS, talentText, talentValsAt } from '../core/data/talents.js';
import { DIFFICULTIES } from '../core/data/difficulty.js';
import { ARENAS } from '../core/data/arenas.js';
import { WEAPON_BASES, ARMOR_BASES } from '../core/data/items.js';
import { sellValue } from '../core/items/itemgen.js';

export function fillDesc(desc, vals, decimals = null) {
  return String(desc).replace(/\{(\w+)\}/g, (_, k) => {
    const v = vals ? vals[k] : undefined;
    if (v === undefined) return '?';
    const r = decimals !== null ? Number(v).toFixed(decimals) : (Math.round(v * 100) / 100).toString();
    return r.replace('.', ',');
  });
}

export function affixLine(a) {
  if (a.id === 'abil') {
    const ab = ABILITIES[a.ab];
    return `+${Math.round(a.v)}% dégâts de ${ab ? ab.name : a.ab}`;
  }
  return fmtStatLine(a.id, a.v);
}

export function baseName(item) {
  if (item.slot === 'weapon') {
    for (const list of Object.values(WEAPON_BASES)) { const b = list.find((x) => x.id === item.base); if (b) return b.name; }
  } else {
    const list = ARMOR_BASES[item.slot] || [];
    const b = list.find((x) => x.id === item.base);
    if (b) return b.name;
  }
  return SLOT_NAMES[item.slot] || '';
}

/** Aggregated numeric stats of an item for comparisons */
export function itemStatMap(item) {
  const m = {};
  if (!item) return m;
  if (item.power) m.power = item.power;
  if (item.armor) m.armor = (m.armor || 0) + item.armor;
  if (item.implicit) for (const k in item.implicit) m[k] = (m[k] || 0) + item.implicit[k];
  for (const a of item.affixes || []) {
    const k = a.id === 'abil' ? 'abil:' + a.ab : a.id;
    m[k] = (m[k] || 0) + a.v;
  }
  return m;
}

function cmpLabel(k) {
  if (k === 'power') return "Dégâts de l'arme";
  if (k.startsWith('abil:')) { const ab = ABILITIES[k.slice(5)]; return `% dégâts de ${ab ? ab.name : '?'}`; }
  return STAT_DEFS[k] ? STAT_DEFS[k].name : k;
}

export function itemTooltip(item, opts = {}) {
  if (!item) return '';
  const color = ITEM_RARITY_COLORS[item.rarity];
  const parts = [];
  if (opts.equippedLabel) parts.push(`<div class="tt-equipped">Équipé</div>`);
  parts.push(`<div class="tt-name" style="color:${color}">${esc(item.icon || '')} ${esc(item.name)}</div>`);
  const cls = item.cls ? CLASSES[item.cls] : (item.unique && UNIQUES[item.unique] && UNIQUES[item.unique].cls ? CLASSES[UNIQUES[item.unique].cls] : null);
  const typeLine = [ITEM_RARITY_NAMES[item.rarity], item.rarity === 'rare' && item.baseName ? item.baseName : baseName(item), SLOT_NAMES[item.slot]]
    .filter((x, i, arr) => x && arr.indexOf(x) === i).join(' · ');
  parts.push(`<div class="tt-type">${esc(typeLine)} — niveau d'objet ${item.ilvl}</div>`);
  if (item.power) parts.push(`<div class="tt-main">${fmtNum(item.power)} dégâts de l'arme</div>`);
  if (item.armor) parts.push(`<div class="tt-main">${fmtNum(item.armor)} armure</div>`);
  if (item.implicit && Object.keys(item.implicit).length) {
    for (const [k, v] of Object.entries(item.implicit)) parts.push(`<div class="tt-imp">${esc(fmtStatLine(k, v))}</div>`);
  }
  if (item.affixes && item.affixes.length) {
    parts.push('<div class="tt-sep"></div>');
    for (const a of item.affixes) parts.push(`<div class="tt-aff">${esc(affixLine(a))}</div>`);
  }
  if (item.aspect) {
    const asp = ASPECTS[item.aspect.id];
    if (asp) {
      parts.push('<div class="tt-sep"></div>');
      parts.push(`<div class="tt-asp">✦ ${esc(fillDesc(asp.desc, item.aspect.v))}</div>`);
    }
  }
  if (item.unique) {
    const u = UNIQUES[item.unique];
    if (u) {
      parts.push('<div class="tt-sep"></div>');
      parts.push(`<div class="tt-uni">★ ${esc(fillDesc(u.desc, item.uv || {}))}</div>`);
      if (u.lore) parts.push(`<div class="tt-lore">« ${esc(u.lore)} »</div>`);
    }
  }
  if (cls) {
    const bad = opts.classId && opts.classId !== cls.id;
    parts.push(`<div class="${bad ? 'tt-req' : 'tt-imp'}" style="margin-top:6px">${bad ? '✖ ' : ''}${esc(cls.name)} uniquement</div>`);
  }
  if (opts.compare !== undefined) {
    const lines = compareLines(item, opts.compare);
    if (lines) parts.push('<div class="tt-sep"></div>', `<div class="tt-cmp">${opts.compare ? 'Par rapport à l\'objet équipé :' : 'Emplacement vide :'}<br>${lines}</div>`);
  }
  if (opts.price) parts.push(`<div class="tt-price">Prix : ${fmtNum(opts.price)} or</div>`);
  if (opts.sell) parts.push(`<div class="tt-price">Revente : ${fmtNum(sellValue(item))} or</div>`);
  if (opts.hint) parts.push(`<div class="tt-lore" style="margin-top:4px">${esc(opts.hint)}</div>`);
  return parts.join('');
}

function compareLines(item, other) {
  const a = itemStatMap(item), b = itemStatMap(other);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out = [];
  for (const k of keys) {
    const d = (a[k] || 0) - (b[k] || 0);
    if (Math.abs(d) < 0.05) continue;
    const isPct = STAT_DEFS[k] && (STAT_DEFS[k].fmt === 'pct' || STAT_DEFS[k].fmt === 'pctf');
    const val = isPct || k.startsWith('abil:') ? `${d > 0 ? '+' : ''}${Math.round(d * 10) / 10}%` : `${d > 0 ? '+' : ''}${fmtNum(d)}`;
    out.push(`<span class="${d > 0 ? 'up' : 'down'}">${val} ${esc(cmpLabel(k))}</span>`);
  }
  if ((item.aspect || item.unique) && !(other && (other.aspect || other.unique))) out.push('<span class="up">+ pouvoir spécial</span>');
  if (!(item.aspect || item.unique) && other && (other.aspect || other.unique)) out.push('<span class="down">− pouvoir spécial perdu</span>');
  return out.slice(0, 12).join('<br>');
}

/** Damage estimator for ability descriptions */
export function damageFormatter(stats, abId) {
  const ab = ABILITIES[abId];
  return (coef) => {
    if (!stats || !stats.S) return `${Math.round(coef * 100)}%`;
    const S = stats.S;
    const type = ab ? ab.dmgType : 'phys';
    const P = stats.P && stats.P[abId];
    const inc = (S.dmgPct || 0) + (S[TYPE_STAT[type]] || 0) + (P && P.dmg ? P.dmg : 0);
    const v = coef * S.power * (stats.levelMul || 1) * Math.max(0.05, 1 + inc / 100) * (S.more || 1);
    return `<b class="gold">${fmtNum(v)}</b>`;
  };
}

export function abilityTooltip(abId, stats, keyLabel) {
  const ab = ABILITIES[abId];
  if (!ab) return '';
  const P = stats && stats.P ? stats.P[abId] : ab.p;
  const d = damageFormatter(stats, abId);
  let desc = '';
  try { desc = ab.desc(P || ab.p, d); } catch { desc = ''; }
  const cd = P && (P.cd || P.interval);
  const parts = [`<div class="tt-name" style="color:#ffd979">${esc(ab.icon)} ${esc(ab.name)}${keyLabel ? ` <span class="keycap">${esc(keyLabel)}</span>` : ''}</div>`];
  parts.push(`<div class="tt-type">${slotLabel(ab.slot)} · dégâts ${esc(DMG_TYPE_NAMES[ab.dmgType] || '')}</div>`);
  parts.push(`<div>${desc}</div>`);
  if (cd) parts.push(`<div class="tt-imp" style="margin-top:6px">${ab.slot === 'primary' ? 'Cadence' : 'Recharge'} : ${(Math.round(cd * 100) / 100).toString().replace('.', ',')} s</div>`);
  return parts.join('');
}

export function slotLabel(slot) {
  return { primary: 'Attaque principale', secondary: 'Compétence secondaire', skill1: 'Compétence', skill2: 'Compétence', ultimate: 'Ultime', dash: 'Esquive' }[slot] || '';
}

export function talentCardText(id, rarity) {
  const def = TALENTS[id];
  if (!def) return '';
  return talentText(def, talentValsAt(def, rarity));
}

export function talentTooltip(id, picks) {
  const def = TALENTS[id];
  if (!def) return '';
  const v = {};
  for (const k in def.vals) v[k] = picks.reduce((s, r) => s + def.vals[k][r], 0);
  const best = Math.max(...picks);
  return `<div class="tt-name" style="color:${TALENT_RARITY_COLORS[TALENT_RARITIES[best]]}">${esc(def.icon)} ${esc(def.name)}</div>
    <div class="tt-type">${picks.length} / ${def.max} rang(s)${def.cls ? ' · ' + esc(CLASSES[def.cls].name) : ''}</div>
    <div>${esc(talentText(def, v))}</div>`;
}

export function rewardText(r) {
  switch (r.type) {
    case 'class': return `Classe : ${CLASSES[r.id] ? CLASSES[r.id].name : r.id}`;
    case 'unique': return `Objet unique : ${UNIQUES[r.id] ? UNIQUES[r.id].name : r.id}`;
    case 'aspect': return `Aspect légendaire ${ASPECTS[r.id] ? ASPECTS[r.id].name : r.id}`;
    case 'talent': return `Talent : ${TALENTS[r.id] ? TALENTS[r.id].name : r.id}`;
    case 'difficulty': return `Difficulté : ${DIFFICULTIES[r.id] ? DIFFICULTIES[r.id].name : r.id}`;
    case 'arena': return `Arène : ${ARENAS[r.id] ? ARENAS[r.id].name : r.id}`;
    default: return r.id;
  }
}

export function rewardIcon(r) {
  switch (r.type) {
    case 'class': return CLASSES[r.id] ? CLASSES[r.id].icon : '🎭';
    case 'unique': return UNIQUES[r.id] ? UNIQUES[r.id].icon : '💎';
    case 'aspect': return '🟠';
    case 'talent': return TALENTS[r.id] ? TALENTS[r.id].icon : '⭐';
    case 'difficulty': return DIFFICULTIES[r.id] ? DIFFICULTIES[r.id].icon : '💀';
    case 'arena': return ARENAS[r.id] ? ARENAS[r.id].icon : '🏛️';
    default: return '🎁';
  }
}

export function uniqueTooltip(u, state) {
  const parts = [`<div class="tt-name" style="color:#e2b86b">${esc(u.icon)} ${esc(u.name)}</div>`];
  parts.push(`<div class="tt-type">Unique · ${esc(SLOT_NAMES[u.slot])}${u.cls ? ' · ' + esc(CLASSES[u.cls].name) : ''}</div>`);
  if (u.affixes) for (const [k, lo, hi] of u.affixes) parts.push(`<div class="tt-aff">${esc(fmtStatLine(k, lo).replace(/[\d,.]+/, `${lo}–${hi}`))}</div>`);
  const vals = {};
  for (const k in u.vals || {}) vals[k] = `${u.vals[k][0]}–${u.vals[k][1]}`;
  parts.push('<div class="tt-sep"></div>');
  parts.push(`<div class="tt-uni">★ ${esc(u.desc.replace(/\{(\w+)\}/g, (_, k) => vals[k] ?? '?'))}</div>`);
  if (u.lore) parts.push(`<div class="tt-lore">« ${esc(u.lore)} »</div>`);
  if (state) parts.push(`<div class="tt-imp" style="margin-top:6px">${esc(state)}</div>`);
  return parts.join('');
}

export function aspectTooltip(a, state) {
  const vals = {};
  for (const k in a.vals || {}) vals[k] = `${a.vals[k][0]}–${a.vals[k][1]}`;
  return `<div class="tt-name" style="color:#ff9a2a">Aspect ${esc(a.name)}</div>
    <div class="tt-type">Pouvoir légendaire (apparaît sur les objets légendaires)</div>
    <div class="tt-asp">✦ ${esc(a.desc.replace(/\{(\w+)\}/g, (_, k) => vals[k] ?? '?'))}</div>
    ${state ? `<div class="tt-imp" style="margin-top:6px">${esc(state)}</div>` : ''}`;
}

export { TALENT_RARITY_NAMES, TALENT_RARITY_COLORS, TALENT_RARITIES, ITEM_RARITY_COLORS, ITEM_RARITY_NAMES };
