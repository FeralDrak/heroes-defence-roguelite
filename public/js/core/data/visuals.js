// Numeric ids for visuals (used in binary snapshots). Order must be identical on host and clients
// (it is, since everyone runs the same code).
import { CLASS_LIST } from './classes/index.js';
import { MONSTERS } from './monsters.js';
import { SUMMONS } from './summons.js';

const units = ['none'];
for (const c of CLASS_LIST) units.push('hero_' + c.id);
for (const m of Object.values(MONSTERS)) if (!units.includes(m.vis)) units.push(m.vis);
for (const s of Object.values(SUMMONS)) if (!units.includes(s.vis)) units.push(s.vis);

export const VIS_LIST = units;
export const VIS_IDS = Object.fromEntries(units.map((v, i) => [v, i]));

export const PROJ_VIS_LIST = [
  'none', 'arrow', 'arcane', 'arcane_s', 'fireball', 'fireball_s', 'shadowbolt', 'rivet', 'grenade', 'grenade_s',
  'shield', 'knife', 'holywave', 'corrupt', 'bone', 'bullet', 'rocket', 'spirit', 'spark', 'shockwave',
  'e_arrow', 'e_orb', 'e_fire', 'e_frost', 'e_poison', 'e_shadow', 'e_stone', 'e_bone', 'e_web', 'e_spark', 'e_shell', 'e_skull', 'e_rock',
];
export const PROJ_VIS_IDS = Object.fromEntries(PROJ_VIS_LIST.map((v, i) => [v, i]));
