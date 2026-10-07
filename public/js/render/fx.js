// Particles and transient visual effects driven by game events.
import * as THREE from 'three';
import { glowTexture, beamTexture } from './textures.js';

export const FX_COLORS = {
  steel: 0xe8eef5, white: 0xffffff, war: 0xff6040, earth: 0xc8a070, nature: 0x8aff7a, fire: 0xff7a2a, cold: 0x8fd8ff,
  light: 0xfff27a, poison: 0x8ef06a, holy: 0xffe9a8, shadow: 0xb070ff, arcane: 0xff8cf0, blood: 0xd02030, fel: 0x7bd84a,
  teal: 0x38e9d0, curse: 0xb050ff, plague: 0x9cd040, enemy: 0xff4040, bone: 0xf0e8d0, phys: 0xf2f2f2, drain: 0xff3355,
  gold: 0xffd24a, frost: 0x8fd8ff,
};

export function fxColor(c) {
  if (typeof c === 'number') return c;
  return FX_COLORS[c] ?? 0xffffff;
}

const VERT = `
attribute float size;
attribute float alpha;
attribute vec3 pcolor;
varying vec3 vColor;
varying float vAlpha;
uniform float uScale;
void main() {
  vColor = pcolor;
  vAlpha = alpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform sampler2D uMap;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 t = texture2D(uMap, gl_PointCoord);
  gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
}`;

class ParticleSystem {
  constructor(scene, max, blending) {
    this.max = max;
    this.count = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.grow = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('pcolor', this.aCol);
    geo.setAttribute('size', this.aSize);
    geo.setAttribute('alpha', this.aAlpha);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: glowTexture() }, uScale: { value: 300 } },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.geo = geo;
    scene.add(this.points);
  }

  emit(x, y, z, vx, vy, vz, life, size, color, opts = {}) {
    if (this.count >= this.max) return;
    const i = this.count++;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    const c = typeof color === 'number' ? color : 0xffffff;
    this.col[i3] = ((c >> 16) & 255) / 255; this.col[i3 + 1] = ((c >> 8) & 255) / 255; this.col[i3 + 2] = (c & 255) / 255;
    this.life[i] = life; this.maxLife[i] = life;
    this.size[i] = size; this.size0[i] = size;
    this.grav[i] = opts.g ?? 0;
    this.drag[i] = opts.drag ?? 1.5;
    this.grow[i] = opts.grow ?? 0;
    this.alpha[i] = opts.a ?? 1;
  }

  update(dt) {
    let n = this.count;
    for (let i = 0; i < n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        n--;
        if (i !== n) this.copy(n, i);
        i--;
        continue;
      }
      const i3 = i * 3;
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= d; this.vel[i3 + 1] = this.vel[i3 + 1] * d - this.grav[i] * dt; this.vel[i3 + 2] *= d;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0.02) { this.pos[i3 + 1] = 0.02; this.vel[i3 + 1] *= -0.3; }
      const k = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, k * 2.2);
      this.size[i] = this.size0[i] * (1 + this.grow[i] * (1 - k));
    }
    this.count = n;
    this.geo.setDrawRange(0, n);
    this.aPos.needsUpdate = true;
    this.aCol.needsUpdate = true;
    this.aSize.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
  }

  copy(from, to) {
    const f3 = from * 3, t3 = to * 3;
    for (let k = 0; k < 3; k++) {
      this.pos[t3 + k] = this.pos[f3 + k];
      this.vel[t3 + k] = this.vel[f3 + k];
      this.col[t3 + k] = this.col[f3 + k];
    }
    this.size[to] = this.size[from]; this.size0[to] = this.size0[from]; this.alpha[to] = this.alpha[from];
    this.life[to] = this.life[from]; this.maxLife[to] = this.maxLife[from]; this.grav[to] = this.grav[from];
    this.drag[to] = this.drag[from]; this.grow[to] = this.grow[from];
  }

  dispose(scene) {
    scene.remove(this.points);
    this.geo.dispose();
    this.mat.dispose();
  }
}

// ---------------------------------------------------------------------------
export class FxSystem {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.density = quality >= 2 ? 1 : quality >= 1 ? 0.7 : 0.4;
    this.glow = new ParticleSystem(scene, quality >= 2 ? 7000 : 4000, THREE.AdditiveBlending);
    this.smoke = new ParticleSystem(scene, 1500, THREE.NormalBlending);
    this.items = [];
    this.shake = 0;
    this.beamTex = beamTexture();
    this.orbitPool = [];
    this.orbitGeo = { blade: new THREE.BoxGeometry(0.7, 0.06, 0.18), arcane: new THREE.IcosahedronGeometry(0.22, 1) };
  }

  setScale(s) { this.glow.mat.uniforms.uScale.value = s; this.smoke.mat.uniforms.uScale.value = s; }

  // -------------------------------------------------------------------------
  burst(x, y, z, n, color, o = {}) {
    n = Math.max(1, Math.round(n * this.density));
    const sp = o.speed ?? 4, life = o.life ?? 0.6, size = o.size ?? 0.6;
    const sys = o.smoke ? this.smoke : this.glow;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = o.up ?? 0.6;
      const s = sp * (0.4 + Math.random() * 0.6);
      sys.emit(x, y, z, Math.cos(a) * s, (Math.random() * up + (o.upBias ?? 0.2)) * s, Math.sin(a) * s,
        life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), color, { g: o.g ?? 4, drag: o.drag ?? 2.2, grow: o.grow ?? 0 });
    }
  }

  ringBurst(x, z, r, n, color, o = {}) {
    n = Math.max(1, Math.round(n * this.density));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
      const rr = r * (0.8 + Math.random() * 0.3);
      this.glow.emit(x + Math.cos(a) * rr * 0.2, (o.y ?? 0.4) + Math.random() * 0.4, z + Math.sin(a) * rr * 0.2, Math.cos(a) * rr * 2.2, Math.random() * 2, Math.sin(a) * rr * 2.2,
        o.life ?? 0.5, o.size ?? 0.7, color, { g: 2, drag: 3.5 });
    }
  }

  trail(x, y, z, color, size = 0.5, life = 0.35) {
    if (Math.random() > this.density) return;
    this.glow.emit(x + (Math.random() - 0.5) * 0.15, y + (Math.random() - 0.5) * 0.15, z + (Math.random() - 0.5) * 0.15, 0, 0.4, 0, life, size, color, { g: 0, drag: 1 });
  }

  add(item) { this.items.push(item); this.scene.add(item.obj); return item; }

  /** Flat arc / ring mesh on the ground plane */
  arcMesh(r0, r1, start, len, color, opacity = 0.8) {
    const geo = new THREE.RingGeometry(r0, r1, 32, 1, start, len);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
    return new THREE.Mesh(geo, mat);
  }

  // -------------------------------------------------------------------------
  // Event-driven effects
  // -------------------------------------------------------------------------
  slash(ev) {
    const color = fxColor(ev.c);
    const arc = ((ev.arc || 120) * Math.PI) / 180;
    const r = ev.r || 2.5;
    // RingGeometry arc [0, arc] maps to sim angles [-arc, 0]; rotation.y = θ shifts sim angles by -θ.
    const mesh = this.arcMesh(r * 0.35, r, 0, arc, color, 0.75);
    mesh.position.set(ev.x, 1.0, ev.z);
    mesh.rotation.y = -(ev.a + arc / 2);
    const life = 0.18;
    this.add({ obj: mesh, t: 0, life, update(dt, it) { it.t += dt; const k = it.t / life; mesh.material.opacity = 0.75 * (1 - k); mesh.scale.setScalar(0.85 + k * 0.25); return k < 1; } });
    for (let i = 0; i < 5; i++) {
      const a = ev.a + (Math.random() - 0.5) * arc;
      this.glow.emit(ev.x + Math.cos(a) * r * 0.8, 1, ev.z + Math.sin(a) * r * 0.8, Math.cos(a) * 3, 0.5, Math.sin(a) * 3, 0.25, 0.4, color, { drag: 4 });
    }
  }

  nova(ev) {
    const color = fxColor(ev.c);
    const mesh = this.arcMesh(0.85, 1, 0, Math.PI * 2, color, ev.soft ? 0.3 : 0.8);
    mesh.position.set(ev.x, 0.15, ev.z);
    const r = ev.r || 4;
    const life = ev.soft ? 0.5 : 0.4;
    this.add({ obj: mesh, t: 0, update(dt, it) { it.t += dt; const k = it.t / life; mesh.scale.setScalar(0.2 + r * k); mesh.material.opacity = (ev.soft ? 0.3 : 0.8) * (1 - k); return k < 1; } });
    if (!ev.soft) this.ringBurst(ev.x, ev.z, r, 24, color);
  }

  boom(ev) {
    const color = fxColor(ev.c);
    const r = ev.r || 2;
    const geo = new THREE.IcosahedronGeometry(1, 2);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(ev.x, 0.5, ev.z);
    const life = 0.32;
    this.add({ obj: mesh, t: 0, update(dt, it) { it.t += dt; const k = it.t / life; mesh.scale.set(r * (0.3 + k * 0.8), r * (0.2 + k * 0.5), r * (0.3 + k * 0.8)); mat.opacity = 0.6 * (1 - k); return k < 1; }, dispose() { geo.dispose(); } });
    const ring = this.arcMesh(0.9, 1, 0, Math.PI * 2, color, 0.7);
    ring.position.set(ev.x, 0.1, ev.z);
    this.add({ obj: ring, t: 0, update(dt, it) { it.t += dt; const k = it.t / 0.35; ring.scale.setScalar(r * (0.4 + k * 0.7)); ring.material.opacity = 0.7 * (1 - k); return k < 1; } });
    this.burst(ev.x, 0.6, ev.z, 10 + r * 6, color, { speed: 3 + r * 2, life: 0.55, size: 0.7, up: 1.2 });
    if (ev.c === 'fire' || ev.c === 'fel') this.burst(ev.x, 0.6, ev.z, 6 + r * 2, 0x2a2420, { smoke: true, speed: 1.5, life: 1.2, size: 1.6, g: -1.5, grow: 1.5 });
  }

  chain(ev) {
    const color = fxColor(ev.c);
    const pts = [];
    const p = ev.pts;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const x0 = p[i], z0 = p[i + 1], x1 = p[i + 2], z1 = p[i + 3];
      const segs = 6;
      for (let s = 0; s < segs; s++) {
        const k = s / segs;
        const j = s === 0 ? 0 : 0.45;
        pts.push(new THREE.Vector3(x0 + (x1 - x0) * k + (Math.random() - 0.5) * j, 1.2 + (Math.random() - 0.5) * j, z0 + (z1 - z0) * k + (Math.random() - 0.5) * j));
      }
      pts.push(new THREE.Vector3(x1, 1.2, z1));
      this.burst(x1, 1.1, z1, 4, color, { speed: 3, life: 0.3, size: 0.5 });
    }
    if (pts.length < 2) return;
    this.lightning(pts, color, 0.28);
  }

  lightning(pts, color, life) {
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const line = new THREE.Line(geo, mat);
    this.add({ obj: line, t: 0, update(dt, it) { it.t += dt; const k = it.t / life; mat.opacity = (1 - k) * (0.6 + Math.random() * 0.4); return k < 1; }, dispose() { geo.dispose(); } });
  }

  zap(ev) {
    const color = fxColor(ev.c);
    const h = ev.h || 1.2;
    const pts = [];
    const segs = 7;
    for (let s = 0; s <= segs; s++) {
      const k = s / segs;
      const j = s === 0 || s === segs ? 0 : 0.35;
      pts.push(new THREE.Vector3(ev.x1 + (ev.x2 - ev.x1) * k + (Math.random() - 0.5) * j, h + (1.0 - h) * k + (Math.random() - 0.5) * j, ev.z1 + (ev.z2 - ev.z1) * k + (Math.random() - 0.5) * j));
    }
    this.lightning(pts, color, 0.18);
    this.burst(ev.x2, 1, ev.z2, 3, color, { speed: 2, life: 0.25, size: 0.4 });
  }

  pillar(ev) {
    const color = fxColor(ev.c);
    const geo = new THREE.CylinderGeometry(ev.r || 3, ev.r || 3, 22, 24, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color, map: this.beamTex, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(ev.x, 11, ev.z);
    this.add({ obj: mesh, t: 0, update(dt, it) { it.t += dt; const k = it.t / 0.8; mat.opacity = 0.8 * (1 - k); mesh.scale.set(1 - k * 0.6, 1, 1 - k * 0.6); return k < 1; }, dispose() { geo.dispose(); } });
    this.ringBurst(ev.x, ev.z, ev.r || 3, 30, color, { life: 0.8 });
  }

  meteor(ev) {
    const color = fxColor(ev.c || 'fire');
    const d = ev.d || 1;
    const geo = new THREE.IcosahedronGeometry(Math.max(0.5, (ev.r || 3) * 0.22), 1);
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    const sx = ev.x - 10, sy = 26, sz = ev.z - 6;
    mesh.position.set(sx, sy, sz);
    const self = this;
    this.add({ obj: mesh, t: 0, update(dt, it) {
      it.t += dt;
      const k = Math.min(1, it.t / d);
      mesh.position.set(sx + (ev.x - sx) * k, sy + (0.5 - sy) * k, sz + (ev.z - sz) * k);
      self.trail(mesh.position.x, mesh.position.y, mesh.position.z, color, 1.4, 0.5);
      if (Math.random() < 0.5) self.smoke.emit(mesh.position.x, mesh.position.y, mesh.position.z, 0, 0.5, 0, 0.9, 1.5, 0x221a14, { g: 0, grow: 1 });
      return k < 1;
    }, dispose() { geo.dispose(); } });
  }

  lob(ev) {
    const d = ev.d || 1;
    const colors = { e_rock: 0x7a6a5a, e_poison: 0x8ef06a, e_shell: 0x553322 };
    const color = colors[ev.k] ?? 0x888888;
    const geo = new THREE.IcosahedronGeometry(ev.k === 'e_rock' ? 0.55 : 0.35, 0);
    const mat = new THREE.MeshLambertMaterial({ color, flatShading: true, emissive: ev.k === 'e_poison' ? 0x2a6a1a : 0 });
    const mesh = new THREE.Mesh(geo, mat);
    const self = this;
    this.add({ obj: mesh, t: 0, update(dt, it) {
      it.t += dt;
      const k = Math.min(1, it.t / d);
      mesh.position.set(ev.x1 + (ev.x2 - ev.x1) * k, 1 + Math.sin(k * Math.PI) * 7, ev.z1 + (ev.z2 - ev.z1) * k);
      mesh.rotation.x += dt * 5; mesh.rotation.z += dt * 3;
      if (ev.k === 'e_poison') self.trail(mesh.position.x, mesh.position.y, mesh.position.z, 0x8ef06a, 0.6, 0.3);
      return k < 1;
    }, dispose() { geo.dispose(); mat.dispose(); } });
  }

  spikes(ev) {
    const color = fxColor(ev.c || 'bone');
    const n = Math.round((ev.len || 10) / 1.2);
    const mat = new THREE.MeshLambertMaterial({ color, flatShading: true, emissive: ev.c === 'cold' ? 0x2a5a8a : 0 });
    const geo = new THREE.ConeGeometry(0.35, 1.8, 5);
    const group = new THREE.Group();
    const spikes = [];
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      const m = new THREE.Mesh(geo, mat);
      m.position.set(ev.x + Math.cos(ev.a) * ev.len * k + (Math.random() - 0.5) * 0.6, -1, ev.z + Math.sin(ev.a) * ev.len * k + (Math.random() - 0.5) * 0.6);
      m.rotation.set((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4);
      group.add(m);
      spikes.push({ m, delay: k * 0.15 });
    }
    this.add({ obj: group, t: 0, update(dt, it) {
      it.t += dt;
      for (const s of spikes) {
        const k = Math.max(0, it.t - s.delay);
        s.m.position.y = k < 0.12 ? -1 + (k / 0.12) * 1.6 : k < 0.6 ? 0.6 : 0.6 - (k - 0.6) * 4;
      }
      return it.t < 0.9;
    }, dispose() { geo.dispose(); mat.dispose(); } });
  }

  breath(ev) {
    const color = fxColor(ev.c || 'fire');
    const arc = ((ev.arc || 60) * Math.PI) / 180;
    for (let i = 0; i < 60 * this.density; i++) {
      const a = ev.a + (Math.random() - 0.5) * arc;
      const s = 8 + Math.random() * 10;
      this.glow.emit(ev.x + Math.cos(ev.a) * 1.5, 1.5, ev.z + Math.sin(ev.a) * 1.5, Math.cos(a) * s, Math.random() * 1.5, Math.sin(a) * s, 0.7, 1.2, color, { g: -1, drag: 1.2, grow: 1 });
    }
  }

  ring(ev) {
    const color = fxColor(ev.c);
    const mesh = this.arcMesh(ev.r2, ev.r, 0, Math.PI * 2, color, 0.7);
    mesh.position.set(ev.x, 0.12, ev.z);
    this.add({ obj: mesh, t: 0, update(dt, it) { it.t += dt; mesh.material.opacity = 0.7 * (1 - it.t / 0.4); return it.t < 0.4; } });
    for (let i = 0; i < 30 * this.density; i++) {
      const a = Math.random() * Math.PI * 2, rr = ev.r2 + Math.random() * (ev.r - ev.r2);
      this.smoke.emit(ev.x + Math.cos(a) * rr, 0.3, ev.z + Math.sin(a) * rr, 0, 2 + Math.random() * 2, 0, 0.6, 1.0, 0x6a5a4a, { g: 6, grow: 0.5 });
    }
  }

  beam(ev, world, views) {
    const color = fxColor(ev.c);
    const geo = new THREE.CylinderGeometry(0.12, 0.12, 1, 6, 1, true);
    geo.translate(0, 0.5, 0);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    const self = this;
    const life = ev.d || 0.3;
    this.add({ obj: mesh, t: 0, update(dt, it) {
      it.t += dt;
      const a = world.units.get(ev.a), b = world.units.get(ev.b);
      if (!a || !b) return false;
      const ah = views.headPos(ev.a);
      const ax = ah ? ah.x : a.x, az = ah ? ah.z : a.z;
      mesh.position.set(ax, 1.3, az);
      mesh.lookAt(b.x, 1.0, b.z);
      const len = Math.hypot(b.x - ax, b.z - az);
      mesh.scale.set(1 + Math.sin(it.t * 40) * 0.3, 1 + Math.sin(it.t * 37) * 0.3, len);
      if (Math.random() < 0.5) self.glow.emit(b.x, 1.0, b.z, (ax - b.x) * 0.8, 0.4, (az - b.z) * 0.8, 0.35, 0.5, color, { drag: 0.5 });
      return it.t < life;
    }, dispose() { geo.dispose(); mat.dispose(); } });
  }

  spiral(ev, views) {
    const color = fxColor(ev.c || 'holy');
    const geo = new THREE.BoxGeometry(0.5, 0.35, 0.35);
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    const self = this;
    this.add({ obj: mesh, t: 0, a: ev.a, d: 1.5, update(dt, it) {
      it.t += dt;
      it.a += 4.2 * dt;
      it.d = Math.min(7, it.d + 1.2 * dt);
      const h = views.views.get(ev.u);
      if (!h) return false;
      const p = h.built.root.position;
      mesh.position.set(p.x + Math.cos(it.a) * it.d, 1.2, p.z + Math.sin(it.a) * it.d);
      mesh.rotation.y += dt * 10;
      self.trail(mesh.position.x, 1.2, mesh.position.z, color, 0.5, 0.3);
      return it.t < (ev.d || 4);
    }, dispose() { geo.dispose(); mat.dispose(); } });
  }

  /** Orbiting blades/orbs from world.orbits */
  updateOrbits(world, views, t) {
    let used = 0;
    for (const o of world.orbits.values()) {
      const v = views.views.get(o.u);
      if (!v) continue;
      const p = v.built.root.position;
      for (let i = 0; i < o.n; i++) {
        let m = this.orbitPool[used];
        if (!m) {
          m = new THREE.Mesh(this.orbitGeo.blade, new THREE.MeshBasicMaterial({ color: 0xffffff }));
          this.orbitPool.push(m);
          this.scene.add(m);
        }
        const isArc = o.v === 'arcane';
        m.geometry = isArc ? this.orbitGeo.arcane : this.orbitGeo.blade;
        m.material.color.set(isArc ? 0xff8cf0 : 0xdde6f0);
        const a = t * 3.2 + (i / o.n) * Math.PI * 2;
        m.position.set(p.x + Math.cos(a) * o.r, 1.1, p.z + Math.sin(a) * o.r);
        m.rotation.y = -a + t * 8;
        m.visible = true;
        if (isArc && Math.random() < 0.3) this.trail(m.position.x, 1.1, m.position.z, 0xff8cf0, 0.4, 0.25);
        used++;
      }
    }
    for (let i = used; i < this.orbitPool.length; i++) this.orbitPool[i].visible = false;
  }

  update(dt) {
    this.glow.update(dt);
    this.smoke.update(dt);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      let alive = false;
      try { alive = it.update(dt, it); } catch { alive = false; }
      if (!alive) {
        this.scene.remove(it.obj);
        if (it.dispose) it.dispose();
        else {
          if (it.obj.geometry && !it.obj.geometry.userData?.shared) it.obj.geometry.dispose();
          if (it.obj.material) it.obj.material.dispose();
        }
        this.items.splice(i, 1);
      }
    }
    this.shake = Math.max(0, this.shake - dt * 2.5);
  }

  dispose() {
    for (const it of this.items) this.scene.remove(it.obj);
    this.items = [];
    this.glow.dispose(this.scene);
    this.smoke.dispose(this.scene);
    for (const m of this.orbitPool) this.scene.remove(m);
  }
}
