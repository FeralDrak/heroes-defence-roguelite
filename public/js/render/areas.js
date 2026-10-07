// Ground zones & attack telegraphs.
import * as THREE from 'three';
import { TEAM_HEROES } from '../core/constants.js';

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform vec3 uColor;
uniform vec3 uColor2;
uniform float uTime;
uniform float uProgress;
uniform float uOpacity;
uniform float uShape;   // 0 radial, 1 line
uniform float uKind;    // 0 telegraph, 1 zone, 2 marker (friendly delayed)
uniform float uInner;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
void main(){
  float r; float edgeDist;
  if (uShape < 0.5) { vec2 c = vUv - 0.5; r = length(c) * 2.0; edgeDist = 1.0 - r; }
  else { r = vUv.y; edgeDist = min(min(vUv.x, 1.0 - vUv.x) * 4.0, min(vUv.y, 1.0 - vUv.y) * 8.0); }
  float a = 0.0; vec3 col = uColor;
  if (uKind < 0.5) {
    float edge = 1.0 - smoothstep(0.0, 0.07, edgeDist);
    float filled = uShape < 0.5 ? step(r, max(uInner, uProgress)) : step(r, uProgress);
    if (uInner > 0.01) filled = step(uInner, r) * step(r, uInner + (1.0 - uInner) * uProgress);
    a = edge * 0.95 + 0.14 + filled * 0.32 + uProgress * 0.12;
    col = mix(uColor, vec3(1.0), edge * 0.35);
    a *= 0.85 + 0.15 * sin(uTime * 14.0);
  } else if (uKind < 1.5) {
    float n = noise(vUv * 7.0 + vec2(uTime * 0.6, -uTime * 0.4)) * 0.6 + noise(vUv * 15.0 - uTime * 0.9) * 0.4;
    float fade = smoothstep(0.0, 0.25, edgeDist);
    a = (0.22 + n * 0.5) * fade;
    col = mix(uColor, uColor2, n);
    float ring = 1.0 - smoothstep(0.0, 0.05, edgeDist);
    a += ring * 0.35;
  } else {
    float edge = 1.0 - smoothstep(0.0, 0.08, edgeDist);
    float inner = abs(r - uProgress) < 0.05 ? 0.6 : 0.0;
    a = edge * 0.8 + inner + 0.08;
    a *= 0.7 + 0.3 * sin(uTime * 10.0);
  }
  if (uInner > 0.01 && uShape < 0.5 && r < uInner) a = 0.0;
  gl_FragColor = vec4(col, a * uOpacity);
}`;

// vis -> [kind, color, color2]
const STYLES = {
  tele: [0, 0xff2a1a, 0xff2a1a],
  tele_frost: [0, 0x40b8ff, 0x40b8ff],
  tele_jail: [0, 0x9a7aff, 0x9a7aff],
  tele_ring: [0, 0xff3a1a, 0xff3a1a],
  lava: [0, 0xff5a10, 0xff5a10],
  meteor: [2, 0xffa040, 0xffa040],
  missile: [2, 0xff8a2a, 0xff8a2a],
  judgment: [2, 0xffe9a8, 0xffe9a8],
  fireground: [1, 0xff5a10, 0xffc040],
  fireground_e: [1, 0xff3a00, 0xff9a20],
  firetrail: [1, 0xff5a10, 0xffb040],
  firetrail_e: [1, 0xff3a00, 0xff9a20],
  firering: [1, 0xff3a00, 0xffaa30],
  frostfield: [1, 0x40a8ff, 0xd0f0ff],
  consecrate: [1, 0xffc850, 0xfff0b0],
  consecrate_s: [1, 0xffc850, 0xfff0b0],
  smoke: [1, 0x6a6a72, 0x9a9aa8],
  shadowpool: [1, 0x5a1aa0, 0x9a40ff],
  plague: [1, 0x5aa020, 0xb0ff60],
  acid: [1, 0x4ab020, 0xa0ff50],
  arrowrain: [1, 0x806040, 0xc0a070],
  firerain: [1, 0xff6a1a, 0xffc060],
  whirl: [1, 0xc0c8d0, 0xffffff],
  voidbeam: [1, 0x8a30ff, 0xe0a0ff],
  curse: [1, 0x8a30c0, 0xc080ff],
};

export class AreaRenderer {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    this.meshes = new Map();
    this.trapGeo = new THREE.CylinderGeometry(0.55, 0.65, 0.12, 10);
    this.spikeGeo = new THREE.ConeGeometry(0.08, 0.3, 4);
    this.mineGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.18, 8);
  }

  makeShape(a) {
    let geo, shapeUv = 0, inner = 0;
    switch (a.sh) {
      case 'ring':
        geo = new THREE.RingGeometry(a.r2, a.r, 72, 1);
        inner = a.r > 0 ? a.r2 / a.r : 0;
        break;
      case 'cone': {
        // arc centered on +X in sim space: RingGeometry/CircleGeometry angle φ maps to sim angle -φ
        geo = new THREE.CircleGeometry(a.r, 32, -a.arc / 2, a.arc);
        break;
      }
      case 'line': {
        geo = new THREE.PlaneGeometry(a.len, a.w);
        geo.translate(a.len / 2, 0, 0);
        // uv.y along length for progress: swap uv
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, v, u); }
        shapeUv = 1;
        break;
      }
      default:
        geo = new THREE.CircleGeometry(a.r, 48);
    }
    geo.rotateX(-Math.PI / 2);
    return { geo, shapeUv, inner };
  }

  create(a) {
    const vis = a.v || 'tele';
    if (vis === 'frosttrap' || vis === 'firetrap') return this.createTrap(a, vis === 'firetrap');
    if (vis === 'mine') return this.createMine(a);
    const style = STYLES[vis] || (a.tm === TEAM_HEROES ? [1, 0x8ad8ff, 0xffffff] : STYLES.tele);
    const { geo, shapeUv, inner } = this.makeShape(a);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(style[1]) },
        uColor2: { value: new THREE.Color(style[2]) },
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uOpacity: { value: 1 },
        uShape: { value: shapeUv },
        uKind: { value: style[0] },
        uInner: { value: inner },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: style[0] === 1 && vis !== 'smoke' ? THREE.AdditiveBlending : THREE.NormalBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = style[0] === 0 ? 5 : 2;
    mesh.position.y = style[0] === 0 ? 0.07 : 0.05;
    this.scene.add(mesh);
    return { mesh, mat, vis, style, area: a };
  }

  createTrap(a, fire) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(this.trapGeo, new THREE.MeshLambertMaterial({ color: 0x6a5a4a, flatShading: true }));
    base.position.y = 0.06;
    g.add(base);
    const spikeMat = new THREE.MeshLambertMaterial({ color: fire ? 0xff8a3a : 0xbfe8ff, emissive: fire ? 0x8a2a00 : 0x2a6a9a });
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(this.spikeGeo, spikeMat);
      const ang = (i / 6) * Math.PI * 2;
      s.position.set(Math.cos(ang) * 0.35, 0.25, Math.sin(ang) * 0.35);
      g.add(s);
    }
    const glow = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.5, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: fire ? 0xff6a1a : 0x6ad0ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.y = 0.04;
    g.add(glow);
    g.position.set(a.x, 0, a.z);
    this.scene.add(g);
    return { mesh: g, mat: null, vis: 'trap', glow, area: a };
  }

  createMine(a) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(this.mineGeo, new THREE.MeshLambertMaterial({ color: 0x3a3a3a, flatShading: true }));
    body.position.y = 0.09;
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff3300 }));
    light.position.y = 0.22;
    g.add(body, light);
    g.position.set(a.x, 0, a.z);
    this.scene.add(g);
    return { mesh: g, mat: null, vis: 'mine', light, area: a };
  }

  update(world, units, controller, localHeroId, t, dt) {
    const rt = world.renderTime;
    const seen = new Set();
    for (const a of world.areas.values()) {
      seen.add(a.id);
      let e = this.meshes.get(a.id);
      if (!e) { e = this.create(a); this.meshes.set(a.id, e); }
      // follow
      let x = a.x, z = a.z;
      if (a.f) {
        if (a.f === localHeroId && controller && controller.ready) { x = controller.x; z = controller.z; }
        else {
          const u = world.units.get(a.f);
          if (u) { x = u.x; z = u.z; }
        }
      }
      e.mesh.position.x = x;
      e.mesh.position.z = z;
      const age = rt - a.born;
      if (a.sh === 'cone' || a.sh === 'line') {
        let ang = a.a;
        if (a.rs) ang += a.rs * Math.max(0, age - (a.d || 0));
        e.mesh.rotation.y = -ang;
      }
      if (e.mat) {
        e.mat.uniforms.uTime.value = t;
        if (a.d > 0) e.mat.uniforms.uProgress.value = Math.min(1, age / a.d);
        else e.mat.uniforms.uProgress.value = 1;
        const life = a.dur > 0 ? a.dur : 0;
        let op = 1;
        if (e.style[0] === 1) {
          op = Math.min(1, age * 4);
          if (life > 0) op *= Math.min(1, (a.d + life - age) * 2);
        }
        e.mat.uniforms.uOpacity.value = Math.max(0, op);
        if (e.vis === 'whirl') e.mesh.rotation.y = -t * 12;
        this.ambient(e, x, z, a, dt);
      } else if (e.vis === 'trap' && e.glow) {
        e.glow.material.opacity = age < 0.6 ? 0.08 : 0.2 + Math.sin(t * 5) * 0.08;
      } else if (e.vis === 'mine' && e.light) {
        e.light.visible = Math.sin(t * 8) > 0;
      }
    }
    for (const [id, e] of this.meshes) {
      if (!seen.has(id)) {
        this.scene.remove(e.mesh);
        if (e.mat) { e.mat.dispose(); e.mesh.geometry.dispose(); }
        this.meshes.delete(id);
      }
    }
  }

  ambient(e, x, z, a, dt) {
    const fx = this.fx;
    const r = a.r || 2;
    const rate = dt * r * r * 0.9;
    const rnd = () => { const ang = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * r; return [x + Math.cos(ang) * rr, z + Math.sin(ang) * rr]; };
    switch (e.vis) {
      case 'fireground': case 'fireground_e': case 'firetrail': case 'firetrail_e':
        if (Math.random() < rate * 2) { const [px, pz] = rnd(); fx.glow.emit(px, 0.2, pz, 0, 1.5 + Math.random(), 0, 0.6, 0.6, 0xff7a2a, { g: -1, drag: 1 }); }
        break;
      case 'firering':
        for (let i = 0; i < 3; i++) { const ang = Math.random() * Math.PI * 2, rr = a.r2 + Math.random() * (a.r - a.r2); fx.glow.emit(x + Math.cos(ang) * rr, 0.3, z + Math.sin(ang) * rr, 0, 2 + Math.random() * 2, 0, 0.7, 1.0, 0xff6a1a, { g: -1 }); }
        break;
      case 'frostfield':
        if (Math.random() < rate) { const [px, pz] = rnd(); fx.glow.emit(px, 0.2, pz, 0, 0.8, 0, 0.8, 0.4, 0xbfe8ff, { g: 0 }); }
        break;
      case 'consecrate': case 'consecrate_s':
        if (Math.random() < rate * 1.5) { const [px, pz] = rnd(); fx.glow.emit(px, 0.2, pz, 0, 1.6, 0, 0.9, 0.45, 0xffe9a8, { g: 0, drag: 0.5 }); }
        break;
      case 'smoke':
        if (Math.random() < rate * 2) { const [px, pz] = rnd(); fx.smoke.emit(px, 0.4, pz, (Math.random() - 0.5) * 0.5, 0.4, (Math.random() - 0.5) * 0.5, 1.6, 2.4, 0x8a8a92, { g: 0, drag: 0.5, grow: 0.8 }); }
        break;
      case 'shadowpool': case 'curse':
        if (Math.random() < rate) { const [px, pz] = rnd(); fx.glow.emit(px, 0.2, pz, 0, 1.2, 0, 0.8, 0.5, 0x9a40ff, { g: 0 }); }
        break;
      case 'plague': case 'acid':
        if (Math.random() < rate) { const [px, pz] = rnd(); fx.glow.emit(px, 0.15, pz, 0, 0.9, 0, 0.7, 0.5, 0x8ef06a, { g: 0 }); }
        break;
      case 'arrowrain': case 'firerain': {
        const n = Math.random() < 0.7 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const [px, pz] = rnd();
          fx.glow.emit(px + 1, 9, pz - 1, -6, -26, 6, 0.33, e.vis === 'firerain' ? 0.6 : 0.35, e.vis === 'firerain' ? 0xff8a3a : 0xe8d8b0, { g: 0, drag: 0 });
        }
        break;
      }
      case 'whirl':
        if (Math.random() < 0.8) { const ang = Math.random() * Math.PI * 2; fx.glow.emit(x + Math.cos(ang) * r, 0.9, z + Math.sin(ang) * r, -Math.sin(ang) * 8, 0, Math.cos(ang) * 8, 0.2, 0.4, 0xe8eef5, { drag: 2 }); }
        break;
      case 'voidbeam':
        break;
      default:
        break;
    }
  }

  dispose() {
    for (const e of this.meshes.values()) {
      this.scene.remove(e.mesh);
      if (e.mat) { e.mat.dispose(); e.mesh.geometry.dispose(); }
    }
    this.meshes.clear();
  }
}
