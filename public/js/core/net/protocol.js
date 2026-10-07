// Binary protocol for snapshots and inputs, JSON for everything else.
// Frame layout (inside relay frames): [addr u8][type u8][payload...]
import { UF } from '../constants.js';

export const MSG = Object.freeze({ SNAP: 1, JSON: 2, INPUT: 3 });
export const ADDR_ALL = 255;
export const ADDR_ALL_DROPPABLE = 254;

const enc = new TextEncoder();
const dec = new TextDecoder();
const QPOS = 64; // position quantization

// ---------------------------------------------------------------------------
// Snapshot building (host)
// ---------------------------------------------------------------------------
export function buildState(g) {
  const units = [];
  for (const u of g.units.values()) {
    if (!u.alive) continue;
    let f = u.statusFlags();
    if (u.kind === 'monster') {
      if (u.elite) f |= UF.ELITE;
      if (u.boss) f |= UF.BOSS;
      if (u.dmgTakenMul < 0.5) f |= UF.SHIELD;
    } else if (u.kind === 'hero') {
      if (u.downed) f |= UF.DOWN;
      if (u.stealthT > 0) f |= UF.STEALTH;
      if (u.untargetable) f |= UF.INVULN;
    }
    const hpFrac = u.maxHp > 0 ? Math.max(0, Math.min(1, u.hp / u.maxHp)) : 0;
    units.push([u.id, u.vis, u.x, u.z, u.rot, hpFrac, f, ((u.anim & 7) << 5) | (u.animCount & 31), u.scale, u.flashT > 0 ? 1 : 0]);
  }
  const projs = [];
  for (const p of g.projectiles) {
    if (!p.alive) continue;
    projs.push([p.id, p.vis, p.x, p.z, p.a, p.h ?? 1]);
  }
  const heroes = g.heroes.map((h) => [
    h.id, h.pid, round1(h.hp), round1(h.maxHp), round1(h.shield), round2(h.moveMul() * (h.S ? 1 : 1)),
    round2(h.reviveProg), Math.floor(h.gold), Math.floor(h.xp), g.xpForLevel(h.level), h.level, h.pendingLevels,
    h.potions, h.dashCharges, h.dashMax, h.buffs.filter((b) => b.t < 900).map((b) => [b.id, round1(b.t), b.stacks || 1, round1(b.dur)]),
    h.forceSeq, h.channel ? h.channel.slot : -1, h.interactT > 0 ? round2(h.interactT) : 0,
    h.cd.map((t) => round2(Math.max(0, Math.min(99, t - g.time)))), h.cdDur.map(round2),
  ]);
  return { units, projs, heroes };
}

function round1(v) { return Math.round(v * 10) / 10; }
function round2(v) { return Math.round(v * 100) / 100; }

/**
 * Encode a snapshot frame.
 * state: from buildState; dmg: flat array [id, amount, flags, pid, ...]; events: array of objects
 */
export function encodeSnapshot(addr, tick, time, state, dmg, events) {
  const json = enc.encode(JSON.stringify({ ev: events, h: state.heroes }));
  const nU = state.units.length, nP = state.projs.length, nD = dmg.length / 4;
  const size = 2 + 4 + 4 + 2 + nU * 15 + 2 + nP * 9 + 2 + nD * 8 + 4 + json.length;
  const buf = new ArrayBuffer(size);
  const dv = new DataView(buf);
  let o = 0;
  dv.setUint8(o, addr); o += 1;
  dv.setUint8(o, MSG.SNAP); o += 1;
  dv.setUint32(o, tick, true); o += 4;
  dv.setFloat32(o, time, true); o += 4;
  dv.setUint16(o, nU, true); o += 2;
  for (const u of state.units) {
    dv.setUint16(o, u[0], true);
    dv.setUint16(o + 2, u[1], true);
    dv.setInt16(o + 4, clamp16(u[2] * QPOS), true);
    dv.setInt16(o + 6, clamp16(u[3] * QPOS), true);
    dv.setUint8(o + 8, angleByte(u[4]));
    dv.setUint8(o + 9, Math.round(u[5] * 255));
    dv.setUint16(o + 10, u[6], true);
    dv.setUint8(o + 12, u[7]);
    dv.setUint8(o + 13, Math.min(255, Math.round(u[8] * 40)));
    dv.setUint8(o + 14, u[9]);
    o += 15;
  }
  dv.setUint16(o, nP, true); o += 2;
  for (const p of state.projs) {
    dv.setUint16(o, p[0], true);
    dv.setUint8(o + 2, p[1]);
    dv.setInt16(o + 3, clamp16(p[2] * QPOS), true);
    dv.setInt16(o + 5, clamp16(p[3] * QPOS), true);
    dv.setUint8(o + 7, angleByte(p[4]));
    dv.setUint8(o + 8, Math.max(0, Math.min(255, Math.round(p[5] * 20))));
    o += 9;
  }
  dv.setUint16(o, nD, true); o += 2;
  for (let i = 0; i < dmg.length; i += 4) {
    dv.setUint16(o, dmg[i], true);
    dv.setFloat32(o + 2, dmg[i + 1], true);
    dv.setUint8(o + 6, dmg[i + 2]);
    dv.setUint8(o + 7, dmg[i + 3] & 255);
    o += 8;
  }
  dv.setUint32(o, json.length, true); o += 4;
  new Uint8Array(buf, o, json.length).set(json);
  return buf;
}

export function decodeSnapshot(buf, offset = 0) {
  const dv = new DataView(buf instanceof ArrayBuffer ? buf : buf.buffer, buf.byteOffset || 0, buf.byteLength);
  let o = offset;
  o += 1; // addr
  o += 1; // type
  const tick = dv.getUint32(o, true); o += 4;
  const time = dv.getFloat32(o, true); o += 4;
  const nU = dv.getUint16(o, true); o += 2;
  const units = new Array(nU);
  for (let i = 0; i < nU; i++) {
    units[i] = {
      id: dv.getUint16(o, true),
      vis: dv.getUint16(o + 2, true),
      x: dv.getInt16(o + 4, true) / QPOS,
      z: dv.getInt16(o + 6, true) / QPOS,
      rot: (dv.getUint8(o + 8) / 256) * Math.PI * 2,
      hp: dv.getUint8(o + 9) / 255,
      flags: dv.getUint16(o + 10, true),
      anim: dv.getUint8(o + 12),
      scale: dv.getUint8(o + 13) / 40,
      flash: dv.getUint8(o + 14),
    };
    o += 15;
  }
  const nP = dv.getUint16(o, true); o += 2;
  const projs = new Array(nP);
  for (let i = 0; i < nP; i++) {
    projs[i] = {
      id: dv.getUint16(o, true),
      vis: dv.getUint8(o + 2),
      x: dv.getInt16(o + 3, true) / QPOS,
      z: dv.getInt16(o + 5, true) / QPOS,
      rot: (dv.getUint8(o + 7) / 256) * Math.PI * 2,
      h: dv.getUint8(o + 8) / 20,
    };
    o += 9;
  }
  const nD = dv.getUint16(o, true); o += 2;
  const dmg = new Array(nD);
  for (let i = 0; i < nD; i++) {
    dmg[i] = { id: dv.getUint16(o, true), amount: dv.getFloat32(o + 2, true), flags: dv.getUint8(o + 6), pid: dv.getUint8(o + 7) };
    o += 8;
  }
  const jl = dv.getUint32(o, true); o += 4;
  const bytes = new Uint8Array(dv.buffer, dv.byteOffset + o, jl);
  const js = JSON.parse(dec.decode(bytes));
  return { tick, time, units, projs, dmg, events: js.ev || [], heroes: js.h || [] };
}

function clamp16(v) {
  v = Math.round(v);
  return v < -32768 ? -32768 : v > 32767 ? 32767 : v;
}

function angleByte(a) {
  let t = a / (Math.PI * 2);
  t -= Math.floor(t);
  return Math.round(t * 256) & 255;
}

// ---------------------------------------------------------------------------
// Input packets (client -> host)
// ---------------------------------------------------------------------------
export function encodeInput(inp) {
  const buf = new ArrayBuffer(2 + 24 + 2 + 2);
  const dv = new DataView(buf);
  dv.setUint8(0, 0);
  dv.setUint8(1, MSG.INPUT);
  dv.setFloat32(2, inp.x, true);
  dv.setFloat32(6, inp.z, true);
  dv.setFloat32(10, inp.ax, true);
  dv.setFloat32(14, inp.az, true);
  dv.setFloat32(18, Number.isFinite(inp.tx) ? inp.tx : NaN, true);
  dv.setFloat32(22, Number.isFinite(inp.tz) ? inp.tz : NaN, true);
  dv.setUint8(26, inp.held & 255);
  dv.setUint8(27, inp.pressed & 255);
  dv.setUint16(28, inp.fs & 0xffff, true);
  return buf;
}

export function decodeInput(buf) {
  const dv = new DataView(buf instanceof ArrayBuffer ? buf : buf.buffer, buf.byteOffset || 0, buf.byteLength);
  return {
    x: dv.getFloat32(2, true), z: dv.getFloat32(6, true),
    ax: dv.getFloat32(10, true), az: dv.getFloat32(14, true),
    tx: dv.getFloat32(18, true), tz: dv.getFloat32(22, true),
    held: dv.getUint8(26), pressed: dv.getUint8(27), fs: dv.getUint16(28, true),
  };
}

// ---------------------------------------------------------------------------
// JSON frames
// ---------------------------------------------------------------------------
export function encodeJson(addr, obj) {
  const body = enc.encode(JSON.stringify(obj));
  const out = new Uint8Array(2 + body.length);
  out[0] = addr;
  out[1] = MSG.JSON;
  out.set(body, 2);
  return out.buffer;
}

export function decodeJson(buf) {
  const u8 = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  return JSON.parse(dec.decode(u8.subarray(2)));
}

export function frameType(buf) {
  const u8 = buf instanceof ArrayBuffer ? new Uint8Array(buf, 0, 2) : new Uint8Array(buf.buffer, buf.byteOffset, 2);
  return { addr: u8[0], type: u8[1] };
}
