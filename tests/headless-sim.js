// Headless simulation with simple bots: smoke test + rough balance numbers.
// Usage: node tests/headless-sim.js [classId|all] [maxWave] [players] [difficulty]
import { Game } from '../public/js/core/sim/game.js';
import { IN, PHASE, DT, TEAM_MONSTERS } from '../public/js/core/constants.js';
import { ABILITIES, CLASS_LIST } from '../public/js/core/data/classes/index.js';
import { canEquip } from '../public/js/core/items/itemgen.js';

const RANK = { common: 0, magic: 1, rare: 2, legendary: 3, unique: 4 };
const MELEE = new Set(['warrior', 'paladin', 'assassin']);

function nearestMonster(g, h) {
  let best = null, bd = Infinity;
  for (const m of g.monsters) {
    if (!m.alive || m.spawnT > 0) continue;
    const d = (m.x - h.x) ** 2 + (m.z - h.z) ** 2;
    if (d < bd) { bd = d; best = m; }
  }
  return [best, Math.sqrt(bd)];
}

function botStep(g, h, bot) {
  if (!h.alive || h.downed) return;
  const [t, d] = nearestMonster(g, h);
  let dx = 0, dz = 0;
  const melee = MELEE.has(h.classId);
  if (t) {
    const ux = (t.x - h.x) / (d || 1), uz = (t.z - h.z) / (d || 1);
    const low = h.hp < h.maxHp * 0.3;
    if (melee && !low) {
      if (d > 2) { dx = ux; dz = uz; }
    } else {
      if (d < 6) { dx = -ux; dz = -uz; }
      else if (d > 11) { dx = ux; dz = uz; }
      else { dx = -uz * 0.7; dz = ux * 0.7; }
    }
  } else {
    dx = -h.x * 0.05; dz = -h.z * 0.05;
  }
  // dodge telegraphs: escaping has priority over chasing
  let danger = false, ex = 0, ez = 0;
  for (const a of g.areas) {
    if (!a.alive || a.team !== TEAM_MONSTERS || a.resolved) continue;
    if (g.inShape(a, h.x, h.z, h.radius + 0.3)) {
      danger = true;
      if (a.shape === 'line') {
        // step sideways out of the line
        const px = -Math.sin(a.a), pz = Math.cos(a.a);
        const side = (h.x - a.x) * px + (h.z - a.z) * pz >= 0 ? 1 : -1;
        ex += px * side; ez += pz * side;
      } else {
        const ox = h.x - a.x, oz = h.z - a.z, ol = Math.hypot(ox, oz) || 1;
        ex += ox / ol; ez += oz / ol;
      }
    }
  }
  if (danger) { dx = ex; dz = ez; }
  // wall avoidance
  const r = Math.hypot(h.x, h.z);
  if (r > 25) { dx -= h.x / r; dz -= h.z / r; }
  const len = Math.hypot(dx, dz);
  let speed = h.S.moveSpeed * h.moveMul();
  if (h.air || h.dash) speed = 0;
  let x = h.x, z = h.z;
  if (len > 0.01 && speed > 0) { x += (dx / len) * speed * DT; z += (dz / len) * speed * DT; }
  [x, z] = g.clampToArena(x, z, h.radius);
  // apply pending pushes
  for (const ev of bot.pushes.splice(0)) { x += ev.dx; z += ev.dz; [x, z] = g.clampToArena(x, z, h.radius); }

  let held = 0, pressed = 0;
  const ax = t ? t.x : h.x + 1, az = t ? t.z : h.z;
  if (t && d < 22) held |= IN.PRIMARY;
  if (t) {
    for (let s = 1; s <= 4; s++) if (g.time >= h.cd[s] && Math.random() < 0.15 && d < 16) pressed |= 1 << s;
    if (d < 2.5 && h.dashCharges > 0 && !melee && Math.random() < 0.2) pressed |= IN.DASH;
    if (danger && h.dashCharges > 0 && Math.random() < 0.25) pressed |= IN.DASH;
  }
  if (h.hp < h.maxHp * 0.35 && h.potions > 0) pressed |= IN.POTION;
  let tx = x, tz = z;
  if (pressed & IN.DASH) {
    const ab = ABILITIES[h.cls.abilities[5]];
    const dist = h.P[ab.id].dist || 6;
    const a = danger ? Math.atan2(ez, ex) : Math.atan2(z - (t ? t.z : 0), x - (t ? t.x : 0));
    [tx, tz] = g.clampToArena(x + Math.cos(a) * dist, z + Math.sin(a) * dist, h.radius);
  }
  // leap / blink abilities: target toward enemy
  for (let s = 1; s <= 4; s++) {
    const ab = ABILITIES[h.cls.abilities[s]];
    if (ab.move && (pressed & (1 << s))) { tx = ax; tz = az; }
  }
  g.applyHeroInput(h, { x, z, ax, az, held, pressed, tx, tz, fs: h.forceSeq });
  // emulate client-side movement for movement abilities
  if (pressed & IN.DASH) {
    const ab = ABILITIES[h.cls.abilities[5]];
    if (ab.move && ab.move.kind === 'blink') { /* host teleports */ }
    else bot.pendingMove = [tx, tz];
  }
}

function prepStep(g, h, p) {
  // talents
  let guard = 0;
  while (h.pendingLevels > 0 && h.choice && guard++ < 50) g.handleAction(h.pid, { t: 'talent', i: Math.floor(Math.random() * h.choice.options.length) });
  // equip better items
  for (let i = 0; i < h.inv.length; i++) {
    const it = h.inv[i];
    if (!it || !canEquip(it, h.classId)) continue;
    const slot = it.slot === 'ring' ? (!h.equip.ring1 ? 'ring1' : !h.equip.ring2 ? 'ring2' : (RANK[h.equip.ring1.rarity] <= RANK[h.equip.ring2.rarity] ? 'ring1' : 'ring2')) : it.slot;
    const cur = h.equip[slot];
    const score = (x) => (x ? RANK[x.rarity] * 10 + x.ilvl : -1);
    if (score(it) > score(cur)) g.handleAction(h.pid, { t: 'equip', i, s: slot });
  }
  // sell leftovers
  for (let i = 0; i < h.inv.length; i++) if (h.inv[i]) g.handleAction(h.pid, { t: 'sell', i });
  // buy upgrades
  if (h.shop) {
    h.shop.forEach((o, i) => {
      if (o.sold || o.price > h.gold) return;
      const it = o.item;
      if (!canEquip(it, h.classId)) return;
      const slot = it.slot === 'ring' ? 'ring1' : it.slot;
      const cur = h.equip[slot];
      if (!cur || RANK[it.rarity] > RANK[cur.rarity] || it.ilvl > cur.ilvl + 3) g.handleAction(h.pid, { t: 'buy', i });
    });
  }
  if (!p.ready) g.handleAction(h.pid, { t: 'ready' });
}

function run(classId, maxWave, nPlayers, diff, seed) {
  const players = [];
  const classes = CLASS_LIST.map((c) => c.id);
  for (let i = 0; i < nPlayers; i++) players.push({ pid: i, name: 'Bot' + i, classId: classId === 'mix' ? classes[i % classes.length] : classId });
  const g = new Game({ seed, difficulty: diff, players, unlockAll: true });
  const bots = new Map(g.heroes.map((h) => [h.pid, { pushes: [], pendingMove: null }]));
  const t0 = Date.now();
  let lastWave = 0;
  let waveStart = 0;
  const log = [];
  let maxTicks = 30 * 60 * 90;
  while (!g.over && g.wave <= maxWave && maxTicks-- > 0) {
    if (g.phase === PHASE.PREP) {
      for (const p of g.players.values()) prepStep(g, p.hero, p);
    } else if (g.phase === PHASE.WAVE) {
      for (const h of g.heroes) botStep(g, h, bots.get(h.pid));
    } else if (g.phase === PHASE.VICTORY) {
      break;
    }
    if (GOD) for (const h of g.heroes) { h.invulnT = 5; if (h.downed) g.reviveHero(h, 1); }
    g.step();
    for (const ev of g.events) {
      if (ev.e === 'force' && ev.m === 'push') bots.get(ev.pid)?.pushes.push(ev);
    }
    // apply dash end positions (client-side movement emulation)
    for (const h of g.heroes) {
      const b = bots.get(h.pid);
      if (b.pendingMove && !h.dash) b.pendingMove = null;
      if (b.pendingMove && h.dash) {
        const [tx, tz] = b.pendingMove;
        const k = Math.min(1, h.dash.t / Math.max(0.05, h.dash.dur - 0.12));
        const nx = h.x + (tx - h.x) * k, nz = h.z + (tz - h.z) * k;
        g.applyHeroInput(h, { x: nx, z: nz, ax: h.input.ax, az: h.input.az, held: h.input.held, pressed: 0, fs: h.forceSeq });
      }
      if (!Number.isFinite(h.x) || !Number.isFinite(h.hp)) throw new Error(`NaN hero state ${h.classId}`);
    }
    g.events.length = 0;
    g.dmgEvents.length = 0;
    g.statEvents.length = 0;
    if (g.wave !== lastWave && g.phase === PHASE.WAVE) {
      lastWave = g.wave;
      waveStart = g.time;
    }
    if (g.phase === PHASE.PREP && lastWave === g.wave - 1 && lastWave > 0 && !log[lastWave]) {
      const h = g.heroes[0];
      log[lastWave] = { wave: lastWave, t: (g.time - waveStart).toFixed(0), lvl: h.level, hp: Math.round(h.maxHp), pow: h.S.power, gold: Math.round(h.gold), kills: h.run.kills };
    }
  }
  const h = g.heroes[0];
  return {
    classId, result: g.phase, wave: g.wave, level: h.level, kills: h.run.kills, dmg: Math.round(h.run.dmgDealt),
    taken: Math.round(h.run.dmgTaken), secs: ((Date.now() - t0) / 1000).toFixed(1), simMin: (g.time / 60).toFixed(1), log: log.filter(Boolean),
  };
}

const [, , clsArg = 'all', maxWaveArg = '10', playersArg = '1', diff = 'normal', godArg = ''] = process.argv;
const GOD = godArg === 'god';
const classes = clsArg === 'all' ? CLASS_LIST.map((c) => c.id) : [clsArg];
for (const c of classes) {
  try {
    const r = run(c, Number(maxWaveArg), Number(playersArg), diff, 12345);
    console.log(`${r.classId.padEnd(9)} ${r.result.padEnd(7)} wave=${r.wave} lvl=${r.level} kills=${r.kills} dmg=${r.dmg} taken=${r.taken} sim=${r.simMin}min real=${r.secs}s`);
    for (const l of r.log) console.log(`   w${l.wave}: ${l.t}s lvl${l.lvl} hp${l.hp} pow${l.pow} gold${l.gold} kills${l.kills}`);
  } catch (err) {
    console.error(`${c}: ERROR`, err);
    process.exitCode = 1;
  }
}
