// Projectiles, ground areas (incl. telegraphs), pickups, minions and monster spawning.
import { TEAM_HEROES, TEAM_MONSTERS, ARENA_RADIUS, PICKUP_RANGE } from '../constants.js';
import { segPointDist2, dist2, angleDiff, clamp } from '../util/math.js';
import { Monster, Ally } from './units.js';
import { MONSTERS } from '../data/monsters.js';
import { SUMMONS } from '../data/summons.js';
import { PROJ_VIS_IDS } from '../data/visuals.js';

const tmpHits = [];

export const entityMethods = {
  // ---------------------------------------------------------------------------
  // Projectiles
  // ---------------------------------------------------------------------------
  /**
   * o: { owner, x, z, a, speed, range, radius, vis, coef|dmg, type, ability, pierce, bounce, bounceRange,
   *      homing, explode:{r, coef, type}, status:[kind, opts], onHit, onEnd, hitOpts, ghost, returning, lob }
   */
  fireProjectile(o) {
    const owner = o.owner;
    const p = {
      id: this.allocProjId(),
      alive: true,
      owner,
      hero: owner ? (owner.kind === 'hero' ? owner : owner.owner || null) : null,
      team: o.team ?? (owner ? owner.team : TEAM_MONSTERS),
      x: o.x ?? owner.x,
      z: o.z ?? owner.z,
      a: o.a ?? 0,
      speed: o.speed ?? 20,
      range: o.range ?? 20,
      traveled: 0,
      radius: o.radius ?? 0.3,
      vis: PROJ_VIS_IDS[o.vis] ?? 0,
      coef: o.coef ?? 1,
      dmg: o.dmg ?? 0,
      type: o.type || 'phys',
      ability: o.ability || null,
      pierce: o.pierce ?? 0,
      bounce: o.bounce ?? 0,
      bounceRange: o.bounceRange ?? 7,
      homing: o.homing ?? 0,
      homingT: 0,
      homingTarget: null,
      explode: o.explode || null,
      status: o.status || null,
      onHit: o.onHit || null,
      onEnd: o.onEnd || null,
      hitOpts: o.hitOpts || null,
      ghost: !!o.ghost,
      returning: o.returning || 0,
      back: false,
      lob: null,
      h: o.h ?? 1,
      hitSet: new Set(),
      data: o.data || {},
      mult: o.mult ?? 1,
      aoe: !!o.aoe,
    };
    if (o.lob) {
      p.lob = { t: 0, dur: o.lob.dur, x0: p.x, z0: p.z, x1: o.lob.x, z1: o.lob.z, h: o.lob.h ?? 3 };
      p.a = Math.atan2(o.lob.z - p.z, o.lob.x - p.x);
    }
    this.projectiles.push(p);
    return p;
  },

  updateProjectiles(dt) {
    const list = this.projectiles;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!p.alive) continue;
      if (p.lob) {
        const L = p.lob;
        L.t += dt;
        const k = Math.min(1, L.t / L.dur);
        p.x = L.x0 + (L.x1 - L.x0) * k;
        p.z = L.z0 + (L.z1 - L.z0) * k;
        p.h = 0.6 + Math.sin(k * Math.PI) * L.h;
        if (k >= 1) {
          p.alive = false;
          if (p.onEnd) p.onEnd(this, p);
          else if (p.explode) this.projExplode(p, p.x, p.z);
        }
        continue;
      }
      if (p.homing > 0) this.steerProjectile(p, dt);
      if (p.back) {
        const o = p.owner;
        if (!o || !o.alive) { p.alive = false; continue; }
        p.a = Math.atan2(o.z - p.z, o.x - p.x);
        if (dist2(p.x, p.z, o.x, o.z) < 0.8) { p.alive = false; continue; }
      }
      const ox = p.x, oz = p.z;
      const step = p.speed * dt;
      p.x += Math.cos(p.a) * step;
      p.z += Math.sin(p.a) * step;
      p.traveled += step;
      if (!p.ghost && this.projBlocked(p)) {
        p.alive = false;
        if (p.explode) this.projExplode(p, p.x, p.z);
        if (p.onEnd) p.onEnd(this, p);
        this.fx('spark', { x: p.x, z: p.z, c: p.type });
        continue;
      }
      // collisions
      tmpHits.length = 0;
      const pr = p.radius;
      const test = (u) => {
        if (!u.alive || u.untargetable || p.hitSet.has(u.id)) return;
        if (u.kind === 'hero' && u.downed) return;
        if (u.kind === 'monster' && u.spawnT > 0) return;
        const rr = pr + u.radius;
        if (segPointDist2(ox, oz, p.x, p.z, u.x, u.z) <= rr * rr) tmpHits.push(u);
      };
      if (p.team === TEAM_HEROES) {
        const mx = (ox + p.x) / 2, mz = (oz + p.z) / 2;
        this.grid.forEachNear(mx, mz, step / 2 + pr + 3, test);
      } else {
        for (const h of this.heroes) test(h);
        for (const a of this.allies) test(a);
      }
      if (tmpHits.length > 1) tmpHits.sort((a, b) => dist2(ox, oz, a.x, a.z) - dist2(ox, oz, b.x, b.z));
      for (let k = 0; k < tmpHits.length && p.alive; k++) this.projectileHit(p, tmpHits[k]);
      if (!p.alive) continue;
      if (p.traveled >= p.range) {
        if (p.returning && !p.back) {
          p.back = true;
          p.hitSet.clear();
          p.traveled = 0;
          p.range = 999;
          continue;
        }
        p.alive = false;
        if (p.explode && p.explodeOnEnd !== false) this.projExplode(p, p.x, p.z);
        if (p.onEnd) p.onEnd(this, p);
      }
    }
    if (this.tick % 15 === 0 || list.length > 400) this.projectiles = list.filter((p) => p.alive);
  },

  projBlocked(p) {
    if (p.x * p.x + p.z * p.z > (ARENA_RADIUS + 2) * (ARENA_RADIUS + 2)) return true;
    for (const o of this.obstacles) {
      const dx = p.x - o.x, dz = p.z - o.z;
      if (dx * dx + dz * dz < o.r * o.r) return true;
    }
    return false;
  },

  steerProjectile(p, dt) {
    p.homingT -= dt;
    if (p.homingT <= 0 || !p.homingTarget || !p.homingTarget.alive) {
      p.homingT = 0.2;
      const range = 12;
      p.homingTarget = p.team === TEAM_HEROES
        ? this.nearestEnemy(TEAM_HEROES, p.x + Math.cos(p.a) * 3, p.z + Math.sin(p.a) * 3, range, (u) => !p.hitSet.has(u.id))
        : this.nearestEnemy(TEAM_MONSTERS, p.x, p.z, range);
    }
    const t = p.homingTarget;
    if (!t) return;
    const want = Math.atan2(t.z - p.z, t.x - p.x);
    const d = angleDiff(p.a, want);
    const maxTurn = p.homing * dt;
    p.a += clamp(d, -maxTurn, maxTurn);
  },

  projectileHit(p, u) {
    p.hitSet.add(u.id);
    if (p.team === TEAM_HEROES) {
      // frontal shields block hero projectiles
      if (u.def && u.def.shield && u.canAct()) {
        const incoming = Math.atan2(p.z - u.z, p.x - u.x);
        if (Math.abs(angleDiff(u.rot, incoming)) < 1.05) {
          p.alive = false;
          this.fx('block', { x: p.x, z: p.z });
          this.snd('block', p.x, p.z);
          return;
        }
      }
      const opts = Object.assign({ type: p.type, ability: p.ability, projectile: true, mult: p.mult, aoe: p.aoe }, p.hitOpts);
      if (p.coef > 0) this.hit(p.owner, u, p.coef, opts);
      if (p.status && u.alive) this.applyStatus(u, p.status[0], Object.assign({ hero: p.hero }, p.status[1]));
    } else {
      // reflect (mirror)
      if (u.kind === 'hero' && u.S.reflect > 0 && this.rng.next() * 100 < u.S.reflect) {
        p.team = TEAM_HEROES;
        p.owner = u;
        p.hero = u;
        p.coef = 1.5;
        p.a += Math.PI;
        p.hitSet.clear();
        p.traveled = 0;
        p.range = 14;
        this.fx('block', { x: p.x, z: p.z });
        return;
      }
      if (p.dmg > 0) {
        if (p.owner && p.owner.kind === 'monster') this.monsterHit(p.owner, u, p.dmg / Math.max(0.0001, p.owner.dmg), { type: p.type, projectile: true });
        else this.dealDamage(p.owner, u, p.dmg, { type: p.type, projectile: true });
      }
      if (p.status && u.alive) this.applyStatus(u, p.status[0], p.status[1] || {});
    }
    if (p.onHit) p.onHit(this, p, u);
    if (!p.alive) return;
    if (p.explode) {
      this.projExplode(p, u.x, u.z, u);
      if (p.pierce <= 0) { p.alive = false; return; }
    }
    if (p.pierce > 0) { p.pierce--; return; }
    if (p.bounce > 0) {
      const next = p.team === TEAM_HEROES
        ? this.nearestEnemy(TEAM_HEROES, u.x, u.z, p.bounceRange, (m) => !p.hitSet.has(m.id) && m !== u)
        : null;
      if (next) {
        p.bounce--;
        p.x = u.x; p.z = u.z;
        p.a = Math.atan2(next.z - u.z, next.x - u.x);
        p.traveled = 0;
        p.range = p.bounceRange + 2;
        return;
      }
    }
    if (p.returning && !p.back) {
      p.back = true; p.hitSet.clear(); p.traveled = 0; p.range = 999;
      return;
    }
    p.alive = false;
  },

  projExplode(p, x, z, direct = null) {
    const e = p.explode;
    if (!e) return;
    if (p.team === TEAM_HEROES) {
      this.explode(p.owner, x, z, e.r, e.coef, {
        type: e.type || p.type, ability: p.ability, exclude: e.excludeDirect ? direct : null,
        status: e.status, statusOpts: e.statusOpts, knock: e.knock, color: e.color, snd: e.snd,
      });
    } else {
      const targets = this.unitsInRadius(TEAM_HEROES, x, z, e.r);
      for (const t of targets) this.monsterHit(p.owner, t, e.mult ?? 1, { type: e.type || p.type });
      this.fx('boom', { x, z, r: e.r, c: e.color || e.type || p.type });
      this.snd('boom', x, z);
    }
    if (e.onExplode) e.onExplode(this, p, x, z);
  },

  /** Monster-side projectile helper */
  monsterShoot(m, a, o = {}) {
    return this.fireProjectile(Object.assign({
      owner: m, team: TEAM_MONSTERS, x: m.x + Math.cos(a) * m.radius, z: m.z + Math.sin(a) * m.radius,
      a, speed: 12, range: 22, radius: 0.35, vis: 'e_orb', dmg: m.dmg, type: 'phys',
    }, o));
  },

  // ---------------------------------------------------------------------------
  // Ground areas & telegraphs
  // ---------------------------------------------------------------------------
  /**
   * o: { owner, team, shape, x, z, r, r2, a, arc, len, w, delay, dur, tick, vis, follow, rotSpd,
   *      onResolve, onTick, onEnd, onTrigger, trigger, armT, hidden, data }
   */
  spawnArea(o) {
    const owner = o.owner || null;
    const a = {
      id: this.allocAreaId(),
      alive: true,
      owner,
      hero: owner ? (owner.kind === 'hero' ? owner : owner.owner || null) : null,
      team: o.team ?? (owner ? owner.team : TEAM_MONSTERS),
      shape: o.shape || 'circle',
      x: o.x, z: o.z, r: o.r ?? 2, r2: o.r2 ?? 0, a: o.a ?? 0, arc: o.arc ?? Math.PI / 2,
      len: o.len ?? 6, w: o.w ?? 2,
      delay: o.delay ?? 0,
      dur: o.dur ?? 0,
      tick: o.tick ?? 0.5,
      t: 0,
      tickT: 0,
      resolved: !(o.delay > 0),
      vis: o.vis || 'tele',
      follow: o.follow || null,
      rotSpd: o.rotSpd || 0,
      onResolve: o.onResolve || null,
      onTick: o.onTick || null,
      onEnd: o.onEnd || null,
      onTrigger: o.onTrigger || null,
      trigger: o.trigger || 0,
      armT: o.armT || 0,
      hidden: !!o.hidden,
      data: o.data || {},
      ability: o.ability || null,
    };
    if (a.follow) { a.x = a.follow.x; a.z = a.follow.z; }
    this.areas.push(a);
    if (!a.hidden) {
      this.events.push({
        e: 'area+', id: a.id, sh: a.shape, x: +a.x.toFixed(2), z: +a.z.toFixed(2), r: a.r, r2: a.r2,
        a: +a.a.toFixed(3), arc: a.arc, len: a.len, w: a.w, d: a.delay, dur: a.dur, v: a.vis,
        f: a.follow ? a.follow.id : 0, rs: a.rotSpd, tm: a.team, c: o.color || null,
      });
    }
    return a;
  },

  telegraph(o) {
    return this.spawnArea(Object.assign({ team: TEAM_MONSTERS, vis: 'tele' }, o));
  },

  removeArea(a) {
    if (!a.alive) return;
    a.alive = false;
    if (a.onEnd) a.onEnd(this, a);
    if (!a.hidden) this.events.push({ e: 'area-', id: a.id });
  },

  updateAreas(dt) {
    const list = this.areas;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.alive) continue;
      a.t += dt;
      if (a.follow) {
        if (!a.follow.alive) { this.removeArea(a); continue; }
        a.x = a.follow.x; a.z = a.follow.z;
      }
      if (a.rotSpd) a.a += a.rotSpd * dt;
      if (!a.resolved) {
        if (a.t >= a.delay) {
          a.resolved = true;
          a.t = 0;
          if (a.onResolve) a.onResolve(this, a);
          if (!(a.dur > 0)) { this.removeArea(a); continue; }
        } else continue;
      }
      if (a.trigger > 0 && a.t >= a.armT) {
        const foes = this.enemiesInRadius(a.team, a.x, a.z, a.trigger);
        if (foes.length) {
          if (a.onTrigger) a.onTrigger(this, a, foes);
          if (!a.alive) continue;
        }
      }
      if (a.onTick) {
        a.tickT += dt;
        while (a.tickT >= a.tick && a.alive) {
          a.tickT -= a.tick;
          a.onTick(this, a);
        }
      }
      if (a.dur > 0 && a.t >= a.dur) this.removeArea(a);
    }
    if (this.tick % 15 === 0) this.areas = list.filter((a) => a.alive);
  },

  /** Area tick helper: hit enemies of the area owner inside its shape */
  areaHit(a, coef, o = {}) {
    const foes = this.unitsInShape(a.team === TEAM_HEROES ? TEAM_MONSTERS : TEAM_HEROES, a);
    for (const u of foes) {
      if (a.team === TEAM_HEROES) {
        if (a.owner && a.owner.alive !== undefined) this.hit(a.owner, u, coef, Object.assign({ aoe: true, ability: a.ability }, o));
      } else if (a.owner && a.owner.kind === 'monster') {
        this.monsterHit(a.owner, u, coef, o);
      } else {
        this.dealDamage(null, u, coef, o);
      }
      if (o.status && u.alive) this.applyStatus(u, o.status, Object.assign({ hero: a.hero }, o.statusOpts));
    }
    return foes;
  },

  // ---------------------------------------------------------------------------
  // Pickups (items, health orbs, chests)
  // ---------------------------------------------------------------------------
  spawnPickup(kind, x, z, data = {}) {
    [x, z] = this.clampToArena(x, z, 0.6);
    const pk = { id: this.allocPickId(), kind, x, z, t: 0, ttl: data.ttl ?? Infinity, item: data.item || null, tier: data.tier || null, owner: data.owner ?? -1 };
    this.pickups.set(pk.id, pk);
    this.events.push({ e: 'pick+', id: pk.id, k: kind, x: +x.toFixed(2), z: +z.toFixed(2), it: pk.item, tier: pk.tier });
    return pk;
  },

  removePickup(pk) {
    if (!this.pickups.has(pk.id)) return;
    this.pickups.delete(pk.id);
    this.events.push({ e: 'pick-', id: pk.id });
  },

  updatePickups(dt) {
    for (const pk of this.pickups.values()) {
      pk.t += dt;
      if (pk.t > pk.ttl) { this.removePickup(pk); continue; }
      if (pk.kind === 'orb') {
        for (const h of this.heroes) {
          if (!h.alive || h.downed) continue;
          const r = PICKUP_RANGE * 0.6 * (1 + (h.S.pickup || 0) / 100) + 0.6;
          if (dist2(h.x, h.z, pk.x, pk.z) <= r * r) {
            this.pickOrb(h, pk);
            break;
          }
        }
      }
    }
  },

  pickOrb(h, pk) {
    this.removePickup(pk);
    const amt = h.maxHp * 0.2 * (1 + (h.S.orbBonus || 0) / 100);
    this.heal(h, amt, h);
    if (h.S.orbShare) {
      for (const o of this.heroesInRadius(h.x, h.z, 12)) if (o !== h) this.heal(o, amt * 0.5, h);
    }
    this.fx('heal', { u: h.id });
    this.snd('orb', h.x, h.z);
    this.stat('orbs', 1, h.pid);
    for (const k of h.hooks.onOrb) k.fn(this, h, k.e.v, k.e.st);
  },

  // ---------------------------------------------------------------------------
  // Minions (summons & structures)
  // ---------------------------------------------------------------------------
  /** opts: { hpMul, dmgMul, ttl, data, scale } */
  spawnAlly(owner, defId, x, z, opts = {}) {
    const def = SUMMONS[defId];
    if (!def) throw new Error('Unknown summon ' + defId);
    const u = new Ally(this, owner, def);
    [u.x, u.z] = this.clampToArena(x, z, u.radius);
    u.rot = owner.rot;
    u.vis = this.visId(def.vis);
    const S = owner.S;
    u.maxHp = Math.max(10, owner.maxHp * (def.hpMul || 0.5) * (1 + (S.summonHp || 0) / 100) * (opts.hpMul ?? 1));
    u.hp = u.maxHp;
    u.dmgMul = opts.dmgMul ?? 1;
    u.ttl = opts.ttl ?? Infinity;
    u.scale = opts.scale ?? def.scale ?? 1;
    u.speed = (def.speed || 0) * (1 + (S.summonSpd || 0) / 100);
    u.atkSpdMul = 1 + (S.summonAtkSpd || 0) / 100;
    u.dr = def.dr || 0;
    u.spawnT = def.spawnT ?? 0.3;
    Object.assign(u.data, opts.data || {});
    this.units.set(u.id, u);
    this.allies.push(u);
    if (def.structure) owner.structures.push(u); else owner.summons.push(u);
    this.fx('summon', { x: u.x, z: u.z, c: def.color || 'shadow' });
    this.events.push({ e: 'info', u: u.id, n: def.name, o: owner.pid });
    for (const k of owner.hooks.onSummon) k.fn(this, owner, u, k.e.v, k.e.st);
    if (def.onSpawn) def.onSpawn(this, u);
    return u;
  },

  countAllies(owner, defId) {
    let n = 0;
    for (const a of this.allies) if (a.alive && a.owner === owner && a.type === defId) n++;
    return n;
  },

  oldestAlly(owner, defId) {
    for (const a of this.allies) if (a.alive && a.owner === owner && a.type === defId) return a;
    return null;
  },

  // ---------------------------------------------------------------------------
  // Monsters
  // ---------------------------------------------------------------------------
  /** opts: { elite, affixes, hpMul, dmgMul, summoned, boss, spawnT, noReward } */
  spawnMonster(defId, x, z, opts = {}) {
    const def = MONSTERS[defId];
    if (!def) throw new Error('Unknown monster ' + defId);
    const m = new Monster(this, def);
    [m.x, m.z] = this.clampToArena(x, z, m.radius);
    m.vis = this.visId(def.vis);
    const sc = this.monsterScaling(this.wave);
    let hp = def.hp * sc.hp * (opts.hpMul ?? 1);
    let dmg = def.dmg * sc.dmg * (opts.dmgMul ?? 1);
    m.speed = def.speed * this.diff.speed * (1 + Math.min(0.25, (this.wave - 1) * 0.006));
    m.xpVal = def.xp * sc.xp;
    m.goldVal = def.gold * sc.gold;
    m.summoned = !!opts.summoned;
    if (opts.summoned) { m.xpVal *= 0.3; m.goldVal *= 0.3; }
    m.scale = def.scale || 1;
    m.spawnT = opts.spawnT ?? 0.9;
    m.rot = Math.atan2(-z, -x);
    if (opts.elite) {
      m.elite = true;
      hp *= 4.2;
      dmg *= 1.45;
      m.scale *= 1.35;
      m.radius *= 1.25;
      m.mass *= 2;
      m.xpVal *= 5;
      m.goldVal *= 6;
      this.applyEliteAffixes(m, opts.affixes);
    }
    if (def.boss) {
      m.boss = true;
      m.spawnT = opts.spawnT ?? 2.0;
    }
    m.maxHp = hp;
    m.hp = hp;
    m.dmg = dmg;
    if (def.init) def.init(this, m);
    this.units.set(m.id, m);
    this.monsters.push(m);
    if (m.elite || m.boss) {
      this.events.push({ e: 'info', u: m.id, n: m.name, af: m.affixes, boss: m.boss ? 1 : 0 });
    }
    return m;
  },

  // ---------------------------------------------------------------------------
  // Corpses (for corpse explosion)
  // ---------------------------------------------------------------------------
  updateCorpses() {
    if (this.tick % 30 !== 0) return;
    const limit = this.time - 12;
    while (this.corpses.length && this.corpses[0].t < limit) this.corpses.shift();
  },

  takeCorpses(x, z, r, max = 99) {
    const out = [];
    for (let i = this.corpses.length - 1; i >= 0 && out.length < max; i--) {
      const c = this.corpses[i];
      if (dist2(x, z, c.x, c.z) <= r * r) {
        out.push(c);
        this.corpses.splice(i, 1);
      }
    }
    return out;
  },
};
