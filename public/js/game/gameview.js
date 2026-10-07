// Active game view: render loop, controller, HUD, panels, audio and input routing.
import { GameRenderer } from '../render/renderer.js';
import { Controller } from './controller.js';
import { Hud } from '../ui/hud.js';
import { Panels } from '../ui/panels.js';
import { PHASE, UF, REVIVE_RANGE, REVIVE_TIME, CHEST_OPEN_TIME, ITEM_PICK_RANGE } from '../core/constants.js';
import { ABILITIES } from '../core/data/classes/index.js';
import { tooltip, hideContextMenu } from '../ui/tooltip.js';

export class GameView {
  constructor(app, session) {
    this.app = app;
    this.session = session;
    this.world = session.world;
    this.input = app.input;
    this.input.enabled = true;
    this.renderer = new GameRenderer(document.getElementById('game-layer'), this.world, session, app.settings);
    this.controller = new Controller(session, this.world, this.input, this);
    this.hud = new Hud(this);
    this.panels = new Panels(this);
    this.offs = [];
    this.lastPhase = null;
    this.fps = 0;
    this.suppressPrimary = false;

    this.offs.push(session.on('gs', (gs) => this.onGameState(gs)));
    this.offs.push(session.on('pi', (pid) => { if (pid === session.pid) this.panels.refresh('items'); }));
    this.offs.push(session.on('pst', (pid) => { if (pid === session.pid) this.panels.refresh('stats'); }));
    this.offs.push(session.on('end', (info) => { setTimeout(() => { if (!this.disposed) this.panels.showEnd(info); }, info.result && info.result.win ? 1500 : 2500); }));
    this.offs.push(session.on('chat', (m) => this.hud.addChat(m)));
    this.offs.push(session.on('pause', (p) => this.hud.setPaused(p)));
    this.offs.push(this.world.onEvent((ev) => this.onEvent(ev)));
    for (const m of session.chat.slice(-5)) this.hud.addChat(m);
    this.onVisibility = () => this.updatePause();
    document.addEventListener('visibilitychange', this.onVisibility);
    this.wasDown = false;
    this.maybeShowHint();

    this.app.audio.init();
    this.app.audio.startMusic();
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
    if (session.gs) this.onGameState(session.gs);
    if (session.endInfo) {
      const info = session.endInfo;
      setTimeout(() => { if (!this.disposed && !this.panels.isOpen('end')) this.panels.showEnd(info); }, 500);
    }
  }

  abilityIcon(id) { return ABILITIES[id] ? ABILITIES[id].icon : ''; }

  /** Used by the controller: mouse position on the ground plane */
  mouseGround() { return this.renderer.mouseGround(); }

  /** Used by the controller: predicted cast animation on the local hero */
  onLocalCast(slot) {
    const heroId = this.world.heroIdOf(this.session.pid);
    this.renderer.units.localCast(heroId, slot);
  }

  togglePanel(name) { this.panels.toggle(name); }

  /** Pause solo games while the menu is open or the tab is hidden */
  updatePause() {
    const host = this.app.host;
    if (!this.session.local || !host || !host.game) return;
    const want = this.panels.isOpen('menu') || this.panels.isOpen('achievements') || (document.hidden && !window.__noAutoPause);
    host.setPaused(want && !host.game.over);
  }

  maybeShowHint() {
    let seen = false;
    try { seen = localStorage.getItem('hdr.hintSeen') === '1'; } catch { /* ignore */ }
    if (seen) return;
    const L = (a) => this.input.label(a);
    this.hud.showHint([
      `<b>Déplacement</b> : ${L('up')} ${L('left')} ${L('down')} ${L('right')} · <b>Viser</b> : souris`,
      `<b>Attaquer</b> : clic gauche (maintenir) · <b>Clic droit</b>, <b>${L('skill1')}</b>, <b>${L('skill2')}</b>, <b>${L('ultimate')}</b> : compétences`,
      `<b>${L('dash')}</b> : esquive (invulnérable) · <b>${L('potion')}</b> : potion · <b>${L('interact')}</b> : ramasser / coffres / ranimer`,
      `Sortez des <b style="color:#ff5040">zones rouges</b> avant l'impact !`,
      `Entre les vagues : boutique <b>${L('shop')}</b>, inventaire <b>${L('inventory')}</b>, talents <b>${L('talents')}</b>. Prêt : <b>${L('ready')}</b>.`,
    ], () => { try { localStorage.setItem('hdr.hintSeen', '1'); } catch { /* ignore */ } });
  }

  onGameState(gs) {
    if (gs.phase !== this.lastPhase) {
      const prev = this.lastPhase;
      this.lastPhase = gs.phase;
      this.panels.refresh('phase');
      if (gs.phase === PHASE.WAVE) this.app.audio.setIntensity(gs.bosses && gs.bosses.length ? 1 : 0.6);
      else this.app.audio.setIntensity(0);
      if (gs.phase === PHASE.PREP && prev === PHASE.WAVE) {
        const hd = this.world.myHeroData();
        if (hd && hd.pending > 0) this.hud.pushFeed(`${hd.pending} choix de talent disponible(s) !`, '#c09aff');
      }
    }
    if (gs.phase === PHASE.WAVE) this.app.audio.setIntensity(gs.bosses && gs.bosses.length ? 1 : 0.6);
  }

  onEvent(ev) {
    const pid = this.session.pid;
    switch (ev.e) {
      case 'msg':
        if (ev.to !== undefined && ev.to !== pid) return;
        if (ev.big) this.hud.centerMsg(ev.s, ev.c);
        else this.hud.pushFeed(ev.s, ev.c);
        break;
      case 'snd':
        this.app.audio.play(ev.s, ev.x, ev.z, ev.v ?? 1);
        break;
      case 'got':
        if (ev.pid === pid && ev.it) this.hud.pushFeed(`Ramassé : ${ev.it.n}`, { common: '#ddd', magic: '#7aa8ff', rare: '#ffe14d', legendary: '#ff9a2a', unique: '#e2b86b' }[ev.it.r]);
        break;
      default:
        break;
    }
  }

  computePrompt() {
    const c = this.controller;
    if (!c.ready) return null;
    const world = this.world;
    const hd = world.myHeroData();
    if (!hd || hd.hp <= 0) return null;
    const x = c.x, z = c.z;
    const key = this.input.label('interact');
    // downed ally
    let best = null, bd = REVIVE_RANGE * REVIVE_RANGE;
    for (const d of world.heroData.values()) {
      if (d.pid === this.session.pid || d.hp > 0) continue;
      const u = world.units.get(d.id);
      if (!u) continue;
      const dd = (u.x - x) ** 2 + (u.z - z) ** 2;
      if (dd < bd) { bd = dd; best = { u, d }; }
    }
    if (best) {
      const p = this.session.players.get(best.d.pid);
      return { x: best.u.x, z: best.u.z, y: 1.5, text: `Maintenir ${key} : ranimer ${p ? p.name : ''}`, progress: best.d.revive / REVIVE_TIME };
    }
    let chest = null; bd = 2.4 * 2.4;
    for (const pk of world.pickups.values()) {
      if (pk.k !== 'chest') continue;
      const dd = (pk.x - x) ** 2 + (pk.z - z) ** 2;
      if (dd < bd) { bd = dd; chest = pk; }
    }
    if (chest) {
      const label = chest.tier === 'cursed' ? 'ouvrir le coffre maudit' : chest.tier === 'boss' ? 'ouvrir le coffre du boss' : 'ouvrir le coffre';
      return { x: chest.x, z: chest.z, y: 1.6, text: `Maintenir ${key} : ${label}`, progress: (hd.interact || 0) / CHEST_OPEN_TIME };
    }
    let item = null; bd = ITEM_PICK_RANGE * ITEM_PICK_RANGE;
    for (const pk of world.pickups.values()) {
      if (pk.k !== 'item') continue;
      const dd = (pk.x - x) ** 2 + (pk.z - z) ** 2;
      if (dd < bd) { bd = dd; item = pk; }
    }
    if (item && item.it) return { x: item.x, z: item.z, y: 1.9, text: `${key} : ramasser ${item.it.name}`, progress: 0 };
    return null;
  }

  handleKeys() {
    const inp = this.input;
    if (this.hud.chatOpen) return;
    if (inp.codePressed('Escape')) {
      hideContextMenu();
      if (this.panels.open.size && !(this.panels.open.size === 1 && this.panels.isOpen('end'))) this.panels.closeAll();
      else this.panels.toggle('menu');
    }
    if (inp.justPressed('chat') && !this.session.local) { this.hud.openChat(); return; }
    if (inp.justPressed('chat') && this.session.local && this.session.lobby && this.session.lobby.online) { this.hud.openChat(); return; }
    if (inp.justPressed('inventory')) this.panels.toggle('inventory');
    if (inp.justPressed('shop')) this.panels.toggle('shop');
    if (inp.justPressed('talents')) this.panels.toggle('talents');
    if (inp.justPressed('achievements')) this.panels.toggle('achievements');
    if (inp.justPressed('ready')) {
      const gs = this.session.gs;
      if (gs && gs.phase === PHASE.PREP) this.session.action({ t: 'ready' });
    }
  }

  frame(t) {
    if (this.disposed) return;
    this.raf = requestAnimationFrame((tt) => this.frame(tt));
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (!(dt > 0)) dt = 0.016;
    if (dt > 0.1) dt = 0.1;
    this.fps = this.fps ? this.fps * 0.95 + (1 / dt) * 0.05 : 1 / dt;
    const now = performance.now() / 1000;
    try {
      this.world.update(now);
      const inp = this.input;
      this.renderer.setMouse(inp.mouse.x, inp.mouse.y);
      this.handleKeys();
      // loot labels: hover & click to pick up
      const hoverId = this.renderer.overlay.labelAt(inp.mouse.x, inp.mouse.y);
      if (inp.mouse.pressed[0] && hoverId) {
        this.session.action({ t: 'pick', id: hoverId });
        inp.mouse.pressed[0] = false;
        this.suppressPrimary = true;
      }
      if (this.suppressPrimary) {
        if (!inp.mouse.down[0]) this.suppressPrimary = false;
        else { inp.mouse.down[0] = false; inp.mouse.pressed[0] = false; }
      }
      const uiBlocks = this.panels.anyModal() || this.hud.chatOpen;
      if (!this.session.paused) this.controller.update(dt, now, uiBlocks);
      if (this.suppressPrimary) inp.mouse.down[0] = true;
      // local hero downed / revived feedback
      const hd = this.world.myHeroData();
      const down = !!hd && hd.hp <= 0;
      if (down && !this.wasDown) {
        const solo = this.session.gs && this.session.gs.players.length <= 1;
        this.hud.centerMsg('VOUS ÊTES À TERRE', '#ff5a4a');
        if (!solo) this.hud.centerMsg('Un allié peut vous ranimer (maintenir F près de vous). Sinon, retour à la fin de la vague.', '#ffd0c8', true);
      }
      this.wasDown = down;
      const prompt = this.computePrompt();
      this.renderer.render(dt, now, this.controller, {
        aim: true, showLoot: inp.down('showLoot'), prompt, hoverId, zoomDelta: uiBlocks ? 0 : inp.mouse.wheel,
      });
      this.hud.update(dt, now);
      if (this.controller.ready) this.app.audio.setListener(this.controller.x, this.controller.z);
      this.app.audio.updateMusic();
    } catch (err) {
      console.error(err);
      if (!this.reported) { this.reported = true; this.app.toast('Erreur d\'affichage : ' + err.message, 'error'); }
    }
    this.input.endFrame();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.app.host && this.app.host.paused) this.app.host.setPaused(false);
    for (const off of this.offs) off();
    this.offs = [];
    this.controller.dispose();
    this.hud.dispose();
    this.panels.dispose();
    this.renderer.dispose();
    tooltip.hide();
    this.app.audio.setIntensity(0);
  }
}

export { UF };
