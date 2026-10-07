// Elite affixes (behaviour in sim/monsterai.js).
export const ELITE_AFFIXES = {
  fast: { name: 'Rapide', color: '#ffffff', desc: 'Se déplace et attaque plus vite.' },
  vampiric: { name: 'Vampirique', color: '#ff3355', desc: 'Se soigne en frappant.' },
  armored: { name: 'Blindé', color: '#b0b8c0', desc: 'Subit 35% de dégâts en moins.' },
  explosive: { name: 'Explosif', color: '#ff7a1a', desc: 'Explose à sa mort.' },
  frozen: { name: 'Glacial', color: '#7fd8ff', desc: 'Fait apparaître des orbes de glace explosifs.' },
  molten: { name: 'Ardent', color: '#ff5500', desc: 'Laisse une traînée de feu.' },
  electric: { name: 'Électrique', color: '#fff27a', desc: 'Libère des étincelles quand il est touché.' },
  summoner: { name: 'Invocateur', color: '#b37bff', desc: 'Invoque des chauves-souris.' },
  teleporter: { name: 'Téléporteur', color: '#c58cff', desc: 'Se téléporte sur les héros.' },
  frenzied: { name: 'Enragé', color: '#ff3b3b', desc: 'Devient plus rapide et plus fort sous 50% de PV.' },
  shielding: { name: 'Protecteur', color: '#ffe066', desc: 'Devient régulièrement invulnérable.' },
  mortar: { name: 'Mortier', color: '#ffaa55', desc: 'Bombarde les héros à distance.' },
  plague: { name: 'Pestilentiel', color: '#7dff6a', desc: 'Empoisonne les héros proches.' },
  jailer: { name: 'Geôlier', color: '#9aa7ff', desc: 'Immobilise les héros.' },
};

export const ELITE_AFFIX_IDS = Object.keys(ELITE_AFFIXES);
// affixes that should not appear on ranged monsters / bombers
export const MELEE_ONLY_AFFIXES = new Set(['teleporter']);
