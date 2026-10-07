// Uniform spatial hash grid for fast proximity queries (monsters).
export class SpatialGrid {
  constructor(half = 40, cell = 2.5) {
    this.half = half;
    this.cell = cell;
    this.n = Math.ceil((half * 2) / cell);
    this.cells = new Array(this.n * this.n);
    for (let i = 0; i < this.cells.length; i++) this.cells[i] = [];
    this.used = [];
  }

  clear() {
    for (const i of this.used) this.cells[i].length = 0;
    this.used.length = 0;
  }

  idx(x, z) {
    let cx = Math.floor((x + this.half) / this.cell);
    let cz = Math.floor((z + this.half) / this.cell);
    if (cx < 0) cx = 0; else if (cx >= this.n) cx = this.n - 1;
    if (cz < 0) cz = 0; else if (cz >= this.n) cz = this.n - 1;
    return cz * this.n + cx;
  }

  insert(u) {
    const i = this.idx(u.x, u.z);
    const c = this.cells[i];
    if (c.length === 0) this.used.push(i);
    c.push(u);
  }

  /** Calls fn(u) for units whose cell overlaps the circle (caller must check exact distance). */
  forEachNear(x, z, r, fn) {
    const n = this.n, cs = this.cell, h = this.half;
    let x0 = Math.floor((x - r + h) / cs), x1 = Math.floor((x + r + h) / cs);
    let z0 = Math.floor((z - r + h) / cs), z1 = Math.floor((z + r + h) / cs);
    if (x0 < 0) x0 = 0; if (z0 < 0) z0 = 0;
    if (x1 >= n) x1 = n - 1; if (z1 >= n) z1 = n - 1;
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const c = this.cells[cz * n + cx];
        for (let k = 0; k < c.length; k++) fn(c[k]);
      }
    }
  }

  /** Units within radius r (+ their own radius), appended to out */
  query(x, z, r, out = []) {
    this.forEachNear(x, z, r + 2.5, (u) => {
      if (!u.alive) return;
      const dx = u.x - x, dz = u.z - z, rr = r + u.radius;
      if (dx * dx + dz * dz <= rr * rr) out.push(u);
    });
    return out;
  }
}
