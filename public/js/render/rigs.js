// Procedural model specs ("rigs"). Models face +X, up is +Y, right side is +Z.
// A rig: { parts: [{ role, pivot:[x,y,z], pieces:[{ g:[type,...args], c:color, e:emissive, o:opacity, p:[x,y,z], r:[x,y,z], s:[x,y,z] }] }], h: height, anim }

const P = (g, c, p, extra = {}) => Object.assign({ g, c, p }, extra);

function limbs(o) {
  const legH = o.legH ?? 0.85, legW = o.legW ?? 0.18, hipZ = o.hipZ ?? 0.15;
  const shoulderY = o.shoulderY ?? 1.38, shoulderZ = o.shoulderZ ?? 0.36, armL = o.armLen ?? 0.58, armW = o.armW ?? 0.14;
  return {
    legL: { role: 'legL', pivot: [0, legH, -hipZ], pieces: [P(['box', legW, legH, legW], o.leg, [0, legH / 2, -hipZ]), ...(o.boot ? [P(['box', legW * 1.5, 0.14, legW * 1.15], o.boot, [0.03, 0.07, -hipZ])] : [])] },
    legR: { role: 'legR', pivot: [0, legH, hipZ], pieces: [P(['box', legW, legH, legW], o.leg, [0, legH / 2, hipZ]), ...(o.boot ? [P(['box', legW * 1.5, 0.14, legW * 1.15], o.boot, [0.03, 0.07, hipZ])] : [])] },
    armL: { role: 'armL', pivot: [0, shoulderY, -shoulderZ], pieces: [P(['box', armW, armL, armW], o.arm, [0, shoulderY - armL / 2, -shoulderZ]), ...(o.hand ? [P(['sphere', armW * 0.62], o.hand, [0, shoulderY - armL - 0.02, -shoulderZ])] : [])] },
    armR: { role: 'armR', pivot: [0, shoulderY, shoulderZ], pieces: [P(['box', armW, armL, armW], o.arm, [0, shoulderY - armL / 2, shoulderZ]), ...(o.hand ? [P(['sphere', armW * 0.62], o.hand, [0, shoulderY - armL - 0.02, shoulderZ])] : [])] },
  };
}

/** Generic humanoid. o: colors + extras: { body, leg, arm, head, ...; extraBody, extraHead, extraArmR, extraArmL } */
export function humanoid(o) {
  const L = limbs(o);
  const torsoY = o.torsoY ?? 1.15, torsoH = o.torsoH ?? 0.6;
  const headY = o.headY ?? 1.66, headR = o.headR ?? 0.2;
  const parts = [
    { role: 'body', pivot: [0, 0.85, 0], pieces: [
      P(['box', o.torsoW ?? 0.36, torsoH, o.torsoD ?? 0.56], o.body, [0, torsoY, 0]),
      ...(o.belt ? [P(['box', 0.38, 0.1, 0.58], o.belt, [0, torsoY - torsoH / 2 + 0.05, 0])] : []),
      ...(o.extraBody || []),
    ] },
    { role: 'head', pivot: [0, 1.45, 0], pieces: [
      ...(o.noHead ? [] : [P(['sphere', headR], o.head, [0, headY, 0])]),
      ...(o.extraHead || []),
    ] },
    { ...L.legL, pieces: [...L.legL.pieces, ...(o.extraLegL || [])] },
    { ...L.legR, pieces: [...L.legR.pieces, ...(o.extraLegR || [])] },
    { ...L.armL, pieces: [...L.armL.pieces, ...(o.extraArmL || [])] },
    { ...L.armR, pieces: [...L.armR.pieces, ...(o.extraArmR || [])] },
    ...(o.extraParts || []),
  ];
  if (o.robe) {
    // robe replaces legs visually: cone skirt attached to body
    parts[0].pieces.push(P(['cyl', 0.28, o.robeBottom ?? 0.5, 0.95, 10], o.robe, [0, 0.47, 0]));
  }
  return { parts, h: o.h ?? 2.0, anim: o.anim || 'humanoid' };
}

// Weapon pieces held in the right hand (arm hangs along -Y from shoulder at z = +0.36)
const HAND_Y = 0.78;
function sword(z = 0.36, blade = 0xc9d0d8, hilt = 0x6b4a2b, len = 0.9) {
  return [
    P(['box', 0.08, 0.22, 0.08], hilt, [0.05, HAND_Y, z]),
    P(['box', 0.1, 0.05, 0.3], 0xb08a3a, [0.12, HAND_Y + 0.05, z]),
    P(['box', len, 0.07, 0.13], blade, [0.12 + len / 2, HAND_Y + 0.05, z], { r: [0, 0, 0.15] }),
  ];
}
function axe(z = 0.36) {
  return [
    P(['cyl', 0.04, 0.04, 1.3, 6], 0x5e3f22, [0.35, HAND_Y + 0.1, z], { r: [0, 0, -Math.PI / 2 + 0.25] }),
    P(['box', 0.42, 0.5, 0.06], 0xc9d0d8, [0.92, HAND_Y + 0.32, z]),
    P(['box', 0.12, 0.12, 0.08], 0x8a6a3a, [0.9, HAND_Y + 0.25, z]),
  ];
}
function hammer(z = 0.36, head = 0xd9c27a) {
  return [
    P(['cyl', 0.045, 0.045, 1.1, 6], 0x6b4a2b, [0.32, HAND_Y + 0.08, z], { r: [0, 0, -Math.PI / 2 + 0.3] }),
    P(['box', 0.36, 0.3, 0.3], head, [0.82, HAND_Y + 0.22, z]),
  ];
}
function staff(z = 0.36, orb = 0x8ad8ff, wood = 0x5a3a22, orbE = null) {
  return [
    P(['cyl', 0.035, 0.035, 1.7, 6], wood, [0.1, HAND_Y + 0.15, z]),
    P(['sphere', 0.13], orb, [0.1, HAND_Y + 1.02, z], { e: orbE ?? orb }),
  ];
}
function dagger(z) {
  return [
    P(['box', 0.07, 0.14, 0.07], 0x3a2a1a, [0.05, HAND_Y, z]),
    P(['box', 0.42, 0.05, 0.08], 0xd5dde6, [0.3, HAND_Y + 0.02, z]),
  ];
}
function bow(z = -0.36) {
  return [
    P(['torus', 0.55, 0.035, 6, 14, Math.PI * 1.1], 0x6b4a2b, [0.15, HAND_Y + 0.05, z], { r: [0, 0, -Math.PI * 0.55] }),
    P(['box', 0.01, 1.0, 0.01], 0xeeeeee, [0.02, HAND_Y + 0.05, z]),
  ];
}

// ---------------------------------------------------------------------------
// HEROES
// ---------------------------------------------------------------------------
export const HERO_RIGS = {
  warrior: () => humanoid({
    body: 0x8c96a3, leg: 0x4a4f57, arm: 0x8c96a3, head: 0xe0b48c, hand: 0x5a5f66, boot: 0x3a2a1e, belt: 0x5e3f22,
    torsoW: 0.42, torsoD: 0.62, shoulderZ: 0.4, armW: 0.17,
    extraBody: [
      P(['box', 0.44, 0.5, 0.4], 0xb0302a, [0.03, 1.05, 0]),
      P(['sphere', 0.17], 0x9aa3ae, [0, 1.42, -0.4], { s: [1, 0.8, 1] }),
      P(['sphere', 0.17], 0x9aa3ae, [0, 1.42, 0.4], { s: [1, 0.8, 1] }),
      P(['box', 0.06, 0.95, 0.6], 0x8a1f1a, [-0.22, 1.0, 0], { r: [0, 0, 0.08] }),
    ],
    extraHead: [
      P(['cyl', 0.22, 0.24, 0.24, 10], 0x9aa3ae, [0, 1.7, 0]),
      P(['cone', 0.06, 0.32, 6], 0xeae0c8, [0, 1.86, -0.22], { r: [-0.9, 0, 0] }),
      P(['cone', 0.06, 0.32, 6], 0xeae0c8, [0, 1.86, 0.22], { r: [0.9, 0, 0] }),
      P(['box', 0.04, 0.06, 0.26], 0x222222, [0.21, 1.66, 0]),
    ],
    extraArmR: axe(0.4),
  }),
  archer: () => humanoid({
    body: 0x3f7a3a, leg: 0x6b4a2b, arm: 0x3f7a3a, head: 0xf0c8a0, hand: 0xf0c8a0, boot: 0x4a3220, belt: 0x7a5634,
    torsoW: 0.32, torsoD: 0.5, legW: 0.16, armW: 0.12,
    extraBody: [
      P(['box', 0.12, 0.7, 0.2], 0x7a5634, [-0.22, 1.25, 0.12], { r: [0.3, 0, 0] }),
      P(['cyl', 0.02, 0.02, 0.4, 4], 0xd8c8a0, [-0.22, 1.65, 0.2], { r: [0.3, 0, 0] }),
      P(['box', 0.06, 0.85, 0.55], 0x2f5f2a, [-0.2, 1.0, 0], { r: [0, 0, 0.1] }),
    ],
    extraHead: [
      P(['cone', 0.26, 0.46, 10], 0x2f5f2a, [-0.03, 1.78, 0]),
      P(['sphere', 0.2], 0x2f5f2a, [-0.05, 1.66, 0], { s: [1, 0.9, 1.05] }),
      P(['box', 0.05, 0.12, 0.3], 0xb07040, [0.16, 1.66, 0]),
    ],
    extraArmL: bow(-0.36),
  }),
  mage: () => humanoid({
    body: 0x2f4fa8, leg: 0x24387a, arm: 0x2f4fa8, head: 0xf0c8a0, hand: 0xf0c8a0, robe: 0x2f4fa8, robeBottom: 0.52,
    torsoW: 0.32, torsoD: 0.5, armW: 0.13,
    extraBody: [P(['box', 0.34, 0.08, 0.52], 0xd4a83a, [0, 0.98, 0])],
    extraHead: [
      P(['cone', 0.3, 0.7, 12], 0x24387a, [0, 2.0, 0], { r: [0, 0, -0.15] }),
      P(['cyl', 0.36, 0.36, 0.05, 14], 0x24387a, [0, 1.74, 0]),
      P(['cyl', 0.24, 0.24, 0.07, 12], 0xd4a83a, [0, 1.78, 0]),
      P(['box', 0.05, 0.25, 0.24], 0xd8d8e8, [0.13, 1.5, 0]),
    ],
    extraArmR: staff(0.36, 0x8ad8ff, 0x5a3a22),
  }),
  summoner: () => humanoid({
    body: 0x3b2450, leg: 0x2a1838, arm: 0x3b2450, head: 0xc8c0d0, hand: 0xc8c0d0, robe: 0x2a1838, robeBottom: 0.55,
    torsoW: 0.34, torsoD: 0.52,
    extraBody: [P(['box', 0.36, 0.08, 0.54], 0x8a6ad0, [0, 0.98, 0]), P(['box', 0.06, 1.1, 0.6], 0x2a1838, [-0.2, 0.95, 0])],
    extraHead: [
      P(['sphere', 0.25], 0x2a1838, [-0.04, 1.68, 0], { s: [1.05, 1.05, 1.1] }),
      P(['cone', 0.2, 0.3, 8], 0x2a1838, [-0.1, 1.9, 0], { r: [0, 0, 0.4] }),
      P(['sphere', 0.04], 0xb080ff, [0.17, 1.66, -0.07], { e: 0xb080ff }),
      P(['sphere', 0.04], 0xb080ff, [0.17, 1.66, 0.07], { e: 0xb080ff }),
    ],
    extraArmR: [
      P(['cyl', 0.035, 0.035, 1.7, 6], 0xe6dcc3, [0.1, HAND_Y + 0.15, 0.36]),
      P(['sphere', 0.15], 0xe6dcc3, [0.1, HAND_Y + 1.05, 0.36]),
      P(['sphere', 0.05], 0x9cff70, [0.22, HAND_Y + 1.05, 0.31], { e: 0x9cff70 }),
      P(['sphere', 0.05], 0x9cff70, [0.22, HAND_Y + 1.05, 0.41], { e: 0x9cff70 }),
    ],
  }),
  engineer: () => humanoid({
    body: 0xc46a1e, leg: 0x5a4a3a, arm: 0xc46a1e, head: 0xe8c09a, hand: 0x3a3a3a, boot: 0x2a2a2a, belt: 0x3a3a3a,
    torsoW: 0.38, torsoD: 0.58,
    extraBody: [
      P(['box', 0.3, 0.5, 0.42], 0x6a6a72, [-0.34, 1.2, 0]),
      P(['cyl', 0.05, 0.05, 0.55, 6], 0x9a9aa2, [-0.42, 1.55, 0.15]),
      P(['sphere', 0.08], 0xffaa33, [-0.42, 1.85, 0.15], { e: 0xff8a1a }),
    ],
    extraHead: [
      P(['sphere', 0.22], 0xe0b030, [0, 1.72, 0], { s: [1, 0.7, 1] }),
      P(['box', 0.1, 0.09, 0.32], 0x222222, [0.17, 1.66, 0]),
      P(['sphere', 0.055], 0x66e0ff, [0.22, 1.66, -0.08], { e: 0x2299cc }),
      P(['sphere', 0.055], 0x66e0ff, [0.22, 1.66, 0.08], { e: 0x2299cc }),
    ],
    extraArmR: [
      P(['box', 0.5, 0.14, 0.16], 0x555560, [0.25, HAND_Y + 0.02, 0.36]),
      P(['cyl', 0.05, 0.05, 0.35, 8], 0x777780, [0.62, HAND_Y + 0.02, 0.36], { r: [0, 0, Math.PI / 2] }),
      P(['box', 0.12, 0.2, 0.08], 0x3a2a1a, [0.08, HAND_Y - 0.1, 0.36]),
    ],
  }),
  paladin: () => humanoid({
    body: 0xdcdcdc, leg: 0x9a9aa2, arm: 0xdcdcdc, head: 0xe0b48c, hand: 0xb8b8c0, boot: 0x7a7a82, belt: 0xd4a83a,
    torsoW: 0.42, torsoD: 0.62, shoulderZ: 0.4, armW: 0.17,
    extraBody: [
      P(['box', 0.44, 0.45, 0.3], 0xd4a83a, [0.02, 1.15, 0]),
      P(['sphere', 0.18], 0xd4a83a, [0, 1.42, -0.4], { s: [1, 0.8, 1] }),
      P(['sphere', 0.18], 0xd4a83a, [0, 1.42, 0.4], { s: [1, 0.8, 1] }),
      P(['box', 0.06, 1.1, 0.7], 0x2a4f9a, [-0.23, 0.95, 0], { r: [0, 0, 0.08] }),
    ],
    extraHead: [
      P(['sphere', 0.23], 0xdcdcdc, [0, 1.7, 0]),
      P(['box', 0.05, 0.05, 0.28], 0x222222, [0.2, 1.68, 0]),
      P(['box', 0.2, 0.06, 0.04], 0xd4a83a, [0, 1.9, 0]),
    ],
    extraArmR: hammer(0.4, 0xd9c27a),
    extraArmL: [P(['cyl', 0.36, 0.36, 0.08, 14], 0xdcdcdc, [0.12, 1.0, -0.47], { r: [Math.PI / 2, 0, 0] }), P(['cyl', 0.2, 0.2, 0.09, 12], 0xd4a83a, [0.12, 1.0, -0.5], { r: [Math.PI / 2, 0, 0] })],
  }),
  assassin: () => humanoid({
    body: 0x1f4f4b, leg: 0x1b2a2a, arm: 0x1f4f4b, head: 0xe8c09a, hand: 0x1b2a2a, boot: 0x111111, belt: 0x8a1f2a,
    torsoW: 0.3, torsoD: 0.48, legW: 0.15, armW: 0.12,
    extraBody: [P(['box', 0.32, 0.1, 0.5], 0x8a1f2a, [0, 1.42, 0]), P(['box', 0.05, 0.5, 0.12], 0x8a1f2a, [-0.15, 1.2, 0.2], { r: [0.3, 0, 0] })],
    extraHead: [
      P(['sphere', 0.21], 0x13302e, [-0.02, 1.68, 0]),
      P(['box', 0.06, 0.1, 0.3], 0x111111, [0.17, 1.62, 0]),
      P(['box', 0.03, 0.04, 0.22], 0x7affe8, [0.2, 1.7, 0], { e: 0x2ad8c0 }),
    ],
    extraArmR: dagger(0.36),
    extraArmL: dagger(-0.36),
  }),
  warlock: () => humanoid({
    body: 0x1b2a18, leg: 0x111a10, arm: 0x1b2a18, head: 0xb8c8a8, hand: 0xb8c8a8, robe: 0x14200f, robeBottom: 0.56,
    torsoW: 0.34, torsoD: 0.52,
    extraBody: [P(['box', 0.36, 0.08, 0.54], 0x7bd84a, [0, 0.98, 0], { e: 0x3a8a1a })],
    extraHead: [
      P(['sphere', 0.25], 0x14200f, [-0.04, 1.68, 0]),
      P(['cone', 0.06, 0.4, 6], 0x2a2a2a, [-0.05, 1.95, -0.16], { r: [-0.5, 0, 0.3] }),
      P(['cone', 0.06, 0.4, 6], 0x2a2a2a, [-0.05, 1.95, 0.16], { r: [0.5, 0, 0.3] }),
      P(['sphere', 0.04], 0x7bd84a, [0.17, 1.66, -0.07], { e: 0x7bd84a }),
      P(['sphere', 0.04], 0x7bd84a, [0.17, 1.66, 0.07], { e: 0x7bd84a }),
    ],
    extraArmR: [P(['sphere', 0.13], 0x7bd84a, [0.15, HAND_Y + 0.05, 0.36], { e: 0x4fbf20, o: 0.85 })],
    extraParts: [{ role: 'float', pivot: [0, 1.2, -0.6], pieces: [P(['box', 0.32, 0.08, 0.26], 0x3a1a1a, [0.1, 1.25, -0.62]), P(['box', 0.3, 0.02, 0.22], 0xe8dcc0, [0.1, 1.3, -0.62])] }],
  }),
};

// ---------------------------------------------------------------------------
// MONSTERS (instanced). Keep piece counts modest.
// ---------------------------------------------------------------------------
const BONE = 0xe6dcc3;

function skeletonRig(o = {}) {
  const bone = o.bone ?? BONE;
  return humanoid({
    body: bone, leg: bone, arm: bone, head: bone, legW: 0.1, armW: 0.08, torsoW: 0.22, torsoD: 0.4, torsoH: 0.5,
    extraBody: [P(['box', 0.24, 0.06, 0.42], 0xcfc4a8, [0, 1.0, 0]), ...(o.extraBody || [])],
    extraHead: [
      P(['box', 0.05, 0.07, 0.07], o.eye ?? 0x220000, [0.17, 1.66, -0.07], o.eyeE ? { e: o.eyeE } : {}),
      P(['box', 0.05, 0.07, 0.07], o.eye ?? 0x220000, [0.17, 1.66, 0.07], o.eyeE ? { e: o.eyeE } : {}),
      ...(o.extraHead || []),
    ],
    extraArmR: o.armR ?? sword(0.36, 0x9a8a70, 0x4a3a2a, 0.7),
    extraArmL: o.armL ?? [],
    h: 1.9,
  });
}

export const MONSTER_RIGS = {
  mon_skeleton: () => skeletonRig(),
  mon_skelarcher: () => skeletonRig({ armR: [], armL: bow(-0.36), extraHead: [P(['cone', 0.22, 0.3, 8], 0x4a3a2a, [0, 1.85, 0])] }),
  mon_bat: () => ({
    anim: 'flyer', h: 1.6,
    parts: [
      { role: 'float', pivot: [0, 1.2, 0], pieces: [
        P(['sphere', 0.24], 0x3b2a3f, [0, 1.2, 0], { s: [1.2, 1, 1] }),
        P(['sphere', 0.14], 0x3b2a3f, [0.25, 1.3, 0]),
        P(['sphere', 0.035], 0xff2a2a, [0.36, 1.33, -0.06], { e: 0xff0000 }),
        P(['sphere', 0.035], 0xff2a2a, [0.36, 1.33, 0.06], { e: 0xff0000 }),
        P(['cone', 0.05, 0.14, 4], 0x3b2a3f, [0.25, 1.45, -0.07]),
        P(['cone', 0.05, 0.14, 4], 0x3b2a3f, [0.25, 1.45, 0.07]),
      ] },
      { role: 'wingL', pivot: [0, 1.25, -0.15], pieces: [P(['box', 0.4, 0.03, 0.6], 0x2a1d2e, [0, 1.25, -0.45])] },
      { role: 'wingR', pivot: [0, 1.25, 0.15], pieces: [P(['box', 0.4, 0.03, 0.6], 0x2a1d2e, [0, 1.25, 0.45])] },
    ],
  }),
  mon_ghoul: () => humanoid({
    body: 0x6f7f62, leg: 0x56634c, arm: 0x6f7f62, head: 0x7d8c6f, hand: 0x3a3a2a, torsoW: 0.45, torsoD: 0.6, armLen: 0.8, armW: 0.16,
    headY: 1.55, shoulderY: 1.32,
    extraBody: [P(['box', 0.46, 0.25, 0.62], 0x4a3a2a, [0, 0.95, 0])],
    extraHead: [P(['box', 0.06, 0.06, 0.18], 0xffee55, [0.17, 1.58, 0], { e: 0xaa8800 })],
    extraArmR: [P(['cone', 0.04, 0.22, 4], 0xd8d0b0, [0.08, 0.5, 0.36], { r: [0, 0, -1.8] })],
    extraArmL: [P(['cone', 0.04, 0.22, 4], 0xd8d0b0, [0.08, 0.5, -0.36], { r: [0, 0, -1.8] })],
    h: 1.9,
  }),
  mon_bomber: () => humanoid({
    body: 0x5e9e3e, leg: 0x4a7a2e, arm: 0x5e9e3e, head: 0x6fb24a, legH: 0.5, legW: 0.13, torsoY: 0.75, torsoH: 0.42, torsoW: 0.28, torsoD: 0.38,
    headY: 1.12, headR: 0.18, shoulderY: 0.9, shoulderZ: 0.24, armLen: 0.38, armW: 0.1,
    extraBody: [P(['sphere', 0.32], 0x222222, [-0.32, 0.95, 0]), P(['cyl', 0.02, 0.02, 0.2, 4], 0x8a6a3a, [-0.32, 1.33, 0]), P(['sphere', 0.06], 0xffaa33, [-0.32, 1.45, 0], { e: 0xff7700 })],
    extraHead: [P(['cone', 0.06, 0.25, 4], 0x6fb24a, [0, 1.15, -0.2], { r: [-1.3, 0, 0] }), P(['cone', 0.06, 0.25, 4], 0x6fb24a, [0, 1.15, 0.2], { r: [1.3, 0, 0] }), P(['box', 0.04, 0.05, 0.16], 0xffdd33, [0.16, 1.15, 0], { e: 0xaa8800 })],
    h: 1.4,
  }),
  mon_spider: () => spiderRig(0x3a2f2a, 0xb02020, 1),
  mon_spiderling: () => spiderRig(0x4a3f2a, 0x70a030, 0.6),
  mon_brute: () => humanoid({
    body: 0x8d7a5e, leg: 0x6b5a44, arm: 0x8d7a5e, head: 0x9a8668, hand: 0x7a6a50, belt: 0x4a3020,
    legH: 0.9, legW: 0.3, hipZ: 0.25, torsoY: 1.35, torsoH: 0.9, torsoW: 0.7, torsoD: 1.0, headY: 2.0, headR: 0.3,
    shoulderY: 1.75, shoulderZ: 0.62, armLen: 1.0, armW: 0.28,
    extraBody: [P(['sphere', 0.5], 0x8d7a5e, [0.1, 1.3, 0], { s: [1, 0.9, 1.1] })],
    extraHead: [P(['box', 0.08, 0.08, 0.3], 0x220000, [0.27, 2.02, 0])],
    extraArmR: [P(['cyl', 0.1, 0.2, 1.3, 7], 0x5e3f22, [0.45, 0.85, 0.62], { r: [0, 0, -1.2] })],
    h: 2.6,
  }),
  mon_cultist: () => humanoid({
    body: 0x8a1d1d, leg: 0x5a1010, arm: 0x8a1d1d, head: 0x2a1010, hand: 0xffaa55, robe: 0x6a1515, robeBottom: 0.5,
    extraHead: [P(['cone', 0.26, 0.55, 8], 0x6a1515, [-0.02, 1.85, 0]), P(['sphere', 0.035], 0xffaa33, [0.17, 1.64, -0.06], { e: 0xff8800 }), P(['sphere', 0.035], 0xffaa33, [0.17, 1.64, 0.06], { e: 0xff8800 })],
    extraArmR: [P(['sphere', 0.12], 0xff7a1a, [0.05, 0.75, 0.36], { e: 0xff5500, o: 0.9 })],
    extraArmL: [P(['sphere', 0.12], 0xff7a1a, [0.05, 0.75, -0.36], { e: 0xff5500, o: 0.9 })],
  }),
  mon_wraith: () => ({
    anim: 'float', h: 2.1,
    parts: [
      { role: 'float', pivot: [0, 1, 0], pieces: [
        P(['cone', 0.45, 1.5, 9], 0x9ec9ff, [0, 0.95, 0], { r: [Math.PI, 0, 0], o: 0.55, e: 0x3a6aa0 }),
        P(['sphere', 0.24], 0xbfdcff, [0, 1.75, 0], { o: 0.7, e: 0x3a6aa0 }),
        P(['sphere', 0.05], 0xaaffff, [0.2, 1.78, -0.08], { e: 0x66ffff }),
        P(['sphere', 0.05], 0xaaffff, [0.2, 1.78, 0.08], { e: 0x66ffff }),
      ] },
      { role: 'armL', pivot: [0, 1.5, -0.3], pieces: [P(['cone', 0.08, 0.7, 5], 0x9ec9ff, [0.1, 1.2, -0.35], { r: [Math.PI, 0, 0.4], o: 0.55 })] },
      { role: 'armR', pivot: [0, 1.5, 0.3], pieces: [P(['cone', 0.08, 0.7, 5], 0x9ec9ff, [0.1, 1.2, 0.35], { r: [Math.PI, 0, 0.4], o: 0.55 })] },
    ],
  }),
  mon_slime: () => slimeRig(0x6dd84a, 1),
  mon_slimelet: () => slimeRig(0x8ae86a, 0.55),
  mon_shielder: () => humanoid({
    body: 0x4f5560, leg: 0x3a3f48, arm: 0x4f5560, head: 0x5f6570, hand: 0x3a3f48, boot: 0x2a2a2a, torsoW: 0.44, torsoD: 0.62, shoulderZ: 0.42, armW: 0.17,
    extraHead: [P(['box', 0.05, 0.05, 0.25], 0xff4422, [0.2, 1.67, 0], { e: 0xaa2200 }), P(['cone', 0.2, 0.3, 8], 0x4f5560, [0, 1.88, 0])],
    extraArmL: [P(['box', 0.1, 1.2, 0.85], 0x6b4a2b, [0.38, 1.05, -0.32]), P(['box', 0.12, 1.25, 0.12], 0x9aa3ae, [0.39, 1.05, -0.74]), P(['box', 0.12, 1.25, 0.12], 0x9aa3ae, [0.39, 1.05, 0.1])],
    extraArmR: sword(0.42, 0x9aa3ae),
    h: 2.1,
  }),
  mon_necro: () => humanoid({
    body: 0x2b2b3a, leg: 0x1b1b2a, arm: 0x2b2b3a, head: 0xd8d0c0, hand: 0xd8d0c0, robe: 0x1f1f2c, robeBottom: 0.55,
    extraHead: [P(['cone', 0.27, 0.6, 8], 0x1f1f2c, [-0.03, 1.87, 0]), P(['sphere', 0.04], 0xc080ff, [0.17, 1.64, -0.07], { e: 0xa060ff }), P(['sphere', 0.04], 0xc080ff, [0.17, 1.64, 0.07], { e: 0xa060ff })],
    extraArmR: [P(['cyl', 0.03, 0.03, 1.6, 6], 0x3a2a1a, [0.1, HAND_Y + 0.15, 0.36]), P(['sphere', 0.12], BONE, [0.1, HAND_Y + 0.98, 0.36]), P(['sphere', 0.07], 0xc080ff, [0.1, HAND_Y + 1.12, 0.36], { e: 0xa060ff })],
  }),
  mon_demon: () => humanoid({
    body: 0x9b2b22, leg: 0x6a1a14, arm: 0x9b2b22, head: 0xa83a2a, hand: 0x2a1a1a, torsoW: 0.42, torsoD: 0.6, shoulderZ: 0.4, armW: 0.16, armLen: 0.7,
    extraBody: [P(['box', 0.5, 0.04, 0.7], 0x5a1414, [-0.25, 1.4, -0.45], { r: [0.5, 0.3, 0.3] }), P(['box', 0.5, 0.04, 0.7], 0x5a1414, [-0.25, 1.4, 0.45], { r: [-0.5, -0.3, 0.3] })],
    extraHead: [P(['cone', 0.06, 0.35, 6], 0x222222, [0, 1.85, -0.14], { r: [-0.4, 0, -0.3] }), P(['cone', 0.06, 0.35, 6], 0x222222, [0, 1.85, 0.14], { r: [0.4, 0, -0.3] }), P(['box', 0.05, 0.05, 0.22], 0xffcc33, [0.19, 1.67, 0], { e: 0xffaa00 })],
    extraArmR: [P(['cone', 0.04, 0.25, 4], 0x222222, [0.1, 0.62, 0.4], { r: [0, 0, -1.8] })],
    extraArmL: [P(['cone', 0.04, 0.25, 4], 0x222222, [0.1, 0.62, -0.4], { r: [0, 0, -1.8] })],
    h: 2.0,
  }),
  mon_gargoyle: () => ({
    anim: 'flyer', h: 2.0,
    parts: [
      { role: 'float', pivot: [0, 1.2, 0], pieces: [
        P(['box', 0.6, 0.6, 0.6], 0x6d6d72, [0, 1.2, 0], { r: [0, 0, 0.3] }),
        P(['box', 0.34, 0.32, 0.34], 0x7d7d82, [0.38, 1.55, 0]),
        P(['cone', 0.06, 0.28, 5], 0x4d4d52, [0.38, 1.8, -0.12]),
        P(['cone', 0.06, 0.28, 5], 0x4d4d52, [0.38, 1.8, 0.12]),
        P(['box', 0.05, 0.06, 0.2], 0xff5522, [0.56, 1.57, 0], { e: 0xff3300 }),
        P(['box', 0.15, 0.5, 0.15], 0x5d5d62, [0.1, 0.75, -0.2]),
        P(['box', 0.15, 0.5, 0.15], 0x5d5d62, [0.1, 0.75, 0.2]),
      ] },
      { role: 'wingL', pivot: [-0.1, 1.45, -0.25], pieces: [P(['box', 0.5, 0.04, 0.9], 0x5d5d62, [-0.15, 1.5, -0.7])] },
      { role: 'wingR', pivot: [-0.1, 1.45, 0.25], pieces: [P(['box', 0.5, 0.04, 0.9], 0x5d5d62, [-0.15, 1.5, 0.7])] },
    ],
  }),
  mon_knight: () => humanoid({
    body: 0x2b2d36, leg: 0x1d1f26, arm: 0x2b2d36, head: 0x2b2d36, hand: 0x1d1f26, boot: 0x111111,
    torsoW: 0.5, torsoD: 0.7, shoulderZ: 0.45, armW: 0.2, legW: 0.22, hipZ: 0.18,
    extraBody: [P(['sphere', 0.2], 0x3b3d46, [0, 1.45, -0.45], { s: [1, 0.8, 1] }), P(['sphere', 0.2], 0x3b3d46, [0, 1.45, 0.45], { s: [1, 0.8, 1] }), P(['box', 0.06, 1.2, 0.8], 0x5a1414, [-0.28, 0.9, 0], { r: [0, 0, 0.1] })],
    extraHead: [P(['box', 0.42, 0.45, 0.4], 0x2b2d36, [0, 1.68, 0]), P(['box', 0.05, 0.05, 0.3], 0xff2222, [0.22, 1.7, 0], { e: 0xff0000 })],
    extraArmR: sword(0.45, 0x6a6a7a, 0x222222, 1.4),
    h: 2.2,
  }),
  mon_phylactery: () => ({
    anim: 'spin', h: 2.6,
    parts: [
      { role: 'spin', pivot: [0, 1.3, 0], pieces: [
        P(['octa', 0.6], 0x66e8ff, [0, 1.4, 0], { e: 0x2299bb, s: [1, 1.6, 1] }),
        P(['torus', 0.9, 0.04, 6, 24], 0xaaffff, [0, 1.4, 0], { e: 0x66ccff, r: [Math.PI / 2, 0, 0] }),
      ] },
      { role: 'root', pivot: [0, 0, 0], pieces: [P(['cyl', 0.6, 0.8, 0.4, 8], 0x3a4048, [0, 0.2, 0])] },
    ],
  }),
};

function spiderRig(body, mark, k) {
  const legs = [];
  for (let i = 0; i < 4; i++) {
    for (const side of [-1, 1]) {
      const x = 0.25 - i * 0.18;
      legs.push({ role: side < 0 ? (i % 2 ? 'legL' : 'legR') : (i % 2 ? 'legR' : 'legL'), pivot: [x * k, 0.45 * k, side * 0.15 * k], pieces: [
        P(['box', 0.06 * k, 0.06 * k, 0.55 * k], body, [x * k + 0.05 * k, 0.5 * k, side * 0.42 * k], { r: [side * -0.5, (0.4 - i * 0.25) * side, 0] }),
        P(['box', 0.05 * k, 0.5 * k, 0.05 * k], body, [x * k + 0.08 * k, 0.25 * k, side * 0.68 * k], { r: [side * 0.2, 0, 0] }),
      ] });
    }
  }
  return {
    anim: 'spider', h: 1.1 * k + 0.4,
    parts: [
      { role: 'body', pivot: [0, 0.45 * k, 0], pieces: [
        P(['sphere', 0.26 * k], body, [0.18 * k, 0.5 * k, 0]),
        P(['sphere', 0.4 * k], body, [-0.32 * k, 0.6 * k, 0], { s: [1.2, 0.95, 1] }),
        P(['sphere', 0.12 * k], mark, [-0.38 * k, 0.92 * k, 0], { e: mark }),
        P(['sphere', 0.04 * k], 0xff3333, [0.42 * k, 0.56 * k, -0.07 * k], { e: 0xff0000 }),
        P(['sphere', 0.04 * k], 0xff3333, [0.42 * k, 0.56 * k, 0.07 * k], { e: 0xff0000 }),
      ] },
      ...legs,
    ],
  };
}

function slimeRig(color, k) {
  return {
    anim: 'slime', h: 1.2 * k + 0.3,
    parts: [
      { role: 'slime', pivot: [0, 0, 0], pieces: [
        P(['sphere', 0.6 * k], color, [0, 0.5 * k, 0], { o: 0.75, s: [1.1, 0.85, 1.1] }),
        P(['sphere', 0.25 * k], 0x3a7a2a, [0, 0.45 * k, 0], { o: 0.9 }),
        P(['sphere', 0.07 * k], 0x111111, [0.45 * k, 0.65 * k, -0.15 * k]),
        P(['sphere', 0.07 * k], 0x111111, [0.45 * k, 0.65 * k, 0.15 * k]),
      ] },
    ],
  };
}

// ---------------------------------------------------------------------------
// BOSSES & SUMMONS (individual meshes)
// ---------------------------------------------------------------------------
export const BIG_RIGS = {
  boss_boneking: () => {
    const r = skeletonRig({
      bone: 0xefe4c8, eye: 0x330000, eyeE: 0xff3300,
      armR: [P(['cyl', 0.07, 0.12, 1.6, 6], 0xe6dcc3, [0.55, HAND_Y + 0.05, 0.36], { r: [0, 0, -1.25] }), P(['sphere', 0.26], 0xe6dcc3, [1.25, HAND_Y + 0.35, 0.36])],
      extraHead: [P(['cyl', 0.22, 0.2, 0.18, 8], 0xd4a83a, [0, 1.85, 0], { e: 0x553300 }), ...[0, 1, 2, 3, 4, 5].map((i) => P(['cone', 0.04, 0.14, 4], 0xd4a83a, [Math.cos(i) * 0.19, 2.0, Math.sin(i) * 0.19]))],
      extraBody: [P(['box', 0.06, 1.2, 0.75], 0x5a2a7a, [-0.2, 0.95, 0], { r: [0, 0, 0.1] })],
    });
    r.h = 2.2;
    return r;
  },
  boss_broodmother: () => {
    const r = spiderRig(0x2a221e, 0x7dff3a, 2.4);
    r.parts[0].pieces.push(P(['sphere', 0.25], 0x9cff60, [-0.4, 2.0, -0.5], { e: 0x5abf20, o: 0.85 }), P(['sphere', 0.22], 0x9cff60, [-1.1, 1.9, 0.45], { e: 0x5abf20, o: 0.85 }));
    return r;
  },
  boss_colossus: () => humanoid({
    body: 0x7a6f62, leg: 0x6a6052, arm: 0x7a6f62, head: 0x8a7f72, hand: 0x5a5042,
    legH: 0.9, legW: 0.34, hipZ: 0.26, torsoY: 1.4, torsoH: 1.0, torsoW: 0.8, torsoD: 1.1, headY: 2.15, headR: 0.3,
    shoulderY: 1.85, shoulderZ: 0.7, armLen: 1.1, armW: 0.34,
    extraBody: [
      P(['dodeca', 0.55], 0x7a6f62, [0.05, 1.45, 0]),
      P(['box', 0.05, 0.6, 0.08], 0xff6a1a, [0.42, 1.4, -0.2], { e: 0xff4400 }),
      P(['box', 0.05, 0.5, 0.08], 0xff6a1a, [0.42, 1.3, 0.25], { e: 0xff4400, r: [0.5, 0, 0] }),
      P(['dodeca', 0.3], 0x6a6052, [0, 2.0, -0.6]),
      P(['dodeca', 0.3], 0x6a6052, [0, 2.0, 0.6]),
    ],
    extraHead: [P(['box', 0.06, 0.08, 0.36], 0xff8833, [0.27, 2.18, 0], { e: 0xff5500 })],
    extraArmR: [P(['dodeca', 0.32], 0x6a6052, [0.05, 0.62, 0.7])],
    extraArmL: [P(['dodeca', 0.32], 0x6a6052, [0.05, 0.62, -0.7])],
    h: 2.7,
  }),
  boss_lich: () => {
    const r = humanoid({
      body: 0x2a3a5a, leg: 0x1a2a4a, arm: 0x2a3a5a, head: 0xd8e8f0, hand: 0xd8e8f0, robe: 0x1f2f4f, robeBottom: 0.7,
      extraHead: [P(['cyl', 0.24, 0.2, 0.2, 8], 0x9ad8ff, [0, 1.86, 0], { e: 0x3a7aaa }), ...[0, 1, 2, 3, 4].map((i) => P(['cone', 0.05, 0.26, 4], 0xbfe8ff, [Math.cos(i * 1.25) * 0.2, 2.06, Math.sin(i * 1.25) * 0.2], { e: 0x5aa8dd })), P(['sphere', 0.045], 0x88ffff, [0.18, 1.67, -0.07], { e: 0x66ffff }), P(['sphere', 0.045], 0x88ffff, [0.18, 1.67, 0.07], { e: 0x66ffff })],
      extraArmR: staff(0.36, 0x7fd8ff, 0x2a2a3a, 0x3fa8ff),
      extraBody: [P(['box', 0.06, 1.3, 0.8], 0x1a2a4a, [-0.22, 0.9, 0], { r: [0, 0, 0.08] })],
      anim: 'floatHumanoid',
    });
    r.h = 2.3;
    return r;
  },
  boss_infernal: () => humanoid({
    body: 0x6a1a14, leg: 0x3a0e0a, arm: 0x6a1a14, head: 0x7a2a1a, hand: 0x2a0a0a,
    torsoW: 0.55, torsoD: 0.8, torsoH: 0.75, shoulderZ: 0.52, armW: 0.22, armLen: 0.8, legW: 0.24, hipZ: 0.2,
    extraBody: [
      P(['box', 0.9, 0.05, 1.2], 0x3a0a08, [-0.4, 1.5, -0.8], { r: [0.6, 0.4, 0.2] }),
      P(['box', 0.9, 0.05, 1.2], 0x3a0a08, [-0.4, 1.5, 0.8], { r: [-0.6, -0.4, 0.2] }),
      P(['box', 0.06, 0.5, 0.2], 0xff7a1a, [0.29, 1.2, 0], { e: 0xff5500 }),
    ],
    extraHead: [P(['cone', 0.08, 0.5, 6], 0x1a1a1a, [0, 1.95, -0.2], { r: [-0.5, 0, -0.4] }), P(['cone', 0.08, 0.5, 6], 0x1a1a1a, [0, 1.95, 0.2], { r: [0.5, 0, -0.4] }), P(['box', 0.05, 0.06, 0.25], 0xffdd33, [0.2, 1.68, 0], { e: 0xffaa00 }), P(['cone', 0.18, 0.35, 6], 0xff6a1a, [0, 2.0, 0], { e: 0xff4400, o: 0.8 })],
    extraArmR: [P(['box', 0.1, 0.25, 0.1], 0x2a1a1a, [0.05, HAND_Y - 0.05, 0.52]), P(['box', 1.5, 0.1, 0.22], 0xff8a3a, [0.85, HAND_Y + 0.05, 0.52], { e: 0xff4a00 })],
    h: 2.2,
  }),
  boss_devourer: () => {
    const tentacles = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      tentacles.push({ role: 'tentacle' + i, pivot: [Math.cos(a) * 0.6, 0.6, Math.sin(a) * 0.6], pieces: [
        P(['cyl', 0.06, 0.16, 1.4, 6], 0x2a1838, [Math.cos(a) * 1.1, 0.4, Math.sin(a) * 1.1], { r: [Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1] }),
      ] });
    }
    return {
      anim: 'devourer', h: 3.2,
      parts: [
        { role: 'float', pivot: [0, 1.3, 0], pieces: [
          P(['sphere', 1.0], 0x1b0f24, [0, 1.4, 0], { s: [1.1, 1, 1.1] }),
          P(['sphere', 0.6], 0x241430, [0.5, 1.9, 0]),
          P(['cone', 0.5, 0.8, 8], 0x3a0a1a, [0.95, 1.3, 0], { r: [0, 0, -Math.PI / 2] }),
          ...[[-0.2, 0.3], [0.1, 0.5], [0.15, -0.35], [-0.15, -0.5], [0.3, 0]].map(([y, z]) => P(['sphere', 0.09], 0xd080ff, [0.95, 1.95 + y, z], { e: 0xb050ff })),
          P(['torus', 1.3, 0.05, 6, 30], 0x7a40b0, [0, 1.4, 0], { e: 0x5a2090, r: [Math.PI / 2, 0, 0] }),
        ] },
        ...tentacles,
      ],
    };
  },
  sum_skeleton: () => skeletonRig({ bone: 0xd8d2e8, eye: 0x7a40ff, eyeE: 0x7a40ff, armR: sword(0.36, 0xb8b0d8, 0x3a2a5a, 0.75) }),
  sum_skelmage: () => skeletonRig({ bone: 0xd8d2e8, eye: 0x9cff70, eyeE: 0x9cff70, armR: staff(0.36, 0x9cff70, 0x3a2a5a), extraHead: [P(['cone', 0.24, 0.42, 8], 0x3b2450, [-0.02, 1.86, 0])] }),
  sum_golem: () => humanoid({
    body: 0xe6dcc3, leg: 0xcfc4a8, arm: 0xe6dcc3, head: 0xd8ccb0, hand: 0xcfc4a8,
    legH: 0.8, legW: 0.3, hipZ: 0.24, torsoY: 1.3, torsoH: 0.9, torsoW: 0.7, torsoD: 1.0, headY: 1.95, headR: 0.26,
    shoulderY: 1.7, shoulderZ: 0.62, armLen: 1.0, armW: 0.3,
    extraBody: [P(['box', 0.72, 0.1, 1.02], 0xb8ac90, [0, 1.1, 0]), P(['box', 0.72, 0.1, 1.02], 0xb8ac90, [0, 1.35, 0]), P(['sphere', 0.15], 0x9cff70, [0.36, 1.45, 0], { e: 0x5abf20 })],
    extraHead: [P(['box', 0.06, 0.07, 0.3], 0x9cff70, [0.24, 1.97, 0], { e: 0x5abf20 })],
    h: 2.5,
  }),
  sum_infernal: () => humanoid({
    body: 0x3a3a32, leg: 0x2a2a24, arm: 0x3a3a32, head: 0x4a4a40, hand: 0x7bd84a,
    legH: 0.8, legW: 0.3, hipZ: 0.24, torsoY: 1.3, torsoH: 0.9, torsoW: 0.7, torsoD: 1.0, headY: 1.95, headR: 0.26,
    shoulderY: 1.7, shoulderZ: 0.62, armLen: 1.0, armW: 0.3,
    extraBody: [P(['box', 0.06, 0.7, 0.1], 0x7bd84a, [0.36, 1.3, 0.2], { e: 0x4fbf20 }), P(['box', 0.06, 0.6, 0.1], 0x7bd84a, [0.36, 1.25, -0.25], { e: 0x4fbf20 })],
    extraHead: [P(['cone', 0.2, 0.4, 6], 0x7bd84a, [0, 2.25, 0], { e: 0x4fbf20, o: 0.85 }), P(['box', 0.06, 0.07, 0.3], 0xbfff6a, [0.25, 1.97, 0], { e: 0x7bd84a })],
    h: 2.5,
  }),
  sum_decoy: () => humanoid({ body: 0x38c9b8, leg: 0x38c9b8, arm: 0x38c9b8, head: 0x38c9b8, h: 2.0 }),
  sum_twin: () => humanoid({ body: 0xff8cf0, leg: 0xff8cf0, arm: 0xff8cf0, head: 0xff8cf0, h: 2.0 }),
  tur_turret: () => ({
    anim: 'turret', h: 1.6,
    parts: [
      { role: 'root', pivot: [0, 0, 0], pieces: [
        P(['cyl', 0.06, 0.06, 0.9, 5], 0x555560, [-0.25, 0.4, -0.2], { r: [0.4, 0, 0.3] }),
        P(['cyl', 0.06, 0.06, 0.9, 5], 0x555560, [-0.25, 0.4, 0.2], { r: [-0.4, 0, 0.3] }),
        P(['cyl', 0.06, 0.06, 0.9, 5], 0x555560, [0.3, 0.4, 0], { r: [0, 0, -0.35] }),
        P(['cyl', 0.25, 0.3, 0.2, 8], 0x6a6a72, [0, 0.82, 0]),
      ] },
      { role: 'head', pivot: [0, 0.95, 0], pieces: [
        P(['box', 0.55, 0.32, 0.4], 0xc46a1e, [0.05, 1.08, 0]),
        P(['cyl', 0.07, 0.07, 0.6, 8], 0x333338, [0.5, 1.1, 0], { r: [0, 0, Math.PI / 2] }),
        P(['sphere', 0.06], 0x66e0ff, [0.2, 1.26, 0], { e: 0x2299cc }),
      ] },
    ],
  }),
  tur_tesla: () => ({
    anim: 'static', h: 2.4,
    parts: [
      { role: 'root', pivot: [0, 0, 0], pieces: [
        P(['cyl', 0.4, 0.5, 0.3, 8], 0x555560, [0, 0.15, 0]),
        P(['cyl', 0.12, 0.16, 1.5, 8], 0x8a6a3a, [0, 1.0, 0]),
        P(['torus', 0.26, 0.05, 6, 16], 0xc87a3a, [0, 0.8, 0], { r: [Math.PI / 2, 0, 0] }),
        P(['torus', 0.22, 0.05, 6, 16], 0xc87a3a, [0, 1.15, 0], { r: [Math.PI / 2, 0, 0] }),
        P(['torus', 0.18, 0.05, 6, 16], 0xc87a3a, [0, 1.5, 0], { r: [Math.PI / 2, 0, 0] }),
        P(['sphere', 0.25], 0xfff27a, [0, 1.95, 0], { e: 0xffd800 }),
      ] },
    ],
  }),
  tur_drone: () => ({
    anim: 'float', h: 2.0,
    parts: [
      { role: 'float', pivot: [0, 1.6, 0], pieces: [
        P(['cyl', 0.3, 0.25, 0.12, 10], 0x6a6a72, [0, 1.7, 0]),
        P(['sphere', 0.1], 0xff5522, [0.25, 1.68, 0], { e: 0xff3300 }),
        P(['box', 0.8, 0.03, 0.06], 0x333338, [0, 1.8, 0]),
        P(['box', 0.06, 0.03, 0.8], 0x333338, [0, 1.8, 0]),
      ] },
    ],
  }),
};

export function getRig(name) {
  if (name.startsWith('hero_')) {
    const f = HERO_RIGS[name.slice(5)];
    return f ? f() : HERO_RIGS.warrior();
  }
  const f = MONSTER_RIGS[name] || BIG_RIGS[name];
  return f ? f() : MONSTER_RIGS.mon_skeleton();
}

export const BOSS_SCALE = {
  boss_boneking: 2.0, boss_broodmother: 1.0, boss_colossus: 1.7, boss_lich: 1.6, boss_infernal: 2.1, boss_devourer: 1.6,
};
