// 2D canvas overlay drawn on top of the 3D view.
import * as THREE from 'three';
import { UF, DF, DMG_TYPES, DMG_TYPE_COLORS, ITEM_RARITY_COLORS, PLAYER_COLORS } from '../core/constants.js';
import { fmtNum } from '../core/util/math.js';
import { ELITE_AFFIXES } from '../core/data/elites.js';
import { MONSTER_RIGS, BIG_RIGS, HERO_RIGS } from './rigs.js';

const v3 = new THREE.Vector3();
const RIG_H = {};
function rigHeight(name) {
  if (RIG_H[name] !== undefined) return RIG_H[name];
  let h = 2;
  try {
    if (name.startsWith('hero_')) h = HERO_RIGS[name.slice(5)]().h;
    else if (MONSTER_RIGS[name]) h = MONSTER_RIGS[name]().h;
    else if (BIG_RIGS[name]) h = BIG_RIGS[name]().h;
  } catch { /* ignore */ }
  RIG_H[name] = h;
  return h;
}

export class Overlay {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.w = 0; this.h = 0;
    this.texts = [];
    this.labels = [];
    this.settings = { damageNumbers: true, allyNumbers: true };
  }

  resize(w, h, dpr) {
    this.dpr = Math.min(dpr, 2);
    this.w = w; this.h = h;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
  }

  project(camera, x, y, z) {
    v3.set(x, y, z).project(camera);
    return { x: (v3.x * 0.5 + 0.5) * this.w, y: (-v3.y * 0.5 + 0.5) * this.h, behind: v3.z > 1 };
  }

  addDamage(d, world, localPid, unitPos) {
    if (!this.settings.damageNumbers) return;
    const pos = unitPos(d.id);
    if (!pos) return;
    const f = d.flags;
    const type = DMG_TYPES[f & DF.TYPE_MASK];
    const mine = d.pid === localPid;
    const toHero = !(f & DF.ALLY_SRC) && !(f & DF.HEAL);
    const u = world.units.get(d.id);
    const onHero = u && u.kind === 'hero';
    if ((f & DF.ALLY_SRC) && !mine && !this.settings.allyNumbers) return;
    if (this.texts.length > 220) this.texts.shift();
    let text, color, size;
    if (f & DF.MISS) {
      if (!(onHero || mine)) return;
      text = d.amount <= -1.5 ? 'Absorbé' : d.amount < 0 ? 'Immunisé' : 'Esquive';
      color = d.amount <= -1.5 ? '#ffe066' : '#bbbbbb'; size = 15;
    } else if (f & DF.HEAL) {
      if (d.amount < 1) return;
      text = '+' + fmtNum(d.amount); color = '#6dff7a'; size = 15;
    } else if (toHero || onHero) {
      text = fmtNum(d.amount); color = '#ff4b4b'; size = onHero && world.myHeroView() === u ? 20 : 15;
    } else {
      text = fmtNum(d.amount);
      const crit = f & DF.CRIT;
      color = crit ? '#ffd23a' : (f & DF.DOT) ? (DMG_TYPE_COLORS[type] || '#ff9a50') : (type === 'phys' ? '#ffffff' : DMG_TYPE_COLORS[type]);
      size = crit ? 24 : (f & DF.DOT) ? 13 : 16;
      if (!mine) size *= 0.8;
      if (crit) text += '!';
    }
    this.texts.push({
      x: pos.x + (Math.random() - 0.5) * 0.6, y: pos.y, z: pos.z + (Math.random() - 0.5) * 0.6,
      text, color, size, t: 0, life: (f & DF.CRIT) ? 1.1 : 0.85, vx: (Math.random() - 0.5) * 30, alpha: mine || onHero ? 1 : 0.6,
      crit: !!(f & DF.CRIT),
    });
  }

  addText(x, y, z, text, color = '#ffffff', size = 16) {
    this.texts.push({ x, y, z, text, color, size, t: 0, life: 1.4, vx: 0, alpha: 1, crit: false });
  }

  /**
   * ctx: { camera, world, unitViews, controller, localPid, showLoot, prompt, hoverId, dt }
   */
  draw(c) {
    const g = this.ctx;
    const dpr = this.dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    const { camera, world } = c;
    const localHeroId = world.heroIdOf(c.localPid);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';

    // ---- unit bars
    for (const u of world.units.values()) {
      const isLocal = u.id === localHeroId;
      let wx = u.x, wz = u.z, wy;
      const view = c.unitViews.views.get(u.id);
      if (view) {
        const hp = c.unitViews.headPos(u.id);
        wx = hp.x; wz = hp.z; wy = hp.y;
      } else {
        wy = rigHeight(u.visName) * (u.scale || 1) + 0.25;
      }
      if (u.kind === 'hero' && (u.flags & UF.DOWN)) wy = 1.2;
      if (u.kind === 'monster' && (u.flags & UF.SPAWNING)) continue;
      const p = this.project(camera, wx, wy, wz);
      if (p.behind || p.x < -50 || p.x > this.w + 50 || p.y < -50 || p.y > this.h + 50) continue;
      if (u.kind === 'monster') {
        const elite = u.flags & UF.ELITE;
        if (u.hp >= 0.999 && !elite) continue;
        const w = elite ? 62 : 34;
        this.bar(g, p.x, p.y, w, elite ? 6 : 4, u.hp, elite ? '#ffb030' : '#e33', null);
        if (elite) {
          const info = world.infos.get(u.id);
          if (info) {
            g.font = 'bold 11px Inter, sans-serif';
            const af = info.af && info.af[0];
            g.fillStyle = af && ELITE_AFFIXES[af] ? ELITE_AFFIXES[af].color : '#ffcc33';
            g.strokeStyle = 'rgba(0,0,0,0.8)';
            g.lineWidth = 3;
            g.strokeText(info.n, p.x, p.y - 11);
            g.fillText(info.n, p.x, p.y - 11);
          }
        }
      } else if (u.kind === 'boss') {
        this.bar(g, p.x, p.y, 110, 7, u.hp, '#c22', null);
      } else if (u.kind === 'hero') {
        const pid = world.pidOfUnit(u.id);
        const hd = world.heroData.get(pid);
        const me = c.session.players.get(pid);
        const name = me ? me.name : '?';
        const col = PLAYER_COLORS[pid % PLAYER_COLORS.length];
        const hpFrac = hd ? hd.hp / Math.max(1, hd.maxHp) : u.hp;
        const shield = hd ? Math.min(1, hd.shield / Math.max(1, hd.maxHp)) : 0;
        if (!isLocal || c.showOwnName) {
          g.font = 'bold 12px Inter, sans-serif';
          g.strokeStyle = 'rgba(0,0,0,0.85)';
          g.lineWidth = 3;
          const label = hd ? `${name} · ${hd.level}` : name;
          g.strokeText(label, p.x, p.y - 12);
          g.fillStyle = col;
          g.fillText(label, p.x, p.y - 12);
        }
        this.bar(g, p.x, p.y, 54, 6, hpFrac, hpFrac > 0.35 ? '#3c3' : '#e33', shield);
        if (u.flags & UF.DOWN) {
          g.font = 'bold 12px Inter, sans-serif';
          g.fillStyle = '#ff6b6b';
          g.strokeText('À TERRE', p.x, p.y + 14);
          g.fillText('À TERRE', p.x, p.y + 14);
          if (hd && hd.revive > 0) this.bar(g, p.x, p.y + 26, 54, 5, hd.revive / 3, '#7dff9a', null);
        }
      } else if (u.kind === 'summon' || u.kind === 'structure') {
        if (u.hp < 0.999) this.bar(g, p.x, p.y, 30, 3, u.hp, '#5af', null);
      }
    }

    // ---- loot labels
    this.labels = [];
    const placed = [];
    for (const pk of world.pickups.values()) {
      if (pk.k !== 'item' || !pk.it) continue;
      const it = pk.it;
      const always = it.rarity !== 'common' && it.rarity !== 'magic';
      if (!c.showLoot && !always && pk.id !== c.hoverId) continue;
      const p = this.project(camera, pk.x, 1.2, pk.z);
      if (p.behind) continue;
      g.font = 'bold 12px Inter, sans-serif';
      const text = it.name;
      const tw = g.measureText(text).width + 14;
      let y = p.y - 8;
      for (let guard = 0; guard < 8; guard++) {
        const hit = placed.find((r) => Math.abs(r.x - p.x) < (r.w + tw) / 2 && Math.abs(r.y - y) < 18);
        if (!hit) break;
        y = hit.y - 19;
      }
      const rect = { x: p.x, y, w: tw, h: 18, id: pk.id };
      placed.push(rect);
      this.labels.push(rect);
      const hover = pk.id === c.hoverId;
      g.fillStyle = hover ? 'rgba(40,30,20,0.95)' : 'rgba(10,8,6,0.78)';
      g.strokeStyle = ITEM_RARITY_COLORS[it.rarity];
      g.lineWidth = hover ? 2 : 1;
      roundRect(g, p.x - tw / 2, y - 9, tw, 18, 4);
      g.fill();
      g.stroke();
      g.fillStyle = ITEM_RARITY_COLORS[it.rarity];
      g.fillText(text, p.x, y + 0.5);
    }

    // ---- floating texts
    const dt = c.dt;
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.t += dt;
      if (t.t >= t.life) { this.texts.splice(i, 1); continue; }
      const p = this.project(camera, t.x, t.y, t.z);
      if (p.behind) continue;
      const k = t.t / t.life;
      const rise = 40 * k + (t.crit ? 10 : 0);
      const sc = t.crit ? 1 + Math.max(0, 0.4 - t.t) * 1.5 : 1;
      g.globalAlpha = t.alpha * (k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1);
      g.font = `bold ${Math.round(t.size * sc)}px Inter, sans-serif`;
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(0,0,0,0.85)';
      const x = p.x + t.vx * k;
      g.strokeText(t.text, x, p.y - rise);
      g.fillStyle = t.color;
      g.fillText(t.text, x, p.y - rise);
    }
    g.globalAlpha = 1;

    // ---- interaction prompt
    if (c.prompt) {
      const p = this.project(camera, c.prompt.x, c.prompt.y ?? 1.6, c.prompt.z);
      if (!p.behind) {
        g.font = 'bold 13px Inter, sans-serif';
        const tw = g.measureText(c.prompt.text).width + 20;
        g.fillStyle = 'rgba(10,8,6,0.85)';
        roundRect(g, p.x - tw / 2, p.y - 40, tw, 22, 5);
        g.fill();
        g.strokeStyle = '#d4a83a';
        g.lineWidth = 1;
        g.stroke();
        g.fillStyle = '#ffe9a8';
        g.fillText(c.prompt.text, p.x, p.y - 29);
        if (c.prompt.progress > 0) this.bar(g, p.x, p.y - 12, 80, 5, c.prompt.progress, '#ffd24a', null);
      }
    }

    // ---- off-screen indicators (allies & bosses)
    for (const u of world.units.values()) {
      if (u.id === localHeroId) continue;
      if (u.kind !== 'hero' && u.kind !== 'boss') continue;
      const p = this.project(camera, u.x, 1, u.z);
      const m = 30;
      if (p.x >= m && p.x <= this.w - m && p.y >= m && p.y <= this.h - m && !p.behind) continue;
      const cx = this.w / 2, cy = this.h / 2;
      let dx = p.x - cx, dy = p.y - cy;
      if (p.behind) { dx = -dx; dy = -dy; }
      const s = Math.min((cx - m) / Math.abs(dx || 1e-6), (cy - m) / Math.abs(dy || 1e-6));
      const ix = cx + dx * s, iy = cy + dy * s;
      const ang = Math.atan2(dy, dx);
      g.save();
      g.translate(ix, iy);
      g.rotate(ang);
      g.fillStyle = u.kind === 'boss' ? '#ff3030' : PLAYER_COLORS[world.pidOfUnit(u.id) % PLAYER_COLORS.length];
      g.beginPath();
      g.moveTo(14, 0); g.lineTo(-8, -9); g.lineTo(-8, 9); g.closePath();
      g.fill();
      g.restore();
    }
  }

  bar(g, x, y, w, h, frac, color, shield) {
    frac = Math.max(0, Math.min(1, frac));
    g.fillStyle = 'rgba(0,0,0,0.75)';
    g.fillRect(x - w / 2 - 1, y - h / 2 - 1, w + 2, h + 2);
    g.fillStyle = color;
    g.fillRect(x - w / 2, y - h / 2, w * frac, h);
    if (shield > 0) {
      g.fillStyle = 'rgba(255,230,120,0.85)';
      g.fillRect(x - w / 2, y - h / 2, w * Math.min(1, shield), Math.max(2, h / 3));
    }
  }

  /** Loot label under the mouse (screen coords) */
  labelAt(mx, my) {
    for (let i = this.labels.length - 1; i >= 0; i--) {
      const r = this.labels[i];
      if (Math.abs(mx - r.x) <= r.w / 2 && Math.abs(my - r.y) <= r.h / 2) return r.id;
    }
    return 0;
  }

  clear() {
    this.texts = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
