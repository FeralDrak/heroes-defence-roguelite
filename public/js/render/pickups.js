// Ground pickups: items (with rarity beams), health orbs and chests.
import * as THREE from 'three';
import { ITEM_RARITY_COLORS } from '../core/constants.js';
import { beamTexture } from './textures.js';

const SLOT_SHAPES = {
  weapon: () => new THREE.BoxGeometry(0.9, 0.12, 0.18),
  helm: () => new THREE.IcosahedronGeometry(0.3, 0),
  chest: () => new THREE.BoxGeometry(0.5, 0.5, 0.25),
  gloves: () => new THREE.BoxGeometry(0.3, 0.3, 0.3),
  boots: () => new THREE.BoxGeometry(0.4, 0.3, 0.22),
  amulet: () => new THREE.TorusGeometry(0.22, 0.05, 6, 14),
  ring: () => new THREE.TorusGeometry(0.16, 0.05, 6, 14),
};

export class PickupRenderer {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    this.objs = new Map();
    this.geos = {};
    this.beamTex = beamTexture();
    this.beamGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 10, 1, true);
    this.beamGeo.translate(0, 3.5, 0);
  }

  geo(slot) {
    if (!this.geos[slot]) this.geos[slot] = (SLOT_SHAPES[slot] || SLOT_SHAPES.chest)();
    return this.geos[slot];
  }

  create(p) {
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    const e = { group: g, p, kind: p.k, seed: Math.random() * 10 };
    if (p.k === 'item' && p.it) {
      const col = new THREE.Color(ITEM_RARITY_COLORS[p.it.rarity] || '#ffffff');
      const mesh = new THREE.Mesh(this.geo(p.it.slot), new THREE.MeshLambertMaterial({ color: col, emissive: col.clone().multiplyScalar(0.35), flatShading: true }));
      mesh.position.y = 0.5;
      mesh.castShadow = true;
      g.add(mesh);
      e.mesh = mesh;
      const rar = p.it.rarity;
      if (rar !== 'common') {
        const beam = new THREE.Mesh(this.beamGeo, new THREE.MeshBasicMaterial({ color: col, map: this.beamTex, transparent: true, opacity: rar === 'magic' ? 0.25 : rar === 'rare' ? 0.4 : 0.75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        beam.scale.set(1, rar === 'magic' ? 0.35 : rar === 'rare' ? 0.6 : 1.4, 1);
        g.add(beam);
        e.beam = beam;
      }
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.65, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.position.y = 0.03;
      g.add(ring);
      e.ring = ring;
      if (rar === 'unique' || rar === 'legendary') this.fx.ringBurst(p.x, p.z, 2, 24, col.getHex(), { life: 0.8 });
    } else if (p.k === 'orb') {
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), new THREE.MeshBasicMaterial({ color: 0xff3a4a }));
      mesh.position.y = 0.6;
      g.add(mesh);
      e.mesh = mesh;
    } else if (p.k === 'chest') {
      const tier = p.tier || 'normal';
      const wood = tier === 'cursed' ? 0x3a1a4a : tier === 'boss' ? 0x8a6a2a : 0x6b4a2b;
      const trim = tier === 'cursed' ? 0xb050ff : 0xd4a83a;
      const s = tier === 'boss' ? 1.5 : 1;
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.1 * s, 0.6 * s, 0.75 * s), new THREE.MeshLambertMaterial({ color: wood, flatShading: true }));
      base.position.y = 0.3 * s;
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.375 * s, 0.375 * s, 1.1 * s, 8, 1, false, 0, Math.PI), new THREE.MeshLambertMaterial({ color: wood, flatShading: true }));
      lid.rotation.z = Math.PI / 2;
      lid.position.y = 0.6 * s;
      const band = new THREE.Mesh(new THREE.BoxGeometry(1.14 * s, 0.1 * s, 0.79 * s), new THREE.MeshLambertMaterial({ color: trim, emissive: tier === 'cursed' ? 0x5a1a8a : 0x3a2a00 }));
      band.position.y = 0.5 * s;
      for (const m of [base, lid, band]) { m.castShadow = true; g.add(m); }
      const glow = new THREE.Mesh(new THREE.RingGeometry(0.9 * s, 1.2 * s, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: trim, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.y = 0.03;
      g.add(glow);
      e.glow = glow;
      g.rotation.y = Math.random() * Math.PI;
    }
    this.scene.add(g);
    this.objs.set(p.id, e);
    return e;
  }

  update(world, t) {
    const seen = new Set();
    for (const p of world.pickups.values()) {
      seen.add(p.id);
      let e = this.objs.get(p.id);
      if (!e) e = this.create(p);
      if (e.mesh && e.kind === 'item') {
        e.mesh.position.y = 0.5 + Math.sin(t * 2 + e.seed) * 0.1;
        e.mesh.rotation.y = t * 1.2 + e.seed;
        if (e.ring) e.ring.material.opacity = 0.4 + Math.sin(t * 3 + e.seed) * 0.2;
      } else if (e.kind === 'orb') {
        e.mesh.position.y = 0.6 + Math.sin(t * 3 + e.seed) * 0.12;
        const s = 1 + Math.sin(t * 6 + e.seed) * 0.1;
        e.mesh.scale.setScalar(s);
        if (Math.random() < 0.15) this.fx.glow.emit(p.x, 0.6, p.z, 0, 0.8, 0, 0.5, 0.6, 0xff3a4a, { g: 0 });
      } else if (e.kind === 'chest' && e.glow) {
        e.glow.material.opacity = 0.35 + Math.sin(t * 3 + e.seed) * 0.2;
        if (p.tier !== 'normal' && Math.random() < 0.2) this.fx.glow.emit(p.x + (Math.random() - 0.5), 0.8, p.z + (Math.random() - 0.5), 0, 1, 0, 0.8, 0.5, p.tier === 'cursed' ? 0xb050ff : 0xffd24a, { g: 0 });
      }
    }
    for (const [id, e] of this.objs) {
      if (!seen.has(id)) {
        this.scene.remove(e.group);
        e.group.traverse((o) => { if (o.material) o.material.dispose(); if (o.geometry && o.geometry !== this.beamGeo && !Object.values(this.geos).includes(o.geometry)) o.geometry.dispose(); });
        this.objs.delete(id);
      }
    }
  }

  dispose() {
    for (const e of this.objs.values()) this.scene.remove(e.group);
    this.objs.clear();
  }
}
