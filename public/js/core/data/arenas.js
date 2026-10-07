// Arenas: layout (obstacles, spawn gates), palette and optional hazards.
import { TEAM_HEROES, TEAM_MONSTERS } from '../constants.js';

function ring(n, r, offset = 0, size = 1.3) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = offset + (i / n) * Math.PI * 2;
    out.push({ x: +(Math.cos(a) * r).toFixed(2), z: +(Math.sin(a) * r).toFixed(2), r: size });
  }
  return out;
}

function gates(n, r = 29.5, offset = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = offset + (i / n) * Math.PI * 2;
    out.push({ x: +(Math.cos(a) * r).toFixed(2), z: +(Math.sin(a) * r).toFixed(2), a });
  }
  return out;
}

export const ARENAS = {
  colosseum: {
    id: 'colosseum', name: 'Colisée de Cendre', locked: false, icon: '🏛️',
    desc: 'Le sable de cette arène a bu le sang de mille héros.',
    obstacles: [...ring(6, 14.5, Math.PI / 6, 1.35), ...ring(4, 22, Math.PI / 4, 1.1)],
    gates: gates(6),
    palette: {
      floor: '#86704f', floor2: '#6a553b', wall: '#5f4c3a', pillar: '#a8916f', fog: '#1d140e',
      sky: '#3b2a1c', ground: '#2a1d12', light: '#ffd9a8', torch: '#ff9a40', rune: '#ff7b2e', ambient: 0.55,
    },
  },
  crypt: {
    id: 'crypt', name: 'Crypte Oubliée', locked: true, icon: '⚰️',
    desc: 'Des colonnes serrées, des ombres partout. Les morts y sont chez eux.',
    obstacles: [...ring(8, 11, 0, 1.2), ...ring(8, 20, Math.PI / 8, 1.3), { x: 0, z: 0, r: 1.8 }],
    gates: gates(8, 29.5, Math.PI / 8),
    palette: {
      floor: '#4d5a5e', floor2: '#363f43', wall: '#2c3437', pillar: '#6f7d80', fog: '#060b10',
      sky: '#1a2a35', ground: '#0b1013', light: '#a8d8ff', torch: '#5affc8', rune: '#45ffd2', ambient: 0.42,
    },
  },
  forge: {
    id: 'forge', name: 'Forge Infernale', locked: true, icon: '🌋',
    desc: 'La lave jaillit du sol sans prévenir. Elle brûle tout le monde, alliés comme ennemis.',
    obstacles: [...ring(4, 13, Math.PI / 4, 2.0)],
    gates: gates(6, 29.5, Math.PI / 6),
    palette: {
      floor: '#3a2622', floor2: '#24140f', wall: '#2a1a16', pillar: '#4b3029', fog: '#1a0703',
      sky: '#401106', ground: '#120604', light: '#ffb080', torch: '#ff4a10', rune: '#ff3b00', ambient: 0.5,
    },
    hazard(g, dt) {
      g.arenaState.t = (g.arenaState.t ?? 6) - dt;
      if (g.arenaState.t > 0) return;
      g.arenaState.t = Math.max(3.5, 8 - g.wave * 0.12);
      const n = 2 + Math.floor(g.wave / 10);
      for (let i = 0; i < n; i++) {
        const target = g.rng.chance(0.6) ? g.randomHero() : null;
        const [x, z] = target ? g.randomPointNear(target.x, target.z, 0, 4) : g.randomPointNear(0, 0, 3, 26);
        g.spawnArea({
          team: TEAM_MONSTERS, shape: 'circle', x, z, r: 3, delay: 1.6, vis: 'lava',
          onResolve: (g2, a) => {
            const hpScale = g.monsterScaling(g.wave).dmg;
            for (const u of g.unitsInShape(TEAM_HEROES, a)) g.dealDamage(null, u, 22 * hpScale, { type: 'fire' });
            for (const u of g.unitsInShape(TEAM_MONSTERS, a)) g.dealDamage(null, u, u.maxHp * 0.15, { type: 'fire' });
            g.fx('boom', { x, z, r: 3, c: 'fire' });
            g.snd('boom', x, z);
          },
        });
      }
    },
  },
};

export const ARENA_LIST = Object.values(ARENAS);
