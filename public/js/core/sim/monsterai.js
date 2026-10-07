// Monster behaviours, elite affixes and movement.
import { TEAM_HEROES, TEAM_MONSTERS, ANIM, ARENA_RADIUS } from '../constants.js';
import { angleDiff, dist2, inCone } from '../util/math.js';
import { ELITE_AFFIX_IDS, ELITE_AFFIXES, MELEE_ONLY_AFFIXES } from '../data/elites.js';
import { MONSTERS } from '../data/monsters.js';

const RANGED_AI = new Set(['ranged', 'caster', 'summoner', 'bomber', 'static']);

export const monsterMethods = {
  applyEliteAffixes(m, forced) {
    let list = forced;
    if (!list) {
      const n = Math.min(4, 1 + (this.wave >= 10 ? 1 : 0) + (this.wave >= 20 ? 1 : 0) + this.diff.extraAffixes);
      const pool = ELITE_AFFIX_IDS.filter((a) => !(RANGED_AI.has(m.def.ai) && MELEE_ONLY_AFFIXES.has(a)));
      list = this.rng.sample(pool, n);
    }
    m.affixes = list;
    for (const a of list) m.aff[a] = true;
    m.atkSpdMul = 1;
    if (m.aff.fast) { m.speed *= 1.4; m.atkSpdMul *= 1.3; }
    if (m.aff.armored) m.maxHpMul = 1.2;
    const names = list.map((a) => ELITE_AFFIXES[a].name);
    m.name = `${m.def.name} ${names.join(', ')}`;
    m.aff.timer = 2 + this.rng.next() * 3;
    m.aff.timer2 = 3 + this.rng.next() * 3;
  },

  // ---------------------------------------------------------------------------
  // Update loop
  // ---------------------------------------------------------------------------
  updateMonsters(dt) {
    for (const m of this.monsters) {
      if (!m.alive || m.boss) continue;
      this.updateStatuses(m, dt);
      if (!m.alive) continue;
      if (m.spawnT > 0) {
        m.spawnT -= dt;
        // walk out of the gate
        if (m.gateDir) {
          m.x += m.gateDir[0] * 2.2 * dt;
          m.z += m.gateDir[1] * 2.2 * dt;
        }
        continue;
      }
      if (m.elite) this.updateEliteAffixes(m, dt);
      if (!m.alive) continue;
      m.atkCd -= dt * (m.atkSpdMul || 1);
      let vx = 0, vz = 0;
      if (m.canAct()) {
        if (m.st.fear && m.st.fear.t > 0) {
          const dx = m.x - m.st.fear.x, dz = m.z - m.st.fear.z;
          const d = Math.hypot(dx, dz) || 1;
          vx = dx / d; vz = dz / d;
          m.state = 'chase';
        } else {
          this.monsterTarget(m, dt);
          const mv = this.monsterBehavior(m, dt);
          vx = mv[0]; vz = mv[1];
        }
      } else if (m.state !== 'chase') {
        // interrupted
        m.state = 'chase';
        m.stateT = 0;
      }
      this.moveUnit(m, vx, vz, dt);
    }
  },

  monsterTarget(m, dt) {
    const st = m.st;
    if (st.taunt && st.taunt.t > 0 && st.taunt.by && st.taunt.by.alive) {
      m.target = st.taunt.by;
      return;
    }
    m.retargetT -= dt;
    const t = m.target;
    const invalid = !t || !t.alive || (t.kind === 'hero' && (t.downed || t.stealthT > 0)) || t.untargetable;
    if (invalid || m.retargetT <= 0) {
      if (m.state === 'windup' && !invalid) return;
      m.retargetT = 0.5 + this.rng.next() * 0.4;
      // prefer taunting allies nearby, else nearest hero-side unit (heroes weighted)
      let best = null, bd = Infinity;
      for (const h of this.heroes) {
        if (!h.alive || h.downed || h.stealthT > 0 || h.untargetable) continue;
        const d = dist2(m.x, m.z, h.x, h.z);
        if (d < bd) { bd = d; best = h; }
      }
      for (const a of this.allies) {
        if (!a.alive || a.untargetable) continue;
        let d = dist2(m.x, m.z, a.x, a.z);
        if (a.taunt) d *= 0.35;
        else d *= 1.3;
        if (d < bd) { bd = d; best = a; }
      }
      m.target = best;
    }
  },

  /** Returns desired movement direction [x, z] (unit vector or 0) */
  monsterBehavior(m, dt) {
    const def = m.def;
    switch (def.ai) {
      case 'melee': return this.aiMelee(m, dt);
      case 'ranged': return this.aiRanged(m, dt);
      case 'bomber': return this.aiBomber(m, dt);
      case 'charger': return this.aiCharger(m, dt);
      case 'caster': return this.aiCaster(m, dt);
      case 'teleporter': return this.aiTeleporter(m, dt);
      case 'summoner': return this.aiSummoner(m, dt);
      case 'leaper': return this.aiLeaper(m, dt);
      case 'knight': return this.aiKnight(m, dt);
      case 'static': return [0, 0];
      default: return this.aiMelee(m, dt);
    }
  },

  dirTo(m, x, z) {
    const dx = x - m.x, dz = z - m.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.001) return [0, 0];
    return [dx / d, dz / d];
  },

  /** Standard melee: approach, wind up, strike in a cone */
  aiMelee(m, dt) {
    const t = m.target;
    const atk = m.def.atk;
    if (m.state === 'windup') {
      m.stateT -= dt;
      if (m.stateT <= 0) {
        this.monsterMeleeResolve(m, atk);
        m.state = 'recover';
        m.stateT = 0.25;
        m.atkCd = atk.cd;
      }
      return [0, 0];
    }
    if (m.state === 'recover') {
      m.stateT -= dt;
      if (m.stateT <= 0) m.state = 'chase';
      return [0, 0];
    }
    if (!t) return this.dirTo(m, 0, 0).map((v) => v * 0.3);
    const d = Math.sqrt(dist2(m.x, m.z, t.x, t.z)) - t.radius - m.radius;
    m.rot = Math.atan2(t.z - m.z, t.x - m.x);
    if (d <= atk.range * 0.85 && m.atkCd <= 0) {
      m.state = 'windup';
      m.stateT = atk.windup / (m.atkSpdMul || 1);
      m.setAnim(ANIM.ATTACK);
      return [0, 0];
    }
    if (d <= atk.range * 0.6) return [0, 0];
    let [vx, vz] = this.dirTo(m, t.x, t.z);
    if (m.def.erratic) {
      const w = Math.sin(this.time * 4 + m.id) * 0.8;
      const ox = -vz * w, oz = vx * w;
      vx += ox; vz += oz;
    }
    return [vx, vz];
  },

  monsterMeleeResolve(m, atk, mult = 1) {
    const arc = (atk.arc * Math.PI) / 180;
    const range = atk.range + 0.25;
    const type = m.def.dmgType || 'phys';
    const targets = this.unitsInRadius(TEAM_HEROES, m.x, m.z, range + m.radius + 0.5);
    let hitAny = false;
    for (const u of targets) {
      if (!inCone(m.x, m.z, m.rot, arc / 2, range + m.radius, u.x, u.z, u.radius)) continue;
      if (!m.def.cleave && u !== m.target && hitAny) continue;
      this.monsterHit(m, u, mult, { type, melee: true });
      if (m.def.poison && u.alive) this.applyStatus(u, 'poison', { dps: m.dmg * m.def.poison * 0.25, dur: 4 });
      if (m.def.dmgType === 'cold' && u.alive) this.applyStatus(u, 'chill', { v: 0.3, dur: 1.5 });
      hitAny = true;
    }
    if (m.def.cleave || m.elite) this.fx('slash', { x: +m.x.toFixed(2), z: +m.z.toFixed(2), a: +m.rot.toFixed(2), r: range + m.radius, arc: atk.arc, c: 'enemy', u: m.id });
    if (hitAny) this.snd('mhit', m.x, m.z);
  },

  aiRanged(m, dt) {
    const t = m.target;
    const atk = m.def.atk;
    if (m.state === 'windup') {
      m.stateT -= dt;
      if (t) m.rot = Math.atan2(t.z - m.z, t.x - m.x);
      if (m.stateT <= 0) {
        const n = atk.spread || 1;
        for (let i = 0; i < n; i++) {
          const a = m.rot + (n > 1 ? (i - (n - 1) / 2) * (atk.spreadAng || 0.3) : 0);
          this.monsterShoot(m, a, { speed: atk.pspeed || 13, range: atk.range + 6, vis: atk.proj || 'e_orb', dmg: m.dmg, type: m.def.dmgType || 'phys', radius: 0.35 });
        }
        this.snd('mshoot', m.x, m.z);
        m.state = 'chase';
        m.atkCd = atk.cd;
      }
      return [0, 0];
    }
    if (!t) return this.dirTo(m, 0, 0).map((v) => v * 0.3);
    const d = Math.sqrt(dist2(m.x, m.z, t.x, t.z));
    m.rot = Math.atan2(t.z - m.z, t.x - m.x);
    if (m.atkCd <= 0 && d <= atk.range) {
      m.state = 'windup';
      m.stateT = atk.windup / (m.atkSpdMul || 1);
      m.setAnim(ANIM.ATTACK);
      return [0, 0];
    }
    const [k0, k1] = m.def.keep || [6, 10];
    const [dx, dz] = this.dirTo(m, t.x, t.z);
    if (d > k1) return [dx, dz];
    if (d < k0) return [-dx * 0.9, -dz * 0.9];
    // strafe
    const s = Math.sin(this.time * 0.7 + m.id * 1.7) > 0 ? 1 : -1;
    return [-dz * s * 0.5, dx * s * 0.5];
  },

  aiBomber(m, dt) {
    const t = m.target;
    const atk = m.def.atk;
    if (m.state === 'fuse') {
      m.stateT -= dt;
      if (m.stateT <= 0) {
        m.state = 'boom';
        const r = atk.radius;
        for (const u of this.unitsInRadius(TEAM_HEROES, m.x, m.z, r)) this.monsterHit(m, u, 1, { type: 'fire' });
        this.fx('boom', { x: m.x, z: m.z, r, c: 'fire' });
        this.snd('boom', m.x, m.z);
        this.killMonster(m, null, { selfDestruct: true });
      }
      return t ? this.dirTo(m, t.x, t.z).map((v) => v * 0.15) : [0, 0];
    }
    if (!t) return this.dirTo(m, 0, 0);
    const d = Math.sqrt(dist2(m.x, m.z, t.x, t.z)) - t.radius;
    m.rot = Math.atan2(t.z - m.z, t.x - m.x);
    if (d <= atk.range) {
      m.state = 'fuse';
      m.stateT = atk.fuse;
      m.setAnim(ANIM.SPECIAL);
      this.telegraph({ shape: 'circle', x: m.x, z: m.z, r: atk.radius, delay: atk.fuse, follow: m, vis: 'tele' });
      this.snd('fuse', m.x, m.z);
      return [0, 0];
    }
    return this.dirTo(m, t.x, t.z);
  },

  aiCharger(m, dt) {
    const c = m.def.charge;
    if (m.state === 'chargeWindup') {
      m.stateT -= dt;
      if (m.stateT <= 0) {
        m.state = 'charging';
        m.stateT = m.chargeLen / c.speed;
        m.chargeHit = new Set();
      }
      return [0, 0];
    }
    if (m.state === 'charging') {
      m.stateT -= dt;
      const vx = Math.cos(m.rot), vz = Math.sin(m.rot);
      const step = c.speed * dt;
      const nx = m.x + vx * step, nz = m.z + vz * step;
      if (this.blockedByObstacle(nx, nz, m.radius) || Math.hypot(nx, nz) > ARENA_RADIUS - m.radius) {
        m.state = 'recover';
        m.stateT = 0.8;
        this.fx('shake', { x: m.x, z: m.z, s: 0.3 });
        this.applyStatus(m, 'stun', { dur: 0.6 });
        return [0, 0];
      }
      m.x = nx; m.z = nz;
      for (const u of this.unitsInRadius(TEAM_HEROES, m.x, m.z, m.radius + 0.6)) {
        if (m.chargeHit.has(u.id)) continue;
        m.chargeHit.add(u.id);
        this.monsterHit(m, u, c.mult, { melee: true });
        if (u.kind === 'hero') this.forceMove(u, 'push', { dx: +(vx * 4).toFixed(2), dz: +(vz * 4).toFixed(2), d: 0.25 });
        else this.knockback(u, m.x, m.z, 6);
      }
      if (m.stateT <= 0) { m.state = 'recover'; m.stateT = 0.5; }
      return [0, 0];
    }
    const t = m.target;
    m.chargeCd = (m.chargeCd ?? 3) - dt;
    if (t && m.state === 'chase' && m.chargeCd <= 0) {
      const d = Math.sqrt(dist2(m.x, m.z, t.x, t.z));
      if (d >= c.min && d <= c.max) {
        m.rot = Math.atan2(t.z - m.z, t.x - m.x);
        m.chargeLen = Math.min(d + 4, 18);
        m.state = 'chargeWindup';
        m.stateT = c.windup;
        m.chargeCd = c.cd;
        m.setAnim(ANIM.SPECIAL);
        this.telegraph({ shape: 'line', x: m.x, z: m.z, a: m.rot, len: m.chargeLen, w: m.radius * 2 + 0.8, delay: c.windup });
        this.snd('roar', m.x, m.z);
        return [0, 0];
      }
    }
    return this.aiMelee(m, dt);
  },

  aiCaster(m, dt) {
    const t = m.target;
    const atk = m.def.atk;
    if (m.state === 'windup') {
      m.stateT -= dt;
      if (m.stateT <= 0) {
        m.state = 'chase';
        m.atkCd = atk.cd;
        if (t && t.alive) {
          const targets = [t];
          if (m.elite) { const o = this.randomHero(); if (o && o !== t) targets.push(o); }
          for (const u of targets) {
            const x = u.x + (u.kind === 'hero' && u.moving ? Math.cos(u.rot) * 0.8 : 0);
            const z = u.z + (u.kind === 'hero' && u.moving ? Math.sin(u.rot) * 0.8 : 0);
            this.telegraph({
              shape: 'circle', x, z, r: atk.radius, delay: atk.delay,
              onResolve: (g, a) => {
                for (const v of this.unitsInShape(TEAM_HEROES, a)) {
                  if (!m.alive) this.dealDamage(null, v, m.dmg, { type: 'fire' });
                  else this.monsterHit(m, v, 1, { type: 'fire' });
                  if (v.alive) this.applyStatus(v, 'burn', { dps: m.dmg * 0.15, dur: 3 });
                }
                this.fx('boom', { x: a.x, z: a.z, r: a.r, c: 'fire' });
                this.snd('fireburst', a.x, a.z);
              },
            });
          }
        }
      }
      return [0, 0];
    }
    if (!t) return this.dirTo(m, 0, 0).map((v) => v * 0.3);
    const d = Math.sqrt(dist2(m.x, m.z, t.x, t.z));
    m.rot = Math.atan2(t.z - m.z, t.x - m.x);
    if (m.atkCd <= 0 && d <= atk.range) {
      m.state = 'windup';
      m.stateT = atk.windup;
      m.setAnim(ANIM.CAST);
      return [0, 0];
    }
    const [k0, k1] = m.def.keep;
    const [dx, dz] = this.dirTo(m, t.x, t.z);
    if (d > k1) return [dx, dz];
    if (d < k0) return [-dx, -dz];
    return [0, 0];
  },

  aiTeleporter(m, dt) {
    const tp = m.def.tp;
    m.tpCd = (m.tpCd ?? tp.cd * this.rng.next()) - dt;
    const t = m.target;
    if (t && m.tpCd <= 0 && m.state === 'chase') {
      const d = Math.sqrt(dist2(m.x, m.z, t.x, t.z));
      if (d > 4 && d < tp.range) {
        m.tpCd = tp.cd;
        const a = (t.rot || 0) + Math.PI + (this.rng.next() - 0.5) * 1.6;
        const [x, z] = this.clampToArena(t.x + Math.cos(a) * 2, t.z + Math.sin(a) * 2, m.radius);
        this.fx('blink', { x1: +m.x.toFixed(2), z1: +m.z.toFixed(2), x2: +x.toFixed(2), z2: +z.toFixed(2), c: 'cold' });
        m.x = x; m.z = z;
        m.atkCd = Math.max(m.atkCd, 0.5);
        this.snd('blink', x, z);
      }
    }
    return this.aiMelee(m, dt);
  },

  aiSummoner(m, dt) {
    const s = m.def.summon;
    m.sumCd = (m.sumCd ?? s.cd * 0.5) - dt;
    if (m.state === 'summoning') {
      m.stateT -= dt;
      if (m.stateT <= 0) {
        m.state = 'chase';
        for (const p of m.sumPts || []) {
          if (this.monsters.length < 260) this.spawnMonster(s.type, p[0], p[1], { summoned: true, spawnT: 0.3 });
        }
      }
      return [0, 0];
    }
    if (m.sumCd <= 0 && m.state === 'chase' && m.target) {
      m.sumCd = s.cd;
      m.state = 'summoning';
      m.stateT = 0.9;
      m.setAnim(ANIM.CAST);
      m.sumPts = [];
      for (let i = 0; i < s.n + (m.elite ? 2 : 0); i++) {
        const p = this.randomPointNear(m.x, m.z, 1.5, 3.5);
        m.sumPts.push(p);
        this.fx('summon', { x: p[0], z: p[1], c: 'enemy' });
      }
      this.snd('raise', m.x, m.z);
      return [0, 0];
    }
    return this.aiRanged(m, dt);
  },

  aiLeaper(m, dt) {
    const L = m.def.leap;
    if (m.state === 'leapWindup') {
      m.stateT -= dt;
      if (m.stateT <= 0) {
        this.fx('leap', { u: m.id, x1: +m.x.toFixed(2), z1: +m.z.toFixed(2), x2: +m.leapX.toFixed(2), z2: +m.leapZ.toFixed(2), d: 0.35 });
        m.state = 'leaping';
        m.stateT = 0.35;
        m.leapX0 = m.x; m.leapZ0 = m.z;
      }
      return [0, 0];
    }
    if (m.state === 'leaping') {
      m.stateT -= dt;
      const k = 1 - Math.max(0, m.stateT) / 0.35;
      m.x = m.leapX0 + (m.leapX - m.leapX0) * k;
      m.z = m.leapZ0 + (m.leapZ - m.leapZ0) * k;
      if (m.stateT <= 0) {
        for (const u of this.unitsInRadius(TEAM_HEROES, m.x, m.z, L.radius)) this.monsterHit(m, u, L.mult, { type: m.def.dmgType || 'phys' });
        this.fx('boom', { x: m.x, z: m.z, r: L.radius, c: 'fire' });
        this.snd('slam', m.x, m.z);
        m.state = 'recover';
        m.stateT = 0.4;
      }
      return [0, 0];
    }
    const t = m.target;
    m.leapCd = (m.leapCd ?? L.cd * this.rng.next()) - dt;
    if (t && m.state === 'chase' && m.leapCd <= 0) {
      const d = Math.sqrt(dist2(m.x, m.z, t.x, t.z));
      if (d >= L.min && d <= L.max) {
        m.leapCd = L.cd;
        const [x, z] = this.clampToArena(t.x, t.z, m.radius);
        m.leapX = x; m.leapZ = z;
        m.rot = Math.atan2(z - m.z, x - m.x);
        m.state = 'leapWindup';
        m.stateT = L.windup;
        m.setAnim(ANIM.SPECIAL);
        this.telegraph({ shape: 'circle', x, z, r: L.radius, delay: L.windup + 0.35 });
        return [0, 0];
      }
    }
    return this.aiMelee(m, dt);
  },

  aiKnight(m, dt) {
    const S = m.def.spin;
    if (m.state === 'spinWindup') {
      m.stateT -= dt;
      if (m.stateT <= 0) {
        for (const u of this.unitsInRadius(TEAM_HEROES, m.x, m.z, S.radius)) this.monsterHit(m, u, S.mult, { type: 'shadow', melee: true });
        this.fx('nova', { x: m.x, z: m.z, r: S.radius, c: 'enemy' });
        this.snd('whirl', m.x, m.z);
        m.state = 'recover';
        m.stateT = 0.5;
      }
      return [0, 0];
    }
    m.spinCd = (m.spinCd ?? S.cd * 0.6) - dt;
    const t = m.target;
    if (t && m.state === 'chase' && m.spinCd <= 0 && dist2(m.x, m.z, t.x, t.z) < 16) {
      m.spinCd = S.cd;
      m.state = 'spinWindup';
      m.stateT = S.windup;
      m.setAnim(ANIM.SPECIAL);
      this.telegraph({ shape: 'circle', x: m.x, z: m.z, r: S.radius, delay: S.windup, follow: m });
      return [0, 0];
    }
    return this.aiMelee(m, dt);
  },

  // ---------------------------------------------------------------------------
  // Movement (shared by monsters & bosses)
  // ---------------------------------------------------------------------------
  moveUnit(m, dirX, dirZ, dt, speedOverride) {
    // knockback impulse
    if (m.vx || m.vz) {
      m.x += m.vx * dt;
      m.z += m.vz * dt;
      const decay = Math.max(0, 1 - 7 * dt);
      m.vx *= decay; m.vz *= decay;
      if (Math.abs(m.vx) < 0.05 && Math.abs(m.vz) < 0.05) { m.vx = 0; m.vz = 0; }
    }
    let speed = (speedOverride ?? m.speed) * m.moveMul();
    if (m.aff && m.aff.frenzied && m.hp < m.maxHp * 0.5) speed *= 1.3;
    if (dirX || dirZ) {
      const len = Math.hypot(dirX, dirZ);
      if (len > 1) { dirX /= len; dirZ /= len; }
      // obstacle avoidance (ground units)
      if (!m.flying) {
        for (const o of this.obstacles) {
          const dx = o.x - m.x, dz = o.z - m.z;
          const d2 = dx * dx + dz * dz;
          const rr = o.r + m.radius + 1.6;
          if (d2 > rr * rr) continue;
          const d = Math.sqrt(d2) || 1;
          // obstacle ahead?
          const ahead = (dx * dirX + dz * dirZ) / d;
          if (ahead > 0.2) {
            // steer tangentially (choose side by cross product)
            const side = dx * dirZ - dz * dirX > 0 ? 1 : -1;
            const w = Math.max(0, 1 - (d - o.r - m.radius) / 1.6) * ahead;
            dirX += (-dz / d) * side * w * 1.4;
            dirZ += (dx / d) * side * w * 1.4;
          }
        }
        const l2 = Math.hypot(dirX, dirZ);
        if (l2 > 0.001) { dirX /= l2; dirZ /= l2; }
      }
      m.x += dirX * speed * dt;
      m.z += dirZ * speed * dt;
      if (!(m.state === 'windup' || m.state === 'recover')) {
        const want = Math.atan2(dirZ, dirX);
        if (!m.target || m.state !== 'chase') m.rot = want;
      }
      if (m.anim !== ANIM.ATTACK && m.anim !== ANIM.CAST && m.anim !== ANIM.SPECIAL) m.anim = ANIM.MOVE;
    } else if (m.anim === ANIM.MOVE) {
      m.anim = ANIM.IDLE;
    }
    if ((m.anim === ANIM.ATTACK || m.anim === ANIM.CAST || m.anim === ANIM.SPECIAL) && m.state === 'chase') m.anim = ANIM.IDLE;

    // separation from other monsters
    const r0 = m.radius;
    this.grid.forEachNear(m.x, m.z, r0 + 2, (o) => {
      if (o === m || !o.alive) return;
      const dx = m.x - o.x, dz = m.z - o.z;
      const rr = r0 + o.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr || d2 < 1e-6) return;
      const d = Math.sqrt(d2);
      const push = (rr - d) * 0.5;
      const wm = o.mass / (m.mass + o.mass);
      m.x += (dx / d) * push * wm * 1.6;
      m.z += (dz / d) * push * wm * 1.6;
    });
    // heroes & allies are solid for monsters
    if (!m.flying || m.boss) {
      for (const h of this.heroes) {
        if (!h.alive || h.downed || (h.S && h.S.ghostWalk)) continue;
        this.pushOut(m, h.x, h.z, h.radius);
      }
      for (const a of this.allies) {
        if (!a.alive || a.untargetable) continue;
        if (a.structure) this.pushOut(m, a.x, a.z, a.radius);
        else {
          const dx = m.x - a.x, dz = m.z - a.z;
          const rr = m.radius + a.radius;
          const d2 = dx * dx + dz * dz;
          if (d2 < rr * rr && d2 > 1e-6) {
            const d = Math.sqrt(d2), push = rr - d;
            const wm = a.mass / (m.mass + a.mass);
            m.x += (dx / d) * push * wm; m.z += (dz / d) * push * wm;
            a.x -= (dx / d) * push * (1 - wm); a.z -= (dz / d) * push * (1 - wm);
          }
        }
      }
    }
    // arena & obstacles
    if (m.flying && !m.boss) {
      const lim = ARENA_RADIUS - m.radius;
      const d = Math.hypot(m.x, m.z);
      if (d > lim && m.spawnT <= 0) { m.x = m.x / d * lim; m.z = m.z / d * lim; }
    } else {
      const [x, z] = this.clampToArena(m.x, m.z, m.radius);
      m.x = x; m.z = z;
    }
  },

  pushOut(m, x, z, r) {
    const dx = m.x - x, dz = m.z - z;
    const rr = m.radius + r;
    const d2 = dx * dx + dz * dz;
    if (d2 >= rr * rr) return;
    const d = Math.sqrt(d2) || 0.01;
    m.x = x + (dx / d) * rr;
    m.z = z + (dz / d) * rr;
  },

  // ---------------------------------------------------------------------------
  // Elite affixes
  // ---------------------------------------------------------------------------
  updateEliteAffixes(m, dt) {
    const A = m.aff;
    A.timer -= dt;
    A.timer2 -= dt;
    if (A.molten) {
      A.trailT = (A.trailT ?? 0) - dt;
      if (A.trailT <= 0) {
        A.trailT = 0.6;
        const mm = m;
        this.spawnArea({ owner: m, team: TEAM_MONSTERS, shape: 'circle', x: m.x, z: m.z, r: 1.3, dur: 3.5, tick: 0.5, vis: 'firetrail_e',
          onTick: (g, a) => { for (const u of this.unitsInShape(TEAM_HEROES, a)) this.dealDamage(mm.alive ? mm : null, u, mm.dmg * 0.18, { type: 'fire', dot: true }); } });
      }
    }
    if (A.plague) {
      A.plagueT = (A.plagueT ?? 0) - dt;
      if (A.plagueT <= 0) {
        A.plagueT = 1;
        for (const u of this.unitsInRadius(TEAM_HEROES, m.x, m.z, 3.5)) this.applyStatus(u, 'poison', { dps: m.dmg * 0.12, dur: 3 });
        this.fx('nova', { x: m.x, z: m.z, r: 3.5, c: 'poison', soft: 1 });
      }
    }
    if (A.timer <= 0) {
      A.timer = 4.5 + this.rng.next() * 2;
      if (A.frozen) this.eliteFrostOrbs(m);
      if (A.mortar) this.eliteMortar(m);
      if (A.shielding && m.invulnT <= 0) { m.invulnT = 2.2; this.fx('shield', { u: m.id }); }
    }
    if (A.timer2 <= 0) {
      A.timer2 = 7 + this.rng.next() * 3;
      if (A.summoner && this.monsters.length < 250) {
        for (let i = 0; i < 3; i++) {
          const [x, z] = this.randomPointNear(m.x, m.z, 1, 2.5);
          this.spawnMonster('bat', x, z, { summoned: true, spawnT: 0.2 });
        }
        this.fx('summon', { x: m.x, z: m.z, c: 'enemy' });
      }
      if (A.teleporter) {
        const h = this.randomHero();
        if (h) {
          const [x, z] = this.randomPointNear(h.x, h.z, 1.8, 3);
          this.fx('blink', { x1: +m.x.toFixed(2), z1: +m.z.toFixed(2), x2: +x.toFixed(2), z2: +z.toFixed(2), c: 'shadow' });
          m.x = x; m.z = z;
        }
      }
      if (A.jailer) {
        const h = this.randomHero();
        if (h) {
          const hx = h.x, hz = h.z;
          this.telegraph({ shape: 'circle', x: hx, z: hz, r: 1.8, delay: 1.1, vis: 'tele_jail',
            onResolve: (g, a) => { for (const u of this.heroesInRadius(a.x, a.z, a.r)) this.applyStatus(u, 'root', { dur: 1.6 }); this.snd('jail', a.x, a.z); } });
        }
      }
    }
  },

  eliteFrostOrbs(m) {
    for (let i = 0; i < 3; i++) {
      const h = this.randomHero();
      const [x, z] = h ? this.randomPointNear(h.x, h.z, 0, 4) : this.randomPointNear(m.x, m.z, 2, 6);
      const mm = m;
      this.telegraph({ shape: 'circle', x, z, r: 2.1, delay: 1.5, vis: 'tele_frost',
        onResolve: (g, a) => {
          for (const u of this.unitsInShape(TEAM_HEROES, a)) {
            this.dealDamage(mm.alive ? mm : null, u, mm.dmg * 1.1, { type: 'cold' });
            this.applyStatus(u, 'chill', { v: 0.5, dur: 2 });
          }
          this.fx('boom', { x: a.x, z: a.z, r: a.r, c: 'cold' });
          this.snd('freeze', a.x, a.z);
        } });
    }
  },

  eliteMortar(m) {
    const h = this.randomHero();
    if (!h) return;
    const x = h.x, z = h.z;
    const mm = m;
    this.fx('lob', { x1: +m.x.toFixed(2), z1: +m.z.toFixed(2), x2: +x.toFixed(2), z2: +z.toFixed(2), d: 1.4, k: 'e_shell' });
    this.telegraph({ shape: 'circle', x, z, r: 2.6, delay: 1.4,
      onResolve: (g, a) => {
        for (const u of this.unitsInShape(TEAM_HEROES, a)) this.dealDamage(mm.alive ? mm : null, u, mm.dmg * 1.25, { type: 'fire' });
        this.fx('boom', { x: a.x, z: a.z, r: a.r, c: 'fire' });
        this.snd('boom', a.x, a.z);
      } });
  },

  monsterElectricSpark(m) {
    for (let i = 0; i < 2; i++) {
      this.monsterShoot(m, this.rng.angle(), { speed: 9, range: 9, vis: 'e_spark', dmg: m.dmg * 0.5, type: 'light', radius: 0.4 });
    }
  },

  /** Death behaviours: splitting, explosive affix, mark detonation */
  onMonsterDeathBehaviors(m, hero, info) {
    const def = m.def;
    if (m.boss) this.onBossKilled(m, hero);
    if (m.st.mark && m.st.mark.t > 0) this.detonateMark(m);
    if (def.split && this.monsters.length < 260) {
      for (let i = 0; i < (def.splitN || 2); i++) {
        const [x, z] = this.randomPointNear(m.x, m.z, 0.5, 1.4);
        const s = this.spawnMonster(def.split, x, z, { spawnT: 0.15, hpMul: m.elite ? 2 : 1 });
        s.xpVal *= 0.5; s.goldVal *= 0.5;
      }
      const mm = m;
      this.spawnArea({ owner: null, team: TEAM_MONSTERS, shape: 'circle', x: m.x, z: m.z, r: 1.8, dur: 3, tick: 0.5, vis: 'acid',
        onTick: (g, a) => { for (const u of this.unitsInShape(TEAM_HEROES, a)) this.dealDamage(null, u, mm.dmg * 0.25, { type: 'poison', dot: true }); } });
    }
    if (m.elite && m.aff.explosive) {
      const x = m.x, z = m.z, dmg = m.dmg;
      this.telegraph({ shape: 'circle', x, z, r: 3.8, delay: 1.0,
        onResolve: (g, a) => {
          for (const u of this.unitsInShape(TEAM_HEROES, a)) this.dealDamage(null, u, dmg * 2.4, { type: 'fire' });
          this.fx('boom', { x, z, r: 3.8, c: 'fire' });
          this.fx('shake', { x, z, s: 0.4 });
          this.snd('boom', x, z);
        } });
    }
    if (m.elite && m.aff.molten) {
      const x = m.x, z = m.z, dmg = m.dmg;
      this.telegraph({ shape: 'circle', x, z, r: 2.5, delay: 0.8,
        onResolve: () => {
          for (const u of this.unitsInRadius(TEAM_HEROES, x, z, 2.5)) this.dealDamage(null, u, dmg * 1.2, { type: 'fire' });
          this.fx('boom', { x, z, r: 2.5, c: 'fire' });
        } });
    }
    if (def.onDeath) def.onDeath(this, m, hero, info);
  },
};

export { MONSTERS, angleDiff };
