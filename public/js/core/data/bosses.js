// Boss scripts. Each attack is a generator: `yield seconds` waits, telegraphs announce every hit.
import { TEAM_HEROES, TEAM_MONSTERS, ARENA_RADIUS } from '../constants.js';

const angleTo = (b, u) => Math.atan2(u.z - b.z, u.x - b.x);

function strike(g, b, area, mult, o = {}) {
  const hit = g.unitsInShape(TEAM_HEROES, area);
  for (const u of hit) {
    if (b.alive) g.monsterHit(b, u, mult, { type: o.type || b.def.dmgType || 'phys', melee: !!o.melee });
    else g.dealDamage(null, u, b.dmg * mult, { type: o.type || 'phys' });
    if (!u.alive) continue;
    if (o.status) g.applyStatus(u, o.status, o.statusOpts || {});
    if (o.push && u.kind === 'hero') {
      const a = Math.atan2(u.z - area.z, u.x - area.x);
      g.forceMove(u, 'push', { dx: +(Math.cos(a) * o.push).toFixed(2), dz: +(Math.sin(a) * o.push).toFixed(2), d: 0.25 });
    }
  }
  return hit;
}

function heroesAlive(g) { return g.heroes.filter((h) => h.alive && !h.downed); }

function summonAround(g, b, type, n, r0 = 2, r1 = 5, opts = {}) {
  for (let i = 0; i < n; i++) {
    if (g.monsters.length > 260) return;
    const [x, z] = g.randomPointNear(b.x, b.z, r0, r1);
    g.fx('summon', { x, z, c: 'enemy' });
    g.later(0.7, () => { if (!g.over) g.spawnMonster(type, x, z, Object.assign({ summoned: true, spawnT: 0.3 }, opts)); });
  }
}

function lobAt(g, b, x, z, r, delay, mult, o = {}) {
  g.fx('lob', { x1: +b.x.toFixed(2), z1: +b.z.toFixed(2), x2: +x.toFixed(2), z2: +z.toFixed(2), d: delay, k: o.k || 'e_rock' });
  g.telegraph({ shape: 'circle', x, z, r, delay, onResolve: (g2, a) => {
    strike(g, b, a, mult, o);
    g.fx('boom', { x, z, r, c: o.color || 'earth' });
    g.snd(o.snd || 'boom', x, z);
    if (o.after) o.after(a);
  } });
}

function spiral(g, b, arms, duration, interval, rot, vis, mult, speed = 9) {
  const steps = Math.floor(duration / interval);
  let base = g.rng.angle();
  for (let s = 0; s < steps; s++) {
    g.later(s * interval, () => {
      if (!b.alive) return;
      for (let k = 0; k < arms; k++) {
        const a = base + (k / arms) * Math.PI * 2;
        g.monsterShoot(b, a, { speed, range: 30, vis, dmg: b.dmg * mult, type: b.def.dmgType || 'shadow', radius: 0.45 });
      }
      base += rot;
    });
  }
}

function ringPulses(g, b, cx, cz, sets, delay0, gap, mult, color = 'earth') {
  sets.forEach((set, si) => {
    for (const [r2, r] of set) {
      g.telegraph({ shape: 'ring', x: cx, z: cz, r, r2, delay: delay0 + si * gap, vis: 'tele_ring',
        onResolve: (g2, a) => { strike(g, b, a, mult, { type: b.def.dmgType || 'phys' }); g.fx('ring', { x: cx, z: cz, r, r2, c: color }); } });
    }
  });
  g.later(delay0, () => g.fx('shake', { x: cx, z: cz, s: 0.6 }));
}

export const BOSSES = {
  // ===========================================================================
  boneking: {
    intro: 'Le Roi des Os se relève de son trône de cadavres !',
    phases: [0.5],
    onPhase(g, b, phase) {
      if (phase === 2) { g.msg('Le Roi des Os entre en fureur !', '#ff6b6b'); b.speed *= 1.2; b.idleMul = 0.7; }
    },
    attacks: [
      { id: 'cleave', w: 3, cd: 2.5, range: [0, 5.5], *run(g, b) {
        const t = b.target; if (!t) return;
        b.rot = angleTo(b, t); b.moveMode = 'stay'; b.setAnim(2);
        const area = g.telegraph({ shape: 'cone', x: b.x, z: b.z, a: b.rot, arc: 2.6, r: 4.6, delay: 0.85 });
        yield 0.85;
        strike(g, b, area, 1.6, { melee: true });
        g.fx('slash', { x: b.x, z: b.z, a: b.rot, r: 4.6, arc: 150, c: 'enemy', u: b.id });
        g.snd('bigswing', b.x, b.z);
        yield 0.5;
      } },
      { id: 'spears', w: 2, cd: 7, range: [0, 24], *run(g, b) {
        b.moveMode = 'stay'; b.setAnim(3);
        const targets = heroesAlive(g);
        const angles = [];
        for (const h of targets) {
          const a = angleTo(b, h);
          angles.push(a);
          if (b.phase >= 2) angles.push(a - 0.45, a + 0.45);
        }
        for (const a of angles) {
          g.telegraph({ shape: 'line', x: b.x, z: b.z, a, len: 20, w: 2, delay: 1.0, vis: 'tele',
            onResolve: (g2, area) => { strike(g, b, area, 2.0); g.fx('spikes', { x: area.x, z: area.z, a: area.a, len: area.len, c: 'bone' }); } });
        }
        g.snd('bonecall', b.x, b.z);
        yield 1.4;
      } },
      { id: 'raise', w: 1.5, cd: 14, *run(g, b) {
        b.moveMode = 'stay'; b.setAnim(3);
        g.snd('raise', b.x, b.z);
        summonAround(g, b, 'skeleton', 4 + b.phase * 2, 2, 6);
        if (b.phase >= 2) summonAround(g, b, 'skelarcher', 2, 3, 7);
        yield 1.2;
      } },
      { id: 'storm', w: 1.6, cd: 11, phase: 2, *run(g, b) {
        b.moveMode = 'stay'; b.setAnim(7);
        g.telegraph({ shape: 'circle', x: b.x, z: b.z, r: 4.5, delay: 1.0, follow: b });
        yield 1.0;
        b.moveMode = 'chase';
        b.speedMul = 1.35;
        for (let i = 0; i < 5; i++) {
          strike(g, b, { shape: 'circle', x: b.x, z: b.z, r: 4.5 }, 0.6, { melee: true });
          g.fx('nova', { x: b.x, z: b.z, r: 4.5, c: 'bone' });
          g.snd('whirl', b.x, b.z);
          yield 0.5;
        }
        b.speedMul = 1;
      } },
      { id: 'ring', w: 1.4, cd: 9, phase: 2, *run(g, b) {
        b.moveMode = 'stay'; b.setAnim(3);
        yield 0.5;
        for (let wave = 0; wave < 2; wave++) {
          const off = wave * Math.PI / 16;
          for (let i = 0; i < 16; i++) g.monsterShoot(b, off + (i / 16) * Math.PI * 2, { speed: 10, range: 30, vis: 'e_bone', dmg: b.dmg * 0.8, radius: 0.4 });
          g.snd('bonecall', b.x, b.z);
          yield 0.7;
        }
      } },
    ],
  },

  // ===========================================================================
  broodmother: {
    intro: 'La Matriarche Arachnide surgit des ténèbres !',
    phases: [0.5],
    onPhase(g, b, phase) {
      if (phase === 2) { g.msg('La Matriarche protège sa couvée !', '#7dff6a'); b.speed *= 1.25; b.idleMul = 0.7; summonAround(g, b, 'spider', 4, 2, 6, { elite: false }); }
    },
    attacks: [
      { id: 'bite', w: 3, cd: 2.2, range: [0, 5], *run(g, b) {
        const t = b.target; if (!t) return;
        b.rot = angleTo(b, t); b.moveMode = 'stay'; b.setAnim(2);
        const area = g.telegraph({ shape: 'cone', x: b.x, z: b.z, a: b.rot, arc: 1.9, r: 4.4, delay: 0.6 });
        yield 0.6;
        strike(g, b, area, 1.5, { melee: true, status: 'poison', statusOpts: { dps: b.dmg * 0.2, dur: 4 } });
        g.snd('bite', b.x, b.z);
        yield 0.4;
      } },
      { id: 'acid', w: 2.5, cd: 6, *run(g, b) {
        b.moveMode = 'stay'; b.setAnim(3);
        const n = 3 + (b.phase >= 2 ? 2 : 0);
        const hs = heroesAlive(g);
        for (let i = 0; i < n; i++) {
          const h = hs[i % Math.max(1, hs.length)];
          if (!h) break;
          const [x, z] = g.randomPointNear(h.x, h.z, 0, i < hs.length ? 0.5 : 4);
          lobAt(g, b, x, z, 2.3, 1.1, 1.0, { k: 'e_poison', color: 'poison', snd: 'splash', after: (a) => {
            g.spawnArea({ owner: null, team: TEAM_MONSTERS, shape: 'circle', x: a.x, z: a.z, r: 2.4 + (b.phase >= 2 ? 0.6 : 0), dur: 5, tick: 0.5, vis: 'acid',
              onTick: (g2, pa) => { for (const u of g.unitsInShape(TEAM_HEROES, pa)) g.dealDamage(null, u, b.dmg * 0.22, { type: 'poison', dot: true }); } });
          } });
        }
        g.snd('spit', b.x, b.z);
        yield 1.0;
      } },
      { id: 'brood', w: 1.5, cd: 13, *run(g, b) {
        b.moveMode = 'stay'; b.setAnim(3);
        summonAround(g, b, 'spiderling', 6 + (b.phase >= 2 ? 4 : 0), 1.5, 4);
        g.snd('screech', b.x, b.z);
        yield 1.0;
      } },
      { id: 'pounce', w: 2, cd: 8, range: [5, 20], *run(g, b) {
        const t = b.target; if (!t) return;
        b.moveMode = 'stay'; b.setAnim(7);
        const [x, z] = g.clampToArena(t.x, t.z, b.radius);
        b.rot = Math.atan2(z - b.z, x - b.x);
        g.telegraph({ shape: 'circle', x, z, r: 3.8, delay: 1.1 });
        yield 0.75;
        g.fx('leap', { u: b.id, x1: b.x, z1: b.z, x2: x, z2: z, d: 0.35 });
        const x0 = b.x, z0 = b.z;
        for (let i = 1; i <= 7; i++) { b.x = x0 + (x - x0) * i / 7; b.z = z0 + (z - z0) * i / 7; yield 0.05; }
        strike(g, b, { shape: 'circle', x, z, r: 3.8 }, 2.0, { push: 4 });
        g.fx('boom', { x, z, r: 3.8, c: 'earth' });
        g.fx('shake', { x, z, s: 0.5 });
        g.snd('slam', x, z);
        yield 0.8;
      } },
      { id: 'web', w: 1.5, cd: 10, *run(g, b) {
        const t = b.target; if (!t) return;
        b.moveMode = 'stay'; b.setAnim(3);
        yield 0.5;
        const a0 = angleTo(b, t);
        for (let i = -2; i <= 2; i++) {
          g.monsterShoot(b, a0 + i * 0.22, { speed: 13, range: 22, vis: 'e_web', dmg: b.dmg * 0.4, type: 'phys', radius: 0.6, status: ['root', { dur: 1.3 }] });
        }
        g.snd('spit', b.x, b.z);
        yield 0.6;
      } },
    ],
  },

  // ===========================================================================
  colossus: {
    intro: 'Le sol tremble... Le Colosse de Pierre s\'éveille !',
    phases: [0.4],
    onPhase(g, b, phase) {
      if (phase === 2) {
        g.msg('Le Colosse se fissure et appelle ses rejetons !', '#ffb36b');
        b.idleMul = 0.6;
        summonAround(g, b, 'brute', 2, 4, 8);
      }
    },
    attacks: [
      { id: 'slam', w: 3, cd: 3, range: [0, 8], *run(g, b) {
        const t = b.target; if (!t) return;
        b.rot = angleTo(b, t); b.moveMode = 'stay'; b.setAnim(2);
        const cx = b.x + Math.cos(b.rot) * 3.2, cz = b.z + Math.sin(b.rot) * 3.2;
        const area = g.telegraph({ shape: 'circle', x: cx, z: cz, r: 5, delay: 1.2 });
        yield 1.2;
        strike(g, b, area, 2.2, { status: 'stun', statusOpts: { dur: 1 } });
        g.fx('boom', { x: cx, z: cz, r: 5, c: 'earth' });
        g.fx('shake', { x: cx, z: cz, s: 0.8 });
        g.snd('slam', cx, cz);
        yield 0.7;
      } },
      { id: 'quake', w: 2, cd: 11, *run(g, b) {
        b.moveMode = 'stay'; b.setAnim(7);
        ringPulses(g, b, b.x, b.z, [[[2, 6], [10, 14], [18, 22], [26, 30]], [[6, 10], [14, 18], [22, 26]]], 1.5, 1.2, 1.6);
        g.snd('quake', b.x, b.z);
        yield 3.0;
      } },
      { id: 'charge', w: 2, cd: 9, range: [6, 28], *run(g, b) {
        const t = b.target; if (!t) return;
        b.moveMode = 'stay'; b.setAnim(7);
        b.rot = angleTo(b, t);
        const len = Math.min(Math.hypot(t.x - b.x, t.z - b.z) + 4, 26);
        g.telegraph({ shape: 'line', x: b.x, z: b.z, a: b.rot, len, w: 4, delay: 1.2 });
        g.snd('roar', b.x, b.z);
        yield 1.2;
        const hit = new Set();
        const steps = Math.ceil(len / 1.2);
        const vx = Math.cos(b.rot), vz = Math.sin(b.rot);
        for (let i = 0; i < steps; i++) {
          const nx = b.x + vx * 1.2, nz = b.z + vz * 1.2;
          if (g.blockedByObstacle(nx, nz, b.radius) || Math.hypot(nx, nz) > ARENA_RADIUS - b.radius) { g.fx('shake', { x: b.x, z: b.z, s: 0.5 }); break; }
          b.x = nx; b.z = nz;
          for (const u of g.unitsInRadius(TEAM_HEROES, b.x, b.z, b.radius + 1)) {
            if (hit.has(u.id)) continue;
            hit.add(u.id);
            g.monsterHit(b, u, 2.0, { melee: true });
            if (u.kind === 'hero') g.forceMove(u, 'push', { dx: +(vx * 5).toFixed(2), dz: +(vz * 5).toFixed(2), d: 0.3 });
          }
          yield 1 / 15;
        }
        yield 0.8;
      } },
      { id: 'boulders', w: 2, cd: 8, *run(g, b) {
        b.moveMode = 'stay'; b.setAnim(3);
        const per = b.phase >= 2 ? 2 : 1;
        for (const h of heroesAlive(g)) {
          for (let i = 0; i < per; i++) {
            const [x, z] = i === 0 ? [h.x, h.z] : g.randomPointNear(h.x, h.z, 2, 4);
            lobAt(g, b, x, z, 2.7, 1.4 + i * 0.3, 1.8, { k: 'e_rock' });
          }
        }
        yield 1.2;
      } },
    ],
  },

  // ===========================================================================
  lich: {
    intro: 'Un froid mortel envahit l\'arène... La Liche Éternelle est là.',
    phases: [0.5, 0.2],
    keep: [8, 14],
    onPhase(g, b, phase) {
      if (phase === 2) {
        g.msg('La Liche se protège : détruisez les phylactères !', '#7fd8ff');
        b.phylacteries = [];
        for (let i = 0; i < 3; i++) {
          const a = g.rng.angle();
          const [x, z] = g.clampToArena(Math.cos(a + i * 2.1) * 16, Math.sin(a + i * 2.1) * 16, 1.2);
          b.phylacteries.push(g.spawnMonster('phylactery', x, z, { hpMul: 1, spawnT: 0.5 }));
        }
      }
      if (phase === 3) { g.msg('La Liche déchaîne sa puissance !', '#7fd8ff'); b.idleMul = 0.55; }
    },
    onUpdate(g, b) {
      if (b.phylacteries) {
        const alive = b.phylacteries.some((p) => p.alive);
        b.dmgTakenMul = alive ? 0.1 : 1;
        if (!alive) b.phylacteries = null;
      }
    },
    attacks: [
      { id: 'nova', w: 2, cd: 9, range: [0, 8], *run(g, b) {
        b.moveMode = 'stay'; b.setAnim(3);
        const area = g.telegraph({ shape: 'circle', x: b.x, z: b.z, r: 6.5, delay: 1.1 });
        yield 1.1;
        strike(g, b, area, 1.8, { type: 'cold', status: 'freeze', statusOpts: { dur: 1.2 } });
        g.fx('nova', { x: b.x, z: b.z, r: 6.5, c: 'cold' });
        g.snd('freeze', b.x, b.z);
        yield 0.6;
      } },
      { id: 'spiral', w: 2, cd: 12, *run(g, b) {
        b.moveMode = 'stay'; b.setAnim(4);
        spiral(g, b, b.phase >= 3 ? 5 : 4, 3, b.phase >= 3 ? 0.1 : 0.13, 0.22, 'e_frost', 0.55);
        g.snd('chant', b.x, b.z);
        yield 3.2;
      } },
      { id: 'lances', w: 2, cd: 7, *run(g, b) {
        b.moveMode = 'stay'; b.setAnim(3);
        for (const h of heroesAlive(g)) {
          const a = angleTo(b, h);
          for (const off of b.phase >= 2 ? [-0.3, 0, 0.3] : [0]) {
            g.telegraph({ shape: 'line', x: b.x, z: b.z, a: a + off, len: 24, w: 2.2, delay: 1.0,
              onResolve: (g2, area) => { strike(g, b, area, 2.2, { type: 'cold', status: 'chill', statusOpts: { v: 0.4, dur: 2 } }); g.fx('spikes', { x: area.x, z: area.z, a: area.a, len: area.len, c: 'cold' }); } });
          }
        }
        yield 1.3;
      } },
      { id: 'army', w: 1, cd: 18, *run(g, b) {
        b.moveMode = 'stay'; b.setAnim(3);
        summonAround(g, b, 'wraith', 3, 3, 7);
        summonAround(g, b, 'skeleton', 4, 2, 6);
        g.snd('raise', b.x, b.z);
        yield 1;
      } },
      { id: 'blink', w: 1, cd: 7, *run(g, b) {
        const h = g.randomHero(); if (!h) return;
        const [x, z] = g.randomPointNear(h.x, h.z, 10, 15);
        g.fx('blink', { x1: b.x, z1: b.z, x2: x, z2: z, c: 'cold' });
        b.x = x; b.z = z;
        g.snd('blink', x, z);
        yield 0.4;
      } },
    ],
  },

  // ===========================================================================
  infernal_lord: {
    intro: 'Les flammes rugissent... Le Seigneur Infernal entre dans l\'arène !',
    phases: [0.5],
    onPhase(g, b, phase) {
      if (phase === 2) {
        g.msg("L'arène s'embrase ! Restez au centre !", '#ff7a2a');
        b.idleMul = 0.7;
        b.fireRing = g.spawnArea({ owner: null, team: TEAM_MONSTERS, shape: 'ring', x: 0, z: 0, r: 31, r2: 23, dur: 9999, tick: 0.5, vis: 'firering',
          onTick: (g2, a) => { for (const u of g.unitsInShape(TEAM_HEROES, a)) g.dealDamage(null, u, b.dmg * 0.35, { type: 'fire', dot: true }); } });
      }
    },
    onDeath(g, b) { if (b.fireRing) g.removeArea(b.fireRing); },
    attacks: [
      { id: 'cleave', w: 3, cd: 2.6, range: [0, 6], *run(g, b) {
        const t = b.target; if (!t) return;
        b.rot = angleTo(b, t); b.moveMode = 'stay'; b.setAnim(2);
        const area = g.telegraph({ shape: 'cone', x: b.x, z: b.z, a: b.rot, arc: 2.45, r: 5, delay: 0.8 });
        yield 0.8;
        strike(g, b, area, 1.6, { melee: true, type: 'fire', status: 'burn', statusOpts: { dps: b.dmg * 0.2, dur: 3 } });
        g.fx('slash', { x: b.x, z: b.z, a: b.rot, r: 5, arc: 140, c: 'fire', u: b.id });
        g.snd('bigswing', b.x, b.z);
        yield 0.5;
      } },
      { id: 'rain', w: 2, cd: 9, *run(g, b) {
        b.moveMode = 'stay'; b.setAnim(3);
        const n = 10 + 4 * b.phase;
        const hs = heroesAlive(g);
        for (let i = 0; i < n; i++) {
          const h = hs[i % Math.max(1, hs.length)];
          const [x, z] = h ? g.randomPointNear(h.x, h.z, 0, 6) : g.randomPointNear(0, 0, 0, 20);
          const d = 1.2 + (i / n) * 1.2;
          g.fx('meteor', { x, z, r: 2.4, d, c: 'fire' });
          g.telegraph({ shape: 'circle', x, z, r: 2.4, delay: d, onResolve: (g2, a) => {
            strike(g, b, a, 1.4, { type: 'fire' });
            g.fx('boom', { x, z, r: 2.4, c: 'fire' });
            g.spawnArea({ owner: null, team: TEAM_MONSTERS, shape: 'circle', x, z, r: 2, dur: 3, tick: 0.5, vis: 'fireground_e',
              onTick: (g3, pa) => { for (const u of g.unitsInShape(TEAM_HEROES, pa)) g.dealDamage(null, u, b.dmg * 0.18, { type: 'fire', dot: true }); } });
          } });
        }
        g.snd('meteorcall', b.x, b.z);
        yield 1.4;
      } },
      { id: 'breath', w: 2, cd: 8, range: [0, 13], *run(g, b) {
        const t = b.target; if (!t) return;
        b.moveMode = 'stay'; b.setAnim(4);
        const sweeps = b.phase >= 2 ? 3 : 1;
        let a = angleTo(b, t) - (sweeps > 1 ? 0.7 : 0);
        for (let s = 0; s < sweeps; s++) {
          b.rot = a;
          const area = g.telegraph({ shape: 'cone', x: b.x, z: b.z, a, arc: 1.05, r: 12, delay: 0.9 });
          yield 0.9;
          strike(g, b, area, 2.6, { type: 'fire', status: 'burn', statusOpts: { dps: b.dmg * 0.25, dur: 3 } });
          g.fx('breath', { x: b.x, z: b.z, a, r: 12, arc: 60, c: 'fire' });
          g.snd('breath', b.x, b.z);
          a += 0.7;
        }
        yield 0.5;
      } },
      { id: 'meteor', w: 1.5, cd: 12, *run(g, b) {
        const t = b.target; if (!t) return;
        b.moveMode = 'stay'; b.setAnim(3);
        const x = t.x, z = t.z;
        g.fx('meteor', { x, z, r: 7, d: 2, c: 'fire' });
        g.telegraph({ shape: 'circle', x, z, r: 7, delay: 2.0, onResolve: (g2, a) => {
          strike(g, b, a, 4.5, { type: 'fire', push: 5 });
          g.fx('boom', { x, z, r: 7, c: 'fire' });
          g.fx('shake', { x, z, s: 1 });
          g.snd('meteor', x, z);
        } });
        g.snd('meteorcall', b.x, b.z);
        yield 0.8;
      } },
      { id: 'demons', w: 1, cd: 18, *run(g, b) {
        b.moveMode = 'stay'; b.setAnim(3);
        summonAround(g, b, 'demon', 2, 3, 7);
        g.snd('roar', b.x, b.z);
        yield 1;
      } },
    ],
  },

  // ===========================================================================
  devourer: {
    intro: 'Le Dévoreur s\'extirpe du néant. Tout s\'achève ici.',
    phases: [0.66, 0.33],
    onPhase(g, b, phase) {
      if (phase === 2) { g.msg('Le Dévoreur ouvre ses mâchoires...', '#c58cff'); summonAround(g, b, 'knight', 2, 4, 8); }
      if (phase === 3) { g.msg('LE DÉVOREUR EST FOU DE RAGE !', '#ff3b3b'); b.idleMul = 0.5; b.speed *= 1.2; b.dmgDealtMul = 1.2; }
    },
    attacks: [
      { id: 'slam', w: 3, cd: 3, range: [0, 8], *run(g, b) {
        const t = b.target; if (!t) return;
        b.rot = angleTo(b, t); b.moveMode = 'stay'; b.setAnim(2);
        const cx = b.x + Math.cos(b.rot) * 3.4, cz = b.z + Math.sin(b.rot) * 3.4;
        const area = g.telegraph({ shape: 'circle', x: cx, z: cz, r: 5.5, delay: 1.1 });
        yield 1.1;
        strike(g, b, area, 2.4);
        g.fx('boom', { x: cx, z: cz, r: 5.5, c: 'shadow' });
        g.fx('shake', { x: cx, z: cz, s: 0.8 });
        g.snd('slam', cx, cz);
        yield 0.6;
      } },
      { id: 'beam', w: 2, cd: 12, *run(g, b) {
        const t = b.target; if (!t) return;
        b.moveMode = 'stay'; b.setAnim(4);
        const dir = g.rng.sign();
        const a0 = angleTo(b, t) - dir * 0.6;
        g.telegraph({ shape: 'line', x: b.x, z: b.z, a: a0, len: 30, w: 2.2, delay: 1.2 });
        g.snd('charge', b.x, b.z);
        yield 1.2;
        const speed = 1.1 * dir * (b.phase >= 3 ? 1.35 : 1);
        g.spawnArea({ owner: b, team: TEAM_MONSTERS, shape: 'line', x: b.x, z: b.z, a: a0, len: 30, w: 2.2, dur: 4, tick: 0.2, rotSpd: speed, vis: 'voidbeam',
          onTick: (g2, area) => strike(g, b, area, 0.45, { type: 'shadow' }) });
        yield 4.2;
      } },
      { id: 'pull', w: 1.5, cd: 14, phase: 2, *run(g, b) {
        b.moveMode = 'stay'; b.setAnim(7);
        g.msg('Le Dévoreur vous attire !', '#c58cff');
        for (const h of heroesAlive(g)) {
          const dx = b.x - h.x, dz = b.z - h.z, d = Math.hypot(dx, dz) || 1;
          const pull = Math.max(0, Math.min(d - b.radius - 2, 7));
          g.forceMove(h, 'push', { dx: +(dx / d * pull).toFixed(2), dz: +(dz / d * pull).toFixed(2), d: 1.4 });
        }
        const area = g.telegraph({ shape: 'circle', x: b.x, z: b.z, r: 7.5, delay: 2.4, follow: b });
        g.snd('vortex', b.x, b.z);
        yield 2.4;
        strike(g, b, area, 2.6, { type: 'shadow', push: 6 });
        g.fx('nova', { x: b.x, z: b.z, r: 7.5, c: 'shadow' });
        g.snd('boom', b.x, b.z);
        yield 0.6;
      } },
      { id: 'spiral', w: 1.5, cd: 12, *run(g, b) {
        b.moveMode = 'stay'; b.setAnim(4);
        spiral(g, b, b.phase >= 3 ? 7 : 6, 3, 0.14, 0.18, 'e_skull', 0.5, 8);
        g.snd('chant', b.x, b.z);
        yield 3.2;
      } },
      { id: 'adds', w: 1, cd: 20, *run(g, b) {
        b.moveMode = 'stay'; b.setAnim(3);
        summonAround(g, b, 'demon', 2 + b.phase, 3, 8);
        summonAround(g, b, 'wraith', 2, 3, 8);
        g.snd('roar', b.x, b.z);
        yield 1;
      } },
      { id: 'rings', w: 1.5, cd: 13, phase: 3, *run(g, b) {
        b.moveMode = 'stay'; b.setAnim(7);
        ringPulses(g, b, b.x, b.z, [[[2, 6], [10, 14], [18, 22], [26, 30]], [[6, 10], [14, 18], [22, 26]], [[2, 6], [10, 14], [18, 22]]], 1.4, 1.1, 1.7, 'shadow');
        g.snd('quake', b.x, b.z);
        yield 3.6;
      } },
    ],
  },
};
