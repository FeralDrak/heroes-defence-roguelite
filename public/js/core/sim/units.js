import { TEAM_HEROES, TEAM_MONSTERS, UF, ANIM, INVENTORY_SIZE, SLOTS } from '../constants.js';

export class Unit {
  constructor(g, kind, team) {
    this.id = g.allocUnitId();
    this.kind = kind; // 'hero' | 'monster' | 'summon' | 'structure'
    this.team = team;
    this.x = 0; this.z = 0; this.rot = 0;
    this.vx = 0; this.vz = 0; // knockback impulse
    this.radius = 0.5;
    this.mass = 1;
    this.hp = 1; this.maxHp = 1;
    this.shield = 0; this.shieldT = 0;
    this.alive = true;
    this.st = {}; // status effects
    this.vis = 0;
    this.scale = 1;
    this.anim = ANIM.IDLE; this.animCount = 0; this.animLock = 0;
    this.invulnT = 0;
    this.untargetable = false;
    this.spawnT = 0;
    this.dotAcc = 0; this.dotAccT = 0; this.dotAccType = 0; this.dotAccSrc = 255;
    this.healAcc = 0; this.healAccT = 0;
    this.flashT = 0;
  }

  get isHero() { return this.kind === 'hero'; }
  get isMonster() { return this.kind === 'monster'; }
  get isAlly() { return this.team === TEAM_HEROES; }

  setAnim(state, lock = 0) {
    this.anim = state;
    this.animCount = (this.animCount + 1) & 31;
    this.animLock = lock;
  }

  /** Can act (not stunned/frozen) */
  canAct() {
    const st = this.st;
    return !(st.stun > 0 || st.freeze > 0) && this.spawnT <= 0;
  }

  isCC() {
    const st = this.st;
    return st.stun > 0 || st.freeze > 0 || (st.chill && st.chill.t > 0) || (st.slow && st.slow.t > 0) || st.root > 0;
  }

  moveMul() {
    const st = this.st;
    if (st.stun > 0 || st.freeze > 0 || st.root > 0) return 0;
    let m = 1;
    if (st.chill && st.chill.t > 0) m *= 1 - Math.min(0.7, st.chill.v);
    if (st.slow && st.slow.t > 0) m *= 1 - Math.min(0.8, st.slow.v);
    return m;
  }

  statusFlags() {
    const st = this.st;
    let f = 0;
    if (st.stun > 0) f |= UF.STUN;
    if (st.freeze > 0) f |= UF.FROZEN;
    if (st.chill && st.chill.t > 0) f |= UF.CHILL;
    if (st.burn && st.burn.t > 0) f |= UF.BURN;
    if ((st.poison && st.poison.length) || (st.corrupt && st.corrupt.t > 0)) f |= UF.POISON;
    if (st.shock && st.shock.t > 0) f |= UF.SHOCK;
    if (this.shield > 0) f |= UF.SHIELD;
    if (this.invulnT > 0) f |= UF.INVULN;
    if (st.root > 0) f |= UF.ROOT;
    if (st.mark && st.mark.t > 0) f |= UF.MARK;
    if (st.curse && st.curse.t > 0) f |= UF.CURSE;
    if (this.spawnT > 0) f |= UF.SPAWNING;
    return f;
  }
}

export class Hero extends Unit {
  constructor(g, player, cls) {
    super(g, 'hero', TEAM_HEROES);
    this.pid = player.pid;
    this.player = player;
    this.cls = cls;
    this.classId = cls.id;
    this.name = player.name;
    this.radius = 0.55;
    this.mass = 3;
    this.level = 1;
    this.xp = 0;
    this.gold = 0;
    this.equip = { weapon: null, helm: null, chest: null, gloves: null, boots: null, amulet: null, ring1: null, ring2: null };
    this.inv = new Array(INVENTORY_SIZE).fill(null);
    this.talents = {}; // id -> { picks: [rarityIdx...], v: {..summed values} }
    this.talentOrder = [];
    this.pendingLevels = 0;
    this.choice = null; // { options: [{id, r}], rerolls }
    this.extraChoices = 0;
    this.cd = new Array(SLOTS.length).fill(0); // game time when ready
    this.cdDur = new Array(SLOTS.length).fill(0);
    this.dashCharges = 1;
    this.dashChargeT = 0;
    this.potions = 2;
    this.potionCd = 0;
    this.buffs = [];
    this.effects = [];
    this.hooks = null;
    this.S = null;
    this.P = {};
    this.flags = {};
    this.input = { held: 0, pressed: 0, ax: 0, az: 0, tx: 0, tz: 0, seq: 0 };
    this.prevHeld = 0;
    this.lastMoveT = 0;
    this.moving = false;
    this.downed = false;
    this.reviveProg = 0;
    this.channel = null;
    this.dash = null;
    this.air = null;
    this.forceSeq = 0;
    this.ackForceSeq = 0;
    this.summons = [];
    this.structures = [];
    this.primaryT = 0; // next time primary may fire
    this.stealthT = 0;
    this.statsDirty = true;
    this.stateDirty = true;
    this.disconnected = false;
    this.interactT = 0;
    this.interactTarget = 0;
    this.lastHurtT = -99;
    this.dmgTakenWave = 0;
    this.recastQueue = [];
    this.run = {
      kills: 0, elites: 0, bosses: 0, dmgDealt: 0, dmgTaken: 0, healing: 0, gold: 0,
      deaths: 0, revives: 0, potions: 0, itemsFound: 0, bestHit: 0, bought: 0, sold: 0,
    };
  }

  get downedOrDead() { return this.downed || !this.alive; }

  hasTalent(id) { return !!this.talents[id]; }
  tv(id, key = 'v') { const t = this.talents[id]; return t ? (t.v[key] || 0) : 0; }
  fl(name) { return this.flags[name] || 0; }

  canAct() {
    return super.canAct() && !this.downed && !this.air;
  }
}

export class Monster extends Unit {
  constructor(g, def) {
    super(g, 'monster', TEAM_MONSTERS);
    this.def = def;
    this.type = def.id;
    this.radius = def.radius;
    this.mass = def.mass || 1;
    this.elite = false;
    this.boss = false;
    this.affixes = [];
    this.target = null;
    this.retargetT = 0;
    this.atkCd = 0.5 + Math.random();
    this.state = 'chase';
    this.stateT = 0;
    this.speed = def.speed;
    this.dmg = 1;
    this.xpVal = 1;
    this.goldVal = 1;
    this.lastHitBy = null;
    this.lastHitInfo = null;
    this.dmgTakenMul = 1;
    this.dmgDealtMul = 1;
    this.aff = {}; // affix runtime state
    this.special = 0;
    this.flying = !!def.flying;
    this.phase = 1;
    this.name = def.name;
  }
}

export class Ally extends Unit {
  constructor(g, owner, def) {
    super(g, def.structure ? 'structure' : 'summon', TEAM_HEROES);
    this.owner = owner;
    this.def = def;
    this.type = def.id;
    this.radius = def.radius || 0.45;
    this.mass = def.mass || 1;
    this.ttl = Infinity;
    this.target = null;
    this.retargetT = 0;
    this.atkCd = 0.3;
    this.dmgMul = 1;
    this.speed = def.speed || 0;
    this.structure = !!def.structure;
    this.state = 'idle';
    this.stateT = 0;
    this.data = {};
    this.taunt = !!def.taunt;
    this.name = def.name;
  }
}

export { TEAM_HEROES, TEAM_MONSTERS };
