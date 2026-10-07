// Heroes Defence - starts the game server AND a temporary Cloudflare tunnel, so that
// friends on the Internet can join without touching the router.
// Usage: npm run share   (needs cloudflared: winget install --id Cloudflare.cloudflared)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.PORT) || 3000;
process.env.PORT = String(PORT);
process.env.HD_SHARE = '1';
await import('./server.js');

function cloudflaredPath() {
  if (process.env.CLOUDFLARED) return process.env.CLOUDFLARED;
  if (process.platform === 'win32') {
    // winget / MSI install locations (PATH is only refreshed in new terminals)
    const dirs = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links')];
    for (const d of dirs) {
      if (!d) continue;
      for (const f of [path.join(d, 'cloudflared', 'cloudflared.exe'), path.join(d, 'cloudflared.exe')]) {
        if (fs.existsSync(f)) return f;
      }
    }
  }
  return 'cloudflared';
}

function banner(lines) {
  console.log('');
  console.log('  ==============================================================');
  for (const l of lines) console.log('  ' + l);
  console.log('  ==============================================================');
  console.log('');
}

const bin = cloudflaredPath();
const child = spawn(bin, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${PORT}`], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let publicUrl = null;
let log = '';

function onOutput(buf) {
  const s = buf.toString();
  if (!publicUrl) log = (log + s).slice(-4000);
  const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i.exec(s);
  if (m && !publicUrl) {
    publicUrl = m[0];
    process.env.PUBLIC_URL = publicUrl; // read by /api/info: invitation links use it
    banner([
      'Tunnel Internet prêt !',
      '',
      `  Vous (hôte) :  http://localhost:${PORT}`,
      `  Vos amis    :  ${publicUrl}`,
      '',
      'Créez la partie depuis « Héberger une partie » : le lien',
      "d'invitation du salon utilise automatiquement l'adresse publique.",
      "(L'adresse peut mettre une dizaine de secondes à répondre.)",
      'Ctrl+C pour tout arrêter. Adresse différente à chaque lancement.',
    ]);
  }
}
child.stdout.on('data', onOutput);
child.stderr.on('data', onOutput);

child.on('error', (err) => {
  if (err.code === 'ENOENT') {
    banner([
      "cloudflared n'est pas installé : le jeu reste accessible en local",
      `(http://localhost:${PORT}) et sur votre réseau, mais pas sur Internet.`,
      '',
      'Pour inviter des amis sur Internet, installez-le une fois :',
      '  winget install --id Cloudflare.cloudflared',
      '(ou https://developers.cloudflare.com/cloudflare-one/connections/',
      ' connect-networks/downloads/), puis relancez : npm run share',
    ]);
  } else {
    console.error('cloudflared :', err.message);
  }
});

let stopping = false;
child.on('exit', (code) => {
  if (stopping) return;
  if (publicUrl) {
    console.log(`Tunnel fermé (code ${code}). Le serveur local continue de tourner.`);
    process.env.PUBLIC_URL = '';
  } else if (code !== null) {
    console.log(`cloudflared s'est arrêté (code ${code}) avant d'ouvrir le tunnel :`);
    console.log(log.split('\n').slice(-8).join('\n'));
  }
});

function shutdown() {
  stopping = true;
  try { child.kill(); } catch { /* ignore */ }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
