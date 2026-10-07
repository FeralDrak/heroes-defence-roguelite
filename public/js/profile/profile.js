// Player profiles (stored in the browser of the player who hosts) and achievement tracking.
import { ACHIEVEMENTS, ACH_BY_KEY, ACHIEVEMENTS_BY_ID } from '../core/data/achievements.js';

const STORE_KEY = 'hdr.profiles.v1';

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

function newId() {
  return 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

export function emptyProfile(name) {
  const now = Date.now();
  return { id: newId(), name: String(name || 'Héros').slice(0, 24), created: now, updated: now, stats: {}, ach: {}, found: [], classesPlayed: [], playtime: 0, version: 1 };
}

export class ProfileStore {
  constructor() {
    this.data = { version: 1, lastId: null, profiles: {} };
    const raw = safeGet(STORE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.profiles) this.data = parsed;
      } catch { /* corrupted: start fresh */ }
    }
  }

  persist() {
    return safeSet(STORE_KEY, JSON.stringify(this.data));
  }

  list() {
    return Object.values(this.data.profiles).sort((a, b) => b.updated - a.updated).map((p) => new Profile(p, this));
  }

  get(id) {
    const p = this.data.profiles[id];
    return p ? new Profile(p, this) : null;
  }

  last() {
    return this.data.lastId ? this.get(this.data.lastId) : null;
  }

  create(name) {
    const p = emptyProfile(name);
    this.data.profiles[p.id] = p;
    this.data.lastId = p.id;
    this.persist();
    return new Profile(p, this);
  }

  remove(id) {
    delete this.data.profiles[id];
    if (this.data.lastId === id) this.data.lastId = null;
    this.persist();
  }

  setLast(id) {
    this.data.lastId = id;
    this.persist();
  }

  importJson(text) {
    const obj = JSON.parse(text);
    const p = obj && obj.profile ? obj.profile : obj;
    if (!p || typeof p !== 'object' || !p.stats || !p.ach) throw new Error('Fichier de profil invalide');
    p.id = newId();
    p.name = String(p.name || 'Importé').slice(0, 24);
    p.updated = Date.now();
    p.found = Array.isArray(p.found) ? p.found : [];
    p.classesPlayed = Array.isArray(p.classesPlayed) ? p.classesPlayed : [];
    this.data.profiles[p.id] = p;
    this.persist();
    return new Profile(p, this);
  }
}

export class Profile {
  constructor(raw, store = null) {
    this.raw = raw;
    this.store = store;
    this._unlocks = null;
  }

  get id() { return this.raw.id; }
  get name() { return this.raw.name; }
  get stats() { return this.raw.stats; }

  save() {
    this.raw.updated = Date.now();
    if (this.store) {
      this.store.data.profiles[this.raw.id] = this.raw;
      this.store.persist();
    }
  }

  rename(name) {
    this.raw.name = String(name || this.raw.name).slice(0, 24);
    this.save();
  }

  exportJson() {
    return JSON.stringify({ format: 'heroes-defence-profile', version: 1, profile: this.raw }, null, 1);
  }

  isDone(achId) { return !!this.raw.ach[achId]; }
  doneCount() { return Object.keys(this.raw.ach).length; }

  stat(key) { return this.raw.stats[key] || 0; }

  progress(ach) {
    const v = this.stat(ach.key);
    return { v, n: ach.n, frac: Math.max(0, Math.min(1, v / ach.n)), done: this.isDone(ach.id) };
  }

  /** Unlocked content (beyond the defaults) as sets of ids */
  unlocks() {
    if (this._unlocks) return this._unlocks;
    const u = { classes: new Set(), uniques: new Set(), aspects: new Set(), talents: new Set(), difficulty: new Set(), arenas: new Set() };
    const map = { class: 'classes', unique: 'uniques', aspect: 'aspects', talent: 'talents', difficulty: 'difficulty', arena: 'arenas' };
    for (const id of Object.keys(this.raw.ach)) {
      const a = ACHIEVEMENTS_BY_ID[id];
      if (!a) continue;
      for (const r of a.reward) u[map[r.type]].add(r.id);
    }
    this._unlocks = u;
    return u;
  }

  isUnlocked(kind, def) {
    if (!def.locked) return true;
    return this.unlocks()[kind].has(def.id);
  }

  /** Plain serializable summary (sent to other players to display the host's progress) */
  summary() {
    const u = this.unlocks();
    return {
      name: this.raw.name,
      stats: this.raw.stats,
      ach: this.raw.ach,
      found: this.raw.found,
      unlocks: Object.fromEntries(Object.entries(u).map(([k, s]) => [k, [...s]])),
    };
  }
}

/** Profile-like object built from a summary received over the network */
export class RemoteProfile extends Profile {
  constructor(summary) {
    super({ id: 'remote', name: summary.name, stats: summary.stats || {}, ach: summary.ach || {}, found: summary.found || [] });
  }
}

/**
 * Consumes statistic events from the game and unlocks achievements.
 * Every player's actions count for the host's profile.
 */
export class Tracker {
  constructor(profile, onUnlock) {
    this.profile = profile;
    this.onUnlock = onUnlock;
    this.dirty = false;
    this.lastSave = 0;
  }

  startRun(classes, nPlayers) {
    const s = this.profile.raw.stats;
    s.runs = (s.runs || 0) + 1;
    const played = new Set(this.profile.raw.classesPlayed || []);
    for (const c of classes) {
      played.add(c);
      s['runs.cls.' + c] = (s['runs.cls.' + c] || 0) + 1;
    }
    this.profile.raw.classesPlayed = [...played];
    s['classes.played'] = played.size;
    s['runs.players.' + nPlayers] = (s['runs.players.' + nPlayers] || 0) + 1;
    this.check(['runs', 'classes.played']);
    this.profile.save();
  }

  process(events) {
    if (!events.length) return;
    const s = this.profile.raw.stats;
    const touched = new Set();
    for (const ev of events) {
      const k = ev.k;
      if (ev.max !== undefined) {
        if (!(s[k] >= ev.max)) { s[k] = ev.max; touched.add(k); }
      } else {
        s[k] = (s[k] || 0) + ev.n;
        touched.add(k);
      }
      if (k.startsWith('unique.') || k.startsWith('found.unique.')) {
        const id = k.startsWith('unique.') ? k.slice(7) : k.slice(13);
        const found = this.profile.raw.found;
        if (!found.includes(id)) {
          found.push(id);
          s['uniques.distinct'] = found.length;
          touched.add('uniques.distinct');
        }
      }
    }
    this.dirty = true;
    this.check(touched);
  }

  check(keys) {
    const unlocked = [];
    for (const k of keys) {
      const list = ACH_BY_KEY[k];
      if (!list) continue;
      for (const a of list) {
        if (this.profile.raw.ach[a.id]) continue;
        if ((this.profile.raw.stats[a.key] || 0) >= a.n) {
          this.profile.raw.ach[a.id] = Date.now();
          this.profile._unlocks = null;
          unlocked.push(a);
        }
      }
    }
    if (unlocked.length) {
      this.profile.save();
      this.dirty = false;
      for (const a of unlocked) this.onUnlock && this.onUnlock(a);
    }
    return unlocked;
  }

  /** Periodic save (called by the host) */
  maybeSave(force = false) {
    const now = Date.now();
    if (this.dirty && (force || now - this.lastSave > 15000)) {
      this.profile.save();
      this.dirty = false;
      this.lastSave = now;
    }
  }
}

export { ACHIEVEMENTS };
