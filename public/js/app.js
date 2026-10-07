// Application: screens, sessions (solo / host / client), toasts, settings.
import { ProfileStore } from './profile/profile.js';
import { loadSettings, saveSettings } from './settings.js';
import { Audio } from './audio/sfx.js';
import { Input } from './game/input.js';
import { Screens } from './ui/screens.js';
import { HostSession } from './net/host.js';
import { ClientSession } from './net/client.js';
import { netMode } from './net/netmode.js';
import { GameView } from './game/gameview.js';
import { h } from './ui/dom.js';
import { ACHIEVEMENTS_BY_ID } from './core/data/achievements.js';
import { rewardText, rewardIcon } from './ui/format.js';

export class App {
  constructor() {
    this.store = new ProfileStore();
    this.settings = loadSettings();
    this.audio = new Audio();
    this.input = new Input(document.getElementById('game-layer'));
    this.input.setBindings(this.settings.bindings);
    this.screens = new Screens(this);
    this.host = null;
    this.session = null;
    this.view = null;
    // audio needs a user gesture
    const unlock = () => {
      this.audio.init();
      this.applySettings();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('beforeunload', (e) => {
      if (this.host) this.host.tracker.maybeSave(true);
      // the simulation runs in the host's browser: closing the tab ends the game for everyone
      if (this.host && this.host.game && !this.host.game.over && this.host.peerToPid.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  start() {
    const params = new URLSearchParams(location.search);
    const code = params.get('join');
    let autoJoin = null;
    try { autoJoin = sessionStorage.getItem('hdr.autojoin'); } catch { /* ignore */ }
    if (code && autoJoin === code.toUpperCase() && this.settings.playerName) {
      // page reloaded while in a game: reconnect automatically (same tab keeps its token)
      this.screens.showJoin(code.toUpperCase());
      this.join(code.toUpperCase(), this.settings.playerName).catch((err) => {
        this.toast(`Reconnexion impossible : ${err.message}`, 'error');
        try { sessionStorage.removeItem('hdr.autojoin'); } catch { /* ignore */ }
        this.screens.showJoin(code.toUpperCase());
      });
    } else if (code) this.screens.showJoin(code.toUpperCase());
    else if (params.get('quick') === 'solo') this.quickSolo(params);
    else this.screens.showTitle();
    const loading = document.getElementById('loading');
    loading.classList.add('fade');
    setTimeout(() => loading.remove(), 600);
  }

  /** Development shortcut: ?quick=solo[&cls=mage][&diff=normal][&arena=colosseum] */
  async quickSolo(params) {
    const profile = this.store.last() || this.store.create('Rapide');
    const ok = await this.startLocal(profile, this.settings.playerName || profile.name, false);
    if (!ok) return;
    const cls = params.get('cls');
    if (cls) this.host.onPeerJson(0, { k: 'lobbyClass', classId: cls });
    if (params.get('diff') || params.get('arena')) {
      this.host.onPeerJson(0, { k: 'lobbySettings', difficulty: params.get('diff') || 'normal', arena: params.get('arena') || 'colosseum' });
    }
    this.host.onPeerJson(0, { k: 'start' });
  }

  async fetchServerInfo() {
    if ((await netMode()) !== 'server') return null; // static hosting: no game server
    try {
      const res = await fetch('api/info', { cache: 'no-store' });
      if (res.ok) this.serverInfo = await res.json();
    } catch { /* server unreachable */ }
    return this.serverInfo;
  }

  /** Address typed by the host with « ✎ Adresse » (kept for this tab only: tunnel URLs change on every run) */
  manualInviteBase() {
    try { return sessionStorage.getItem('hdr.inviteBase') || ''; } catch { return ''; }
  }

  setManualInviteBase(v) {
    try { if (v) sessionStorage.setItem('hdr.inviteBase', v); else sessionStorage.removeItem('hdr.inviteBase'); } catch { /* ignore */ }
  }

  /** Folder of the game page, e.g. https://user.github.io/heroes-defence-roguelite/ */
  pageBase() {
    return location.origin + location.pathname.replace(/[^/]*$/, '');
  }

  /** Invitation link for a game code (friends can't use "localhost") */
  inviteLink(code) {
    let base = this.manualInviteBase();
    if (!base) {
      const info = this.serverInfo || {};
      const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname);
      if (info.publicUrl) base = info.publicUrl;
      else if (local && info.lanUrls && info.lanUrls.length) base = info.lanUrls[0];
      else base = this.pageBase();
    }
    return base.replace(/\/*$/, '/') + '?join=' + code;
  }

  saveSettings() { saveSettings(this.settings); }

  applySettings() {
    this.audio.setVolumes(this.settings.volumes);
    this.input.setBindings(this.settings.bindings);
    if (this.view && this.view.renderer) {
      this.view.renderer.overlay.settings.damageNumbers = this.settings.damageNumbers;
      this.view.renderer.overlay.settings.allyNumbers = this.settings.allyNumbers;
      this.view.renderer.settings = this.settings;
    }
  }

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------
  async startLocal(profile, name, online) {
    this.disposeSession();
    const host = new HostSession(this, { profile, name, online });
    const session = new ClientSession(this, { host });
    host.local = session;
    this.host = host;
    this.session = session;
    if (online) {
      try {
        await host.openOnline();
        await this.fetchServerInfo();
      } catch (err) {
        const hint = (await netMode()) === 'server' ? ' Le serveur de jeu est-il lancé (npm start) ?' : '';
        this.toast(`Impossible de créer le salon en ligne : ${err.message}${hint}`, 'error');
        this.disposeSession();
        return false;
      }
    }
    this.bindSession(session);
    host.broadcastLobby();
    host.sendTo(0, { k: 'profile', summary: profile.summary() });
    this.screens.showLobby();
    return true;
  }

  async join(code, name) {
    this.disposeSession();
    const session = new ClientSession(this);
    this.session = session;
    try {
      await session.joinRemote(code, name);
    } catch (err) {
      this.disposeSession();
      throw err;
    }
    this.bindSession(session);
    // keep ?join=CODE in the address so a reload reconnects to the same game
    history.replaceState(null, '', `${location.pathname}?join=${session.code}`);
    try { sessionStorage.setItem('hdr.autojoin', session.code); } catch { /* ignore */ }
    if (session.inGame && session.world) this.enterGame(); // reconnected into a running game
    else this.screens.showLobby();
  }

  bindSession(session) {
    session.on('start', () => this.enterGame());
    session.on('lobbyReturn', () => { this.exitGame(); this.screens.showLobby(); });
    session.on('closed', (reason) => {
      this.toast(reason || 'Déconnecté.', 'error');
      this.leave();
    });
    session.on('ach', (id) => this.achievementToast(id));
  }

  enterGame() {
    this.screens.clear();
    if (this.view) this.view.dispose();
    this.view = new GameView(this, this.session);
  }

  exitGame() {
    if (this.view) { this.view.dispose(); this.view = null; }
  }

  leave() {
    this.exitGame();
    this.disposeSession();
    try { sessionStorage.removeItem('hdr.autojoin'); } catch { /* ignore */ }
    if (location.search) history.replaceState(null, '', location.pathname);
    this.screens.showTitle();
  }

  disposeSession() {
    if (this.session) { this.session.leave(); this.session = null; }
    if (this.host) { this.host.dispose(); this.host = null; }
  }

  // ---------------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------------
  toast(msg, type = 'info', ms = 4500) {
    const box = document.getElementById('toasts');
    const el = h('div.toast' + (type === 'error' ? '.error' : ''), { text: msg });
    box.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity 0.4s'; el.style.opacity = '0'; }, ms);
    setTimeout(() => el.remove(), ms + 450);
  }

  achievementToast(id) {
    const a = ACHIEVEMENTS_BY_ID[id];
    if (!a) return;
    const box = document.getElementById('toasts');
    const el = h('div.toast.ach', {},
      h('div.ti', { text: a.icon }),
      h('div', {},
        h('div.tt', { text: 'Succès débloqué !' }),
        h('div.tn', { text: a.name }),
        h('div.tr', { text: a.reward.map((r) => `${rewardIcon(r)} ${rewardText(r)}`).join(' · ') }),
        h('div.tr', { style: { opacity: 0.75 }, text: 'Disponible dès la prochaine partie.' })));
    box.appendChild(el);
    this.audio.play('dropunique');
    setTimeout(() => { el.style.transition = 'opacity 0.5s'; el.style.opacity = '0'; }, 7000);
    setTimeout(() => el.remove(), 7600);
  }
}
