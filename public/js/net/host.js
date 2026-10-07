// Host session: owns the lobby and the authoritative Game, talks to peers through the relay.
import { Game } from '../core/sim/game.js';
import { DT, NET_SNAPSHOT_EVERY, MAX_PLAYERS, PHASE } from '../core/constants.js';
import { buildState, encodeSnapshot, decodeInput, encodeJson, decodeJson, frameType, MSG, ADDR_ALL } from '../core/net/protocol.js';
import { heroItemsState, heroStatsState, fullSyncEvents } from '../core/net/playerstate.js';
import { CLASSES, CLASS_LIST } from '../core/data/classes/index.js';
import { DIFFICULTIES, DIFFICULTY_LIST } from '../core/data/difficulty.js';
import { ARENAS, ARENA_LIST } from '../core/data/arenas.js';
import { createTicker } from './clock.js';
import { createTransport } from './netmode.js';
import { Tracker } from '../profile/profile.js';

export class HostSession {
  /**
   * opts: { profile, name, online }
   */
  constructor(app, opts) {
    this.app = app;
    this.profile = opts.profile;
    this.name = opts.name || 'Hôte';
    this.online = !!opts.online;
    this.transport = null;
    this.code = null;
    this.peerToPid = new Map();
    this.pidToPeer = new Map();
    this.nextPid = 1;
    this.local = null; // the host's own ClientSession
    this.game = null;
    this.ticker = null;
    this.acc = 0;
    this.lastT = 0;
    this.remoteEvents = [];
    this.remoteDmg = [];
    this.lastSent = new Map();
    this.runAchievements = [];
    this.endSent = false;
    this.chatLog = [];
    const firstClass = CLASS_LIST.find((c) => this.profile.isUnlocked('classes', c)) || CLASS_LIST[0];
    this.lobby = {
      players: [{ pid: 0, name: this.name, classId: firstClass.id, ready: true, connected: true, token: 'host' }],
      difficulty: 'normal',
      arena: 'colosseum',
    };
    this.tracker = new Tracker(this.profile, (ach) => this.onAchievement(ach));
  }

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------
  async openOnline() {
    this.transport = await createTransport('host');
    await this.transport.connect();
    this.transport.on('control', (m) => this.onControl(m));
    this.transport.on('binary', (b) => this.onBinary(b));
    this.transport.on('close', () => {
      if (this.disposed) return;
      this.app.toast('Connexion au serveur perdue : les autres joueurs ont été déconnectés.', 'error');
      for (const p of this.lobby.players) if (p.pid !== 0) p.connected = false;
      this.online = false;
    });
    const p = this.transport.waitFor((m) => m.t === 'hosted', 15000);
    this.transport.sendJson({ t: 'host', name: this.name });
    const msg = await p;
    this.code = msg.code;
    this.updateMeta();
    return this.code;
  }

  updateMeta() {
    if (!this.transport) return;
    this.transport.sendJson({
      t: 'meta',
      meta: {
        name: this.name,
        state: this.game ? 'ingame' : 'lobby',
        players: this.lobby.players.filter((p) => p.connected).length,
        max: MAX_PLAYERS,
        wave: this.game ? this.game.wave : 0,
      },
    });
  }

  hasPeers() { return this.peerToPid.size > 0; }

  sendTo(pid, obj) {
    if (pid === 0) {
      if (this.local) this.local.receiveJson(obj);
      return;
    }
    const peer = this.pidToPeer.get(pid);
    if (peer !== undefined && this.transport) this.transport.sendBinary(encodeJson(peer, obj));
  }

  broadcast(obj, includeLocal = true) {
    if (includeLocal && this.local) this.local.receiveJson(obj);
    if (this.transport && this.hasPeers()) this.transport.sendBinary(encodeJson(ADDR_ALL, obj));
  }

  // ---------------------------------------------------------------------------
  // Relay events
  // ---------------------------------------------------------------------------
  onControl(m) {
    if (m.t === 'peer') this.onPeerJoin(m.idx, m.name, m.token);
    else if (m.t === 'peerLeft') this.onPeerLeave(m.idx);
  }

  onBinary(buf) {
    const { addr, type } = frameType(buf);
    const pid = this.peerToPid.get(addr);
    if (pid === undefined) return;
    if (type === MSG.INPUT) {
      if (!this.game) return;
      const p = this.game.players.get(pid);
      if (p) this.game.applyHeroInput(p.hero, decodeInput(buf));
    } else if (type === MSG.JSON) {
      let msg;
      try { msg = decodeJson(buf); } catch { return; }
      this.onPeerJson(pid, msg);
    }
  }

  onPeerJoin(idx, name, token) {
    name = String(name || 'Joueur').slice(0, 20);
    // reconnection into a running game
    if (this.game && token) {
      const prev = this.lobby.players.find((p) => p.token === token && !p.connected);
      if (prev) {
        this.bindPeer(idx, prev.pid);
        prev.connected = true;
        const gp = this.game.players.get(prev.pid);
        if (gp) { gp.connected = true; gp.hero.disconnected = false; }
        this.sendTo(prev.pid, { k: 'welcome', pid: prev.pid, code: this.code, hostName: this.name, reconnect: true });
        this.broadcastLobby();
        this.sendGameStart(prev.pid);
        this.sendChat(null, `${prev.name} est de retour !`);
        this.updateMeta();
        return;
      }
    }
    const active = this.lobby.players.filter((p) => p.connected || (this.game && this.game.players.has(p.pid)));
    if (active.length >= MAX_PLAYERS) {
      this.transport.sendJson({ t: 'kick', idx, reason: 'La partie est pleine (4 joueurs maximum).' });
      return;
    }
    const pid = this.nextPid++;
    this.bindPeer(idx, pid);
    const cls = CLASS_LIST.find((c) => this.profile.isUnlocked('classes', c)) || CLASS_LIST[0];
    this.lobby.players.push({ pid, name, classId: cls.id, ready: false, connected: true, token: token || '', pending: !!this.game });
    this.sendTo(pid, { k: 'welcome', pid, code: this.code, hostName: this.name });
    this.sendTo(pid, { k: 'profile', summary: this.profile.summary() });
    this.broadcastLobby();
    this.sendChat(null, `${name} a rejoint ${this.game ? 'le salon (partie en cours)' : 'le salon'}.`);
    this.updateMeta();
  }

  bindPeer(idx, pid) {
    this.peerToPid.set(idx, pid);
    this.pidToPeer.set(pid, idx);
  }

  onPeerLeave(idx) {
    const pid = this.peerToPid.get(idx);
    this.peerToPid.delete(idx);
    if (pid === undefined) return;
    this.pidToPeer.delete(pid);
    const lp = this.lobby.players.find((p) => p.pid === pid);
    if (!lp) return;
    if (this.game && this.game.players.has(pid)) {
      lp.connected = false;
      const gp = this.game.players.get(pid);
      gp.connected = false;
      gp.hero.disconnected = true;
      gp.hero.input.held = 0;
      this.game.checkAllReady();
      this.game.stateDirty = true;
      this.sendChat(null, `${lp.name} s'est déconnecté (son héros attend son retour).`);
    } else {
      this.lobby.players = this.lobby.players.filter((p) => p.pid !== pid);
      this.sendChat(null, `${lp.name} a quitté le salon.`);
    }
    this.broadcastLobby();
    this.updateMeta();
  }

  kick(pid) {
    const peer = this.pidToPeer.get(pid);
    if (peer === undefined || !this.transport) return;
    this.transport.sendJson({ t: 'kick', idx: peer, reason: "L'hôte vous a exclu de la partie." });
    this.onPeerLeave(peer);
    this.lobby.players = this.lobby.players.filter((p) => p.pid !== pid || (this.game && this.game.players.has(pid)));
    this.broadcastLobby();
  }

  // ---------------------------------------------------------------------------
  // Lobby
  // ---------------------------------------------------------------------------
  lobbyState() {
    const unlocked = {
      classes: CLASS_LIST.filter((c) => this.profile.isUnlocked('classes', c)).map((c) => c.id),
      difficulties: DIFFICULTY_LIST.filter((d) => this.profile.isUnlocked('difficulty', d)).map((d) => d.id),
      arenas: ARENA_LIST.filter((a) => this.profile.isUnlocked('arenas', a)).map((a) => a.id),
    };
    return {
      k: 'lobby',
      code: this.code,
      online: this.online,
      hostName: this.name,
      profileName: this.profile.name,
      players: this.lobby.players.map((p) => ({ pid: p.pid, name: p.name, classId: p.classId, ready: p.ready, connected: p.connected, pending: !!p.pending, inGame: !!(this.game && this.game.players.has(p.pid)) })),
      difficulty: this.lobby.difficulty,
      arena: this.lobby.arena,
      unlocked,
      inGame: !!this.game,
      over: !!(this.game && this.game.over),
      achDone: this.profile.doneCount(),
    };
  }

  broadcastLobby() {
    this.broadcast(this.lobbyState());
  }

  onPeerJson(pid, msg) {
    const lp = this.lobby.players.find((p) => p.pid === pid);
    switch (msg.k) {
      case 'lobbyClass': {
        const c = CLASSES[msg.classId];
        if (!lp || !c || !this.profile.isUnlocked('classes', c)) return;
        if (this.game && this.game.players.has(pid)) return;
        lp.classId = c.id;
        this.broadcastLobby();
        break;
      }
      case 'lobbyReady': {
        if (!lp) return;
        lp.ready = !!msg.ready;
        this.broadcastLobby();
        break;
      }
      case 'lobbySettings': {
        if (pid !== 0 || this.game) return;
        const d = DIFFICULTIES[msg.difficulty];
        if (d && this.profile.isUnlocked('difficulty', d)) this.lobby.difficulty = d.id;
        const a = ARENAS[msg.arena];
        if (a && this.profile.isUnlocked('arenas', a)) this.lobby.arena = a.id;
        this.broadcastLobby();
        break;
      }
      case 'start': {
        if (pid !== 0 || this.game) return;
        this.startGame();
        break;
      }
      case 'joinGame': {
        if (!this.game || this.game.over || !lp || this.game.players.has(pid)) return;
        const c = CLASSES[msg.classId];
        if (!c || !this.profile.isUnlocked('classes', c)) return;
        lp.classId = c.id;
        lp.pending = false;
        this.game.addLatePlayer({ pid, name: lp.name, classId: c.id });
        this.sendGameStart(pid);
        this.broadcastLobby();
        this.updateMeta();
        break;
      }
      case 'act': {
        if (!this.game || !msg.a) return;
        if (msg.a.t === 'endless') { if (pid === 0) this.game.continueEndless(); return; }
        this.game.handleAction(pid, msg.a);
        break;
      }
      case 'chat': {
        if (!lp) return;
        const s = String(msg.s || '').slice(0, 200).trim();
        if (s) this.sendChat(lp, s);
        break;
      }
      case 'profileReq':
        this.sendTo(pid, { k: 'profile', summary: this.profile.summary() });
        break;
      case 'backToLobby':
        if (pid === 0) this.endGame();
        break;
      case 'kick':
        if (pid === 0 && msg.pid !== 0) this.kick(msg.pid);
        break;
      case 'ping':
        this.sendTo(pid, { k: 'pong', t: msg.t });
        break;
      default:
        break;
    }
  }

  sendChat(lp, s) {
    const m = { k: 'chat', pid: lp ? lp.pid : -1, name: lp ? lp.name : '', s };
    this.chatLog.push(m);
    if (this.chatLog.length > 50) this.chatLog.shift();
    this.broadcast(m);
  }

  // ---------------------------------------------------------------------------
  // Game
  // ---------------------------------------------------------------------------
  startGame() {
    const players = this.lobby.players.filter((p) => p.connected);
    const unlocks = this.profile.unlocks();
    const seed = Math.floor(Math.random() * 1e9);
    this.game = new Game({
      seed,
      difficulty: this.lobby.difficulty,
      arena: this.lobby.arena,
      players: players.map((p) => ({ pid: p.pid, name: p.name, classId: p.classId })),
      unlocks: { uniques: unlocks.uniques, aspects: unlocks.aspects, talents: unlocks.talents },
      ownedUniques: new Set(this.profile.raw.found),
    });
    for (const p of this.lobby.players) p.pending = false;
    this.tracker.startRun(players.map((p) => p.classId), players.length);
    this.runAchievements = [];
    this.endSent = false;
    this.lastSent.clear();
    this.remoteEvents = [];
    this.remoteDmg = [];
    for (const p of players) this.sendGameStart(p.pid);
    this.broadcastLobby();
    this.updateMeta();
    this.acc = 0;
    this.lastT = performance.now();
    if (this.ticker) this.ticker.stop();
    this.ticker = createTicker(8, () => this.onTick());
  }

  sendGameStart(pid) {
    const g = this.game;
    this.sendTo(pid, {
      k: 'start',
      arena: g.arenaId,
      difficulty: g.diffId,
      seed: g.seed,
      players: [...g.players.values()].map((p) => ({ pid: p.pid, name: p.name, classId: p.classId, heroId: p.hero.id })),
    });
    this.sendTo(pid, { k: 'sync', events: fullSyncEvents(g) });
    this.sendTo(pid, { k: 'gs', ...g.publicState() });
    for (const p of g.players.values()) {
      this.sendTo(pid, { k: 'pi', ...heroItemsState(g, p.hero) });
      this.sendTo(pid, { k: 'pst', ...heroStatsState(g, p.hero) });
    }
    this.sendTo(pid, { k: 'profile', summary: this.profile.summary() });
    // joined/reconnected after the end: show the end screen too
    if (this.endSent) this.sendTo(pid, { k: 'end', ...this.endSummary() });
  }

  /** Solo games can be paused (menu open, tab hidden). Never pauses with other players connected. */
  canPause() {
    return !this.online || this.peerToPid.size === 0;
  }

  setPaused(p) {
    const v = !!p && this.canPause();
    if (v === !!this.paused) return;
    this.paused = v;
    this.broadcast({ k: 'pause', paused: v });
  }

  onTick() {
    if (!this.game) return;
    const now = performance.now();
    if (this.paused) {
      if (!this.canPause()) this.setPaused(false);
      this.lastT = now;
      return;
    }
    this.acc += (now - this.lastT) / 1000;
    this.lastT = now;
    if (this.acc > 0.25) this.acc = 0.25;
    let n = 0;
    while (this.acc >= DT && n < 6) {
      this.acc -= DT;
      n++;
      try {
        this.step();
      } catch (err) {
        console.error('Simulation error', err);
        this.app.toast('Erreur de simulation : ' + err.message, 'error');
      }
      if (!this.game) return;
    }
  }

  step() {
    const g = this.game;
    g.step();
    if (g.statEvents.length) {
      this.tracker.process(g.statEvents);
      g.statEvents.length = 0;
    }
    for (const h of g.heroes) {
      if (h.cdShift > 0.15) {
        h.cdShift = 0;
        g.events.push({ e: 'cdsync', pid: h.pid, r: h.cd.map((t) => Math.max(0, Math.round((t - g.time) * 100) / 100)) });
      }
    }
    const state = buildState(g);
    const events = g.events;
    const dmg = g.dmgEvents;
    if (this.local) this.local.receiveSnapshot(encodeSnapshot(0, g.tick, g.time, state, dmg, events));
    if (this.transport && this.hasPeers()) {
      for (const e of events) this.remoteEvents.push(e);
      for (const d of dmg) this.remoteDmg.push(d);
      if (g.tick % NET_SNAPSHOT_EVERY === 0) {
        this.transport.sendBinary(encodeSnapshot(ADDR_ALL, g.tick, g.time, state, this.remoteDmg, this.remoteEvents));
        this.remoteEvents = [];
        this.remoteDmg = [];
      }
    }
    g.events = [];
    g.dmgEvents = [];
    if (g.tick % 3 === 0) this.sendPlayerStates(g.tick % 60 === 0);
    if (g.stateDirty || g.tick % 15 === 0) {
      this.broadcast({ k: 'gs', ...g.publicState() });
      g.stateDirty = false;
    }
    if (g.tick % 300 === 0) this.updateMeta();
    if ((g.phase === PHASE.DEFEAT || g.phase === PHASE.VICTORY) && !this.endSent) {
      this.endSent = true;
      this.tracker.maybeSave(true);
      this.broadcast({ k: 'end', ...this.endSummary() });
      this.broadcastLobby();
    }
    if (g.phase !== PHASE.DEFEAT && g.phase !== PHASE.VICTORY) this.endSent = false;
    this.tracker.maybeSave();
    if (g.over && g.phase === PHASE.DEFEAT) {
      // keep ticking a little for death animations, then stop simulation
      this.overTicks = (this.overTicks || 0) + 1;
      if (this.overTicks > 90 && this.ticker) { this.ticker.stop(); this.ticker = null; }
    } else this.overTicks = 0;
  }

  sendPlayerStates(force) {
    const g = this.game;
    for (const p of g.players.values()) {
      const h = p.hero;
      if (!h.stateDirty && !force) continue;
      h.stateDirty = false;
      const last = this.lastSent.get(p.pid) || {};
      const items = heroItemsState(g, h);
      const itemsJson = JSON.stringify(items);
      if (itemsJson !== last.items) {
        last.items = itemsJson;
        this.broadcast({ k: 'pi', ...items });
      }
      const stats = heroStatsState(g, h);
      const statsJson = JSON.stringify(stats);
      if (statsJson !== last.stats) {
        last.stats = statsJson;
        this.broadcast({ k: 'pst', ...stats });
      }
      this.lastSent.set(p.pid, last);
    }
  }

  endSummary() {
    const g = this.game;
    return {
      result: g.result,
      wave: g.wave,
      diff: g.diffId,
      arena: g.arenaId,
      time: Math.round(g.time),
      players: [...g.players.values()].map((p) => ({
        pid: p.pid, name: p.name, classId: p.classId, level: p.hero.level, run: p.hero.run,
      })),
      achievements: this.runAchievements.slice(),
      canContinue: g.phase === PHASE.VICTORY,
    };
  }

  onAchievement(ach) {
    this.runAchievements.push(ach.id);
    this.broadcast({ k: 'ach', id: ach.id });
    this.broadcast({ k: 'profile', summary: this.profile.summary() });
  }

  endGame() {
    if (this.ticker) { this.ticker.stop(); this.ticker = null; }
    if (this.game) this.tracker.maybeSave(true);
    this.game = null;
    // drop players who left during the game
    this.lobby.players = this.lobby.players.filter((p) => p.connected);
    for (const p of this.lobby.players) { p.ready = p.pid === 0; p.pending = false; }
    this.broadcast({ k: 'lobbyReturn' });
    this.broadcastLobby();
    this.updateMeta();
  }

  /** Inputs from the host's own client (pid 0) */
  localInput(inp) {
    if (!this.game) return;
    const p = this.game.players.get(0);
    if (p) this.game.applyHeroInput(p.hero, inp);
  }

  dispose() {
    this.disposed = true;
    if (this.ticker) { this.ticker.stop(); this.ticker = null; }
    if (this.game) this.tracker.maybeSave(true);
    this.game = null;
    if (this.transport) this.transport.close();
    this.transport = null;
  }
}
