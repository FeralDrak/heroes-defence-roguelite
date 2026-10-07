// Procedurally generated canvas textures.
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Arena floor: radial stone/sand pattern with cracks and stains */
export function floorTexture(pal, size = 2048) {
  const c = canvas(size, size);
  const g = c.getContext('2d');
  const r = rand(42);
  const cx = size / 2, cy = size / 2;
  g.fillStyle = pal.floor;
  g.fillRect(0, 0, size, size);
  // noise speckles
  for (let i = 0; i < 26000; i++) {
    const x = r() * size, y = r() * size;
    const a = r() * 0.12;
    g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 0.6})`;
    const s = 1 + r() * 3;
    g.fillRect(x, y, s, s);
  }
  // concentric tile rings
  const unit = size / 68; // world units -> px (floor radius 34)
  g.strokeStyle = 'rgba(0,0,0,0.22)';
  g.lineWidth = 3;
  for (let ring = 3; ring <= 34; ring += 3) {
    g.beginPath();
    g.arc(cx, cy, ring * unit, 0, Math.PI * 2);
    g.stroke();
    const seg = Math.max(8, Math.round(ring * 2.2));
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2 + ring;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * (ring - 3) * unit, cy + Math.sin(a) * (ring - 3) * unit);
      g.lineTo(cx + Math.cos(a) * ring * unit, cy + Math.sin(a) * ring * unit);
      g.stroke();
    }
  }
  // tile tint variation
  for (let ring = 3; ring <= 33; ring += 3) {
    const seg = Math.max(8, Math.round(ring * 2.2));
    for (let k = 0; k < seg; k++) {
      if (r() > 0.45) continue;
      const a0 = (k / seg) * Math.PI * 2 + ring, a1 = ((k + 1) / seg) * Math.PI * 2 + ring;
      g.beginPath();
      g.arc(cx, cy, ring * unit, a0, a1);
      g.arc(cx, cy, (ring - 3) * unit, a1, a0, true);
      g.closePath();
      g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.1)' : `${pal.floor2}55`;
      g.fill();
    }
  }
  // center emblem
  g.strokeStyle = `${pal.rune}40`;
  g.lineWidth = 6;
  g.beginPath(); g.arc(cx, cy, 5.5 * unit, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 5.5 * unit, cy + Math.sin(a) * 5.5 * unit);
    g.lineTo(cx + Math.cos(a + Math.PI * 2 / 3) * 5.5 * unit, cy + Math.sin(a + Math.PI * 2 / 3) * 5.5 * unit);
    g.stroke();
  }
  // cracks
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 2;
  for (let i = 0; i < 70; i++) {
    let x = r() * size, y = r() * size;
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 6; s++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; g.lineTo(x, y); }
    g.stroke();
  }
  // dark stains
  for (let i = 0; i < 40; i++) {
    const x = r() * size, y = r() * size, rad = 20 + r() * 90;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, `rgba(60,10,8,${0.12 + r() * 0.15})`);
    grd.addColorStop(1, 'rgba(60,10,8,0)');
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // edge darkening (vignette)
  const vg = g.createRadialGradient(cx, cy, size * 0.3, cx, cy, size * 0.5);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = vg;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function stoneTexture(base, size = 256, seed = 7) {
  const c = canvas(size, size);
  const g = c.getContext('2d');
  const r = rand(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${r() * 0.18})` : `rgba(255,255,255,${r() * 0.1})`;
    g.fillRect(r() * size, r() * size, 2, 2);
  }
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 2;
  const rows = 4;
  for (let y = 0; y <= rows; y++) {
    g.beginPath(); g.moveTo(0, (y * size) / rows); g.lineTo(size, (y * size) / rows); g.stroke();
    const off = y % 2 ? size / 4 : 0;
    for (let x = off; x < size; x += size / 2) {
      g.beginPath(); g.moveTo(x, (y * size) / rows); g.lineTo(x, ((y + 1) * size) / rows); g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Soft radial glow sprite */
export function glowTexture(size = 128) {
  const c = canvas(size, size);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.65)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.15)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

/** Vertical beam gradient (for loot beams / pillars) */
export function beamTexture() {
  const c = canvas(16, 128);
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 128, 0, 0);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 16, 128);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}
