// Instanced projectile rendering with glow points and trails.
import * as THREE from 'three';
import { PROJ_VIS_LIST } from '../core/data/visuals.js';
import { glowTexture } from './textures.js';

function makeGeo(kind) {
  switch (kind) {
    case 'arrow': {
      const shaft = new THREE.BoxGeometry(1.0, 0.05, 0.05);
      const tip = new THREE.ConeGeometry(0.08, 0.22, 4);
      tip.rotateZ(-Math.PI / 2);
      tip.translate(0.58, 0, 0);
      const fl = new THREE.BoxGeometry(0.2, 0.02, 0.18);
      fl.translate(-0.42, 0, 0);
      return mergeGeos([shaft, tip, fl]);
    }
    case 'orb': return new THREE.IcosahedronGeometry(1, 1);
    case 'bolt': return new THREE.BoxGeometry(0.45, 0.08, 0.08);
    case 'ball': return new THREE.IcosahedronGeometry(1, 0);
    case 'disc': { const g = new THREE.CylinderGeometry(1, 1, 0.15, 14); g.rotateX(Math.PI / 2); return g; }
    case 'knife': { const g = new THREE.BoxGeometry(0.6, 0.04, 0.1); return g; }
    case 'wave': {
      const g = new THREE.TorusGeometry(1, 0.12, 4, 16, Math.PI * 0.9);
      g.rotateX(Math.PI / 2);
      g.rotateY(Math.PI * 0.45); // bulge toward +X (direction of travel)
      return g;
    }
    case 'bone': { const g = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 5); g.rotateZ(Math.PI / 2); return g; }
    case 'rocket': { const g = new THREE.CylinderGeometry(0.1, 0.12, 0.6, 6); g.rotateZ(Math.PI / 2); return g; }
    case 'rock': return new THREE.DodecahedronGeometry(1, 0);
    default: return new THREE.IcosahedronGeometry(1, 0);
  }
}

function mergeGeos(list) {
  // simple merge for non-indexed conversion
  const geos = list.map((g) => g.index ? g.toNonIndexed() : g);
  let total = 0;
  for (const g of geos) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

// mesh kind, color, size (scale), glow color (or null), glow size, trail color, lit material?
const CFG = {
  arrow: ['arrow', 0xd8c8a0, 1, null, 0, null, true],
  arcane: ['orb', 0xffb0f8, 0.22, 0xff6ce8, 1.6, 0xff8cf0],
  arcane_s: ['orb', 0xffb0f8, 0.13, 0xff6ce8, 0.9, null],
  fireball: ['orb', 0xffd27a, 0.45, 0xff6a1a, 2.2, 0xff7a2a],
  fireball_s: ['orb', 0xffd27a, 0.28, 0xff6a1a, 2.0, 0xff7a2a],
  shadowbolt: ['orb', 0xd0a0ff, 0.25, 0x8a40ff, 1.8, 0xb070ff],
  rivet: ['bolt', 0xd8d8d8, 1, 0xffeeaa, 0.5, null, true],
  grenade: ['ball', 0x3a3a3a, 0.28, 0xff8a2a, 0.6, null, true],
  grenade_s: ['ball', 0x3a3a3a, 0.18, 0xff8a2a, 0.4, null, true],
  shield: ['disc', 0xffe9a8, 0.45, 0xffe9a8, 1.6, 0xffe9a8, true],
  knife: ['knife', 0xd5dde6, 1, 0x7affe8, 0.5, null, true],
  holywave: ['wave', 0xffe9a8, 1.2, 0xffe9a8, 1.8, null],
  corrupt: ['orb', 0xb0ff80, 0.25, 0x5abf20, 1.7, 0x7bd84a],
  bone: ['bone', 0xe6dcc3, 1, 0x9cff70, 0.8, null, true],
  bullet: ['bolt', 0xffdd88, 0.8, 0xffcc55, 0.6, null],
  rocket: ['rocket', 0x888890, 1, 0xff8a2a, 1.2, 0xff7a2a, true],
  spirit: ['orb', 0xd0e0ff, 0.25, 0x8ab0ff, 1.6, 0xb0d0ff],
  spark: ['orb', 0xfff7a0, 0.15, 0xfff27a, 1.1, null],
  shockwave: ['wave', 0xe8eef5, 1.1, 0xffffff, 1.4, null],
  e_arrow: ['arrow', 0x4a3a2a, 1, 0xff5040, 1.2, null, true],
  e_orb: ['orb', 0xffb0b0, 0.3, 0xff2020, 1.3, null],
  e_fire: ['orb', 0xffd27a, 0.35, 0xff4a10, 1.5, 0xff6a1a],
  e_frost: ['orb', 0xe0f8ff, 0.32, 0x40b8ff, 1.3, null],
  e_poison: ['orb', 0xc8ff9a, 0.32, 0x50d020, 1.3, null],
  e_shadow: ['orb', 0xe0b0ff, 0.32, 0x9a40ff, 1.3, null],
  e_stone: ['rock', 0x8a8a90, 0.3, 0xff6040, 1.6, null, true],
  e_bone: ['bone', 0xf0e8d0, 1.2, 0xff4030, 1.6, null, true],
  e_web: ['disc', 0xf0f0f0, 0.45, 0xffffff, 1.5, null, true],
  e_spark: ['orb', 0xfff7a0, 0.3, 0xffd020, 1.2, null],
  e_shell: ['ball', 0x333333, 0.35, 0xff5020, 1.0, null, true],
  e_skull: ['orb', 0xf0d0ff, 0.42, 0xa040ff, 1.6, null],
  e_rock: ['rock', 0x7a6a5a, 0.5, null, 0, null, true],
};

export class ProjectileRenderer {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    this.meshes = new Map();
    this.glowMax = 1500;
    const geo = new THREE.BufferGeometry();
    this.gPos = new Float32Array(this.glowMax * 3);
    this.gCol = new Float32Array(this.glowMax * 3);
    this.gSize = new Float32Array(this.glowMax);
    this.aPos = new THREE.BufferAttribute(this.gPos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.gCol, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.gSize, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('pcolor', this.aCol);
    geo.setAttribute('size', this.aSize);
    this.glowMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: glowTexture() }, uScale: { value: 300 } },
      vertexShader: `attribute float size; attribute vec3 pcolor; varying vec3 vColor; uniform float uScale;
        void main(){ vColor = pcolor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uMap; varying vec3 vColor; void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vColor * t.rgb, t.a * 0.9); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.glow = new THREE.Points(geo, this.glowMat);
    this.glow.frustumCulled = false;
    this.glowGeo = geo;
    scene.add(this.glow);
    this.m4 = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.v = new THREE.Vector3();
    this.s = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
  }

  setScale(s) { this.glowMat.uniforms.uScale.value = s; }

  ensure(name) {
    let m = this.meshes.get(name);
    if (m) return m;
    const cfg = CFG[name] || CFG.e_orb;
    const geo = makeGeo(cfg[0]);
    const mat = cfg[6]
      ? new THREE.MeshLambertMaterial({ color: cfg[1], flatShading: true, emissive: cfg[3] ? new THREE.Color(cfg[3]).multiplyScalar(0.25) : 0x000000 })
      : new THREE.MeshBasicMaterial({ color: cfg[1] });
    m = { mesh: new THREE.InstancedMesh(geo, mat, 256), cfg, count: 0, cap: 256 };
    m.mesh.frustumCulled = false;
    this.scene.add(m.mesh);
    this.meshes.set(name, m);
    return m;
  }

  update(world, dt, t) {
    for (const m of this.meshes.values()) m.count = 0;
    let gi = 0;
    for (const p of world.projs.values()) {
      const name = p.visName || PROJ_VIS_LIST[p.vis];
      if (!name || name === 'none') continue;
      const m = this.ensure(name);
      if (m.count >= m.cap) {
        this.scene.remove(m.mesh);
        const nm = new THREE.InstancedMesh(m.mesh.geometry, m.mesh.material, m.cap * 2);
        nm.frustumCulled = false;
        m.mesh = nm;
        m.cap *= 2;
        this.scene.add(nm);
      }
      const cfg = m.cfg;
      const y = p.h ?? 1;
      const spin = cfg[0] === 'disc' || cfg[0] === 'rock' || cfg[0] === 'ball' || name === 'knife' ? t * 14 : 0;
      this.q.setFromAxisAngle(this.up, -p.rot + spin);
      this.v.set(p.x, y, p.z);
      const sc = cfg[2];
      this.s.set(sc, sc, sc);
      this.m4.compose(this.v, this.q, this.s);
      m.mesh.setMatrixAt(m.count++, this.m4);
      if (cfg[3] && gi < this.glowMax) {
        const c = cfg[3];
        this.gPos[gi * 3] = p.x; this.gPos[gi * 3 + 1] = y; this.gPos[gi * 3 + 2] = p.z;
        this.gCol[gi * 3] = ((c >> 16) & 255) / 255; this.gCol[gi * 3 + 1] = ((c >> 8) & 255) / 255; this.gCol[gi * 3 + 2] = (c & 255) / 255;
        this.gSize[gi] = cfg[4] * (0.9 + Math.sin(t * 20 + p.id) * 0.1);
        gi++;
      }
      if (cfg[5] && Math.random() < 0.6) this.fx.trail(p.x, y, p.z, cfg[5], cfg[2] * 2.2, 0.3);
      if ((name === 'grenade' || name === 'rocket') && Math.random() < 0.4) this.fx.smoke.emit(p.x, y, p.z, 0, 0.3, 0, 0.6, 0.6, 0x555050, { g: -0.5, grow: 1 });
    }
    for (const m of this.meshes.values()) {
      m.mesh.count = m.count;
      if (m.count) m.mesh.instanceMatrix.needsUpdate = true;
    }
    this.glowGeo.setDrawRange(0, gi);
    this.aPos.needsUpdate = true;
    this.aCol.needsUpdate = true;
    this.aSize.needsUpdate = true;
  }

  dispose() {
    for (const m of this.meshes.values()) { this.scene.remove(m.mesh); m.mesh.geometry.dispose(); m.mesh.material.dispose(); }
    this.scene.remove(this.glow);
    this.glowGeo.dispose();
    this.glowMat.dispose();
  }
}
