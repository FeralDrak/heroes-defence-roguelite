// Authoritative game simulation. Runs in the host's browser (or headless in Node).
import { RNG } from '../util/rng.js';
import {
  DT, TEAM_HEROES, TEAM_MONSTERS, WORLD_HALF, ARENA_RADIUS, PHASE, FINAL_WAVE,
} from '../constants.js';
import { inCone, inLine, dist2 } from '../util/math.js';
import { SpatialGrid } from './spatial.js';
import { Hero } from './units.js';
import { CLASSES } from '../data/classes/index.js';
import { DIFFICULTIES } from '../data/difficulty.js';
import { ARENAS } from '../data/arenas.js';
import { VIS_IDS } from '../data/visuals.js';
import { combatMethods } from './combat.js';
import { entityMethods } from './entities.js';
import { heroMethods } from './heroes.js';
import { monsterMethods } from './monsterai.js';
import { bossMethods } from './bossai.js';
import { allyMethods } from './allyai.js';
import { waveMethods } from './waves.js';
import { lootMethods } from './loot.js';
import { actionMethods } from './actions.js';

export class Game {
  /**
   * @param {object} opts
   *  - seed, difficulty, arena
   *  - players: [{pid, name, classId}]
   *  - unlocks: { uniques:Set, aspects:Set, talents:Set } (ignored if unlockAll)
   *  - unlockAll: bool (tests)
   */
  constructor(opts) {
    this.opts = opts;
    this.seed = opts.seed ?? Math.floor(Math.random() * 1e9);
    this.rng = new RNG(this.seed);
    this.diffId = opts.difficulty || 'normal';
    this.diff = DIFFICULTIES[this.diffId] || DIFFICULTIES.normal;
    this.arenaId = opts.arena || 'colosseum';
    this.arena = ARENAS[this.arenaId] || ARENAS.colosseum;
    this.unlockAll = !!opts.unlockAll;
    this.unlocks = opts.unlocks || { uniques: new Set(), aspects: new Set(), talents: new Set() };
    this.endless = false;

    this.tick = 0;
    this.time = 0;
    this.phase = PHASE.PREP;
    this.wave = 1;
    this.countdown = -1;
    this.waveTime = 0;

    this.units = new Map();
    this.heroes = [];
    this.monsters = [];
    this.allies = [];
    this.projectiles = [];
    this.areas = [];
    this.pickups = new Map();
    this.corpses = [];

    this.events = [];
    this.dmgEvents = [];
    this.statEvents = [];

    this.grid = new SpatialGrid(WORLD_HALF, 2.5);
    this.players = new Map();

    this._uid = 1;
    this._prid = 1;
    this._aid = 1;
    this._kid = 1;
    this._iuid = 1;

    this.obstacles = this.arena.obstacles.map((o) => ({ ...o }));
    this.gates = this.arena.gates;
    this.arenaState = {};
    this.spawner = null;
    this.bosses = [];
    this.stateDirty = true;
    this.over = false;
    this.result = null;
    this.timers = [];
    this.killWindow = []; // timestamps of recent kills (multikill achievements)
    this.waveFlags = {};
    this.runFlags = { bought: false, potion: false, nonCommon: false, deaths: 0 };

    for (const p of opts.players) this.addPlayer(p);
    this.onPrepStart(true);
  }

  // ---------------------------------------------------------------------------
  // Ids
  // ---------------------------------------------------------------------------
  allocUnitId() {
    for (;;) {
      const id = this._uid;
      this._uid = this._uid >= 65535 ? 1 : this._uid + 1;
      if (!this.units.has(id)) return id;
    }
  }
  allocProjId() { const id = this._prid; this._prid = this._prid >= 65535 ? 1 : this._prid + 1; return id; }
  allocAreaId() { return this._aid++; }
  allocPickId() { return this._kid++; }
  allocItemUid() { return this._iuid++; }

  // ---------------------------------------------------------------------------
  // Players
  // ---------------------------------------------------------------------------
  addPlayer({ pid, name, classId }) {
    const cls = CLASSES[classId] || CLASSES.warrior;
    const player = { pid, name, classId: cls.id, hero: null, ready: false, connected: true, shop: null };
    const hero = new Hero(this, player, cls);
    player.hero = hero;
    const n = this.players.size;
    const a = (n / 4) * Math.PI * 2 + Math.PI / 4;
    hero.x = Math.cos(a) * 2.5;
    hero.z = Math.sin(a) * 2.5;
    hero.rot = a + Math.PI;
    hero.vis = this.visId('hero_' + cls.id);
    this.players.set(pid, player);
    this.units.set(hero.id, hero);
    this.heroes.push(hero);
    this.initHero(hero);
    this.stateDirty = true;
    return player;
  }

  /** A player joining a run in progress catches up with the team */
  addLatePlayer({ pid, name, classId }) {
    const others = this.heroes.slice();
    const p = this.addPlayer({ pid, name, classId });
    const h = p.hero;
    if (others.length) {
      const lvl = Math.min(...others.map((o) => o.level));
      h.level = lvl;
      h.pendingLevels = lvl - 1;
      h.gold = Math.max(h.gold, others.reduce((s, o) => s + o.gold, 0) / others.length * 0.75);
      const ref = others.find((o) => o.alive && !o.downed) || others[0];
      [h.x, h.z] = this.randomPointNear(ref.x, ref.z, 1.5, 3);
    }
    h.statsDirty = true;
    this.recomputeHero(h);
    h.hp = h.maxHp;
    h.potions = h.S.potionCharges;
    h.shop = this.generateShop(h);
    if (h.pendingLevels > 0) h.choice = this.rollTalentChoice(h);
    this.msg(`${name} rejoint la bataille !`, '#7dff9a');
    this.stateDirty = true;
    return p;
  }

  getPlayer(pid) { return this.players.get(pid); }

  isUnlocked(kind, def) {
    if (this.unlockAll || !def.locked) return true;
    const set = this.unlocks[kind];
    return !!(set && set.has(def.id));
  }

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------
  step() {
    if (this.over) return;
    this.tick++;
    this.time += DT;
    const dt = DT;
    this.rebuildGrid();
    this.updateHeroes(dt);
    this.updateAllies(dt);
    this.updateMonsters(dt);
    this.updateBosses(dt);
    this.updateProjectiles(dt);
    this.updateAreas(dt);
    this.updateTimers();
    this.updatePickups(dt);
    this.updateCorpses(dt);
    this.updateWave(dt);
    this.flushAccumulators(dt);
    this.cleanupDead();
  }

  /** Run fn after `delay` seconds of game time */
  later(delay, fn) {
    this.timers.push({ t: this.time + delay, fn });
  }

  updateTimers() {
    if (!this.timers.length) return;
    const now = this.time + 1e-6;
    let due = null;
    const keep = [];
    for (const t of this.timers) {
      if (t.t <= now) (due || (due = [])).push(t);
      else keep.push(t);
    }
    if (!due) return;
    this.timers = keep;
    for (const t of due) {
      try { t.fn(); } catch (err) { console.error('timer error', err); }
    }
  }

  rebuildGrid() {
    this.grid.clear();
    for (const m of this.monsters) if (m.alive) this.grid.insert(m);
  }

  cleanupDead() {
    if (this.monsters.some((m) => !m.alive)) {
      this.monsters = this.monsters.filter((m) => {
        if (!m.alive) this.units.delete(m.id);
        return m.alive;
      });
    }
    if (this.allies.some((a) => !a.alive)) {
      this.allies = this.allies.filter((a) => {
        if (!a.alive) {
          this.units.delete(a.id);
          const o = a.owner;
          if (o) {
            o.summons = o.summons.filter((s) => s !== a);
            o.structures = o.structures.filter((s) => s !== a);
          }
        }
        return a.alive;
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------
  /** Alive, targetable units belonging to `team` within r of (x,z). */
  unitsInRadius(team, x, z, r, out = [], includeUntargetable = false) {
    if (team === TEAM_MONSTERS) {
      this.grid.forEachNear(x, z, r + 3, (u) => {
        if (!u.alive || (!includeUntargetable && u.untargetable)) return;
        const rr = r + u.radius;
        if (dist2(x, z, u.x, u.z) <= rr * rr) out.push(u);
      });
    } else {
      for (const h of this.heroes) {
        if (!h.alive || h.downed || (!includeUntargetable && h.untargetable)) continue;
        const rr = r + h.radius;
        if (dist2(x, z, h.x, h.z) <= rr * rr) out.push(h);
      }
      for (const a of this.allies) {
        if (!a.alive || (!includeUntargetable && a.untargetable)) continue;
        const rr = r + a.radius;
        if (dist2(x, z, a.x, a.z) <= rr * rr) out.push(a);
      }
    }
    return out;
  }

  enemiesInRadius(team, x, z, r, out = []) {
    return this.unitsInRadius(team === TEAM_HEROES ? TEAM_MONSTERS : TEAM_HEROES, x, z, r, out);
  }

  heroesInRadius(x, z, r, includeDowned = false) {
    const out = [];
    for (const h of this.heroes) {
      if (!h.alive || (!includeDowned && h.downed)) continue;
      const rr = r + h.radius;
      if (dist2(x, z, h.x, h.z) <= rr * rr) out.push(h);
    }
    return out;
  }

  nearestEnemy(team, x, z, maxR = 999, filter = null) {
    let best = null, bd = maxR * maxR;
    const consider = (u) => {
      if (!u.alive || u.untargetable || (u.kind === 'hero' && (u.downed || u.stealthT > 0))) return;
      if (filter && !filter(u)) return;
      const d = dist2(x, z, u.x, u.z);
      if (d < bd) { bd = d; best = u; }
    };
    if (team === TEAM_HEROES) {
      if (maxR < 30) this.grid.forEachNear(x, z, maxR + 3, consider);
      else for (const m of this.monsters) consider(m);
    } else {
      for (const h of this.heroes) consider(h);
      for (const a of this.allies) consider(a);
    }
    return best;
  }

  /** Units of `team` inside a shape: {shape, x, z, r, r2, a, arc, len, w} */
  unitsInShape(team, sh, out = []) {
    const reach = sh.shape === 'line' ? (sh.len || 0) + (sh.w || 0) : (sh.r || 0);
    const cx = sh.shape === 'line' ? sh.x + Math.cos(sh.a) * sh.len / 2 : sh.x;
    const cz = sh.shape === 'line' ? sh.z + Math.sin(sh.a) * sh.len / 2 : sh.z;
    const cand = this.unitsInRadius(team, cx, cz, sh.shape === 'line' ? reach / 2 + 1 : reach + 0.5);
    for (const u of cand) {
      if (this.inShape(sh, u.x, u.z, u.radius)) out.push(u);
    }
    return out;
  }

  inShape(sh, x, z, pr = 0) {
    switch (sh.shape) {
      case 'circle': {
        const rr = sh.r + pr;
        return dist2(sh.x, sh.z, x, z) <= rr * rr;
      }
      case 'ring': {
        const d = Math.sqrt(dist2(sh.x, sh.z, x, z));
        return d + pr >= sh.r2 && d - pr <= sh.r;
      }
      case 'cone':
        return inCone(sh.x, sh.z, sh.a, sh.arc / 2, sh.r, x, z, pr);
      case 'line':
        return inLine(sh.x, sh.z, sh.a, sh.len, sh.w / 2, x, z, pr);
      default:
        return false;
    }
  }

  aliveHeroes() { return this.heroes.filter((h) => h.alive && !h.downed); }
  playerCount() { return Math.max(1, this.players.size); }
  connectedCount() { let n = 0; for (const p of this.players.values()) if (p.connected) n++; return Math.max(1, n); }

  randomHero() {
    const list = this.aliveHeroes().filter((h) => h.stealthT <= 0);
    return list.length ? this.rng.pick(list) : null;
  }

  /** Keep a point inside the arena and out of obstacles */
  clampToArena(x, z, r = 0.5) {
    const lim = ARENA_RADIUS - r;
    const d = Math.hypot(x, z);
    if (d > lim) { x = (x / d) * lim; z = (z / d) * lim; }
    for (const o of this.obstacles) {
      const dx = x - o.x, dz = z - o.z;
      const dd = Math.hypot(dx, dz), min = o.r + r;
      if (dd < min) {
        if (dd < 0.001) { x = o.x + min; continue; }
        x = o.x + (dx / dd) * min; z = o.z + (dz / dd) * min;
      }
    }
    return [x, z];
  }

  blockedByObstacle(x, z, r = 0) {
    for (const o of this.obstacles) if (dist2(x, z, o.x, o.z) < (o.r + r) * (o.r + r)) return true;
    return Math.hypot(x, z) > ARENA_RADIUS + 1.5;
  }

  /** Random walkable point near (x,z) */
  randomPointNear(x, z, minR, maxR) {
    for (let i = 0; i < 12; i++) {
      const a = this.rng.angle(), r = this.rng.range(minR, maxR);
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (Math.hypot(px, pz) < ARENA_RADIUS - 1 && !this.blockedByObstacle(px, pz, 0.6)) return [px, pz];
    }
    return this.clampToArena(x, z, 0.6);
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------
  fx(t, data) { this.events.push({ e: 'fx', t, ...data }); }
  snd(s, x, z, v) { this.events.push({ e: 'snd', s, x, z, v }); }
  msg(s, c = '#fff', opts = {}) { this.events.push({ e: 'msg', s, c, ...opts }); }
  text(u, s, c = '#fff') { this.events.push({ e: 'fx', t: 'text', u: u.id, s, c }); }

  /** Profile statistic event (consumed by the host's achievement tracker) */
  stat(key, n = 1, pid = null) { this.statEvents.push({ k: key, n, pid }); }
  statMax(key, v, pid = null) { this.statEvents.push({ k: key, max: v, pid }); }

  visId(name) { return VIS_IDS[name] ?? 0; }

  // ---------------------------------------------------------------------------
  // Game state summary for clients
  // ---------------------------------------------------------------------------
  publicState() {
    const players = [];
    for (const p of this.players.values()) {
      const h = p.hero;
      players.push({
        pid: p.pid, name: p.name, classId: p.classId, heroId: h.id, level: h.level,
        ready: p.ready, connected: p.connected, downed: h.downed, alive: h.alive,
        pending: h.pendingLevels, gold: Math.floor(h.gold),
      });
    }
    const bosses = this.bosses.filter((b) => b.alive).map((b) => ({ id: b.id, name: b.name, hp: b.hp, maxHp: b.maxHp, phase: b.phase, shield: b.dmgTakenMul < 0.5 }));
    return {
      phase: this.phase,
      wave: this.wave,
      finalWave: FINAL_WAVE,
      endless: this.endless,
      countdown: this.countdown,
      diff: this.diffId,
      arena: this.arenaId,
      players,
      bosses,
      remaining: this.spawner ? this.spawner.remaining(this) : 0,
      total: this.spawner ? this.spawner.total : 0,
      waveTime: this.waveTime,
      result: this.result,
    };
  }
}

Object.assign(
  Game.prototype,
  combatMethods,
  entityMethods,
  heroMethods,
  monsterMethods,
  bossMethods,
  allyMethods,
  waveMethods,
  lootMethods,
  actionMethods,
);
