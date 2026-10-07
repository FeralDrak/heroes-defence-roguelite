// In-game HUD: wave banner, party frames, action bar, minimap, feed, chat.
import { h, clear, esc, fmtInt } from './dom.js';
import { tooltip } from './tooltip.js';
import { abilityTooltip } from './format.js';
import { PLAYER_COLORS, PHASE, FINAL_WAVE, UF, ITEM_RARITY_COLORS } from '../core/constants.js';
import { CLASSES, ABILITIES } from '../core/data/classes/index.js';
import { BUFFS } from '../core/data/buffs.js';
import { ARENAS } from '../core/data/arenas.js';
import { DIFFICULTIES } from '../core/data/difficulty.js';
import { fmtNum } from '../core/util/math.js';
import { waveType } from '../core/sim/waves.js';

const SLOT_ACTIONS = [null, null, 'skill1', 'skill2', 'ultimate', 'dash'];

export class Hud {
  constructor(view) {
    this.view = view;
    this.app = view.app;
    this.session = view.session;
    this.root = document.getElementById('hud');
    clear(this.root);
    this.root.classList.remove('hidden');
    this.last = {};
    this.build();
  }

  build() {
    const app = this.app;
    // screen-edge vignette (low HP / damage taken)
    this.vignette = h('div.vignette');
    this.root.appendChild(this.vignette);
    this.pauseEl = h('div.pause-overlay.hidden', {}, h('div.pause-title', { text: 'PAUSE' }), h('div.small', { text: 'Partie en pause — Échap pour reprendre.' }));
    this.root.appendChild(this.pauseEl);
    this.lastHp = null;
    this.hitFlash = 0;
    // wave banner
    this.waveText = h('span.wb-wave');
    this.waveSub = h('span.wb-sub');
    this.countEl = h('div.wb-count');
    this.bossWrap = h('div.boss-bars');
    this.root.appendChild(h('div.wave-banner', {}, h('div.wb-main', {}, this.waveText, this.waveSub), this.countEl, this.bossWrap));
    // party
    this.party = h('div.party');
    this.root.appendChild(this.party);
    // top right
    this.goldEl = h('div.gold-box');
    this.netEl = h('div.netinfo');
    this.minimap = h('canvas.minimap', { width: 340, height: 340 });
    const mkBtn = (icon, action, title, fn) => {
      const b = h('button.hud-btn', { onclick: fn }, icon, h('span.k', { text: app.input.label(action) }));
      tooltip.bind(b, () => `<b>${esc(title)}</b> <span class="keycap">${esc(app.input.label(action))}</span>`);
      return b;
    };
    this.shopBtn = mkBtn('🛒', 'shop', 'Boutique (entre les vagues)', () => this.view.togglePanel('shop'));
    this.root.appendChild(h('div.topright', {},
      h('div.tr-row', {}, this.goldEl,
        mkBtn('🎒', 'inventory', 'Inventaire & personnage', () => this.view.togglePanel('inventory')),
        this.shopBtn,
        mkBtn('⭐', 'talents', 'Talents', () => this.view.togglePanel('talents')),
        mkBtn('🏆', 'achievements', 'Succès', () => this.view.togglePanel('achievements')),
        h('button.hud-btn', { onclick: () => this.view.togglePanel('menu'), text: '☰' })),
      this.minimap, this.netEl));
    // feed
    this.feed = h('div.feed');
    this.root.appendChild(this.feed);
    // chat
    this.chatLines = h('div.lines');
    this.chatInput = h('input.hidden', { type: 'text', maxlength: 200, placeholder: 'Message (Entrée pour envoyer, Échap pour annuler)' });
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const s = this.chatInput.value.trim();
        if (s) this.session.sendJson({ k: 'chat', s });
        this.closeChat();
        e.preventDefault();
      } else if (e.key === 'Escape') { this.closeChat(); e.preventDefault(); }
      e.stopPropagation();
    });
    this.chatBox = h('div.chat-hud', {}, this.chatLines, this.chatInput);
    this.root.appendChild(this.chatBox);
    // prep actions
    this.readyBtn = h('button.btn.primary.ready-btn', { onclick: () => this.session.action({ t: 'ready' }) });
    this.talentAlert = h('div.talent-alert', { onclick: () => this.view.togglePanel('talents') }, '⬆', h('span', { text: 'Choix de talent' }), h('span.n'));
    tooltip.bind(this.talentAlert, () => this.session.gs && this.session.gs.phase === PHASE.WAVE
      ? 'Les talents se choisissent <b>entre les vagues</b>.' : 'Cliquez pour choisir vos bonus de montée de niveau.');
    this.prep = h('div.prep-actions', {}, this.talentAlert, this.readyBtn);
    this.root.appendChild(this.prep);
    // bottom bar
    this.buffs = h('div.buffs');
    this.hpFill = h('div.fill');
    this.hpShield = h('div.shield');
    this.hpText = h('div.txt');
    this.hpOrb = h('div.hp-orb', {}, this.hpFill, this.hpShield, this.hpText);
    tooltip.bind(this.hpOrb, () => this.statsTooltip());
    this.slots = [];
    const abil = h('div.abilities');
    for (let i = 0; i < 6; i++) {
      const s = { el: h('div.slot'), icon: h('span'), key: h('span.key'), cd: h('div.cd'), cdt: h('div.cdt'), ch: h('span.ch') };
      s.el.append(s.icon, s.cd, s.cdt, s.key, s.ch);
      const idx = i;
      tooltip.bind(s.el, () => {
        const cls = this.myClass();
        if (!cls) return '';
        return abilityTooltip(cls.abilities[idx], this.session.myStats(), this.slotKeyLabel(idx));
      });
      abil.appendChild(s.el);
      this.slots.push(s);
    }
    this.potion = { el: h('div.slot.potion'), cnt: h('span.ch'), key: h('span.key') };
    this.potion.el.append(h('span', { text: '🧪' }), this.potion.key, this.potion.cnt);
    tooltip.bind(this.potion.el, () => `<b>Potion de soin</b> <span class="keycap">${esc(this.app.input.label('potion'))}</span><br>Rend 35% des PV max. Les charges se rechargent entre les vagues.`);
    abil.appendChild(this.potion.el);
    this.xpFill = h('div');
    this.lvlEl = h('span.lvl-badge');
    this.xpBar = h('div.xpbar', {}, this.xpFill);
    tooltip.bind(this.xpBar, () => {
      const hd = this.view.world.myHeroData();
      return hd ? `Niveau ${hd.level} — expérience ${fmtInt(hd.xp)} / ${fmtInt(hd.xpNext)}` : '';
    });
    this.root.appendChild(h('div.bottom-bar', {},
      this.buffs,
      h('div.action-row', {}, this.hpOrb, h('div', { style: { display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'stretch' } }, abil, h('div.row', { style: { gap: '6px' } }, this.lvlEl, this.xpBar)))));
  }

  myClass() {
    const me = this.session.me();
    return me ? CLASSES[me.classId] : null;
  }

  slotKeyLabel(i) {
    if (i === 0) return 'Clic G';
    if (i === 1) return 'Clic D';
    return this.app.input.label(SLOT_ACTIONS[i]);
  }

  statsTooltip() {
    const st = this.session.myStats();
    if (!st) return '';
    const S = st.S;
    const row = (l, v) => `<div style="display:flex;justify-content:space-between;gap:14px"><span>${l}</span><b class="gold">${v}</b></div>`;
    const pct = (v) => `${Math.round(v)}%`;
    return `<div class="tt-name" style="color:#ffd979">Caractéristiques</div>
      ${row('PV max', fmtNum(S.maxHp))}${row('Armure', fmtNum(S.armor))}${row('Résistance', pct(S.res))}${row('Esquive', pct(S.dodge))}
      ${row("Dégâts de l'arme", fmtNum(S.power))}${row('Dégâts bonus', pct(S.dmgPct))}${row('Critique', `${Math.round(S.critChance)}% · ×${(S.critMult).toFixed(2)}`)}
      ${row("Vitesse d'attaque", pct(S.atkSpd))}${row('Réduction de recharge', pct(S.cdr))}${row('Vitesse', (S.moveSpeed).toFixed(1))}
      ${row('Vol de vie', pct(S.lifeSteal))}${row('Régénération', `${(S.regen).toFixed(1)}/s`)}`;
  }

  // ---------------------------------------------------------------------------
  update(dt, now) {
    const s = this.session;
    const gs = s.gs;
    const world = this.view.world;
    const hd = world.myHeroData();
    const st = s.myStats();
    const cls = this.myClass();
    this.frameCount = (this.frameCount || 0) + 1;
    const slow = this.frameCount % 4 === 0;

    // ---- vignette: low HP pulse + flash when taking a big hit
    if (hd) {
      const frac = hd.maxHp > 0 ? hd.hp / hd.maxHp : 1;
      if (this.lastHp !== null && hd.hp < this.lastHp - hd.maxHp * 0.06) this.hitFlash = Math.min(1, this.hitFlash + 0.6);
      this.lastHp = hd.hp;
      this.hitFlash = Math.max(0, this.hitFlash - dt * 2.5);
      const low = hd.hp > 0 && frac < 0.4 ? (0.25 + 0.75 * (0.4 - frac) / 0.4) * (0.75 + Math.sin(now * 6) * 0.25) : 0;
      const op = Math.min(0.9, low + this.hitFlash * 0.6 + (hd.hp <= 0 ? 0.5 : 0));
      this.vignette.style.opacity = op.toFixed(3);
    }

    // ---- wave banner
    if (gs) {
      const waveLabel = gs.endless ? `Vague ${gs.wave} (infini)` : `Vague ${gs.wave} / ${FINAL_WAVE}`;
      this.setText(this.waveText, waveLabel);
      let sub = '';
      if (gs.phase === PHASE.PREP) {
        const wt = waveType(gs.wave);
        const next = wt === 'boss' ? ' — prochaine : BOSS' : wt === 'horde' ? ' — prochaine : horde' : wt === 'elite' ? " — prochaine : vague d'élite" : '';
        sub = (gs.countdown >= 0 ? 'La vague arrive !' : 'Préparation') + next;
      }
      if (gs.phase === PHASE.WAVE) sub = `${gs.remaining} ennemi${gs.remaining > 1 ? 's' : ''}`;
      else if (gs.phase === PHASE.VICTORY) sub = 'Victoire !';
      else if (gs.phase === PHASE.DEFEAT) sub = 'Défaite';
      this.setText(this.waveSub, sub);
      const cd = s.countdown();
      this.setText(this.countEl, gs.phase === PHASE.PREP && cd >= 0 ? String(Math.ceil(cd)) : '');
      if (slow) this.renderBosses(gs.bosses || []);
    }

    // ---- party frames
    if (slow && gs) this.renderParty(gs, world);

    // ---- gold & net
    if (hd) this.setText(this.goldEl, `💰 ${fmtInt(hd.gold)}`);
    if (slow) {
      const fps = this.view.fps ? `${Math.round(this.view.fps)} FPS` : '';
      const ping = s.local ? '' : ` · ping ${Math.round(s.rtt())} ms`;
      const dname = gs ? `${DIFFICULTIES[gs.diff]?.name || ''} · ${ARENAS[gs.arena]?.name || ''}` : '';
      this.setText(this.netEl, (this.app.settings.showFps ? fps + ping + ' · ' : '') + dname);
      this.shopBtn.classList.toggle('disabled', !gs || gs.phase !== PHASE.PREP);
    }

    // ---- HP orb
    if (hd) {
      const frac = hd.maxHp > 0 ? Math.max(0, hd.hp / hd.maxHp) : 0;
      this.hpFill.style.height = frac * 100 + '%';
      this.hpShield.style.height = Math.min(1, hd.shield / Math.max(1, hd.maxHp)) * 100 + '%';
      this.setHTML(this.hpText, `${fmtInt(Math.max(0, hd.hp))}<small>/ ${fmtInt(hd.maxHp)}</small>`);
      this.xpFill.style.width = Math.min(100, (hd.xp / Math.max(1, hd.xpNext)) * 100) + '%';
      this.setText(this.lvlEl, `Niv. ${hd.level}`);
      this.setText(this.potion.cnt, String(hd.potions));
      this.potion.el.style.opacity = hd.potions > 0 ? 1 : 0.45;
    }
    this.setText(this.potion.key, this.app.input.label('potion'));

    // ---- ability slots
    if (cls) {
      for (let i = 0; i < 6; i++) {
        const sl = this.slots[i];
        const ab = ABILITIES[cls.abilities[i]];
        this.setText(sl.icon, ab.icon);
        this.setText(sl.key, this.slotKeyLabel(i));
        let rem = 0, total = 1;
        if (i > 0 && this.view.controller) [rem, total] = this.view.controller.cooldown(i);
        const channeling = hd && hd.channel === i;
        if (channeling) rem = 0;
        sl.cd.style.setProperty('--p', rem > 0.05 ? Math.min(100, (rem / Math.max(0.1, total)) * 100) + '%' : '0%');
        this.setText(sl.cdt, rem > 0.05 ? (rem >= 10 ? String(Math.ceil(rem)) : rem.toFixed(1).replace('.', ',')) : '');
        const wasReady = sl.ready;
        sl.ready = rem <= 0.05;
        if (sl.ready && wasReady === false && i > 0) { sl.el.classList.remove('flash'); void sl.el.offsetWidth; sl.el.classList.add('flash'); }
        sl.el.classList.toggle('active', !!channeling);
        if (i === 5 && hd) this.setText(sl.ch, hd.dashMax > 1 ? String(hd.dashCh) : '');
      }
    }

    // ---- buffs
    if (slow && hd) this.renderBuffs(hd.buffs);

    // ---- prep actions
    const me = gs ? gs.players.find((p) => p.pid === s.pid) : null;
    const prep = gs && gs.phase === PHASE.PREP;
    this.readyBtn.classList.toggle('hidden', !prep);
    if (prep && me) {
      const readyCount = gs.players.filter((p) => p.ready && p.connected).length;
      const total = gs.players.filter((p) => p.connected).length;
      const cd = s.countdown();
      const label = me.ready
        ? (total > 1 ? `Prêt ✔ (${readyCount}/${total})` : 'Prêt ✔')
        : `⚔ Lancer la vague ${gs.wave} (${this.app.input.label('ready')})${cd >= 0 ? ` — ${Math.ceil(cd)} s` : ''}`;
      this.setText(this.readyBtn, label);
      this.readyBtn.classList.toggle('done', !!me.ready);
    }
    const pending = hd ? hd.pending : 0;
    this.talentAlert.classList.toggle('hidden', !pending);
    if (pending) {
      this.setText(this.talentAlert.querySelector('.n'), String(pending));
      this.talentAlert.style.opacity = prep ? 1 : 0.55;
    }
    if (slow) this.drawMinimap(world);
  }

  setText(el, t) { if (el._t !== t) { el._t = t; el.textContent = t; } }
  setHTML(el, t) { if (el._h !== t) { el._h = t; el.innerHTML = t; } }

  renderBosses(bosses) {
    const key = JSON.stringify(bosses.map((b) => [b.id, Math.round((b.hp / b.maxHp) * 200), b.phase, b.shield]));
    if (key === this.last.bosses) return;
    this.last.bosses = key;
    clear(this.bossWrap);
    for (const b of bosses) {
      const frac = Math.max(0, b.hp / b.maxHp);
      this.bossWrap.appendChild(h('div.boss-bar' + (b.shield ? '.shielded' : ''), {},
        h('div.bb-name', {}, h('span', { text: b.name + (b.shield ? ' — protégé !' : '') }), h('span', { text: `${Math.ceil(frac * 100)}%` })),
        h('div.bb-track', {}, h('div.bb-fill', { style: { width: frac * 100 + '%' } }))));
    }
  }

  renderParty(gs, world) {
    const items = gs.players.map((p) => {
      const d = world.heroData.get(p.pid);
      const frac = d ? Math.max(0, d.hp / Math.max(1, d.maxHp)) : 0;
      return [p.pid, p.name, p.classId, d ? d.level : p.level, Math.round(frac * 50), p.downed, p.connected, p.ready, p.pending];
    });
    const key = JSON.stringify(items);
    if (key === this.last.party) return;
    this.last.party = key;
    clear(this.party);
    for (const [pid, name, classId, level, hp50, downed, connected, ready, pending] of items) {
      const c = CLASSES[classId];
      const flags = [];
      if (!connected) flags.push('📡');
      if (downed) flags.push('💀');
      if (ready && this.session.gs.phase === PHASE.PREP) flags.push('✔');
      if (pending) flags.push(`⬆${pending}`);
      const fr = h('div.pframe' + (downed ? '.down' : ''), { style: { '--pc': PLAYER_COLORS[pid % PLAYER_COLORS.length] } },
        h('div.cic', { text: c ? c.icon : '?' }),
        h('div.info', {}, h('div.nm', { text: `${name} · ${level}` }), h('div.hpb', {}, h('div', { style: { width: hp50 * 2 + '%' } }))),
        h('div.flags', { text: flags.join(' ') }));
      fr.style.borderLeftColor = PLAYER_COLORS[pid % PLAYER_COLORS.length];
      this.party.appendChild(fr);
    }
  }

  renderBuffs(buffs) {
    const key = buffs.map((b) => `${b[0]}:${b[2]}:${Math.ceil(b[1])}`).join('|');
    if (key === this.last.buffs) return;
    this.last.buffs = key;
    clear(this.buffs);
    for (const [id, t, stacks, dur] of buffs) {
      const def = BUFFS[id];
      if (!def || def.hidden) continue;
      const el = h('div.buff', {}, def.icon, stacks > 1 ? h('span.st', { text: String(stacks) }) : null, h('div.tm', { style: { width: Math.max(0, Math.min(1, t / Math.max(0.1, dur))) * 100 + '%' } }));
      tooltip.bind(el, () => `<b>${esc(def.name)}</b>${stacks > 1 ? ` ×${stacks}` : ''}<br><span class="muted">${Math.ceil(t)} s restantes</span>`);
      this.buffs.appendChild(el);
    }
  }

  drawMinimap(world) {
    const cv = this.minimap;
    const g = cv.getContext('2d');
    const W = cv.width, R = W / 2;
    const scale = (R - 8) / 31;
    g.clearRect(0, 0, W, W);
    g.save();
    g.beginPath(); g.arc(R, R, R - 2, 0, Math.PI * 2); g.clip();
    g.fillStyle = 'rgba(40,30,20,0.85)';
    g.fillRect(0, 0, W, W);
    const arena = ARENAS[world.info.arena];
    g.strokeStyle = 'rgba(217,169,74,0.5)';
    g.lineWidth = 3;
    g.beginPath(); g.arc(R, R, 30 * scale, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(120,100,80,0.9)';
    for (const o of arena.obstacles) { g.beginPath(); g.arc(R + o.x * scale, R + o.z * scale, Math.max(3, o.r * scale), 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(255,90,40,0.9)';
    for (const gt of arena.gates) { g.fillRect(R + gt.x * scale - 5, R + gt.z * scale - 5, 10, 10); }
    for (const pk of world.pickups.values()) {
      if (pk.k === 'chest') { g.fillStyle = pk.tier === 'cursed' ? '#b050ff' : '#ffd24a'; g.fillRect(R + pk.x * scale - 6, R + pk.z * scale - 6, 12, 12); }
      else if (pk.k === 'item' && pk.it && (pk.it.rarity === 'legendary' || pk.it.rarity === 'unique' || pk.it.rarity === 'rare')) {
        g.fillStyle = ITEM_RARITY_COLORS[pk.it.rarity];
        g.beginPath(); g.arc(R + pk.x * scale, R + pk.z * scale, 4, 0, Math.PI * 2); g.fill();
      }
    }
    for (const u of world.units.values()) {
      const x = R + u.x * scale, y = R + u.z * scale;
      if (u.kind === 'monster') {
        g.fillStyle = (u.flags & UF.ELITE) ? '#ffb030' : '#e33';
        const r = (u.flags & UF.ELITE) ? 5 : 3;
        g.fillRect(x - r / 2, y - r / 2, r, r);
      } else if (u.kind === 'boss') {
        g.fillStyle = '#ff2020';
        g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
      } else if (u.kind === 'summon' || u.kind === 'structure') {
        g.fillStyle = '#b080ff';
        g.fillRect(x - 2, y - 2, 4, 4);
      }
    }
    const localId = world.heroIdOf(this.session.pid);
    for (const u of world.units.values()) {
      if (u.kind !== 'hero') continue;
      const pid = world.pidOfUnit(u.id);
      let x = R + u.x * scale, y = R + u.z * scale;
      if (u.id === localId && this.view.controller && this.view.controller.ready) { x = R + this.view.controller.x * scale; y = R + this.view.controller.z * scale; }
      g.fillStyle = PLAYER_COLORS[pid % PLAYER_COLORS.length];
      g.beginPath(); g.arc(x, y, u.id === localId ? 7 : 6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#000'; g.lineWidth = 2; g.stroke();
    }
    g.restore();
  }

  setPaused(p) {
    this.pauseEl.classList.toggle('hidden', !p);
  }

  /** First-game controls reminder (dismissable) */
  showHint(lines, onClose) {
    const box = h('div.hint-box.interactive', {},
      h('div.hint-title', { text: 'Bienvenue dans l\'arène !' }),
      ...lines.map((l) => h('div.hint-line', { html: l })),
      h('button.btn.small.primary', { style: { marginTop: '8px' }, onclick: () => { box.remove(); onClose && onClose(); }, text: 'Compris !' }));
    this.root.appendChild(box);
  }

  // ---------------------------------------------------------------------------
  pushFeed(text, color = '#fff') {
    const el = h('div.fl', { text, style: { color } });
    this.feed.appendChild(el);
    while (this.feed.children.length > 7) this.feed.firstChild.remove();
    setTimeout(() => el.remove(), 6200);
  }

  centerMsg(text, color = '#fff', sub = false) {
    const box = document.getElementById('center-msg');
    const el = h('div.cmsg' + (sub ? '.sub' : ''), { text, style: { color } });
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.remove(), 3300);
  }

  addChat(m) {
    const el = m.pid < 0
      ? h('div.ln', { style: { color: '#b9a98e', fontStyle: 'italic' }, text: m.s })
      : h('div.ln', {}, h('b', { style: { color: PLAYER_COLORS[m.pid % PLAYER_COLORS.length] }, text: m.name + ' : ' }), m.s);
    this.chatLines.appendChild(el);
    while (this.chatLines.children.length > 8) this.chatLines.firstChild.remove();
  }

  openChat() {
    this.chatInput.classList.remove('hidden');
    this.chatBox.classList.add('open');
    this.chatInput.focus();
    this.view.input.enabled = false;
  }

  closeChat() {
    this.chatInput.value = '';
    this.chatInput.classList.add('hidden');
    this.chatBox.classList.remove('open');
    this.chatInput.blur();
    this.view.input.enabled = true;
  }

  get chatOpen() { return !this.chatInput.classList.contains('hidden'); }

  dispose() {
    clear(this.root);
    this.root.classList.add('hidden');
    clear(document.getElementById('center-msg'));
  }
}
