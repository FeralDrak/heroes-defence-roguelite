// WebSocket connection to the relay server.
export class Transport {
  constructor(url) {
    this.url = url || Transport.defaultUrl();
    this.ws = null;
    this.handlers = { control: [], binary: [], close: [] };
    this.rtt = 0;
    this.pingTimer = null;
    this.open = false;
  }

  static defaultUrl() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/ws`;
  }

  on(type, fn) { this.handlers[type].push(fn); return () => { this.handlers[type] = this.handlers[type].filter((f) => f !== fn); }; }
  emit(type, data) { for (const fn of this.handlers[type].slice()) fn(data); }

  connect(timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      let done = false;
      let ws;
      try {
        ws = new WebSocket(this.url);
      } catch (err) {
        reject(err);
        return;
      }
      ws.binaryType = 'arraybuffer';
      this.ws = ws;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        try { ws.close(); } catch { /* ignore */ }
        reject(new Error('Délai de connexion dépassé'));
      }, timeoutMs);
      ws.onopen = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        this.open = true;
        this.pingTimer = setInterval(() => this.sendJson({ t: 'ping', ts: performance.now() }), 2000);
        resolve();
      };
      ws.onerror = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(new Error('Impossible de joindre le serveur'));
      };
      ws.onclose = () => {
        this.open = false;
        clearInterval(this.pingTimer);
        if (!done) { done = true; clearTimeout(timer); reject(new Error('Connexion fermée')); }
        this.emit('close', {});
      };
      ws.onmessage = (e) => {
        if (typeof e.data === 'string') {
          let msg;
          try { msg = JSON.parse(e.data); } catch { return; }
          if (msg.t === 'pong') {
            const r = performance.now() - msg.ts;
            this.rtt = this.rtt ? this.rtt * 0.7 + r * 0.3 : r;
            return;
          }
          this.emit('control', msg);
        } else {
          this.emit('binary', e.data);
        }
      };
    });
  }

  /** Wait for a control message matching a predicate */
  waitFor(pred, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const off = this.on('control', (msg) => {
        if (msg.t === 'error') { off(); clearTimeout(t); reject(new Error(msg.msg || 'Erreur')); return; }
        if (pred(msg)) { off(); clearTimeout(t); resolve(msg); }
      });
      const t = setTimeout(() => { off(); reject(new Error('Pas de réponse du serveur')); }, timeoutMs);
    });
  }

  sendJson(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  sendBinary(buf) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(buf);
  }

  get buffered() { return this.ws ? this.ws.bufferedAmount : 0; }

  close() {
    clearInterval(this.pingTimer);
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
    }
    this.open = false;
  }
}
