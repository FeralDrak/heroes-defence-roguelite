// Shared gameplay helpers used by abilities, talents, aspects and uniques.
import { TEAM_HEROES } from '../constants.js';

/** Lightning that bounces between enemies */
export function chainLightning(g, h, P, x, z, first, coef, bounces, jump, o = {}) {
  const pts = [+x.toFixed(2), +z.toFixed(2)];
  const hit = new Set();
  let cur = first;
  let n = 0;
  const repeat = o.repeat || false;
  while (cur && n <= bounces) {
    pts.push(+cur.x.toFixed(2), +cur.z.toFixed(2));
    hit.add(cur.id);
    g.hit(h, cur, coef, { type: 'light', ability: o.ability || 'm_chain', proc: !!o.proc, mult: o.mult ?? 1 });
    if (cur.alive && P && P.shock) g.applyStatus(cur, 'shock', { v: (P.shock / 100) * h.S.shockMul, dur: 3 * h.S.shockDur, hero: h });
    n++;
    const prev = cur;
    cur = g.nearestEnemy(TEAM_HEROES, prev.x, prev.z, jump, (m) => m !== prev && (repeat || !hit.has(m.id)));
  }
  g.fx('chain', { pts, c: o.color || 'light' });
  g.snd('zap', x, z);
  return n;
}

/** Blades/orbs orbiting a hero; state kept in `st` */
export function orbitTick(g, h, dt, st, n, radius, coef, type, vis) {
  st.vt = (st.vt ?? 0) - dt;
  if (st.vt <= 0) {
    st.vt = 1;
    if (!st.key) st.key = 1 + Math.floor(Math.random() * 1e6);
    g.fx('orbit', { u: h.id, n, r: radius, v: vis, k: st.key });
  }
  st.a = ((st.a ?? 0) + dt * 3.2) % (Math.PI * 2);
  st.ht = (st.ht ?? 0) - dt;
  if (st.ht > 0) return;
  st.ht = 0.1;
  if (!st.hit) st.hit = new Map();
  for (let i = 0; i < n; i++) {
    const a = st.a + (i / n) * Math.PI * 2;
    const x = h.x + Math.cos(a) * radius, z = h.z + Math.sin(a) * radius;
    for (const m of g.enemiesInRadius(TEAM_HEROES, x, z, 0.8)) {
      const last = st.hit.get(m.id) || 0;
      if (g.time - last < 0.5) continue;
      st.hit.set(m.id, g.time);
      g.hit(h, m, coef, { type, proc: true });
    }
  }
  if (st.hit.size > 200) st.hit.clear();
}

/** Reduce active cooldowns of skills 1-4 (and notify clients) */
export function reduceCooldowns(g, h, seconds, slots = [1, 2, 3, 4]) {
  for (const s of slots) {
    if (h.cd[s] > g.time && h.cd[s] < g.time + 900) h.cd[s] = Math.max(g.time, h.cd[s] - seconds);
  }
  h.cdShift = (h.cdShift || 0) + seconds;
}
