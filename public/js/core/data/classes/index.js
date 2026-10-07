// Class registry: classes, abilities and class talents.
import * as warrior from './warrior.js';
import * as archer from './archer.js';
import * as mage from './mage.js';
import * as summoner from './summoner.js';
import * as engineer from './engineer.js';
import * as paladin from './paladin.js';
import * as assassin from './assassin.js';
import * as warlock from './warlock.js';

const MODULES = [warrior, archer, mage, summoner, engineer, paladin, assassin, warlock];

export const CLASS_LIST = MODULES.map((m) => m.CLASS);
export const CLASSES = Object.fromEntries(CLASS_LIST.map((c) => [c.id, c]));
export const ABILITIES = Object.assign({}, ...MODULES.map((m) => m.ABILITIES));
export const CLASS_TALENTS = MODULES.flatMap((m) => m.TALENTS);

for (const ab of Object.values(ABILITIES)) {
  const cls = CLASS_LIST.find((c) => c.abilities.includes(ab.id));
  ab.cls = cls ? cls.id : null;
}
