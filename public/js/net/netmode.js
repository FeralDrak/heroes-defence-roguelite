// Multiplayer transport selection:
// - 'server': the page comes from the game server (npm start / npm run share) -> WebSocket relay;
// - 'p2p': static hosting (GitHub Pages…) -> direct WebRTC connections between browsers.
import { Transport } from './transport.js';
import { P2PHostTransport, P2PClientTransport } from './p2p.js';

let modePromise = null;

export function netMode() {
  if (modePromise) return modePromise;
  modePromise = (async () => {
    // manual override for testing: ?net=p2p or ?net=server (kept for the tab)
    let forced = null;
    try {
      forced = new URLSearchParams(location.search).get('net') || sessionStorage.getItem('hdr.net');
      if (forced) sessionStorage.setItem('hdr.net', forced);
    } catch { /* ignore */ }
    if (forced === 'p2p' || forced === 'server') return forced;
    // static builds (npm run build) are marked in index.html
    const meta = document.querySelector('meta[name="hd-net"]');
    if (meta && meta.content === 'p2p') return 'p2p';
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch('api/info', { cache: 'no-store', signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok && /json/.test(res.headers.get('content-type') || '')) return 'server';
    } catch { /* no game server behind this page */ }
    return 'p2p';
  })();
  return modePromise;
}

export async function createTransport(role) {
  const mode = await netMode();
  if (mode === 'p2p') return role === 'host' ? new P2PHostTransport() : new P2PClientTransport();
  return new Transport();
}
