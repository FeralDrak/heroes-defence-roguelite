// Wave composition, spawning, phase transitions (prep / wave / victory / defeat).
import {
  PHASE, FINAL_WAVE, BOSS_EVERY, READY_COUNTDOWN, ALL_READY_COUNTDOWN, TEAM_MONSTERS, ARENA_RADIUS,
} from '../constants.js';
import { SPAWNABLE, MONSTERS, BOSS_ORDER } from '../data/monsters.js';

export function waveType(w) {
  if (w % BOSS_EVERY === 0) return 'boss';
  if (w > 3 && w % 5 === 3) return 'horde';
  if (w > 4 && w % 5 === 4) return 'elite';
  return 'normal';
}

export const WAVE_TYPE_NAMES = { boss: 'Vague de boss', horde: 'Horde', elite: "Vague d'élite", normal: 'Vague' };

class Spawner {
  constructor(g, w) {
    this.queue = [];
    this.t = 2.0;
    this.done = false;
    const n = g.connectedCount(); // a friend who left for good no longer inflates the waves
    const type = waveType(w);
    this.type = type;
    const partyMul = 1 + g.diff.playerScale * (n - 1);
    let budget = (14 + 4.2 * w + 0.07 * w * w) * g.diff.count * partyMul;
    if (type === 'boss') budget *= 0.4;
    if (type === 'horde') budget *= 1.35;
    let eliteChance = Math.min(0.3, 0.012 + 0.006 * w + g.diff.elite);
    if (type === 'elite') eliteChance = Math.min(0.55, eliteChance * 3 + 0.08);
    if (w < 3) eliteChance = 0;
    const roster = SPAWNABLE.filter((m) => m.minWave <= w);
    const rng = g.rng;
    const weightOf = (m) => {
      let wgt = m.weight;
      if (w - m.minWave < 2) wgt *= 1.8; // spotlight new monsters
      if (type === 'horde') wgt /= Math.max(0.5, m.cost);
      return wgt;
    };
    let guaranteedElite = type === 'elite' ? 2 : 0;
    let safety = 0;
    while (budget > 0 && safety++ < 500) {
      const def = rng.weighted(roster, weightOf);
      const gmin = def.group ? def.group[0] : 2, gmax = def.group ? def.group[1] : 4;
      let count = rng.int(gmin, gmax);
      if (type === 'horde') count += 2;
      const groupCost = def.cost * count;
      let elite = -1;
      if ((guaranteedElite > 0 || rng.chance(eliteChance * Math.min(1, count / 2))) && def.cost >= 1) {
        elite = 0;
        guaranteedElite--;
        budget -= def.cost * 3.5;
      }
      budget -= groupCost;
      this.queue.push({ id: def.id, n: count, elite });
    }
    this.total = this.queue.reduce((s, q) => s + q.n, 0) + (type === 'boss' ? 1 : 0);
    this.interval = Math.max(0.9, 2.7 - w * 0.045) / (1 + 0.25 * (n - 1));
    this.maxAlive = Math.min(175, 55 + 22 * (n - 1) + 1.8 * w);
    this.spawned = 0;
  }

  remaining(g) {
    let alive = 0;
    for (const m of g.monsters) if (m.alive && !m.summoned && m.def.weight !== 0) alive++;
    let queued = 0;
    for (const q of this.queue) queued += q.n;
    const bosses = g.bosses.filter((b) => b.alive).length;
    return alive + queued + bosses + (this.bossPending ? 1 : 0);
  }

  update(g, dt) {
    if (this.done) return;
    this.t -= dt;
    if (this.t > 0) return;
    let alive = 0;
    for (const m of g.monsters) if (m.alive) alive++;
    if (alive >= this.maxAlive) { this.t = 0.5; return; }
    const grp = this.queue.shift();
    if (!grp) { this.done = true; return; }
    const gate = g.rng.pick(g.gates);
    const inX = -gate.x / Math.hypot(gate.x, gate.z), inZ = -gate.z / Math.hypot(gate.x, gate.z);
    for (let i = 0; i < grp.n; i++) {
      const side = (i - (grp.n - 1) / 2) * 0.9;
      const x = gate.x - inZ * side + inX * g.rng.range(-0.5, 0.5);
      const z = gate.z + inX * side + inZ * g.rng.range(-0.5, 0.5);
      const m = g.spawnMonster(grp.id, x, z, { elite: i === grp.elite, spawnT: 0.9 + g.rng.next() * 0.4 });
      m.gateDir = [inX, inZ];
      this.spawned++;
    }
    g.events.push({ e: 'gate', i: g.gates.indexOf(gate) });
    this.t = this.interval * (0.6 + grp.n * 0.15);
    if (!this.queue.length) this.done = true;
  }
}

export const waveMethods = {
  monsterScaling(w) {
    const d = this.diff;
    const n = this.connectedCount();
    const endless = Math.max(0, w - FINAL_WAVE);
    return {
      hp: Math.pow(1.145, w - 1) * Math.pow(1.08, endless) * d.hp * (1 + d.playerHp * (n - 1)),
      dmg: Math.pow(1.078, w - 1) * Math.pow(1.05, endless) * d.dmg,
      xp: Math.pow(1.12, w - 1),
      gold: Math.pow(1.09, w - 1),
    };
  },

  waveScale() { return Math.pow(1.09, Math.max(0, this.wave - 1)); },

  onPrepStart(first = false) {
    this.phase = PHASE.PREP;
    this.countdown = -1;
    for (const p of this.players.values()) p.ready = false;
    for (const h of this.heroes) {
      if (h.statsDirty) this.recomputeHero(h);
      h.potions = h.S.potionCharges + (h.bonusPotions || 0);
      h.bonusPotions = 0;
      h.shopRerolls = 0;
      h.tomesBought = h.tomesBought || 0;
      h.shop = this.generateShop(h);
      if (h.pendingLevels > 0 && !h.choice) h.choice = this.rollTalentChoice(h);
      h.stateDirty = true;
    }
    this.stateDirty = true;
    if (!first) this.snd('prep');
  },

  playerReady(pid) {
    const p = this.players.get(pid);
    if (!p || this.phase !== PHASE.PREP || p.ready) return;
    p.ready = true;
    if (this.countdown < 0) {
      this.countdown = READY_COUNTDOWN;
      this.msg(`${p.name} lance la vague ${this.wave} : début dans ${READY_COUNTDOWN} s !`, '#ffd24a');
    } else {
      this.msg(`${p.name} est prêt.`, '#ffd24a');
    }
    this.checkAllReady();
    this.stateDirty = true;
  },

  checkAllReady() {
    if (this.phase !== PHASE.PREP || this.countdown < 0) return;
    const list = [...this.players.values()].filter((q) => q.connected);
    if (list.length && list.every((q) => q.ready)) this.countdown = Math.min(this.countdown, ALL_READY_COUNTDOWN);
  },

  startWave() {
    const w = this.wave;
    this.phase = PHASE.WAVE;
    this.countdown = -1;
    this.waveTime = 0;
    this.spawner = new Spawner(this, w);
    const type = this.spawner.type;
    this.waveFlags = { start: this.time, potions: 0 };
    for (const h of this.heroes) {
      h.dmgTakenWave = 0;
      h.choice = h.choice || null;
      for (const k of h.hooks.onWaveStart) k.fn(this, h, k.e.v, k.e.st);
      h.stateDirty = true;
    }
    if (type === 'boss') {
      const idx = Math.floor(w / BOSS_EVERY - 1);
      const ids = [BOSS_ORDER[idx % BOSS_ORDER.length]];
      if (w > FINAL_WAVE + 5) ids.push(BOSS_ORDER[(idx + 3) % BOSS_ORDER.length]);
      this.spawner.bossPending = ids.length;
      ids.forEach((id, i) => {
        this.later(2.5 + i * 4, () => {
          if (this.phase !== PHASE.WAVE) return;
          const a = this.rng.angle();
          this.spawnBoss(id, Math.cos(a) * 14, Math.sin(a) * 14);
          this.spawner.bossPending--;
        });
      });
    }
    // treasure chest during the wave
    this.waveChest = null;
    if (w >= 2 && this.rng.chance(0.42)) {
      this.waveChest = { t: this.rng.range(15, 45), cursed: w >= 6 && this.rng.chance(0.3) };
    }
    const label = type === 'boss' ? 'Vague de boss' : type === 'horde' ? 'Horde !' : type === 'elite' ? 'Vague d\'élite' : 'Vague';
    this.msg(`${label} ${w}`, type === 'boss' ? '#ff5050' : '#ffffff', { big: 1, wave: w, wt: type });
    this.snd(type === 'boss' ? 'bosswave' : 'wavestart');
    this.stat('waves.started', 1);
    this.stateDirty = true;
  },

  updateWave(dt) {
    if (this.phase === PHASE.PREP) {
      if (this.countdown >= 0) {
        const before = Math.ceil(this.countdown);
        this.countdown -= dt;
        const after = Math.ceil(this.countdown);
        if (after !== before && after <= 5 && after > 0) this.snd('tick');
        if (this.countdown <= 0) this.startWave();
      }
      return;
    }
    if (this.phase !== PHASE.WAVE) return;
    this.waveTime += dt;
    this.spawner.update(this, dt);
    if (this.arena.hazard) this.arena.hazard(this, dt);
    if (this.waveChest && this.waveTime >= this.waveChest.t) {
      const c = this.waveChest;
      this.waveChest = null;
      const [x, z] = this.randomPointNear(0, 0, 4, 20);
      this.spawnPickup('chest', x, z, { tier: c.cursed ? 'cursed' : 'normal' });
      this.msg(c.cursed ? 'Un coffre maudit est apparu... (risqué !)' : 'Un coffre au trésor est apparu !', c.cursed ? '#c58cff' : '#ffd24a');
      this.snd('chest');
    }
    const alive = this.heroes.filter((h) => h.alive && !h.downed && !h.disconnected);
    if (!alive.length) { this.defeat(); return; }
    if (this.spawner.done && !this.spawner.bossPending) {
      let any = false;
      for (const m of this.monsters) if (m.alive) { any = true; break; }
      if (!any) this.endWave();
    }
  },

  endWave() {
    const w = this.wave;
    const elapsed = this.waveTime;
    // statistics & challenge flags
    this.stat('waves', 1);
    this.statMax('best.wave', w);
    this.statMax('best.wave.diff.' + this.diffId, w);
    this.statMax('best.wave.arena.' + this.arenaId, w);
    for (const h of this.heroes) {
      this.statMax('best.wave.cls.' + h.classId, w);
      if (h.dmgTakenWave <= 0 && w >= 5 && !h.downed) this.statMax('ch.nodamage', w);
      if (!h.downed && h.hp < h.maxHp * 0.1 && w % BOSS_EVERY === 0) this.stat('ch.closecall', 1);
    }
    if (w >= 10 && elapsed < 25) this.stat('ch.speedwave', 1);
    if (!this.runFlags.bought) this.statMax('ch.nobuy', w);
    if (!this.runFlags.potion) this.statMax('ch.nopotion', w);
    if (this.runFlags.deaths === 0) this.statMax('ch.nodeath', w);
    if (this.heroes.every((h) => Object.values(h.equip).every((it) => !it || it.rarity === 'common'))) this.statMax('ch.whiteonly', w);
    const n = this.playerCount();
    this.statMax('best.wave.players.' + n, w);
    if (n >= 2) this.statMax('best.wave.coop', w);

    // clean the battlefield
    for (const a of this.areas) if (a.alive && a.team === TEAM_MONSTERS) this.removeArea(a);
    for (const p of this.projectiles) if (p.team === TEAM_MONSTERS) p.alive = false;

    // rewards
    const bonus = (24 + 6 * w) * this.waveScale() * this.diff.gold;
    for (const h of this.heroes) {
      if (h.downed) this.reviveHero(h, 0.5, null);
      h.hp = h.maxHp;
      h.shield = 0;
      h.st = {};
      this.addGold(h, bonus, true);
      for (const k of h.hooks.onWaveEnd) k.fn(this, h, k.e.v, k.e.st);
      h.stateDirty = true;
    }
    if (this.rng.chance(0.3)) {
      const [x, z] = this.randomPointNear(0, 0, 3, 12);
      this.spawnPickup('chest', x, z, { tier: 'normal' });
    }
    this.msg(`Vague ${w} terminée ! +${Math.round(bonus)} or`, '#7dff9a', { big: 1 });
    this.snd('waveclear');

    if (w === FINAL_WAVE && !this.endless) {
      this.victory();
      return;
    }
    this.wave++;
    this.onPrepStart();
  },

  victory() {
    this.phase = PHASE.VICTORY;
    this.result = { win: true, wave: this.wave, time: this.time };
    this.stat('wins', 1);
    this.stat('wins.diff.' + this.diffId, 1);
    this.stat('wins.arena.' + this.arenaId, 1);
    this.stat('wins.players.' + this.playerCount(), 1);
    for (const h of this.heroes) this.stat('wins.cls.' + h.classId, 1);
    if (this.runFlags.deaths === 0) this.stat('wins.nodeath', 1);
    this.msg('VICTOIRE ! Le Dévoreur est vaincu !', '#ffd24a', { big: 1 });
    this.snd('victory');
    this.stateDirty = true;
  },

  continueEndless() {
    if (this.phase !== PHASE.VICTORY) return;
    this.endless = true;
    this.wave++;
    this.result = null;
    this.msg('Mode infini : jusqu\'où irez-vous ?', '#c58cff', { big: 1 });
    this.onPrepStart();
  },

  defeat() {
    this.phase = PHASE.DEFEAT;
    this.over = true;
    this.result = { win: false, wave: this.wave, time: this.time };
    this.stat('runs.lost', 1);
    this.msg(`Défaite à la vague ${this.wave}...`, '#ff5050', { big: 1 });
    this.snd('defeat');
    this.stateDirty = true;
  },

  onBossKilled(b, hero) {
    this.stat('boss.' + b.type, 1);
    this.stat('boss.' + b.type + '.diff.' + this.diffId, 1);
    if (b.script && b.script.onDeath) b.script.onDeath(this, b);
    if (b.phylacteries) for (const p of b.phylacteries) if (p.alive) this.killMonster(p, null, {});
    const fightTime = this.time - (b.bornT || this.time);
    if (fightTime > 0 && fightTime <= 30) this.stat('ch.boss30.' + b.type, 1);
    if (fightTime > 0 && fightTime <= 60) this.stat('ch.boss60', 1);
    this.spawnPickup('chest', b.x, b.z, { tier: 'boss' });
    this.msg(`${b.name} est vaincu !`, '#ffd24a', { big: 1 });
    this.snd('bossdeath', b.x, b.z);
    this.fx('shake', { x: b.x, z: b.z, s: 1 });
    this.stateDirty = true;
  },
};

export { MONSTERS, ARENA_RADIUS };
