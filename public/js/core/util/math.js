export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az; return dx * dx + dz * dz; };
export const dist = (ax, az, bx, bz) => Math.sqrt(dist2(ax, az, bx, bz));
export const len = (x, z) => Math.sqrt(x * x + z * z);

export function angleTo(ax, az, bx, bz) {
  return Math.atan2(bz - az, bx - ax);
}

/** smallest signed difference between two angles, in [-PI, PI] */
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function lerpAngle(a, b, t) {
  return a + angleDiff(a, b) * t;
}

export function normAngle(a) {
  a %= TAU;
  return a < 0 ? a + TAU : a;
}

/**
 * Closest distance² between point (px,pz) and segment (ax,az)-(bx,bz).
 */
export function segPointDist2(ax, az, bx, bz, px, pz) {
  const vx = bx - ax, vz = bz - az;
  const wx = px - ax, wz = pz - az;
  const l2 = vx * vx + vz * vz;
  let t = l2 > 0 ? (wx * vx + wz * vz) / l2 : 0;
  t = clamp(t, 0, 1);
  const cx = ax + vx * t - px, cz = az + vz * t - pz;
  return cx * cx + cz * cz;
}

/** Is point inside a cone (sector) starting at (ox,oz) facing angle, half-angle, radius */
export function inCone(ox, oz, facing, halfArc, radius, px, pz, pr = 0) {
  const dx = px - ox, dz = pz - oz;
  const d2 = dx * dx + dz * dz;
  const r = radius + pr;
  if (d2 > r * r) return false;
  if (d2 < 0.0001) return true;
  if (halfArc >= Math.PI) return true;
  const a = Math.atan2(dz, dx);
  const d = Math.abs(angleDiff(facing, a));
  // allow target radius to widen the cone a bit
  const extra = pr > 0 ? Math.atan2(pr, Math.sqrt(d2)) : 0;
  return d <= halfArc + extra;
}

/** Is point within an oriented rectangle (line) from origin along angle, length, half width */
export function inLine(ox, oz, angle, length, halfWidth, px, pz, pr = 0) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const dx = px - ox, dz = pz - oz;
  const along = dx * c + dz * s;
  const side = -dx * s + dz * c;
  return along >= -pr && along <= length + pr && Math.abs(side) <= halfWidth + pr;
}

export function fmtNum(n) {
  if (!isFinite(n)) return '∞';
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(a >= 1e10 ? 0 : 1) + 'G';
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'k';
  if (a >= 100) return Math.round(n).toString();
  if (a >= 10) return (Math.round(n * 10) / 10).toString();
  return (Math.round(n * 10) / 10).toString();
}
