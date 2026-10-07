// Keyboard & mouse input. Bindings use physical key codes (KeyW = Z on AZERTY keyboards).
export const DEFAULT_BINDINGS = {
  up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
  skill1: 'KeyQ', skill2: 'KeyE', ultimate: 'KeyR', dash: 'Space',
  interact: 'KeyF', potion: 'Digit1', ready: 'KeyG',
  inventory: 'KeyI', shop: 'KeyB', talents: 'KeyT', achievements: 'KeyJ',
  showLoot: 'AltLeft', scoreboard: 'Tab', chat: 'Enter',
};

export const BINDING_LABELS = {
  up: 'Haut', down: 'Bas', left: 'Gauche', right: 'Droite',
  skill1: 'Compétence 1', skill2: 'Compétence 2', ultimate: 'Ultime', dash: 'Esquive',
  interact: 'Interagir / Ramasser / Ranimer', potion: 'Potion', ready: 'Lancer la vague (Prêt)',
  inventory: 'Inventaire', shop: 'Boutique', talents: 'Talents (montées de niveau)', achievements: 'Succès',
  showLoot: 'Afficher le butin au sol', scoreboard: 'Tableau des joueurs', chat: 'Discussion',
};

const FALLBACK_LABELS = {
  Space: 'Espace', Enter: 'Entrée', Escape: 'Échap', Tab: 'Tab', AltLeft: 'Alt', AltRight: 'AltGr', ShiftLeft: 'Maj',
  ShiftRight: 'Maj D', ControlLeft: 'Ctrl', ControlRight: 'Ctrl D', Backquote: '²', CapsLock: 'Verr.Maj',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Mouse0: 'Clic G', Mouse2: 'Clic D', Mouse1: 'Clic M',
};

export class Input {
  constructor(target) {
    this.target = target;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: [false, false, false], pressed: [false, false, false], wheel: 0, inCanvas: true };
    this.enabled = true;
    this.bindings = { ...DEFAULT_BINDINGS };
    this.layoutMap = null;
    this.listeners = [];
    this.keyHandlers = [];
    if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
      navigator.keyboard.getLayoutMap().then((m) => { this.layoutMap = m; }).catch(() => {});
    }
    this.attach();
  }

  setBindings(b) { this.bindings = { ...DEFAULT_BINDINGS, ...(b || {}) }; }

  attach() {
    const on = (el, type, fn, opts) => { el.addEventListener(type, fn, opts); this.listeners.push([el, type, fn, opts]); };
    on(window, 'keydown', (e) => {
      const typing = this.isTyping(e);
      for (const h of this.keyHandlers) if (h(e, typing) === true) { e.preventDefault(); return; }
      if (typing) return;
      if (['Tab', 'Space', 'AltLeft', 'AltRight', 'F1'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    on(window, 'keyup', (e) => { this.keys.delete(e.code); });
    on(window, 'blur', () => { this.keys.clear(); this.mouse.down = [false, false, false]; });
    on(window, 'mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    on(this.target, 'mousedown', (e) => {
      this.mouse.down[e.button] = true;
      this.mouse.pressed[e.button] = true;
      this.pressed.add('Mouse' + e.button);
      this.keys.add('Mouse' + e.button);
    });
    on(window, 'mouseup', (e) => {
      this.mouse.down[e.button] = false;
      this.keys.delete('Mouse' + e.button);
    });
    on(this.target, 'contextmenu', (e) => e.preventDefault());
    on(this.target, 'wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  }

  isTyping(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }

  /** Register a global key handler (returns true to consume) */
  onKey(fn) { this.keyHandlers.push(fn); return () => { this.keyHandlers = this.keyHandlers.filter((h) => h !== fn); }; }

  down(action) {
    if (!this.enabled) return false;
    const code = this.bindings[action];
    return this.keys.has(code);
  }

  justPressed(action) {
    if (!this.enabled) return false;
    return this.pressed.has(this.bindings[action]);
  }

  codeDown(code) { return this.enabled && this.keys.has(code); }
  codePressed(code) { return this.enabled && this.pressed.has(code); }

  endFrame() {
    this.pressed.clear();
    this.mouse.pressed = [false, false, false];
    this.mouse.wheel = 0;
  }

  label(action) { return this.codeLabel(this.bindings[action]); }

  codeLabel(code) {
    if (!code) return '?';
    if (this.layoutMap && this.layoutMap.has(code)) {
      const k = this.layoutMap.get(code);
      if (k && k.trim()) return k.length === 1 ? k.toUpperCase() : k;
    }
    if (FALLBACK_LABELS[code]) return FALLBACK_LABELS[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return 'Pav' + code.slice(6);
    return code;
  }

  dispose() {
    for (const [el, type, fn, opts] of this.listeners) el.removeEventListener(type, fn, opts);
    this.listeners = [];
  }
}
