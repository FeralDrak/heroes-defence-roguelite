// A ticker driven by a Web Worker: keeps running at full rate when the tab is in the background
// (main-thread timers are throttled by browsers), so the host keeps simulating for everyone.
const WORKER_SRC = `let id = null;
onmessage = (e) => {
  if (id) clearInterval(id);
  id = null;
  if (e.data > 0) id = setInterval(() => postMessage(0), e.data);
};`;

export function createTicker(intervalMs, fn) {
  try {
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
    const w = new Worker(url);
    w.onmessage = () => fn();
    w.postMessage(intervalMs);
    return { stop() { w.postMessage(0); w.terminate(); URL.revokeObjectURL(url); } };
  } catch {
    const id = setInterval(fn, intervalMs);
    return { stop() { clearInterval(id); } };
  }
}
