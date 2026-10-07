// Client-side world: snapshot buffer, interpolation, timed event dispatch, persistent entities.
import { VIS_LIST, PROJ_VIS_LIST } from '../core/data/visuals.js';
import { lerp, lerpAngle } from '../core/util/math.js';

const IMMEDIATE = new Set(['force', 'cd', 'cdsync']);

function visKind(name) {
  if (!name) return ['none', ''];
  const i = name.indexOf('_');
  const pre = name.slice(0, i);
  const rest = name.slice(i + 1);
  const kind = { hero: 'hero', mon: 'monster', boss: 'boss', sum: 'summon', tur: 'structure' }[pre] || 'none';
  return [kind, rest];
}

export function heroDataFromArray(a) {
  return {
    id: a[0], pid: a[1], hp: a[2], maxHp: a[3], shield: a[4], moveMul: a[5], revive: a[6], gold: a[7], xp: a[8],
    xpNext: a[9], level: a[10], pending: a[11], potions: a[12], dashCh: a[13], dashMax: a[14], buffs: a[15] || [],
    forceSeq: a[16], channel: a[17], interact: a[18], cd: a[19] || [0, 0, 0, 0, 0, 0], cdDur: a[20] || [0, 0, 0, 0, 0, 0],
  };
}

export class ClientWorld {
  constructor(session, info) {
    this.session = session;
    this.info = info;
    this.snaps = [];
    this.offset = null;
    this.delay = session.local ? 0.045 : 0.11;
    this.units = new Map();
    this.projs = new Map();
    this.areas = new Map();
    this.pickups = new Map();
    this.infos = new Map();
    this.orbits = new Map();
    this.queue = [];
    this.dmgQueue = [];
    this.heroData = new Map();
    this.heroDataAt = 0;
    this.renderTime = 0;
    this.frame = 0;
    this.handlers = new Set();
    this.immediate = new Set();
    this.dmgHandlers = new Set();
    this.latestTime = 0;
  }

  dispose() {
    this.handlers.clear();
    this.immediate.clear();
    this.dmgHandlers.clear();
    this.disposed = true;
  }

  onEvent(fn) { this.handlers.add(fn); return () => this.handlers.delete(fn); }
  onImmediate(fn) { this.immediate.add(fn); return () => this.immediate.delete(fn); }
  onDamage(fn) { this.dmgHandlers.add(fn); return () => this.dmgHandlers.delete(fn); }

  pushSnapshot(snap) {
    const now = performance.now() / 1000;
    const off = now - snap.time;
    if (this.offset === null || off < this.offset || off - this.offset > 1.5) this.offset = off;
    else this.offset += (off - this.offset) * 0.015;
    if (this.snaps.length && snap.time <= this.snaps[this.snaps.length - 1].time) return; // out of order
    snap.umap = null;
    snap.pmap = null;
    this.snaps.push(snap);
    this.latestTime = snap.time;
    for (const a of snap.heroes) {
      const d = heroDataFromArray(a);
      this.heroData.set(d.pid, d);
    }
    this.heroDataAt = now;
    for (const ev of snap.events) {
      if (IMMEDIATE.has(ev.e)) {
        for (const fn of this.immediate) fn(ev);
      } else {
        this.queue.push({ t: snap.time, ev });
      }
    }
    for (const d of snap.dmg) this.dmgQueue.push({ t: snap.time, d });
    // keep buffer small
    while (this.snaps.length > 40) this.snaps.shift();
  }

  /** Apply persistent-state events immediately (reconnect / late join) */
  applySync(events) {
    for (const ev of events) this.dispatch(ev, true);
  }

  unitsMap(snap) {
    if (!snap.umap) {
      snap.umap = new Map();
      for (const u of snap.units) snap.umap.set(u.id, u);
    }
    return snap.umap;
  }

  projMap(snap) {
    if (!snap.pmap) {
      snap.pmap = new Map();
      for (const p of snap.projs) snap.pmap.set(p.id, p);
    }
    return snap.pmap;
  }

  update(nowSec) {
    if (!this.snaps.length) return;
    this.frame++;
    const last = this.snaps[this.snaps.length - 1];
    let rt = nowSec - this.offset - this.delay;
    if (rt > last.time) rt = last.time;
    if (rt < this.renderTime) rt = this.renderTime; // never go back in time
    this.renderTime = rt;
    // find bracketing snapshots
    let bi = this.snaps.length - 1;
    for (let i = 0; i < this.snaps.length; i++) {
      if (this.snaps[i].time >= rt) { bi = i; break; }
    }
    const b = this.snaps[bi];
    const a = bi > 0 ? this.snaps[bi - 1] : b;
    const span = b.time - a.time;
    const k = span > 0 ? Math.max(0, Math.min(1, (rt - a.time) / span)) : 1;
    // drop old snapshots
    while (this.snaps.length > 3 && this.snaps[1].time < rt - 0.4) this.snaps.shift();

    const amap = this.unitsMap(a);
    const frame = this.frame;
    for (const ub of b.units) {
      const ua = amap.get(ub.id);
      let v = this.units.get(ub.id);
      if (!v || v.vis !== ub.vis) {
        const visName = VIS_LIST[ub.vis];
        const [kind, type] = visKind(visName);
        v = { id: ub.id, vis: ub.vis, visName, kind, type, x: ub.x, z: ub.z, rot: ub.rot, born: rt, animCount: -1 };
        this.units.set(ub.id, v);
      }
      if (ua && ua.vis === ub.vis) {
        v.x = lerp(ua.x, ub.x, k);
        v.z = lerp(ua.z, ub.z, k);
        v.rot = lerpAngle(ua.rot, ub.rot, k);
      } else {
        v.x = ub.x; v.z = ub.z; v.rot = ub.rot;
      }
      v.hp = ub.hp;
      v.flags = ub.flags;
      v.animState = ub.anim >> 5;
      const ac = ub.anim & 31;
      if (ac !== v.animCount) { v.animTrigger = v.animCount !== -1; v.animCount = ac; }
      v.scale = ub.scale;
      // hit flash, throttled so units under constant fire still read clearly
      if (ub.flash && nowSec >= (v.flashCool || 0)) { v.flashUntil = nowSec + 0.08; v.flashCool = nowSec + 0.24; }
      v.mark = frame;
    }
    for (const [id, v] of this.units) {
      if (v.mark !== frame) this.units.delete(id);
    }

    const pmap = this.projMap(a);
    for (const pb of b.projs) {
      const pa = pmap.get(pb.id);
      let v = this.projs.get(pb.id);
      if (!v || v.vis !== pb.vis) {
        v = { id: pb.id, vis: pb.vis, visName: PROJ_VIS_LIST[pb.vis], x: pb.x, z: pb.z, rot: pb.rot, h: pb.h };
        this.projs.set(pb.id, v);
      }
      if (pa && pa.vis === pb.vis) {
        v.x = lerp(pa.x, pb.x, k);
        v.z = lerp(pa.z, pb.z, k);
        v.h = lerp(pa.h, pb.h, k);
        v.rot = lerpAngle(pa.rot, pb.rot, k);
      } else {
        v.x = pb.x; v.z = pb.z; v.h = pb.h; v.rot = pb.rot;
      }
      v.mark = frame;
    }
    for (const [id, v] of this.projs) if (v.mark !== frame) this.projs.delete(id);

    // timed events
    let n = 0;
    while (this.queue.length && this.queue[0].t <= rt + 1e-6 && n++ < 2000) {
      const { ev } = this.queue.shift();
      this.dispatch(ev, false);
    }
    n = 0;
    while (this.dmgQueue.length && this.dmgQueue[0].t <= rt + 1e-6 && n++ < 4000) {
      const { d } = this.dmgQueue.shift();
      for (const fn of this.dmgHandlers) fn(d);
    }
    // orbit visuals expire if not refreshed
    for (const [key, o] of this.orbits) if (o.until < rt) this.orbits.delete(key);
  }

  dispatch(ev, sync) {
    switch (ev.e) {
      case 'area+':
        this.areas.set(ev.id, Object.assign({}, ev, { born: this.renderTime }));
        break;
      case 'area-': {
        const a = this.areas.get(ev.id);
        if (a) { a.dead = true; this.areas.delete(ev.id); }
        break;
      }
      case 'pick+':
        this.pickups.set(ev.id, Object.assign({}, ev, { born: this.renderTime }));
        break;
      case 'pick-':
        this.pickups.delete(ev.id);
        break;
      case 'info':
        this.infos.set(ev.u, ev);
        break;
      case 'fx':
        if (ev.t === 'orbit') {
          this.orbits.set(ev.k, Object.assign({}, ev, { until: this.renderTime + 1.6 }));
          return;
        }
        break;
      default:
        break;
    }
    if (!sync) for (const fn of this.handlers) fn(ev);
  }

  heroIdOf(pid) {
    const d = this.heroData.get(pid);
    if (d) return d.id;
    const p = this.session.players.get(pid);
    return p ? p.heroId : 0;
  }

  myHeroData() { return this.heroData.get(this.session.pid) || null; }
  myHeroView() { return this.units.get(this.heroIdOf(this.session.pid)) || null; }

  pidOfUnit(unitId) {
    for (const d of this.heroData.values()) if (d.id === unitId) return d.pid;
    return -1;
  }
}
