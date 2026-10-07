// Client session: lobby + game view state for one player (remote, or the host's own player).
import { decodeSnapshot, encodeInput, encodeJson, decodeJson, frameType, MSG } from '../core/net/protocol.js';
import { createTransport } from './netmode.js';
import { ClientWorld } from '../game/world.js';

function getToken() {
  try {
    let t = sessionStorage.getItem('hdr.token');
    if (!t) {
      t = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('hdr.token', t);
    }
    return t;
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

export class ClientSession {
  constructor(app, opts = {}) {
    this.app = app;
    this.host = opts.host || null;
    this.local = !!this.host;
    this.transport = null;
    this.pid = this.local ? 0 : -1;
    this.code = null;
    this.lobby = null;
    this.inGame = false;
    this.startInfo = null;
    this.gs = null;
    this.gsAt = 0;
    this.players = new Map();
    this.world = null;
    this.profileSummary = null;
    this.chat = [];
    this.endInfo = null;
    this.listeners = {};
    this.token = getToken();
    this.closed = false;
  }

  on(type, fn) {
    (this.listeners[type] || (this.listeners[type] = [])).push(fn);
    return () => { this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn); };
  }

  emit(type, data) {
    for (const fn of (this.listeners[type] || []).slice()) {
      try { fn(data); } catch (err) { console.error(`listener ${type}`, err); }
    }
  }

  // ---------------------------------------------------------------------------
  // Remote connection
  // ---------------------------------------------------------------------------
  async joinRemote(code, name) {
    const transport = await createTransport('client');
    this.transport = transport;
    await transport.connect();
    if (this.closed) { transport.close(); throw new Error('Connexion annulée.'); }
    transport.on('binary', (b) => this.onBinary(b));
    transport.on('control', (m) => {
      if (m.t === 'closed') this.onClosed(m.reason || 'La partie est terminée.');
    });
    transport.on('close', () => this.onClosed(transport.lostMessage || 'Connexion perdue.'));
    const joined = transport.waitFor((m) => m.t === 'joined', transport.joinTimeout || 8000);
    transport.sendJson({ t: 'join', code: String(code).toUpperCase(), name, token: this.token });
    await joined;
    this.code = String(code).toUpperCase();
    await new Promise((resolve, reject) => {
      this._welcome = resolve;
      setTimeout(() => reject(new Error("L'hôte ne répond pas.")), 10000);
    });
  }

  onClosed(reason) {
    if (this.closed) return;
    this.closed = true;
    this.emit('closed', reason);
  }

  onBinary(buf) {
    const { type } = frameType(buf);
    if (type === MSG.SNAP) this.receiveSnapshot(buf);
    else if (type === MSG.JSON) {
      let msg;
      try { msg = decodeJson(buf); } catch { return; }
      this.receiveJson(msg);
    }
  }

  // ---------------------------------------------------------------------------
  // Incoming
  // ---------------------------------------------------------------------------
  receiveSnapshot(buf) {
    if (!this.world) return;
    let snap;
    try { snap = decodeSnapshot(buf); } catch (err) { console.error('bad snapshot', err); return; }
    this.world.pushSnapshot(snap);
  }

  playerEntry(pid) {
    let p = this.players.get(pid);
    if (!p) { p = { pid, items: null, stats: null, name: '', classId: '' }; this.players.set(pid, p); }
    return p;
  }

  receiveJson(msg) {
    switch (msg.k) {
      case 'welcome':
        this.pid = msg.pid;
        this.code = msg.code || this.code;
        this.hostName = msg.hostName;
        if (this._welcome) { this._welcome(); this._welcome = null; }
        break;
      case 'lobby':
        this.lobby = msg;
        if (this.host) this.code = msg.code;
        this.emit('lobby', msg);
        break;
      case 'start': {
        this.inGame = true;
        this.startInfo = msg;
        this.endInfo = null;
        for (const p of msg.players) Object.assign(this.playerEntry(p.pid), { name: p.name, classId: p.classId, heroId: p.heroId });
        if (this.world) this.world.dispose();
        this.world = new ClientWorld(this, msg);
        this.emit('start', msg);
        break;
      }
      case 'sync':
        if (this.world) this.world.applySync(msg.events);
        break;
      case 'gs':
        this.gs = msg;
        this.gsAt = performance.now();
        for (const p of msg.players) Object.assign(this.playerEntry(p.pid), { name: p.name, classId: p.classId, heroId: p.heroId });
        this.emit('gs', msg);
        break;
      case 'pi':
        this.playerEntry(msg.pid).items = msg;
        this.emit('pi', msg.pid);
        break;
      case 'pst':
        this.playerEntry(msg.pid).stats = msg;
        this.emit('pst', msg.pid);
        break;
      case 'end':
        this.endInfo = msg;
        this.emit('end', msg);
        break;
      case 'chat':
        this.chat.push(msg);
        if (this.chat.length > 80) this.chat.shift();
        this.emit('chat', msg);
        break;
      case 'ach':
        this.emit('ach', msg.id);
        break;
      case 'pause':
        if (msg.paused && !this.paused) this.pausedCountdown = this.countdown();
        if (!msg.paused && this.paused && this.gs) {
          this.gs.countdown = this.pausedCountdown ?? this.gs.countdown;
          this.gsAt = performance.now();
        }
        this.paused = !!msg.paused;
        this.emit('pause', this.paused);
        break;
      case 'profile':
        this.profileSummary = msg.summary;
        this.emit('profile', msg.summary);
        break;
      case 'lobbyReturn':
        this.inGame = false;
        this.endInfo = null;
        if (this.world) { this.world.dispose(); this.world = null; }
        this.players.clear();
        this.emit('lobbyReturn');
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Outgoing
  // ---------------------------------------------------------------------------
  sendJson(obj) {
    if (this.local) {
      const host = this.host;
      queueMicrotask(() => host.onPeerJson(0, obj));
    } else if (this.transport) {
      this.transport.sendBinary(encodeJson(0, obj));
    }
  }

  sendInput(inp) {
    if (this.local) this.host.localInput(inp);
    else if (this.transport) this.transport.sendBinary(encodeInput(inp));
  }

  action(a) { this.sendJson({ k: 'act', a }); }

  // ---------------------------------------------------------------------------
  // Helpers for the UI
  // ---------------------------------------------------------------------------
  me() { return this.players.get(this.pid) || null; }
  myItems() { const p = this.me(); return p ? p.items : null; }
  myStats() { const p = this.me(); return p ? p.stats : null; }
  isHost() { return this.local; }

  countdown() {
    if (!this.gs || this.gs.countdown < 0) return -1;
    if (this.paused && this.pausedCountdown !== undefined) return this.pausedCountdown;
    return Math.max(0, this.gs.countdown - (performance.now() - this.gsAt) / 1000);
  }

  rtt() {
    return this.transport ? this.transport.rtt : 0;
  }

  leave() {
    this.closed = true;
    if (this.world) { this.world.dispose(); this.world = null; }
    if (this.transport) { this.transport.close(); this.transport = null; }
  }
}
