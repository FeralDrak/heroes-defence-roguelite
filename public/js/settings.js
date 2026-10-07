// User settings (per browser).
const KEY = 'hdr.settings.v1';

export const DEFAULT_SETTINGS = {
  quality: 'medium',
  bloom: true,
  volumes: { master: 0.7, sfx: 0.8, music: 0.35 },
  damageNumbers: true,
  allyNumbers: true,
  shake: true,
  bindings: {},
  playerName: '',
  showFps: true,
};

export function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { s = {}; }
  const out = { ...DEFAULT_SETTINGS, ...s };
  out.volumes = { ...DEFAULT_SETTINGS.volumes, ...(s.volumes || {}) };
  out.bindings = { ...(s.bindings || {}) };
  if (!s.quality) {
    // first run: guess quality from the device
    const mem = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    out.quality = mem >= 8 && cores >= 8 ? 'high' : mem <= 2 ? 'low' : 'medium';
  }
  return out;
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
