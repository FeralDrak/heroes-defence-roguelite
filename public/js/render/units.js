// Individually rendered units: heroes, bosses, summons, structures.
import * as THREE from 'three';
import { getRig, BOSS_SCALE } from './rigs.js';
import { buildGroup, poseGroup } from './models.js';
import { UF, ANIM, PLAYER_COLORS } from '../core/constants.js';

const TINTS = {
  frozen: new THREE.Color(0x9fe0ff), burn: new THREE.Color(0xff9a50), poison: new THREE.Color(0x9cff70),
  shock: new THREE.Color(0xfff27a), curse: new THREE.Color(0xc080ff),
};
const WHITE = new THREE.Color(0xffffff);
const tmpC = new THREE.Color();

export class UnitViews {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.views = new Map();
    this.bubbleGeo = new THREE.IcosahedronGeometry(1, 2);
    this.ringGeo = new THREE.RingGeometry(0.62, 0.78, 32);
    this.ringGeo.rotateX(-Math.PI / 2);
  }

  create(u, world) {
    const rig = getRig(u.visName);
    const built = buildGroup(rig, { shadows: this.quality >= 1, cacheKey: u.visName });
    const root = built.root;
    const view = {
      id: u.id, built, rig, kind: u.kind, visName: u.visName,
      st: { phase: 0, move: 0, atk: -1, cast: -1, special: -1, seed: Math.random() * 10, px: u.x, pz: u.z },
      tintKey: '',
      leap: null,
      baseScale: BOSS_SCALE[u.visName] || 1,
    };
    // bubble (shield / invulnerability)
    const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
    view.bubble = new THREE.Mesh(this.bubbleGeo, bubbleMat);
    view.bubble.scale.setScalar(rig.h * 0.6);
    view.bubble.position.y = rig.h * 0.5;
    view.bubble.visible = false;
    root.add(view.bubble);
    if (u.kind === 'hero') {
      const pid = world.pidOfUnit(u.id);
      const color = PLAYER_COLORS[(pid >= 0 ? pid : 0) % PLAYER_COLORS.length];
      const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
      ring.position.y = 0.04;
      root.add(ring);
      view.ring = ring;
    }
    if (u.kind === 'summon' || u.kind === 'structure') {
      const info = world.infos.get(u.id);
      const pid = info && info.o !== undefined ? info.o : 0;
      const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: PLAYER_COLORS[pid % PLAYER_COLORS.length], transparent: true, opacity: 0.45, depthWrite: false }));
      ring.position.y = 0.035;
      ring.scale.setScalar(u.visName === 'sum_golem' || u.visName === 'sum_infernal' ? 1.6 : 0.85);
      root.add(ring);
      view.ring = ring;
      view.summonRing = true;
    }
    if (u.kind === 'boss') {
      root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    }
    this.scene.add(root);
    this.views.set(u.id, view);
    return view;
  }

  onLeap(ev) {
    const v = this.views.get(ev.u);
    if (v) v.leap = { t: 0, d: ev.d || 0.5, h: Math.min(4, 1 + Math.hypot(ev.x2 - ev.x1, ev.z2 - ev.z1) * 0.3) };
  }

  /** Trigger a predicted animation on the local hero */
  localCast(heroId, slot) {
    const v = this.views.get(heroId);
    if (!v) return;
    if (slot === 0) v.st.atk = 0;
    else if (slot !== 5) v.st.cast = 0;
    v.st.localUntil = performance.now() / 1000 + 0.25;
  }

  update(world, controller, dt, now, localPid) {
    const localHeroId = world.heroIdOf(localPid);
    const seen = new Set();
    for (const u of world.units.values()) {
      if (u.kind === 'monster' || u.kind === 'none') continue;
      let v = this.views.get(u.id);
      if (!v) v = this.create(u, world);
      seen.add(u.id);
      const root = v.built.root;
      const st = v.st;
      let x = u.x, z = u.z, rot = u.rot, y = 0;
      const isLocal = u.id === localHeroId && controller && controller.ready;
      if (isLocal) {
        x = controller.x; z = controller.z; y = controller.height;
        rot = Math.atan2(controller.az - z, controller.ax - x);
      }
      if (v.leap) {
        v.leap.t += dt;
        const k = Math.min(1, v.leap.t / v.leap.d);
        if (!isLocal) y = Math.sin(k * Math.PI) * v.leap.h;
        if (k >= 1) v.leap = null;
      }
      // motion for walk cycle
      const dx = x - st.px, dz = z - st.pz;
      const sp = dt > 0 ? Math.hypot(dx, dz) / dt : 0;
      st.px = x; st.pz = z;
      const moving = isLocal ? controller.moving : sp > 0.5;
      st.move += ((moving ? 1 : 0) - st.move) * Math.min(1, dt * 10);
      st.phase += Math.min(sp, 14) * dt * 2.2;
      if (u.animTrigger) {
        u.animTrigger = false;
        const recentLocal = st.localUntil && now < st.localUntil;
        if (!recentLocal) {
          if (u.animState === ANIM.ATTACK) st.atk = 0;
          else if (u.animState === ANIM.CAST) st.cast = 0;
          else if (u.animState === ANIM.SPECIAL || u.animState === ANIM.CHANNEL) st.special = 0;
        }
      }
      if (st.atk >= 0) { st.atk += dt / 0.42; if (st.atk > 1) st.atk = -1; }
      if (st.cast >= 0) { st.cast += dt / 0.6; if (st.cast > 1) st.cast = -1; }
      if (st.special >= 0) { st.special += dt / 0.9; if (st.special > 1) st.special = -1; }
      const channel = u.animState === ANIM.CHANNEL;
      const f = u.flags || 0;
      const downed = !!(f & UF.DOWN);
      const frozen = !!(f & (UF.FROZEN | UF.STUN));
      poseGroup(v.built, {
        phase: st.phase, move: frozen || downed ? 0 : st.move, atk: st.atk, cast: channel ? 0.5 : st.cast,
        special: st.special, t: frozen ? st.seed : now, seed: st.seed, anim: v.rig.anim,
      });
      // whirlwind spin for warrior buff (special visual handled by fx), titan scale via u.scale
      const sc = (u.scale || 1) * v.baseScale;
      root.position.set(x, y, z);
      root.rotation.y = -rot;
      root.scale.setScalar(sc);
      // downed: lie on the ground
      const inner = v.built.inner;
      if (downed) {
        inner.rotation.z = -Math.PI / 2;
        inner.position.y = 0.3;
      } else {
        inner.rotation.z = 0;
        inner.position.y = 0;
      }
      if (u.kind === 'structure' && u.visName === 'tur_drone') inner.position.y = 0;
      // spawning (summons / bosses rising)
      if (f & UF.SPAWNING) {
        const k = Math.min(1, (now - (v.bornAt || (v.bornAt = now))) / (u.kind === 'boss' ? 2.2 : 0.4));
        root.position.y -= (1 - k) * (u.kind === 'boss' ? 4 : 1.2);
      }
      // bubble
      const invuln = !!(f & UF.INVULN), shield = !!(f & UF.SHIELD);
      v.bubble.visible = (invuln || shield) && !downed;
      if (v.bubble.visible) {
        v.bubble.material.color.set(invuln ? 0xffffff : u.kind === 'boss' ? 0x66ccff : 0xffe066);
        v.bubble.material.opacity = 0.16 + Math.sin(now * 6) * 0.05;
      }
      // tint & transparency
      const flash = u.flashUntil && u.flashUntil > now;
      const stealth = !!(f & UF.STEALTH);
      let tint = null, tk = 0;
      if (f & UF.FROZEN) { tint = 'frozen'; tk = 0.7; }
      else if (f & UF.CHILL) { tint = 'frozen'; tk = 0.3; }
      else if (f & UF.BURN) { tint = 'burn'; tk = 0.3; }
      else if (f & UF.POISON) { tint = 'poison'; tk = 0.3; }
      else if (f & UF.SHOCK) { tint = 'shock'; tk = 0.3; }
      else if (f & UF.CURSE) { tint = 'curse'; tk = 0.3; }
      const ghost = u.visName === 'sum_decoy' || u.visName === 'sum_twin';
      const key = `${tint}|${flash ? 1 : 0}|${stealth ? 1 : 0}|${downed ? 1 : 0}`;
      if (key !== v.tintKey) {
        v.tintKey = key;
        for (const m of v.built.meshes) {
          const mat = m.material;
          // material.color multiplies the baked vertex colors
          tmpC.copy(WHITE);
          if (tint) tmpC.lerp(TINTS[tint], tk);
          if (downed) tmpC.multiplyScalar(0.45);
          mat.color.copy(tmpC);
          const op = ghost ? 0.45 : stealth ? Math.min(0.35, m.userData.baseOpacity) : m.userData.baseOpacity;
          const wasTransparent = mat.transparent;
          mat.opacity = op;
          mat.transparent = op < 1;
          mat.depthWrite = op >= 1;
          mat.emissive.copy(m.userData.baseEmissive);
          if (flash) { const fl = u.kind === 'boss' || u.kind === 'hero' ? 0.38 : 0.6; mat.emissive.setRGB(fl, fl, fl); }
          else if (ghost) mat.emissive.setRGB(0.3, 0.3, 0.3);
          mat.emissiveIntensity = flash || ghost || m.userData.baseEmissive.getHex() ? 0.9 : 0;
          if (wasTransparent !== mat.transparent) mat.needsUpdate = true;
        }
      }
      if (v.ring && !v.summonRing) {
        v.ring.material.opacity = downed ? 0.3 : 0.8;
        v.ring.scale.setScalar(1 / Math.max(0.5, sc / v.baseScale));
      }
    }
    for (const [id, v] of this.views) {
      if (!seen.has(id)) {
        this.scene.remove(v.built.root);
        v.built.root.traverse((o) => {
          if (!o.isMesh) return;
          if (o.material) o.material.dispose();
          if (o.userData.ownGeometry) o.geometry.dispose();
        });
        v.bubble.material.dispose();
        if (v.ring) v.ring.material.dispose();
        this.views.delete(id);
      }
    }
  }

  /** world position (top of head) for overlays */
  headPos(id) {
    const v = this.views.get(id);
    if (!v) return null;
    const r = v.built.root;
    return { x: r.position.x, y: r.position.y + v.rig.h * r.scale.y + 0.3, z: r.position.z };
  }

  dispose() {
    for (const v of this.views.values()) this.scene.remove(v.built.root);
    this.views.clear();
  }
}
