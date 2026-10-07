// Serves dist/ like GitHub Pages does (static files only, under a sub-folder), to test a build locally.
// Usage: npm run build && npm run preview   -> http://localhost:4173/heroes-defence-roguelite/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 4173;
const BASE = '/' + (process.env.BASE_PATH || 'heroes-defence-roguelite').replace(/^\/+|\/+$/g, '') + '/';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('dist/ is missing: run "npm run build" first.');
  process.exit(1);
}

http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); res.end(); return; }
  if (p === '/' || p === BASE.slice(0, -1)) { res.writeHead(302, { Location: BASE }); res.end(); return; }
  if (!p.startsWith(BASE)) { res.writeHead(404); res.end('Not found'); return; }
  let file = path.resolve(DIST, p.slice(BASE.length) || 'index.html');
  if (!file.startsWith(DIST)) { res.writeHead(404); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'max-age=600' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Static preview (like GitHub Pages): http://localhost:${PORT}${BASE}`));
