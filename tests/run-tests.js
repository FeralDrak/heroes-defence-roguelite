// Content & protocol consistency tests. Usage: npm test
import { ACHIEVEMENTS } from '../public/js/core/data/achievements.js';
import { UNIQUES_LIST } from '../public/js/core/data/uniques.js';
import { ASPECTS_LIST } from '../public/js/core/data/aspects.js';
import { TALENT_LIST } from '../public/js/core/data/talents.js';
import { CLASS_LIST, ABILITIES } from '../public/js/core/data/classes/index.js';
import { DIFFICULTY_LIST } from '../public/js/core/data/difficulty.js';
import { ARENA_LIST } from '../public/js/core/data/arenas.js';
import { BUFFS } from '../public/js/core/data/buffs.js';
import { Game } from '../public/js/core/sim/game.js';
import { buildState, encodeSnapshot, decodeSnapshot, encodeInput, decodeInput } from '../public/js/core/net/protocol.js';
import { generateItem } from '../public/js/core/items/itemgen.js';
import { packFrame, Reassembler } from '../public/js/net/p2p.js';

let failures = 0;
const fail = (msg) => { failures++; console.error('✗ ' + msg); };
const ok = (msg) => console.log('✓ ' + msg);

// ---- unlock coverage ----
const lockables = {
  unique: UNIQUES_LIST, aspect: ASPECTS_LIST, talent: TALENT_LIST, class: CLASS_LIST, difficulty: DIFFICULTY_LIST, arena: ARENA_LIST,
};
const rewarded = {};
for (const a of ACHIEVEMENTS) {
  for (const r of a.reward) {
    const key = r.type + ':' + r.id;
    if (rewarded[key]) fail(`${key} rewarded twice (${rewarded[key]} & ${a.id})`);
    rewarded[key] = a.id;
    const list = lockables[r.type];
    if (!list) { fail(`${a.id}: unknown reward type ${r.type}`); continue; }
    const def = list.find((x) => x.id === r.id);
    if (!def) fail(`${a.id}: reward ${key} does not exist`);
    else if (!def.locked) fail(`${a.id}: reward ${key} is not locked`);
  }
}
const unassigned = [];
for (const [type, list] of Object.entries(lockables)) {
  for (const def of list) if (def.locked && !rewarded[type + ':' + def.id]) unassigned.push(type + ':' + def.id);
}
if (unassigned.length) fail(`locked content without achievement (${unassigned.length}): ${unassigned.join(', ')}`);
else ok('every locked item is unlocked by exactly one achievement');

const ids = new Set();
for (const a of ACHIEVEMENTS) { if (ids.has(a.id)) fail('duplicate achievement ' + a.id); ids.add(a.id); }
const empty = ACHIEVEMENTS.filter((a) => !a.reward.length).map((a) => a.id);
console.log(`  ${ACHIEVEMENTS.length} achievements (${empty.length} without reward: ${empty.join(', ') || '-'})`);

// ---- 75% locked ----
for (const [name, list] of [['uniques', UNIQUES_LIST], ['aspects', ASPECTS_LIST], ['classes', CLASS_LIST]]) {
  const locked = list.filter((x) => x.locked).length;
  const pct = Math.round((locked / list.length) * 100);
  console.log(`  ${name}: ${list.length} total, ${locked} locked (${pct}%)`);
  if (pct < 74) fail(`${name}: less than 75% locked`);
}
if (UNIQUES_LIST.length < 100) fail('less than 100 uniques');

// ---- talents / abilities reference integrity ----
for (const t of TALENT_LIST) {
  if (!t.vals || !t.desc) fail('talent without vals/desc ' + t.id);
  for (const k in t.vals) if (t.vals[k].length !== 5) fail(`talent ${t.id}: vals.${k} must have 5 rarity values`);
  for (const m of t.desc.matchAll(/\{(\w+)\}/g)) if (!(m[1] in t.vals)) fail(`talent ${t.id}: placeholder {${m[1]}} has no value`);
}
for (const c of CLASS_LIST) {
  if (c.abilities.length !== 6) fail(`class ${c.id} must have 6 abilities`);
  for (const id of c.abilities) if (!ABILITIES[id]) fail(`class ${c.id}: missing ability ${id}`);
}
for (const u of UNIQUES_LIST) {
  for (const m of (u.desc || '').matchAll(/\{(\w+)\}/g)) if (!u.vals || !(m[1] in u.vals)) fail(`unique ${u.id}: placeholder {${m[1]}} has no value`);
}
ok('talent/unique descriptions consistent');

// ---- recompute with every talent / unique / aspect / buff (smoke) ----
for (const c of CLASS_LIST) {
  const g = new Game({ seed: 1, players: [{ pid: 0, name: 'T', classId: c.id }], unlockAll: true });
  const h = g.heroes[0];
  for (const t of TALENT_LIST) {
    if (t.cls && t.cls !== c.id) continue;
    h.talents[t.id] = { picks: [4], v: Object.fromEntries(Object.keys(t.vals).map((k) => [k, t.vals[k][4]])), st: {} };
    h.talentOrder.push(t.id);
  }
  for (const id of Object.keys(BUFFS)) h.buffs.push({ id, t: 5, dur: 5, v: { stacks: 1 }, stacks: 1 });
  try {
    g.recomputeHero(h);
    for (const ab of c.abilities) for (const [k, v] of Object.entries(h.P[ab])) if (!Number.isFinite(v)) fail(`${c.id} ${ab}.${k} = ${v}`);
  } catch (err) { fail(`recompute ${c.id}: ${err.stack}`); }
}
ok('recompute with all talents & buffs');

// ---- protocol round trip ----
{
  const g = new Game({ seed: 3, players: [{ pid: 0, name: 'A', classId: 'mage' }, { pid: 1, name: 'B', classId: 'warrior' }], unlockAll: true });
  g.startWave();
  for (let i = 0; i < 200; i++) g.step();
  const st = buildState(g);
  const dmg = [1, 123.5, 9, 0];
  const buf = encodeSnapshot(255, g.tick, g.time, st, dmg, [{ e: 'fx', t: 'boom', x: 1, z: 2 }]);
  const snap = decodeSnapshot(buf);
  if (snap.units.length !== st.units.length) fail('snapshot unit count mismatch');
  if (snap.tick !== g.tick) fail('snapshot tick mismatch');
  const u0 = st.units[0], d0 = snap.units[0];
  if (Math.abs(u0[2] - d0.x) > 0.02 || Math.abs(u0[3] - d0.z) > 0.02) fail('snapshot position mismatch');
  if (Math.abs(snap.dmg[0].amount - 123.5) > 0.01) fail('dmg mismatch');
  const ib = encodeInput({ x: 1.5, z: -2.25, ax: 3, az: 4, tx: NaN, tz: NaN, held: 5, pressed: 2, fs: 7 });
  const inp = decodeInput(ib);
  if (inp.x !== 1.5 || inp.held !== 5 || inp.fs !== 7 || !Number.isNaN(inp.tx)) fail('input round trip');
  ok(`protocol round trip (${buf.byteLength} bytes for ${st.units.length} units, ${st.projs.length} projectiles)`);
}

// ---- P2P framing: frames of any size survive the split into data channel messages ----
{
  const sizes = [2, 100, 15998, 15999, 16000, 16001, 32000, 50000, 123457];
  const rx = new Reassembler();
  let okCount = 0;
  for (const n of sizes) {
    const src = new Uint8Array(n);
    for (let i = 0; i < n; i++) src[i] = (i * 31 + n) & 255;
    const parts = packFrame(src);
    if (parts.some((p) => p.byteLength > 16001)) fail(`p2p: message too large for ${n} bytes`);
    let out = null;
    parts.forEach((p, i) => {
      const r = rx.push(p);
      if (i < parts.length - 1 && r) fail(`p2p: early frame for ${n} bytes`);
      if (i === parts.length - 1) out = r;
    });
    const u = out && new Uint8Array(out);
    if (!u || u.length !== n || u.some((v, i) => v !== src[i])) fail(`p2p: frame of ${n} bytes corrupted`);
    else okCount++;
  }
  if (okCount === sizes.length) ok('P2P frame split & reassembly');
}

// ---- fuzz: malformed / random player actions must never break the host simulation ----
{
  const g = new Game({ seed: 11, players: [{ pid: 0, name: 'A', classId: 'warrior' }, { pid: 1, name: 'B', classId: 'mage' }], unlockAll: true });
  let seed = 1234567;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const junk = () => pick([0, 1, -1, 3, 23, 24, 999, 2.5, NaN, null, undefined, '2', 'weapon', 'ring1', 'toString', '__proto__', 'constructor', {}, [], true]);
  const ref = () => pick([{ k: 'inv', i: junk() }, { k: 'eq', s: junk() }, { k: junk(), s: 'helm' }, junk()]);
  const types = ['ready', 'equip', 'unequip', 'move', 'drop', 'sell', 'buy', 'reroll', 'tome', 'potion', 'talent', 'talentReroll', 'pick', 'sort', 'nope', 42];
  // give the heroes things to shuffle around
  for (const h of g.heroes) { h.gold = 1e6; for (let i = 0; i < 6; i++) h.inv[i] = generateItem(g.itemCtx({ ilvl: 10, rarity: pick(['common', 'magic', 'rare', 'legendary']) })); }
  try {
    for (let i = 0; i < 6000; i++) {
      const pid = pick([0, 1, 7]);
      g.handleAction(pid, { t: pick(types), i: junk(), s: junk(), id: junk(), from: ref(), to: ref() });
      if (i % 7 === 0) {
        const h = g.heroes[pid === 1 ? 1 : 0];
        g.applyHeroInput(h, { x: pick([1, NaN, 1e9, -3]), z: pick([2, NaN, -1e9]), ax: pick([0, NaN, 5]), az: pick([NaN, 1]), tx: NaN, tz: 3, held: junk(), pressed: junk(), fs: h.forceSeq });
      }
      if (i % 3 === 0) g.step();
    }
    for (const h of g.heroes) {
      if (!Number.isFinite(h.x) || !Number.isFinite(h.z) || !Number.isFinite(h.rot)) fail(`fuzz: non-finite hero state ${h.x},${h.z},${h.rot}`);
      if (h.inv.length !== 24) fail(`fuzz: inventory size changed (${h.inv.length})`);
      for (const it of h.inv) if (it !== null && (typeof it !== 'object' || !it.slot)) fail('fuzz: corrupted inventory entry');
      for (const [s, it] of Object.entries(h.equip)) if (it !== null && it !== undefined && (typeof it !== 'object' || !it.slot)) fail(`fuzz: corrupted equip slot ${s}`);
      if (Object.getPrototypeOf(h.equip) !== Object.prototype) fail('fuzz: equip prototype changed');
    }
    ok('fuzzed player actions & inputs (6000 actions)');
  } catch (err) { fail(`fuzz: ${err.stack}`); }
}

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nAll tests passed.');
