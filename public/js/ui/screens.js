// Menu screens: title, profiles, join, lobby, achievements & collection, settings, help.
import { h, clear, esc, fmtInt, downloadText, pickFile } from './dom.js';
import { tooltip } from './tooltip.js';
import { abilityTooltip, rewardText, rewardIcon, uniqueTooltip, aspectTooltip, talentCardText } from './format.js';
import { VERSION, PLAYER_COLORS, TALENT_RARITY_COLORS, TALENT_RARITIES } from '../core/constants.js';
import { CLASS_LIST, CLASSES, ABILITIES } from '../core/data/classes/index.js';
import { DIFFICULTY_LIST, DIFFICULTIES } from '../core/data/difficulty.js';
import { ARENA_LIST, ARENAS } from '../core/data/arenas.js';
import { ACHIEVEMENTS, ACH_CATEGORIES } from '../core/data/achievements.js';
import { UNIQUES_LIST } from '../core/data/uniques.js';
import { ASPECTS_LIST } from '../core/data/aspects.js';
import { TALENT_LIST } from '../core/data/talents.js';
import { DEFAULT_BINDINGS, BINDING_LABELS } from '../game/input.js';
import { Transport } from '../net/transport.js';
import { netMode } from '../net/netmode.js';

const SLOT_KEYS = [null, null, 'skill1', 'skill2', 'ultimate', 'dash'];

function achFor(type, id) {
  return ACHIEVEMENTS.find((a) => a.reward.some((r) => r.type === type && r.id === id)) || null;
}

function btn(label, onClick, cls = '') {
  return h('button.btn' + (cls ? '.' + cls.split(' ').join('.') : ''), { onclick: onClick }, label);
}

export class Screens {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('screens');
    this.current = null;
    this.cleanups = [];
  }

  clear() {
    for (const c of this.cleanups) { try { c(); } catch { /* ignore */ } }
    this.cleanups = [];
    clear(this.root);
    tooltip.hide();
    this.current = null;
  }

  mount(el, name) {
    this.clear();
    this.root.appendChild(el);
    this.current = name;
  }

  embers() {
    const wrap = h('div.embers');
    for (let i = 0; i < 26; i++) {
      const e = h('div.ember');
      e.style.left = Math.random() * 100 + '%';
      e.style.animationDuration = 6 + Math.random() * 10 + 's';
      e.style.animationDelay = -Math.random() * 12 + 's';
      e.style.opacity = 0.3 + Math.random() * 0.6;
      wrap.appendChild(e);
    }
    return wrap;
  }

  // ===========================================================================
  // Title
  // ===========================================================================
  showTitle() {
    const app = this.app;
    const last = app.store.last();
    const el = h('div.screen.title-screen', {},
      this.embers(),
      h('div.logo', {},
        h('div.l1', { text: 'HEROES DEFENCE' }),
        h('div.l2', { text: "L'Arène des Damnés" }),
        h('div.l3', { text: 'Survivez aux hordes. Débloquez l\'arsenal. Recommencez.' })),
      h('div.menu-buttons', {},
        btn('⚔️  Jouer en solo', () => this.showProfiles('solo'), 'primary'),
        btn('🛡️  Héberger une partie (coop)', () => this.showProfiles('host')),
        btn('🔗  Rejoindre une partie', () => this.showJoin()),
        btn('🏆  Succès & collection', () => this.showAchievementsMenu()),
        btn('⚙️  Paramètres', () => this.showSettings(() => this.showTitle())),
        btn('📖  Comment jouer', () => this.showHelp(() => this.showTitle()))),
      h('div.title-footer', {},
        last ? `Dernier profil : ${last.name} — ${last.doneCount()} / ${ACHIEVEMENTS.length} succès` : 'Aucun profil pour l\'instant : créez-en un pour commencer.',
        h('br'), `v${VERSION} · Les profils sont sauvegardés dans ce navigateur (exportables).`));
    this.mount(el, 'title');
  }

  // ===========================================================================
  // Profiles
  // ===========================================================================
  showProfiles(mode) {
    const app = this.app;
    let selected = app.store.last() ? app.store.last().id : null;
    const nameInput = h('input', { type: 'text', maxlength: 20, placeholder: 'Votre pseudo', value: app.settings.playerName || '' });
    const list = h('div.profiles');
    const newName = h('input', { type: 'text', maxlength: 24, placeholder: 'Nom du nouveau profil' });
    const continueBtn = btn(mode === 'host' ? 'Créer le salon ➜' : 'Continuer ➜', () => go(), 'primary big');

    const render = () => {
      clear(list);
      const profiles = app.store.list();
      if (!profiles.length) list.appendChild(h('div.muted', { style: { gridColumn: '1 / -1' }, text: 'Aucun profil sauvegardé. Créez un nouveau profil ci-dessous : 75% du contenu sera verrouillé au départ !' }));
      for (const p of profiles) {
        const done = p.doneCount();
        const unl = CLASS_LIST.filter((c) => p.isUnlocked('classes', c)).length;
        const card = h('div.profile-card' + (p.id === selected ? '.selected' : ''), { onclick: () => { selected = p.id; render(); } },
          h('div.pname', { text: p.name }),
          h('div.pinfo', { text: `Succès : ${done} / ${ACHIEVEMENTS.length} · Classes : ${unl} / ${CLASS_LIST.length}` }),
          h('div.progress', {}, h('div', { style: { width: (done / ACHIEVEMENTS.length) * 100 + '%' } })),
          h('div.pinfo', { text: `Meilleure vague : ${p.stat('best.wave') || 0} · Parties : ${p.stat('runs') || 0} · Monstres tués : ${fmtInt(p.stat('kills'))}` }),
          h('div.pactions', {},
            btn('Renommer', (e) => { e.stopPropagation(); const n = prompt('Nouveau nom du profil :', p.name); if (n) { p.rename(n); render(); } }, 'small'),
            btn('Exporter', (e) => { e.stopPropagation(); downloadText(`profil-${p.name.replace(/[^\w-]+/g, '_')}.json`, p.exportJson()); }, 'small'),
            btn('Supprimer', (e) => {
              e.stopPropagation();
              if (confirm(`Supprimer définitivement le profil « ${p.name} » ?`)) { app.store.remove(p.id); if (selected === p.id) selected = null; render(); }
            }, 'small danger')));
        list.appendChild(card);
      }
      continueBtn.disabled = !selected;
    };

    const go = async () => {
      const prof = app.store.get(selected);
      if (!prof) return;
      const pseudo = (nameInput.value.trim() || prof.name).slice(0, 20);
      app.settings.playerName = nameInput.value.trim();
      app.saveSettings();
      app.store.setLast(prof.id);
      continueBtn.disabled = true;
      continueBtn.textContent = mode === 'host' ? 'Création du salon…' : 'Chargement…';
      const ok = await app.startLocal(prof, pseudo, mode === 'host');
      if (!ok) { continueBtn.disabled = false; continueBtn.textContent = mode === 'host' ? 'Créer le salon ➜' : 'Continuer ➜'; }
    };

    const create = () => {
      const n = newName.value.trim();
      if (!n) { newName.focus(); return; }
      const p = app.store.create(n);
      selected = p.id;
      newName.value = '';
      render();
    };
    newName.addEventListener('keydown', (e) => { if (e.key === 'Enter') create(); });

    const el = h('div.screen', {},
      h('div.screen-inner.panel', { style: { padding: '20px' } },
        h('div.row', {},
          h('h2', { text: mode === 'host' ? 'Héberger une partie — choix du profil' : 'Partie solo — choix du profil' }),
          h('div.spacer'),
          btn('← Retour', () => this.showTitle(), 'small')),
        h('div.muted', { html: mode === 'host'
          ? "Le profil choisi enregistre l'avancement du groupe : <b>tous les succès validés par n'importe quel joueur débloquent le contenu pour ce profil</b>. Vos amis joueront avec le contenu débloqué sur ce profil."
          : "Le profil enregistre vos succès et le contenu débloqué. Un nouveau profil démarre avec <b>75% du contenu verrouillé</b>." }),
        h('div.row.wrap', {}, h('label', { text: 'Pseudo en jeu :' }), nameInput),
        h('div', { style: { overflow: 'auto', maxHeight: '48vh', padding: '2px' } }, list),
        h('div.row.wrap', {},
          newName, btn('＋ Nouveau profil', create),
          btn('Importer un profil…', async () => {
            const txt = await pickFile('.json');
            if (!txt) return;
            try { const p = app.store.importJson(txt); selected = p.id; render(); app.toast(`Profil « ${p.name} » importé.`); }
            catch (err) { app.toast('Import impossible : ' + err.message, 'error'); }
          }),
          h('div.spacer'),
          continueBtn)));
    this.mount(el, 'profiles');
    render();
    if (!app.store.list().length) newName.focus();
  }

  // ===========================================================================
  // Join
  // ===========================================================================
  showJoin(prefill = '') {
    const app = this.app;
    const nameInput = h('input', { type: 'text', maxlength: 20, placeholder: 'Votre pseudo', value: app.settings.playerName || '' });
    const codeInput = h('input', { type: 'text', maxlength: 6, placeholder: 'CODE', value: prefill, style: { textTransform: 'uppercase', letterSpacing: '4px', fontSize: '20px', width: '140px', textAlign: 'center' } });
    const status = h('div.small');
    const rooms = h('div.room-list');
    const joinBtn = btn('Rejoindre ➜', () => join(codeInput.value), 'primary');
    const refreshBtn = btn('↻ Actualiser', () => refresh(), 'small');

    const join = async (code) => {
      code = String(code || '').trim().toUpperCase();
      const name = nameInput.value.trim();
      if (!name) { status.className = 'small err'; status.textContent = 'Entrez un pseudo.'; nameInput.focus(); return; }
      if (code.length < 4) { status.className = 'small err'; status.textContent = 'Entrez le code de la partie (4 caractères).'; codeInput.focus(); return; }
      app.settings.playerName = name;
      app.saveSettings();
      status.className = 'small muted';
      status.textContent = 'Connexion…';
      joinBtn.disabled = true;
      try {
        await app.join(code, name);
      } catch (err) {
        status.className = 'small err';
        status.textContent = err.message || 'Connexion impossible.';
        joinBtn.disabled = false;
      }
    };

    const refresh = async () => {
      clear(rooms);
      if ((await netMode()) === 'p2p') {
        refreshBtn.classList.add('hidden');
        rooms.appendChild(h('div.muted.small', { text: "Version en ligne : la liste des parties ouvertes n'est pas disponible. Utilisez le lien ou le code d'invitation donné par l'hôte." }));
        return;
      }
      rooms.appendChild(h('div.muted.small', { text: 'Recherche des parties ouvertes…' }));
      const t = new Transport();
      try {
        await t.connect(4000);
        const res = t.waitFor((m) => m.t === 'rooms', 4000);
        t.sendJson({ t: 'list' });
        const msg = await res;
        clear(rooms);
        if (!msg.rooms.length) rooms.appendChild(h('div.muted.small', { text: 'Aucune partie ouverte sur ce serveur pour le moment.' }));
        for (const r of msg.rooms) {
          rooms.appendChild(h('div.room', {},
            h('div.grow', {}, h('div', { html: `<b>${esc(r.name)}</b> <span class="badge">${esc(r.code)}</span>` }),
              h('div.small.muted', { text: `${r.players}/${r.max} joueurs · ${r.state === 'ingame' ? `en jeu (vague ${r.wave || 1})` : 'dans le salon'}` })),
            btn('Rejoindre', () => { codeInput.value = r.code; join(r.code); }, 'small')));
        }
      } catch {
        clear(rooms);
        rooms.appendChild(h('div.err.small', { text: 'Serveur injoignable : vérifiez que la page est ouverte depuis le serveur de jeu (npm start).' }));
      } finally {
        t.close();
      }
    };

    codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(codeInput.value); });
    const el = h('div.screen', {},
      h('div.panel', { style: { width: 'min(620px, 94vw)', padding: '22px' } },
        h('div.row', {}, h('h2', { text: 'Rejoindre une partie' }), h('div.spacer'), btn('← Retour', () => this.showTitle(), 'small')),
        h('div.col', {},
          h('div.muted', { text: "Entrez le code donné par l'hôte (ou ouvrez directement le lien d'invitation)." }),
          h('div.row.wrap', {}, h('label', { text: 'Pseudo' }), nameInput),
          h('div.row.wrap', {}, h('label', { text: 'Code' }), codeInput, joinBtn),
          status,
          h('div.row', {}, h('h3', { text: 'Parties ouvertes', style: { margin: 0 } }), h('div.spacer'), refreshBtn),
          rooms)));
    this.mount(el, 'join');
    refresh();
    if (!nameInput.value) nameInput.focus(); else codeInput.focus();
  }

  // ===========================================================================
  // Lobby
  // ===========================================================================
  showLobby() {
    const app = this.app;
    const session = app.session;
    const isHost = session.isHost();
    let previewClass = null;
    const left = h('div.panel');
    const center = h('div.panel');
    const right = h('div.panel');
    const chatLog = h('div.chat-log');
    const chatInput = h('input', { type: 'text', maxlength: 200, placeholder: 'Écrire un message…' });
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && chatInput.value.trim()) { session.sendJson({ k: 'chat', s: chatInput.value.trim() }); chatInput.value = ''; }
    });
    const el = h('div.screen', {}, h('div.screen-inner', {}, h('div.lobby', {}, left, center, right)));

    const meEntry = () => session.lobby ? session.lobby.players.find((p) => p.pid === session.pid) : null;

    const renderLeft = () => {
      const L = session.lobby;
      clear(left);
      left.appendChild(h('div.panel-head', {}, h('h2', { text: isHost ? (L && L.online ? 'Salon (hôte)' : 'Partie solo') : 'Salon' })));
      const body = h('div.panel-body.col', { style: { flex: 1, overflow: 'auto' } });
      left.appendChild(body);
      if (!L) { body.appendChild(h('div.muted', { text: 'Connexion…' })); return; }
      body.appendChild(h('div.small.muted', { html: `Profil de progression : <b class="gold">${esc(L.profileName)}</b> (${L.achDone} / ${ACHIEVEMENTS.length} succès)` }));
      const plist = h('div.player-list');
      for (const p of L.players) {
        const c = CLASSES[p.classId];
        const isMe = p.pid === session.pid;
        const state = !p.connected ? h('span.badge.err', { text: 'déconnecté' })
          : p.pid === 0 ? h('span.badge.gold', { text: '👑 hôte' })
            : p.pending ? h('span.badge', { text: 'en attente' })
              : p.ready ? h('span.badge.ok', { text: 'prêt' }) : h('span.badge', { text: 'pas prêt' });
        const row = h('div.player-row', { style: { borderLeft: `3px solid ${PLAYER_COLORS[p.pid % PLAYER_COLORS.length]}` } },
          h('div.cicon', { text: c ? c.icon : '?' }),
          h('div', {}, h('div.pname', { text: p.name + (isMe ? ' (vous)' : '') }), h('div.pstate', { text: c ? c.name : '' })),
          state);
        if (isHost && p.pid !== 0 && L.online) row.appendChild(btn('✕', () => { if (confirm(`Exclure ${p.name} ?`)) app.host.kick(p.pid); }, 'small ghost'));
        plist.appendChild(row);
      }
      body.appendChild(plist);
      if (L.online && L.code) {
        const link = isHost ? app.inviteLink(L.code) : `${app.pageBase()}?join=${L.code}`;
        const linkInput = h('input', { type: 'text', value: link, readonly: true });
        const isLan = /^https?:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(link);
        body.appendChild(h('div.invite', {},
          h('div.small.muted.center', { text: "Code d'invitation" }),
          h('div.code', { text: L.code }),
          linkInput,
          h('div.row', { style: { marginTop: '6px' } },
            btn('📋 Copier le lien', () => {
              navigator.clipboard?.writeText(link).then(() => app.toast('Lien copié !')).catch(() => { linkInput.select(); document.execCommand('copy'); app.toast('Lien copié !'); });
            }, 'small primary grow'),
            isHost ? btn('✎ Adresse', () => {
              const v = prompt("Adresse à utiliser dans le lien d'invitation (ex. l'URL de votre tunnel https://xxxx.trycloudflare.com). Laissez vide pour l'adresse automatique.", app.manualInviteBase());
              if (v === null) return;
              let url = v.trim();
              if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
              app.setManualInviteBase(url);
              renderLeft();
            }, 'small') : null),
          h('div.small.muted', { style: { marginTop: '6px' }, text: isLan
            ? 'Ce lien fonctionne sur votre réseau local. Pour des amis sur Internet, lancez le serveur avec « npm run share » (voir README) : le lien se met à jour tout seul.'
            : 'Envoyez ce lien à vos amis (4 joueurs max).' })));
      }
      body.appendChild(h('div.spacer'));
      body.appendChild(btn('Quitter le salon', () => { if (confirm('Quitter le salon ?')) app.leave(); }, 'danger'));
    };

    const renderCenter = () => {
      const L = session.lobby;
      clear(center);
      center.appendChild(h('div.panel-head', {}, h('h2', { text: 'Choix du héros' })));
      const body = h('div.panel-body', { style: { flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' } });
      center.appendChild(body);
      if (!L) return;
      const me = meEntry();
      const myClass = me ? me.classId : null;
      const locked = (c) => !L.unlocked.classes.includes(c.id);
      const shown = previewClass || myClass;
      const grid = h('div.class-grid');
      for (const c of CLASS_LIST) {
        const lk = locked(c);
        const card = h('div.class-card' + (c.id === myClass ? '.selected' : '') + (lk ? '.locked' : ''), {
          onclick: () => {
            previewClass = c.id;
            if (!lk && me && !(me.inGame)) session.sendJson({ k: 'lobbyClass', classId: c.id });
            renderCenter();
          },
        }, h('div.cic', { text: c.icon }), h('div.cname', { text: c.name }), h('div.crole', { text: c.role }), lk ? h('div.lock', { text: '🔒' }) : null);
        if (lk) {
          const a = achFor('class', c.id);
          tooltip.bind(card, () => `<div class="tt-name" style="color:#ffd979">${esc(c.icon)} ${esc(c.name)} — verrouillé</div>${a ? `<div>Débloqué par le succès <b>${esc(a.name)}</b> :<br>${esc(a.desc)}</div>` : ''}`);
        }
        grid.appendChild(card);
      }
      body.appendChild(grid);
      const c = CLASSES[shown] || CLASS_LIST[0];
      const detail = h('div.class-detail', {},
        h('div.row', {}, h('div', { style: { fontSize: '38px' }, text: c.icon }),
          h('div', {}, h('h3', { text: `${c.name} — ${c.title}`, style: { margin: 0 } }), h('div.small.muted', { text: `${c.role} · Difficulté : ${'★'.repeat(c.difficulty)}${'☆'.repeat(3 - c.difficulty)}` }))),
        h('div', { style: { marginTop: '8px', color: 'var(--text2)' }, text: c.desc }),
        locked(c) ? h('div.warn.small', { style: { marginTop: '6px' }, text: `🔒 Verrouillé — ${achFor('class', c.id) ? 'succès « ' + achFor('class', c.id).name + ' » : ' + achFor('class', c.id).desc : ''}` }) : null);
      const al = h('div.ability-list');
      c.abilities.forEach((id, i) => {
        const ab = ABILITIES[id];
        let desc = '';
        try { desc = ab.desc(ab.p, (coef) => `${Math.round(coef * 100)}%`); } catch { desc = ''; }
        const key = i === 0 ? 'Clic G' : i === 1 ? 'Clic D' : app.input.label(SLOT_KEYS[i]);
        al.appendChild(h('div.ability-row', {},
          h('div.aicon', { text: ab.icon }),
          h('div', {}, h('div.aname', { html: `${esc(ab.name)} <span class="keycap">${esc(key)}</span>` }), h('div.adesc', { html: desc.replace(/(\d+)%/g, '<b>$1%</b>') }))));
      });
      detail.appendChild(al);
      body.appendChild(detail);
      // late join
      if (L.inGame && me && !me.inGame && L.over) {
        body.appendChild(h('div.row', { style: { marginTop: '12px' } },
          h('div.grow.warn', { text: "La partie en cours vient de se terminer. Choisissez votre héros : l'hôte va bientôt revenir au salon." })));
      } else if (L.inGame && me && !me.inGame) {
        body.appendChild(h('div.row', { style: { marginTop: '12px' } },
          h('div.grow.warn', { text: 'Une partie est en cours : choisissez votre héros puis rejoignez la bataille.' }),
          btn('Rejoindre la partie ➜', () => {
            const cls = myClass && L.unlocked.classes.includes(myClass) ? myClass : L.unlocked.classes[0];
            session.sendJson({ k: 'joinGame', classId: cls });
          }, 'primary big')));
      }
    };

    const renderRight = () => {
      const L = session.lobby;
      clear(right);
      right.appendChild(h('div.panel-head', {}, h('h2', { text: 'Partie' })));
      const body = h('div.panel-body.col', { style: { flex: 1, overflow: 'hidden' } });
      right.appendChild(body);
      if (!L) return;
      const diffSel = h('select', { disabled: !isHost || L.inGame });
      for (const d of DIFFICULTY_LIST) {
        const lk = !L.unlocked.difficulties.includes(d.id);
        const o = h('option', { value: d.id, disabled: lk, text: `${d.icon} ${d.name}${lk ? ' 🔒' : ''}` });
        if (d.id === L.difficulty) o.selected = true;
        diffSel.appendChild(o);
      }
      diffSel.addEventListener('change', () => session.sendJson({ k: 'lobbySettings', difficulty: diffSel.value, arena: L.arena }));
      const arenaSel = h('select', { disabled: !isHost || L.inGame });
      for (const a of ARENA_LIST) {
        const lk = !L.unlocked.arenas.includes(a.id);
        const o = h('option', { value: a.id, disabled: lk, text: `${a.icon} ${a.name}${lk ? ' 🔒' : ''}` });
        if (a.id === L.arena) o.selected = true;
        arenaSel.appendChild(o);
      }
      arenaSel.addEventListener('change', () => session.sendJson({ k: 'lobbySettings', difficulty: L.difficulty, arena: arenaSel.value }));
      const d = DIFFICULTIES[L.difficulty];
      const a = ARENAS[L.arena];
      body.appendChild(h('div.select-row', {}, h('label', { text: 'Difficulté' }), diffSel, h('div.small.muted', { text: d ? d.desc : '' })));
      body.appendChild(h('div.select-row', {}, h('label', { text: 'Arène' }), arenaSel, h('div.small.muted', { text: a ? a.desc : '' })));
      body.appendChild(h('div.small.muted', { html: '30 vagues · boss toutes les 5 vagues · victoire contre le Dévoreur (vague 30), puis mode infini.' }));
      if (L.online) {
        body.appendChild(h('div.chat-box', {}, h('h3', { text: 'Discussion' }), chatLog, chatInput));
        renderChat();
      } else body.appendChild(h('div.spacer'));
      const me = meEntry();
      if (isHost) {
        if (!L.inGame) {
          const notReady = L.players.filter((p) => p.connected && !p.ready && p.pid !== 0).length;
          body.appendChild(btn(notReady ? `Lancer la partie (${notReady} pas prêt)` : '⚔️ Lancer la partie', () => session.sendJson({ k: 'start' }), 'primary big block'));
        } else {
          body.appendChild(h('div.muted.small', { text: 'Partie en cours.' }));
        }
      } else if (me && !L.inGame) {
        body.appendChild(btn(me.ready ? '✔ Prêt (annuler)' : 'Je suis prêt', () => session.sendJson({ k: 'lobbyReady', ready: !me.ready }), (me.ready ? '' : 'primary ') + 'big block'));
        body.appendChild(h('div.small.muted.center', { text: "L'hôte lance la partie." }));
      }
    };

    const renderChat = () => {
      clear(chatLog);
      for (const m of session.chat.slice(-60)) {
        chatLog.appendChild(m.pid < 0 ? h('div.sys', { text: m.s }) : h('div', {}, h('b', { text: m.name + ' : ' }), m.s));
      }
      chatLog.scrollTop = chatLog.scrollHeight;
    };

    const renderAll = () => { renderLeft(); renderCenter(); renderRight(); };
    this.mount(el, 'lobby');
    renderAll();
    this.cleanups.push(session.on('lobby', () => { renderLeft(); renderRight(); if (!previewClass) renderCenter(); else renderCenter(); }));
    this.cleanups.push(session.on('chat', () => renderChat()));
    if (isHost) {
      // pick up the public address as soon as a tunnel (npm run share) is ready
      const timer = setInterval(async () => {
        if (!session.lobby || !session.lobby.online) return;
        const before = app.serverInfo ? app.serverInfo.publicUrl : null;
        await app.fetchServerInfo();
        if ((app.serverInfo ? app.serverInfo.publicUrl : null) !== before) renderLeft();
      }, 4000);
      this.cleanups.push(() => clearInterval(timer));
    }
  }

  // ===========================================================================
  // Achievements & collection
  // ===========================================================================
  showAchievementsMenu() {
    const app = this.app;
    const profiles = app.store.list();
    const container = h('div', { style: { flex: 1, overflow: 'auto', minHeight: 0 } });
    const sel = h('select');
    for (const p of profiles) sel.appendChild(h('option', { value: p.id, text: p.name }));
    const last = app.store.last();
    if (last) sel.value = last.id;
    const render = () => {
      const p = app.store.get(sel.value);
      clear(container);
      if (!p) { container.appendChild(h('div.muted', { text: 'Aucun profil : créez-en un depuis « Jouer en solo ».' })); return; }
      renderAchievements(container, p);
    };
    sel.addEventListener('change', render);
    const el = h('div.screen', {},
      h('div.screen-inner.panel', { style: { padding: '18px', height: '94vh' } },
        h('div.row', {}, h('h2', { text: 'Succès & collection', style: { margin: 0 } }), h('label', { text: 'Profil :' }), sel, h('div.spacer'), btn('← Retour', () => this.showTitle(), 'small')),
        container));
    this.mount(el, 'achievements');
    render();
  }

  // ===========================================================================
  // Settings
  // ===========================================================================
  showSettings(onBack, mountIn = null) {
    const app = this.app;
    const s = app.settings;
    const save = () => { app.saveSettings(); app.applySettings(); };
    const slider = (label, key) => {
      const inp = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s.volumes[key] });
      inp.addEventListener('input', () => { s.volumes[key] = +inp.value; save(); });
      return h('div.setting', {}, h('label', { text: label }), inp);
    };
    const check = (label, key) => {
      const inp = h('input', { type: 'checkbox' });
      inp.checked = !!s[key];
      inp.addEventListener('change', () => { s[key] = inp.checked; save(); });
      return h('label.row', { style: { cursor: 'pointer' } }, inp, label);
    };
    const quality = h('select');
    for (const [v, t] of [['low', 'Basse (ordinateurs modestes)'], ['medium', 'Moyenne'], ['high', 'Élevée (ombres HD + bloom)']]) {
      const o = h('option', { value: v, text: t });
      if (s.quality === v) o.selected = true;
      quality.appendChild(o);
    }
    quality.addEventListener('change', () => { s.quality = quality.value; save(); app.toast('Qualité graphique appliquée à la prochaine partie.'); });

    const binds = h('div.bind-grid');
    let waiting = null;
    const renderBinds = () => {
      clear(binds);
      for (const action of Object.keys(DEFAULT_BINDINGS)) {
        const b = h('button.btn.small.bind-btn', { text: app.input.codeLabel(s.bindings[action] || DEFAULT_BINDINGS[action]) });
        b.addEventListener('click', () => {
          if (waiting) return;
          waiting = action;
          b.classList.add('waiting');
          b.textContent = 'Appuyez…';
          const off = app.input.onKey((e) => {
            off();
            waiting = null;
            if (e.code !== 'Escape') { s.bindings[action] = e.code; save(); }
            renderBinds();
            return true;
          });
        });
        binds.appendChild(h('div', { text: BINDING_LABELS[action] || action }));
        binds.appendChild(b);
      }
    };
    renderBinds();

    const content = h('div.panel', { style: { width: 'min(900px, 96vw)', maxHeight: '94vh', overflow: 'auto' } },
      h('div.panel-head', {}, h('h2', { text: 'Paramètres' }), btn('← Retour', () => onBack && onBack(), 'small')),
      h('div.panel-body', {},
        h('div.settings-grid', {},
          h('div.col', {},
            h('h3', { text: 'Graphismes' }),
            h('div.setting', {}, h('label', { text: 'Qualité' }), quality),
            check(' Effet de lueur (bloom, qualité élevée)', 'bloom'),
            check(' Tremblements de caméra', 'shake'),
            check(' Afficher les dégâts', 'damageNumbers'),
            check(' Afficher les dégâts des alliés', 'allyNumbers'),
            check(' Afficher FPS / ping', 'showFps'),
            h('h3', { text: 'Audio', style: { marginTop: '10px' } }),
            slider('Volume général', 'master'),
            slider('Effets sonores', 'sfx'),
            slider('Musique', 'music')),
          h('div.col', {},
            h('h3', { text: 'Touches' }),
            h('div.small.muted', { text: 'Les touches sont des positions physiques : sur un clavier AZERTY, « W » correspond à Z, etc. Les libellés affichés suivent votre clavier.' }),
            binds,
            btn('Réinitialiser les touches', () => { s.bindings = {}; save(); renderBinds(); }, 'small')))));
    if (mountIn) {
      clear(mountIn);
      mountIn.appendChild(content);
      return content;
    }
    this.mount(h('div.screen', {}, content), 'settings');
    return content;
  }

  // ===========================================================================
  // Help
  // ===========================================================================
  showHelp(onBack, mountIn = null) {
    const L = (a) => `<span class="keycap">${esc(this.app.input.label(a))}</span>`;
    const content = h('div.panel', { style: { width: 'min(960px, 96vw)', maxHeight: '94vh', overflow: 'auto' } },
      h('div.panel-head', {}, h('h2', { text: 'Comment jouer' }), btn('← Retour', () => onBack && onBack(), 'small')),
      h('div.panel-body.help-grid', {
        html: `
        <div>
          <h3>Contrôles</h3>
          <ul>
            <li>Déplacement : ${L('up')} ${L('left')} ${L('down')} ${L('right')}</li>
            <li>Viser : souris · Attaque principale : <span class="keycap">Clic G</span> (maintenir)</li>
            <li>Compétence secondaire : <span class="keycap">Clic D</span></li>
            <li>Compétences : ${L('skill1')} ${L('skill2')} · Ultime : ${L('ultimate')}</li>
            <li>Esquive : ${L('dash')} · Potion : ${L('potion')}</li>
            <li>Ramasser / ouvrir un coffre / ranimer un allié : ${L('interact')} (maintenir pour les coffres et la réanimation)</li>
            <li>Lancer la vague suivante : ${L('ready')}</li>
            <li>Inventaire ${L('inventory')} · Boutique ${L('shop')} · Talents ${L('talents')} · Succès ${L('achievements')}</li>
            <li>Afficher tout le butin au sol : ${L('showLoot')} · Discussion : ${L('chat')} · Menu : <span class="keycap">Échap</span></li>
            <li>Molette : zoom</li>
          </ul>
          <h3>Déroulement</h3>
          <ul>
            <li>Survivez à <b>30 vagues</b> dans l'arène. Un <b>boss</b> surgit toutes les 5 vagues ; le Dévoreur attend à la vague 30.</li>
            <li>Entre les vagues, préparez-vous : boutique, inventaire, talents. Quand un joueur appuie sur ${L('ready')}, un compte à rebours de <b>30 s</b> démarre ; si <b>tous</b> les joueurs sont prêts, la vague démarre dans <b>3 s</b>.</li>
            <li>Chaque monstre tué rapporte or et expérience à <b>toute l'équipe</b>, équitablement.</li>
            <li>À chaque niveau, une icône indique les <b>choix de talents</b> disponibles : ils se choisissent <b>uniquement entre les vagues</b> (3 bonus de votre classe, rareté aléatoire).</li>
          </ul>
        </div>
        <div>
          <h3>Survie</h3>
          <ul>
            <li>Les attaques puissantes sont annoncées par des <b style="color:#ff5040">zones rouges</b> : sortez-en ou esquivez (invulnérable pendant l'esquive).</li>
            <li>Les potions se rechargent entre les vagues. Les monstres lâchent parfois des <b>orbes de soin</b>.</li>
            <li>Un héros à terre peut être <b>ranimé</b> par un allié (maintenir ${L('interact')} près de lui). Tous les héros reviennent à la fin de la vague. Si toute l'équipe tombe, la partie est perdue.</li>
            <li>Les monstres <b>élites</b> (anneau coloré) ont des affixes dangereux. Les coffres maudits déclenchent une embuscade.</li>
          </ul>
          <h3>Butin</h3>
          <ul>
            <li>Raretés : <span style="color:var(--common)">Commun</span>, <span style="color:var(--magic)">Magique</span>, <span style="color:var(--rare)">Rare</span>, <span style="color:var(--legendary)">Légendaire</span> (pouvoir spécial aléatoire), <span style="color:var(--unique)">Unique</span> (objet nommé au pouvoir qui change le gameplay).</li>
            <li>Le butin au sol est partagé : <b>jetez un objet</b> (clic droit dans l'inventaire) pour le donner à un allié.</li>
          </ul>
          <h3>Progression</h3>
          <ul>
            <li>Un nouveau profil a <b>75% du contenu verrouillé</b> : classes, objets uniques, aspects légendaires, talents, difficultés et arènes.</li>
            <li>Les <b>succès</b> débloquent ce contenu petit à petit. En coopération, tout ce que fait n'importe quel joueur compte pour le profil de l'hôte.</li>
          </ul>
        </div>`,
      }));
    if (mountIn) { clear(mountIn); mountIn.appendChild(content); return content; }
    this.mount(h('div.screen', {}, content), 'help');
    return content;
  }
}

// =============================================================================
// Achievements / collection / stats renderer (also used in game)
// =============================================================================
const STAT_LABELS = [
  ['runs', 'Parties lancées'], ['wins', 'Victoires'], ['best.wave', 'Meilleure vague'], ['waves', 'Vagues terminées'],
  ['kills', 'Monstres tués'], ['elites', 'Élites tués'], ['bosses', 'Boss vaincus'], ['best.level', 'Niveau maximal'],
  ['best.multikill', 'Éliminations en 1 s (record)'], ['best.hit', 'Plus gros coup'], ['gold', 'Or gagné'], ['gold.spent', 'Or dépensé'],
  ['items.bought', 'Objets achetés'], ['items.sold', 'Objets vendus'], ['loot.legendary', 'Légendaires trouvés'], ['loot.unique', 'Uniques trouvés'],
  ['uniques.distinct', 'Uniques différents découverts'], ['chests', 'Coffres ouverts'], ['potions', 'Potions bues'], ['orbs', 'Orbes ramassés'],
  ['revives', 'Alliés ranimés'], ['deaths', 'Chutes au combat'], ['talents', 'Talents choisis'], ['classes.played', 'Classes jouées'],
];

export function renderAchievements(container, profile, opts = {}) {
  const tabs = h('div.tabs');
  const body = h('div', { style: { marginTop: '0', padding: '12px', background: 'var(--panel3)', border: '1px solid var(--border)', borderRadius: '0 8px 8px 8px' } });
  container.appendChild(tabs);
  container.appendChild(body);
  let tab = opts.tab || 'ach';
  let cat = 'all';
  let hideDone = false;
  let collTab = 'uniques';
  const set = (t) => { tab = t; renderTabs(); renderBody(); };
  const renderTabs = () => {
    clear(tabs);
    for (const [id, label] of [['ach', 'Succès'], ['coll', 'Collection'], ['stats', 'Statistiques']]) {
      tabs.appendChild(h('div.tab' + (tab === id ? '.active' : ''), { onclick: () => set(id), text: label }));
    }
  };
  const renderBody = () => {
    clear(body);
    tooltip.hide();
    if (tab === 'ach') renderAch();
    else if (tab === 'coll') renderColl();
    else renderStats();
  };
  const renderAch = () => {
    const done = ACHIEVEMENTS.filter((a) => profile.isDone(a.id)).length;
    body.appendChild(h('div.ach-summary', {},
      h('div', { style: { fontFamily: 'var(--title-font)', fontSize: '26px', color: 'var(--gold2)', fontWeight: 900 }, text: `${done} / ${ACHIEVEMENTS.length}` }),
      h('div.grow', {}, h('div.progress', {}, h('div', { style: { width: (done / ACHIEVEMENTS.length) * 100 + '%' } })),
        h('div.small.muted', { style: { marginTop: '4px' }, text: `Profil « ${profile.name} » — chaque succès débloque du contenu (affiché en bas de chaque carte).` }))));
    const chips = h('div.chips', { style: { margin: '10px 0' } });
    const cats = [['all', 'Tous'], ...Object.entries(ACH_CATEGORIES).map(([k, v]) => [k, `${v.icon} ${v.name}`])];
    for (const [k, label] of cats) chips.appendChild(h('div.chip' + (cat === k ? '.active' : ''), { onclick: () => { cat = k; renderBody(); }, text: label }));
    chips.appendChild(h('div.chip' + (hideDone ? '.active' : ''), { onclick: () => { hideDone = !hideDone; renderBody(); }, text: 'Masquer les terminés' }));
    body.appendChild(chips);
    const grid = h('div.ach-grid');
    for (const a of ACHIEVEMENTS) {
      if (cat !== 'all' && a.cat !== cat) continue;
      const pr = profile.progress(a);
      if (hideDone && pr.done) continue;
      const catDef = ACH_CATEGORIES[a.cat];
      const card = h('div.ach' + (pr.done ? '.done' : ''), {},
        pr.done ? h('div.check', { text: '✔' }) : null,
        h('div.ahead', {}, h('div.aic', { text: a.icon }), h('div', {}, h('div.aname', { text: a.name }), h('div.acat', { text: catDef ? catDef.name : '' }))),
        h('div.adesc', { text: a.desc }),
        h('div.aprog', {}, h('div.progress', {}, h('div', { style: { width: pr.frac * 100 + '%' } })), h('span', { text: `${fmtInt(Math.min(pr.v, a.n))} / ${fmtInt(a.n)}` })),
        h('div.areward', {}, '🎁 ', ...a.reward.map((r, i) => h('span', { text: (i ? ' · ' : '') + rewardIcon(r) + ' ' + rewardText(r) }))));
      grid.appendChild(card);
    }
    body.appendChild(grid);
  };
  const renderColl = () => {
    const chips = h('div.chips', { style: { marginBottom: '10px' } });
    for (const [k, label] of [['uniques', '💎 Objets uniques'], ['aspects', '🟠 Aspects légendaires'], ['classes', '🎭 Classes'], ['talents', '⭐ Talents'], ['other', '💀 Difficultés & arènes']]) {
      chips.appendChild(h('div.chip' + (collTab === k ? '.active' : ''), { onclick: () => { collTab = k; renderBody(); }, text: label }));
    }
    body.appendChild(chips);
    const grid = h('div.collection-grid');
    const state = (kind, def) => {
      if (profile.isUnlocked(kind, def)) return { locked: false, text: 'Débloqué' };
      const t = { uniques: 'unique', aspects: 'aspect', classes: 'class', talents: 'talent', difficulty: 'difficulty', arenas: 'arena' }[kind];
      const a = achFor(t, def.id);
      return { locked: true, text: a ? `Verrouillé — succès « ${a.name} » : ${a.desc}` : 'Verrouillé' };
    };
    if (collTab === 'uniques') {
      const found = new Set(profile.raw.found || []);
      const n = UNIQUES_LIST.filter((u) => profile.isUnlocked('uniques', u)).length;
      body.appendChild(h('div.small.muted', { style: { marginBottom: '8px' }, text: `${n} / ${UNIQUES_LIST.length} débloqués · ${found.size} découverts en jeu` }));
      for (const u of UNIQUES_LIST) {
        const st = state('uniques', u);
        const f = found.has(u.id);
        const el = h('div.coll-item' + (st.locked ? '.locked' : '') + (f ? '.found' : ''), {},
          h('div', { style: { fontSize: '22px' }, text: st.locked ? '🔒' : u.icon }),
          h('div', {}, h('div.nm', { style: { color: st.locked ? 'var(--muted)' : 'var(--unique)' }, text: u.name }), h('div.sub', { text: (u.cls ? CLASSES[u.cls].name : 'Toutes classes') + (f ? ' · ✔ découvert' : '') })));
        tooltip.bind(el, () => uniqueTooltip(u, st.text));
        grid.appendChild(el);
      }
    } else if (collTab === 'aspects') {
      for (const a of ASPECTS_LIST) {
        const st = state('aspects', a);
        const el = h('div.coll-item' + (st.locked ? '.locked' : ''), {},
          h('div', { style: { fontSize: '22px' }, text: st.locked ? '🔒' : '🟠' }),
          h('div', {}, h('div.nm', { style: { color: st.locked ? 'var(--muted)' : 'var(--legendary)' }, text: 'Aspect ' + a.name }), h('div.sub', { text: st.locked ? 'Verrouillé' : 'Débloqué' })));
        tooltip.bind(el, () => aspectTooltip(a, st.text));
        grid.appendChild(el);
      }
    } else if (collTab === 'classes') {
      for (const c of CLASS_LIST) {
        const st = state('classes', c);
        const el = h('div.coll-item' + (st.locked ? '.locked' : ''), {},
          h('div', { style: { fontSize: '26px' }, text: c.icon }),
          h('div', {}, h('div.nm', { text: c.name }), h('div.sub', { text: `${c.role} · meilleure vague : ${profile.stat('best.wave.cls.' + c.id) || 0}` })));
        tooltip.bind(el, () => `<div class="tt-name">${esc(c.icon)} ${esc(c.name)}</div><div>${esc(c.desc)}</div><div class="tt-imp" style="margin-top:6px">${esc(st.text)}</div>`);
        grid.appendChild(el);
      }
    } else if (collTab === 'talents') {
      for (const t of TALENT_LIST) {
        const st = state('talents', t);
        const el = h('div.coll-item' + (st.locked ? '.locked' : ''), {},
          h('div', { style: { fontSize: '22px' }, text: st.locked ? '🔒' : t.icon }),
          h('div', {}, h('div.nm', { text: t.name }), h('div.sub', { text: t.cls ? CLASSES[t.cls].name : 'Toutes classes' })));
        tooltip.bind(el, () => {
          const r = Math.max(t.minR || 0, 2);
          return `<div class="tt-name" style="color:${TALENT_RARITY_COLORS[TALENT_RARITIES[r]]}">${esc(t.icon)} ${esc(t.name)}</div><div>${esc(talentCardText(t.id, r))}</div><div class="tt-imp">(valeurs en rareté ${TALENT_RARITIES[r]}) · ${t.max} rang(s) max${t.minR ? ' · rareté minimale : ' + TALENT_RARITIES[t.minR] : ''}</div><div class="tt-imp" style="margin-top:6px">${esc(st.text)}</div>`;
        });
        grid.appendChild(el);
      }
    } else {
      for (const d of DIFFICULTY_LIST) {
        const st = state('difficulty', d);
        const el = h('div.coll-item' + (st.locked ? '.locked' : ''), {}, h('div', { style: { fontSize: '22px' }, text: d.icon }),
          h('div', {}, h('div.nm', { text: d.name }), h('div.sub', { text: `Meilleure vague : ${profile.stat('best.wave.diff.' + d.id) || 0}` })));
        tooltip.bind(el, () => `<div class="tt-name">${esc(d.name)}</div><div>${esc(d.desc)}</div><div class="tt-imp" style="margin-top:6px">${esc(st.text)}</div>`);
        grid.appendChild(el);
      }
      for (const a of ARENA_LIST) {
        const st = state('arenas', a);
        const el = h('div.coll-item' + (st.locked ? '.locked' : ''), {}, h('div', { style: { fontSize: '22px' }, text: a.icon }),
          h('div', {}, h('div.nm', { text: a.name }), h('div.sub', { text: st.locked ? 'Verrouillée' : 'Débloquée' })));
        tooltip.bind(el, () => `<div class="tt-name">${esc(a.name)}</div><div>${esc(a.desc)}</div><div class="tt-imp" style="margin-top:6px">${esc(st.text)}</div>`);
        grid.appendChild(el);
      }
    }
    body.appendChild(grid);
  };
  const renderStats = () => {
    const table = h('table.stats-table');
    for (const [k, label] of STAT_LABELS) table.appendChild(h('tr', {}, h('td', { text: label }), h('td', { text: fmtInt(profile.stat(k)) })));
    for (const c of CLASS_LIST) table.appendChild(h('tr', {}, h('td', { text: `Meilleure vague — ${c.name}` }), h('td', { text: fmtInt(profile.stat('best.wave.cls.' + c.id)) })));
    body.appendChild(table);
  };
  renderTabs();
  renderBody();
}
