// In-game panels: inventory/character, shop, talents, achievements, menu, end screen.
import { h, clear, esc, fmtInt, fmtTime } from './dom.js';
import { tooltip, contextMenu } from './tooltip.js';
import { itemTooltip, talentCardText, talentTooltip, rewardText, rewardIcon, abilityTooltip } from './format.js';
import { renderAchievements } from './screens.js';
import {
  PHASE, EQUIP_SLOTS, SLOT_NAMES, TALENT_RARITIES, TALENT_RARITY_NAMES, TALENT_RARITY_COLORS, ITEM_RARITY_COLORS,
} from '../core/constants.js';
import { CLASSES, ABILITIES } from '../core/data/classes/index.js';
import { TALENTS } from '../core/data/talents.js';
import { ACHIEVEMENTS_BY_ID } from '../core/data/achievements.js';
import { canEquip, sellValue } from '../core/items/itemgen.js';
import { RemoteProfile } from '../profile/profile.js';
import { fmtNum } from '../core/util/math.js';

const RANK = { common: 0, magic: 1, rare: 2, legendary: 3, unique: 4 };
const SLOT_PH = { weapon: '⚔️', helm: '⛑️', chest: '🛡️', gloves: '🧤', boots: '👢', amulet: '📿', ring1: '💍', ring2: '💍' };
const DOLL = [[null, 'helm', 'amulet'], ['weapon', 'chest', 'gloves'], ['ring1', 'boots', 'ring2']];

function itemScore(it) { return it ? RANK[it.rarity] * 100 + it.ilvl : -1; }

export class Panels {
  constructor(view) {
    this.view = view;
    this.app = view.app;
    this.session = view.session;
    this.root = document.getElementById('panels');
    clear(this.root);
    this.open = new Set();
    this.els = {};
    this.dragFrom = null;
  }

  isOpen(name) { return this.open.has(name); }
  anyModal() { return this.open.has('talents') || this.open.has('menu') || this.open.has('achievements') || this.open.has('end'); }

  toggle(name) {
    if (this.open.has(name)) this.close(name);
    else this.show(name);
  }

  show(name) {
    if (name === 'shop' && (!this.session.gs || this.session.gs.phase !== PHASE.PREP)) {
      this.view.hud.pushFeed('La boutique est fermée pendant les vagues.', '#ff9a8a');
      return;
    }
    if (['talents', 'menu', 'achievements'].includes(name)) {
      for (const n of ['talents', 'menu', 'achievements']) if (n !== name) this.close(n);
    }
    this.open.add(name);
    if (name === 'shop') this.open.add('inventory');
    this.renderAll();
    this.app.audio.play('equip', null, null, 0.4);
    this.view.updatePause();
  }

  close(name) {
    if (!this.open.has(name)) return;
    this.open.delete(name);
    if (this.els[name]) { this.els[name].remove(); delete this.els[name]; }
    if (name === 'inventory' && this.open.has('shop')) this.close('shop');
    tooltip.hide();
    this.view.updatePause();
  }

  closeAll() {
    for (const n of [...this.open]) if (n !== 'end') this.close(n);
  }

  renderAll() {
    for (const n of this.open) this.render(n);
  }

  /** Called when relevant state changed */
  refresh(kind) {
    if (kind === 'items') {
      if (this.open.has('inventory')) this.render('inventory');
      if (this.open.has('shop')) this.render('shop');
      if (this.open.has('talents')) this.render('talents');
    } else if (kind === 'phase') {
      const gs = this.session.gs;
      if (gs && gs.phase !== PHASE.PREP && this.open.has('shop')) this.close('shop');
      if (this.open.has('talents')) this.render('talents');
    } else if (kind === 'stats') {
      if (this.open.has('inventory')) this.renderStatsOnly();
    }
  }

  mountPanel(name, el) {
    if (this.els[name]) this.els[name].replaceWith(el);
    else this.root.appendChild(el);
    this.els[name] = el;
  }

  render(name) {
    switch (name) {
      case 'inventory': return this.renderInventory();
      case 'shop': return this.renderShop();
      case 'talents': return this.renderTalents();
      case 'achievements': return this.renderAchievementsPanel();
      case 'menu': return this.renderMenu();
      default: return null;
    }
  }

  head(title, name) {
    return h('div.panel-head', {}, h('h2', { text: title }), h('span.close-x', { onclick: () => this.close(name), text: '×' }));
  }

  // ===========================================================================
  // Inventory
  // ===========================================================================
  itemSlotEl(item, ref, opts = {}) {
    const classId = this.session.me() ? this.session.me().classId : null;
    const el = h('div.item-slot' + (item ? '.r-' + item.rarity : '.empty'), { draggable: !!item });
    if (item) {
      el.appendChild(h('span', { text: item.icon || '❔' }));
      el.appendChild(h('span.ilvl', { text: String(item.ilvl) }));
      if (!canEquip(item, classId)) el.classList.add('invalid');
      if (opts.upgrade) el.classList.add('upgrade');
    } else {
      el.appendChild(h('span.ph', { text: opts.placeholder || '' }));
    }
    const items = this.session.myItems();
    tooltip.bind(el, () => {
      if (!item) return opts.slotName ? `<b>${esc(opts.slotName)}</b><br><span class="muted">Emplacement vide</span>` : '';
      if (ref.k === 'eq') return itemTooltip(item, { classId, equippedLabel: true, sell: false });
      const eqSlot = item.slot === 'ring' ? 'ring1' : item.slot;
      let other = items ? items.equip[eqSlot] : null;
      if (item.slot === 'ring' && items) {
        const r1 = items.equip.ring1, r2 = items.equip.ring2;
        other = !r1 ? null : !r2 ? null : (itemScore(r1) <= itemScore(r2) ? r1 : r2);
      }
      return itemTooltip(item, { classId, compare: canEquip(item, classId) ? other : undefined, sell: this.open.has('shop'), hint: this.open.has('shop') ? 'Clic : équiper · Maj+clic : vendre · Clic droit : actions' : 'Clic : équiper · Clic droit : actions' });
    });
    el.addEventListener('click', (e) => {
      if (!item) return;
      tooltip.hide();
      if (ref.k === 'inv') {
        if (e.shiftKey && this.open.has('shop')) this.session.action({ t: 'sell', i: ref.i });
        else this.session.action({ t: 'equip', i: ref.i });
      } else this.session.action({ t: 'unequip', s: ref.s });
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!item) return;
      tooltip.hide();
      const menu = [];
      if (ref.k === 'inv') {
        if (canEquip(item, classId)) menu.push({ label: 'Équiper', action: () => this.session.action({ t: 'equip', i: ref.i }) });
        if (this.open.has('shop')) menu.push({ label: `Vendre (${fmtNum(sellValue(item))} or)`, action: () => this.session.action({ t: 'sell', i: ref.i }) });
      } else {
        menu.push({ label: 'Retirer', action: () => this.session.action({ t: 'unequip', s: ref.s }) });
      }
      menu.push({ label: 'Jeter au sol (donner)', action: () => this.session.action({ t: 'drop', from: ref }) });
      contextMenu(e.clientX, e.clientY, menu);
    });
    // drag & drop
    el.addEventListener('dragstart', (e) => {
      this.dragFrom = ref;
      tooltip.hide();
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'item');
    });
    el.addEventListener('dragend', () => { this.dragFrom = null; });
    el.addEventListener('dragover', (e) => { if (this.dragFrom) { e.preventDefault(); el.classList.add('drag-over'); } });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drag-over');
      const from = this.dragFrom;
      this.dragFrom = null;
      if (!from) return;
      if (from.k === ref.k && from.i === ref.i && from.s === ref.s) return;
      this.session.action({ t: 'move', from, to: ref });
    });
    return el;
  }

  renderInventory() {
    const items = this.session.myItems();
    const me = this.session.me();
    const el = h('div.panel.ig-panel.left', { style: { width: '640px' } });
    el.appendChild(this.head('Inventaire', 'inventory'));
    const body = h('div.panel-body');
    el.appendChild(body);
    if (!items || !me) { body.appendChild(h('div.muted', { text: 'Chargement…' })); this.mountPanel('inventory', el); return; }
    const cls = CLASSES[me.classId];
    const doll = h('div.paperdoll');
    for (const row of DOLL) {
      for (const slot of row) {
        if (!slot) { doll.appendChild(h('div')); continue; }
        doll.appendChild(this.itemSlotEl(items.equip[slot], { k: 'eq', s: slot }, { placeholder: SLOT_PH[slot], slotName: SLOT_NAMES[slot] }));
      }
    }
    const statsBox = h('div.stat-list');
    this.statsBox = statsBox;
    this.fillStats(statsBox);
    const bag = h('div.bag');
    items.inv.forEach((it, i) => {
      let upgrade = false;
      if (it && canEquip(it, me.classId)) {
        if (it.slot === 'ring') upgrade = itemScore(it) > Math.min(itemScore(items.equip.ring1), itemScore(items.equip.ring2));
        else upgrade = itemScore(it) > itemScore(items.equip[it.slot]);
      }
      bag.appendChild(this.itemSlotEl(it, { k: 'inv', i }, { upgrade }));
    });
    // drop zone (drag an item here to throw it on the ground)
    const dropZone = h('div.service', { style: { marginTop: '10px' } }, h('div.si', { text: '👇' }), h('div', { text: 'Glisser ici pour jeter au sol (donner à un allié)' }));
    dropZone.addEventListener('dragover', (e) => { if (this.dragFrom) e.preventDefault(); });
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); if (this.dragFrom) this.session.action({ t: 'drop', from: this.dragFrom }); this.dragFrom = null; });
    body.appendChild(h('div.inv-wrap', {},
      h('div', {}, h('div.center', { style: { marginBottom: '8px' } }, h('b.gold', { text: `${cls.icon} ${me.name}` }), h('div.small.muted', { text: cls.name })), doll, statsBox),
      h('div', {},
        h('div.row', { style: { marginBottom: '8px' } }, h('h3', { text: 'Sac', style: { margin: 0 } }), h('div.spacer'), h('button.btn.small', { onclick: () => this.session.action({ t: 'sort' }), text: 'Trier' })),
        bag, dropZone,
        h('div.small.muted', { style: { marginTop: '8px' }, text: 'Clic : équiper/retirer · Clic droit : actions · Glisser-déposer pour réorganiser.' }))));
    this.mountPanel('inventory', el);
  }

  fillStats(box) {
    clear(box);
    const st = this.session.myStats();
    if (!st) return;
    const S = st.S;
    const rows = [
      ['PV max', fmtNum(S.maxHp)], ['Armure', fmtNum(S.armor)], ['Résistance', `${Math.round(S.res)}%`], ['Esquive', `${(S.dodge).toFixed(1)}%`],
      ["Dégâts de l'arme", fmtNum(S.power)], ['Dégâts', `+${Math.round(S.dmgPct)}%`], ['Critique', `${(S.critChance).toFixed(1)}%`], ['Dégâts critiques', `×${(S.critMult).toFixed(2)}`],
      ["Vitesse d'attaque", `+${Math.round(S.atkSpd)}%`], ['Recharge', `-${Math.round(S.cdr)}%`], ['Zone', `+${Math.round(S.area)}%`], ['Vol de vie', `${(S.lifeSteal).toFixed(1)}%`],
      ['Régénération', `${(S.regen).toFixed(1)}/s`], ['Vitesse', (S.moveSpeed).toFixed(2)], ['Serviteurs', `+${Math.round(S.summonDmg)}%`], ['Or / Magie', `+${Math.round(S.goldFind)}% / +${Math.round(S.luck)}%`],
    ];
    for (const [l, v] of rows) { box.appendChild(h('div', { text: l })); box.appendChild(h('div.sv', { text: v })); }
  }

  renderStatsOnly() { if (this.statsBox) this.fillStats(this.statsBox); }

  // ===========================================================================
  // Shop
  // ===========================================================================
  renderShop() {
    const items = this.session.myItems();
    const hd = this.view.world.myHeroData();
    const el = h('div.panel.ig-panel.right', { style: { width: '430px' } });
    el.appendChild(this.head('Boutique', 'shop'));
    const body = h('div.panel-body');
    el.appendChild(body);
    if (!items || !items.shop) { body.appendChild(h('div.muted', { text: 'Fermée.' })); this.mountPanel('shop', el); return; }
    const gold = hd ? hd.gold : 0;
    const me = this.session.me();
    body.appendChild(h('div.row', {}, h('div.gold', { style: { fontWeight: 800, fontSize: '16px' }, text: `💰 ${fmtInt(gold)} or` }), h('div.spacer'), h('div.small.muted', { text: `Objets de niveau ${this.session.gs ? this.session.gs.wave + 1 : ''}` })));
    const grid = h('div.shop-grid', { style: { marginTop: '10px' } });
    items.shop.forEach((o, i) => {
      const it = o.item;
      const slotEl = h('div.item-slot.r-' + it.rarity, {}, h('span', { text: it.icon }), h('span.ilvl', { text: String(it.ilvl) }));
      if (!canEquip(it, me.classId)) slotEl.classList.add('invalid');
      const eqSlot = it.slot === 'ring' ? 'ring1' : it.slot;
      tooltip.bind(slotEl, () => itemTooltip(it, { classId: me.classId, compare: canEquip(it, me.classId) ? items.equip[eqSlot] : undefined, price: o.price }));
      const offer = h('div.offer' + (o.sold ? '.sold' : ''), {},
        slotEl,
        h('div.oname', { text: it.name, style: { color: ITEM_RARITY_COLORS[it.rarity] } }),
        h('div.price' + (o.price > gold ? '.no' : ''), { text: o.sold ? 'Vendu' : `${fmtInt(o.price)} or` }));
      if (!o.sold) {
        offer.style.cursor = 'pointer';
        offer.addEventListener('click', () => { tooltip.hide(); this.session.action({ t: 'buy', i }); });
      }
      grid.appendChild(offer);
    });
    body.appendChild(grid);
    const c = items.costs;
    const service = (icon, title, price, desc, act) => {
      const s = h('div.service', { onclick: () => this.session.action({ t: act }) }, h('div.si', { text: icon }), h('div', { text: title }), h('div.sp', { text: `${fmtInt(price)} or` }));
      tooltip.bind(s, () => `<b>${esc(title)}</b><br>${esc(desc)}`);
      return s;
    };
    body.appendChild(h('div.services', {},
      service('🎲', 'Relancer', c.reroll, 'Remplace les objets proposés. Le prix augmente à chaque relance.', 'reroll'),
      service('📖', 'Tome de savoir', c.tome, 'Octroie immédiatement un choix de talent supplémentaire. Le prix augmente à chaque achat.', 'tome'),
      service('🧪', 'Potion +1', c.potion, 'Une charge de potion supplémentaire pour la prochaine vague (2 max par vague).', 'potion')));
    const sellZone = h('div.service', { style: { marginTop: '10px' } }, h('div.si', { text: '💰' }), h('div', { text: 'Glisser un objet ici pour le vendre' }));
    sellZone.addEventListener('dragover', (e) => { if (this.dragFrom && this.dragFrom.k === 'inv') e.preventDefault(); });
    sellZone.addEventListener('drop', (e) => { e.preventDefault(); if (this.dragFrom && this.dragFrom.k === 'inv') this.session.action({ t: 'sell', i: this.dragFrom.i }); this.dragFrom = null; });
    body.appendChild(sellZone);
    body.appendChild(h('div.small.muted', { style: { marginTop: '8px' }, text: 'Maj+clic sur un objet du sac pour le vendre (30% de sa valeur).' }));
    this.mountPanel('shop', el);
  }

  // ===========================================================================
  // Talents
  // ===========================================================================
  renderTalents() {
    const items = this.session.myItems();
    const hd = this.view.world.myHeroData();
    const gs = this.session.gs;
    const me = this.session.me();
    const wrap = h('div.talent-modal', { onclick: (e) => { if (e.target === wrap) this.close('talents'); } });
    const inner = h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', maxWidth: '96vw' } });
    wrap.appendChild(inner);
    const pending = hd ? hd.pending : 0;
    const prep = gs && (gs.phase === PHASE.PREP || gs.phase === PHASE.VICTORY);
    inner.appendChild(h('h2', { style: { fontSize: '28px', textShadow: '0 2px 8px #000' }, text: pending ? `Montée de niveau — ${pending} choix` : 'Talents' }));
    if (pending && items && items.choice) {
      if (!prep) inner.appendChild(h('div.warn', { text: 'Les talents se choisissent entre les vagues. Survivez !' }));
      const cards = h('div.talent-cards');
      items.choice.options.forEach((opt, i) => {
        const def = TALENTS[opt.id];
        if (!def) return;
        const rar = TALENT_RARITIES[opt.r];
        const color = TALENT_RARITY_COLORS[rar];
        const have = items.talents[opt.id] ? items.talents[opt.id].length : 0;
        const card = h('div.tcard', { style: { '--tc': color }, onclick: () => { if (prep) this.session.action({ t: 'talent', i }); } },
          h('div.ticon', { text: def.icon }),
          h('div.trar', { text: TALENT_RARITY_NAMES[rar] }),
          h('div.tname', { text: def.name }),
          def.cls ? h('div.tcls', { text: CLASSES[def.cls].name }) : h('div.tcls', { text: 'Général' }),
          h('div.tdesc', { text: talentCardText(opt.id, opt.r) }),
          h('div.tstack', { text: `Rang ${have} → ${have + 1} / ${def.max}` }));
        if (!prep) card.style.opacity = 0.6;
        cards.appendChild(card);
      });
      inner.appendChild(cards);
      inner.appendChild(h('div.row', {},
        h('button.btn', { disabled: !prep, onclick: () => this.session.action({ t: 'talentReroll' }), text: `🎲 Relancer (${fmtInt(items.costs.talentReroll)} or)` }),
        h('button.btn', { onclick: () => this.close('talents'), text: 'Plus tard' })));
    } else {
      inner.appendChild(h('div.muted', { text: 'Aucun choix en attente. Gagnez des niveaux en tuant des monstres !' }));
    }
    // current talents
    if (items && items.talentOrder && items.talentOrder.length) {
      const list = h('div.talent-list');
      for (const id of items.talentOrder) {
        const def = TALENTS[id];
        const picks = items.talents[id] || [];
        if (!def) continue;
        const best = Math.max(...picks);
        const el = h('div.tl-item', { style: { borderColor: TALENT_RARITY_COLORS[TALENT_RARITIES[best]] } }, h('span', { text: def.icon }), h('span', { text: def.name }), h('span.muted', { text: `×${picks.length}` }));
        tooltip.bind(el, () => talentTooltip(id, picks));
        list.appendChild(el);
      }
      inner.appendChild(h('div.panel', { style: { padding: '12px', maxWidth: '800px' } }, h('h3', { text: 'Talents acquis' }), list));
    }
    // abilities
    if (me) {
      const cls = CLASSES[me.classId];
      const st = this.session.myStats();
      const abl = h('div.row.wrap', { style: { justifyContent: 'center' } });
      cls.abilities.forEach((id, i) => {
        const el = h('div.slot', { style: { width: '46px', height: '46px', fontSize: '22px' } }, h('span', { text: ABILITIES[id].icon }));
        tooltip.bind(el, () => abilityTooltip(id, st, this.view.hud.slotKeyLabel(i)));
        abl.appendChild(el);
      });
      inner.appendChild(abl);
    }
    this.mountPanel('talents', wrap);
  }

  // ===========================================================================
  // Achievements
  // ===========================================================================
  renderAchievementsPanel() {
    const wrap = h('div.talent-modal', { onclick: (e) => { if (e.target === wrap) this.close('achievements'); } });
    const panel = h('div.panel', { style: { width: 'min(1100px, 96vw)', height: '88vh', display: 'flex', flexDirection: 'column' } });
    panel.appendChild(this.head('Succès & collection (profil de l\'hôte)', 'achievements'));
    const body = h('div.panel-body', { style: { flex: 1, overflow: 'auto' } });
    panel.appendChild(body);
    const profile = this.session.local ? this.app.host.profile : (this.session.profileSummary ? new RemoteProfile(this.session.profileSummary) : null);
    if (profile) renderAchievements(body, profile);
    else body.appendChild(h('div.muted', { text: 'Chargement…' }));
    wrap.appendChild(panel);
    this.mountPanel('achievements', wrap);
  }

  // ===========================================================================
  // Menu
  // ===========================================================================
  renderMenu() {
    const app = this.app;
    const isHost = this.session.isHost();
    const wrap = h('div.talent-modal', { onclick: (e) => { if (e.target === wrap) this.close('menu'); } });
    const holder = h('div');
    const main = h('div.panel', { style: { width: '360px' } },
      h('div.panel-head', {}, h('h2', { text: 'Menu' }), h('span.close-x', { onclick: () => this.close('menu'), text: '×' })),
      h('div.panel-body.col', {},
        h('button.btn.primary', { onclick: () => this.close('menu'), text: 'Reprendre' }),
        h('button.btn', { onclick: () => { app.screens.showSettings(() => { clear(holder); holder.appendChild(main); }, holder); }, text: 'Paramètres' }),
        h('button.btn', { onclick: () => { app.screens.showHelp(() => { clear(holder); holder.appendChild(main); }, holder); }, text: 'Comment jouer' }),
        h('button.btn', { onclick: () => { this.close('menu'); this.show('achievements'); }, text: 'Succès & collection' }),
        isHost && this.session.lobby && this.session.lobby.online ? h('div.small.muted.center', { text: `Code de la partie : ${this.session.code}` }) : null,
        isHost ? h('button.btn', { onclick: () => { if (confirm('Terminer la partie et revenir au salon ?')) app.host.endGame(); }, text: 'Terminer la partie (retour au salon)' }) : null,
        h('button.btn.danger', { onclick: () => { if (confirm(isHost ? 'Quitter ? La partie sera fermée pour tous les joueurs.' : 'Quitter la partie ?')) app.leave(); }, text: 'Quitter vers le menu principal' })));
    holder.appendChild(main);
    wrap.appendChild(holder);
    this.mountPanel('menu', wrap);
  }

  // ===========================================================================
  // End screen
  // ===========================================================================
  showEnd(info) {
    this.closeAll();
    this.open.add('end');
    const isHost = this.session.isHost();
    const win = info.result && info.result.win;
    const wrap = h('div.talent-modal.end-screen');
    const panel = h('div.panel', { style: { width: 'min(980px, 96vw)', maxHeight: '92vh', overflow: 'auto', padding: '20px' } });
    panel.appendChild(h('div.end-title' + (win ? '.win' : '.lose'), { text: win ? 'VICTOIRE' : 'DÉFAITE' }));
    panel.appendChild(h('div.center.muted', { style: { marginBottom: '14px' }, text: `${win ? 'Le Dévoreur est tombé' : `Tombés à la vague ${info.wave}`} · durée ${fmtTime(info.time)}` }));
    const table = h('table.end-table');
    table.appendChild(h('tr', {}, ...['Héros', 'Niveau', 'Éliminations', 'Élites', 'Dégâts infligés', 'Dégâts subis', 'Soins', 'Or gagné', 'Chutes'].map((t) => h('th', { text: t }))));
    for (const p of info.players) {
      const c = CLASSES[p.classId];
      const r = p.run;
      table.appendChild(h('tr', {},
        h('td', { text: `${c ? c.icon : ''} ${p.name}` }), h('td', { text: String(p.level) }), h('td', { text: fmtInt(r.kills) }), h('td', { text: fmtInt(r.elites) }),
        h('td', { text: fmtNum(r.dmgDealt) }), h('td', { text: fmtNum(r.dmgTaken) }), h('td', { text: fmtNum(r.healing) }), h('td', { text: fmtInt(r.gold) }), h('td', { text: String(r.deaths) })));
    }
    panel.appendChild(table);
    if (info.achievements && info.achievements.length) {
      panel.appendChild(h('h3', { style: { marginTop: '16px' }, text: `Succès débloqués pendant cette partie (${info.achievements.length})` }));
      const grid = h('div.ach-grid');
      for (const id of info.achievements) {
        const a = ACHIEVEMENTS_BY_ID[id];
        if (!a) continue;
        grid.appendChild(h('div.ach.done', {},
          h('div.ahead', {}, h('div.aic', { text: a.icon }), h('div', {}, h('div.aname', { text: a.name }))),
          h('div.adesc', { text: a.desc }),
          h('div.areward', {}, '🎁 ', a.reward.map((r) => `${rewardIcon(r)} ${rewardText(r)}`).join(' · '))));
      }
      panel.appendChild(grid);
    } else {
      panel.appendChild(h('div.muted.center', { style: { marginTop: '12px' }, text: 'Aucun nouveau succès cette fois-ci. Consultez la liste des succès pour viser les prochains déblocages !' }));
    }
    const actions = h('div.row', { style: { marginTop: '18px', justifyContent: 'center' } });
    if (isHost) {
      if (info.canContinue) actions.appendChild(h('button.btn.primary.big', { onclick: () => { this.session.action({ t: 'endless' }); this.closeEnd(); }, text: '♾️ Continuer en mode infini' }));
      actions.appendChild(h('button.btn.big' + (info.canContinue ? '' : '.primary'), { onclick: () => this.app.host.endGame(), text: '↺ Retour au salon' }));
    } else {
      actions.appendChild(h('div.muted', { text: "En attente de l'hôte…" }));
    }
    actions.appendChild(h('button.btn.danger', { onclick: () => this.app.leave(), text: 'Quitter' }));
    panel.appendChild(actions);
    wrap.appendChild(panel);
    this.mountPanel('end', wrap);
  }

  closeEnd() {
    this.open.delete('end');
    if (this.els.end) { this.els.end.remove(); delete this.els.end; }
  }

  dispose() {
    clear(this.root);
    this.open.clear();
    this.els = {};
    tooltip.hide();
  }
}
