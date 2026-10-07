// Damage pipeline, status effects, healing, deaths and rewards.
import { TEAM_HEROES, DF, DMG_TYPE_INDEX, PHASE } from '../constants.js';
import { TYPE_STAT } from '../data/stats.js';

const DOT_TICK = 0.5;

// Innate chance (%) of each damage type to apply its status on hit
const TYPE_STATUS = {
  fire: ['burn', 8], cold: ['chill', 15], light: ['shock', 10], poison: ['poison', 25],
};

export const combatMethods = {
  // ---------------------------------------------------------------------------
  // Offense (heroes & their minions)
  // ---------------------------------------------------------------------------
  /**
   * Hero-side hit computed from a damage coefficient.
   * o: { type, ability, aoe, dot, canCrit, forceCrit, critBonus, mult, inc, proc, melee, projectile, noLeech, summon }
   */
  hit(src, target, coef, o = {}) {
    if (!target || !target.alive || target.team === TEAM_HEROES || !src) return 0;
    const hero = src.kind === 'hero' ? src : src.owner;
    if (!hero || !hero.S) return 0;
    const S = hero.S;
    const type = o.type || 'phys';
    let base = coef * S.power * hero.levelMul;
    const minion = src !== hero;
    if (minion) base *= src.dmgMul ?? 1;
    let inc = S.dmgPct + (S[TYPE_STAT[type]] || 0) + (o.inc || 0);
    if (o.ability) {
      const P = hero.P[o.ability];
      if (P && P.dmg) inc += P.dmg;
    }
    if (minion || o.summon) inc += S.summonDmg;
    if (target.elite || target.boss) inc += S.dmgElite;
    if (target.isCC()) inc += S.dmgCC;
    if (o.dot) inc += S.dotDmg;
    const acc = this._acc || (this._acc = { inc: 0, more: 1, crit: 0, critMult: 0 });
    acc.inc = 0; acc.more = 1; acc.crit = 0; acc.critMult = 0;
    const mods = hero.hooks.dmgMod;
    for (let i = 0; i < mods.length; i++) mods[i].fn(this, hero, target, o, acc, mods[i].e.v, mods[i].e.st, src);
    inc += acc.inc;
    let amount = base * Math.max(0.05, 1 + inc / 100) * S.more * acc.more * (o.mult ?? 1);
    let crit = false;
    if (!o.dot && o.canCrit !== false) {
      const cc = S.critChance + (o.critBonus || 0) + acc.crit;
      if (o.forceCrit || this.rng.next() * 100 < cc) {
        crit = true;
        amount *= S.critMult + acc.critMult;
      }
    }
    if (!o.dot) amount *= 0.9 + this.rng.next() * 0.2;
    if (S.chaos) amount *= 0.5 + this.rng.next() * 2;
    const info = Object.assign({}, o);
    info.type = type; info.crit = crit; info.hero = hero; info.src = src; info.ally = true;
    const dealt = this.dealDamage(src, target, amount, info);
    if (dealt > 0) this.afterHit(hero, src, target, dealt, info);
    return dealt;
  },

  afterHit(hero, src, target, dealt, info) {
    const S = hero.S;
    hero.run.dmgDealt += dealt;
    if (dealt > hero.run.bestHit) hero.run.bestHit = dealt;
    if (!info.dot && !info.noLeech) {
      let ls = S.lifeSteal;
      if (src !== hero) ls = S.minionLeech || 0;
      if (ls > 0) this.heal(hero, dealt * (ls / 100) * (info.aoe ? 0.5 : 1), hero);
    }
    if (info.proc || info.dot || info.thorns) return;
    if (target.alive) this.rollStatuses(hero, target, dealt, info);
    const onHit = hero.hooks.onHit;
    for (let i = 0; i < onHit.length; i++) onHit[i].fn(this, hero, target, info, dealt, onHit[i].e.v, onHit[i].e.st);
    if (info.crit) {
      const onCrit = hero.hooks.onCrit;
      for (let i = 0; i < onCrit.length; i++) onCrit[i].fn(this, hero, target, info, dealt, onCrit[i].e.v, onCrit[i].e.st);
    }
  },

  rollStatuses(hero, target, dealt, info) {
    const S = hero.S;
    const rng = this.rng;
    const ts = TYPE_STATUS[info.type];
    const bonus = S.statusBonus || 0;
    let burn = S.burnChance, chill = S.chillChance, shock = S.shockChance, poison = S.poisonChance, bleed = S.bleedChance;
    if (ts) {
      if (ts[0] === 'burn') burn += ts[1] + bonus;
      else if (ts[0] === 'chill') chill += ts[1] + bonus;
      else if (ts[0] === 'shock') shock += ts[1] + bonus;
      else if (ts[0] === 'poison') poison += ts[1] + bonus;
    }
    if (burn > 0 && rng.next() * 100 < burn) this.applyStatus(target, 'burn', { dps: dealt * 0.25 * S.burnMul, dur: 3, hero });
    if (chill > 0 && rng.next() * 100 < chill) this.applyStatus(target, 'chill', { v: 0.25, dur: 2, hero });
    if (shock > 0 && rng.next() * 100 < shock) this.applyStatus(target, 'shock', { v: 0.15 * S.shockMul, dur: 3 * S.shockDur, hero });
    if (poison > 0 && rng.next() * 100 < poison) this.applyStatus(target, 'poison', { dps: dealt * 0.15 * S.poisonMul, dur: 4 * S.poisonDur, hero });
    if (bleed > 0 && rng.next() * 100 < bleed) this.applyStatus(target, 'bleed', { dps: dealt * 0.25, dur: 3, hero });
  },

  /** Area damage helper: hits every enemy of `src` in a circle. Returns list of hit units. */
  explode(src, x, z, r, coef, o = {}) {
    const hero = src.kind === 'hero' ? src : src.owner;
    const team = src.team;
    const targets = this.enemiesInRadius(team, x, z, r);
    const info = Object.assign({ aoe: true }, o);
    for (const t of targets) {
      if (o.exclude && o.exclude === t) continue;
      if (team === TEAM_HEROES) this.hit(src, t, coef, info);
      else this.dealDamage(src, t, coef, info);
      if (o.status && t.alive) this.applyStatus(t, o.status, Object.assign({ hero }, o.statusOpts));
      if (o.knock && t.alive) this.knockback(t, x, z, o.knock);
    }
    if (o.fx !== false) this.fx('boom', { x, z, r, c: o.color || o.type || 'fire' });
    if (o.snd !== false) this.snd(o.snd || 'boom', x, z);
    return targets;
  },

  // ---------------------------------------------------------------------------
  // Monster offense
  // ---------------------------------------------------------------------------
  monsterHit(m, target, mult = 1, o = {}) {
    if (!target || !target.alive) return 0;
    let amount = m.dmg * mult * m.dmgDealtMul;
    const st = m.st;
    if (st.weaken && st.weaken.t > 0) amount *= 1 - st.weaken.v;
    if (st.curse && st.curse.t > 0) amount *= 1 - st.curse.dealt;
    if (m.aff.frenzied && m.hp < m.maxHp * 0.5) amount *= 1.25;
    const dealt = this.dealDamage(m, target, amount, o);
    if (dealt > 0 && m.aff.vampiric) this.heal(m, dealt * 1.5 + m.maxHp * 0.01, m);
    return dealt;
  },

  // ---------------------------------------------------------------------------
  // Core damage application
  // ---------------------------------------------------------------------------
  dealDamage(src, target, amount, info = {}) {
    if (!target || !target.alive || !(amount > 0)) return 0;
    if (target.kind === 'monster') {
      if (target.spawnT > 0) return 0;
      if (target.invulnT > 0) {
        if (!info.dot) this.pushDmg(target, -1, info, DF.MISS); // -1: immune
        return 0;
      }
      return this.damageMonster(src, target, amount, info);
    }
    if (target.invulnT > 0) {
      if (!info.dot && target.kind === 'hero') this.pushDmg(target, -1, info, DF.MISS);
      return 0;
    }
    if (target.kind === 'hero') return this.damageHero(src, target, amount, info);
    return this.damageMinion(src, target, amount, info);
  },

  damageMonster(src, m, amount, info) {
    amount *= m.dmgTakenMul;
    const st = m.st;
    if (st.shock && st.shock.t > 0) amount *= 1 + st.shock.v;
    if (st.curse && st.curse.t > 0) amount *= 1 + st.curse.taken;
    if (m.aff.armored) amount *= 0.65;
    if (st.mark && st.mark.t > 0) st.mark.stored += amount * st.mark.pct;
    if (m.shield > 0) {
      const a = Math.min(m.shield, amount);
      m.shield -= a;
      amount -= a;
      if (amount <= 0) { if (!info.dot) this.pushDmg(m, -2, info, DF.MISS); return 0; } // -2: absorbed
    }
    m.hp -= amount;
    m.flashT = 0.12;
    if (info.hero) { m.lastHitBy = info.hero; m.lastHitInfo = info; }
    if (info.dot) this.accumulateDot(m, amount, info);
    else this.pushDmg(m, amount, info, info.crit ? DF.CRIT : 0);
    if (m.aff.electric && !info.dot && this.time >= (m.aff.electricT || 0)) {
      m.aff.electricT = this.time + 0.6;
      this.monsterElectricSpark(m);
    }
    if (m.hp <= 0) this.killMonster(m, info.hero || null, info);
    return amount;
  },

  damageMinion(src, u, amount, info) {
    amount *= 1 - (u.dr || 0);
    if (u.shield > 0) {
      const a = Math.min(u.shield, amount);
      u.shield -= a; amount -= a;
    }
    if (amount <= 0) return 0;
    u.hp -= amount;
    u.flashT = 0.12;
    if (!info.dot) this.pushDmg(u, amount, info, 0);
    if (u.hp <= 0) this.killAlly(u, src);
    return amount;
  },

  damageHero(src, h, amount, info) {
    if (h.downed || !h.alive) return 0;
    const S = h.S;
    if (!info.dot && !info.unavoidable && S.dodge > 0 && this.rng.next() * 100 < S.dodge) {
      this.pushDmg(h, 0, info, DF.MISS);
      return 0;
    }
    const type = info.type || 'phys';
    if (type === 'phys') {
      const k = 10 * this.wave + 40;
      const dr = S.armor / (S.armor + k);
      amount *= 1 - Math.min(0.85, dr);
    } else {
      amount *= 1 - Math.min(75, S.res) / 100;
    }
    amount *= (1 - Math.min(60, S.dmgReduc) / 100) * S.taken;
    if (h.lowHpDR && h.hp < h.maxHp * 0.3) amount *= 1 - h.lowHpDR;
    const acc = this._hacc || (this._hacc = { amount: 0, prevent: false });
    acc.amount = amount; acc.prevent = false;
    const onHurt = h.hooks.onHurt;
    for (let i = 0; i < onHurt.length; i++) onHurt[i].fn(this, h, src, info, acc, onHurt[i].e.v, onHurt[i].e.st);
    amount = acc.amount;
    if (amount <= 0) return 0;
    // Oath (paladin ring): nearby guardian takes a share
    if (!info.redirected && this.heroes.length > 1) {
      for (const o of this.heroes) {
        if (o === h || !o.alive || o.downed || !(o.S.oath > 0)) continue;
        const dx = o.x - h.x, dz = o.z - h.z;
        if (dx * dx + dz * dz > 100) continue;
        const share = amount * o.S.oath / 100;
        amount -= share;
        this.dealDamage(src, o, share, { type: 'phys', unavoidable: true, redirected: true, dot: info.dot });
        break;
      }
    }
    if (h.shield > 0) {
      const a = Math.min(h.shield, amount);
      h.shield -= a;
      amount -= a;
      if (amount <= 0) { this.pushDmg(h, -2, info, DF.MISS); return 0; }
    }
    h.hp -= amount;
    h.flashT = 0.12;
    h.lastHurtT = this.time;
    if (this.phase === PHASE.WAVE) h.dmgTakenWave += amount;
    h.run.dmgTaken += amount;
    if (info.dot) this.accumulateDot(h, amount, info);
    else this.pushDmg(h, amount, info, 0);
    // thorns
    if (src && src.kind === 'monster' && src.alive && info.melee && S.thorns > 0) {
      this.dealDamage(h, src, S.thorns * h.levelMul * (1 + (h.flags.thornsMul || 0) / 100), { type: 'phys', hero: h, ally: true, thorns: true, proc: true });
    }
    if (h.hp <= 0) this.heroLethal(h, src, info);
    return amount;
  },

  heroLethal(h, src, info) {
    const acc = { prevent: false };
    const hooks = h.hooks.onLethal;
    for (let i = 0; i < hooks.length; i++) {
      hooks[i].fn(this, h, acc, hooks[i].e.v, hooks[i].e.st);
      if (acc.prevent) break;
    }
    if (acc.prevent) { if (h.hp < 1) h.hp = 1; return; }
    this.downHero(h, src);
  },

  downHero(h, src) {
    h.hp = 0;
    h.downed = true;
    h.reviveProg = 0;
    h.shield = 0;
    h.channel = null;
    h.dash = null;
    h.air = null;
    h.st = {};
    h.run.deaths++;
    this.runFlags.deaths++;
    this.stat('deaths', 1, h.pid);
    this.events.push({ e: 'death', u: h.id, x: h.x, z: h.z, hero: 1 });
    this.msg(`${h.name} est tombé au combat !`, '#ff6b6b');
    this.snd('herodown', h.x, h.z);
    h.statsDirty = true;
    h.stateDirty = true;
    this.stateDirty = true;
    for (const m of this.monsters) if (m.target === h) m.target = null;
    for (const o of this.heroes) {
      if (o === h || !o.alive || o.downed) continue;
      for (const k of o.hooks.onAllyDown) k.fn(this, o, h, k.e.v, k.e.st);
    }
  },

  reviveHero(h, hpFrac = 0.4, by = null) {
    if (!h.downed) return;
    h.downed = false;
    h.alive = true;
    h.statsDirty = true;
    this.recomputeHero(h);
    h.hp = Math.max(1, h.maxHp * hpFrac);
    h.invulnT = 2;
    h.reviveProg = 0;
    this.fx('revive', { u: h.id });
    this.snd('revive', h.x, h.z);
    if (by && by !== h) {
      by.run.revives++;
      this.stat('revives', 1, by.pid);
      this.msg(`${by.name} a ranimé ${h.name} !`, '#7dff9a');
    }
    h.stateDirty = true;
    this.stateDirty = true;
  },

  // ---------------------------------------------------------------------------
  // Healing & shields
  // ---------------------------------------------------------------------------
  heal(u, amount, src = null) {
    if (!u || !u.alive || !(amount > 0)) return 0;
    if (u.kind === 'hero') {
      if (u.downed) return 0;
      amount *= 1 + u.S.healRecv / 100;
      if (u.S.noHeal && src !== u) amount *= 0.5;
    }
    const missing = u.maxHp - u.hp;
    const healed = Math.min(missing, amount);
    if (healed > 0) {
      u.hp += healed;
      u.healAcc += healed;
    }
    const over = amount - healed;
    if (u.kind === 'hero') {
      if (over > 0 && u.hooks.onOverheal.length) {
        for (const k of u.hooks.onOverheal) k.fn(this, u, over, k.e.v, k.e.st);
      }
      if (src && src.kind === 'hero' && src !== u) {
        src.run.healing += healed;
        if (healed > 0 && src.hooks.onHealOther.length) {
          for (const k of src.hooks.onHealOther) k.fn(this, src, u, healed, k.e.v, k.e.st);
        }
      }
    }
    return healed;
  },

  addShield(u, amount, dur = 5) {
    if (!u || !u.alive || !(amount > 0)) return;
    const cap = u.maxHp * 1.5;
    u.shield = Math.min(cap, Math.max(u.shield, 0) + amount);
    u.shieldT = Math.max(u.shieldT, dur);
  },

  // ---------------------------------------------------------------------------
  // Status effects
  // ---------------------------------------------------------------------------
  applyStatus(t, kind, o = {}) {
    if (!t || !t.alive) return;
    const st = t.st;
    const hero = t.kind === 'hero' ? t : null;
    const S = hero ? hero.S : null;
    switch (kind) {
      case 'stun': {
        if (t.boss || (S && S.ccImmune)) return;
        const d = (o.dur || 1) * (t.elite ? 0.6 : 1) * (hero ? 0.6 : 1);
        st.stun = Math.max(st.stun || 0, d);
        break;
      }
      case 'freeze': {
        if (S && S.ccImmune) { this.applyStatus(t, 'chill', { v: 0.3, dur: 2 }); return; }
        if (t.boss) { this.applyStatus(t, 'slow', { v: 0.35, dur: o.dur || 1.5 }); return; }
        if ((st.freezeImm || 0) > this.time) { this.applyStatus(t, 'chill', { v: 0.3, dur: 2, hero: o.hero }); return; }
        let d = (o.dur || 1.5) * (t.elite ? 0.6 : 1) * (hero ? 0.5 : 1);
        if (o.hero && o.hero.S) d += o.hero.S.freezeBonus || 0;
        st.freeze = Math.max(st.freeze || 0, d);
        st.freezeImm = this.time + d + (t.elite ? 2.5 : 1);
        if (st.chill) st.chill.stacks = 0;
        break;
      }
      case 'chill': {
        if (S && S.slowImmune) return;
        if (!st.chill) st.chill = { v: 0, t: 0, stacks: 0 };
        st.chill.v = Math.max(st.chill.v, o.v || 0.25);
        st.chill.t = Math.max(st.chill.t, o.dur || 2);
        st.chill.stacks++;
        const need = t.boss ? 999 : t.elite ? 8 : 5;
        if (st.chill.stacks >= need && o.canFreeze !== false && !hero) {
          st.chill.stacks = 0;
          this.applyStatus(t, 'freeze', { dur: 1.2, hero: o.hero });
        }
        break;
      }
      case 'slow': {
        if (S && S.slowImmune) return;
        const v = t.boss ? (o.v || 0.3) * 0.5 : (o.v || 0.3);
        if (!st.slow || st.slow.t <= 0) st.slow = { v, t: o.dur || 2 };
        else { st.slow.v = Math.max(st.slow.v, v); st.slow.t = Math.max(st.slow.t, o.dur || 2); }
        break;
      }
      case 'root': {
        if (t.boss || (S && (S.ccImmune || S.slowImmune))) return;
        st.root = Math.max(st.root || 0, o.dur || 1);
        break;
      }
      case 'burn': {
        if (S && S.burnImmune) return;
        const dps = o.dps || 1;
        if (!st.burn || st.burn.t <= 0 || dps >= st.burn.dps) st.burn = { dps, t: o.dur || 3, hero: o.hero || null, src: o.src || null, tick: st.burn ? st.burn.tick : 0 };
        else st.burn.t = Math.max(st.burn.t, o.dur || 3);
        break;
      }
      case 'bleed': {
        const dps = o.dps || 1;
        if (!st.bleed || st.bleed.t <= 0 || dps >= st.bleed.dps) st.bleed = { dps, t: o.dur || 3, hero: o.hero || null, src: o.src || null, tick: st.bleed ? st.bleed.tick : 0 };
        else st.bleed.t = Math.max(st.bleed.t, o.dur || 3);
        break;
      }
      case 'poison': {
        if (!st.poison) st.poison = [];
        const max = o.hero && o.hero.S ? (o.hero.S.poisonStacks || 12) : 8;
        st.poison.push({ dps: o.dps || 1, t: o.dur || 4 });
        while (st.poison.length > max) st.poison.shift();
        st.poisonHero = o.hero || null;
        st.poisonSrc = o.src || null;
        if (st.poisonTick === undefined) st.poisonTick = 0;
        break;
      }
      case 'corrupt': {
        const c = st.corrupt && st.corrupt.t > 0 ? st.corrupt : (st.corrupt = { stacks: 0, max: 5, dps: 0, t: 0, hero: null, tick: 0 });
        c.max = Math.max(c.max, o.max || 5);
        c.stacks = Math.min(c.max, c.stacks + (o.stacks || 1));
        c.dps = Math.max(c.dps, o.dps || 1);
        c.t = o.dur || 5;
        c.hero = o.hero || c.hero;
        break;
      }
      case 'shock': {
        if (!st.shock || st.shock.t <= 0) st.shock = { v: o.v || 0.15, t: o.dur || 3 };
        else { st.shock.v = Math.max(st.shock.v, o.v || 0.15); st.shock.t = Math.max(st.shock.t, o.dur || 3); }
        break;
      }
      case 'curse': {
        st.curse = { dealt: o.dealt || 0.3, taken: o.taken || 0.2, t: o.dur || 6, hero: o.hero || null };
        break;
      }
      case 'mark': {
        st.mark = { t: o.dur || 6, stored: 0, pct: o.pct || 0.4, hero: o.hero, radius: o.radius || 4, spread: o.spread || 0 };
        break;
      }
      case 'fear': {
        if (t.boss || hero) return;
        st.fear = { t: (o.dur || 2) * (t.elite ? 0.5 : 1), x: o.x ?? t.x, z: o.z ?? t.z };
        break;
      }
      case 'taunt': {
        if (hero) return;
        st.taunt = { t: (o.dur || 3) * (t.boss ? 0.5 : 1), by: o.by };
        t.target = o.by;
        break;
      }
      case 'weaken': {
        st.weaken = { v: o.v || 0.2, t: o.dur || 4 };
        break;
      }
      default:
        break;
    }
  },

  knockback(t, fromX, fromZ, force) {
    if (!t.alive || t.boss) return;
    if (t.kind === 'hero') return; // heroes are moved through forceMove
    if (t.kind === 'structure') return;
    let dx = t.x - fromX, dz = t.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    const f = force / Math.max(0.6, t.mass) * (t.elite ? 0.5 : 1);
    t.vx += dx * f;
    t.vz += dz * f;
  },

  /** Ticks status timers & damage over time for one unit */
  updateStatuses(u, dt) {
    const st = u.st;
    if (st.stun > 0) st.stun -= dt;
    if (st.freeze > 0) st.freeze -= dt;
    if (st.root > 0) st.root -= dt;
    if (st.chill && st.chill.t > 0) { st.chill.t -= dt; if (st.chill.t <= 0) st.chill.stacks = 0; }
    if (st.slow && st.slow.t > 0) st.slow.t -= dt;
    if (st.shock && st.shock.t > 0) st.shock.t -= dt;
    if (st.curse && st.curse.t > 0) st.curse.t -= dt;
    if (st.weaken && st.weaken.t > 0) st.weaken.t -= dt;
    if (st.fear && st.fear.t > 0) st.fear.t -= dt;
    if (st.taunt && st.taunt.t > 0) { st.taunt.t -= dt; if (st.taunt.t <= 0 || !st.taunt.by || !st.taunt.by.alive) st.taunt = null; }
    if (st.mark && st.mark.t > 0) {
      st.mark.t -= dt;
      if (st.mark.t <= 0) this.detonateMark(u);
    }
    if (u.shieldT > 0) { u.shieldT -= dt; if (u.shieldT <= 0) u.shield = 0; }
    if (u.invulnT > 0) u.invulnT -= dt;
    if (u.flashT > 0) u.flashT -= dt;
    if (!u.alive) return;

    const isMonster = u.kind === 'monster';
    // Burn
    if (st.burn && st.burn.t > 0) {
      st.burn.t -= dt;
      st.burn.tick += dt;
      if (st.burn.tick >= DOT_TICK) {
        st.burn.tick -= DOT_TICK;
        this.dotDamage(u, st.burn.dps * DOT_TICK, 'fire', st.burn.hero, st.burn.src, 'burn');
        if (!u.alive) return;
      }
    }
    if (st.bleed && st.bleed.t > 0) {
      st.bleed.t -= dt;
      st.bleed.tick += dt;
      if (st.bleed.tick >= DOT_TICK) {
        st.bleed.tick -= DOT_TICK;
        this.dotDamage(u, st.bleed.dps * DOT_TICK, 'phys', st.bleed.hero, st.bleed.src, 'bleed');
        if (!u.alive) return;
      }
    }
    if (st.poison && st.poison.length) {
      let dps = 0;
      for (let i = st.poison.length - 1; i >= 0; i--) {
        const p = st.poison[i];
        p.t -= dt;
        if (p.t <= 0) st.poison.splice(i, 1);
        else dps += p.dps;
      }
      st.poisonTick += dt;
      if (st.poisonTick >= DOT_TICK && dps > 0) {
        st.poisonTick -= DOT_TICK;
        this.dotDamage(u, dps * DOT_TICK, 'poison', st.poisonHero, st.poisonSrc, 'poison');
        if (!u.alive) return;
      }
    }
    if (st.corrupt && st.corrupt.t > 0) {
      const c = st.corrupt;
      c.t -= dt;
      c.tick += dt;
      if (c.tick >= DOT_TICK) {
        c.tick -= DOT_TICK;
        this.dotDamage(u, c.dps * c.stacks * DOT_TICK, 'shadow', c.hero, null, 'corrupt');
        if (!u.alive) return;
      }
      if (c.t <= 0) c.stacks = 0;
    }
    // Hero-side DoT on monsters, monster-side DoT on heroes
    if (isMonster && u.aff.poisonAura) { /* handled in affix update */ }
  },

  dotDamage(u, amount, type, hero, src, kind) {
    if (amount <= 0) return;
    if (u.kind === 'monster') {
      if (!hero) { this.dealDamage(src || null, u, amount, { type, dot: true }); return; }
      // hero DoTs scale with dot bonuses at application time (dps already includes them)
      const info = { type, dot: true, hero, ally: true, dotKind: kind, src: hero };
      const dealt = this.dealDamage(hero, u, amount * (1 + (hero.S.dotDmg || 0) / 100) * (u.boss ? 1 : 1), info);
      if (dealt > 0) {
        hero.run.dmgDealt += dealt;
        if (hero.S.dotLeech > 0) this.heal(hero, dealt * hero.S.dotLeech / 100, hero);
        if (kind === 'bleed' && hero.S.bleedLeech > 0) this.heal(hero, dealt * hero.S.bleedLeech / 100, hero);
      }
    } else {
      this.dealDamage(src, u, amount, { type, dot: true });
    }
  },

  detonateMark(u) {
    const mk = u.st.mark;
    if (!mk) return;
    u.st.mark = null;
    const hero = mk.hero;
    if (!hero || mk.stored <= 0) return;
    const targets = this.enemiesInRadius(TEAM_HEROES, u.x, u.z, mk.radius);
    for (const t of targets) {
      if (t === u && u.alive) continue;
      this.dealDamage(hero, t, mk.stored, { type: 'shadow', hero, ally: true, aoe: true, proc: true, ability: 'x_mark' });
      if (mk.spread > 0 && t.alive && t !== u) {
        this.applyStatus(t, 'mark', { dur: 4, pct: mk.pct, hero, radius: mk.radius, spread: mk.spread - 1 });
      }
    }
    this.fx('boom', { x: u.x, z: u.z, r: mk.radius, c: 'shadow' });
    this.snd('mark', u.x, u.z);
  },

  // ---------------------------------------------------------------------------
  // Damage number events
  // ---------------------------------------------------------------------------
  pushDmg(target, amount, info, flags) {
    let f = flags | (DMG_TYPE_INDEX[info.type || 'phys'] || 0);
    if (info.ally) f |= DF.ALLY_SRC;
    const pid = info.hero ? info.hero.pid : 255;
    this.dmgEvents.push(target.id, amount, f, pid);
  },

  accumulateDot(u, amount, info) {
    u.dotAcc += amount;
    u.dotAccType = DMG_TYPE_INDEX[info.type || 'phys'] || 0;
    u.dotAccSrc = info.hero ? info.hero.pid : 255;
    u.dotAccAlly = !!info.ally;
  },

  flushAccumulators(dt) {
    const flush = (u) => {
      if (u.dotAcc > 0) {
        u.dotAccT += dt;
        if (u.dotAccT >= 0.6 || !u.alive) {
          let f = DF.DOT | u.dotAccType;
          if (u.dotAccAlly) f |= DF.ALLY_SRC;
          this.dmgEvents.push(u.id, u.dotAcc, f, u.dotAccSrc);
          u.dotAcc = 0;
          u.dotAccT = 0;
        }
      }
      if (u.healAcc > 0) {
        u.healAccT += dt;
        if (u.healAccT >= 0.5) {
          if (u.healAcc >= 1) this.dmgEvents.push(u.id, u.healAcc, DF.HEAL, 255);
          u.healAcc = 0;
          u.healAccT = 0;
        }
      }
    };
    for (const m of this.monsters) flush(m);
    for (const h of this.heroes) flush(h);
    for (const a of this.allies) flush(a);
  },

  // ---------------------------------------------------------------------------
  // Deaths
  // ---------------------------------------------------------------------------
  killMonster(m, hero, info = {}) {
    if (!m.alive) return;
    m.alive = false;
    m.hp = 0;
    if (!hero && m.lastHitBy) hero = m.lastHitBy;
    this.events.push({ e: 'death', u: m.id, x: +m.x.toFixed(2), z: +m.z.toFixed(2), elite: m.elite ? 1 : 0, boss: m.boss ? 1 : 0 });
    if (!m.def.noCorpse && !m.summoned) {
      this.corpses.push({ x: m.x, z: m.z, t: this.time });
      if (this.corpses.length > 80) this.corpses.shift();
    }
    if (m.def.noReward) { this.onMonsterDeathBehaviors(m, hero, info); return; }

    this.giveRewards(m);
    this.rollMonsterLoot(m);

    // statistics
    this.stat('kills', 1);
    this.stat('kills.' + m.type, 1);
    if (m.elite) this.stat('elites', 1);
    if (m.boss) this.stat('bosses', 1);
    if (hero) {
      hero.run.kills++;
      if (m.elite) hero.run.elites++;
      if (m.boss) hero.run.bosses++;
      this.stat('kills.cls.' + hero.classId, 1);
      if (info.ability) this.stat('kab.' + info.ability, 1);
      if (info.src && info.src !== hero && info.src.kind) this.stat('kills.minion', 1);
      if (info.dot) this.stat('kills.dot', 1);
      const S = hero.S;
      if (S.lifeOnKill > 0) this.heal(hero, S.lifeOnKill * hero.levelMul, hero);
      if (S.killHealPct > 0) this.heal(hero, hero.maxHp * S.killHealPct / 100, hero);
      const onKill = hero.hooks.onKill;
      for (let i = 0; i < onKill.length; i++) onKill[i].fn(this, hero, m, info, onKill[i].e.v, onKill[i].e.st);
    }
    // multikill window
    this.killWindow.push(this.time);
    while (this.killWindow.length && this.killWindow[0] < this.time - 1) this.killWindow.shift();
    this.statMax('best.multikill', this.killWindow.length);

    this.onMonsterDeathBehaviors(m, hero, info);
  },

  killAlly(u, src) {
    if (!u.alive) return;
    u.alive = false;
    u.hp = 0;
    this.events.push({ e: 'death', u: u.id, x: +u.x.toFixed(2), z: +u.z.toFixed(2), ally: 1 });
    const owner = u.owner;
    if (owner && owner.hooks) {
      for (const k of owner.hooks.onMinionDeath) k.fn(this, owner, u, k.e.v, k.e.st);
    }
    if (u.def.onDeath) u.def.onDeath(this, u);
  },

  // ---------------------------------------------------------------------------
  // Rewards
  // ---------------------------------------------------------------------------
  partyScale() {
    const n = this.connectedCount();
    return 1 + this.diff.playerScale * (n - 1);
  },

  giveRewards(m) {
    const share = 1 / this.partyScale();
    const xp = m.xpVal * share;
    const gold = m.goldVal * share * this.diff.gold;
    for (const h of this.heroes) {
      this.addXp(h, xp);
      this.addGold(h, gold);
    }
  },

  addGold(h, amount, personal = false) {
    if (!(amount > 0)) return;
    const g = amount * (1 + (h.S.goldFind || 0) / 100);
    h.gold += g;
    h.run.gold += g;
    h.goldDirty = true;
    this.stat('gold', g, h.pid);
    if (personal) h.stateDirty = true;
  },

  addXp(h, amount) {
    if (!(amount > 0)) return;
    h.xp += amount * (1 + (h.S.xpGain || 0) / 100);
    let leveled = false;
    while (h.xp >= this.xpForLevel(h.level)) {
      h.xp -= this.xpForLevel(h.level);
      h.level++;
      h.pendingLevels++;
      leveled = true;
      this.stat('levels', 1, h.pid);
      this.statMax('best.level', h.level);
    }
    if (leveled) {
      h.statsDirty = true;
      h.stateDirty = true;
      this.stateDirty = true;
      this.fx('lvl', { u: h.id });
      this.snd('levelup', h.x, h.z);
      const hooks = h.hooks.onLevel;
      for (const k of hooks) k.fn(this, h, k.e.v, k.e.st);
    }
  },

  xpForLevel(level) {
    return Math.round(18 * Math.pow(1.2, level - 1) + 12 * (level - 1));
  },
};
