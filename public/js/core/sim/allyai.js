// AI for hero-side summons and structures.
import { TEAM_HEROES, ANIM } from '../constants.js';
import { dist2 } from '../util/math.js';
import { chainLightning } from './helpers.js';

export const allyMethods = {
  updateAllies(dt) {
    for (const a of this.allies) {
      if (!a.alive) continue;
      this.updateStatuses(a, dt);
      if (!a.alive) continue;
      if (a.spawnT > 0) { a.spawnT -= dt; continue; }
      a.ttl -= dt;
      if (a.ttl <= 0) { this.killAlly(a, null); continue; }
      if (!a.owner || !a.owner.alive) { this.killAlly(a, null); continue; }
      a.atkCd -= dt * (a.atkSpdMul || 1);
      if (!a.canAct()) continue;
      switch (a.def.ai) {
        case 'melee': this.allyMelee(a, dt); break;
        case 'ranged': this.allyRanged(a, dt); break;
        case 'golem': this.allyGolem(a, dt); break;
        case 'infernal': this.allyInfernal(a, dt); break;
        case 'turret': this.allyTurret(a, dt); break;
        case 'tesla': this.allyTesla(a, dt); break;
        case 'drone': this.allyDrone(a, dt); break;
        case 'twin': this.allyFollow(a, dt, -1.4, 0.6); break;
        default: break;
      }
      if (a.anim === ANIM.ATTACK || a.anim === ANIM.CAST) {
        a.animLock -= dt;
        if (a.animLock <= 0) a.anim = ANIM.IDLE;
      }
    }
  },

  allyAcquire(a, dt, range) {
    a.retargetT -= dt;
    const t = a.target;
    if (!t || !t.alive || t.untargetable || a.retargetT <= 0) {
      a.retargetT = 0.4;
      const o = a.owner;
      const leash = a.def.leash || 14;
      const cand = this.nearestEnemy(TEAM_HEROES, a.x, a.z, range, (m) => dist2(m.x, m.z, o.x, o.z) < leash * leash && m.spawnT <= 0);
      a.target = cand;
    }
    return a.target;
  },

  allyMove(a, dx, dz, dt, speed) {
    const d = Math.hypot(dx, dz);
    if (d > 0.001) {
      const s = (speed ?? a.speed) * a.moveMul();
      a.x += (dx / d) * s * dt;
      a.z += (dz / d) * s * dt;
      if (a.anim !== ANIM.ATTACK) a.anim = ANIM.MOVE;
    } else if (a.anim === ANIM.MOVE) a.anim = ANIM.IDLE;
    // separation between allies
    for (const o of a.owner.summons) {
      if (o === a || !o.alive) continue;
      const ex = a.x - o.x, ez = a.z - o.z;
      const rr = a.radius + o.radius;
      const e2 = ex * ex + ez * ez;
      if (e2 < rr * rr && e2 > 1e-6) {
        const e = Math.sqrt(e2);
        a.x += (ex / e) * (rr - e) * 0.5;
        a.z += (ez / e) * (rr - e) * 0.5;
      }
    }
    const [x, z] = this.clampToArena(a.x, a.z, a.radius);
    a.x = x; a.z = z;
  },

  allyFollow(a, dt, ox = 0, oz = 0) {
    const o = a.owner;
    const c = Math.cos(o.rot), s = Math.sin(o.rot);
    // offset relative to owner's facing (ox: side, oz: back)
    const tx = o.x - c * oz + -s * ox;
    const tz = o.z - s * oz + c * ox;
    const dx = tx - a.x, dz = tz - a.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.4) this.allyMove(a, dx, dz, dt, Math.max(a.speed, d * 4));
    else if (a.anim === ANIM.MOVE) a.anim = ANIM.IDLE;
    if (!a.target) a.rot = o.rot;
  },

  allyMelee(a, dt) {
    const def = a.def;
    const t = this.allyAcquire(a, dt, 11);
    if (!t) {
      const o = a.owner;
      const d = Math.sqrt(dist2(a.x, a.z, o.x, o.z));
      if (d > 3.5) this.allyMove(a, o.x - a.x, o.z - a.z, dt, a.speed * (d > 10 ? 1.6 : 1));
      else this.allyMove(a, 0, 0, dt);
      return;
    }
    const d = Math.sqrt(dist2(a.x, a.z, t.x, t.z)) - t.radius - a.radius;
    a.rot = Math.atan2(t.z - a.z, t.x - a.x);
    if (d <= def.range) {
      this.allyMove(a, 0, 0, dt);
      if (a.atkCd <= 0) {
        a.atkCd = def.rate;
        a.setAnim(ANIM.ATTACK, 0.3);
        this.hit(a, t, def.coef, { type: def.type || 'phys', melee: true, summon: true });
      }
    } else {
      this.allyMove(a, t.x - a.x, t.z - a.z, dt);
    }
  },

  allyRanged(a, dt) {
    const def = a.def;
    const t = this.allyAcquire(a, dt, def.range + 2);
    const o = a.owner;
    if (!t) {
      const d = Math.sqrt(dist2(a.x, a.z, o.x, o.z));
      if (d > 4) this.allyMove(a, o.x - a.x, o.z - a.z, dt);
      else this.allyMove(a, 0, 0, dt);
      return;
    }
    const d = Math.sqrt(dist2(a.x, a.z, t.x, t.z));
    a.rot = Math.atan2(t.z - a.z, t.x - a.x);
    if (d > def.range) this.allyMove(a, t.x - a.x, t.z - a.z, dt);
    else if (d < 4) this.allyMove(a, a.x - t.x, a.z - t.z, dt);
    else this.allyMove(a, 0, 0, dt);
    if (a.atkCd <= 0 && d <= def.range + 1) {
      a.atkCd = def.rate;
      a.setAnim(ANIM.CAST, 0.3);
      const frost = a.data.frost > 0;
      this.fireProjectile({
        owner: a, x: a.x, z: a.z, a: a.rot, speed: 20, range: def.range + 4, radius: 0.3, vis: def.proj || 'bone',
        coef: def.coef, type: frost ? 'cold' : (def.type || 'shadow'), hitOpts: { summon: true },
        status: frost ? ['chill', { v: 0.45, dur: 2 }] : null,
      });
    }
  },

  allyGolem(a, dt) {
    const def = a.def;
    a.tauntT = (a.tauntT ?? 0) - dt;
    if (a.tauntT <= 0) {
      a.tauntT = 3;
      for (const m of this.enemiesInRadius(TEAM_HEROES, a.x, a.z, 7)) this.applyStatus(m, 'taunt', { dur: 2.5, by: a });
    }
    const t = this.allyAcquire(a, dt, 12);
    if (!t) {
      const o = a.owner;
      const d = Math.sqrt(dist2(a.x, a.z, o.x, o.z));
      if (d > 4) this.allyMove(a, o.x - a.x, o.z - a.z, dt);
      else this.allyMove(a, 0, 0, dt);
      return;
    }
    const d = Math.sqrt(dist2(a.x, a.z, t.x, t.z)) - t.radius - a.radius;
    a.rot = Math.atan2(t.z - a.z, t.x - a.x);
    if (d <= def.range) {
      this.allyMove(a, 0, 0, dt);
      if (a.atkCd <= 0) {
        a.atkCd = def.rate;
        a.setAnim(ANIM.ATTACK, 0.5);
        const cx = a.x + Math.cos(a.rot) * 1.2, cz = a.z + Math.sin(a.rot) * 1.2;
        this.explode(a, cx, cz, def.slamR, def.coef, { type: 'phys', summon: true, color: 'earth', snd: 'slam', knock: 3 });
      }
    } else this.allyMove(a, t.x - a.x, t.z - a.z, dt);
  },

  allyInfernal(a, dt) {
    const def = a.def;
    a.auraT = (a.auraT ?? 0) - dt;
    if (a.auraT <= 0) {
      a.auraT = 0.5;
      for (const m of this.enemiesInRadius(TEAM_HEROES, a.x, a.z, def.auraR)) this.hit(a, m, def.auraCoef, { type: 'fire', aoe: true, summon: true, proc: true });
    }
    a.tauntT = (a.tauntT ?? 0) - dt;
    if (a.tauntT <= 0) {
      a.tauntT = 4;
      for (const m of this.enemiesInRadius(TEAM_HEROES, a.x, a.z, 6)) this.applyStatus(m, 'taunt', { dur: 2, by: a });
    }
    const t = this.allyAcquire(a, dt, 12);
    if (!t) {
      const o = a.owner;
      const d = Math.sqrt(dist2(a.x, a.z, o.x, o.z));
      if (d > 4) this.allyMove(a, o.x - a.x, o.z - a.z, dt);
      else this.allyMove(a, 0, 0, dt);
      return;
    }
    const d = Math.sqrt(dist2(a.x, a.z, t.x, t.z)) - t.radius - a.radius;
    a.rot = Math.atan2(t.z - a.z, t.x - a.x);
    if (d <= def.range) {
      this.allyMove(a, 0, 0, dt);
      if (a.atkCd <= 0) {
        a.atkCd = def.rate;
        a.setAnim(ANIM.ATTACK, 0.4);
        const cx = a.x + Math.cos(a.rot) * 1.2, cz = a.z + Math.sin(a.rot) * 1.2;
        this.explode(a, cx, cz, 2.4, def.coef, { type: 'fire', summon: true, color: 'fel', snd: 'slam' });
      }
    } else this.allyMove(a, t.x - a.x, t.z - a.z, dt);
  },

  allyTurret(a, dt) {
    const o = a.owner;
    const P = o.P.e_turret;
    if (!P) return;
    let rate = P.rate;
    const oc = o.flags.overclock || 0;
    if (oc > 0 && dist2(a.x, a.z, o.x, o.z) < 49) rate /= 1 + oc / 100;
    const t = this.allyAcquire(a, dt, P.reach);
    if (!t) return;
    a.rot = Math.atan2(t.z - a.z, t.x - a.x);
    if (a.atkCd <= 0) {
      a.atkCd = rate;
      a.setAnim(ANIM.ATTACK, 0.15);
      const critBoom = o.flags.turretCritBoom || 0;
      this.fireProjectile({
        owner: a, x: a.x + Math.cos(a.rot) * 0.7, z: a.z + Math.sin(a.rot) * 0.7, a: a.rot, speed: 30, range: P.reach + 3,
        radius: 0.22, vis: 'bullet', coef: P.coef, type: 'phys', pierce: o.flags.turretPierce ? 2 : 0,
        hitOpts: { summon: true, ability: 'e_turret' },
        status: P.slow > 0 ? ['slow', { v: P.slow / 100, dur: 1.5 }] : null,
        onHit: critBoom > 0 ? (g, p, u) => { if (g.rng.next() * 100 < o.S.critChance) g.explode(a, u.x, u.z, 2, P.coef * critBoom / 100, { type: 'fire', proc: true, summon: true, color: 'fire', snd: false }); } : null,
      });
      this.snd('turret', a.x, a.z);
    }
    if (P.rocket > 0) {
      a.rocketT = (a.rocketT ?? P.rocket) - dt;
      if (a.rocketT <= 0) {
        a.rocketT = P.rocket;
        this.fireProjectile({
          owner: a, x: a.x, z: a.z, a: a.rot, speed: 18, range: P.reach + 3, radius: 0.35, vis: 'rocket', coef: P.coef * 1.5, type: 'fire',
          homing: 4, hitOpts: { summon: true, ability: 'e_turret' }, explode: { r: 2.6, coef: P.coef * 2, type: 'fire', color: 'fire' },
        });
      }
    }
  },

  allyTesla(a, dt) {
    const o = a.owner;
    const P = o.P.e_tesla;
    if (!P) return;
    if (a.data.carried) {
      a.x = o.x; a.z = o.z;
    }
    let rate = P.zapRate;
    const oc = o.flags.overclock || 0;
    if (oc > 0 && dist2(a.x, a.z, o.x, o.z) < 49) rate /= 1 + oc / 100;
    if (a.atkCd > 0) return;
    const foes = this.enemiesInRadius(TEAM_HEROES, a.x, a.z, P.zapRange).filter((m) => m.spawnT <= 0);
    if (!foes.length) return;
    a.atkCd = rate;
    a.setAnim(ANIM.ATTACK, 0.2);
    foes.sort((m1, m2) => dist2(a.x, a.z, m1.x, m1.z) - dist2(a.x, a.z, m2.x, m2.z));
    const n = Math.min(P.targets, foes.length);
    for (let i = 0; i < n; i++) {
      const m = foes[i];
      this.hit(a, m, P.coef, { type: 'light', summon: true, ability: 'e_tesla' });
      if (m.alive) this.applyStatus(m, 'shock', { v: 0.12 * o.S.shockMul, dur: 2 * o.S.shockDur });
      this.fx('zap', { x1: +a.x.toFixed(2), z1: +a.z.toFixed(2), x2: +m.x.toFixed(2), z2: +m.z.toFixed(2), c: 'light', h: 1.6 });
    }
    this.snd('zap', a.x, a.z);
  },

  allyDrone(a, dt) {
    const o = a.owner;
    a.orbit = (a.orbit ?? 0) + dt * 1.5;
    const tx = o.x + Math.cos(a.orbit) * 1.8, tz = o.z + Math.sin(a.orbit) * 1.8;
    a.x += (tx - a.x) * Math.min(1, dt * 6);
    a.z += (tz - a.z) * Math.min(1, dt * 6);
    const t = this.allyAcquire(a, dt, a.def.range);
    if (!t) { a.rot = o.rot; return; }
    a.rot = Math.atan2(t.z - a.z, t.x - a.x);
    if (a.atkCd <= 0) {
      a.atkCd = a.def.rate;
      this.fireProjectile({
        owner: a, x: a.x, z: a.z, a: a.rot, speed: 28, range: a.def.range + 3, radius: 0.2, vis: 'bullet', coef: a.def.coef, type: 'phys',
        ghost: true, hitOpts: { summon: true },
      });
    }
  },
};

export { chainLightning };
