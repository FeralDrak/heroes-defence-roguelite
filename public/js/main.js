// Entry point.
import { App } from './app.js';


function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2')) || !!c.getContext('webgl');
  } catch {
    return false;
  }
}

if (!webglAvailable()) {
  document.getElementById('loading').innerHTML = '<div class="loading-inner"><div class="loading-title">WebGL indisponible</div><div class="loading-sub">Votre navigateur ne supporte pas WebGL : activez l\'accélération matérielle ou utilisez un navigateur récent (Chrome, Firefox, Edge).</div></div>';
} else {
  const app = new App();
  window.heroesDefence = app; // debugging helper
  app.start();
}
