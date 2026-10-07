// Temporary hero buffs (stats + hooks, recomputed on add/remove).
import { TEAM_HEROES } from '../constants.js';

export const BUFFS = {
  whirl: { name: 'Tourbillon', icon: '🌀', stats(B) { B.speedMore(0.85); } },
  warcry: {
    name: 'Cri de guerre', icon: '📯',
    stats(B, v) { B.more(1 + (v.bonus || 25) / 100); B.taken(0.8); if (v.atkSpd) B.add('atkSpd', v.atkSpd); },
  },
  titan: {
    name: 'Colère du Titan', icon: '🗿',
    stats(B) { B.add('atkSpd', 30); B.taken(0.7); B.add('scale', 40); B.flag('warWave', 1); },
  },
  focus: {
    name: 'Concentration mortelle', icon: '👁️',
    stats(B, v) { B.add('atkSpd', v.atkSpd || 100); B.flag('focusExtra', Math.round(v.extra || 2)); B.flag('focusPierce', Math.round(v.pierce || 2)); },
  },
  wind: { name: 'Vent arrière', icon: '🍃', stats(B, v) { B.add('moveSpd', v.v); B.add('atkSpd', v.v); } },
  holycharge: { name: 'Charge sacrée', icon: '🐎', stats(B) { B.taken(0.7); } },
  channeling: { name: 'Canalisation', icon: '🩸', hidden: true, stats(B) { B.speedMore(0.6); } },
  ambush: {
    name: 'Embuscade', icon: '🗡️',
    hooks: {
      dmgMod(g, h, t, o, acc) { acc.crit += 100; },
      onCast(g, h, abId, slot) { if (slot === 0 || slot === 1) g.later(0.01, () => g.removeBuff(h, 'ambush')); },
    },
  },
  dance: {
    name: 'Danse des ombres', icon: '🌘',
    stats(B) { B.set('untargetable'); },
    onAdd(g, h, b) { b.hit = new Set(); b.next = 0; b.count = 0; h.untargetable = true; h.invulnT = Math.max(h.invulnT, 0.5); },
    tick(g, h, b, dt) {
      b.next -= dt;
      h.invulnT = Math.max(h.invulnT, 0.3);
      if (b.next > 0) return;
      b.next = b.v.step || 0.22;
      const t = g.nearestEnemy(TEAM_HEROES, h.x, h.z, b.v.range || 12, (m) => !b.hit.has(m.id));
      if (!t || b.count >= b.v.targets) { g.removeBuff(h, 'dance'); return; }
      b.hit.add(t.id);
      b.count++;
      const a = g.rng.angle();
      const x0 = h.x, z0 = h.z;
      g.forceMove(h, 'tp', { x: t.x + Math.cos(a) * (t.radius + 0.9), z: t.z + Math.sin(a) * (t.radius + 0.9) });
      h.rot = Math.atan2(t.z - h.z, t.x - h.x);
      h.setAnim(2, 0.2);
      g.fx('blink', { x1: +x0.toFixed(2), z1: +z0.toFixed(2), x2: +h.x.toFixed(2), z2: +h.z.toFixed(2), c: 'teal' });
      g.hit(h, t, b.v.coef, { type: 'phys', ability: 'x_dance', melee: true, critBonus: 25 });
      g.fx('slash', { x: +h.x.toFixed(2), z: +h.z.toFixed(2), a: +h.rot.toFixed(2), r: 2.4, arc: 140, c: 'teal', u: h.id });
      g.snd('hit', h.x, h.z);
      if (b.v.heal) g.heal(h, h.maxHp * b.v.heal / 100, h);
    },
    onRemove(g, h) { h.untargetable = false; h.invulnT = Math.max(h.invulnT, 0.4); },
  },
  // ---- aspects / uniques ----
  berserkKill: { name: 'Frénésie', icon: '😤', stack: true, maxStacks: 5, stats(B, v) { B.add('atkSpd', (v.v || 4) * (v.stacks || 1)); } },
  avenger: { name: 'Vengeance', icon: '⚔️', stack: true, maxStacks: 3, stats(B, v) { B.add('dmgPct', (v.v || 8) * (v.stacks || 1)); } },
  frenzy: { name: 'Lame frénétique', icon: '🌪️', stack: true, maxStacks: 15, stats(B, v) { B.add('atkSpd', 3 * (v.stacks || 1)); } },
  rage: { name: 'Rage', icon: '😡', stack: true, maxStacks: 20, stats(B, v) { B.add('dmgPct', 3 * (v.stacks || 1)); } },
  soulreaver: { name: 'Âmes dévorées', icon: '👻', stack: true, maxStacks: 50, stats(B, v) { B.add('dmgPct', 1 * (v.stacks || 1)); } },
  sanctuary: { name: 'Sanctuaire', icon: '🛐', stats(B, v) { B.add('dmgReduc', v.v || 20); } },
  arcaneCharge: { name: 'Charge arcanique', icon: '💠', stats(B) { B.more(1.5); }, hooks: { onCast(g, h, abId, slot) { if (slot >= 1 && slot <= 4) g.later(0.05, () => g.removeBuff(h, 'arcaneCharge')); } } },
  unity: { name: 'Unité', icon: '🤝', stats(B, v) { B.add('dmgPct', v.v || 10); } },
  rally: { name: 'Ralliement', icon: '🚩', stats(B) { B.add('atkSpd', 15); B.add('dmgReduc', 10); } },
  orbPower: { name: 'Sang chaud', icon: '🩸', stats(B) { B.add('dmgPct', 25); } },
  hunter: { name: 'Traque', icon: '🐺', stats(B) { B.add('moveSpd', 20); } },
};
