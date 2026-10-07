// Difficulty levels. The base level is already very hard; higher levels must be unlocked.
export const DIFFICULTIES = {
  normal: {
    id: 'normal', name: 'Normal', icon: '💀', order: 0, locked: false,
    desc: 'La difficulté de base. Déjà impitoyable.',
    hp: 1, dmg: 1, speed: 1, count: 1, elite: 0, extraAffixes: 0, loot: 1, gold: 1,
    playerScale: 0.55, playerHp: 0.4, startGold: 60,
  },
  nightmare: {
    id: 'nightmare', name: 'Cauchemar', icon: '👁️', order: 1, locked: true,
    desc: 'Monstres +60% PV, +35% dégâts. Butin amélioré.',
    hp: 1.6, dmg: 1.35, speed: 1.05, count: 1.1, elite: 0.03, extraAffixes: 0, loot: 1.3, gold: 1.15,
    playerScale: 0.55, playerHp: 0.45, startGold: 70,
  },
  hell: {
    id: 'hell', name: 'Enfer', icon: '🔥', order: 2, locked: true,
    desc: 'Monstres +160% PV, +80% dégâts, élites avec un affixe de plus.',
    hp: 2.6, dmg: 1.8, speed: 1.1, count: 1.2, elite: 0.05, extraAffixes: 1, loot: 1.6, gold: 1.3,
    playerScale: 0.6, playerHp: 0.5, startGold: 80,
  },
  torment1: {
    id: 'torment1', name: 'Tourment I', icon: '⛓️', order: 3, locked: true,
    desc: 'Seuls les plus grands héros survivent ici.',
    hp: 4, dmg: 2.4, speed: 1.12, count: 1.3, elite: 0.07, extraAffixes: 1, loot: 2, gold: 1.45,
    playerScale: 0.6, playerHp: 0.5, startGold: 90,
  },
  torment2: {
    id: 'torment2', name: 'Tourment II', icon: '⛓️', order: 4, locked: true,
    desc: 'La douleur est un mode de vie.',
    hp: 6.5, dmg: 3.2, speed: 1.15, count: 1.38, elite: 0.1, extraAffixes: 2, loot: 2.5, gold: 1.6,
    playerScale: 0.65, playerHp: 0.55, startGold: 100,
  },
  torment3: {
    id: 'torment3', name: 'Tourment III', icon: '☠️', order: 5, locked: true,
    desc: "L'épreuve ultime. Aucune pitié.",
    hp: 10, dmg: 4.2, speed: 1.18, count: 1.45, elite: 0.13, extraAffixes: 2, loot: 3, gold: 1.8,
    playerScale: 0.65, playerHp: 0.6, startGold: 110,
  },
};

export const DIFFICULTY_LIST = Object.values(DIFFICULTIES).sort((a, b) => a.order - b.order);
