// Arena scenery: floor, walls, gates, pillars, braziers.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { floorTexture, stoneTexture, glowTexture } from './textures.js';
import { ARENA_RADIUS } from '../core/constants.js';

export class ArenaView {
  constructor(scene, arena, quality) {
    this.scene = scene;
    this.arena = arena;
    this.group = new THREE.Group();
    this.gates = [];
    this.flames = [];
    this.lights = [];
    const pal = arena.palette;
    scene.add(this.group);

    // floor
    const floorMat = new THREE.MeshLambertMaterial({ map: floorTexture(pal, quality >= 2 ? 2048 : 1024) });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(34, 96), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);
    this.floor = floor;

    // outer ground
    const outer = new THREE.Mesh(new THREE.RingGeometry(34, 90, 64), new THREE.MeshLambertMaterial({ color: pal.ground }));
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.02;
    this.group.add(outer);

    // curb ring marking the playable limit
    const curbMat = new THREE.MeshLambertMaterial({ color: pal.wall, flatShading: true });
    const curb = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_RADIUS + 1.2, ARENA_RADIUS + 1.2, 0.5, 96, 1, true), curbMat);
    curb.position.y = 0.25;
    curb.material.side = THREE.DoubleSide;
    this.group.add(curb);
    const curbTop = new THREE.Mesh(new THREE.RingGeometry(ARENA_RADIUS + 0.7, ARENA_RADIUS + 1.6, 96), curbMat);
    curbTop.rotation.x = -Math.PI / 2;
    curbTop.position.y = 0.5;
    this.group.add(curbTop);

    // outer wall
    const wallTex = stoneTexture(pal.wall, 256, 11);
    wallTex.repeat.set(24, 1.5);
    const wallMat = new THREE.MeshLambertMaterial({ map: wallTex, side: THREE.BackSide });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(33.5, 33.5, 5.5, 96, 1, true), wallMat);
    wall.position.y = 2.75;
    this.group.add(wall);
    const wallTop = new THREE.Mesh(new THREE.RingGeometry(33.5, 36, 96), new THREE.MeshLambertMaterial({ color: pal.wall }));
    wallTop.rotation.x = -Math.PI / 2;
    wallTop.position.y = 5.5;
    this.group.add(wallTop);
    // crenellations
    const crenGeo = new THREE.BoxGeometry(0.9, 0.9, 1.2);
    const n = 72;
    const cren = new THREE.InstancedMesh(crenGeo, new THREE.MeshLambertMaterial({ color: pal.wall, flatShading: true }), n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      m.makeRotationY(-a);
      m.setPosition(Math.cos(a) * 33.9, 5.95, Math.sin(a) * 33.9);
      cren.setMatrixAt(i, m);
    }
    this.group.add(cren);
    // stands (stepped rings outside)
    for (let i = 0; i < 4; i++) {
      const step = new THREE.Mesh(new THREE.CylinderGeometry(36 + i * 3, 36 + i * 3, 1, 64, 1, true), new THREE.MeshLambertMaterial({ color: pal.ground, side: THREE.BackSide }));
      step.position.y = 6 + i * 1.6;
      this.group.add(step);
      const top = new THREE.Mesh(new THREE.RingGeometry(36 + i * 3, 39 + i * 3, 64), new THREE.MeshLambertMaterial({ color: i % 2 ? pal.wall : pal.ground }));
      top.rotation.x = -Math.PI / 2;
      top.position.y = 6.5 + i * 1.6;
      this.group.add(top);
    }

    // pillars: one mesh (and material) each, so they can fade out when something stands behind them
    this.pillars = [];
    const pillarCol = new THREE.Color(pal.pillar), capCol = new THREE.Color(pal.wall);
    for (const o of arena.obstacles) {
      const parts = [
        [new THREE.CylinderGeometry(o.r * 0.82, o.r * 0.9, 4.2, 10), 2.1, pillarCol],
        [new THREE.CylinderGeometry(o.r * 1.05, o.r * 1.12, 0.5, 10), 0.25, capCol],
        [new THREE.CylinderGeometry(o.r * 1.12, o.r * 0.9, 0.5, 10), 4.4, capCol],
      ].map(([geo, y, col]) => {
        let g = geo.toNonIndexed();
        geo.dispose();
        g.translate(0, y, 0);
        const n = g.attributes.position.count;
        const colors = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b; }
        g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        return g;
      });
      const geo = mergeGeometries(parts, false);
      for (const g of parts) g.dispose();
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = quality >= 1;
      mesh.receiveShadow = true;
      mesh.userData.dynamic = true;
      mesh.position.set(o.x, 0, o.z);
      mesh.rotation.y = Math.random() * Math.PI;
      this.group.add(mesh);
      this.pillars.push({ mesh, mat, x: o.x, z: o.z, r: o.r, op: 1 });
    }

    // gates
    const glow = glowTexture();
    const archMat = new THREE.MeshLambertMaterial({ color: pal.wall, flatShading: true });
    const darkMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    for (const gate of arena.gates) {
      const g = new THREE.Group();
      const a = gate.a;
      const left = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6, 1.4), archMat);
      left.position.set(0, 3, -2.4);
      const right = left.clone();
      right.position.z = 2.4;
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 6.2), archMat);
      top.position.set(0, 6.2, 0);
      const portalMat = new THREE.MeshBasicMaterial({ color: pal.rune, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
      const portal = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 5.4), portalMat);
      portal.position.set(0.2, 2.7, 0);
      portal.rotation.y = Math.PI / 2;
      portal.userData.dynamic = true;
      const dark = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 5.6), darkMat);
      dark.position.set(0.6, 2.8, 0);
      dark.rotation.y = -Math.PI / 2;
      g.add(left, right, top, dark, portal);
      g.position.set(Math.cos(a) * 33.2, 0, Math.sin(a) * 33.2);
      g.rotation.y = -a;
      this.group.add(g);
      this.gates.push({ portal, flash: 0 });
    }

    // braziers (between gates)
    const nB = arena.gates.length;
    const fireMat = new THREE.SpriteMaterial({ map: glow, color: pal.torch, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const bowlMat = new THREE.MeshLambertMaterial({ color: 0x3a3030, flatShading: true });
    const standMat = new THREE.MeshLambertMaterial({ color: 0x2a2525 });
    for (let i = 0; i < nB; i++) {
      const a = arena.gates[i].a + Math.PI / nB;
      const x = Math.cos(a) * 32.6, z = Math.sin(a) * 32.6;
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.35, 0.6, 8), bowlMat);
      bowl.position.set(x, 5.85, z);
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 5.6, 6), standMat);
      stand.position.set(x, 2.8, z);
      this.group.add(bowl, stand);
      for (let k = 0; k < 3; k++) {
        const s = new THREE.Sprite(fireMat.clone());
        s.position.set(x, 6.4 + k * 0.35, z);
        s.scale.setScalar(1.6 - k * 0.35);
        this.group.add(s);
        this.flames.push({ s, base: 6.4 + k * 0.35, seed: Math.random() * 10, k });
      }
      if (quality >= 1 && i % (quality >= 2 ? 2 : 3) === 0) {
        const L = new THREE.PointLight(pal.torch, 40, 22, 1.6);
        L.position.set(x * 0.95, 6.6, z * 0.95);
        this.group.add(L);
        this.lights.push({ L, base: 40, seed: Math.random() * 10 });
      }
    }
    // central rune glow
    const runeMat = new THREE.MeshBasicMaterial({ color: pal.rune, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false });
    const rune = new THREE.Mesh(new THREE.RingGeometry(5.2, 5.8, 64), runeMat);
    rune.rotation.x = -Math.PI / 2;
    rune.position.y = 0.03;
    rune.userData.dynamic = true;
    this.group.add(rune);
    this.rune = rune;
    this.mergeStatic();
  }

  /** Merge static meshes sharing a material into one mesh each (far fewer draw calls) */
  mergeStatic() {
    this.group.updateMatrixWorld(true);
    const buckets = new Map();
    const remove = [];
    this.group.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.userData.dynamic) return;
      let b = buckets.get(o.material.uuid);
      if (!b) { b = { mat: o.material, items: [] }; buckets.set(o.material.uuid, b); }
      b.items.push(o);
    });
    for (const b of buckets.values()) {
      if (b.items.length < 2) continue;
      const geos = b.items.map((o) => {
        let g = o.geometry.clone();
        if (g.index) g = g.toNonIndexed();
        g.applyMatrix4(o.matrixWorld);
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        return g;
      });
      let merged = null;
      try { merged = mergeGeometries(geos, false); } catch { merged = null; }
      for (const g of geos) g.dispose();
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, b.mat);
      mesh.castShadow = b.items.some((o) => o.castShadow);
      mesh.receiveShadow = b.items.some((o) => o.receiveShadow);
      for (const o of b.items) { remove.push(o); }
      this.group.add(mesh);
    }
    for (const o of remove) {
      o.parent.remove(o);
      o.geometry.dispose();
    }
  }

  flashGate(i) {
    const g = this.gates[i];
    if (g) g.flash = 1;
  }

  /** Fade pillars that hide a hero or a monster standing behind them (the camera looks north) */
  updateOcclusion(dt, world, local) {
    const k = Math.min(1, dt * 10);
    for (const p of this.pillars) {
      let hidden = false;
      const behind = (x, z) => Math.abs(x - p.x) < p.r + 0.5 && z < p.z + 0.3 && z > p.z - p.r - 3.2;
      if (local && behind(local.x, local.z)) hidden = true;
      if (!hidden && world) {
        for (const u of world.units.values()) {
          if ((u.kind === 'hero' || u.kind === 'monster' || u.kind === 'boss') && behind(u.x, u.z)) { hidden = true; break; }
        }
      }
      const target = hidden ? 0.3 : 1;
      if (Math.abs(target - p.op) < 0.005) { if (p.op === target) continue; p.op = target; }
      else p.op += (target - p.op) * k;
      const transparent = p.op < 0.99;
      if (transparent !== p.mat.transparent) { p.mat.transparent = transparent; p.mat.depthWrite = !transparent; p.mat.needsUpdate = true; }
      p.mat.opacity = p.op;
    }
  }

  update(dt, t, phase) {
    for (const f of this.flames) {
      f.s.position.y = f.base + Math.sin(t * 8 + f.seed) * 0.08;
      const s = (1.6 - f.k * 0.35) * (0.85 + Math.sin(t * 13 + f.seed) * 0.15);
      f.s.scale.setScalar(s);
    }
    for (const l of this.lights) l.L.intensity = l.base * (0.85 + Math.sin(t * 11 + l.seed) * 0.08 + Math.sin(t * 23 + l.seed) * 0.05);
    const waveOn = phase === 'wave';
    for (const g of this.gates) {
      g.flash = Math.max(0, g.flash - dt * 1.5);
      g.portal.material.opacity = (waveOn ? 0.45 : 0.18) + g.flash * 0.5 + Math.sin(t * 3) * 0.05;
    }
    this.rune.material.opacity = 0.05 + Math.sin(t * 1.5) * 0.03 + (waveOn ? 0 : 0.04);
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
  }
}
