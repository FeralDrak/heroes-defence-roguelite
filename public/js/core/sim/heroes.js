// Hero systems: stats recomputation, input handling, ability casting, buffs, potions, interactions.
import {
  TEAM_HEROES, IN, SLOTS, ANIM, PHASE, EQUIP_SLOTS, REVIVE_RANGE, REVIVE_TIME,
  CHEST_OPEN_TIME, ITEM_PICK_RANGE, ARENA_RADIUS,
} from '../constants.js';
import { dist2, clamp, angleTo } from '../util/math.js';
import { StatBuilder, emptyHooks, computeAbilityParams } from './stats.js';
import { ABILITIES } from '../data/classes/index.js';
import { TALENTS } from '../data/talents.js';
import { ASPECTS } from '../data/aspects.js';
import { UNIQUES } from '../data/uniques.js';
import { BUFFS } from '../data/buffs.js';

export const heroMethods = {
  initHero(h) {
    h.S = null;
    h.hooks = emptyHooks();
    h.effState = {};
    h.levelMul = 1;
    this.recomputeHero(h);
    h.hp = h.maxHp;
    h.potions = h.S.potionCharges;
    h.dashCharges = h.dashMax;
    h.gold = this.diff.startGold;
    // starting weapon
    const w = this.makeStarterWeapon(h.classId);
    h.equip.weapon = w;
    h.statsDirty = true;
    this.recomputeHero(h);
    h.hp = h.maxHp;
  },

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------
  recomputeHero(h) {
    const cls = h.cls;
    const B = new StatBuilder();
    const base = cls.base;
    B.s.critChance = base.crit;
    B.s.critDmg = base.critDmg;
    if (base.dodge) B.add('dodge', base.dodge);
    if (base.lifeSteal) B.add('lifeSteal', base.lifeSteal);
    B.s.potionCharges = 2;
    let power = 6;
    const effects = [];

    for (const slot of EQUIP_SLOTS) {
      const it = h.equip[slot];
      if (!it) continue;
      if (it.power) power = it.power;
      if (it.armor) B.add('armor', it.armor);
      if (it.implicit) for (const k in it.implicit) B.add(k, it.implicit[k]);
      if (it.affixes) {
        for (const a of it.affixes) {
          if (a.id === 'abil') B.amod(a.ab, 'dmg', a.v);
          else B.add(a.id, a.v);
        }
      }
      if (it.aspect) {
        const def = ASPECTS[it.aspect.id];
        if (def) effects.push({ def, v: it.aspect.v, st: this.effStateFor(h, 'it' + it.uid), src: 'item' });
      }
      if (it.unique) {
        const def = UNIQUES[it.unique];
        if (def) effects.push({ def, v: it.uv || {}, st: this.effStateFor(h, 'it' + it.uid), src: 'item' });
      }
    }
    for (const id of h.talentOrder) {
      const t = h.talents[id];
      const def = TALENTS[id];
      if (def) effects.push({ def, v: t.v, st: t.st, src: 'talent' });
    }
    for (const b of h.buffs) {
      const def = BUFFS[b.id];
      if (def) effects.push({ def, v: b.v, st: b, src: 'buff' });
    }
    for (const e of effects) if (e.def.stats) e.def.stats(B, e.v, h, this);

    const s = B.s;
    const S = {};
    const L = h.level;
    h.levelMul = 1 + 0.035 * (L - 1);
    S.power = power;
    S.maxHp = Math.max(1, (base.hp * (1 + 0.06 * (L - 1)) + s.maxHp) * (1 + s.maxHpPct / 100) * B.moreHp);
    S.armor = Math.max(0, (base.armor * (1 + 0.04 * (L - 1)) + s.armor) * (1 + s.armorPct / 100));
    S.res = Math.min(75, base.res + s.res);
    S.dodge = Math.min(50, s.dodge);
    S.dmgReduc = Math.min(60, s.dmgReduc);
    S.regen = base.regen * (1 + 0.05 * (L - 1)) + s.regen + S.maxHp * s.regenPct / 100;
    S.dmgPct = s.dmgPct;
    S.atkSpd = s.atkSpd;
    S.critChance = Math.min(100, s.critChance);
    S.critMult = 1 + Math.max(0, s.critDmg) / 100;
    S.cdr = Math.min(60, s.cdr);
    S.moveSpeed = clamp(base.speed * (1 + s.moveSpd / 100) * B.moreSpeed, 2.5, 13);
    S.area = s.area;
    S.dur = s.dur;
    for (const k of ['lifeSteal', 'lifeOnKill', 'thorns', 'summonDmg', 'summonHp', 'dmgPhys', 'dmgFire', 'dmgCold',
      'dmgLight', 'dmgPoison', 'dmgHoly', 'dmgShadow', 'dmgArcane', 'dmgElite', 'dmgCC', 'dotDmg', 'burnChance',
      'chillChance', 'shockChance', 'poisonChance', 'bleedChance', 'healRecv', 'goldFind', 'xpGain', 'luck',
      'pickup', 'potionHeal', 'summonAtkSpd', 'summonSpd', 'minionLeech', 'dotLeech', 'bleedLeech', 'killHealPct',
      'reflect', 'orbBonus', 'statusBonus', 'freezeBonus', 'talentChoices', 'echo', 'freeCast', 'minRarity', 'scale']) {
      S[k] = s[k] || 0;
    }
    S.thorns = s.thorns;
    S.potionCharges = Math.max(0, Math.round(s.potionCharges));
    S.poisonStacks = 12 + (s.poisonStacks || 0);
    S.more = B.moreDmg;
    S.taken = B.moreTaken;
    S.burnMul = B.mul.burn;
    S.shockMul = B.mul.shock;
    S.shockDur = B.mul.shockDur;
    S.poisonMul = B.mul.poison;
    S.poisonDur = B.mul.poisonDur;
    Object.assign(S, B.bool);
    h.S = S;
    h.flags = B.fl;

    // HP max change keeps ratio
    const prevMax = h.maxHp || S.maxHp;
    h.maxHp = S.maxHp;
    if (h.alive && !h.downed && prevMax > 0) h.hp = Math.min(h.maxHp, h.hp * (h.maxHp / prevMax));
    h.scale = 1 + (S.scale || 0) / 100;

    // abilities
    const P = {};
    for (const abId of cls.abilities) {
      const ab = ABILITIES[abId];
      P[abId] = computeAbilityParams(ab, B, S);
    }
    h.P = P;
    h.dashMax = 1 + Math.round(S.dashCharges || 0);
    if (h.dashCharges > h.dashMax) h.dashCharges = h.dashMax;

    // hooks
    const hooks = emptyHooks();
    for (const e of effects) {
      const hk = e.def.hooks;
      if (!hk) continue;
      for (const name in hk) {
        if (hooks[name]) hooks[name].push({ fn: hk[name], e });
      }
    }
    h.hooks = hooks;
    h.effects = effects;
    h.statsDirty = false;
    h.stateDirty = true;
  },

  effStateFor(h, key) {
    return h.effState[key] || (h.effState[key] = {});
  },

  // ---------------------------------------------------------------------------
  // Buffs
  // ---------------------------------------------------------------------------
  addBuff(h, id, dur, v = {}, opts = {}) {
    if (!h || !h.alive || h.kind !== 'hero') return null;
    const def = BUFFS[id];
    if (!def) return null;
    let b = h.buffs.find((x) => x.id === id && (!opts.src || x.src === opts.src));
    if (b) {
      if (def.stack) {
        b.stacks = Math.min(def.maxStacks || 99, (b.stacks || 1) + 1);
        b.v = Object.assign({}, v, { stacks: b.stacks });
      } else {
        b.v = v;
      }
      b.t = Math.max(b.t, dur);
      b.dur = Math.max(b.dur, dur);
    } else {
      b = { id, t: dur, dur, v: Object.assign({ stacks: 1 }, v), stacks: 1, src: opts.src || null };
      h.buffs.push(b);
    }
    h.statsDirty = true;
    h.stateDirty = true;
    if (def.onAdd) def.onAdd(this, h, b);
    return b;
  },

  removeBuff(h, id) {
    const i = h.buffs.findIndex((b) => b.id === id);
    if (i < 0) return;
    const b = h.buffs[i];
    h.buffs.splice(i, 1);
    const def = BUFFS[id];
    if (def && def.onRemove) def.onRemove(this, h, b);
    h.statsDirty = true;
    h.stateDirty = true;
  },

  hasBuff(h, id) { return h.buffs.some((b) => b.id === id); },

  updateHeroBuffs(h, dt) {
    for (let i = h.buffs.length - 1; i >= 0; i--) {
      const b = h.buffs[i];
      b.t -= dt;
      const def = BUFFS[b.id];
      if (def && def.tick) def.tick(this, h, b, dt);
      if (b.t <= 0) {
        h.buffs.splice(i, 1);
        if (def && def.onRemove) def.onRemove(this, h, b);
        h.statsDirty = true;
        h.stateDirty = true;
      }
    }
  },

  // ---------------------------------------------------------------------------
  // Main hero update
  // ---------------------------------------------------------------------------
  updateHeroes(dt) {
    for (const h of this.heroes) {
      if (h.statsDirty) this.recomputeHero(h);
      if (!h.alive) continue;
      if (h.downed) { h.input.pressed = 0; continue; }
      if (h.disconnected) {
        // absent player: the hero waits out of reach (hidden, invulnerable) until they come back
        if (h.stealthT < 0.5) { h.stealthT = 0.5; h.stateDirty = true; }
        if (h.invulnT < 0.5) h.invulnT = 0.5;
        h.input.held = 0;
        h.input.pressed = 0;
      }
      this.updateStatuses(h, dt);
      if (h.downed) continue;
      this.updateHeroBuffs(h, dt);
      if (h.statsDirty) this.recomputeHero(h);
      const S = h.S;
      // regen
      if (h.hp < h.maxHp && S.regen > 0) h.hp = Math.min(h.maxHp, h.hp + S.regen * dt);
      if (h.stealthT > 0) { h.stealthT -= dt; if (h.stealthT <= 0) h.stateDirty = true; }
      if (h.potionCd > 0) h.potionCd -= dt;
      // dash charges
      if (h.dashCharges < h.dashMax && this.time >= h.cd[5]) {
        h.dashCharges++;
        if (h.dashCharges < h.dashMax) {
          const dur = h.P[h.cls.abilities[5]].cd;
          h.cd[5] = this.time + dur;
          h.cdDur[5] = dur;
          this.events.push({ e: 'cd', pid: h.pid, s: 5, d: dur, r: dur, ch: h.dashCharges });
        } else {
          this.events.push({ e: 'cd', pid: h.pid, s: 5, d: 0, r: 0, ch: h.dashCharges });
        }
      }
      this.processHeroInput(h, dt);
      this.updateHeroMotion(h, dt);
      // tick hooks
      const tk = h.hooks.tick;
      for (let i = 0; i < tk.length; i++) tk[i].fn(this, h, dt, tk[i].e.v, tk[i].e.st);
      // delayed recasts (echo)
      if (h.recastQueue.length) {
        for (let i = h.recastQueue.length - 1; i >= 0; i--) {
          const r = h.recastQueue[i];
          if (this.time >= r.t) {
            h.recastQueue.splice(i, 1);
            this.castAbility(h, r.slot, { recast: true, ax: r.ax, az: r.az, free: true });
          }
        }
      }
      if (h.anim === ANIM.ATTACK || h.anim === ANIM.CAST) {
        h.animLock -= dt;
        if (h.animLock <= 0) h.anim = h.channel ? ANIM.CHANNEL : ANIM.IDLE;
      }
      if (h.anim !== ANIM.ATTACK && h.anim !== ANIM.CAST && !h.channel) h.anim = h.moving ? ANIM.MOVE : ANIM.IDLE;
    }
  },

  /** Called by the host when an input packet arrives */
  applyHeroInput(h, inp) {
    if (!h) return;
    const I = h.input;
    if (!h.downed && !h.air && (inp.fs ?? 0) >= h.forceSeq && Number.isFinite(inp.x) && Number.isFinite(inp.z)) {
      const [x, z] = this.clampToArena(inp.x, inp.z, h.radius * 0.8);
      const moved = dist2(h.x, h.z, x, z);
      if (moved > 0.0001) h.lastMoveT = this.time;
      h.x = x; h.z = z;
    }
    h.moving = this.time - h.lastMoveT < 0.15;
    if (Number.isFinite(inp.ax) && Number.isFinite(inp.az)) { I.ax = inp.ax; I.az = inp.az; }
    I.held = inp.held | 0;
    I.pressed |= inp.pressed | 0;
    if (Number.isFinite(inp.tx) && Number.isFinite(inp.tz)) { I.tx = inp.tx; I.tz = inp.tz; }
  },

  processHeroInput(h, dt) {
    const I = h.input;
    const held = I.held;
    const pressed = I.pressed;
    I.pressed = 0;
    h.rot = Math.atan2(I.az - h.z, I.ax - h.x);
    if (!h.canAct()) {
      if (h.channel) this.endChannel(h);
      return;
    }
    if (pressed & IN.POTION) this.usePotion(h);
    if (held & IN.INTERACT) this.heroInteract(h, dt, !!(pressed & IN.INTERACT));
    else { h.interactT = 0; h.interactTarget = 0; }

    // channel
    if (h.channel) {
      const ch = h.channel;
      const bit = 1 << ch.slot;
      ch.t += dt;
      const ab = ABILITIES[ch.ab];
      if ((!(held & bit) && ch.t > 0.1 && !ch.noRelease) || ch.t >= ch.max) {
        this.endChannel(h);
      } else if (ab.channelTick) {
        ch.tickT += dt;
        while (ch.tickT >= ch.tick && h.channel) {
          ch.tickT -= ch.tick;
          ab.channelTick(this, h, h.P[ch.ab], ch);
        }
      }
    }

    for (let slot = 0; slot < SLOTS.length; slot++) {
      const bit = 1 << slot;
      if (slot === 0) {
        if ((held & bit) || (pressed & bit)) {
          if (h.channel && h.channel.slot !== 0) continue;
          if (this.time >= h.cd[0]) this.castAbility(h, 0);
        }
      } else if (pressed & bit) {
        this.castAbility(h, slot);
      }
    }
  },

  /**
   * Cast the ability in `slot`. extra: { recast, ax, az, free }
   */
  castAbility(h, slot, extra = {}) {
    const abId = h.cls.abilities[slot];
    const ab = ABILITIES[abId];
    const P = h.P[abId];
    if (!ab || !P) return false;
    if (!extra.recast) {
      if (slot === 5) {
        if (h.dashCharges <= 0) return false;
      } else if (this.time < h.cd[slot] - 0.06) return false;
    }
    if (h.air || h.downed) return false;
    if (h.channel && slot !== h.channel.slot) {
      if (slot === 0) return false;
      this.endChannel(h);
    }
    const I = h.input;
    const ax = extra.ax ?? I.ax, az = extra.az ?? I.az;
    const ctx = {
      slot, ox: h.x, oz: h.z, ax, az, tx: I.tx, tz: I.tz,
      a: Math.atan2(az - h.z, ax - h.x), dist: Math.hypot(ax - h.x, az - h.z),
      mult: extra.mult ?? 1, recast: !!extra.recast,
    };
    const ok = ab.cast(this, h, P, ctx);
    if (ok === false) {
      if (!extra.recast) this.events.push({ e: 'cd', pid: h.pid, s: slot, d: 0, r: Math.max(0, h.cd[slot] - this.time), ch: h.dashCharges, fail: 1 });
      return false;
    }
    h.rot = ctx.a;
    if (!extra.recast) {
      let dur = slot === 0 ? P.interval : P.cd;
      if (!(dur > 0)) dur = 0.25;
      let free = false;
      if (slot !== 0 && slot !== 5 && h.S.freeCast > 0 && this.rng.next() * 100 < h.S.freeCast) free = true;
      if (slot === 5) {
        const wasFull = h.dashCharges >= h.dashMax;
        h.dashCharges--;
        if (wasFull) { h.cd[5] = this.time + dur; h.cdDur[5] = dur; }
        this.events.push({ e: 'cd', pid: h.pid, s: 5, d: h.cdDur[5], r: Math.max(0, h.cd[5] - this.time), ch: h.dashCharges });
      } else if (ab.cdAfterChannel && h.channel) {
        h.cd[slot] = this.time + 999; // real cooldown starts when the channel ends
        h.cdDur[slot] = dur;
      } else if (free) {
        h.cd[slot] = this.time + 0.3;
        h.cdDur[slot] = 0.3;
        this.events.push({ e: 'cd', pid: h.pid, s: slot, d: 0.3, r: 0.3 });
        this.fx('text', { u: h.id, s: 'Gratuit !', c: '#9ff' });
      } else {
        h.cd[slot] = this.time + dur;
        h.cdDur[slot] = dur;
        if (slot !== 0) this.events.push({ e: 'cd', pid: h.pid, s: slot, d: dur, r: dur });
      }
      if (slot !== 0) this.stat('cast.' + abId, 1, h.pid);
      // echo: recast for free a bit later
      if (slot >= 1 && slot <= 4 && h.S.echo > 0 && !ab.move && !ab.noEcho && this.rng.next() * 100 < h.S.echo) {
        h.recastQueue.push({ slot, t: this.time + 0.5, ax, az });
      }
    }
    if (!ab.noAnim) h.setAnim(ab.anim ?? (slot === 0 ? ANIM.ATTACK : ANIM.CAST), ab.animTime ?? 0.3);
    const oc = h.hooks.onCast;
    for (let i = 0; i < oc.length; i++) oc[i].fn(this, h, abId, slot, ctx, oc[i].e.v, oc[i].e.st);
    if (slot === 5) {
      const od = h.hooks.onDash;
      for (let i = 0; i < od.length; i++) od[i].fn(this, h, ctx, od[i].e.v, od[i].e.st);
    }
    if (h.stealthT > 0 && !ab.keepStealth) this.breakStealth(h);
    return true;
  },

  /** Recast an ability from a different origin (twin, echo) without cooldown */
  castFrom(h, slot, ox, oz, ax, az, mult = 1) {
    const abId = h.cls.abilities[slot];
    const ab = ABILITIES[abId];
    const P = h.P[abId];
    if (!ab || !P || ab.move) return;
    const ctx = { slot, ox, oz, ax, az, tx: ax, tz: az, a: Math.atan2(az - oz, ax - ox), dist: Math.hypot(ax - ox, az - oz), mult, recast: true, ghost: true };
    ab.cast(this, h, P, ctx);
  },

  startChannel(h, slot, abId, P, o = {}) {
    h.channel = { slot, ab: abId, t: 0, tick: o.tick ?? 0.25, tickT: o.tick ?? 0.25, max: o.max ?? 3, data: o.data || {}, noRelease: !!o.noRelease };
    h.anim = ANIM.CHANNEL;
    h.animCount = (h.animCount + 1) & 31;
    h.stateDirty = true;
  },

  endChannel(h) {
    const ch = h.channel;
    if (!ch) return;
    h.channel = null;
    const ab = ABILITIES[ch.ab];
    if (ab && ab.channelEnd) ab.channelEnd(this, h, h.P[ch.ab], ch);
    const P = h.P[ch.ab];
    if (P && P.cd && ab.cdAfterChannel) {
      h.cd[ch.slot] = this.time + P.cd;
      h.cdDur[ch.slot] = P.cd;
      this.events.push({ e: 'cd', pid: h.pid, s: ch.slot, d: P.cd, r: P.cd });
    }
    h.anim = ANIM.IDLE;
    h.stateDirty = true;
  },

  /** Hero-specific motion state (dash damage, leaps) */
  updateHeroMotion(h, dt) {
    if (h.dash) {
      const d = h.dash;
      d.t += dt;
      if (d.coef > 0 || d.onTouch) {
        const foes = this.enemiesInRadius(TEAM_HEROES, h.x, h.z, d.r || 1.6);
        for (const m of foes) {
          if (d.hit.has(m.id)) continue;
          d.hit.add(m.id);
          if (d.coef > 0) this.hit(h, m, d.coef, { type: d.type || 'phys', ability: d.ability, melee: true });
          if (d.knock && m.alive) this.knockback(m, h.x, h.z, d.knock);
          if (d.onTouch) d.onTouch(this, h, m);
        }
      }
      if (d.trail) {
        d.trailT = (d.trailT || 0) + dt;
        if (d.trailT >= 0.08) { d.trailT = 0; d.trail(this, h); }
      }
      if (d.t >= d.dur) {
        h.dash = null;
        if (d.onEnd) d.onEnd(this, h);
      }
    }
    if (h.air) {
      const a = h.air;
      a.t += dt;
      if (a.t >= a.dur) {
        h.air = null;
        h.x = a.x1; h.z = a.z1;
        h.invulnT = Math.max(h.invulnT, 0.1);
        if (a.onLand) a.onLand(this, h, a);
      }
    }
  },

  /** Start a dash (the client moves the hero; host applies effects). */
  heroDash(h, P, ctx, o = {}) {
    const dur = P.dashDur ?? 0.22;
    h.dash = {
      t: 0, dur: dur + 0.12, hit: new Set(), coef: o.coef || 0, type: o.type, ability: o.ability,
      knock: o.knock || 0, r: o.r || 1.6, onTouch: o.onTouch || null, onEnd: o.onEnd || null, trail: o.trail || null,
    };
    if (o.invuln !== false) h.invulnT = Math.max(h.invulnT, dur + 0.05);
    this.fx('dash', { u: h.id, c: o.color || 'white', d: dur });
    this.snd(o.snd || 'dash', h.x, h.z);
  },

  /** Leap: hero is airborne and lands on (tx,tz) */
  heroLeap(h, P, ctx, o = {}) {
    const [x1, z1] = this.moveTarget(h, ctx, P.dist);
    const dur = P.air ?? 0.5;
    h.air = { t: 0, dur, x0: h.x, z0: h.z, x1, z1, onLand: o.onLand || null };
    h.invulnT = Math.max(h.invulnT, dur + 0.1);
    this.fx('leap', { u: h.id, x1: h.x, z1: h.z, x2: x1, z2: z1, d: dur });
    this.snd('leap', h.x, h.z);
    return [x1, z1];
  },

  /** Endpoint of a movement ability (client sends its computed target in tx/tz) */
  moveTarget(h, ctx, maxDist) {
    let tx = ctx.tx, tz = ctx.tz;
    if (!Number.isFinite(tx)) { tx = ctx.ax; tz = ctx.az; }
    let dx = tx - h.x, dz = tz - h.z;
    const d = Math.hypot(dx, dz);
    const lim = maxDist + 0.75;
    if (d > lim) { dx = dx / d * lim; dz = dz / d * lim; }
    return this.clampToArena(h.x + dx, h.z + dz, h.radius);
  },

  /** Aim point clamped to a max range from the origin */
  aimPoint(ctx, maxRange) {
    let dx = ctx.ax - ctx.ox, dz = ctx.az - ctx.oz;
    const d = Math.hypot(dx, dz);
    if (d > maxRange) { dx = dx / d * maxRange; dz = dz / d * maxRange; }
    return this.clampToArena(ctx.ox + dx, ctx.oz + dz, 0.3);
  },

  /** Server-driven hero movement; client is told through a 'force' event */
  forceMove(h, mode, data) {
    h.forceSeq++;
    if (mode === 'tp') {
      const [x, z] = this.clampToArena(data.x, data.z, h.radius);
      h.x = x; h.z = z;
      this.events.push({ e: 'force', pid: h.pid, seq: h.forceSeq, m: 'tp', x: +x.toFixed(2), z: +z.toFixed(2) });
    } else {
      this.events.push({ e: 'force', pid: h.pid, seq: h.forceSeq, m: mode, dx: data.dx, dz: data.dz, d: data.d || 0.3 });
    }
  },

  breakStealth(h) {
    if (h.stealthT <= 0) return;
    h.stealthT = 0;
    h.stateDirty = true;
  },

  // ---------------------------------------------------------------------------
  // Generic ability helpers
  // ---------------------------------------------------------------------------
  /** Melee cone; o: {range, arc(deg), coef, type, ability, onHit, color, mult, knock, critBonus} */
  meleeSwing(h, ctx, o) {
    const range = o.range, arc = (o.arc * Math.PI) / 180;
    const a = ctx.a;
    const foes = this.enemiesInRadius(TEAM_HEROES, ctx.ox, ctx.oz, range + 0.5);
    const hits = [];
    for (const m of foes) {
      if (!this.inShape({ shape: 'cone', x: ctx.ox, z: ctx.oz, a, arc, r: range }, m.x, m.z, m.radius)) continue;
      hits.push(m);
    }
    const hitOpts = { type: o.type || 'phys', ability: o.ability, melee: true, mult: (o.mult ?? 1) * ctx.mult, critBonus: o.critBonus || 0, aoe: hits.length > 2 };
    for (const m of hits) {
      this.hit(h, m, o.coef, hitOpts);
      if (o.knock && m.alive) this.knockback(m, ctx.ox, ctx.oz, o.knock);
      if (o.onHit) o.onHit(m);
    }
    this.fx('slash', { x: +ctx.ox.toFixed(2), z: +ctx.oz.toFixed(2), a: +a.toFixed(2), r: range, arc: o.arc, c: o.color || 'white', u: ctx.ghost ? 0 : h.id });
    if (hits.length) this.snd(o.sndHit || 'hit', ctx.ox, ctx.oz);
    else this.snd(o.snd || 'swing', ctx.ox, ctx.oz);
    return hits;
  },

  /** Fan of projectiles from ctx origin */
  shootFan(h, ctx, count, spreadDeg, proj) {
    const spread = (spreadDeg * Math.PI) / 180;
    const out = [];
    for (let i = 0; i < count; i++) {
      const off = count > 1 ? -spread / 2 + (spread * i) / (count - 1) : 0;
      const a = ctx.a + off;
      out.push(this.fireProjectile(Object.assign({
        owner: h, x: ctx.ox + Math.cos(a) * 0.6, z: ctx.oz + Math.sin(a) * 0.6, a, mult: ctx.mult,
      }, proj)));
    }
    return out;
  },

  /** dps value for hero DoTs based on coefficient (no crit, no dot bonus: applied at tick) */
  heroDps(h, coef, type = 'phys', ability = null) {
    const S = h.S;
    let inc = S.dmgPct + (S[{ phys: 'dmgPhys', fire: 'dmgFire', cold: 'dmgCold', light: 'dmgLight', poison: 'dmgPoison', holy: 'dmgHoly', shadow: 'dmgShadow', arcane: 'dmgArcane' }[type]] || 0);
    if (ability && h.P[ability]) inc += h.P[ability].dmg || 0;
    return coef * S.power * h.levelMul * Math.max(0.05, 1 + inc / 100) * S.more;
  },

  // ---------------------------------------------------------------------------
  // Potions & interactions
  // ---------------------------------------------------------------------------
  usePotion(h) {
    if (h.potions <= 0 || h.potionCd > 0 || h.downed) return false;
    if (h.hp >= h.maxHp - 0.5) { this.events.push({ e: 'msg', s: 'PV déjà au maximum', c: '#aaa', to: h.pid }); return false; }
    h.potions--;
    h.potionCd = 1;
    const amt = h.maxHp * 0.35 * (1 + (h.S.potionHeal || 0) / 100);
    this.heal(h, amt, h);
    this.fx('potion', { u: h.id });
    this.snd('potion', h.x, h.z);
    this.stat('potions', 1, h.pid);
    h.run.potions++;
    this.runFlags.potion = true;
    h.stateDirty = true;
    for (const k of h.hooks.onPotion) k.fn(this, h, k.e.v, k.e.st);
    return true;
  },

  heroInteract(h, dt, justPressed) {
    // 1) revive downed ally
    let best = null, bd = REVIVE_RANGE * REVIVE_RANGE;
    for (const o of this.heroes) {
      if (o === h || !o.downed) continue;
      const d = dist2(h.x, h.z, o.x, o.z);
      if (d < bd) { bd = d; best = o; }
    }
    if (best) {
      best.reviveProg += dt * (1 + (h.S.reviveSpd || 0) / 100);
      h.interactTarget = best.id;
      if (best.reviveProg >= REVIVE_TIME) this.reviveHero(best, 0.4, h);
      best.stateDirty = true;
      return;
    }
    // 2) chests (hold)
    let chest = null; bd = 2.4 * 2.4;
    for (const pk of this.pickups.values()) {
      if (pk.kind !== 'chest') continue;
      const d = dist2(h.x, h.z, pk.x, pk.z);
      if (d < bd) { bd = d; chest = pk; }
    }
    if (chest) {
      if (h.interactTarget !== -chest.id) { h.interactTarget = -chest.id; h.interactT = 0; }
      h.interactT += dt;
      if (h.interactT >= CHEST_OPEN_TIME) {
        h.interactT = 0;
        this.openChest(h, chest);
      }
      return;
    }
    // 3) item pickup (press)
    if (justPressed) {
      let item = null; bd = ITEM_PICK_RANGE * ITEM_PICK_RANGE;
      for (const pk of this.pickups.values()) {
        if (pk.kind !== 'item') continue;
        const d = dist2(h.x, h.z, pk.x, pk.z);
        if (d < bd) { bd = d; item = pk; }
      }
      if (item) this.pickupItem(h, item.id);
    }
  },
};
