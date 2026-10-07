// Floating tooltip that follows the mouse.
class Tooltip {
  constructor() {
    this.el = null;
    this.owner = null;
  }

  init() { this.el = document.getElementById('tooltip'); }

  show(html, x, y, owner = null) {
    if (!this.el) this.init();
    if (!html) { this.hide(); return; }
    this.owner = owner;
    this.el.innerHTML = html;
    this.el.classList.remove('hidden');
    this.move(x, y);
  }

  move(x, y) {
    if (!this.el || this.el.classList.contains('hidden')) return;
    const r = this.el.getBoundingClientRect();
    let px = x + 18, py = y + 16;
    if (px + r.width > window.innerWidth - 6) px = x - r.width - 14;
    if (py + r.height > window.innerHeight - 6) py = window.innerHeight - r.height - 6;
    if (px < 6) px = 6;
    if (py < 6) py = 6;
    this.el.style.left = px + 'px';
    this.el.style.top = py + 'px';
  }

  hide(owner = null) {
    if (!this.el) return;
    if (owner && this.owner && owner !== this.owner) return;
    this.el.classList.add('hidden');
    this.owner = null;
  }

  /** Attach to an element; htmlFn() is called on hover */
  bind(el, htmlFn) {
    el.addEventListener('mouseenter', (e) => this.show(htmlFn(), e.clientX, e.clientY, el));
    el.addEventListener('mousemove', (e) => this.move(e.clientX, e.clientY));
    el.addEventListener('mouseleave', () => this.hide(el));
    return el;
  }
}

export const tooltip = new Tooltip();

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------
export function contextMenu(x, y, items) {
  const el = document.getElementById('ctxmenu');
  el.innerHTML = '';
  for (const it of items) {
    if (!it) continue;
    const d = document.createElement('div');
    d.textContent = it.label;
    d.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); hideContextMenu(); it.action(); });
    el.appendChild(d);
  }
  el.classList.remove('hidden');
  const r = el.getBoundingClientRect();
  el.style.left = Math.min(x, window.innerWidth - r.width - 6) + 'px';
  el.style.top = Math.min(y, window.innerHeight - r.height - 6) + 'px';
  setTimeout(() => window.addEventListener('mousedown', hideContextMenu, { once: true }), 0);
}

export function hideContextMenu() {
  const el = document.getElementById('ctxmenu');
  if (el) el.classList.add('hidden');
}
