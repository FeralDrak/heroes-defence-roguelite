// Boss framework: coroutine-driven attacks, phases and movement.
import { ANIM } from '../constants.js';
import { dist2 } from '../util/math.js';
import { BOSSES } from '../data/bosses.js';

export const bossMethods = {
  spawnBoss(defId, x, z, opts = {}) {
    const b = this.spawnMonster(defId, x, z, Object.assign({ spawnT: 2.2 }, opts));
    b.script = BOSSES[defId];
    b.cds = {};
    b.co = null;
    b.wait = 0;
    b.idle = 1.5;
    b.idleMul = 1;
    b.speedMul = 1;
    b.phase = 1;
    b.moveMode = 'chase';
    b.dmgTakenMul = 1;
    b.bornT = this.time + b.spawnT;
    this.bosses.push(b);
    this.msg(b.script.intro || `${b.name} apparaît !`, '#ff5050', { big: 1 });
    this.snd('bossintro', x, z);
    this.fx('shake', { x, z, s: 1 });
    this.stateDirty = true;
    return b;
  },

  updateBosses(dt) {
    for (const b of this.bosses) {
      if (!b.alive) continue;
      this.updateStatuses(b, dt);
      if (!b.alive) continue;
      if (b.spawnT > 0) { b.spawnT -= dt; continue; }
      const S = b.script;
      // phases
      const frac = b.hp / b.maxHp;
      while (S.phases && b.phase <= S.phases.length && frac <= S.phases[b.phase - 1]) {
        b.phase++;
        if (S.onPhase) S.onPhase(this, b, b.phase);
        this.stateDirty = true;
      }
      if (S.onUpdate) S.onUpdate(this, b, dt);
      this.monsterTarget(b, dt);

      if (b.co) {
        b.wait -= dt;
        let guard = 0;
        while (b.co && b.wait <= 0 && guard++ < 50) {
          let r;
          try { r = b.co.next(); } catch (err) { console.error('boss script error', err); r = { done: true }; }
          if (r.done) {
            b.co = null;
            b.idle = 0.7 * (b.idleMul || 1);
            b.moveMode = 'chase';
            b.speedMul = 1;
            b.anim = ANIM.IDLE;
          } else {
            b.wait += r.value ?? 0;
          }
        }
      } else {
        b.idle -= dt;
        if (b.idle <= 0 && b.target) {
          const att = this.pickBossAttack(b);
          if (att) {
            b.cds[att.id] = this.time + att.cd * (b.phase >= 2 ? 0.85 : 1);
            b.co = att.run(this, b, att);
            b.wait = 0;
          } else {
            b.idle = 0.3;
          }
        }
      }

      // movement
      let vx = 0, vz = 0;
      const t = b.target;
      if (t && b.canAct()) {
        const d = Math.sqrt(dist2(b.x, b.z, t.x, t.z));
        if (b.moveMode === 'chase') {
          const keep = S.keep;
          if (keep) {
            if (d > keep[1]) { vx = (t.x - b.x) / d; vz = (t.z - b.z) / d; }
            else if (d < keep[0]) { vx = -(t.x - b.x) / d; vz = -(t.z - b.z) / d; }
          } else if (d > b.radius + t.radius + 1.2) {
            vx = (t.x - b.x) / d; vz = (t.z - b.z) / d;
          }
          if (!b.co) b.rot = Math.atan2(t.z - b.z, t.x - b.x);
        }
      }
      this.moveUnit(b, vx, vz, dt, b.speed * (b.speedMul || 1));
      if (b.co && b.moveMode === 'stay') {
        // keep attack animation state from the script
      }
    }
    if (this.bosses.length && this.tick % 30 === 0) {
      this.bosses = this.bosses.filter((b) => b.alive);
    }
  },

  pickBossAttack(b) {
    const S = b.script;
    const t = b.target;
    const d = t ? Math.sqrt(dist2(b.x, b.z, t.x, t.z)) : 99;
    const options = S.attacks.filter((a) => {
      if ((a.phase || 1) > b.phase) return false;
      if ((b.cds[a.id] || 0) > this.time) return false;
      if (a.range && (d < a.range[0] || d > a.range[1] + b.radius)) return false;
      return true;
    });
    if (!options.length) return null;
    return this.rng.weighted(options, (a) => a.w);
  },
};
