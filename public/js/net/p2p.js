// Direct WebRTC connections between the host and the players, used when the game is served without
// its relay server (static hosting such as GitHub Pages). PeerJS's free public service only introduces
// the browsers to each other; game traffic then flows directly (or through PeerJS's TURN relays when a
// network forbids direct connections). The transports emulate the relay server's messages so that
// HostSession / ClientSession work exactly as with the WebSocket transport.
import { Channel } from './transport.js';
import { ADDR_ALL, ADDR_ALL_DROPPABLE } from '../core/net/protocol.js';

const ID_PREFIX = 'heroes-defence-arena-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CHUNK = 16000;          // data channel messages stay below 16 KiB (safe between all browsers)
const CONGESTED = 1 << 20;    // droppable frames are skipped above this backlog
const MAX_PEERS = 8;
const JOIN_TIMEOUT = 20000;

// ---------------------------------------------------------------------------
// PeerJS loading (classic script, only when online play is used)
// ---------------------------------------------------------------------------
let peerJsPromise = null;
function loadPeerJs() {
  if (window.peerjs && window.peerjs.Peer) return Promise.resolve(window.peerjs.Peer);
  if (!peerJsPromise) {
    peerJsPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/peerjs/peerjs.min.js';
      s.async = true;
      s.onload = () => (window.peerjs && window.peerjs.Peer ? resolve(window.peerjs.Peer) : reject(new Error('Module réseau (PeerJS) invalide.')));
      s.onerror = () => { peerJsPromise = null; reject(new Error('Impossible de charger le module réseau (PeerJS).')); };
      document.head.appendChild(s);
    });
  }
  return peerJsPromise;
}

function describeError(err) {
  switch (err && err.type) {
    case 'browser-incompatible': return 'Ce navigateur ne permet pas le jeu en ligne (WebRTC indisponible).';
    case 'peer-unavailable': return "Partie introuvable. Vérifiez le code (l'hôte doit garder la page du jeu ouverte).";
    case 'unavailable-id': return 'Ce code de partie est déjà utilisé, réessayez.';
    case 'network': case 'server-error': case 'socket-error': case 'socket-closed':
      return 'Service de connexion injoignable. Vérifiez votre connexion Internet ou réessayez dans un instant.';
    default: return (err && err.message) || 'Erreur réseau.';
  }
}

function randomCode() {
  let c = '';
  for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}

// ---------------------------------------------------------------------------
// Framing: game frames are split into data channel messages [flag, ...bytes]
// (flag 0: whole frame, 1: part, 2: last part). Channels are reliable and ordered.
// ---------------------------------------------------------------------------
function toU8(buf) {
  if (buf instanceof Uint8Array) return buf;
  if (buf instanceof ArrayBuffer) return new Uint8Array(buf);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

export function packFrame(buf) {
  const u8 = toU8(buf);
  if (u8.length < CHUNK) {
    const out = new Uint8Array(u8.length + 1);
    out.set(u8, 1);
    return [out.buffer];
  }
  const parts = [];
  for (let i = 0; i < u8.length; i += CHUNK) {
    const piece = u8.subarray(i, Math.min(u8.length, i + CHUNK));
    const out = new Uint8Array(piece.length + 1);
    out[0] = i + CHUNK >= u8.length ? 2 : 1;
    out.set(piece, 1);
    parts.push(out.buffer);
  }
  return parts;
}

export class Reassembler {
  constructor() { this.parts = null; this.size = 0; }

  /** Returns a complete frame (ArrayBuffer), or null while parts are missing */
  push(data) {
    const u8 = new Uint8Array(data);
    if (!u8.length) return null;
    if (u8[0] === 0) return data.slice(1);
    if (!this.parts) { this.parts = []; this.size = 0; }
    this.parts.push(u8.slice(1));
    this.size += u8.length - 1;
    if (u8[0] !== 2) return null;
    const out = new Uint8Array(this.size);
    let o = 0;
    for (const p of this.parts) { out.set(p, o); o += p.length; }
    this.parts = null;
    return out.buffer;
  }
}

function sendRaw(conn, data) {
  try { conn.send(data); } catch { /* connection closing */ }
}

// ---------------------------------------------------------------------------
// Host side
// ---------------------------------------------------------------------------
export class P2PHostTransport extends Channel {
  constructor() {
    super();
    this.peer = null;
    this.conns = new Map(); // idx -> { conn, rx, open, kicked }
    this.closed = false;
    this.lostMessage = 'Connexion perdue.';
  }

  async connect() {
    this.Peer = await loadPeerJs();
    this.open = true;
  }

  sendJson(msg) {
    if (msg.t === 'host') this.register(0);
    else if (msg.t === 'kick') this.kick(msg.idx, msg.reason);
    // 'meta' feeds the server's list of open games: no equivalent without a server
  }

  register(attempt) {
    const code = randomCode();
    const peer = new this.Peer(ID_PREFIX + code, { debug: 0 });
    this.peer = peer;
    let registered = false;
    peer.on('open', () => {
      if (this.closed) return;
      registered = true;
      this.code = code;
      this.emit('control', { t: 'hosted', code });
    });
    peer.on('connection', (conn) => this.onConnection(conn));
    peer.on('disconnected', () => {
      // lost the introduction service: running games continue, new players need it back
      if (this.closed || peer.destroyed) return;
      setTimeout(() => { if (!this.closed && !peer.destroyed && peer.disconnected) peer.reconnect(); }, 3000);
    });
    peer.on('error', (err) => {
      if (this.closed) return;
      if (!registered) {
        try { peer.destroy(); } catch { /* ignore */ }
        if (err.type === 'unavailable-id' && attempt < 6) { this.register(attempt + 1); return; }
        this.emit('control', { t: 'error', msg: describeError(err) });
      }
      // after registration, service hiccups are retried on 'disconnected'
    });
  }

  onConnection(conn) {
    if (this.closed) { try { conn.close(); } catch { /* ignore */ } return; }
    if (this.conns.size + 1 >= MAX_PEERS) {
      conn.on('open', () => {
        sendRaw(conn, JSON.stringify({ t: 'closed', reason: 'La partie est pleine.' }));
        setTimeout(() => { try { conn.close(); } catch { /* ignore */ } }, 500);
      });
      return;
    }
    let idx = 1;
    while (this.conns.has(idx)) idx++;
    const entry = { conn, rx: new Reassembler(), open: false, kicked: false };
    this.conns.set(idx, entry);
    conn.on('open', () => {
      if (this.conns.get(idx) !== entry) return;
      entry.open = true;
      const meta = conn.metadata || {};
      this.emit('control', { t: 'peer', idx, name: String(meta.name || 'Joueur').slice(0, 20), token: String(meta.token || '').slice(0, 64) });
    });
    conn.on('data', (data) => {
      if (typeof data === 'string') {
        let m;
        try { m = JSON.parse(data); } catch { return; }
        if (m && m.t === 'ping') sendRaw(conn, JSON.stringify({ t: 'pong', ts: m.ts }));
        return;
      }
      if (!(data instanceof ArrayBuffer) || !entry.open) return;
      const frame = entry.rx.push(data);
      if (!frame || frame.byteLength < 2) return;
      new Uint8Array(frame)[0] = idx; // stamp the sender, like the relay server
      this.emit('binary', frame);
    });
    const gone = () => {
      if (this.conns.get(idx) !== entry) return;
      this.conns.delete(idx);
      if (entry.open && !entry.kicked && !this.closed) this.emit('control', { t: 'peerLeft', idx });
    };
    conn.on('close', gone);
    conn.on('error', gone);
  }

  kick(idx, reason) {
    const e = this.conns.get(idx);
    if (!e) return;
    e.kicked = true;
    this.conns.delete(idx);
    sendRaw(e.conn, JSON.stringify({ t: 'closed', reason: String(reason || 'Vous avez été exclu de la partie.') }));
    setTimeout(() => { try { e.conn.close(); } catch { /* ignore */ } }, 400);
  }

  sendBinary(buf) {
    const addr = toU8(buf)[0];
    const frames = packFrame(buf);
    if (addr === ADDR_ALL || addr === ADDR_ALL_DROPPABLE) {
      for (const e of this.conns.values()) {
        if (!e.open) continue;
        if (addr === ADDR_ALL_DROPPABLE && e.conn.dataChannel && e.conn.dataChannel.bufferedAmount > CONGESTED) continue;
        for (const f of frames) sendRaw(e.conn, f);
      }
    } else {
      const e = this.conns.get(addr);
      if (e && e.open) for (const f of frames) sendRaw(e.conn, f);
    }
  }

  get buffered() {
    let max = 0;
    for (const e of this.conns.values()) if (e.conn.dataChannel) max = Math.max(max, e.conn.dataChannel.bufferedAmount);
    return max;
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.open = false;
    const conns = [...this.conns.values()];
    this.conns.clear();
    for (const e of conns) sendRaw(e.conn, JSON.stringify({ t: 'closed', reason: "L'hôte a quitté la partie." }));
    const peer = this.peer;
    setTimeout(() => {
      for (const e of conns) { try { e.conn.close(); } catch { /* ignore */ } }
      if (peer) { try { peer.destroy(); } catch { /* ignore */ } }
    }, 300);
  }
}

// ---------------------------------------------------------------------------
// Player side
// ---------------------------------------------------------------------------
export class P2PClientTransport extends Channel {
  constructor() {
    super();
    this.peer = null;
    this.conn = null;
    this.rx = new Reassembler();
    this.closed = false;
    this.pingTimer = null;
    this.joinTimeout = JOIN_TIMEOUT + 2000;
    this.lostMessage = "Connexion avec l'hôte perdue.";
    this.timeoutMessage = "L'hôte ne répond pas.";
  }

  async connect(timeoutMs = 12000) {
    const Peer = await loadPeerJs();
    await new Promise((resolve, reject) => {
      let done = false;
      const peer = new Peer({ debug: 0 });
      this.peer = peer;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        try { peer.destroy(); } catch { /* ignore */ }
        reject(new Error('Le service de connexion ne répond pas. Vérifiez votre connexion Internet.'));
      }, timeoutMs);
      peer.on('open', () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        this.open = true;
        resolve();
      });
      peer.on('error', (err) => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          try { peer.destroy(); } catch { /* ignore */ }
          reject(new Error(describeError(err)));
          return;
        }
        if (err.type === 'peer-unavailable') this.emit('control', { t: 'error', code: 'noroom', msg: describeError(err) });
        // other errors: the data connection reports its own failures
      });
    });
  }

  sendJson(msg) {
    if (msg.t === 'join') this.join(msg);
    // 'list' (open games) needs the relay server; pings are handled internally
  }

  join({ code, name, token }) {
    if (!this.peer || this.conn) return;
    const conn = this.peer.connect(ID_PREFIX + String(code).toUpperCase(), { reliable: true, serialization: 'raw', metadata: { name, token } });
    this.conn = conn;
    let opened = false;
    const timer = setTimeout(() => {
      if (opened || this.closed) return;
      this.emit('control', { t: 'error', msg: "Impossible d'établir la connexion avec l'hôte (réseau trop restrictif ?). Réessayez." });
      try { conn.close(); } catch { /* ignore */ }
    }, JOIN_TIMEOUT);
    conn.on('open', () => {
      opened = true;
      clearTimeout(timer);
      // the introduction service is no longer needed: game traffic is direct
      this.emit('control', { t: 'joined', code: String(code).toUpperCase(), idx: 0 });
      this.pingTimer = setInterval(() => { if (conn.open) sendRaw(conn, JSON.stringify({ t: 'ping', ts: performance.now() })); }, 2000);
    });
    conn.on('data', (data) => {
      if (typeof data === 'string') {
        let m;
        try { m = JSON.parse(data); } catch { return; }
        if (!m) return;
        if (m.t === 'pong') {
          const r = performance.now() - m.ts;
          this.rtt = this.rtt ? this.rtt * 0.7 + r * 0.3 : r;
          return;
        }
        this.emit('control', m); // { t: 'closed', reason }
        return;
      }
      if (!(data instanceof ArrayBuffer)) return;
      const frame = this.rx.push(data);
      if (frame) this.emit('binary', frame);
    });
    const lost = () => {
      clearInterval(this.pingTimer);
      if (this.closed || !opened) return;
      this.open = false;
      this.emit('close', {});
    };
    conn.on('close', lost);
    conn.on('error', lost);
  }

  sendBinary(buf) {
    if (!this.conn || !this.conn.open) return;
    for (const f of packFrame(buf)) sendRaw(this.conn, f);
  }

  get buffered() { return this.conn && this.conn.dataChannel ? this.conn.dataChannel.bufferedAmount : 0; }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.open = false;
    clearInterval(this.pingTimer);
    if (this.conn) { try { this.conn.close(); } catch { /* ignore */ } }
    if (this.peer) { try { this.peer.destroy(); } catch { /* ignore */ } }
  }
}
