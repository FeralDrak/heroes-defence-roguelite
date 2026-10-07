// Unique items: fixed name, fixed affixes and a unique power. 75% are locked on a new profile.
import { TEAM_HEROES } from '../constants.js';
import { chainLightning, orbitTick, reduceCooldowns } from '../sim/helpers.js';
import { frostNova } from './classes/mage.js';
import { orbitalStrike } from './classes/engineer.js';
import { consecration, judgment } from './classes/paladin.js';
import { corrupt } from './classes/warlock.js';

const SLOT_ICON = { weapon: '⚔️', helm: '⛑️', chest: '🛡️', gloves: '🧤', boots: '👢', amulet: '📿', ring: '💍' };

function cdReady(g, h, slot) {
  h.cd[slot] = g.time;
  g.events.push({ e: 'cd', pid: h.pid, s: slot, d: 0, r: 0 });
}

export const UNIQUES_LIST = [
  // =========================================================================
  // GUERRIER
  // =========================================================================
  { id: 'u_w_axe_ancestors', name: 'Hache des Ancêtres', slot: 'weapon', cls: 'warrior', icon: '🪓',
    lore: 'Forgée dans la foudre, elle porte les cris des rois morts.',
    affixes: [['dmgPct', 15, 25], ['critDmg', 15, 30]],
    desc: "Fendoir libère une onde de choc vers l'avant.", stats(B) { B.flag('warWave', 1); } },
  { id: 'u_w_sword_juggernaut', name: 'Lame du Juggernaut', slot: 'weapon', cls: 'warrior', icon: '🗡️',
    lore: 'Plus on la porte lourdement, plus elle frappe fort.',
    affixes: [['armor', 10, 18], ['maxHp', 15, 25]],
    desc: '+1% de dégâts par tranche de {v} points d\'armure.', vals: { v: [12, 8] },
    hooks: { dmgMod(g, h, t, o, acc, v) { acc.inc += Math.min(150, h.S.armor / Math.max(1, v.v)); } } },
  { id: 'u_w_helm_bull', name: 'Heaume du Taureau', slot: 'helm', cls: 'warrior', icon: '🐂',
    lore: 'Les cornes ne servent pas qu\'à décorer.',
    affixes: [['armor', 8, 14], ['maxHpPct', 6, 10]],
    desc: 'Charge parcourt +80% de distance et inflige +{v}% de dégâts.', vals: { v: [150, 250] },
    stats(B, v) { B.amod('w_charge', 'dist', 0, 80); B.amod('w_charge', 'dmg', v.v); } },
  { id: 'u_w_chest_crimson', name: 'Cuirasse Écarlate', slot: 'chest', cls: 'warrior', icon: '🩸',
    lore: 'Taillée pour ceux qui ne cessent jamais de tourner.',
    affixes: [['armor', 10, 16], ['maxHp', 16, 26]],
    desc: 'Tourbillon : temps de recharge -70%, durée -40%, dégâts +{v}%.', vals: { v: [20, 40] },
    stats(B, v) { B.amod('w_whirl', 'cd', 0, -70); B.amod('w_whirl', 'dur', 0, -40); B.amod('w_whirl', 'dmg', v.v); } },
  { id: 'u_w_gloves_titan', name: 'Poignes du Titan', slot: 'gloves', cls: 'warrior', icon: '✊',
    lore: 'La colère d\'un titan ne s\'éteint jamais vraiment.',
    affixes: [['atkSpd', 6, 10], ['armor', 6, 10]],
    desc: 'Chaque élimination prolonge Colère du Titan de {v} s.', vals: { v: [0.3, 0.6] }, dec: 1,
    hooks: { onKill(g, h, m, info, v) { const b = h.buffs.find((x) => x.id === 'titan'); if (b) b.t = Math.min(b.t + v.v, 30); } } },
  { id: 'u_w_boots_quake', name: 'Bottes du Séisme', slot: 'boots', cls: 'warrior', icon: '🌋',
    lore: 'Chaque pas fait trembler l\'arène.',
    affixes: [['moveSpd', 5, 8], ['armor', 6, 10]],
    desc: 'Bond recharge instantanément Charge et étourdit +{v} s.', vals: { v: [0.5, 1] }, dec: 1,
    stats(B, v) { B.flag('leapResetCharge'); B.amod('w_leap', 'stun', v.v); } },
  { id: 'u_w_amulet_warlord', name: 'Talisman du Seigneur de guerre', slot: 'amulet', cls: 'warrior', icon: '📯',
    lore: 'Ses ordres résonnent au-delà de la mort.',
    affixes: [['dmgPct', 8, 14], ['res', 6, 10]],
    desc: "Cri de guerre dure 2 fois plus longtemps et octroie +{v}% de vitesse d'attaque.", vals: { v: [20, 35] },
    stats(B, v) { B.amod('w_warcry', 'dur', 0, 100); B.amod('w_warcry', 'atkSpd', v.v); } },
  { id: 'u_w_ring_blood', name: 'Anneau du Sang versé', slot: 'ring', cls: 'warrior', icon: '💍',
    lore: 'Chaque goutte versée nourrit le porteur.',
    affixes: [['lifeSteal', 1, 2], ['critChance', 2, 4]],
    desc: 'Fendoir fait saigner (40%) et vos saignements vous soignent de {v}% de leurs dégâts.', vals: { v: [30, 50] },
    stats(B, v) { B.amod('w_cleave', 'bleed', 40); B.add('bleedLeech', v.v); } },

  // =========================================================================
  // ARCHÈRE
  // =========================================================================
  { id: 'u_a_bow_windforce', name: 'Arc Rafale', slot: 'weapon', cls: 'archer', icon: '🏹',
    lore: 'Le vent lui-même encoche les flèches.',
    affixes: [['atkSpd', 6, 12], ['critChance', 3, 5]],
    desc: 'Tir lance 2 flèches supplémentaires, mais chaque flèche inflige -{v}% de dégâts.', vals: { v: [30, 20] },
    stats(B, v) { B.amod('a_shot', 'count', 2); B.amod('a_shot', 'dmg', -v.v); } },
  { id: 'u_a_bow_starfall', name: "Chute-d'Étoiles", slot: 'weapon', cls: 'archer', icon: '🌠',
    lore: 'Un arc taillé dans un fragment d\'étoile.',
    affixes: [['dmgPct', 12, 20], ['cdr', 4, 8]],
    desc: 'Tir multiple tire une couronne de flèches tout autour de vous et inflige +{v}% de dégâts.', vals: { v: [20, 40] },
    stats(B, v) { B.flag('multiRing'); B.amod('a_multi', 'dmg', v.v); } },
  { id: 'u_a_helm_hawk', name: 'Capuche du Faucon', slot: 'helm', cls: 'archer', icon: '🦅',
    lore: 'Aucune proie n\'échappe à son regard.',
    affixes: [['critChance', 3, 5], ['maxHp', 12, 20]],
    desc: 'Vos flèches traquent les ennemis. +{v}% de dégâts critiques.', vals: { v: [20, 35] },
    stats(B, v) { B.flag('homing'); B.add('critDmg', v.v); } },
  { id: 'u_a_gloves_quickdraw', name: 'Gants Dégaine-Éclair', slot: 'gloves', cls: 'archer', icon: '🧤',
    lore: 'Plus vite que son ombre.',
    affixes: [['atkSpd', 6, 10], ['critDmg', 12, 20]],
    desc: 'Après une Roulade, vos 3 prochains Tirs sont des coups critiques. Roulade -{v}% de recharge.', vals: { v: [10, 20] },
    stats(B, v) { B.flag('quickdraw'); B.amod('a_roll', 'cd', 0, -v.v); } },
  { id: 'u_a_boots_ranger', name: 'Bottes du Rôdeur', slot: 'boots', cls: 'archer', icon: '👢',
    lore: 'Laissent derrière elles plus que des empreintes.',
    affixes: [['moveSpd', 6, 9], ['dodge', 2, 4]],
    desc: 'Roulade dépose un Piège givrant. Les pièges infligent +{v}% de dégâts.', vals: { v: [20, 40] },
    stats(B, v) { B.flag('rollTrap'); B.amod('a_trap', 'dmg', v.v); } },
  { id: 'u_a_chest_trapper', name: 'Tunique du Trappeur', slot: 'chest', cls: 'archer', icon: '🦺',
    lore: 'Chaque poche cache un mécanisme.',
    affixes: [['maxHp', 14, 22], ['dodge', 2, 4]],
    desc: 'Vos pièges explosent deux fois. +{v} piège maximum.', vals: { v: [1, 2] }, dec: 0,
    stats(B, v) { B.flag('trapDouble'); B.amod('a_trap', 'max', v.v); } },
  { id: 'u_a_amulet_quiver', name: 'Carquois Inépuisable', slot: 'amulet', cls: 'archer', icon: '🎯',
    lore: 'On n\'a jamais vu son fond.',
    affixes: [['dmgPct', 8, 14], ['atkSpd', 4, 8]],
    desc: 'Tuer un élite déclenche Concentration mortelle pendant {v} s.', vals: { v: [3, 5] }, dec: 1,
    hooks: { onKill(g, h, m, info, v) { if (m.elite || m.boss) { const P = h.P.a_focus; if (P) g.addBuff(h, 'focus', v.v, { atkSpd: P.atkSpd, extra: P.extra, pierce: P.pierce }); } } } },
  { id: 'u_a_ring_split', name: 'Anneau de Ramification', slot: 'ring', cls: 'archer', icon: '💍',
    lore: 'Une flèche, trois destins.',
    affixes: [['critChance', 2, 4], ['dmgPhys', 10, 16]],
    desc: 'Vos Tirs se divisent en 3 flèches au premier impact. +{v}% dégâts de Tir.', vals: { v: [10, 20] },
    stats(B, v) { B.flag('arrowSplit'); B.amod('a_shot', 'dmg', v.v); } },

  // =========================================================================
  // MAGE
  // =========================================================================
  { id: 'u_m_staff_inferno', name: "Bâton de l'Inferno", slot: 'weapon', cls: 'mage', icon: '🔥',
    lore: 'Il brûle même ceux qui le regardent.',
    affixes: [['dmgFire', 15, 25], ['dmgPct', 10, 15]],
    desc: 'Projectile arcanique devient une boule de feu explosive. +{v}% de dégâts de feu.', vals: { v: [10, 25] },
    stats(B, v) { B.flag('boltInferno'); B.add('dmgFire', v.v); } },
  { id: 'u_m_staff_frostbite', name: 'Sceptre Mordgivre', slot: 'weapon', cls: 'mage', icon: '❄️',
    lore: 'L\'hiver éternel tient dans une main.',
    affixes: [['dmgCold', 15, 25], ['cdr', 4, 8]],
    desc: 'Nova de givre se déclenche automatiquement toutes les {v} s.', vals: { v: [7, 5] }, dec: 1,
    hooks: { tick(g, h, dt, v, st) { if (g.phase !== 'wave') return; st.t = (st.t ?? v.v) - dt; if (st.t <= 0) { st.t = v.v; frostNova(g, h, h.P.m_nova, h.x, h.z, 0.8); } } } },
  { id: 'u_m_helm_tempest', name: 'Couronne de la Tempête', slot: 'helm', cls: 'mage', icon: '⚡',
    lore: 'Les orages s\'inclinent devant elle.',
    affixes: [['dmgLight', 12, 20], ['maxHp', 10, 18]],
    desc: "Chaîne d'éclairs rebondit +{v} fois et peut toucher plusieurs fois le même ennemi.", vals: { v: [4, 7] }, dec: 0,
    stats(B, v) { B.amod('m_chain', 'bounces', v.v); B.flag('chainRepeat'); } },
  { id: 'u_m_chest_phoenix', name: 'Robe du Phénix', slot: 'chest', cls: 'mage', icon: '🔥',
    lore: 'Des cendres, toujours, elle renaît.',
    affixes: [['res', 8, 14], ['maxHp', 14, 22]],
    desc: 'Une fois par vague, une blessure mortelle vous fait renaître avec {v}% de PV dans une explosion de flammes.', vals: { v: [40, 60] },
    hooks: {
      onLethal(g, h, acc, v, st) {
        if (st.wave === g.wave) return;
        st.wave = g.wave;
        acc.prevent = true;
        h.hp = h.maxHp * v.v / 100;
        h.invulnT = 2;
        g.explode(h, h.x, h.z, 6, 4, { type: 'fire', color: 'fire', proc: true, snd: 'meteor', knock: 8 });
        g.fx('text', { u: h.id, s: 'Renaissance !', c: '#ffb050' });
      },
    } },
  { id: 'u_m_gloves_astro', name: "Mitaines de l'Astrologue", slot: 'gloves', cls: 'mage', icon: '🧤',
    lore: 'Les étoiles répondent à ses gestes.',
    affixes: [['critChance', 3, 5], ['dmgFire', 10, 16]],
    desc: "Boule de feu a {v}% de chances d'invoquer un petit Météore à l'impact.", vals: { v: [15, 30] },
    stats(B, v) { B.flag('fireballMeteor', v.v); } },
  { id: 'u_m_boots_phase', name: 'Pantoufles de Déphasage', slot: 'boots', cls: 'mage', icon: '🥿',
    lore: 'Elles ne touchent jamais vraiment le sol.',
    affixes: [['moveSpd', 5, 8], ['res', 5, 9]],
    desc: 'Transfert : temps de recharge -70%, mais coûte {v}% de vos PV max.', vals: { v: [6, 3] },
    stats(B, v) { B.amod('m_blink', 'cd', 0, -70); B.amod('m_blink', 'hpCost', v.v); } },
  { id: 'u_m_amulet_archmage', name: "Pendentif de l'Archimage", slot: 'amulet', cls: 'mage', icon: '🔮',
    lore: 'Il murmure les formules à votre place.',
    affixes: [['cdr', 5, 9], ['dmgArcane', 10, 18]],
    desc: '{v}% de chances que vos compétences ne se rechargent pas.', vals: { v: [12, 20] },
    stats(B, v) { B.add('freeCast', v.v); } },
  { id: 'u_m_ring_frozenheart', name: 'Anneau du Cœur gelé', slot: 'ring', cls: 'mage', icon: '💍',
    lore: 'Froid comme la tombe, dur comme le diamant.',
    affixes: [['dmgCold', 10, 16], ['critDmg', 10, 18]],
    desc: "Les ennemis gelés ou glacés explosent à leur mort ({v}% des dégâts de l'arme en froid).", vals: { v: [100, 180] },
    hooks: { onKill(g, h, m, info, v) { if (info.proc) return; if (m.st.freeze > 0 || (m.st.chill && m.st.chill.t > 0)) g.explode(h, m.x, m.z, 3, v.v / 100, { type: 'cold', status: 'chill', statusOpts: { v: 0.4, dur: 2 }, color: 'cold', proc: true, snd: 'freeze' }); } } },

  // =========================================================================
  // INVOCATEUR
  // =========================================================================
  { id: 'u_n_scythe_reaper', name: 'Faux de la Faucheuse', slot: 'weapon', cls: 'summoner', icon: '⚰️',
    lore: 'Elle récolte, puis elle relève.',
    affixes: [['summonDmg', 15, 25], ['dmgShadow', 10, 16]],
    desc: "Les ennemis tués par Trait d'ombre se relèvent en squelettes pendant 8 s. +{v}% de dégâts de Trait d'ombre.", vals: { v: [20, 40] },
    stats(B, v) { B.flag('reaperBolt'); B.amod('n_bolt', 'dmg', v.v); } },
  { id: 'u_n_staff_bones', name: 'Sceptre des Ossements', slot: 'weapon', cls: 'summoner', icon: '🦴',
    lore: 'Chaque os qu\'il touche se relève.',
    affixes: [['summonHp', 15, 25], ['summonDmg', 10, 18]],
    desc: 'Lever les morts relève 2 squelettes et +{v} squelettes maximum.', vals: { v: [2, 3] }, dec: 0,
    stats(B, v) { B.amod('n_skel', 'count', 1); B.amod('n_skel', 'max', v.v); } },
  { id: 'u_n_helm_lich', name: 'Couronne de la Liche', slot: 'helm', cls: 'summoner', icon: '👑',
    lore: 'Ceux qui la portent oublient le sens du mot "mort".',
    affixes: [['summonDmg', 10, 16], ['maxHp', 12, 20]],
    desc: 'Vos mages squelettes sont permanents. +{v}% de dégâts des serviteurs.', vals: { v: [10, 20] },
    stats(B, v) { B.flag('permMages'); B.add('summonDmg', v.v); } },
  { id: 'u_n_chest_grave', name: 'Linceul du Tombeau', slot: 'chest', cls: 'summoner', icon: '⚰️',
    lore: 'Il sent la terre fraîchement retournée.',
    affixes: [['maxHp', 14, 22], ['summonHp', 12, 20]],
    desc: 'Explosion de cadavres crée jusqu\'à 3 cadavres si besoin. +{v}% de dégâts.', vals: { v: [15, 30] },
    stats(B, v) { B.flag('graveShroud'); B.amod('n_corpse', 'dmg', v.v); } },
  { id: 'u_n_gloves_puppet', name: 'Gants du Marionnettiste', slot: 'gloves', cls: 'summoner', icon: '🧤',
    lore: 'Les fils sont invisibles, mais bien là.',
    affixes: [['summonDmg', 10, 16], ['critChance', 2, 4]],
    desc: "Vos serviteurs vous soignent de 3% des dégâts qu'ils infligent et gagnent +{v}% de vitesse d'attaque.", vals: { v: [20, 35] },
    stats(B, v) { B.add('minionLeech', 3); B.add('summonAtkSpd', v.v); } },
  { id: 'u_n_boots_ghoul', name: 'Bottes de la Goule', slot: 'boots', cls: 'summoner', icon: '👢',
    lore: 'Elles marchent avec toute une armée.',
    affixes: [['moveSpd', 5, 8], ['summonHp', 10, 16]],
    desc: "Pas de l'ombre téléporte vos serviteurs à vos côtés et les soigne. +{v}% de vitesse des serviteurs.", vals: { v: [10, 20] },
    stats(B, v) { B.flag('ghoulBoots'); B.add('summonSpd', v.v); } },
  { id: 'u_n_amulet_golem', name: 'Cœur du Golem', slot: 'amulet', cls: 'summoner', icon: '💀',
    lore: 'Il bat encore, lentement.',
    affixes: [['summonHp', 15, 25], ['armor', 8, 12]],
    desc: "Golem d'os reste jusqu'à sa destruction. +{v}% de PV du Golem.", vals: { v: [20, 40] },
    stats(B, v) { B.flag('golemPerm'); B.amod('n_golem', 'hpMul', 0, v.v); } },
  { id: 'u_n_ring_bone', name: "Anneau d'Os", slot: 'ring', cls: 'summoner', icon: '💍',
    lore: 'Taillé dans la phalange d\'un roi.',
    affixes: [['summonDmg', 10, 16], ['cdr', 3, 6]],
    desc: "Quand un serviteur meurt, il explose ({v}% des dégâts de l'arme) et Lever les morts se recharge.", vals: { v: [150, 250] },
    hooks: { onMinionDeath(g, h, u, v) { if (u.structure) return; g.explode(h, u.x, u.z, 3, v.v / 100, { type: 'shadow', summon: true, color: 'blood', snd: 'pop' }); cdReady(g, h, 1); } } },

  // =========================================================================
  // INGÉNIEUR
  // =========================================================================
  { id: 'u_e_gun_minigun', name: 'Mitrailleuse Grondante', slot: 'weapon', cls: 'engineer', icon: '🔫',
    lore: 'Le bruit seul fait fuir les plus faibles.',
    affixes: [['atkSpd', 8, 14], ['dmgPhys', 10, 18]],
    desc: 'Pistolet à rivets tire 2 fois plus vite mais inflige -{v}% de dégâts. -10% de vitesse de déplacement.', vals: { v: [35, 25] },
    stats(B, v) { B.amod('e_rivet', 'interval', 0, -50); B.amod('e_rivet', 'dmg', -v.v); B.add('moveSpd', -10); } },
  { id: 'u_e_wrench_master', name: 'Clé du Maître-artisan', slot: 'weapon', cls: 'engineer', icon: '🔧',
    lore: 'Elle n\'a jamais rencontré un boulon qu\'elle ne pouvait serrer.',
    affixes: [['summonDmg', 15, 25], ['summonHp', 12, 20]],
    desc: '+1 tourelle maximum, les tirs de tourelle transpercent. +{v}% de dégâts des tourelles.', vals: { v: [15, 30] },
    stats(B, v) { B.amod('e_turret', 'max', 1); B.flag('turretPierce'); B.amod('e_turret', 'coef', 0, v.v); } },
  { id: 'u_e_helm_goggles', name: 'Lunettes de Visée', slot: 'helm', cls: 'engineer', icon: '🥽',
    lore: 'Calibrées au millimètre.',
    affixes: [['critChance', 3, 5], ['summonDmg', 8, 14]],
    desc: "Portée des tourelles +50%. Leurs coups critiques explosent ({v}% des dégâts).", vals: { v: [60, 100] },
    stats(B, v) { B.amod('e_turret', 'reach', 0, 50); B.flag('turretCritBoom', v.v); } },
  { id: 'u_e_chest_battery', name: 'Armure-Batterie', slot: 'chest', cls: 'engineer', icon: '🔋',
    lore: 'Chargée à bloc, en permanence.',
    affixes: [['armor', 10, 16], ['dmgLight', 12, 20]],
    desc: 'Votre Bobine Tesla est fixée sur vous et vous suit. +{v}% de dégâts de la Bobine.', vals: { v: [20, 40] },
    stats(B, v) { B.flag('teslaCarry'); B.amod('e_tesla', 'coef', 0, v.v); } },
  { id: 'u_e_gloves_demo', name: 'Gants du Démolisseur', slot: 'gloves', cls: 'engineer', icon: '🧨',
    lore: 'Toujours un peu roussis.',
    affixes: [['dmgFire', 10, 18], ['area', 6, 10]],
    desc: 'Grenade rebondit {v} fois, explosant à chaque rebond.', vals: { v: [2, 3] }, dec: 0,
    stats(B, v) { B.flag('grenadeBounce', v.v); } },
  { id: 'u_e_boots_jet', name: 'Bottes à Réaction', slot: 'boots', cls: 'engineer', icon: '🚀',
    lore: 'Le carburant n\'est pas fourni.',
    affixes: [['moveSpd', 6, 9], ['dmgFire', 8, 14]],
    desc: "Saut propulsé : +50% de distance et l'explosion se produit aussi à l'atterrissage. +{v}% de dégâts.", vals: { v: [20, 40] },
    stats(B, v) { B.amod('e_jump', 'dist', 0, 50); B.flag('jetLand'); B.amod('e_jump', 'dmg', v.v); } },
  { id: 'u_e_amulet_core', name: 'Noyau de Fusion', slot: 'amulet', cls: 'engineer', icon: '☢️',
    lore: 'Manipuler avec une extrême prudence.',
    affixes: [['summonHp', 12, 20], ['dmgFire', 10, 16]],
    desc: "Vos structures explosent quand elles expirent ou sont détruites ({v}% des dégâts de l'arme).", vals: { v: [250, 400] },
    hooks: { onMinionDeath(g, h, u, v) { if (!u.structure || u.type === 'drone') return; g.explode(h, u.x, u.z, 4, v.v / 100, { type: 'fire', summon: true, color: 'fire', knock: 6 }); } } },
  { id: 'u_e_ring_satellite', name: 'Anneau Satellite', slot: 'ring', cls: 'engineer', icon: '🛰️',
    lore: 'Quelque chose, là-haut, vous protège.',
    affixes: [['cdr', 4, 7], ['dmgElite', 10, 16]],
    desc: 'Toutes les {v} s, une frappe orbitale réduite vise l\'élite ou le boss le plus proche.', vals: { v: [20, 14] },
    hooks: {
      tick(g, h, dt, v, st) {
        if (g.phase !== 'wave') return;
        st.t = (st.t ?? v.v) - dt;
        if (st.t > 0) return;
        const t = g.nearestEnemy(TEAM_HEROES, h.x, h.z, 30, (m) => m.elite || m.boss);
        if (!t) { st.t = 1; return; }
        st.t = v.v;
        const P = h.P.e_orbital;
        orbitalStrike(g, h, P, t.x, t.z, Math.max(4, Math.round(P.missiles / 2)));
      },
    } },

  // =========================================================================
  // PALADIN
  // =========================================================================
  { id: 'u_p_hammer_dawn', name: "Marteau de l'Aube", slot: 'weapon', cls: 'paladin', icon: '🔨',
    lore: 'Chaque coup fait lever un soleil.',
    affixes: [['dmgHoly', 15, 25], ['atkSpd', 5, 9]],
    desc: 'Coup de marteau libère un marteau béni qui tournoie en spirale autour de vous. +{v}% de dégâts sacrés.', vals: { v: [10, 20] },
    stats(B, v) { B.flag('dawnHammer'); B.add('dmgHoly', v.v); } },
  { id: 'u_p_mace_justice', name: 'Masse de la Justice', slot: 'weapon', cls: 'paladin', icon: '⚖️',
    lore: 'La sentence tombe, sans appel.',
    affixes: [['dmgPct', 12, 20], ['dmgElite', 10, 16]],
    desc: 'Bouclier vengeur se divise en 3 au premier impact. +{v}% de dégâts.', vals: { v: [15, 30] },
    stats(B, v) { B.flag('shieldSplit'); B.amod('p_shield', 'dmg', v.v); } },
  { id: 'u_p_helm_halo', name: 'Auréole du Martyr', slot: 'helm', cls: 'paladin', icon: '😇',
    lore: 'Une lumière qui ne s\'éteint pas.',
    affixes: [['maxHp', 14, 22], ['res', 6, 10]],
    desc: 'Une Consécration réduite ({v}% d\'efficacité) vous entoure en permanence.', vals: { v: [40, 60] },
    hooks: {
      tick(g, h, dt, v, st) {
        if (st.area && st.area.alive) return;
        st.area = consecration(g, h, Object.assign({}, h.P.p_consecrate, { dur: 9999 }), h.x, h.z, true, v.v / 100, 0.75);
      },
    } },
  { id: 'u_p_chest_bastion', name: 'Plastron du Bastion', slot: 'chest', cls: 'paladin', icon: '🏰',
    lore: 'Aucun mur n\'a jamais tenu aussi bien.',
    affixes: [['armor', 12, 18], ['maxHpPct', 6, 10]],
    desc: "Égide rend invulnérable pendant 1,5 s et octroie +{v}% de bouclier.", vals: { v: [20, 40] },
    stats(B, v) { B.amod('p_aegis', 'invuln', 1.5); B.amod('p_aegis', 'self', 0, v.v); B.amod('p_aegis', 'ally', 0, v.v); } },
  { id: 'u_p_gloves_light', name: 'Gantelets de Lumière', slot: 'gloves', cls: 'paladin', icon: '🧤',
    lore: 'Ils soignent et punissent d\'un même geste.',
    affixes: [['healRecv', 8, 14], ['dmgHoly', 10, 16]],
    desc: 'Quand vous soignez un allié, les ennemis proches de lui subissent {v}% du montant en dégâts sacrés.', vals: { v: [100, 180] },
    hooks: {
      onHealOther(g, h, target, amount, v, st) {
        if ((st.t || 0) > g.time) return;
        st.t = g.time + 0.25;
        for (const m of g.enemiesInRadius(TEAM_HEROES, target.x, target.z, 4)) g.dealDamage(h, m, amount * v.v / 100, { type: 'holy', hero: h, ally: true, proc: true });
      },
    } },
  { id: 'u_p_boots_crusade', name: 'Solerets de la Croisade', slot: 'boots', cls: 'paladin', icon: '👢',
    lore: 'Ils sanctifient chaque pas.',
    affixes: [['moveSpd', 5, 8], ['armor', 6, 10]],
    desc: 'Charge sacrée laisse une traînée de terre consacrée. Charge -{v}% de recharge.', vals: { v: [15, 30] },
    stats(B, v) { B.flag('crusadeTrail'); B.amod('p_charge', 'cd', 0, -v.v); } },
  { id: 'u_p_amulet_sun', name: 'Médaillon du Soleil', slot: 'amulet', cls: 'paladin', icon: '☀️',
    lore: 'Il se lève même au cœur de la nuit.',
    affixes: [['cdr', 5, 9], ['healRecv', 8, 14]],
    desc: "Jugement céleste se recharge {v}% plus vite et se déclenche automatiquement quand un allié tombe (s'il est prêt).", vals: { v: [30, 50] },
    stats(B, v) { B.amod('p_judgment', 'cd', 0, -v.v); },
    hooks: {
      onAllyDown(g, h, ally) {
        if (g.time < h.cd[4] || h.downed) return;
        const P = h.P.p_judgment;
        judgment(g, h, P, ally.x, ally.z);
        h.cd[4] = g.time + P.cd;
        g.events.push({ e: 'cd', pid: h.pid, s: 4, d: P.cd, r: P.cd });
      },
    } },
  { id: 'u_p_ring_oath', name: 'Anneau du Serment', slot: 'ring', cls: 'paladin', icon: '💍',
    lore: 'Jurer de protéger, quoi qu\'il en coûte.',
    affixes: [['armor', 8, 14], ['maxHp', 12, 20]],
    desc: "{v}% des dégâts subis par les alliés proches vous sont transférés. +30% d'armure.", vals: { v: [20, 30] },
    stats(B, v) { B.add('armorPct', 30); B.set('oath', v.v); } },

  // =========================================================================
  // ASSASSINE
  // =========================================================================
  { id: 'u_x_dagger_venom', name: 'Croc de la Vipère', slot: 'weapon', cls: 'assassin', icon: '🐍',
    lore: 'Une seule morsure suffit. Les autres sont pour le plaisir.',
    affixes: [['dmgPoison', 15, 25], ['poisonChance', 8, 14]],
    desc: 'Vos poisons se cumulent sans limite et se propagent à la mort de la cible. +{v}% de dégâts de poison.', vals: { v: [15, 30] },
    stats(B, v) { B.add('poisonStacks', 40); B.add('dmgPoison', v.v); },
    hooks: {
      onKill(g, h, m) {
        const p = m.st.poison;
        if (!p || !p.length) return;
        const dps = p.reduce((s, x) => s + x.dps, 0);
        for (const o of g.enemiesInRadius(TEAM_HEROES, m.x, m.z, 5).slice(0, 3)) g.applyStatus(o, 'poison', { dps: dps * 0.5, dur: 4, hero: h });
      },
    } },
  { id: 'u_x_dagger_shadow', name: "Lame de l'Ombre", slot: 'weapon', cls: 'assassin', icon: '🗡️',
    lore: 'Elle frappe là où on ne l\'attend pas.',
    affixes: [['critChance', 4, 7], ['critDmg', 15, 25]],
    desc: 'Lames jumelles projettent aussi un couteau sur l\'ennemi le plus proche. +{v}% de dégâts.', vals: { v: [10, 20] },
    stats(B, v) { B.flag('shadowBlade'); B.amod('x_blades', 'dmg', v.v); } },
  { id: 'u_x_helm_mask', name: 'Masque Sans-Visage', slot: 'helm', cls: 'assassin', icon: '🎭',
    lore: 'Personne ne se souvient de son visage. Ni de rien d\'autre.',
    affixes: [['critChance', 3, 5], ['dodge', 2, 4]],
    desc: 'Tuer un ennemi vous rend invisible pendant 1 s (toutes les {v} s au plus).', vals: { v: [5, 3] },
    hooks: { onKill(g, h, m, info, v, st) { if ((st.t || 0) > g.time) return; st.t = g.time + v.v; h.stealthT = Math.max(h.stealthT, 1); h.stateDirty = true; for (const o of g.monsters) if (o.target === h) o.target = null; } } },
  { id: 'u_x_chest_shroud', name: 'Linceul de Brume', slot: 'chest', cls: 'assassin', icon: '🌫️',
    lore: 'Tissé de brouillard et de mensonges.',
    affixes: [['dodge', 3, 5], ['maxHp', 12, 20]],
    desc: 'La fumée de Bombe fumigène empoisonne les ennemis et soigne les alliés. Durée +{v} s.', vals: { v: [1, 2] }, dec: 1,
    stats(B, v) { B.flag('mistShroud'); B.amod('x_smoke', 'dur', v.v); } },
  { id: 'u_x_gloves_garrote', name: 'Gants du Garrotteur', slot: 'gloves', cls: 'assassin', icon: '🧤',
    lore: 'Silencieux. Efficaces.',
    affixes: [['critDmg', 12, 20], ['atkSpd', 5, 9]],
    desc: 'Marque mortelle se recharge instantanément si la cible marquée meurt. La marque stocke +{v}% de dégâts.', vals: { v: [10, 20] },
    stats(B, v) { B.amod('x_mark', 'pct', v.v); },
    hooks: { onKill(g, h, m) { if (m.st.mark && m.st.mark.t > 0 && m.st.mark.hero === h) cdReady(g, h, 3); } } },
  { id: 'u_x_boots_phantom', name: 'Bottes du Fantôme', slot: 'boots', cls: 'assassin', icon: '👻',
    lore: 'On les entend partir, jamais arriver.',
    affixes: [['moveSpd', 6, 9], ['dodge', 2, 4]],
    desc: "Ruée de l'ombre laisse une image rémanente qui provoque les ennemis pendant 2,5 s. Ruée -{v}% de recharge.", vals: { v: [10, 25] },
    stats(B, v) { B.flag('phantomDecoy'); B.amod('x_shadowdash', 'cd', 0, -v.v); } },
  { id: 'u_x_amulet_eclipse', name: "Amulette de l'Éclipse", slot: 'amulet', cls: 'assassin', icon: '🌑',
    lore: 'Le soleil se cache quand elle danse.',
    affixes: [['critChance', 3, 5], ['cdr', 4, 8]],
    desc: 'Danse des ombres frappe 2 fois plus de cibles et vous soigne de 5% par coup. +{v}% de dégâts.', vals: { v: [15, 30] },
    stats(B, v) { B.flag('eclipse'); B.amod('x_dance', 'dmg', v.v); } },
  { id: 'u_x_ring_cutthroat', name: 'Anneau du Coupe-gorge', slot: 'ring', cls: 'assassin', icon: '💍',
    lore: 'Un bijou discret pour un métier discret.',
    affixes: [['critChance', 2, 4], ['critDmg', 10, 18]],
    desc: 'Vos coups critiques ont {v}% de chances d\'infliger 4 fois leurs dégâts.', vals: { v: [8, 14] },
    hooks: { onCrit(g, h, t, info, dealt, v) { if (t.alive && g.rng.next() * 100 < v.v) { g.dealDamage(h, t, dealt * 3, { type: info.type, hero: h, ally: true, proc: true, crit: true }); g.fx('text', { u: t.id, s: 'Égorgé !', c: '#ff4040' }); } } } },

  // =========================================================================
  // DÉMONISTE
  // =========================================================================
  { id: 'u_k_staff_abyss', name: "Bâton de l'Abîme", slot: 'weapon', cls: 'warlock', icon: '🦯',
    lore: 'Il regarde dans l\'abîme. L\'abîme répond.',
    affixes: [['dmgShadow', 15, 25], ['dotDmg', 10, 18]],
    desc: 'Trait corrompu transperce les ennemis et applique un cumul de Corruption supplémentaire. +{v}% de dégâts.', vals: { v: [10, 20] },
    stats(B, v) { B.flag('abyssBolt'); B.amod('k_bolt', 'dmg', v.v); } },
  { id: 'u_k_tome_souls', name: 'Grimoire des Âmes', slot: 'weapon', cls: 'warlock', icon: '📓',
    lore: 'Chaque page est une âme. Il en manque toujours une.',
    affixes: [['dmgShadow', 12, 20], ['lifeSteal', 1, 2]],
    desc: 'Drain de vie peut être canalisé indéfiniment. +{v}% de soins du Drain.', vals: { v: [20, 40] },
    stats(B, v) { B.flag('soulTome'); B.amod('k_drain', 'heal', 0, v.v); } },
  { id: 'u_k_helm_horns', name: "Cornes de l'Archidémon", slot: 'helm', cls: 'warlock', icon: '😈',
    lore: 'Arrachées à un prince des abysses. Il les réclame encore.',
    affixes: [['summonDmg', 10, 16], ['maxHp', 12, 20]],
    desc: 'Portail infernal invoque 2 infernaux (60% de puissance chacun). +{v}% de durée.', vals: { v: [20, 40] },
    stats(B, v) { B.amod('k_infernal', 'count', 1); B.amod('k_infernal', 'dur', 0, v.v); } },
  { id: 'u_k_chest_pact', name: 'Robe du Pacte', slot: 'chest', cls: 'warlock', icon: '📜',
    lore: 'Signée de sang, scellée par la peur.',
    affixes: [['res', 8, 14], ['dotDmg', 10, 16]],
    desc: 'Les ennemis que vous corrompez sont aussi affaiblis par Malédiction de faiblesse. +{v}% de dégâts sur la durée.', vals: { v: [10, 20] },
    stats(B, v) { B.flag('pactCurse'); B.add('dotDmg', v.v); } },
  { id: 'u_k_gloves_plague', name: 'Mains de la Peste', slot: 'gloves', cls: 'warlock', icon: '🧤',
    lore: 'Ne serrez jamais ces mains.',
    affixes: [['dotDmg', 10, 18], ['dmgShadow', 8, 14]],
    desc: 'Fléau laisse une zone pestilentielle 4 s qui corrompt chaque seconde. Zone +{v}%.', vals: { v: [15, 30] },
    stats(B, v) { B.flag('plagueHands'); B.amod('k_plague', 'radius', 0, v.v); } },
  { id: 'u_k_boots_void', name: 'Bottes du Vide', slot: 'boots', cls: 'warlock', icon: '🕳️',
    lore: 'Elles ne laissent qu\'un trou noir derrière elles.',
    affixes: [['moveSpd', 5, 8], ['res', 5, 9]],
    desc: "Pas démoniaque se recharge 50% plus vite et sa flaque attire les ennemis. Flaque +{v}% de dégâts.", vals: { v: [30, 60] },
    stats(B, v) { B.amod('k_shadowstep', 'cd', 0, -50); B.flag('voidBoots'); B.amod('k_shadowstep', 'poolCoef', 0, v.v); } },
  { id: 'u_k_amulet_heart', name: 'Cœur Noir', slot: 'amulet', cls: 'warlock', icon: '🖤',
    lore: 'Il bat au rythme des agonies.',
    affixes: [['dotDmg', 10, 16], ['maxHp', 12, 20]],
    desc: 'Les ennemis qui meurent corrompus vous soignent de {v}% de vos PV max.', vals: { v: [1.5, 3] }, dec: 1,
    hooks: { onKill(g, h, m, info, v) { if (m.st.corrupt && m.st.corrupt.stacks > 0) g.heal(h, h.maxHp * v.v / 100, h); } } },
  { id: 'u_k_ring_doom', name: 'Anneau du Destin', slot: 'ring', cls: 'warlock', icon: '💍',
    lore: 'Ceux qu\'il désigne ne voient pas l\'aube.',
    affixes: [['dmgShadow', 10, 16], ['cdr', 3, 6]],
    desc: "Les ennemis maudits explosent à leur mort ({v}% des dégâts de l'arme) et maudissent les ennemis proches.", vals: { v: [120, 200] },
    hooks: {
      onKill(g, h, m, info, v) {
        if (!m.st.curse || m.st.curse.t <= 0 || info.proc) return;
        const c = m.st.curse;
        const hit = g.explode(h, m.x, m.z, 3.5, v.v / 100, { type: 'shadow', proc: true, color: 'curse', snd: 'pop' });
        for (const o of hit) if (o.alive) g.applyStatus(o, 'curse', { dealt: c.dealt, taken: c.taken, dur: 4, hero: h });
      },
    } },

  // =========================================================================
  // GÉNÉRIQUES — armes
  // =========================================================================
  { id: 'u_g_soulreaver', name: "Dévoreuse d'Âmes", slot: 'weapon', cls: null, icon: '👻',
    lore: 'Elle a faim. Toujours.',
    affixes: [['dmgPct', 10, 18], ['lifeOnKill', 3, 6]],
    desc: 'Chaque élimination octroie +1% de dégâts jusqu\'à la fin de la vague (max {v}%).', vals: { v: [30, 50] },
    hooks: {
      onKill(g, h, m, info, v) {
        const b = h.buffs.find((x) => x.id === 'soulreaver');
        if (!b || b.stacks < v.v) g.addBuff(h, 'soulreaver', 9999);
      },
      onWaveEnd(g, h) { g.removeBuff(h, 'soulreaver'); },
    } },
  { id: 'u_g_thunderfury', name: 'Foudre-Furie', slot: 'weapon', cls: null, icon: '🌩️',
    lore: 'Béni soit le fils du vent.',
    affixes: [['atkSpd', 6, 10], ['dmgLight', 12, 20]],
    desc: "Vos coups ont {v}% de chances de lancer un éclair qui rebondit sur 4 ennemis (120% des dégâts de l'arme).", vals: { v: [12, 20] },
    hooks: { onHit(g, h, t, info, dealt, v, st) { if ((st.t || 0) > g.time || g.rng.next() * 100 >= v.v) return; st.t = g.time + 0.15; chainLightning(g, h, null, h.x, h.z, t, 1.2, 3, 7, { ability: 'proc', proc: true }); } } },
  { id: 'u_g_frostmourne', name: 'Deuillegivre', slot: 'weapon', cls: null, icon: '🗡️',
    lore: 'Que l\'hiver vienne.',
    affixes: [['dmgCold', 15, 25], ['critDmg', 10, 20]],
    desc: 'Vos coups gèlent les ennemis sous 25% de PV. +{v}% de dégâts contre les ennemis gelés.', vals: { v: [25, 45] },
    hooks: {
      onHit(g, h, t, info, dealt) { if (t.alive && !t.boss && t.hp < t.maxHp * 0.25 && !(t.st.freeze > 0)) g.applyStatus(t, 'freeze', { dur: 1.5, hero: h }); },
      dmgMod(g, h, t, o, acc, v) { if (t.st.freeze > 0) acc.inc += v.v; },
    } },
  { id: 'u_g_executioner', name: 'Hachoir du Bourreau', slot: 'weapon', cls: null, icon: '🪓',
    lore: 'Il ne rate jamais un cou.',
    affixes: [['dmgPct', 12, 20], ['critChance', 3, 5]],
    desc: 'Vos coups exécutent les ennemis normaux sous {v}% de PV.', vals: { v: [10, 16] },
    hooks: { onHit(g, h, t, info, dealt, v) { if (t.alive && !t.elite && !t.boss && t.hp < t.maxHp * v.v / 100) { g.dealDamage(h, t, t.hp + 1, { type: 'phys', hero: h, ally: true, proc: true }); } } } },
  { id: 'u_g_glass_blade', name: 'Lame de Verre', slot: 'weapon', cls: null, icon: '🔪',
    lore: 'Magnifique. Mortelle. Fragile.',
    affixes: [['critChance', 3, 6], ['critDmg', 15, 30]],
    desc: '+{v}% de dégâts (multiplicatif), mais vous subissez +40% de dégâts.', vals: { v: [80, 120] },
    stats(B, v) { B.more(1 + v.v / 100); B.taken(1.4); } },
  { id: 'u_g_leech_blade', name: 'Lame Sangsue', slot: 'weapon', cls: null, icon: '🩸',
    lore: 'Elle boit pour vous.',
    affixes: [['dmgPct', 10, 16], ['atkSpd', 5, 8]],
    desc: '+{v}% de vol de vie, mais les autres soins sont réduits de moitié.', vals: { v: [5, 8] }, dec: 1,
    stats(B, v) { B.add('lifeSteal', v.v); B.set('noHeal'); } },
  { id: 'u_g_frenzy_sword', name: 'Épée Frénétique', slot: 'weapon', cls: null, icon: '⚔️',
    lore: 'Elle ne connaît pas le repos.',
    affixes: [['atkSpd', 8, 12], ['dmgPct', 8, 14]],
    desc: "Chaque élimination octroie +3% de vitesse d'attaque pendant {v} s (cumulable 15 fois).", vals: { v: [4, 7] }, dec: 1,
    hooks: { onKill(g, h, m, info, v) { g.addBuff(h, 'frenzy', v.v); } } },
  { id: 'u_g_chaos_staff', name: 'Sceptre du Chaos', slot: 'weapon', cls: null, icon: '🎲',
    lore: 'Personne ne sait ce qu\'il va faire. Pas même lui.',
    affixes: [['dmgPct', 20, 30], ['area', 8, 14]],
    desc: 'Vos dégâts varient aléatoirement de -50% à +150%. +{v}% de chance de coup critique.', vals: { v: [5, 10] },
    stats(B, v) { B.set('chaos'); B.add('critChance', v.v); } },

  // =========================================================================
  // GÉNÉRIQUES — casques
  // =========================================================================
  { id: 'u_g_crown_kings', name: 'Couronne des Rois', slot: 'helm', cls: null, icon: '👑',
    lore: 'Le pouvoir attire l\'or. L\'or attire le pouvoir.',
    affixes: [['goldFind', 20, 30], ['maxHp', 10, 18]],
    desc: "+{v}% d'or gagné. En fin de vague, gagnez 8% de votre or en intérêts.", vals: { v: [20, 40] },
    stats(B, v) { B.add('goldFind', v.v); },
    hooks: { onWaveEnd(g, h) { g.addGold(h, Math.min(h.gold * 0.08, 500 * g.waveScale()), true); } } },
  { id: 'u_g_helm_insight', name: 'Heaume de Clairvoyance', slot: 'helm', cls: null, icon: '🔭',
    lore: 'Il montre ce qui aurait pu être.',
    affixes: [['xpGain', 10, 18], ['cdr', 4, 7]],
    desc: 'Vos montées de niveau proposent 4 choix au lieu de 3. +{v}% d\'expérience.', vals: { v: [10, 20] },
    stats(B, v) { B.add('talentChoices', 1); B.add('xpGain', v.v); } },
  { id: 'u_g_helm_berserk', name: 'Masque du Berserker', slot: 'helm', cls: null, icon: '👹',
    lore: 'La douleur n\'est qu\'un carburant.',
    affixes: [['dmgPct', 8, 14], ['lifeSteal', 1, 2]],
    desc: '+1% de dégâts pour chaque {v}% de PV manquants.', vals: { v: [1.2, 0.8] }, dec: 1,
    hooks: { dmgMod(g, h, t, o, acc, v) { acc.inc += (1 - h.hp / h.maxHp) * 100 / v.v; } } },
  { id: 'u_g_helm_warden', name: 'Heaume du Gardien', slot: 'helm', cls: null, icon: '⛑️',
    lore: 'Rien ne le fait plier.',
    affixes: [['armor', 10, 16], ['maxHp', 14, 22]],
    desc: "Immunisé au gel, aux étourdissements et aux immobilisations. +{v}% d'armure.", vals: { v: [10, 25] },
    stats(B, v) { B.set('ccImmune'); B.add('armorPct', v.v); } },
  { id: 'u_g_helm_mind', name: "Diadème de l'Esprit", slot: 'helm', cls: null, icon: '🧠',
    lore: 'Un esprit vif dans un corps fragile.',
    affixes: [['cdr', 6, 10], ['area', 6, 10]],
    desc: '+{v}% de réduction des temps de recharge, mais -15% de PV max.', vals: { v: [15, 22] },
    stats(B, v) { B.add('cdr', v.v); B.add('maxHpPct', -15); } },
  { id: 'u_g_helm_rally', name: 'Heaume de Ralliement', slot: 'helm', cls: null, icon: '🚩',
    lore: 'Ceux qui le voient retrouvent courage.',
    affixes: [['maxHp', 12, 20], ['res', 6, 10]],
    desc: "Aura : vous et vos alliés à moins de {v} m gagnez +15% de vitesse d'attaque et 10% de réduction des dégâts.", vals: { v: [10, 14] },
    hooks: {
      tick(g, h, dt, v, st) {
        st.t = (st.t ?? 0) - dt;
        if (st.t > 0) return;
        st.t = 0.5;
        for (const o of g.heroesInRadius(h.x, h.z, v.v)) g.addBuff(o, 'rally', 1, {}, { src: 'rally' });
      },
    } },

  // =========================================================================
  // GÉNÉRIQUES — torses
  // =========================================================================
  { id: 'u_g_chest_dragon', name: 'Écailles de Dragon', slot: 'chest', cls: null, icon: '🐉',
    lore: 'Le dragon n\'en a plus besoin.',
    affixes: [['res', 10, 16], ['armor', 10, 16]],
    desc: 'Immunisé aux brûlures. Les ennemis qui vous frappent en mêlée s\'enflamment ({v}% des dégâts de l\'arme par seconde).', vals: { v: [60, 120] },
    stats(B) { B.set('burnImmune'); },
    hooks: { onHurt(g, h, src, info, acc, v) { if (src && src.kind === 'monster' && info.melee && src.alive) g.applyStatus(src, 'burn', { dps: g.heroDps(h, v.v / 100, 'fire'), dur: 3, hero: h }); } } },
  { id: 'u_g_chest_spikes', name: 'Armure à Pointes', slot: 'chest', cls: null, icon: '🦔',
    lore: 'Embrasser son porteur est une très mauvaise idée.',
    affixes: [['armor', 12, 20], ['thorns', 8, 14]],
    desc: 'Épines : renvoie {v}% de votre armure en dégâts aux attaquants de mêlée.', vals: { v: [150, 250] },
    stats(B, v, h) { if (h && h.S) B.add('thorns', h.S.armor * v.v / 100 / Math.max(1, h.levelMul)); } },
  { id: 'u_g_chest_undying', name: "Cuirasse de l'Immortel", slot: 'chest', cls: null, icon: '♾️',
    lore: 'La mort a essayé. Plusieurs fois.',
    affixes: [['maxHp', 16, 26], ['armor', 10, 16]],
    desc: 'Une fois par vague, une blessure mortelle vous laisse à 1 PV et vous rend invulnérable {v} s.', vals: { v: [2, 3.5] }, dec: 1,
    hooks: {
      onLethal(g, h, acc, v, st) {
        if (st.wave === g.wave) return;
        st.wave = g.wave;
        acc.prevent = true;
        h.hp = 1;
        h.invulnT = v.v;
        g.fx('text', { u: h.id, s: 'Immortel !', c: '#ffd76a' });
      },
    } },
  { id: 'u_g_chest_mirror', name: 'Cotte Miroir', slot: 'chest', cls: null, icon: '🛡️',
    lore: 'Ce que vous lancez vous revient.',
    affixes: [['res', 8, 14], ['maxHp', 12, 20]],
    desc: '{v}% de chances de renvoyer les projectiles ennemis.', vals: { v: [20, 35] },
    stats(B, v) { B.add('reflect', v.v); } },
  { id: 'u_g_chest_colossus', name: 'Plastron du Colosse', slot: 'chest', cls: null, icon: '🗿',
    lore: 'Taillé pour un géant. Il vous va très bien.',
    affixes: [['armor', 12, 18], ['regenPct', 0.3, 0.6]],
    desc: '+{v}% de PV max, -12% de vitesse de déplacement, taille augmentée.', vals: { v: [30, 45] },
    stats(B, v) { B.add('maxHpPct', v.v); B.add('moveSpd', -12); B.add('scale', 20); } },
  { id: 'u_g_chest_nova', name: 'Manteau de la Supernova', slot: 'chest', cls: null, icon: '💥',
    lore: 'Frappez-le fort. Vraiment fort. Puis courez.',
    affixes: [['maxHp', 14, 22], ['res', 6, 10]],
    desc: "Quand vous subissez plus de 12% de vos PV en un coup, libère une nova ({v}% des dégâts de l'arme) qui repousse.", vals: { v: [250, 400] },
    hooks: { onHurt(g, h, src, info, acc, v, st) { if (acc.amount < h.maxHp * 0.12 || (st.t || 0) > g.time) return; st.t = g.time + 2; g.explode(h, h.x, h.z, 5, v.v / 100, { type: 'arcane', proc: true, knock: 10, color: 'arcane' }); } } },

  // =========================================================================
  // GÉNÉRIQUES — gants
  // =========================================================================
  { id: 'u_g_gloves_midas', name: 'Gants de Midas', slot: 'gloves', cls: null, icon: '💰',
    lore: 'Tout ce qu\'ils touchent... vous connaissez la suite.',
    affixes: [['goldFind', 15, 25], ['luck', 10, 18]],
    desc: "Les ennemis tués ont {v}% de chances de vous rapporter 5 fois leur valeur en or.", vals: { v: [8, 14] },
    hooks: { onKill(g, h, m, info, v) { if (g.rng.next() * 100 < v.v) { g.addGold(h, m.goldVal * 5 / g.partyScale(), true); g.fx('gold', { x: m.x, z: m.z }); } } } },
  { id: 'u_g_gloves_storm', name: "Poignes de l'Orage", slot: 'gloves', cls: null, icon: '⛈️',
    lore: 'Chaque coup claque comme le tonnerre.',
    affixes: [['critChance', 3, 5], ['dmgLight', 10, 16]],
    desc: "Vos coups critiques déclenchent un éclair sur un ennemi proche ({v}% des dégâts de l'arme).", vals: { v: [80, 140] },
    hooks: { onCrit(g, h, t, info, dealt, v, st) { if ((st.t || 0) > g.time) return; st.t = g.time + 0.12; const n = g.nearestEnemy(TEAM_HEROES, t.x, t.z, 7, (m) => m !== t) || t; chainLightning(g, h, null, t.x, t.z, n, v.v / 100, 0, 0, { ability: 'proc', proc: true }); } } },
  { id: 'u_g_gloves_haste', name: 'Gants de Célérité', slot: 'gloves', cls: null, icon: '💨',
    lore: 'Plus vite, toujours plus vite.',
    affixes: [['atkSpd', 8, 12], ['moveSpd', 3, 5]],
    desc: "+{v}% de vitesse d'attaque. Vos attaques de base réduisent les temps de recharge de 0,1 s.", vals: { v: [15, 25] },
    stats(B, v) { B.add('atkSpd', v.v); },
    hooks: { onCast(g, h, abId, slot, ctx) { if (slot === 0 && !ctx.recast) reduceCooldowns(g, h, 0.1); } } },
  { id: 'u_g_gloves_frost', name: 'Gantelets Givrants', slot: 'gloves', cls: null, icon: '🧊',
    lore: 'Ils laissent du givre sur tout ce qu\'ils touchent.',
    affixes: [['dmgCold', 10, 16], ['armor', 6, 10]],
    desc: 'Vos coups glacent les ennemis (ralentissement cumulable jusqu\'au gel). +{v}% de dégâts contre les ennemis entravés.', vals: { v: [15, 30] },
    stats(B, v) { B.add('dmgCC', v.v); },
    hooks: { onHit(g, h, t, info) { if (t.alive && !info.aoe) g.applyStatus(t, 'chill', { v: 0.2, dur: 2, hero: h }); } } },
  { id: 'u_g_gloves_poison', name: "Gants de l'Empoisonneur", slot: 'gloves', cls: null, icon: '☠️',
    lore: 'Toujours porter des gants. Surtout ceux-là.',
    affixes: [['dmgPoison', 12, 20], ['dotDmg', 8, 14]],
    desc: 'Vos coups empoisonnent ({v}% des dégâts sur 4 s) et les poisons se propagent à la mort.', vals: { v: [30, 50] },
    hooks: {
      onHit(g, h, t, info, dealt, v) { if (t.alive) g.applyStatus(t, 'poison', { dps: dealt * v.v / 100 / 4, dur: 4, hero: h }); },
      onKill(g, h, m) { const p = m.st.poison; if (!p || !p.length) return; const dps = p.reduce((s, x) => s + x.dps, 0); for (const o of g.enemiesInRadius(TEAM_HEROES, m.x, m.z, 4).slice(0, 2)) g.applyStatus(o, 'poison', { dps: dps * 0.4, dur: 4, hero: h }); },
    } },
  { id: 'u_g_gloves_giant', name: 'Poings de Géant', slot: 'gloves', cls: null, icon: '👊',
    lore: 'Ils frappent comme un éboulement.',
    affixes: [['dmgElite', 12, 20], ['armor', 6, 10]],
    desc: 'Vos attaques de base repoussent les ennemis. +{v}% de dégâts contre les élites.', vals: { v: [25, 40] },
    stats(B, v) { B.add('dmgElite', v.v); },
    hooks: { onHit(g, h, t, info) { if (info.ability && h.P[info.ability] && h.cls.abilities[0] === info.ability && t.alive) g.knockback(t, h.x, h.z, 3); } } },

  // =========================================================================
  // GÉNÉRIQUES — bottes
  // =========================================================================
  { id: 'u_g_boots_hermes', name: 'Sandales Ailées', slot: 'boots', cls: null, icon: '🕊️',
    lore: 'Un dieu les a oubliées ici.',
    affixes: [['moveSpd', 8, 12], ['dodge', 2, 4]],
    desc: '+{v}% de vitesse de déplacement. Vous traversez les ennemis.', vals: { v: [12, 20] },
    stats(B, v) { B.add('moveSpd', v.v); B.set('ghostWalk'); } },
  { id: 'u_g_boots_fire', name: 'Bottes de Braise', slot: 'boots', cls: null, icon: '🔥',
    lore: 'Le sol brûle là où elles passent.',
    affixes: [['moveSpd', 5, 8], ['dmgFire', 10, 16]],
    desc: "Vous laissez une traînée de feu ({v}% des dégâts de l'arme par seconde).", vals: { v: [30, 55] },
    hooks: {
      tick(g, h, dt, v, st) {
        if (!h.moving) return;
        st.t = (st.t ?? 0) - dt;
        if (st.t > 0) return;
        st.t = 0.35;
        g.spawnArea({ owner: h, team: TEAM_HEROES, shape: 'circle', x: h.x, z: h.z, r: 1.3, dur: 2.5, tick: 0.5, vis: 'firetrail',
          onTick: (g2, a) => g.areaHit(a, v.v / 100 * 0.5, { type: 'fire', proc: true }) });
      },
    } },
  { id: 'u_g_boots_blizzard', name: 'Bottes du Blizzard', slot: 'boots', cls: null, icon: '🌨️',
    lore: 'La tempête vous suit à la trace.',
    affixes: [['moveSpd', 5, 8], ['dmgCold', 8, 14]],
    desc: "Votre esquive gèle les ennemis proches pendant {v} s.", vals: { v: [1.2, 2] }, dec: 1,
    hooks: { onDash(g, h, ctx, v) { for (const m of g.enemiesInRadius(TEAM_HEROES, h.x, h.z, 4)) g.applyStatus(m, 'freeze', { dur: v.v, hero: h }); g.fx('nova', { x: h.x, z: h.z, r: 4, c: 'cold' }); } } },
  { id: 'u_g_boots_acrobat', name: 'Bottes du Voltigeur', slot: 'boots', cls: null, icon: '🤸',
    lore: 'Deux bonds valent mieux qu\'un.',
    affixes: [['moveSpd', 6, 9], ['dodge', 2, 4]],
    desc: "Votre esquive possède {v} charge(s) supplémentaire(s).", vals: { v: [1, 1] }, dec: 0,
    stats(B, v) { B.add('dashCharges', v.v); } },
  { id: 'u_g_boots_anchor', name: 'Bottes de Plomb', slot: 'boots', cls: null, icon: '⚓',
    lore: 'Personne ne vous fera reculer.',
    affixes: [['armor', 10, 16], ['maxHp', 12, 20]],
    desc: 'Immunisé aux ralentissements et immobilisations. +{v}% d\'armure, -8% de vitesse de déplacement.', vals: { v: [30, 50] },
    stats(B, v) { B.set('slowImmune'); B.add('armorPct', v.v); B.add('moveSpd', -8); } },
  { id: 'u_g_boots_pilgrim', name: 'Bottes du Pèlerin', slot: 'boots', cls: null, icon: '🥾',
    lore: 'Le chemin guérit.',
    affixes: [['moveSpd', 5, 8], ['maxHp', 10, 16]],
    desc: 'Vous régénérez {v}% de vos PV max par seconde tant que vous vous déplacez.', vals: { v: [1.2, 2] }, dec: 1,
    hooks: { tick(g, h, dt, v) { if (h.moving) g.heal(h, h.maxHp * v.v / 100 * dt, h); } } },

  // =========================================================================
  // GÉNÉRIQUES — amulettes
  // =========================================================================
  { id: 'u_g_amu_void_eye', name: 'Œil du Néant', slot: 'amulet', cls: null, icon: '👁️',
    lore: 'Il voit les failles dans toute chose.',
    affixes: [['critChance', 4, 6], ['critDmg', 15, 25]],
    desc: '+{v}% de chance de coup critique.', vals: { v: [8, 14] },
    stats(B, v) { B.add('critChance', v.v); } },
  { id: 'u_g_amu_phoenix', name: 'Plume de Phénix', slot: 'amulet', cls: null, icon: '✨',
    lore: 'Une seule plume, une seule seconde chance.',
    affixes: [['maxHp', 12, 20], ['res', 6, 10]],
    desc: 'Une fois par partie, une blessure mortelle vous ressuscite avec {v}% de PV.', vals: { v: [80, 100] },
    hooks: {
      onLethal(g, h, acc, v, st) {
        if (st.used) return;
        st.used = true;
        acc.prevent = true;
        h.hp = h.maxHp * v.v / 100;
        h.invulnT = 3;
        g.fx('revive', { u: h.id });
        g.fx('text', { u: h.id, s: 'Plume de Phénix !', c: '#ffb050' });
      },
    } },
  { id: 'u_g_amu_greed', name: "Idole de l'Avarice", slot: 'amulet', cls: null, icon: '🗿',
    lore: 'Elle exige toujours plus.',
    affixes: [['goldFind', 20, 30], ['luck', 15, 25]],
    desc: "+{v}% d'or gagné, mais vous subissez +15% de dégâts.", vals: { v: [70, 110] },
    stats(B, v) { B.add('goldFind', v.v); B.taken(1.15); } },
  { id: 'u_g_amu_star', name: 'Étoile Polaire', slot: 'amulet', cls: null, icon: '⭐',
    lore: 'Elle guide vers le meilleur choix.',
    affixes: [['xpGain', 10, 16], ['dmgPct', 6, 10]],
    desc: 'Vos choix de talents ne peuvent plus être de rareté Commune. +{v}% d\'expérience.', vals: { v: [8, 15] },
    stats(B, v) { B.add('minRarity', 1); B.add('xpGain', v.v); } },
  { id: 'u_g_amu_chalice', name: 'Calice de Sang', slot: 'amulet', cls: null, icon: '🍷',
    lore: 'Il déborde toujours.',
    affixes: [['healRecv', 10, 16], ['lifeSteal', 1, 2]],
    desc: 'Les soins excédentaires deviennent un bouclier (max {v}% de vos PV).', vals: { v: [25, 40] },
    hooks: { onOverheal(g, h, over, v) { const cap = h.maxHp * v.v / 100; if (h.shield < cap) { h.shield = Math.min(cap, h.shield + over); h.shieldT = Math.max(h.shieldT, 5); } } } },
  { id: 'u_g_amu_hourglass', name: 'Sablier Brisé', slot: 'amulet', cls: null, icon: '⏳',
    lore: 'Le temps fuit. Parfois, il s\'arrête.',
    affixes: [['cdr', 5, 8], ['maxHp', 10, 16]],
    desc: 'Sous 30% de PV, les ennemis proches sont ralentis de 60% pendant {v} s (une fois toutes les 30 s).', vals: { v: [3, 5] }, dec: 1,
    hooks: {
      tick(g, h, dt, v, st) {
        if (h.hp > h.maxHp * 0.3 || (st.t || -99) + 30 > g.time) return;
        st.t = g.time;
        for (const m of g.enemiesInRadius(TEAM_HEROES, h.x, h.z, 14)) g.applyStatus(m, 'slow', { v: 0.6, dur: v.v });
        g.fx('nova', { x: h.x, z: h.z, r: 14, c: 'arcane' });
        g.snd('timeslow', h.x, h.z);
      },
    } },
  { id: 'u_g_amu_rage', name: 'Totem de Rage', slot: 'amulet', cls: null, icon: '😤',
    lore: 'La fureur se nourrit d\'elle-même.',
    affixes: [['dmgPct', 8, 12], ['atkSpd', 4, 7]],
    desc: 'Chaque élimination octroie +3% de dégâts pendant {v} s (max +60%).', vals: { v: [3, 5] }, dec: 1,
    hooks: { onKill(g, h, m, info, v) { g.addBuff(h, 'rage', v.v); } } },
  { id: 'u_g_amu_unity', name: "Sceau de l'Unité", slot: 'amulet', cls: null, icon: '🤝',
    lore: 'Ensemble, invincibles.',
    affixes: [['dmgPct', 8, 12], ['res', 6, 10]],
    desc: 'Vous et vos alliés à moins de 10 m gagnez +{v}% de dégâts.', vals: { v: [10, 18] },
    hooks: {
      tick(g, h, dt, v, st) {
        st.t = (st.t ?? 0) - dt;
        if (st.t > 0) return;
        st.t = 0.5;
        for (const o of g.heroesInRadius(h.x, h.z, 10)) g.addBuff(o, 'unity', 1, { v: v.v }, { src: 'unity' });
      },
    } },
  { id: 'u_g_amu_twin', name: 'Médaillon des Jumeaux', slot: 'amulet', cls: null, icon: '♊',
    lore: 'Votre reflet a des ambitions.',
    affixes: [['dmgPct', 6, 10], ['summonDmg', 10, 16]],
    desc: 'Un double spectral vous accompagne et imite vos attaques de base ({v}% des dégâts).', vals: { v: [30, 45] },
    hooks: {
      tick(g, h, dt, v, st) {
        if (st.twin && st.twin.alive) { st.twin.data.mult = v.v / 100; return; }
        st.cd = (st.cd ?? 0) - dt;
        if (st.cd > 0) return;
        st.cd = 5;
        st.twin = g.spawnAlly(h, 'twin', h.x - 1, h.z, { data: { mult: v.v / 100 } });
      },
      onCast(g, h, abId, slot, ctx, v, st) {
        if (slot !== 0 || ctx.ghost || !st.twin || !st.twin.alive) return;
        const t = st.twin;
        g.castFrom(h, 0, t.x, t.z, ctx.ax, ctx.az, v.v / 100);
        t.rot = Math.atan2(ctx.az - t.z, ctx.ax - t.x);
        t.setAnim(2, 0.3);
      },
    } },

  // =========================================================================
  // GÉNÉRIQUES — anneaux
  // =========================================================================
  { id: 'u_g_ring_ember', name: 'Anneau de Braise', slot: 'ring', cls: null, icon: '💍',
    lore: 'Il ne refroidit jamais.',
    affixes: [['dmgFire', 15, 25], ['burnChance', 6, 10]],
    desc: 'Vos brûlures infligent +{v}% de dégâts et se propagent à la mort.', vals: { v: [30, 60] },
    stats(B, v) { B.mul.burn *= 1 + v.v / 100; },
    hooks: { onKill(g, h, m) { const b = m.st.burn; if (!b || b.t <= 0) return; for (const o of g.enemiesInRadius(TEAM_HEROES, m.x, m.z, 4).slice(0, 3)) g.applyStatus(o, 'burn', { dps: b.dps, dur: 3, hero: h }); } } },
  { id: 'u_g_ring_frost', name: 'Anneau de Givre', slot: 'ring', cls: null, icon: '💍',
    lore: 'Il fige le sang dans les veines.',
    affixes: [['dmgCold', 15, 25], ['chillChance', 6, 10]],
    desc: 'Vos gels durent +{v} s.', vals: { v: [0.5, 1] }, dec: 1,
    stats(B, v) { B.add('freezeBonus', v.v); } },
  { id: 'u_g_ring_storm', name: "Anneau de l'Orage", slot: 'ring', cls: null, icon: '💍',
    lore: 'Il crépite doucement dans le silence.',
    affixes: [['dmgLight', 15, 25], ['shockChance', 6, 10]],
    desc: 'Vos électrocutions durent 2 fois plus longtemps et sont {v}% plus puissantes.', vals: { v: [40, 80] },
    stats(B, v) { B.mul.shockDur *= 2; B.mul.shock *= 1 + v.v / 100; } },
  { id: 'u_g_ring_venom', name: 'Anneau Venimeux', slot: 'ring', cls: null, icon: '💍',
    lore: 'Une goutte, un mort.',
    affixes: [['dmgPoison', 15, 25], ['poisonChance', 6, 10]],
    desc: 'Vos poisons infligent +{v}% de dégâts et durent 50% plus longtemps.', vals: { v: [25, 45] },
    stats(B, v) { B.mul.poison *= 1 + v.v / 100; B.mul.poisonDur *= 1.5; } },
  { id: 'u_g_ring_holy', name: 'Anneau Béni', slot: 'ring', cls: null, icon: '💍',
    lore: 'Il brille d\'une lueur douce et chaude.',
    affixes: [['dmgHoly', 15, 25], ['healRecv', 6, 10]],
    desc: 'Vos dégâts sacrés soignent les alliés proches de {v}% de leur montant.', vals: { v: [1, 2] }, dec: 1,
    hooks: {
      onHit(g, h, t, info, dealt, v, st) {
        if (info.type !== 'holy') return;
        st.acc = (st.acc || 0) + dealt * v.v / 100;
        if ((st.t || 0) > g.time) return;
        st.t = g.time + 0.5;
        const amt = st.acc; st.acc = 0;
        for (const o of g.heroesInRadius(h.x, h.z, 10)) g.heal(o, amt, h);
      },
    } },
  { id: 'u_g_ring_shadow', name: 'Anneau des Ombres', slot: 'ring', cls: null, icon: '💍',
    lore: 'Les ombres s\'y lovent comme chez elles.',
    affixes: [['dmgShadow', 15, 25], ['cdr', 3, 6]],
    desc: "Les éliminations par l'ombre réduisent vos temps de recharge de {v} s.", vals: { v: [0.15, 0.3] }, dec: 2,
    hooks: { onKill(g, h, m, info, v) { if (info.type === 'shadow') reduceCooldowns(g, h, v.v); } } },
  { id: 'u_g_ring_arcane', name: 'Anneau Arcanique', slot: 'ring', cls: null, icon: '💍',
    lore: 'Il accumule la magie comme une pile.',
    affixes: [['dmgArcane', 15, 25], ['cdr', 3, 6]],
    desc: 'Toutes les {v} s, votre prochaine compétence inflige +50% de dégâts.', vals: { v: [6, 4] }, dec: 1,
    hooks: { tick(g, h, dt, v, st) { if (g.hasBuff(h, 'arcaneCharge')) return; st.t = (st.t ?? v.v) - dt; if (st.t <= 0) { st.t = v.v; g.addBuff(h, 'arcaneCharge', 999); } } } },
  { id: 'u_g_ring_titan', name: 'Anneau du Titan', slot: 'ring', cls: null, icon: '💍',
    lore: 'Trop grand pour un doigt humain. Et pourtant.',
    affixes: [['maxHp', 12, 20], ['armor', 6, 10]],
    desc: "+{v}% de PV max, de dégâts et d'armure. Taille augmentée.", vals: { v: [8, 12] },
    stats(B, v) { B.add('maxHpPct', v.v); B.add('dmgPct', v.v); B.add('armorPct', v.v); B.add('scale', 15); } },
  { id: 'u_g_ring_clover', name: 'Anneau du Trèfle', slot: 'ring', cls: null, icon: '🍀',
    lore: 'Quatre feuilles, toujours.',
    affixes: [['luck', 20, 30], ['goldFind', 10, 16]],
    desc: "+{v}% de découverte d'objets magiques.", vals: { v: [30, 50] },
    stats(B, v) { B.add('luck', v.v); } },
  { id: 'u_g_ring_vampire', name: 'Anneau du Vampire', slot: 'ring', cls: null, icon: '🦇',
    lore: 'Il a soif. Vous aussi, désormais.',
    affixes: [['lifeSteal', 1.5, 2.5], ['critChance', 2, 4]],
    desc: '+{v}% de vol de vie.', vals: { v: [2, 4] }, dec: 1,
    stats(B, v) { B.add('lifeSteal', v.v); } },
  { id: 'u_g_ring_wisdom', name: 'Anneau de Sagesse', slot: 'ring', cls: null, icon: '📖',
    lore: 'Chaque combat est une leçon.',
    affixes: [['xpGain', 12, 20], ['cdr', 3, 6]],
    desc: "+{v}% d'expérience. Chaque montée de niveau vous soigne de 50%.", vals: { v: [20, 35] },
    stats(B, v) { B.add('xpGain', v.v); },
    hooks: { onLevel(g, h) { g.heal(h, h.maxHp * 0.5, h); } } },
  { id: 'u_g_ring_echo', name: "Anneau de l'Écho", slot: 'ring', cls: null, icon: '🔁',
    lore: 'Chaque sort résonne deux fois.',
    affixes: [['cdr', 4, 7], ['dmgPct', 6, 10]],
    desc: '{v}% de chances que vos compétences soient relancées gratuitement 0,5 s plus tard.', vals: { v: [15, 25] },
    stats(B, v) { B.add('echo', v.v); } },
  { id: 'u_g_ring_hunter', name: 'Anneau du Chasseur', slot: 'ring', cls: null, icon: '🐺',
    lore: 'La traque est un art.',
    affixes: [['dmgElite', 12, 20], ['moveSpd', 3, 5]],
    desc: '+{v}% de dégâts contre les élites. Tuer un élite vous soigne de 20% et accélère.', vals: { v: [20, 35] },
    stats(B, v) { B.add('dmgElite', v.v); },
    hooks: { onKill(g, h, m) { if (m.elite) { g.heal(h, h.maxHp * 0.2, h); g.addBuff(h, 'hunter', 4); } } } },
  { id: 'u_g_ring_orb', name: 'Anneau de Vitalité', slot: 'ring', cls: null, icon: '❤️',
    lore: 'Le cœur bat plus fort.',
    affixes: [['maxHp', 12, 20], ['regenPct', 0.2, 0.4]],
    desc: 'Les orbes de soin octroient +25% de dégâts pendant 5 s et soignent +{v}%.', vals: { v: [30, 60] },
    stats(B, v) { B.add('orbBonus', v.v); },
    hooks: { onOrb(g, h) { g.addBuff(h, 'orbPower', 5); } } },
  { id: 'u_g_ring_greed', name: 'Anneau du Dragon avide', slot: 'ring', cls: null, icon: '🐲',
    lore: 'Un trésor qui protège son propriétaire.',
    affixes: [['goldFind', 10, 16], ['armor', 6, 10]],
    desc: "+1% de dégâts par tranche de {v} pièces d'or possédées (max +40%).", vals: { v: [60, 35] },
    hooks: { dmgMod(g, h, t, o, acc, v) { acc.inc += Math.min(40, h.gold / (v.v * g.waveScale())); } } },
  { id: 'u_g_ring_balance', name: "Anneau de l'Équilibre", slot: 'ring', cls: null, icon: '☯️',
    lore: 'Ni trop, ni trop peu.',
    affixes: [['res', 6, 10], ['dmgPct', 6, 10]],
    desc: "+{v}% à tous les types de dégâts élémentaires et +{v}% de résistance.", vals: { v: [10, 16] },
    stats(B, v) { for (const k of ['dmgFire', 'dmgCold', 'dmgLight', 'dmgPoison', 'dmgHoly', 'dmgShadow', 'dmgArcane']) B.add(k, v.v); B.add('res', v.v / 2); } },
  { id: 'u_g_amu_storm_heart', name: "Cœur de l'Orage", slot: 'amulet', cls: null, icon: '🌪️',
    lore: 'Un ouragan captif, impatient.',
    affixes: [['dmgLight', 12, 20], ['atkSpd', 4, 7]],
    desc: "Toutes les {v} s, un éclair frappe l'ennemi le plus proche et rebondit sur 5 cibles.", vals: { v: [4, 2.5] }, dec: 1,
    hooks: {
      tick(g, h, dt, v, st) {
        if (g.phase !== 'wave') return;
        st.t = (st.t ?? v.v) - dt;
        if (st.t > 0) return;
        const t = g.nearestEnemy(TEAM_HEROES, h.x, h.z, 14);
        if (!t) { st.t = 0.5; return; }
        st.t = v.v;
        chainLightning(g, h, null, h.x, h.z, t, 1.2, 5, 7, { ability: 'proc', proc: true });
      },
    } },
  { id: 'u_g_helm_dread', name: "Heaume de l'Effroi", slot: 'helm', cls: null, icon: '💀',
    lore: 'Son regard glace les plus braves.',
    affixes: [['armor', 8, 14], ['maxHp', 12, 20]],
    desc: 'Toutes les {v} s, terrifie les ennemis à moins de 6 m pendant 2 s.', vals: { v: [10, 7] }, dec: 1,
    hooks: {
      tick(g, h, dt, v, st) {
        if (g.phase !== 'wave') return;
        st.t = (st.t ?? v.v) - dt;
        if (st.t > 0) return;
        const foes = g.enemiesInRadius(TEAM_HEROES, h.x, h.z, 6);
        if (!foes.length) { st.t = 0.5; return; }
        st.t = v.v;
        for (const m of foes) g.applyStatus(m, 'fear', { dur: 2, x: h.x, z: h.z });
        g.fx('nova', { x: h.x, z: h.z, r: 6, c: 'shadow' });
      },
    } },
  { id: 'u_g_gloves_bladestorm', name: 'Gants Tourbillonnants', slot: 'gloves', cls: null, icon: '🌀',
    lore: 'Les lames dansent toutes seules.',
    affixes: [['atkSpd', 5, 8], ['dmgPhys', 10, 16]],
    desc: "{v} lames tournent autour de vous (60% des dégâts de l'arme par coup).", vals: { v: [3, 4] }, dec: 0,
    hooks: { tick(g, h, dt, v, st) { orbitTick(g, h, dt, st, Math.round(v.v), 2.4, 0.6, 'phys', 'blade'); } } },
  { id: 'u_g_chest_thorns_king', name: 'Manteau du Roi-Ronce', slot: 'chest', cls: null, icon: '🌹',
    lore: 'La beauté a des épines.',
    affixes: [['armor', 10, 16], ['thorns', 10, 16]],
    desc: 'Vos épines empoisonnent et infligent +{v}% de dégâts.', vals: { v: [80, 150] },
    stats(B, v) { B.flag('thornsMul', v.v); },
    hooks: { onHurt(g, h, src, info) { if (src && src.kind === 'monster' && info.melee && src.alive && h.S.thorns > 0) g.applyStatus(src, 'poison', { dps: h.S.thorns * h.levelMul * 0.3, dur: 4, hero: h }); } } },
  { id: 'u_g_boots_quicksilver', name: 'Bottes de Vif-Argent', slot: 'boots', cls: null, icon: '🥈',
    lore: 'Impossible de rester en place.',
    affixes: [['moveSpd', 6, 10], ['atkSpd', 4, 7]],
    desc: "+1% de dégâts pour chaque 1% de vitesse de déplacement bonus (max {v}%).", vals: { v: [30, 50] },
    hooks: { dmgMod(g, h, t, o, acc, v) { const bonus = (h.S.moveSpeed / h.cls.base.speed - 1) * 100; if (bonus > 0) acc.inc += Math.min(v.v, bonus); } } },
  { id: 'u_g_helm_seer', name: 'Capuche du Devin', slot: 'helm', cls: null, icon: '🔮',
    lore: 'Il a vu cette vague. Et la suivante.',
    affixes: [['luck', 15, 25], ['cdr', 3, 6]],
    desc: "Les coffres contiennent un objet supplémentaire. +{v}% de découverte d'objets magiques.", vals: { v: [20, 40] },
    stats(B, v) { B.add('luck', v.v); B.flag('chestBonus', 1); } },
];

// Default unlocked uniques (~25%)
const DEFAULT_UNLOCKED = new Set([
  'u_w_axe_ancestors', 'u_w_chest_crimson', 'u_w_ring_blood', 'u_a_bow_windforce', 'u_a_helm_hawk', 'u_a_boots_ranger',
  'u_m_staff_inferno', 'u_m_ring_frozenheart', 'u_n_staff_bones', 'u_n_boots_ghoul', 'u_e_wrench_master', 'u_e_gloves_demo',
  'u_p_mace_justice', 'u_p_boots_crusade', 'u_x_dagger_shadow', 'u_x_helm_mask', 'u_k_staff_abyss', 'u_k_amulet_heart',
  'u_g_thunderfury', 'u_g_frenzy_sword', 'u_g_helm_berserk', 'u_g_chest_mirror', 'u_g_gloves_midas', 'u_g_gloves_frost',
  'u_g_boots_pilgrim', 'u_g_amu_void_eye', 'u_g_amu_rage', 'u_g_ring_vampire', 'u_g_ring_titan', 'u_g_ring_ember',
]);

for (const u of UNIQUES_LIST) {
  u.locked = !DEFAULT_UNLOCKED.has(u.id);
  if (!u.icon) u.icon = SLOT_ICON[u.slot];
}

export const UNIQUES = Object.fromEntries(UNIQUES_LIST.map((u) => [u.id, u]));
