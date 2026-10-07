// Procedural sound effects & ambient music (WebAudio, no assets).
export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.volumes = { master: 0.7, sfx: 0.8, music: 0.35 };
    this.last = new Map();
    this.active = new Map();
    this.noiseBuf = null;
    this.listener = { x: 0, z: 0 };
    this.music = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    this.sfxGain.connect(this.master);
    this.musicGain.connect(this.master);
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 1.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
  }

  setVolumes(v) {
    Object.assign(this.volumes, v);
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master;
    this.sfxGain.gain.value = this.volumes.sfx;
    this.musicGain.gain.value = this.volumes.music;
  }

  setListener(x, z) { this.listener.x = x; this.listener.z = z; }

  // ---------------------------------------------------------------------------
  // primitives
  // ---------------------------------------------------------------------------
  env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  noise(t, dur, vol, { type = 'bandpass', freq = 1000, q = 1, freq2 = null, attack = 0.005, out = this.sfxGain } = {}) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    this.env(g, t, attack, vol, dur);
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + attack + dur + 0.05);
  }

  tone(t, dur, vol, { type = 'sine', freq = 440, freq2 = null, attack = 0.005, detune = 0, out = this.sfxGain, filter = null } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freq2) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), t + attack + dur);
    o.detune.value = detune;
    const g = c.createGain();
    this.env(g, t, attack, vol, dur);
    if (filter) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      o.connect(f); f.connect(g);
    } else o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  // ---------------------------------------------------------------------------
  // public
  // ---------------------------------------------------------------------------
  play(name, x, z, vol = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const spec = SOUNDS[name];
    if (!spec) return;
    const minGap = spec.gap ?? 0.04;
    const last = this.last.get(name) || 0;
    if (now - last < minGap) return;
    this.last.set(name, now);
    let v = vol * (spec.vol ?? 1);
    if (x !== undefined && x !== null && z !== undefined) {
      const d = Math.hypot(x - this.listener.x, z - this.listener.z);
      v *= Math.max(0, 1 - d / 38);
      if (v < 0.02) return;
    }
    try { spec.fn(this, now, v); } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // music
  // ---------------------------------------------------------------------------
  startMusic() {
    if (!this.ctx || this.music) return;
    const c = this.ctx;
    const out = this.musicGain;
    const drone = c.createOscillator();
    drone.type = 'sawtooth';
    drone.frequency.value = 55;
    const drone2 = c.createOscillator();
    drone2.type = 'sawtooth';
    drone2.frequency.value = 55 * 1.498;
    drone2.detune.value = 7;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 260;
    f.Q.value = 2;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain); lfoGain.connect(f.frequency);
    const g = c.createGain();
    g.gain.value = 0.11;
    drone.connect(f); drone2.connect(f); f.connect(g); g.connect(out);
    drone.start(); drone2.start(); lfo.start();
    this.music = { drone, drone2, lfo, g, f, intensity: 0, nextBeat: c.currentTime + 1, nextBell: c.currentTime + 3, step: 0 };
  }

  setIntensity(v) { if (this.music) this.music.intensity = v; }

  updateMusic() {
    const m = this.music;
    if (!m || !this.ctx) return;
    const c = this.ctx;
    const now = c.currentTime;
    m.f.frequency.setTargetAtTime(220 + m.intensity * 380, now, 0.5);
    // war drums during waves
    const bpm = 96 + m.intensity * 30;
    while (m.nextBeat < now + 0.2) {
      const t = m.nextBeat;
      if (m.intensity > 0.05) {
        const accent = m.step % 4 === 0;
        this.tone(t, 0.35, (accent ? 0.5 : 0.28) * m.intensity, { type: 'sine', freq: accent ? 70 : 90, freq2: 40, out: this.musicGain });
        if (m.step % 2 === 1) this.noise(t, 0.08, 0.08 * m.intensity, { type: 'highpass', freq: 3000, out: this.musicGain });
      }
      m.step++;
      m.nextBeat += 60 / bpm / 2;
    }
    // sparse dark bells
    if (now >= m.nextBell) {
      const scale = [0, 3, 5, 7, 10, 12, 15];
      const n = scale[Math.floor(Math.random() * scale.length)];
      const freq = 220 * Math.pow(2, n / 12);
      this.tone(now, 2.8, 0.05, { type: 'triangle', freq, out: this.musicGain, attack: 0.01 });
      this.tone(now, 2.2, 0.025, { type: 'sine', freq: freq * 2.01, out: this.musicGain, attack: 0.01 });
      m.nextBell = now + 2.5 + Math.random() * 4;
    }
  }

  stopMusic() {
    const m = this.music;
    if (!m) return;
    try { m.drone.stop(); m.drone2.stop(); m.lfo.stop(); } catch { /* ignore */ }
    this.music = null;
  }
}

// name -> { fn(a, t, v), vol, gap }
const SOUNDS = {
  hit: { gap: 0.03, fn: (a, t, v) => { a.noise(t, 0.08, 0.35 * v, { freq: 1800, q: 0.8 }); a.tone(t, 0.06, 0.15 * v, { type: 'square', freq: 180, freq2: 90 }); } },
  mhit: { gap: 0.05, fn: (a, t, v) => { a.noise(t, 0.1, 0.4 * v, { type: 'lowpass', freq: 900 }); a.tone(t, 0.1, 0.2 * v, { type: 'sine', freq: 120, freq2: 60 }); } },
  swing: { gap: 0.05, fn: (a, t, v) => a.noise(t, 0.12, 0.18 * v, { freq: 600, freq2: 2600, q: 2 }) },
  bigswing: { fn: (a, t, v) => a.noise(t, 0.3, 0.4 * v, { freq: 300, freq2: 1800, q: 1.5 }) },
  mshoot: { gap: 0.06, fn: (a, t, v) => a.tone(t, 0.12, 0.12 * v, { type: 'triangle', freq: 600, freq2: 300 }) },
  boom: { gap: 0.05, fn: (a, t, v) => { a.noise(t, 0.5, 0.6 * v, { type: 'lowpass', freq: 1200, freq2: 100 }); a.tone(t, 0.4, 0.4 * v, { type: 'sine', freq: 90, freq2: 35 }); } },
  pop: { gap: 0.04, fn: (a, t, v) => a.noise(t, 0.15, 0.3 * v, { type: 'lowpass', freq: 1600, freq2: 300 }) },
  zap: { gap: 0.05, fn: (a, t, v) => { a.tone(t, 0.12, 0.12 * v, { type: 'sawtooth', freq: 1400, freq2: 200, filter: 3000 }); a.noise(t, 0.1, 0.15 * v, { type: 'highpass', freq: 3000 }); } },
  freeze: { fn: (a, t, v) => { a.noise(t, 0.4, 0.3 * v, { type: 'highpass', freq: 3000, freq2: 6000 }); a.tone(t, 0.3, 0.1 * v, { type: 'sine', freq: 1800, freq2: 2400 }); } },
  fireball: { fn: (a, t, v) => a.noise(t, 0.35, 0.3 * v, { freq: 400, freq2: 1400, q: 1 }) },
  arcane: { gap: 0.06, fn: (a, t, v) => a.tone(t, 0.12, 0.1 * v, { type: 'sine', freq: 900, freq2: 1500 }) },
  shadow: { gap: 0.06, fn: (a, t, v) => a.tone(t, 0.15, 0.12 * v, { type: 'triangle', freq: 300, freq2: 600 }) },
  bow: { gap: 0.05, fn: (a, t, v) => { a.tone(t, 0.1, 0.15 * v, { type: 'triangle', freq: 220, freq2: 120 }); a.noise(t, 0.08, 0.1 * v, { freq: 3000 }); } },
  volley: { fn: (a, t, v) => { for (let i = 0; i < 4; i++) a.noise(t + i * 0.03, 0.08, 0.15 * v, { freq: 2500 }); } },
  rain: { fn: (a, t, v) => a.noise(t, 1.2, 0.2 * v, { freq: 3000, q: 0.5 }) },
  trap: { fn: (a, t, v) => a.tone(t, 0.1, 0.15 * v, { type: 'square', freq: 400, freq2: 800, filter: 2000 }) },
  focus: { fn: (a, t, v) => { a.tone(t, 0.5, 0.15 * v, { type: 'sine', freq: 400, freq2: 1200 }); } },
  roll: { fn: (a, t, v) => a.noise(t, 0.18, 0.15 * v, { type: 'lowpass', freq: 800 }) },
  dash: { fn: (a, t, v) => a.noise(t, 0.2, 0.2 * v, { freq: 500, freq2: 2000, q: 1 }) },
  leap: { fn: (a, t, v) => a.noise(t, 0.3, 0.2 * v, { freq: 400, freq2: 1600 }) },
  slam: { fn: (a, t, v) => { a.tone(t, 0.5, 0.5 * v, { type: 'sine', freq: 80, freq2: 30 }); a.noise(t, 0.4, 0.4 * v, { type: 'lowpass', freq: 600, freq2: 80 }); } },
  whirl: { gap: 0.15, fn: (a, t, v) => a.noise(t, 0.5, 0.2 * v, { freq: 800, freq2: 1600, q: 3 }) },
  warcry: { fn: (a, t, v) => { a.tone(t, 0.7, 0.25 * v, { type: 'sawtooth', freq: 160, freq2: 120, filter: 900 }); a.tone(t, 0.7, 0.15 * v, { type: 'sawtooth', freq: 240, freq2: 180, filter: 900 }); } },
  titan: { fn: (a, t, v) => { a.tone(t, 1, 0.35 * v, { type: 'sawtooth', freq: 60, freq2: 120, filter: 500 }); a.noise(t, 0.8, 0.3 * v, { type: 'lowpass', freq: 400 }); } },
  blink: { fn: (a, t, v) => a.tone(t, 0.2, 0.15 * v, { type: 'sine', freq: 1600, freq2: 400 }) },
  meteor: { fn: (a, t, v) => { a.noise(t, 1, 0.7 * v, { type: 'lowpass', freq: 800, freq2: 60 }); a.tone(t, 0.8, 0.5 * v, { type: 'sine', freq: 70, freq2: 25 }); } },
  meteorcall: { fn: (a, t, v) => a.noise(t, 1, 0.25 * v, { freq: 200, freq2: 1200 }) },
  raise: { fn: (a, t, v) => { a.tone(t, 0.5, 0.12 * v, { type: 'triangle', freq: 200, freq2: 100 }); a.noise(t, 0.4, 0.1 * v, { type: 'lowpass', freq: 500 }); } },
  golem: { fn: (a, t, v) => a.tone(t, 0.8, 0.4 * v, { type: 'sawtooth', freq: 70, freq2: 40, filter: 400 }) },
  shadowstep: { fn: (a, t, v) => a.noise(t, 0.25, 0.15 * v, { freq: 300, freq2: 900 }) },
  rivet: { gap: 0.04, fn: (a, t, v) => { a.tone(t, 0.05, 0.12 * v, { type: 'square', freq: 900, freq2: 300, filter: 2500 }); } },
  build: { fn: (a, t, v) => { for (let i = 0; i < 3; i++) a.tone(t + i * 0.07, 0.05, 0.15 * v, { type: 'square', freq: 300 + i * 100, filter: 1500 }); } },
  throw: { fn: (a, t, v) => a.noise(t, 0.15, 0.15 * v, { freq: 700, freq2: 1500 }) },
  orbital: { fn: (a, t, v) => { a.tone(t, 0.6, 0.15 * v, { type: 'sawtooth', freq: 1200, freq2: 300, filter: 2000 }); } },
  holy: { fn: (a, t, v) => { a.tone(t, 0.8, 0.12 * v, { type: 'sine', freq: 660 }); a.tone(t, 0.8, 0.1 * v, { type: 'sine', freq: 990 }); } },
  aegis: { fn: (a, t, v) => { a.tone(t, 0.6, 0.15 * v, { type: 'triangle', freq: 523 }); a.tone(t + 0.08, 0.6, 0.12 * v, { type: 'triangle', freq: 784 }); } },
  holycall: { fn: (a, t, v) => { a.tone(t, 1.2, 0.12 * v, { type: 'sine', freq: 440, freq2: 880 }); } },
  judgment: { fn: (a, t, v) => { a.noise(t, 0.8, 0.5 * v, { type: 'lowpass', freq: 2000, freq2: 200 }); a.tone(t, 1, 0.3 * v, { type: 'sine', freq: 880, freq2: 440 }); } },
  knives: { fn: (a, t, v) => { for (let i = 0; i < 5; i++) a.noise(t + i * 0.02, 0.06, 0.12 * v, { freq: 4000, q: 3 }); } },
  smoke: { fn: (a, t, v) => a.noise(t, 0.7, 0.3 * v, { type: 'lowpass', freq: 900, freq2: 300 }) },
  mark: { fn: (a, t, v) => a.tone(t, 0.3, 0.15 * v, { type: 'triangle', freq: 300, freq2: 150 }) },
  dance: { fn: (a, t, v) => a.noise(t, 0.4, 0.2 * v, { freq: 1500, freq2: 4000, q: 4 }) },
  drain: { fn: (a, t, v) => a.tone(t, 0.6, 0.12 * v, { type: 'sawtooth', freq: 300, freq2: 150, filter: 800 }) },
  plague: { fn: (a, t, v) => a.noise(t, 0.5, 0.25 * v, { type: 'lowpass', freq: 700 }) },
  curse: { fn: (a, t, v) => { a.tone(t, 0.7, 0.12 * v, { type: 'sawtooth', freq: 110, freq2: 90, filter: 600 }); a.tone(t, 0.7, 0.1 * v, { type: 'sawtooth', freq: 117, filter: 600 }); } },
  potion: { fn: (a, t, v) => { a.tone(t, 0.15, 0.15 * v, { type: 'sine', freq: 500, freq2: 800 }); a.tone(t + 0.1, 0.2, 0.12 * v, { type: 'sine', freq: 700, freq2: 1100 }); } },
  orb: { gap: 0.08, fn: (a, t, v) => a.tone(t, 0.2, 0.15 * v, { type: 'sine', freq: 700, freq2: 1000 }) },
  levelup: { gap: 0.3, fn: (a, t, v) => { [523, 659, 784, 1047].forEach((f, i) => a.tone(t + i * 0.08, 0.35, 0.18 * v, { type: 'triangle', freq: f })); } },
  talent: { fn: (a, t, v) => { a.tone(t, 0.3, 0.15 * v, { type: 'triangle', freq: 784 }); a.tone(t + 0.07, 0.4, 0.15 * v, { type: 'triangle', freq: 1175 }); } },
  coin: { gap: 0.05, fn: (a, t, v) => { a.tone(t, 0.08, 0.15 * v, { type: 'square', freq: 1320, filter: 4000 }); a.tone(t + 0.07, 0.15, 0.15 * v, { type: 'square', freq: 1760, filter: 4000 }); } },
  equip: { fn: (a, t, v) => a.noise(t, 0.15, 0.25 * v, { freq: 1200, q: 2 }) },
  pickup: { fn: (a, t, v) => a.tone(t, 0.12, 0.15 * v, { type: 'triangle', freq: 600, freq2: 900 }) },
  chest: { fn: (a, t, v) => { [392, 523, 659].forEach((f, i) => a.tone(t + i * 0.1, 0.4, 0.12 * v, { type: 'triangle', freq: f })); } },
  chestopen: { fn: (a, t, v) => { a.noise(t, 0.3, 0.2 * v, { type: 'lowpass', freq: 600 }); [523, 659, 784, 1047, 1319].forEach((f, i) => a.tone(t + 0.15 + i * 0.06, 0.4, 0.12 * v, { type: 'triangle', freq: f })); } },
  dropunique: { fn: (a, t, v) => { [784, 988, 1175, 1568].forEach((f, i) => a.tone(t + i * 0.09, 0.9, 0.2 * v, { type: 'sine', freq: f })); } },
  droplegend: { fn: (a, t, v) => { [659, 880, 1047].forEach((f, i) => a.tone(t + i * 0.08, 0.7, 0.18 * v, { type: 'sine', freq: f })); } },
  wavestart: { fn: (a, t, v) => { a.tone(t, 1.2, 0.3 * v, { type: 'sawtooth', freq: 110, freq2: 116, filter: 700, attack: 0.1 }); a.tone(t, 1.2, 0.2 * v, { type: 'sawtooth', freq: 165, filter: 700, attack: 0.1 }); } },
  bosswave: { fn: (a, t, v) => { a.tone(t, 2, 0.35 * v, { type: 'sawtooth', freq: 55, freq2: 50, filter: 500, attack: 0.2 }); a.tone(t, 2, 0.25 * v, { type: 'sawtooth', freq: 82, filter: 500, attack: 0.2 }); a.noise(t, 1.5, 0.2 * v, { type: 'lowpass', freq: 300 }); } },
  waveclear: { fn: (a, t, v) => { [523, 659, 784].forEach((f, i) => a.tone(t + i * 0.12, 0.6, 0.2 * v, { type: 'triangle', freq: f })); } },
  prep: { fn: () => {} },
  tick: { fn: (a, t, v) => a.tone(t, 0.08, 0.2 * v, { type: 'square', freq: 880, filter: 3000 }) },
  victory: { fn: (a, t, v) => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => a.tone(t + i * 0.18, 0.6, 0.25 * v, { type: 'triangle', freq: f })); } },
  defeat: { fn: (a, t, v) => { [392, 349, 311, 262].forEach((f, i) => a.tone(t + i * 0.3, 0.8, 0.25 * v, { type: 'sawtooth', freq: f, filter: 900 })); } },
  herodown: { fn: (a, t, v) => a.tone(t, 0.8, 0.3 * v, { type: 'sawtooth', freq: 300, freq2: 80, filter: 1200 }) },
  revive: { fn: (a, t, v) => { [392, 523, 784].forEach((f, i) => a.tone(t + i * 0.1, 0.5, 0.2 * v, { type: 'sine', freq: f })); } },
  bossintro: { fn: (a, t, v) => { a.tone(t, 2.5, 0.4 * v, { type: 'sawtooth', freq: 45, freq2: 60, filter: 400, attack: 0.3 }); a.noise(t, 2, 0.3 * v, { type: 'lowpass', freq: 250 }); } },
  bossdeath: { fn: (a, t, v) => { a.noise(t, 2, 0.6 * v, { type: 'lowpass', freq: 1500, freq2: 60 }); a.tone(t, 2, 0.4 * v, { type: 'sawtooth', freq: 120, freq2: 30, filter: 600 }); } },
  roar: { fn: (a, t, v) => { a.noise(t, 0.9, 0.4 * v, { freq: 300, freq2: 150, q: 2 }); a.tone(t, 0.9, 0.2 * v, { type: 'sawtooth', freq: 90, freq2: 70, filter: 500 }); } },
  fuse: { fn: (a, t, v) => a.noise(t, 0.8, 0.15 * v, { type: 'highpass', freq: 4000 }) },
  block: { fn: (a, t, v) => a.tone(t, 0.1, 0.2 * v, { type: 'square', freq: 1500, freq2: 700, filter: 3000 }) },
  turret: { gap: 0.06, vol: 0.6, fn: (a, t, v) => a.tone(t, 0.04, 0.1 * v, { type: 'square', freq: 700, freq2: 200, filter: 2500 }) },
  jail: { fn: (a, t, v) => a.tone(t, 0.3, 0.2 * v, { type: 'square', freq: 200, filter: 900 }) },
  fireburst: { gap: 0.05, fn: (a, t, v) => a.noise(t, 0.4, 0.35 * v, { type: 'lowpass', freq: 1500, freq2: 200 }) },
  splash: { fn: (a, t, v) => a.noise(t, 0.3, 0.3 * v, { freq: 700, freq2: 300 }) },
  spit: { fn: (a, t, v) => a.noise(t, 0.2, 0.2 * v, { freq: 1200, freq2: 500 }) },
  bite: { fn: (a, t, v) => a.noise(t, 0.12, 0.35 * v, { type: 'lowpass', freq: 1000 }) },
  screech: { fn: (a, t, v) => a.tone(t, 0.8, 0.15 * v, { type: 'sawtooth', freq: 1200, freq2: 900, filter: 3000 }) },
  bonecall: { fn: (a, t, v) => { for (let i = 0; i < 4; i++) a.noise(t + i * 0.05, 0.08, 0.2 * v, { freq: 2200, q: 4 }); } },
  quake: { fn: (a, t, v) => { a.noise(t, 2.5, 0.5 * v, { type: 'lowpass', freq: 200 }); a.tone(t, 2, 0.3 * v, { type: 'sine', freq: 40 }); } },
  chant: { fn: (a, t, v) => { a.tone(t, 2, 0.12 * v, { type: 'sawtooth', freq: 147, filter: 700, attack: 0.3 }); a.tone(t, 2, 0.1 * v, { type: 'sawtooth', freq: 220, filter: 700, attack: 0.3 }); } },
  breath: { fn: (a, t, v) => a.noise(t, 1, 0.45 * v, { freq: 500, freq2: 1500, q: 0.7 }) },
  charge: { fn: (a, t, v) => a.tone(t, 1.2, 0.25 * v, { type: 'sawtooth', freq: 80, freq2: 400, filter: 1500 }) },
  vortex: { fn: (a, t, v) => a.noise(t, 2.2, 0.35 * v, { freq: 200, freq2: 800, q: 3 }) },
  corpse: { gap: 0.06, fn: (a, t, v) => { a.noise(t, 0.3, 0.35 * v, { type: 'lowpass', freq: 900, freq2: 150 }); } },
  timeslow: { fn: (a, t, v) => a.tone(t, 1, 0.2 * v, { type: 'sine', freq: 800, freq2: 200 }) },
};
