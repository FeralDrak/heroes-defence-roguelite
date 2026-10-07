// Hero-side minions and structures. Behaviour keys are implemented in sim/allyai.js.
export const SUMMONS = {
  skeleton: {
    id: 'skeleton', name: 'Squelette', vis: 'sum_skeleton', ai: 'melee', color: 'shadow',
    hpMul: 0.5, coef: 0.6, rate: 1.0, range: 1.4, speed: 5.6, radius: 0.45, leash: 13, type: 'phys',
  },
  skelmage: {
    id: 'skelmage', name: 'Mage squelette', vis: 'sum_skelmage', ai: 'ranged', color: 'shadow',
    hpMul: 0.32, coef: 0.65, rate: 1.2, range: 12, speed: 4.6, radius: 0.45, leash: 14, type: 'shadow', proj: 'bone',
  },
  golem: {
    id: 'golem', name: "Golem d'os", vis: 'sum_golem', ai: 'golem', color: 'shadow',
    hpMul: 3.2, coef: 2.0, rate: 2.0, range: 2.4, slamR: 3.4, speed: 4.4, radius: 1.1, mass: 6, taunt: true, leash: 16, type: 'phys', dr: 0.2,
  },
  infernal: {
    id: 'infernal', name: 'Infernal', vis: 'sum_infernal', ai: 'infernal', color: 'fel',
    hpMul: 2.6, coef: 1.3, rate: 1.1, range: 2.2, auraR: 3.2, auraCoef: 0.22, speed: 4.6, radius: 1.0, mass: 5, taunt: true, leash: 16, type: 'fire', dr: 0.15,
  },
  turret: {
    id: 'turret', name: 'Tourelle', vis: 'tur_turret', ai: 'turret', structure: true, color: 'fire',
    hpMul: 0.55, radius: 0.65, mass: 99, spawnT: 0.4,
  },
  tesla: {
    id: 'tesla', name: 'Bobine Tesla', vis: 'tur_tesla', ai: 'tesla', structure: true, color: 'light',
    hpMul: 0.65, radius: 0.6, mass: 99, spawnT: 0.4,
  },
  drone: {
    id: 'drone', name: 'Drone de combat', vis: 'tur_drone', ai: 'drone', structure: true, color: 'fire',
    hpMul: 0.3, coef: 0.45, rate: 0.45, range: 11, speed: 9, radius: 0.35, spawnT: 0.2,
    onSpawn(g, u) { u.untargetable = true; },
  },
  decoy: {
    id: 'decoy', name: 'Image rémanente', vis: 'sum_decoy', ai: 'decoy', color: 'teal',
    hpMul: 0.7, radius: 0.5, taunt: true, spawnT: 0,
    onSpawn(g, u) {
      for (const m of g.enemiesInRadius(0, u.x, u.z, 9)) g.applyStatus(m, 'taunt', { dur: 2.5, by: u });
    },
  },
  twin: {
    id: 'twin', name: 'Double spectral', vis: 'sum_twin', ai: 'twin', color: 'arcane',
    hpMul: 0.5, speed: 9, radius: 0.5, spawnT: 0.3,
    onSpawn(g, u) { u.untargetable = true; },
  },
};
