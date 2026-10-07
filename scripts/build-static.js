// Builds a self-contained static version of the game in dist/, for GitHub Pages or any static host.
// Without the Node server, online games use direct WebRTC connections (public/js/net/p2p.js).
// Usage: npm run build
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const DIST = path.join(ROOT, 'dist');
const THREE = path.join(ROOT, 'node_modules', 'three');
const PEERJS = path.join(ROOT, 'node_modules', 'peerjs', 'dist');

// module specifiers: `from '…'`, `import '…'`, `import('…')`
const SPEC_RE = /(\bfrom\s*|\bimport\s*\(?\s*)(['"])([^'"\n]+)\2/g;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function specifiers(code) {
  const list = [];
  for (const m of code.matchAll(SPEC_RE)) list.push(m[3]);
  return list;
}

const stripSourceMap = (code) => code.replace(/^\/\/# sourceMappingURL=.*$/gm, '');

function copyText(from, to, transform = (s) => s) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, transform(fs.readFileSync(from, 'utf8')));
}

/** Copy a module and, recursively, the relative modules it imports */
function copyModuleTree(srcFile, srcRoot, dstRoot, seen = new Set()) {
  if (seen.has(srcFile)) return;
  seen.add(srcFile);
  if (!fs.existsSync(srcFile)) throw new Error(`missing module ${path.relative(ROOT, srcFile)}`);
  copyText(srcFile, path.join(dstRoot, path.relative(srcRoot, srcFile)), stripSourceMap);
  for (const spec of specifiers(fs.readFileSync(srcFile, 'utf8'))) {
    if (spec.startsWith('./') || spec.startsWith('../')) copyModuleTree(path.resolve(path.dirname(srcFile), spec), srcRoot, dstRoot, seen);
  }
}

const t0 = Date.now();
fs.rmSync(DIST, { recursive: true, force: true });
fs.cpSync(PUBLIC, DIST, { recursive: true });

// version stamp: content hash of the game files, appended to module URLs so that browsers never mix
// cached modules of two different deployments
const hash = crypto.createHash('sha1');
for (const f of walk(PUBLIC).sort()) hash.update(path.relative(PUBLIC, f)).update(fs.readFileSync(f));
const version = hash.digest('hex').slice(0, 10);

// --- vendor: Three.js (minified build) + the add-ons the game imports
const gameJs = walk(path.join(DIST, 'js')).filter((f) => f.endsWith('.js'));
const addons = new Set();
for (const f of gameJs) for (const s of specifiers(fs.readFileSync(f, 'utf8'))) if (s.startsWith('three/addons/')) addons.add(s.slice('three/addons/'.length));
copyModuleTree(path.join(THREE, 'build', 'three.module.min.js'), path.join(THREE, 'build'), path.join(DIST, 'vendor', 'three'));
fs.renameSync(path.join(DIST, 'vendor', 'three', 'three.module.min.js'), path.join(DIST, 'vendor', 'three', 'three.module.js'));
const addonSeen = new Set();
for (const a of addons) copyModuleTree(path.join(THREE, 'examples', 'jsm', a), path.join(THREE, 'examples', 'jsm'), path.join(DIST, 'vendor', 'three-addons'), addonSeen);

// --- vendor: PeerJS (classic script, loaded on demand for online games)
copyText(path.join(PEERJS, 'peerjs.min.js'), path.join(DIST, 'vendor', 'peerjs', 'peerjs.min.js'), stripSourceMap);

// --- versioned module URLs
for (const f of gameJs) {
  const code = fs.readFileSync(f, 'utf8');
  const out = code.replace(SPEC_RE, (all, pre, q, spec) => ((spec.startsWith('./') || spec.startsWith('../')) && spec.endsWith('.js') ? `${pre}${q}${spec}?v=${version}${q}` : all));
  fs.writeFileSync(f, out);
}

// --- index.html: static mode marker + versioned entry points
const indexFile = path.join(DIST, 'index.html');
let html = fs.readFileSync(indexFile, 'utf8');
const before = html;
html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <meta name="hd-net" content="p2p">')
  .replace('href="css/style.css"', `href="css/style.css?v=${version}"`)
  .replace('src="js/main.js"', `src="js/main.js?v=${version}"`);
if (html === before || !html.includes('hd-net') || !html.includes(`main.js?v=${version}`)) throw new Error('index.html: unexpected layout, could not stamp it');
fs.writeFileSync(indexFile, html);

// --- old links (repository published "as is", game under /public/) lead to the game
fs.mkdirSync(path.join(DIST, 'public'), { recursive: true });
fs.writeFileSync(path.join(DIST, 'public', 'index.html'), `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Heroes Defence</title>
<meta http-equiv="refresh" content="0; url=../">
<script>location.replace('../' + location.search + location.hash);</script>
</head><body><a href="../">Heroes Defence</a></body></html>
`);

// --- check: every import of the game and of the add-ons resolves to a built file
const importMap = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
const problems = [];
const resolveBare = (spec) => {
  if (importMap[spec]) return path.join(DIST, importMap[spec]);
  for (const [prefix, target] of Object.entries(importMap)) if (prefix.endsWith('/') && spec.startsWith(prefix)) return path.join(DIST, target, spec.slice(prefix.length));
  return null;
};
for (const f of walk(DIST).filter((x) => x.endsWith('.js') && !x.includes(`${path.sep}peerjs${path.sep}`))) {
  for (const spec of specifiers(fs.readFileSync(f, 'utf8'))) {
    const clean = spec.split('?')[0];
    const target = clean.startsWith('.') ? path.resolve(path.dirname(f), clean) : resolveBare(clean);
    if (!target || !fs.existsSync(target)) problems.push(`${path.relative(DIST, f)} -> ${spec}`);
  }
}
for (const ref of ['js/main.js', 'css/style.css', 'vendor/three/three.module.js', 'vendor/peerjs/peerjs.min.js']) {
  if (!fs.existsSync(path.join(DIST, ref))) problems.push(`missing ${ref}`);
}
if (problems.length) {
  console.error('Build check failed, unresolved imports:\n  ' + problems.join('\n  '));
  process.exit(1);
}

const files = walk(DIST);
const size = files.reduce((s, f) => s + fs.statSync(f).size, 0);
console.log(`dist/ ready: ${files.length} files, ${(size / 1024 / 1024).toFixed(2)} MB, version ${version} (${Date.now() - t0} ms)`);
console.log(`Three.js add-ons: ${[...addonSeen].map((f) => path.relative(path.join(THREE, 'examples', 'jsm'), f).replace(/\\/g, '/')).join(', ')}`);
