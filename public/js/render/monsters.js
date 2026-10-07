// Instanced rendering of regular monsters.
// Each rig part (limb) is merged into one geometry with baked vertex colors, so a monster type costs
// one draw call per part (plus one per emissive/transparent group) whatever the number of monsters.
import * as THREE from 'three';
import { MONSTER_RIGS } from './rigs.js';
import { poseRole, mergePieces, pieceGroups } from './models.js';
import { UF, ANIM } from '../core/constants.js';
import { ELITE_AFFIXES } from '../core/data/elites.js';

const _base = new THREE.Matrix4();
const _part = new THREE.Matrix4();
const _final = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _yAxis = new THREE.Vector3(0, 1, 0);
const pose = { rx: 0, ry: 0, rz: 0, ty: 0, sy: 1 };

const TINT_FROZEN = new THREE.Color(0x9fe0ff);
const TINT_BURN = new THREE.Color(0xffa060);
const TINT_POISON = new THREE.Color(0x9cff70);
const TINT_SHOCK = new THREE.Color(0xfff27a);
const TINT_CURSE = new THREE.Color(0xc080ff);
const WHITE = new THREE.Color(1, 1, 1);

export class MonsterInstancer {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.types = new Map();
    this.state = new Map();
    this.dying = [];
    const ringGeo = new THREE.RingGeometry(0.85, 1.05, 28);
    ringGeo.rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    this.rings = new THREE.InstancedMesh(ringGeo, this.ringMat, 96);
    this.rings.frustumCulled = false;
    this.rings.count = 0;
    this.rings.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(96 * 3), 3);
    scene.add(this.rings);
  }

  ensureType(name) {
    let t = this.types.get(name);
    if (t) return t;
    const f = MONSTER_RIGS[name];
    if (!f) return null;
    const rig = f();
    t = { name, rig, capacity: 0, count: 0, batches: [] };
    for (const part of rig.parts) {
      for (const grp of pieceGroups(part)) {
        t.batches.push({ part, geo: mergePieces(part, grp.pieces), emissive: grp.emissive, opacity: grp.opacity, mesh: null });
      }
    }
    this.types.set(name, t);
    this.grow(t, 48);
    return t;
  }

  grow(t, capacity) {
    t.capacity = capacity;
    for (const b of t.batches) {
      let mat;
      let oldMatrix = null, oldColor = null;
      if (b.mesh) {
        mat = b.mesh.material;
        oldMatrix = b.mesh.instanceMatrix.array;
        oldColor = b.mesh.instanceColor.array;
        this.scene.remove(b.mesh);
        b.mesh.dispose();
      } else {
        mat = new THREE.MeshLambertMaterial({
          color: 0xffffff,
          vertexColors: true,
          emissive: b.emissive || 0,
          emissiveIntensity: b.emissive ? 0.9 : 0,
          transparent: b.opacity < 1,
          opacity: b.opacity,
          depthWrite: b.opacity >= 1,
          flatShading: true,
        });
      }
      const mesh = new THREE.InstancedMesh(b.geo, mat, capacity);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
      if (oldMatrix) {
        mesh.instanceMatrix.array.set(oldMatrix.subarray(0, Math.min(oldMatrix.length, mesh.instanceMatrix.array.length)));
        mesh.instanceColor.array.set(oldColor.subarray(0, Math.min(oldColor.length, mesh.instanceColor.array.length)));
      }
      mesh.frustumCulled = false;
      mesh.castShadow = this.quality >= 2 && b.opacity >= 1;
      mesh.count = 0;
      b.mesh = mesh;
      this.scene.add(mesh);
    }
  }

  onDeath(id) {
    const st = this.state.get(id);
    if (!st || !st.visName) return;
    this.dying.push({ visName: st.visName, x: st.px, z: st.pz, rot: st.rot, scale: st.scale, t: 0, seed: st.seed, phase: st.phase });
    this.state.delete(id);
  }

  /** Write one instance of a type */
  writeInstance(type, animState, tint, idx) {
    let lastPart = null;
    for (const b of type.batches) {
      if (b.part !== lastPart) {
        lastPart = b.part;
        poseRole(b.part.role, animState, pose);
        _e.set(pose.rx, pose.ry, pose.rz);
        _q2.setFromEuler(_e);
        _v.set(b.part.pivot[0], b.part.pivot[1] + pose.ty, b.part.pivot[2]);
        _s.set(1, pose.sy, 1);
        _part.compose(_v, _q2, _s);
        _final.multiplyMatrices(_base, _part);
      }
      b.mesh.setMatrixAt(idx, _final);
      b.mesh.setColorAt(idx, tint);
    }
  }

  update(world, dt, now) {
    for (const t of this.types.values()) t.count = 0;
    let ringCount = 0;
    const frame = world.frame;
    for (const u of world.units.values()) {
      if (u.kind !== 'monster') continue;
      const type = this.ensureType(u.visName);
      if (!type) continue;
      let st = this.state.get(u.id);
      if (!st) {
        st = { px: u.x, pz: u.z, phase: Math.random() * 6, move: 0, atk: -1, cast: -1, special: -1, seed: Math.random() * 10, born: now };
        this.state.set(u.id, st);
      }
      const dx = u.x - st.px, dz = u.z - st.pz;
      const sp = dt > 0 ? Math.hypot(dx, dz) / dt : 0;
      st.px = u.x; st.pz = u.z; st.rot = u.rot; st.scale = u.scale; st.visName = u.visName; st.seen = frame;
      st.move += (Math.min(1, sp / 2.5) - st.move) * Math.min(1, dt * 10);
      st.phase += Math.min(sp, 12) * dt * 2.4;
      if (u.animTrigger) {
        u.animTrigger = false;
        if (u.animState === ANIM.ATTACK) st.atk = 0;
        else if (u.animState === ANIM.CAST) st.cast = 0;
        else if (u.animState === ANIM.SPECIAL) st.special = 0;
      }
      if (st.atk >= 0) { st.atk += dt / 0.6; if (st.atk > 1) st.atk = -1; }
      if (st.cast >= 0) { st.cast += dt / 0.8; if (st.cast > 1) st.cast = -1; }
      if (st.special >= 0) { st.special += dt / 1.0; if (st.special > 1) st.special = -1; }
      if (type.count >= type.capacity) this.grow(type, type.capacity * 2);
      // tint (instance colors can exceed 1 to brighten the hit flash)
      const f = u.flags;
      _c.copy(WHITE);
      if (f & UF.FROZEN) _c.lerp(TINT_FROZEN, 0.8);
      else if (f & UF.CHILL) _c.lerp(TINT_FROZEN, 0.4);
      else if (f & UF.BURN) _c.lerp(TINT_BURN, 0.45);
      else if (f & UF.POISON) _c.lerp(TINT_POISON, 0.45);
      else if (f & UF.SHOCK) _c.lerp(TINT_SHOCK, 0.45);
      else if (f & UF.CURSE) _c.lerp(TINT_CURSE, 0.5);
      if (u.flashUntil && u.flashUntil > now) _c.multiplyScalar(2.4);
      let y = 0;
      if (f & UF.SPAWNING) {
        const k = Math.min(1, (now - st.born) / 0.9);
        y = -(1 - k) * 1.6;
      }
      const stunned = f & (UF.STUN | UF.FROZEN);
      const animState = {
        phase: st.phase, move: stunned ? 0 : st.move, atk: st.atk, cast: st.cast, special: stunned ? -1 : st.special,
        t: (f & UF.FROZEN) ? st.seed : now, seed: st.seed, anim: type.rig.anim,
      };
      const sc = u.scale || 1;
      _q.setFromAxisAngle(_yAxis, -u.rot);
      _v.set(u.x, y, u.z);
      _s.set(sc, sc, sc);
      _base.compose(_v, _q, _s);
      this.writeInstance(type, animState, _c, type.count++);
      if ((f & UF.ELITE) && ringCount < 96) {
        const info = world.infos.get(u.id);
        const af = info && info.af && info.af[0];
        _c.set(af && ELITE_AFFIXES[af] ? ELITE_AFFIXES[af].color : '#ffcc33');
        _q.setFromAxisAngle(_yAxis, now * 1.5);
        _v.set(u.x, 0.06, u.z);
        const rs = sc * 0.75;
        _s.set(rs, 1, rs);
        _final.compose(_v, _q, _s);
        this.rings.setMatrixAt(ringCount, _final);
        this.rings.setColorAt(ringCount, _c);
        ringCount++;
      }
    }
    // dying monsters: topple and sink into the ground
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i];
      d.t += dt;
      if (d.t > 1.0) { this.dying.splice(i, 1); continue; }
      const type = this.ensureType(d.visName);
      if (!type) continue;
      if (type.count >= type.capacity) this.grow(type, type.capacity * 2);
      const k = d.t;
      _q.setFromAxisAngle(_yAxis, -d.rot);
      _e.set(0, 0, -Math.min(1, k * 3) * 1.3);
      _q2.setFromEuler(_e);
      _q.multiply(_q2);
      _v.set(d.x, -Math.max(0, k - 0.35) * 2.2, d.z);
      const sc = d.scale || 1;
      _s.set(sc, sc, sc);
      _base.compose(_v, _q, _s);
      _c.setScalar(1 - k * 0.7);
      const animState = { phase: d.phase, move: 0, atk: -1, cast: -1, special: -1, t: d.seed, seed: d.seed, anim: type.rig.anim };
      this.writeInstance(type, animState, _c, type.count++);
    }
    for (const t of this.types.values()) {
      for (const b of t.batches) {
        b.mesh.count = t.count;
        if (t.count) {
          b.mesh.instanceMatrix.needsUpdate = true;
          b.mesh.instanceColor.needsUpdate = true;
        }
      }
    }
    this.rings.count = ringCount;
    if (ringCount) { this.rings.instanceMatrix.needsUpdate = true; this.rings.instanceColor.needsUpdate = true; }
    if (frame % 60 === 0) {
      for (const [id, st] of this.state) if (frame - st.seen > 30) this.state.delete(id);
    }
  }

  dispose() {
    for (const t of this.types.values()) {
      for (const b of t.batches) { this.scene.remove(b.mesh); b.mesh.material.dispose(); b.mesh.dispose(); b.geo.dispose(); }
    }
    this.scene.remove(this.rings);
    this.rings.dispose();
    this.types.clear();
  }
}
