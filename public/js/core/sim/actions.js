// Player-initiated actions (inventory, shop, talents, readiness). All validated on the host.
import { PHASE, EQUIP_SLOTS } from '../constants.js';
import { TALENT_LIST, TALENTS, TALENT_RARITY_WEIGHTS } from '../data/talents.js';
import { canEquip, sellValue } from '../items/itemgen.js';

const RING_SLOTS = ['ring1', 'ring2'];
const isSlot = (s) => typeof s === 'string' && EQUIP_SLOTS.includes(s);
const isInvRef = (h, ref) => ref.k === 'inv' && Number.isInteger(ref.i) && ref.i >= 0 && ref.i < h.inv.length;

export const actionMethods = {
  /** Entry point for UI actions: a = { t: type, ... } */
  handleAction(pid, a) {
    const p = this.players.get(pid);
    if (!p || !a || typeof a.t !== 'string') return;
    const h = p.hero;
    switch (a.t) {
      case 'ready': this.playerReady(pid); break;
      case 'equip': this.equipFromInv(h, a.i | 0, a.s); break;
      case 'unequip': this.unequip(h, a.s); break;
      case 'move': this.moveItem(h, a.from, a.to); break;
      case 'drop': this.dropFrom(h, a.from); break;
      case 'sell': this.sellItem(h, a.i | 0); break;
      case 'buy': this.buyItem(h, a.i | 0); break;
      case 'reroll': this.rerollShop(h); break;
      case 'tome': this.buyTome(h); break;
      case 'potion': this.buyPotion(h); break;
      case 'talent': this.chooseTalent(h, a.i | 0); break;
      case 'talentReroll': this.rerollTalents(h); break;
      case 'pick': this.pickupItem(h, a.id | 0); break;
      case 'sort': this.sortInventory(h); break;
      default: break;
    }
  },

  notify(h, s, c = '#ff7070') {
    this.events.push({ e: 'msg', s, c, to: h.pid });
  },

  // ---------------------------------------------------------------------------
  // Inventory
  // ---------------------------------------------------------------------------
  slotFor(h, item, wanted) {
    if (item.slot === 'ring') {
      if (RING_SLOTS.includes(wanted)) return wanted;
      return !h.equip.ring1 ? 'ring1' : !h.equip.ring2 ? 'ring2' : 'ring1';
    }
    return item.slot;
  },

  equipFromInv(h, idx, wanted) {
    if (idx < 0 || idx >= h.inv.length) return;
    const item = h.inv[idx];
    if (!item) return;
    if (!canEquip(item, h.classId)) { this.notify(h, 'Votre classe ne peut pas équiper cet objet.'); return; }
    const slot = this.slotFor(h, item, wanted);
    const old = h.equip[slot];
    h.equip[slot] = item;
    h.inv[idx] = old || null;
    if (item.rarity !== 'common') this.runFlags.nonCommon = true;
    h.statsDirty = true;
    h.stateDirty = true;
    this.snd('equip', h.x, h.z);
    this.checkEquipStats(h);
  },

  checkEquipStats(h) {
    const eq = Object.values(h.equip).filter(Boolean);
    const leg = eq.filter((it) => it.rarity === 'legendary' || it.rarity === 'unique').length;
    this.statMax('best.legendaryEquipped', leg);
    const uniq = eq.filter((it) => it.rarity === 'unique').length;
    this.statMax('best.uniquesEquipped', uniq);
  },

  unequip(h, slot) {
    if (!isSlot(slot) || !h.equip[slot]) return;
    const idx = h.inv.indexOf(null);
    if (idx < 0) { this.notify(h, 'Inventaire plein !'); return; }
    h.inv[idx] = h.equip[slot];
    h.equip[slot] = null;
    h.statsDirty = true;
    h.stateDirty = true;
  },

  /** from/to: { k: 'inv', i } | { k: 'eq', s } */
  moveItem(h, from, to) {
    if (!from || !to || typeof from !== 'object' || typeof to !== 'object') return;
    const get = (ref) => (ref.k === 'inv' ? h.inv[ref.i] : h.equip[ref.s]);
    const set = (ref, it) => { if (ref.k === 'inv') h.inv[ref.i] = it; else h.equip[ref.s] = it; };
    const valid = (ref) => (ref.k === 'inv' ? isInvRef(h, ref) : isSlot(ref.s));
    if (!valid(from) || !valid(to)) return;
    const a = get(from), b = get(to);
    if (!a) return;
    // equipping into a slot: check compatibility
    const fits = (it, ref) => {
      if (!it) return true;
      if (ref.k === 'inv') return true;
      const slotType = RING_SLOTS.includes(ref.s) ? 'ring' : ref.s;
      return it.slot === slotType && canEquip(it, h.classId);
    };
    if (!fits(a, to) || !fits(b, from)) { this.notify(h, 'Emplacement incompatible.'); return; }
    set(to, a);
    set(from, b || null);
    if (to.k === 'eq' || from.k === 'eq') { h.statsDirty = true; this.checkEquipStats(h); }
    h.stateDirty = true;
  },

  dropFrom(h, from) {
    if (!from || typeof from !== 'object') return;
    let item;
    if (isInvRef(h, from)) { item = h.inv[from.i]; if (item) h.inv[from.i] = null; }
    else if (from.k !== 'inv' && isSlot(from.s)) { item = h.equip[from.s]; if (item) { h.equip[from.s] = null; h.statsDirty = true; } }
    if (!item) return;
    const a = h.rot;
    this.dropItem(item, h.x + Math.cos(a) * 1.4, h.z + Math.sin(a) * 1.4);
    this.stat('items.dropped', 1, h.pid);
    h.stateDirty = true;
  },

  sortInventory(h) {
    const order = { unique: 0, legendary: 1, rare: 2, magic: 3, common: 4 };
    const items = h.inv.filter(Boolean).sort((a, b) => (order[a.rarity] - order[b.rarity]) || (a.slot < b.slot ? -1 : 1) || (b.ilvl - a.ilvl));
    h.inv = h.inv.map((_, i) => items[i] || null);
    h.stateDirty = true;
  },

  // ---------------------------------------------------------------------------
  // Shop (between waves only)
  // ---------------------------------------------------------------------------
  shopOpen(h) {
    if (this.phase !== PHASE.PREP) { this.notify(h, 'La boutique est fermée pendant les vagues.'); return false; }
    return true;
  },

  sellItem(h, idx) {
    if (!this.shopOpen(h)) return;
    const item = h.inv[idx];
    if (!item) return;
    const v = sellValue(item);
    h.inv[idx] = null;
    h.gold += v;
    this.stat('items.sold', 1, h.pid);
    h.run.sold++;
    h.stateDirty = true;
    this.snd('coin', h.x, h.z);
  },

  spend(h, cost) {
    if (h.gold + 1e-6 < cost) { this.notify(h, "Pas assez d'or."); return false; }
    h.gold -= cost;
    this.stat('gold.spent', cost, h.pid);
    h.stateDirty = true;
    return true;
  },

  buyItem(h, i) {
    if (!this.shopOpen(h) || !h.shop) return;
    const offer = h.shop[i];
    if (!offer || offer.sold) return;
    const idx = h.inv.indexOf(null);
    if (idx < 0) { this.notify(h, 'Inventaire plein !'); return; }
    if (!this.spend(h, offer.price)) return;
    offer.sold = true;
    this.runFlags.bought = true;
    h.inv[idx] = offer.item;
    h.run.bought++;
    this.stat('items.bought', 1, h.pid);
    this.stat('loot.' + offer.item.rarity, 1);
    if (offer.item.unique) this.stat('found.unique.' + offer.item.unique, 1, h.pid);
    this.snd('coin', h.x, h.z);
  },

  rerollShop(h) {
    if (!this.shopOpen(h)) return;
    if (!this.spend(h, this.shopRerollCost(h))) return;
    h.shopRerolls = (h.shopRerolls || 0) + 1;
    h.shop = this.generateShop(h);
    this.stat('shop.rerolls', 1, h.pid);
  },

  buyTome(h) {
    if (!this.shopOpen(h)) return;
    if (!this.spend(h, this.tomeCost(h))) return;
    h.tomesBought = (h.tomesBought || 0) + 1;
    this.runFlags.bought = true;
    h.pendingLevels++;
    if (!h.choice) h.choice = this.rollTalentChoice(h);
    this.stat('tomes', 1, h.pid);
    this.snd('levelup', h.x, h.z);
  },

  buyPotion(h) {
    if (!this.shopOpen(h)) return;
    if ((h.potionsBought || 0) >= 2 && h.potionsBoughtWave === this.wave) { this.notify(h, 'Maximum 2 potions supplémentaires par vague.'); return; }
    if (!this.spend(h, this.potionCost())) return;
    if (h.potionsBoughtWave !== this.wave) { h.potionsBoughtWave = this.wave; h.potionsBought = 0; }
    h.potionsBought++;
    this.runFlags.bought = true;
    h.potions++;
    this.snd('coin', h.x, h.z);
  },

  // ---------------------------------------------------------------------------
  // Talents (level-up choices, between waves only)
  // ---------------------------------------------------------------------------
  rollTalentChoice(h, rerolls = 0) {
    const rng = this.rng;
    const n = 3 + Math.round(h.S.talentChoices || 0);
    const minR = Math.min(4, Math.round(h.S.minRarity || 0));
    const pool = TALENT_LIST.filter((t) => (!t.cls || t.cls === h.classId) && this.isUnlocked('talents', t)
      && (!h.talents[t.id] || h.talents[t.id].picks.length < t.max));
    const luck = (h.S.luck || 0) / 100;
    const weights = TALENT_RARITY_WEIGHTS.map((w, i) => w * (1 + luck * i * 0.5));
    const options = [];
    const used = new Set();
    for (let i = 0; i < n; i++) {
      let r = rng.weighted([0, 1, 2, 3, 4], (k) => weights[k]);
      r = Math.max(r, minR);
      let cands = pool.filter((t) => !used.has(t.id) && (t.minR || 0) <= r);
      if (!cands.length) cands = pool.filter((t) => !used.has(t.id));
      if (!cands.length) break;
      // offers are mostly class-related: the first two slots strongly favour class talents
      const classBias = i < 2 ? 4 : 1.5;
      const t = rng.weighted(cands, (x) => (x.cls ? classBias : 1));
      used.add(t.id);
      options.push({ id: t.id, r: Math.max(r, t.minR || 0) });
    }
    return { options, rerolls };
  },

  chooseTalent(h, i) {
    if (this.phase !== PHASE.PREP && this.phase !== PHASE.VICTORY) { this.notify(h, 'Les talents se choisissent entre les vagues.'); return; }
    if (!h.choice || h.pendingLevels <= 0) return;
    const opt = h.choice.options[i];
    if (!opt) return;
    const def = TALENTS[opt.id];
    if (!def) return;
    let t = h.talents[opt.id];
    if (!t) {
      t = h.talents[opt.id] = { picks: [], v: {}, st: {} };
      h.talentOrder.push(opt.id);
    }
    t.picks.push(opt.r);
    for (const k in def.vals) t.v[k] = (t.v[k] || 0) + def.vals[k][opt.r];
    h.pendingLevels--;
    h.choice = h.pendingLevels > 0 ? this.rollTalentChoice(h) : null;
    h.statsDirty = true;
    h.stateDirty = true;
    this.stat('talents', 1, h.pid);
    this.stat('talents.r' + opt.r, 1, h.pid);
    this.statMax('best.talentStacks', t.picks.length);
    this.snd('talent', h.x, h.z);
  },

  rerollTalents(h) {
    if (this.phase !== PHASE.PREP) return;
    if (!h.choice) return;
    if (!this.spend(h, this.talentRerollCost(h))) return;
    h.choice = this.rollTalentChoice(h, (h.choice.rerolls || 0) + 1);
  },
};
