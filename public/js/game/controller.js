// Local player controller: predicted movement, movement abilities, forced moves, input packets.
import { IN, UF, ARENA_RADIUS, SLOTS, PHASE } from '../core/constants.js';
import { ABILITIES, CLASSES } from '../core/data/classes/index.js';
import { ARENAS } from '../core/data/arenas.js';

const SLOT_ACTIONS = [null, null, 'skill1', 'skill2', 'ultimate', 'dash'];

export class Controller {
  constructor(session, world, input, view) {
    this.session = session;
    this.world = world;
    this.input = input;
    this.view = view; // GameView: provides mouseGround(), onLocalCast()
    this.arena = ARENAS[world.info.arena] || ARENAS.colosseum;
    this.x = 0; this.z = 0;
    this.ready = false;
    this.motion = null;
    this.push = null;
    this.fs = 0;
    this.lastSend = 0;
    this.pressedAcc = 0;
    this.tx = NaN; this.tz = NaN;
    this.ax = 0; this.az = 0;
    this.localCd = [0, 0, 0, 0, 0, 0];
    this.localCdDur = [0, 0, 0, 0, 0, 0];
    this.localCdAt = [0, 0, 0, 0, 0, 0];
    this.serverCd = [0, 0, 0, 0, 0, 0];
    this.serverCdAt = 0;
    this.primaryNext = 0;
    this.height = 0;
    this.moveDir = [0, 0];
    this.moving = false;
    this.offImmediate = world.onImmediate((ev) => this.onImmediate(ev));
  }

  dispose() { if (this.offImmediate) this.offImmediate(); }

  stats() { const s = this.session.myStats(); return s ? s.S : null; }
  params(abId) { const s = this.session.myStats(); return s && s.P ? s.P[abId] : null; }

  classDef() {
    const me = this.session.me();
    return me ? CLASSES[me.classId] : null;
  }

  onImmediate(ev) {
    const pid = this.session.pid;
    if (ev.pid !== pid) return;
    if (ev.e === 'force') {
      this.fs = Math.max(this.fs, ev.seq);
      if (ev.m === 'tp') {
        this.x = ev.x; this.z = ev.z;
        this.motion = null;
      } else {
        this.push = { dx: ev.dx, dz: ev.dz, dur: Math.max(0.05, ev.d || 0.3), t: 0 };
        this.motion = null;
      }
    } else if (ev.e === 'cd') {
      const now = performance.now() / 1000;
      if (ev.fail) {
        this.localCd[ev.s] = now + (ev.r || 0);
        this.localCdDur[ev.s] = ev.r || 0;
      } else {
        this.localCd[ev.s] = now + ev.r;
        this.localCdDur[ev.s] = ev.d;
      }
      this.localCdAt[ev.s] = now;
    } else if (ev.e === 'cdsync') {
      const now = performance.now() / 1000;
      for (let s = 1; s < 6; s++) this.localCd[s] = now + ev.r[s];
    }
  }

  /** Remaining cooldown for UI: [remaining, total] */
  cooldown(slot) {
    const now = performance.now() / 1000;
    const hd = this.world.myHeroData();
    let rem = Math.max(0, this.localCd[slot] - now);
    let total = this.localCdDur[slot] || 1;
    if (hd) {
      const age = now - this.world.heroDataAt;
      const srem = Math.max(0, (hd.cd[slot] || 0) - age);
      // trust local prediction for a short while after a press, else the server
      if (now - this.localCdAt[slot] > 0.6) {
        rem = slot === 5 && hd.dashCh > 0 ? 0 : srem;
        total = hd.cdDur[slot] || total;
      } else if (srem > rem + 0.2) {
        rem = srem;
        total = hd.cdDur[slot] || total;
      }
    }
    return [rem, total];
  }

  canAct(view, hd) {
    if (!view || !hd) return false;
    if (hd.hp <= 0 || (view.flags & UF.DOWN)) return false;
    if (view.flags & (UF.STUN | UF.FROZEN)) return false;
    return true;
  }

  update(dt, nowSec, uiBlocksWorld) {
    const view = this.world.myHeroView();
    const hd = this.world.myHeroData();
    const S = this.stats();
    if (!view || !hd || !S) return;
    if (!this.ready) {
      this.ready = true;
      this.x = view.x; this.z = view.z;
      this.fs = hd.forceSeq;
    }
    // large divergence (reconnect, desync): snap to server
    const dx0 = view.x - this.x, dz0 = view.z - this.z;
    if (dx0 * dx0 + dz0 * dz0 > 36 && !this.motion && !this.push) { this.x = view.x; this.z = view.z; }

    const downed = hd.hp <= 0 || (view.flags & UF.DOWN);
    const inp = this.input;
    const aim = this.view.mouseGround();
    if (aim) { this.ax = aim.x; this.az = aim.z; }

    let held = 0, pressed = 0;
    this.tx = NaN; this.tz = NaN;
    const canAct = this.canAct(view, hd) && !uiBlocksWorld;
    const cls = this.classDef();

    // ---- movement input
    let mx = 0, mz = 0;
    if (!downed && inp.enabled) {
      if (inp.down('up')) mz -= 1;
      if (inp.down('down')) mz += 1;
      if (inp.down('left')) mx -= 1;
      if (inp.down('right')) mx += 1;
    }
    const ml = Math.hypot(mx, mz);
    if (ml > 0) { mx /= ml; mz /= ml; }
    this.moveDir = [mx, mz];

    // ---- forced push
    if (this.push) {
      const p = this.push;
      const step = Math.min(dt, p.dur - p.t);
      p.t += step;
      this.x += (p.dx / p.dur) * step;
      this.z += (p.dz / p.dur) * step;
      [this.x, this.z] = this.clampPos(this.x, this.z, 0.55);
      if (p.t >= p.dur - 1e-4) this.push = null;
    }

    // ---- abilities
    if (canAct && cls) {
      if (inp.mouse.down[0] && !uiBlocksWorld) held |= IN.PRIMARY;
      if (inp.mouse.down[2] && !uiBlocksWorld) held |= IN.SECONDARY;
      if (inp.mouse.pressed[2] && !uiBlocksWorld) pressed |= IN.SECONDARY;
      if (inp.mouse.pressed[0] && !uiBlocksWorld) pressed |= IN.PRIMARY;
      for (let s = 2; s <= 5; s++) {
        const act = SLOT_ACTIONS[s];
        if (inp.down(act)) held |= 1 << s;
        if (inp.justPressed(act)) pressed |= 1 << s;
      }
      // primary local animation prediction
      if ((held & IN.PRIMARY) && nowSec >= this.primaryNext) {
        const P = this.params(cls.abilities[0]);
        if (P && P.interval) {
          this.primaryNext = nowSec + P.interval;
          this.view.onLocalCast(0);
        }
      }
      // other slots: predict cooldown + movement abilities
      for (let s = 1; s <= 5; s++) {
        if (!(pressed & (1 << s))) continue;
        const abId = cls.abilities[s];
        const ab = ABILITIES[abId];
        const P = this.params(abId);
        if (!P) continue;
        const [rem] = this.cooldown(s);
        const ok = s === 5
          ? hd.dashCh > 0 && (nowSec - (this.lastDashAt || 0) > 0.4 || hd.dashCh > 1)
          : rem <= 0.05;
        if (!ok) {
          if (ab.move) pressed &= ~(1 << s); // don't send moves we cannot predict
          continue;
        }
        if (ab.move) {
          if (this.motion || (view.flags & UF.ROOT)) { pressed &= ~(1 << s); continue; }
          this.startMove(ab, P, mx, mz);
        }
        if (s !== 5) {
          this.localCd[s] = nowSec + (P.cd || 0);
          this.localCdDur[s] = P.cd || 0;
          this.localCdAt[s] = nowSec;
        } else {
          this.lastDashAt = nowSec;
          this.localCdAt[s] = nowSec;
          this.localCd[s] = nowSec + (hd.dashCh > 1 ? 0 : P.cd || 0);
          this.localCdDur[s] = P.cd || 0;
        }
        this.view.onLocalCast(s);
      }
      if (inp.justPressed('potion')) pressed |= IN.POTION;
    }
    if (!downed && inp.down('interact') && !uiBlocksWorld) held |= IN.INTERACT;
    if (!downed && inp.justPressed('interact') && !uiBlocksWorld) pressed |= IN.INTERACT;

    // ---- motion (dash / leap)
    this.height = 0;
    if (this.motion) {
      const m = this.motion;
      m.t += dt;
      const k = Math.min(1, m.t / m.dur);
      const e = m.kind === 'dash' ? 1 - (1 - k) * (1 - k) : k;
      this.x = m.x0 + (m.x1 - m.x0) * e;
      this.z = m.z0 + (m.z1 - m.z0) * e;
      if (m.kind === 'leap') this.height = Math.sin(k * Math.PI) * Math.min(4, 1 + m.len * 0.3);
      if (k >= 1) this.motion = null;
    } else if (!downed && !this.push) {
      // ---- regular movement
      const speed = (S.moveSpeed || 6) * (hd.moveMul ?? 1);
      if (ml > 0 && speed > 0) {
        this.x += mx * speed * dt;
        this.z += mz * speed * dt;
      }
      this.collideMonsters(S);
      [this.x, this.z] = this.clampPos(this.x, this.z, 0.55);
    }
    if (downed) { this.x = view.x; this.z = view.z; }
    this.moving = ml > 0 && !downed;

    // ---- send input
    this.pressedAcc |= pressed;
    const sendNow = this.pressedAcc !== 0 || nowSec - this.lastSend >= 1 / 30;
    if (sendNow) {
      this.session.sendInput({
        x: this.x, z: this.z, ax: this.ax, az: this.az,
        tx: this.motionTarget ? this.motionTarget[0] : NaN, tz: this.motionTarget ? this.motionTarget[1] : NaN,
        held, pressed: this.pressedAcc, fs: this.fs,
      });
      this.pressedAcc = 0;
      this.lastSend = nowSec;
      this.motionTarget = null;
    }
  }

  startMove(ab, P, mx, mz) {
    const kind = ab.move.kind;
    const dist = P[ab.move.dist] || 6;
    const x0 = this.x, z0 = this.z;
    let dx, dz;
    if (kind === 'dash' && (mx || mz)) { dx = mx; dz = mz; }
    else { dx = this.ax - x0; dz = this.az - z0; }
    let len = Math.hypot(dx, dz);
    if (len < 0.001) { dx = 1; dz = 0; len = 1; }
    dx /= len; dz /= len;
    let travel = dist;
    if (kind !== 'dash') travel = Math.min(dist, Math.hypot(this.ax - x0, this.az - z0));
    if (kind === 'dash') {
      // stop at obstacles along the path
      let t = 0;
      const step = 0.25;
      while (t + step <= travel) {
        const nx = x0 + dx * (t + step), nz = z0 + dz * (t + step);
        if (this.blocked(nx, nz, 0.5)) break;
        t += step;
      }
      travel = t;
    }
    let [x1, z1] = this.clampPos(x0 + dx * travel, z0 + dz * travel, 0.55);
    this.motionTarget = [x1, z1];
    if (kind === 'blink') {
      this.x = x1; this.z = z1;
      return;
    }
    const dur = kind === 'leap' ? (P[ab.move.dur] || 0.5) : (P[ab.move.dur] || 0.22);
    this.motion = { kind, x0, z0, x1, z1, t: 0, dur, len: travel };
  }

  blocked(x, z, r) {
    if (Math.hypot(x, z) > ARENA_RADIUS - r) return true;
    for (const o of this.arena.obstacles) {
      const dx = x - o.x, dz = z - o.z;
      if (dx * dx + dz * dz < (o.r + r) * (o.r + r)) return true;
    }
    return false;
  }

  clampPos(x, z, r) {
    const lim = ARENA_RADIUS - r;
    const d = Math.hypot(x, z);
    if (d > lim) { x = (x / d) * lim; z = (z / d) * lim; }
    for (const o of this.arena.obstacles) {
      const dx = x - o.x, dz = z - o.z;
      const dd = Math.hypot(dx, dz), min = o.r + r;
      if (dd < min) {
        if (dd < 0.001) { x = o.x + min; continue; }
        x = o.x + (dx / dd) * min;
        z = o.z + (dz / dd) * min;
      }
    }
    return [x, z];
  }

  collideMonsters(S) {
    if (S && S.ghostWalk) return;
    const r = 0.55;
    for (const u of this.world.units.values()) {
      if (u.kind !== 'monster' && u.kind !== 'boss') continue;
      if (u.flags & UF.SPAWNING) continue;
      const ur = (u.kind === 'boss' ? 1.6 : 0.45) * (u.scale || 1);
      const dx = this.x - u.x, dz = this.z - u.z;
      const rr = r + ur;
      const d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const push = (rr - d) * 0.6;
      this.x += (dx / d) * push;
      this.z += (dz / d) * push;
    }
  }
}

export { SLOTS, PHASE };
