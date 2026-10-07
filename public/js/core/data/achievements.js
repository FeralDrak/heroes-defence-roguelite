// Achievements: each one tracks a profile statistic and unlocks content.
// reward types: class, unique, aspect, talent, difficulty, arena
import { CLASSES } from './classes/index.js';

export const ACH_CATEGORIES = {
  progression: { name: 'Progression', icon: '🏆' },
  combat: { name: 'Combat', icon: '⚔️' },
  bosses: { name: 'Boss', icon: '👑' },
  loot: { name: 'Butin', icon: '💎' },
  challenge: { name: 'Défis', icon: '🔥' },
  coop: { name: 'Coopération', icon: '🤝' },
  classes: { name: 'Classes', icon: '🎭' },
};

const U = (id) => ({ type: 'unique', id });
const A = (id) => ({ type: 'aspect', id });
const T = (id) => ({ type: 'talent', id });
const C = (id) => ({ type: 'class', id });
const D = (id) => ({ type: 'difficulty', id });
const R = (id) => ({ type: 'arena', id });

const GENERAL = [
  // ---- progression ----
  { id: 'p_wave1', cat: 'progression', icon: '🩸', name: 'Premier sang', desc: 'Terminer la vague 1.', key: 'best.wave', n: 1, reward: [A('asp_berserker')] },
  { id: 'p_boneking', cat: 'bosses', icon: '💀', name: 'Briseur d\'os', desc: 'Vaincre le Roi des Os (boss de la vague 5).', key: 'boss.boneking', n: 1, reward: [C('mage')] },
  { id: 'p_kills750', cat: 'combat', icon: '⚰️', name: 'Nécrologue', desc: 'Tuer 750 monstres au total (toutes parties confondues).', key: 'kills', n: 750, reward: [C('summoner')] },
  { id: 'p_brood', cat: 'bosses', icon: '🕷️', name: 'Arachnophobe', desc: 'Vaincre la Matriarche Arachnide (boss de la vague 10).', key: 'boss.broodmother', n: 1, reward: [C('engineer')] },
  { id: 'p_nodmg', cat: 'challenge', icon: '🛡️', name: 'Intouchable', desc: 'Terminer une vague (vague 5 ou plus) sans subir le moindre dégât.', key: 'ch.nodamage', n: 5, reward: [C('paladin')] },
  { id: 'p_elites100', cat: 'combat', icon: '🎯', name: "Chasseur d'élites", desc: 'Tuer 100 monstres élites au total.', key: 'elites', n: 100, reward: [C('assassin')] },
  { id: 'p_colossus', cat: 'bosses', icon: '🗿', name: 'Tailleur de pierre', desc: 'Vaincre le Colosse de Pierre (boss de la vague 15).', key: 'boss.colossus', n: 1, reward: [C('warlock')] },
  { id: 'p_lich', cat: 'bosses', icon: '☠️', name: 'Brise-phylactère', desc: 'Vaincre la Liche Éternelle (boss de la vague 20).', key: 'boss.lich', n: 1, reward: [U('u_g_amu_phoenix')] },
  { id: 'p_infernal', cat: 'bosses', icon: '🔥', name: 'Pompier de l\'enfer', desc: 'Vaincre le Seigneur Infernal (boss de la vague 25).', key: 'boss.infernal_lord', n: 1, reward: [U('u_g_chest_dragon'), A('asp_ashes')] },
  { id: 'p_win', cat: 'progression', icon: '👑', name: "Héros de l'arène", desc: 'Gagner une partie : vaincre le Dévoreur à la vague 30.', key: 'wins', n: 1, reward: [D('nightmare'), R('crypt')] },
  { id: 'p_win_nightmare', cat: 'progression', icon: '👁️', name: 'Maître des cauchemars', desc: 'Gagner une partie en difficulté Cauchemar.', key: 'wins.diff.nightmare', n: 1, reward: [D('hell'), U('u_g_helm_dread')] },
  { id: 'p_win_hell', cat: 'progression', icon: '😈', name: 'Revenu des enfers', desc: 'Gagner une partie en difficulté Enfer.', key: 'wins.diff.hell', n: 1, reward: [D('torment1'), U('u_g_chaos_staff')] },
  { id: 'p_win_t1', cat: 'progression', icon: '⛓️', name: 'Tourmenteur', desc: 'Gagner une partie en Tourment I.', key: 'wins.diff.torment1', n: 1, reward: [D('torment2'), A('asp_celestial')] },
  { id: 'p_win_t2', cat: 'progression', icon: '⛓️', name: 'Bourreau du tourment', desc: 'Gagner une partie en Tourment II.', key: 'wins.diff.torment2', n: 1, reward: [D('torment3'), U('u_g_amu_twin')] },
  { id: 'p_win_t3', cat: 'progression', icon: '🌌', name: 'Légende immortelle', desc: 'Gagner une partie en Tourment III.', key: 'wins.diff.torment3', n: 1, reward: [U('u_g_ring_echo')] },
  { id: 'p_endless35', cat: 'progression', icon: '♾️', name: 'Au-delà', desc: 'Terminer la vague 35 (mode infini).', key: 'best.wave', n: 35, reward: [U('u_g_ring_balance')] },
  { id: 'p_endless40', cat: 'progression', icon: '♾️', name: 'Sans fin', desc: 'Terminer la vague 40 (mode infini).', key: 'best.wave', n: 40, reward: [A('asp_overkill')] },
  { id: 'p_nightmare20', cat: 'progression', icon: '👁️', name: 'Insomniaque', desc: 'Terminer la vague 20 en difficulté Cauchemar.', key: 'best.wave.diff.nightmare', n: 20, reward: [U('u_g_chest_undying')] },
  { id: 'p_crypt15', cat: 'progression', icon: '⚰️', name: 'Pilleur de tombes', desc: 'Terminer la vague 15 dans la Crypte Oubliée.', key: 'best.wave.arena.crypt', n: 15, reward: [R('forge')] },
  { id: 'p_forge_win', cat: 'progression', icon: '🌋', name: 'Forgé dans la lave', desc: 'Gagner une partie dans la Forge Infernale.', key: 'wins.arena.forge', n: 1, reward: [U('u_g_boots_fire'), A('asp_flame')] },
  { id: 'p_wave10', cat: 'progression', icon: '🔟', name: 'Survivant', desc: 'Terminer la vague 10.', key: 'best.wave', n: 10, reward: [U('u_g_soulreaver')] },
  { id: 'p_wave20', cat: 'progression', icon: '⚔️', name: 'Gladiateur', desc: 'Terminer la vague 20.', key: 'best.wave', n: 20, reward: [U('u_g_helm_warden')] },
  // ---- combat ----
  { id: 'c_kills100', cat: 'combat', icon: '🗡️', name: 'Exterminateur', desc: 'Tuer 100 monstres au total.', key: 'kills', n: 100, reward: [A('asp_detonation')] },
  { id: 'c_kills2500', cat: 'combat', icon: '⚔️', name: 'Fléau des hordes', desc: 'Tuer 2 500 monstres au total.', key: 'kills', n: 2500, reward: [U('u_g_frostmourne')] },
  { id: 'c_kills10000', cat: 'combat', icon: '💀', name: 'Faucheur', desc: 'Tuer 10 000 monstres au total.', key: 'kills', n: 10000, reward: [U('u_g_executioner')] },
  { id: 'c_kills50000', cat: 'combat', icon: '☠️', name: 'Apocalypse', desc: 'Tuer 50 000 monstres au total.', key: 'kills', n: 50000, reward: [U('u_g_glass_blade')] },
  { id: 'c_elites25', cat: 'combat', icon: '🎯', name: 'Premiers trophées', desc: 'Tuer 25 monstres élites.', key: 'elites', n: 25, reward: [A('asp_static')] },
  { id: 'c_elites500', cat: 'combat', icon: '🏹', name: 'Grand veneur', desc: 'Tuer 500 monstres élites.', key: 'elites', n: 500, reward: [U('u_g_ring_hunter')] },
  { id: 'c_bosses10', cat: 'bosses', icon: '👑', name: 'Tueur de rois', desc: 'Vaincre 10 boss au total.', key: 'bosses', n: 10, reward: [U('u_g_gloves_giant')] },
  { id: 'c_multi15', cat: 'combat', icon: '💥', name: 'Carnage', desc: 'Tuer 15 monstres en moins d\'une seconde.', key: 'best.multikill', n: 15, reward: [A('asp_shock')] },
  { id: 'c_multi40', cat: 'combat', icon: '🌋', name: 'Cataclysme', desc: 'Tuer 40 monstres en moins d\'une seconde.', key: 'best.multikill', n: 40, reward: [U('u_g_amu_storm_heart')] },
  { id: 'c_hit1k', cat: 'combat', icon: '🔨', name: 'Coup puissant', desc: 'Infliger 1 000 dégâts en un seul coup.', key: 'best.hit', n: 1000, reward: [A('asp_blood')] },
  { id: 'c_hit25k', cat: 'combat', icon: '⚡', name: 'Coup dévastateur', desc: 'Infliger 25 000 dégâts en un seul coup.', key: 'best.hit', n: 25000, reward: [U('u_g_ring_arcane')] },
  { id: 'c_hit250k', cat: 'combat', icon: '☄️', name: 'Frappe divine', desc: 'Infliger 250 000 dégâts en un seul coup.', key: 'best.hit', n: 250000, reward: [U('u_g_ring_greed')] },
  { id: 'c_bats', cat: 'combat', icon: '🦇', name: 'Chiroptérophobe', desc: 'Tuer 1 000 chauves-souris.', key: 'kills.bat', n: 1000, reward: [A('asp_echo')] },
  { id: 'c_bombers', cat: 'combat', icon: '💣', name: 'Démineur', desc: 'Tuer 200 gobelins kamikazes.', key: 'kills.bomber', n: 200, reward: [U('u_g_chest_nova')] },
  { id: 'c_necros', cat: 'combat', icon: '🧙', name: 'Anti-nécromancie', desc: 'Tuer 100 nécromanciens.', key: 'kills.necro', n: 100, reward: [U('u_g_ring_shadow')] },
  { id: 'c_knights', cat: 'combat', icon: '🛡️', name: 'Briseur de serments', desc: 'Tuer 100 chevaliers maudits.', key: 'kills.knight', n: 100, reward: [U('u_g_chest_thorns_king')] },
  { id: 'c_slimes', cat: 'combat', icon: '🟢', name: 'Gluant', desc: 'Tuer 300 slimes acides.', key: 'kills.slime', n: 300, reward: [U('u_g_ring_venom')] },
  { id: 'c_spiders', cat: 'combat', icon: '🕸️', name: 'Insecticide', desc: 'Tuer 750 araignées venimeuses.', key: 'kills.spider', n: 750, reward: [U('u_g_gloves_poison')] },
  { id: 'c_level20', cat: 'progression', icon: '⭐', name: 'Aguerri', desc: 'Atteindre le niveau 20 au cours d\'une partie.', key: 'best.level', n: 20, reward: [U('u_g_ring_wisdom')] },
  { id: 'c_level35', cat: 'progression', icon: '🌟', name: 'Vétéran', desc: 'Atteindre le niveau 35 au cours d\'une partie.', key: 'best.level', n: 35, reward: [U('u_g_helm_insight')] },
  { id: 'c_level50', cat: 'progression', icon: '💫', name: 'Demi-dieu', desc: 'Atteindre le niveau 50 au cours d\'une partie.', key: 'best.level', n: 50, reward: [U('u_g_amu_star')] },
  // ---- loot ----
  { id: 'l_leg1', cat: 'loot', icon: '🟠', name: 'Légendaire !', desc: 'Trouver un objet légendaire.', key: 'loot.legendary', n: 1, reward: [A('asp_thorns')] },
  { id: 'l_leg25', cat: 'loot', icon: '🟧', name: 'Pluie de légendes', desc: 'Trouver 25 objets légendaires.', key: 'loot.legendary', n: 25, reward: [A('asp_avenger')] },
  { id: 'l_uniq1', cat: 'loot', icon: '💎', name: 'Trésor unique', desc: 'Trouver un objet unique.', key: 'loot.unique', n: 1, reward: [U('u_g_ring_clover')] },
  { id: 'l_uniq10', cat: 'loot', icon: '💠', name: 'Chineur', desc: 'Trouver 10 objets uniques.', key: 'loot.unique', n: 10, reward: [U('u_g_crown_kings')] },
  { id: 'l_distinct25', cat: 'loot', icon: '📚', name: 'Collectionneur', desc: 'Découvrir 25 objets uniques différents.', key: 'uniques.distinct', n: 25, reward: [U('u_g_amu_chalice')] },
  { id: 'l_distinct60', cat: 'loot', icon: '🏛️', name: 'Conservateur', desc: 'Découvrir 60 objets uniques différents.', key: 'uniques.distinct', n: 60, reward: [U('u_g_amu_greed')] },
  { id: 'l_chests10', cat: 'loot', icon: '🧰', name: 'Chasseur de trésors', desc: 'Ouvrir 10 coffres.', key: 'chests', n: 10, reward: [A('asp_ricochet')] },
  { id: 'l_cursed5', cat: 'loot', icon: '🟣', name: 'Malédiction assumée', desc: 'Ouvrir 5 coffres maudits.', key: 'chests.cursed', n: 5, reward: [U('u_g_leech_blade')] },
  { id: 'l_gold10k', cat: 'loot', icon: '💰', name: 'Petite fortune', desc: "Gagner 10 000 pièces d'or au total.", key: 'gold', n: 10000, reward: [A('asp_glass')] },
  { id: 'l_gold100k', cat: 'loot', icon: '🏦', name: 'Crésus', desc: "Gagner 100 000 pièces d'or au total.", key: 'gold', n: 100000, reward: [U('u_g_boots_quicksilver')] },
  { id: 'l_bought50', cat: 'loot', icon: '🛒', name: 'Bon client', desc: 'Acheter 50 objets à la boutique.', key: 'items.bought', n: 50, reward: [A('asp_commander')] },
  { id: 'l_legeq8', cat: 'loot', icon: '✨', name: 'Panoplie légendaire', desc: 'Équiper simultanément 8 objets légendaires ou uniques.', key: 'best.legendaryEquipped', n: 8, reward: [U('u_g_helm_mind')] },
  { id: 'l_uniq4', cat: 'loot', icon: '💎', name: 'Tout en unique', desc: 'Équiper simultanément 4 objets uniques.', key: 'best.uniquesEquipped', n: 4, reward: [U('u_g_gloves_bladestorm'), A('asp_blades')] },
  { id: 'l_legtal10', cat: 'loot', icon: '🟧', name: 'Bénédiction légendaire', desc: 'Choisir 10 talents de rareté Légendaire.', key: 'talents.r4', n: 10, reward: [U('u_g_ring_orb')] },
  { id: 'l_stacks5', cat: 'loot', icon: '📈', name: 'Spécialiste', desc: 'Prendre 5 fois le même talent dans une partie.', key: 'best.talentStacks', n: 5, reward: [U('u_g_gloves_haste')] },
  { id: 'l_tomes', cat: 'loot', icon: '📖', name: 'Rat de bibliothèque', desc: 'Acheter 10 Tomes de savoir.', key: 'tomes', n: 10, reward: [A('asp_momentum')] },
  // ---- challenges ----
  { id: 'h_nobuy', cat: 'challenge', icon: '🧘', name: 'Ascète', desc: 'Terminer la vague 10 sans rien acheter à la boutique.', key: 'ch.nobuy', n: 10, reward: [U('u_g_boots_anchor')] },
  { id: 'h_nopotion', cat: 'challenge', icon: '🚱', name: 'Sobre', desc: 'Terminer la vague 15 sans boire la moindre potion.', key: 'ch.nopotion', n: 15, reward: [U('u_g_ring_holy'), A('asp_sanctuary')] },
  { id: 'h_white', cat: 'challenge', icon: '⚪', name: 'Minimaliste', desc: 'Terminer la vague 10 avec uniquement des objets communs (blancs) équipés.', key: 'ch.whiteonly', n: 10, reward: [U('u_g_chest_colossus')] },
  { id: 'h_nodeath20', cat: 'challenge', icon: '💪', name: 'Increvable', desc: 'Terminer la vague 20 sans qu\'aucun héros ne tombe.', key: 'ch.nodeath', n: 20, reward: [U('u_g_amu_hourglass')] },
  { id: 'h_speed', cat: 'challenge', icon: '⚡', name: 'Éclair', desc: 'Terminer une vague (vague 10 ou plus) en moins de 25 secondes.', key: 'ch.speedwave', n: 1, reward: [U('u_g_boots_hermes')] },
  { id: 'h_regicide', cat: 'challenge', icon: '⏱️', name: 'Régicide express', desc: 'Vaincre le Roi des Os en moins de 30 secondes.', key: 'ch.boss30.boneking', n: 1, reward: [U('u_g_gloves_storm')] },
  { id: 'h_boss60', cat: 'challenge', icon: '⌛', name: 'Expéditif', desc: 'Vaincre 5 boss en moins de 60 secondes chacun.', key: 'ch.boss60', n: 5, reward: [U('u_g_ring_frost')] },
  { id: 'h_closecall', cat: 'challenge', icon: '❤️‍🩹', name: 'Sur le fil', desc: 'Terminer une vague de boss avec moins de 10% de vos PV.', key: 'ch.closecall', n: 1, reward: [U('u_g_chest_spikes')] },
  { id: 'h_nodmg10', cat: 'challenge', icon: '👻', name: 'Ombre insaisissable', desc: 'Terminer une vague (vague 10 ou plus) sans subir de dégâts.', key: 'ch.nodamage', n: 10, reward: [A('asp_evasion')] },
  { id: 'h_perfect', cat: 'challenge', icon: '🏅', name: 'Perfection', desc: "Gagner une partie sans qu'aucun héros ne tombe.", key: 'wins.nodeath', n: 1, reward: [T('gen_secondwind'), U('u_g_ring_storm')] },
  // ---- co-op ----
  { id: 'o_revive10', cat: 'coop', icon: '😇', name: 'Ange gardien', desc: 'Ranimer 10 alliés tombés (maintenez F près d\'eux).', key: 'revives', n: 10, reward: [U('u_g_amu_unity')] },
  { id: 'o_coop10', cat: 'coop', icon: '🤝', name: "Frères d'armes", desc: 'Terminer la vague 10 dans une partie à plusieurs.', key: 'best.wave.coop', n: 10, reward: [U('u_g_helm_rally')] },
  { id: 'o_four15', cat: 'coop', icon: '👥', name: 'La compagnie', desc: 'Terminer la vague 15 dans une partie à 4 joueurs.', key: 'best.wave.players.4', n: 15, reward: [A('asp_winter')] },
  { id: 'o_win2', cat: 'coop', icon: '👬', name: 'Duo de choc', desc: 'Gagner une partie à 2 joueurs.', key: 'wins.players.2', n: 1, reward: [A('asp_thunder')] },
  { id: 'o_win4', cat: 'coop', icon: '🏰', name: "L'escouade légendaire", desc: 'Gagner une partie à 4 joueurs.', key: 'wins.players.4', n: 1, reward: [U('u_g_boots_acrobat')] },
  { id: 'o_drop10', cat: 'coop', icon: '🎁', name: 'Généreux', desc: 'Jeter 10 objets au sol (pour les donner à un allié).', key: 'items.dropped', n: 10, reward: [U('u_g_boots_blizzard')] },
  // ---- misc ----
  { id: 'm_potions', cat: 'progression', icon: '🧪', name: 'Alchimiste assidu', desc: 'Boire 100 potions.', key: 'potions', n: 100, reward: [A('asp_fortress')] },
  { id: 'm_orbs', cat: 'progression', icon: '❤️', name: 'Gourmand', desc: 'Ramasser 200 orbes de soin.', key: 'orbs', n: 200, reward: [A('asp_bloom')] },
  { id: 'm_deaths', cat: 'progression', icon: '⚰️', name: 'Habitué du cimetière', desc: 'Tomber au combat 25 fois.', key: 'deaths', n: 25, reward: [A('asp_lastbreath')] },
  { id: 'm_runs10', cat: 'progression', icon: '🔁', name: 'Persévérant', desc: 'Lancer 10 parties.', key: 'runs', n: 10, reward: [A('asp_immortal')] },
  { id: 'm_classes', cat: 'progression', icon: '🎭', name: 'Polyvalent', desc: 'Jouer une partie avec chacune des 8 classes.', key: 'classes.played', n: 8, reward: [T('gen_flask')] },
  { id: 'm_waves100', cat: 'progression', icon: '🌊', name: 'Marathonien', desc: 'Terminer 100 vagues au total.', key: 'waves', n: 100, reward: [A('asp_harvest')] },
  { id: 'm_waves500', cat: 'progression', icon: '🌊', name: 'Inépuisable', desc: 'Terminer 500 vagues au total.', key: 'waves', n: 500, reward: [U('u_g_helm_seer')] },
  { id: 'm_rerolls', cat: 'loot', icon: '🎲', name: 'Indécis', desc: 'Relancer la boutique 50 fois.', key: 'shop.rerolls', n: 50, reward: [A('asp_frenzy')] },
];

// ---------------------------------------------------------------------------
// Class achievements (6 per class)
// ---------------------------------------------------------------------------
const CLASS_ACH = {
  warrior: {
    ab: [['w_whirl', 300, 'Tempête d\'acier', 'Tourbillon'], ['w_leap', 150, 'Le sol tremble', 'Bond']],
    rewards: [[T('war_whirl_pull'), U('u_w_helm_bull')], [U('u_w_gloves_titan')], [T('war_leap_waves')], [U('u_w_boots_quake'), T('war_execute')], [U('u_w_sword_juggernaut')], [U('u_w_amulet_warlord'), T('war_double')]],
  },
  archer: {
    ab: [['a_multi', 300, 'Volée meurtrière', 'Tir multiple'], ['a_trap', 150, 'Trappeuse', 'Piège givrant']],
    rewards: [[T('arc_split'), U('u_a_gloves_quickdraw')], [U('u_a_bow_starfall')], [T('arc_trap_explo'), U('u_a_chest_trapper')], [U('u_a_amulet_quiver'), T('arc_ricochet')], [U('u_a_ring_split')], [T('arc_explosive')]],
  },
  mage: {
    ab: [['m_fireball', 400, 'Pyromane', 'Boule de feu'], ['m_meteor', 200, 'Astrologue', 'Météore']],
    rewards: [[T('mag_bolt_split'), U('u_m_gloves_astro')], [U('u_m_staff_frostbite')], [T('mag_meteor_shower'), U('u_m_helm_tempest')], [U('u_m_boots_phase'), T('mag_fireball_count')], [U('u_m_chest_phoenix'), U('u_m_amulet_archmage')], [T('mag_orbit')]],
  },
  summoner: {
    ab: [['n_corpse', 300, 'Fossoyeur', 'Explosion de cadavres']],
    custom2: { key: 'kills.minion', n: 1500, name: 'Armée des ténèbres', desc: 'Tuer 1 500 monstres avec des serviteurs ou structures (toutes classes).' },
    rewards: [[T('sum_skel_explode'), U('u_n_gloves_puppet')], [U('u_n_chest_grave')], [T('sum_corpse_chain'), U('u_n_scythe_reaper')], [U('u_n_helm_lich'), T('sum_soul_link')], [U('u_n_amulet_golem'), U('u_n_ring_bone')], [T('sum_army')]],
  },
  engineer: {
    ab: [['e_turret', 500, 'Tourelliste', 'tirs de Tourelle'], ['e_grenade', 300, 'Artificier', 'Grenade']],
    rewards: [[T('eng_turret_rocket'), U('u_e_helm_goggles')], [U('u_e_gun_minigun')], [T('eng_mines'), U('u_e_boots_jet')], [U('u_e_chest_battery'), T('eng_overclock')], [U('u_e_amulet_core'), U('u_e_ring_satellite')], [T('eng_drone')]],
  },
  paladin: {
    ab: [['p_shield', 300, 'Bouclier vivant', 'Bouclier vengeur'], ['p_consecrate', 300, 'Terre sainte', 'Consécration']],
    rewards: [[T('pal_hammer_wave'), U('u_p_gloves_light')], [U('u_p_hammer_dawn')], [T('pal_consecrate_follow'), U('u_p_helm_halo')], [U('u_p_chest_bastion'), T('pal_retribution')], [U('u_p_amulet_sun'), U('u_p_ring_oath')], [T('pal_avatar')]],
  },
  assassin: {
    ab: [['x_fan', 300, 'Mille lames', 'Éventail de lames'], ['x_dance', 100, 'Danseuse macabre', 'Danse des ombres']],
    rewards: [[T('asn_fan_return'), U('u_x_dagger_venom')], [U('u_x_boots_phantom')], [T('asn_mark_spread'), U('u_x_chest_shroud')], [U('u_x_gloves_garrote'), T('asn_execute')], [U('u_x_amulet_eclipse'), U('u_x_ring_cutthroat')], [T('asn_triple')]],
  },
  warlock: {
    ab: [['k_plague', 200, 'Porteur de peste', 'Fléau']],
    custom2: { key: 'kills.dot', n: 1500, name: 'Lente agonie', desc: 'Tuer 1 500 monstres avec des dégâts sur la durée (toutes classes).' },
    rewards: [[T('wlk_spread'), U('u_k_gloves_plague')], [U('u_k_boots_void')], [T('wlk_drain_chain'), U('u_k_tome_souls')], [U('u_k_helm_horns'), T('wlk_pact')], [U('u_k_chest_pact'), U('u_k_ring_doom')], [T('wlk_haunt')]],
  },
};

function classAchievements() {
  const out = [];
  for (const [cls, cfg] of Object.entries(CLASS_ACH)) {
    const c = CLASSES[cls];
    const r = cfg.rewards;
    out.push({ id: `k_${cls}_kills`, cat: 'classes', cls, icon: c.icon, name: `${c.name} : massacre`, desc: `Tuer 500 monstres en jouant ${c.name}.`, key: `kills.cls.${cls}`, n: 500, reward: r[0] });
    const [ab1, n1, name1, label1] = cfg.ab[0];
    out.push({ id: `k_${cls}_ab1`, cat: 'classes', cls, icon: c.icon, name: name1, desc: `Tuer ${n1} monstres avec ${label1}.`, key: `kab.${ab1}`, n: n1, reward: r[1] });
    if (cfg.custom2) {
      out.push({ id: `k_${cls}_ab2`, cat: 'classes', cls, icon: c.icon, name: cfg.custom2.name, desc: cfg.custom2.desc, key: cfg.custom2.key, n: cfg.custom2.n, reward: r[2] });
    } else {
      const [ab2, n2, name2, label2] = cfg.ab[1];
      out.push({ id: `k_${cls}_ab2`, cat: 'classes', cls, icon: c.icon, name: name2, desc: `Tuer ${n2} monstres avec ${label2}.`, key: `kab.${ab2}`, n: n2, reward: r[2] });
    }
    out.push({ id: `k_${cls}_w10`, cat: 'classes', cls, icon: c.icon, name: `${c.name} aguerri`, desc: `Terminer la vague 10 avec un héros ${c.name} dans l'équipe.`, key: `best.wave.cls.${cls}`, n: 10, reward: r[3] });
    out.push({ id: `k_${cls}_w20`, cat: 'classes', cls, icon: c.icon, name: `${c.name} d'élite`, desc: `Terminer la vague 20 avec un héros ${c.name} dans l'équipe.`, key: `best.wave.cls.${cls}`, n: 20, reward: r[4] });
    out.push({ id: `k_${cls}_win`, cat: 'classes', cls, icon: c.icon, name: `Légende : ${c.name}`, desc: `Gagner une partie avec un héros ${c.name} dans l'équipe.`, key: `wins.cls.${cls}`, n: 1, reward: r[5] });
  }
  return out;
}

export const ACHIEVEMENTS = [...GENERAL, ...classAchievements()];
export const ACHIEVEMENTS_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

/** Achievements indexed by the stat key they watch */
export const ACH_BY_KEY = {};
for (const a of ACHIEVEMENTS) (ACH_BY_KEY[a.key] || (ACH_BY_KEY[a.key] = [])).push(a);
