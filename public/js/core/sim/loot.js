// Loot: monster drops, chests, ground items, shop.
import { SHOP_SIZE, TEAM_HEROES } from '../constants.js';
import { generateItem, rollRarity, starterWeapon, goldScale, buyPrice } from '../items/itemgen.js';

export const lootMethods = {
  itemCtx(extra = {}) {
    return Object.assign({
      rng: this.rng,
      classes: this.heroes.map((h) => h.classId),
      unlocked: (kind, def) => this.isUnlocked(kind, def),
      uid: () => this.allocItemUid(),
      owned: this.opts.ownedUniques || null,
    }, extra);
  },

  makeStarterWeapon(classId) {
    return starterWeapon(classId, this.allocItemUid());
  },

  partyLuck() {
    let l = 0;
    for (const h of this.heroes) l = Math.max(l, h.S ? h.S.luck : 0);
    return l;
  },

  rollItemFor(table, opts = {}) {
    const rarity = opts.rarity || rollRarity(this.rng, table, this.partyLuck(), this.diff.loot);
    const item = generateItem(this.itemCtx(Object.assign({ ilvl: opts.ilvl ?? this.wave, rarity }, opts)));
    return item;
  },

  dropItem(item, x, z) {
    const pk = this.spawnPickup('item', x, z, { item, ttl: Infinity });
    if (item.rarity === 'unique' || item.rarity === 'legendary') {
      this.snd(item.rarity === 'unique' ? 'dropunique' : 'droplegend', x, z);
    }
    return pk;
  },

  rollMonsterLoot(m) {
    const rng = this.rng;
    const lootMul = this.diff.loot;
    // health orbs
    const orbChance = m.boss ? 0 : m.elite ? 0.6 : 0.035;
    if (rng.chance(orbChance)) {
      const [x, z] = this.randomPointNear(m.x, m.z, 0.2, 1);
      this.spawnPickup('orb', x, z, { ttl: 30 });
    }
    if (m.summoned || m.boss) return;
    const dropChance = m.elite ? 0.38 : 0.02 * lootMul * (1 + this.partyLuck() / 250);
    if (!rng.chance(dropChance)) return;
    const item = this.rollItemFor(m.elite ? 'elite' : 'monster');
    this.dropItem(item, m.x, m.z);
    this.announceDrop(item);
  },

  announceDrop(item) {
    this.stat('loot.' + item.rarity, 1);
    if (item.rarity === 'unique') {
      this.msg(`Objet unique : ${item.name} !`, '#e2b86b', { big: 0 });
      this.stat('unique.' + item.unique, 1);
    } else if (item.rarity === 'legendary') {
      this.msg(`Objet légendaire : ${item.name}`, '#ff9a2a');
    }
  },

  openChest(h, pk) {
    if (!this.pickups.has(pk.id)) return;
    this.removePickup(pk);
    const tier = pk.tier || 'normal';
    this.stat('chests', 1, h.pid);
    if (tier === 'cursed') this.stat('chests.cursed', 1);
    this.fx('chest', { x: pk.x, z: pk.z, tier });
    this.snd('chestopen', pk.x, pk.z);
    const bonus = Math.max(...this.heroes.map((x) => x.flags.chestBonus || 0), 0);
    const drop = (item) => {
      const [x, z] = this.randomPointNear(pk.x, pk.z, 0.8, 2.4);
      this.dropItem(item, x, z);
      this.announceDrop(item);
    };
    if (tier === 'boss') {
      for (const hero of this.heroes) {
        const cls = hero.classId;
        const rarity = this.rng.chance(0.3 + this.partyLuck() / 400) ? 'unique' : 'legendary';
        drop(this.rollItemFor('boss', { rarity, cls, ilvl: this.wave + 1 }));
        for (let i = 0; i < 1 + bonus; i++) drop(this.rollItemFor('chest', { cls, ilvl: this.wave + 1 }));
      }
      const goldEach = 80 * goldScale(this.wave) * this.diff.gold;
      for (const hero of this.heroes) this.addGold(hero, goldEach, true);
      this.fx('gold', { x: pk.x, z: pk.z, big: 1 });
      return;
    }
    const n = (tier === 'cursed' ? this.rng.int(3, 4) : this.rng.int(2, 3)) + bonus;
    for (let i = 0; i < n; i++) drop(this.rollItemFor(tier === 'cursed' ? 'cursed' : 'chest', { ilvl: this.wave + (tier === 'cursed' ? 1 : 0) }));
    const goldEach = (tier === 'cursed' ? 40 : 20) * goldScale(this.wave) * this.diff.gold;
    for (const hero of this.heroes) this.addGold(hero, goldEach, true);
    if (tier === 'cursed') {
      this.msg('Le coffre était maudit ! Une embuscade surgit !', '#c58cff', { big: 1 });
      const pool = ['skeleton', 'ghoul', 'spider', 'demon', 'wraith', 'knight'].filter((id) => {
        const minW = { skeleton: 1, ghoul: 3, spider: 6, demon: 18, wraith: 11, knight: 22 }[id];
        return minW <= this.wave + 2;
      });
      const count = 2 + Math.floor(this.wave / 8) + (this.connectedCount() - 1);
      for (let i = 0; i < count; i++) {
        const [x, z] = this.randomPointNear(pk.x, pk.z, 3, 6);
        this.spawnMonster(this.rng.pick(pool), x, z, { elite: i === 0, spawnT: 1.0 });
      }
      if (this.phase !== 'wave') this.ambushInPrep = true;
    }
  },

  pickupItem(h, pickId) {
    const pk = this.pickups.get(pickId);
    if (!pk || pk.kind !== 'item' || !h.alive || h.downed) return false;
    const dx = pk.x - h.x, dz = pk.z - h.z;
    if (dx * dx + dz * dz > 4.2 * 4.2) {
      this.events.push({ e: 'msg', s: 'Trop loin pour ramasser cet objet', c: '#aaa', to: h.pid });
      return false;
    }
    const idx = h.inv.indexOf(null);
    if (idx < 0) {
      this.events.push({ e: 'msg', s: 'Inventaire plein !', c: '#ff7070', to: h.pid });
      return false;
    }
    h.inv[idx] = pk.item;
    this.removePickup(pk);
    h.stateDirty = true;
    h.run.itemsFound++;
    this.snd('pickup', h.x, h.z);
    this.events.push({ e: 'got', pid: h.pid, it: { n: pk.item.name, r: pk.item.rarity } });
    if (pk.item.unique) this.stat('found.unique.' + pk.item.unique, 1, h.pid);
    return true;
  },

  // ---------------------------------------------------------------------------
  // Shop
  // ---------------------------------------------------------------------------
  generateShop(h) {
    const ilvl = this.wave + 1;
    const offers = [];
    for (let i = 0; i < SHOP_SIZE; i++) {
      const opts = { ilvl, cls: h.classId };
      if (i === 0) opts.slot = 'weapon';
      const rarity = rollRarity(this.rng, 'shop', h.S ? h.S.luck : 0, 1);
      const item = generateItem(this.itemCtx(Object.assign(opts, { rarity, classes: [h.classId] })));
      offers.push({ item, price: buyPrice(item), sold: false });
    }
    return offers;
  },

  shopRerollCost(h) {
    return Math.round(15 * goldScale(this.wave) * (1 + (h.shopRerolls || 0)));
  },

  tomeCost(h) {
    return Math.round(120 * goldScale(this.wave) * Math.pow(1.6, h.tomesBought || 0));
  },

  potionCost() {
    return Math.round(35 * goldScale(this.wave));
  },

  talentRerollCost(h) {
    return Math.round(12 * goldScale(this.wave) * (1 + (h.choice ? h.choice.rerolls : 0)));
  },
};

export { TEAM_HEROES };
