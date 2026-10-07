// Geometry / material caches, rig -> THREE objects, and procedural animation poses.
import * as THREE from 'three';

const geoCache = new Map();
const matCache = new Map();

export function geometry(g) {
  const key = JSON.stringify(g);
  let geo = geoCache.get(key);
  if (geo) return geo;
  const [type, a, b, c, d, e] = g;
  switch (type) {
    case 'box': geo = new THREE.BoxGeometry(a, b, c); break;
    case 'sphere': geo = new THREE.IcosahedronGeometry(a, 1); break;
    case 'cyl': geo = new THREE.CylinderGeometry(a, b, c, d || 8); break;
    case 'cone': geo = new THREE.ConeGeometry(a, b, c || 8); break;
    case 'torus': geo = new THREE.TorusGeometry(a, b, c || 6, d || 16, e ?? Math.PI * 2); break;
    case 'octa': geo = new THREE.OctahedronGeometry(a, 0); break;
    case 'dodeca': geo = new THREE.DodecahedronGeometry(a, 0); break;
    default: geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  }
  geoCache.set(key, geo);
  return geo;
}

export function material(color, emissive = 0, opacity = 1, opts = {}) {
  const key = `${color}|${emissive}|${opacity}|${opts.white ? 1 : 0}`;
  let m = matCache.get(key);
  if (m) return m;
  m = new THREE.MeshLambertMaterial({
    color: opts.white ? 0xffffff : color,
    emissive: emissive || 0x000000,
    emissiveIntensity: emissive ? 0.9 : 0,
    transparent: opacity < 1,
    opacity,
    flatShading: true,
    depthWrite: opacity >= 1,
  });
  matCache.set(key, m);
  return m;
}

const tmpEuler = new THREE.Euler();
const tmpQuat = new THREE.Quaternion();
const tmpVec = new THREE.Vector3();
const tmpScale = new THREE.Vector3();

/** Local matrix of a piece relative to its part pivot */
export function pieceLocalMatrix(piece, pivot) {
  const m = new THREE.Matrix4();
  const r = piece.r || [0, 0, 0];
  const s = piece.s || [1, 1, 1];
  tmpEuler.set(r[0], r[1], r[2]);
  tmpQuat.setFromEuler(tmpEuler);
  tmpVec.set(piece.p[0] - pivot[0], piece.p[1] - pivot[1], piece.p[2] - pivot[2]);
  tmpScale.set(s[0], s[1], s[2]);
  m.compose(tmpVec, tmpQuat, tmpScale);
  return m;
}

/** Merge pieces of one part into a single non-indexed geometry with baked vertex colors */
export function mergePieces(part, pieces) {
  let total = 0;
  const geos = pieces.map((piece) => {
    let g = geometry(piece.g).clone();
    if (g.index) g = g.toNonIndexed();
    g.applyMatrix4(pieceLocalMatrix(piece, part.pivot));
    total += g.attributes.position.count;
    return { g, color: new THREE.Color(piece.c) };
  });
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let o = 0;
  for (const { g, color } of geos) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    for (let i = 0; i < n; i++) { col[(o + i) * 3] = color.r; col[(o + i) * 3 + 1] = color.g; col[(o + i) * 3 + 2] = color.b; }
    o += n;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

/** Group a part's pieces by material class (emissive color, opacity) */
export function pieceGroups(part) {
  const groups = new Map();
  for (const piece of part.pieces) {
    const key = `${piece.e || 0}|${piece.o ?? 1}`;
    if (!groups.has(key)) groups.set(key, { emissive: piece.e || 0, opacity: piece.o ?? 1, pieces: [] });
    groups.get(key).pieces.push(piece);
  }
  return [...groups.values()];
}

/**
 * Build a THREE.Group hierarchy from a rig (individually rendered units).
 * Each part is one group; its pieces are merged per material class (few draw calls per unit).
 * Materials are per unit so they can be tinted (material.color multiplies the vertex colors).
 */
const mergedCache = new Map();

export function buildGroup(rig, opts = {}) {
  const root = new THREE.Group();
  const inner = new THREE.Group(); // receives whole-body poses (downed, leap)
  root.add(inner);
  const parts = new Map();
  const meshes = [];
  let cache = opts.cacheKey ? mergedCache.get(opts.cacheKey) : null;
  const fill = opts.cacheKey && !cache;
  if (fill) cache = [];
  let gi = 0;
  for (const part of rig.parts) {
    const pg = new THREE.Group();
    pg.position.set(part.pivot[0], part.pivot[1], part.pivot[2]);
    pg.userData.pivot = part.pivot;
    for (const grp of pieceGroups(part)) {
      let geo;
      if (cache && !fill) geo = cache[gi];
      else {
        geo = mergePieces(part, grp.pieces);
        if (fill) cache.push(geo);
      }
      gi++;
      const mat = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        vertexColors: true,
        emissive: grp.emissive || 0,
        emissiveIntensity: grp.emissive ? 0.9 : 0,
        transparent: grp.opacity < 1,
        opacity: grp.opacity,
        depthWrite: grp.opacity >= 1,
        flatShading: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = !!opts.shadows && grp.opacity >= 1;
      mesh.userData.baseEmissive = new THREE.Color(grp.emissive || 0);
      mesh.userData.baseOpacity = grp.opacity;
      mesh.userData.ownGeometry = !opts.cacheKey;
      pg.add(mesh);
      meshes.push(mesh);
    }
    inner.add(pg);
    parts.set(part.role, pg);
  }
  if (fill) mergedCache.set(opts.cacheKey, cache);
  return { root, inner, parts, meshes, rig };
}

/**
 * Pose for one role. s: { phase, move, atk, cast, t, seed, anim, special }
 * out: { rx, ry, rz, ty, sy }
 */
export function poseRole(role, s, out) {
  out.rx = 0; out.ry = 0; out.rz = 0; out.ty = 0; out.sy = 1;
  const sin = Math.sin(s.phase);
  const mv = s.move;
  switch (role) {
    case 'legL': out.rz = sin * 0.65 * mv; break;
    case 'legR': out.rz = -sin * 0.65 * mv; break;
    case 'armL':
      out.rz = -sin * 0.45 * mv;
      if (s.cast >= 0) out.rz = castCurve(s.cast) * 1.5;
      if (s.special >= 0) out.rz = 0.6 + Math.sin(s.t * 18) * 0.3;
      break;
    case 'armR':
      out.rz = sin * 0.45 * mv;
      if (s.atk >= 0) out.rz = attackCurve(s.atk);
      else if (s.cast >= 0) out.rz = castCurve(s.cast) * 1.6;
      if (s.special >= 0) out.rz = 0.6 + Math.sin(s.t * 18 + 1) * 0.3;
      break;
    case 'body':
      out.ty = Math.abs(sin) * 0.06 * mv;
      out.rz = -0.08 * mv;
      if (s.atk >= 0 && s.atk > 0.45 && s.atk < 0.8) out.rz = -0.2;
      break;
    case 'head': out.ty = Math.abs(sin) * 0.05 * mv; break;
    case 'wingL': out.rx = Math.sin(s.t * 14 + s.seed) * 0.75; break;
    case 'wingR': out.rx = -Math.sin(s.t * 14 + s.seed) * 0.75; break;
    case 'float': out.ty = Math.sin(s.t * 2.4 + s.seed) * 0.14; break;
    case 'spin': out.ry = s.t * 1.4; out.ty = Math.sin(s.t * 2 + s.seed) * 0.1; break;
    case 'slime': {
      const b = Math.sin(s.t * 6 + s.seed);
      out.sy = 1 + b * (0.1 + 0.12 * mv);
      out.ty = Math.max(0, b) * 0.1 * mv;
      break;
    }
    default:
      if (role.startsWith('tentacle')) {
        const i = +role.slice(8);
        out.rx = Math.sin(s.t * 1.6 + i * 1.3) * 0.35;
        out.rz = Math.cos(s.t * 1.3 + i) * 0.35;
      }
      break;
  }
  if (s.anim === 'spider' && (role === 'legL' || role === 'legR')) {
    out.rz = 0;
    out.ry = (role === 'legL' ? 1 : -1) * Math.sin(s.phase * 1.6) * 0.35 * mv;
    out.rx = Math.abs(Math.cos(s.phase * 1.6)) * 0.15 * mv;
  }
  if (s.anim === 'floatHumanoid' && role === 'body') out.ty = 0.25 + Math.sin(s.t * 2) * 0.1;
  return out;
}

export function attackCurve(k) {
  if (k < 0.5) return 2.6 * easeOut(k / 0.5);
  if (k < 0.7) return 2.6 - 2.9 * ((k - 0.5) / 0.2);
  return -0.3 * (1 - (k - 0.7) / 0.3);
}

function castCurve(k) {
  if (k < 0.3) return easeOut(k / 0.3);
  if (k < 0.75) return 1;
  return 1 - (k - 0.75) / 0.25;
}

function easeOut(x) { return 1 - (1 - x) * (1 - x); }

const poseOut = { rx: 0, ry: 0, rz: 0, ty: 0, sy: 1 };

/** Apply poses to a built group */
export function poseGroup(built, s) {
  const isSpiderLike = built.rig.anim === 'spider';
  for (const [role, pg] of built.parts) {
    poseRole(role, s, poseOut);
    const pv = pg.userData.pivot;
    pg.rotation.set(poseOut.rx, poseOut.ry, poseOut.rz);
    pg.position.set(pv[0], pv[1] + poseOut.ty, pv[2]);
    pg.scale.set(1, poseOut.sy, 1);
    if (isSpiderLike && role === 'body') pg.position.y += Math.abs(Math.sin(s.phase * 1.6)) * 0.04 * s.move;
  }
}

export { poseOut };
