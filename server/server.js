// Heroes Defence - static file server + WebSocket room relay.
// The game simulation runs in the host's browser; this server only serves the
// client files and relays messages between the host and the other players.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const THREE_DIR = path.join(ROOT, 'node_modules', 'three');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
};

// URL prefix -> directory on disk
const MOUNTS = [
  ['/vendor/three/', path.join(THREE_DIR, 'build')],
  ['/vendor/three-addons/', path.join(THREE_DIR, 'examples', 'jsm')],
  ['/', PUBLIC_DIR],
];

const VIRTUAL_IF = /vmware|virtualbox|vbox|vethernet|wsl|docker|hyper-v|loopback|tailscale|zerotier|hamachi|bluetooth|npcap|vpn|tap|tun/i;

/** LAN addresses of this machine, most likely "real" network first */
function lanUrls() {
  const list = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family !== 'IPv4' && net.family !== 4) continue;
      if (net.internal || net.address.startsWith('169.254.')) continue;
      let score = 0;
      if (VIRTUAL_IF.test(name)) score += 10;
      if (/wi-?fi|wlan|wireless|ethernet|^eth|^en\d|^wl/i.test(name)) score -= 2;
      if (net.address.startsWith('192.168.')) score -= 1;
      if (net.address.endsWith('.1')) score += 2; // typical of host-only / virtual adapters
      list.push({ url: `http://${net.address}:${PORT}`, score, name });
    }
  }
  list.sort((a, b) => a.score - b.score);
  return list.map((x) => x.url);
}

function resolveFile(urlPath) {
  for (const [prefix, dir] of MOUNTS) {
    if (!urlPath.startsWith(prefix)) continue;
    const rel = urlPath.slice(prefix.length) || 'index.html';
    const full = path.resolve(dir, rel);
    if (!full.startsWith(dir)) return null; // path traversal
    return full;
  }
  return null;
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400); res.end('Bad request'); return;
  }
  if (urlPath === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  if (urlPath === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    res.end(JSON.stringify({ publicUrl: process.env.PUBLIC_URL || null, lanUrls: lanUrls(), port: PORT }));
    return;
  }
  let file = resolveFile(urlPath);
  if (!file) { res.writeHead(404); res.end('Not found'); return; }
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err2, data) => {
      if (err2) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    });
  });
});

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_PEERS = 8;
const ADDR_BROADCAST = 255;          // reliable broadcast to every client
const ADDR_BROADCAST_DROPPABLE = 254; // snapshots: skipped for congested clients
const CONGESTED_BYTES = 1 << 20;

/** @type {Map<string, {code:string, host:any, peers:Map<number, any>, meta:object, created:number}>} */
const rooms = new Map();

function makeCode() {
  for (let attempt = 0; attempt < 1000; attempt++) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!rooms.has(c)) return c;
  }
  throw new Error('No room code available');
}

function sendJson(ws, obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function closeRoom(room, reason) {
  for (const peer of room.peers.values()) {
    sendJson(peer, { t: 'closed', reason });
    peer.room = null;
    try { peer.close(); } catch { /* ignore */ }
  }
  room.peers.clear();
  rooms.delete(room.code);
  log(`room ${room.code} closed (${reason})`);
}

function log(...args) {
  const t = new Date().toISOString().slice(11, 19);
  console.log(`[${t}]`, ...args);
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4 * 1024 * 1024 });

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.room = null;
  ws.role = null; // 'host' | 'peer'
  ws.idx = -1;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data, isBinary) => {
    if (isBinary) { relayBinary(ws, data); return; }
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    handleControl(ws, msg);
  });

  ws.on('close', () => {
    const room = ws.room;
    if (!room) return;
    if (ws.role === 'host') {
      closeRoom(room, "L'hôte a quitté la partie.");
    } else if (ws.role === 'peer') {
      room.peers.delete(ws.idx);
      sendJson(room.host, { t: 'peerLeft', idx: ws.idx });
      log(`room ${room.code}: peer ${ws.idx} left`);
    }
    ws.room = null;
  });
  ws.on('error', () => { /* handled by close */ });
});

function handleControl(ws, msg) {
  switch (msg.t) {
    case 'ping':
      sendJson(ws, { t: 'pong', ts: msg.ts });
      break;
    case 'list': {
      const list = [];
      for (const r of rooms.values()) {
        list.push({ code: r.code, ...r.meta, players: r.meta.players ?? (r.peers.size + 1) });
      }
      sendJson(ws, { t: 'rooms', rooms: list });
      break;
    }
    case 'host': {
      if (ws.room) return;
      const code = makeCode();
      const room = { code, host: ws, peers: new Map(), meta: { name: String(msg.name || 'Hôte').slice(0, 24), state: 'lobby', max: 4 }, created: Date.now() };
      rooms.set(code, room);
      ws.room = room;
      ws.role = 'host';
      ws.idx = 0;
      sendJson(ws, { t: 'hosted', code });
      log(`room ${code} created by ${room.meta.name}`);
      break;
    }
    case 'meta': {
      if (ws.role !== 'host' || !ws.room) return;
      const m = msg.meta || {};
      Object.assign(ws.room.meta, {
        name: String(m.name ?? ws.room.meta.name).slice(0, 24),
        state: String(m.state ?? ws.room.meta.state).slice(0, 16),
        max: Number(m.max ?? ws.room.meta.max) || 4,
        players: Number(m.players ?? 1) || 1,
        wave: Number(m.wave ?? 0) || 0,
      });
      break;
    }
    case 'join': {
      if (ws.room) return;
      const code = String(msg.code || '').toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) { sendJson(ws, { t: 'error', code: 'noroom', msg: 'Partie introuvable. Vérifiez le code.' }); return; }
      if (room.peers.size + 1 >= MAX_PEERS) { sendJson(ws, { t: 'error', code: 'full', msg: 'La partie est pleine.' }); return; }
      let idx = 1;
      while (room.peers.has(idx)) idx++;
      ws.room = room;
      ws.role = 'peer';
      ws.idx = idx;
      room.peers.set(idx, ws);
      sendJson(ws, { t: 'joined', code, idx });
      sendJson(room.host, { t: 'peer', idx, name: String(msg.name || 'Joueur').slice(0, 20), token: String(msg.token || '').slice(0, 64) });
      log(`room ${code}: peer ${idx} joined (${msg.name})`);
      break;
    }
    case 'kick': {
      if (ws.role !== 'host' || !ws.room) return;
      const peer = ws.room.peers.get(Number(msg.idx));
      if (peer) {
        sendJson(peer, { t: 'closed', reason: String(msg.reason || 'Vous avez été exclu de la partie.') });
        ws.room.peers.delete(peer.idx);
        peer.room = null;
        try { peer.close(); } catch { /* ignore */ }
      }
      break;
    }
    case 'leave': {
      try { ws.close(); } catch { /* ignore */ }
      break;
    }
    default:
      break;
  }
}

function relayBinary(ws, data) {
  const room = ws.room;
  if (!room || data.length < 2) return;
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (ws.role === 'host') {
    const addr = buf[0];
    if (addr === ADDR_BROADCAST || addr === ADDR_BROADCAST_DROPPABLE) {
      for (const peer of room.peers.values()) {
        if (peer.readyState !== 1) continue;
        if (addr === ADDR_BROADCAST_DROPPABLE && peer.bufferedAmount > CONGESTED_BYTES) continue;
        peer.send(buf, { binary: true });
      }
    } else {
      const peer = room.peers.get(addr);
      if (peer && peer.readyState === 1) peer.send(buf, { binary: true });
    }
  } else if (ws.role === 'peer') {
    buf[0] = ws.idx; // stamp sender
    if (room.host.readyState === 1) room.host.send(buf, { binary: true });
  }
}

// Heartbeat: drop dead connections
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch { /* ignore */ }
  }
}, 15000);

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  ⚔  Heroes Defence - L\'Arène des Damnés');
  console.log('  ----------------------------------------');
  console.log(`  Local :   http://localhost:${PORT}`);
  for (const u of lanUrls()) console.log(`  Réseau :  ${u}`);
  if (process.env.PUBLIC_URL) console.log(`  Public :  ${process.env.PUBLIC_URL}`);
  console.log('');
  if (!process.env.HD_SHARE) {
    console.log('  Pour inviter des amis sur Internet : npm run share');
    console.log('  (tunnel Cloudflare gratuit, voir README.md).');
    console.log('');
  }
});
