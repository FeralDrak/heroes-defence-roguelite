// Main 3D renderer: scene, camera, lights and all visual sub-systems.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ARENAS } from '../core/data/arenas.js';
import { UF } from '../core/constants.js';
import { ArenaView } from './arena.js';
import { MonsterInstancer } from './monsters.js';
import { UnitViews } from './units.js';
import { ProjectileRenderer } from './projectiles.js';
import { AreaRenderer } from './areas.js';
import { PickupRenderer } from './pickups.js';
import { FxSystem, fxColor } from './fx.js';
import { Overlay } from './overlay.js';

export class GameRenderer {
  constructor(container, world, session, settings) {
    this.container = container;
    this.world = world;
    this.session = session;
    this.settings = settings;
    const q = { low: 0, medium: 1, high: 2 }[settings.quality] ?? 1;
    this.quality = q;
    const renderer = new THREE.WebGLRenderer({ antialias: q >= 1, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q >= 2 ? 2 : q >= 1 ? 1.5 : 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = q >= 1;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = 'game-canvas';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const arena = ARENAS[world.info.arena] || ARENAS.colosseum;
    this.arenaDef = arena;
    const pal = arena.palette;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(pal.fog);
    scene.fog = new THREE.Fog(pal.fog, 45, 95);
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 220);
    this.camTarget = new THREE.Vector3(0, 0, 0);
    this.zoom = 0.88;

    const hemi = new THREE.HemisphereLight(pal.sky, pal.ground, 0.9 * pal.ambient + 0.45);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(pal.light, 1.55);
    sun.position.set(-18, 40, 14);
    sun.castShadow = q >= 1;
    if (sun.castShadow) {
      const s = q >= 2 ? 2048 : 1024;
      sun.shadow.mapSize.set(s, s);
      const cam = sun.shadow.camera;
      cam.left = -36; cam.right = 36; cam.top = 36; cam.bottom = -36; cam.near = 5; cam.far = 90;
      sun.shadow.bias = -0.0006;
      sun.shadow.normalBias = 0.03;
    }
    scene.add(sun);
    this.sun = sun;
    this.heroLight = new THREE.PointLight(0xfff0d8, 30, 16, 1.4);
    this.heroLight.position.set(0, 4, 0);
    scene.add(this.heroLight);

    this.arena = new ArenaView(scene, arena, q);
    this.fx = new FxSystem(scene, q);
    this.monsters = new MonsterInstancer(scene, q);
    this.units = new UnitViews(scene, q);
    this.projectiles = new ProjectileRenderer(scene, this.fx);
    this.areas = new AreaRenderer(scene, this.fx);
    this.pickups = new PickupRenderer(scene, this.fx);

    const oc = document.createElement('canvas');
    oc.className = 'overlay-canvas';
    container.appendChild(oc);
    this.overlay = new Overlay(oc);
    this.overlay.settings.damageNumbers = settings.damageNumbers !== false;
    this.overlay.settings.allyNumbers = settings.allyNumbers !== false;

    if (q >= 2 && settings.bloom !== false) {
      this.composer = new EffectComposer(renderer);
      this.composer.addPass(new RenderPass(scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.82);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }

    this.raycaster = new THREE.Raycaster();
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.mouseNdc = new THREE.Vector2();
    this.shake = 0;

    this.offEvent = world.onEvent((ev) => this.onEvent(ev));
    this.offDmg = world.onDamage((d) => this.onDamage(d));
    this.resize();
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.overlay.resize(w, h, window.devicePixelRatio || 1);
    if (this.composer) this.composer.setSize(w, h);
    const scale = h / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.fx.setScale(scale);
    this.projectiles.setScale(scale);
    this.w = w; this.h = h;
  }

  // ---------------------------------------------------------------------------
  unitPos(id) {
    const hp = this.units.headPos(id);
    if (hp) return hp;
    const u = this.world.units.get(id);
    if (!u) return null;
    return { x: u.x, y: 1.6 * (u.scale || 1) + 0.4, z: u.z };
  }

  onDamage(d) {
    this.overlay.addDamage(d, this.world, this.session.pid, (id) => this.unitPos(id));
    const u = this.world.units.get(d.id);
    if (u && !(d.flags & 32) && !(d.flags & 16) && d.amount > 0) {
      const c = (d.flags & 128) ? 0xffe0a0 : 0xff3030;
      this.fx.burst(u.x, 1.0, u.z, (d.flags & 8) ? 6 : 2, c, { speed: 3, life: 0.25, size: 0.35, g: 6 });
    }
  }

  onEvent(ev) {
    const fx = this.fx;
    if (ev.e === 'death') {
      if (ev.boss) {
        fx.burst(ev.x, 2, ev.z, 80, 0xffd24a, { speed: 10, life: 1.4, size: 1.2, up: 2 });
        this.addShake(1);
      } else if (ev.hero) {
        fx.burst(ev.x, 1, ev.z, 30, 0xff3030, { speed: 5, life: 1, size: 0.8 });
      } else if (ev.ally) {
        fx.burst(ev.x, 1, ev.z, 12, 0xb080ff, { speed: 3, life: 0.6, size: 0.6 });
      } else {
        this.monsters.onDeath(ev.u);
        fx.burst(ev.x, 0.8, ev.z, ev.elite ? 24 : 7, ev.elite ? 0xffb030 : 0x9a1010, { speed: ev.elite ? 6 : 3, life: 0.6, size: ev.elite ? 0.8 : 0.5, g: 8 });
      }
      return;
    }
    if (ev.e === 'gate') { this.arena.flashGate(ev.i); return; }
    if (ev.e !== 'fx') return;
    switch (ev.t) {
      case 'slash': fx.slash(ev); break;
      case 'nova': fx.nova(ev); break;
      case 'boom': fx.boom(ev); if ((ev.r || 0) >= 4) this.addShake(0.25); break;
      case 'chain': fx.chain(ev); break;
      case 'zap': fx.zap(ev); break;
      case 'beam': fx.beam(ev, this.world, this.units); break;
      case 'blink': {
        const c = fxColor(ev.c);
        fx.burst(ev.x1, 1, ev.z1, 16, c, { speed: 4, life: 0.5, size: 0.6 });
        fx.burst(ev.x2, 1, ev.z2, 16, c, { speed: 4, life: 0.5, size: 0.6 });
        break;
      }
      case 'heal': case 'potion': {
        const p = this.unitPos(ev.u);
        if (p) fx.burst(p.x, 1, p.z, 18, ev.t === 'potion' ? 0xff5a6a : 0x6dff7a, { speed: 2, life: 0.9, size: 0.6, g: -2, up: 1.5 });
        break;
      }
      case 'lvl': {
        const p = this.unitPos(ev.u);
        if (p) {
          fx.ringBurst(p.x, p.z, 2.5, 30, 0xffd24a, { life: 0.8, y: 0.3 });
          fx.burst(p.x, 1, p.z, 30, 0xffe9a8, { speed: 2, life: 1.2, size: 0.6, g: -3, up: 2 });
          this.overlay.addText(p.x, p.y + 0.5, p.z, 'NIVEAU !', '#ffd24a', 18);
        }
        break;
      }
      case 'revive': {
        const p = this.unitPos(ev.u);
        if (p) fx.burst(p.x, 1, p.z, 40, 0xffe9a8, { speed: 3, life: 1.2, size: 0.8, g: -3, up: 2 });
        break;
      }
      case 'summon': fx.burst(ev.x, 0.3, ev.z, 14, fxColor(ev.c || 'shadow'), { speed: 2, life: 0.8, size: 0.6, g: -3, up: 2 }); break;
      case 'meteor': fx.meteor(ev); break;
      case 'lob': fx.lob(ev); break;
      case 'leap': this.units.onLeap(ev); break;
      case 'spikes': fx.spikes(ev); break;
      case 'breath': fx.breath(ev); break;
      case 'ring': fx.ring(ev); break;
      case 'pillar': fx.pillar(ev); this.addShake(0.3); break;
      case 'shake': this.addShake(ev.s || 0.5); break;
      case 'dash': {
        const u = this.world.units.get(ev.u);
        if (u) fx.burst(u.x, 0.8, u.z, 10, fxColor(ev.c), { speed: 2, life: 0.4, size: 0.5 });
        break;
      }
      case 'shield': {
        const p = this.unitPos(ev.u);
        if (p) fx.burst(p.x, 1.2, p.z, 14, 0xffe066, { speed: 2.5, life: 0.6, size: 0.5 });
        break;
      }
      case 'mark': {
        const p = this.unitPos(ev.u);
        if (p) fx.burst(p.x, p.y, p.z, 12, 0xb070ff, { speed: 2, life: 0.6, size: 0.6 });
        break;
      }
      case 'spiral': fx.spiral(ev, this.units); break;
      case 'gold': fx.burst(ev.x, 1, ev.z, ev.big ? 40 : 12, 0xffd24a, { speed: 4, life: 0.8, size: 0.5, up: 2 }); break;
      case 'chest': fx.burst(ev.x, 1, ev.z, 40, ev.tier === 'cursed' ? 0xb050ff : 0xffd24a, { speed: 5, life: 1, size: 0.7, up: 2 }); break;
      case 'spark': fx.burst(ev.x, 1, ev.z, 3, fxColor(ev.c), { speed: 2, life: 0.2, size: 0.35 }); break;
      case 'block': fx.burst(ev.x, 1, ev.z, 6, 0xffffff, { speed: 3, life: 0.25, size: 0.4 }); break;
      case 'text': {
        const p = this.unitPos(ev.u);
        if (p) this.overlay.addText(p.x, p.y + 0.3, p.z, ev.s, ev.c || '#fff', 15);
        break;
      }
      default: break;
    }
  }

  addShake(s) {
    if (this.settings.shake === false) return;
    this.shake = Math.min(1.2, this.shake + s);
  }

  // ---------------------------------------------------------------------------
  setMouse(x, y) {
    this.mouseNdc.set((x / this.w) * 2 - 1, -(y / this.h) * 2 + 1);
  }

  mouseGround() {
    this.raycaster.setFromCamera(this.mouseNdc, this.camera);
    const out = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.ground, out)) return null;
    return { x: out.x, z: out.z };
  }

  render(dt, now, controller, ui) {
    const world = this.world;
    const localPid = this.session.pid;
    const localHeroId = world.heroIdOf(localPid);
    const hv = world.units.get(localHeroId);
    // camera follow
    let tx = 0, tz = 0;
    if (controller && controller.ready) { tx = controller.x; tz = controller.z; }
    else if (hv) { tx = hv.x; tz = hv.z; }
    if (ui.zoomDelta) this.zoom = Math.max(0.65, Math.min(1.35, this.zoom + ui.zoomDelta * 0.06));
    if (ui.aim && controller) {
      const lx = (controller.ax - tx) * 0.12, lz = (controller.az - tz) * 0.12;
      const ll = Math.hypot(lx, lz);
      const lim = 3;
      tx += ll > lim ? (lx / ll) * lim : lx;
      tz += ll > lim ? (lz / ll) * lim : lz;
    }
    const k = 1 - Math.exp(-dt * 8);
    this.camTarget.x += (tx - this.camTarget.x) * k;
    this.camTarget.z += (tz - this.camTarget.z) * k;
    const z = this.zoom;
    let sx = 0, sy = 0;
    if (this.shake > 0) {
      sx = (Math.random() - 0.5) * this.shake * 0.8;
      sy = (Math.random() - 0.5) * this.shake * 0.8;
      this.shake = Math.max(0, this.shake - dt * 2.2);
    }
    this.camera.position.set(this.camTarget.x + sx, 25 * z + sy, this.camTarget.z + 15.5 * z);
    this.camera.lookAt(this.camTarget.x + sx, 0, this.camTarget.z - 0.5);
    this.heroLight.position.set(tx, 6.2, tz);
    this.sun.position.set(this.camTarget.x - 18, 40, this.camTarget.z + 14);
    this.sun.target.position.set(this.camTarget.x, 0, this.camTarget.z);
    this.sun.target.updateMatrixWorld();

    const phase = this.session.gs ? this.session.gs.phase : 'prep';
    this.arena.update(dt, now, phase);
    this.arena.updateOcclusion(dt, world, controller && controller.ready ? controller : hv);
    this.monsters.update(world, dt, now);
    this.units.update(world, controller, dt, now, localPid);
    this.projectiles.update(world, dt, now);
    this.areas.update(world, this.units, controller, localHeroId, now, dt);
    this.pickups.update(world, now);
    this.fx.updateOrbits(world, this.units, now);
    this.fx.update(dt);

    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);

    this.overlay.draw({
      camera: this.camera, world, unitViews: this.units, controller, localPid, session: this.session,
      showLoot: ui.showLoot, prompt: ui.prompt, hoverId: ui.hoverId, dt, showOwnName: false,
    });
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    if (this.offEvent) this.offEvent();
    if (this.offDmg) this.offDmg();
    this.monsters.dispose();
    this.units.dispose();
    this.projectiles.dispose();
    this.areas.dispose();
    this.pickups.dispose();
    this.fx.dispose();
    this.arena.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    if (this.overlay.canvas.parentNode) this.overlay.canvas.parentNode.removeChild(this.overlay.canvas);
  }
}

export { UF };
