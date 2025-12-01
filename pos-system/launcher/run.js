// Lanzador ligero sin Electron
// - Arranca backend (Express) en modo producción
// - Abre Microsoft Edge/Chrome en modo "app" apuntando a http://localhost:3000
// - Cuando la ventana del navegador se cierra, termina el backend

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT, 'frontend');
const FRONTEND_DIST = path.join(FRONTEND_DIR, 'dist');
const BACKEND_SERVER_JS = path.join(ROOT, 'backend', 'src', 'server.js');
const PORT = process.env.PORT || 3000;
const APP_HOST = process.env.APP_HOST || 'sistema.pos';
const HTTPS_ENABLED = process.env.HTTPS === '1' || process.env.HTTPS === 'true' || true;

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      const family = typeof net.family === 'string' ? net.family : net.family === 4 ? 'IPv4' : 'IPv6';
      if (family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

function exec(cmd, args, options = {}) {
  const child = spawn(cmd, args, { stdio: 'inherit', shell: false, ...options });
  child.on('error', (err) => console.error(`[launcher] Error ejecutando ${cmd}:`, err.message));
  return child;
}

function waitForHealth(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const client = url.startsWith('https://') ? https : http;
      client
        .get(url, (res) => {
          if (res.statusCode === 200) {
            resolve(true);
          } else {
            if (Date.now() - start > timeoutMs) return reject(new Error(`Health check fallo: ${res.statusCode}`));
            setTimeout(tryOnce, 500);
          }
        })
        .on('error', () => {
          if (Date.now() - start > timeoutMs) return reject(new Error('Health check timeout'));
          setTimeout(tryOnce, 500);
        });
    };
    tryOnce();
  });
}

async function main() {
  console.log('[launcher] Iniciando lanzador ligero…');

  // 1) Asegurar build del frontend
  if (!fs.existsSync(FRONTEND_DIST) || !fs.existsSync(path.join(FRONTEND_DIST, 'index.html'))) {
    console.log('[launcher] No se encuentra frontend/dist, construyendo…');
    await new Promise((resolve) => {
      const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      const child = spawn(cmd, ['run', 'build'], { cwd: FRONTEND_DIR, stdio: 'inherit' });
      child.on('exit', async (code) => {
        if (code !== 0) {
          console.warn('[launcher] Build con tsc falló, intentando build:fast…');
          await new Promise((r2) => {
            const fast = spawn(cmd, ['run', 'build:fast'], { cwd: FRONTEND_DIR, stdio: 'inherit' });
            fast.on('exit', () => r2());
          });
        }
        resolve();
      });
    });
    if (!fs.existsSync(FRONTEND_DIST) || !fs.existsSync(path.join(FRONTEND_DIST, 'index.html'))) {
      console.error('[launcher] Build de frontend no generó dist/index.html.');
      process.exit(1);
    }
  } else {
    console.log('[launcher] frontend/dist detectado.');
  }

  // 2) Arrancar backend en producción
  if (!fs.existsSync(BACKEND_SERVER_JS)) {
    console.error('[launcher] No se encuentra backend/src/server.js. ¿Compilado?');
    process.exit(1);
  }

  const backendEnv = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(PORT),
    HOST: '0.0.0.0',
    HTTPS: HTTPS_ENABLED ? '1' : '0',
  };

  console.log('[launcher] Arrancando backend…');
  const backend = spawn(process.execPath, [BACKEND_SERVER_JS], {
    env: backendEnv,
    stdio: 'inherit',
    detached: false,
  });

  backend.on('exit', (code) => {
    console.log(`[launcher] Backend salió con código ${code}`);
    process.exit(code || 0);
  });

  // 3) Esperar salud del servidor
  try {
    const healthScheme = HTTPS_ENABLED ? 'https' : 'http';
    const healthUrl = `${healthScheme}://localhost:${PORT}/api/test-health`;
    await waitForHealth(healthUrl, 20000);
    console.log('[launcher] Backend saludable.');
  } catch (err) {
    console.warn('[launcher] Health check no respondió a tiempo:', err.message);
  }

  // 4) Abrir navegador en modo app
  const hostForOpen = APP_HOST || getLocalIp();
  const scheme = HTTPS_ENABLED ? 'https' : 'http';
  const appUrl = `${scheme}://${hostForOpen}:${PORT}/`;
  console.log('[launcher] Abriendo ventana de app en', appUrl);

  let browserCmd = null;
  let browserArgs = [];
  let browser = null;

  // Preferir Edge, luego Chrome con rutas típicas en Windows
  if (process.platform === 'win32') {
    const edgePaths = [
      'C\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe',
      'C\\\\Program Files\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe',
    ];
    const chromePaths = [
      'C\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
      'C\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
    ];

    const foundEdge = edgePaths.find((p) => fs.existsSync(p));
    const foundChrome = chromePaths.find((p) => fs.existsSync(p));

    if (foundEdge) {
      browserCmd = foundEdge;
      browserArgs = ['--app=' + appUrl, '--start-maximized'];
      browser = exec(browserCmd, browserArgs);
    } else if (foundChrome) {
      browserCmd = foundChrome;
      browserArgs = ['--app=' + appUrl, '--start-maximized'];
      browser = exec(browserCmd, browserArgs);
    } else {
      console.log('[launcher] Edge/Chrome no encontrados en rutas típicas. Abriendo navegador por defecto…');
      // Abrir con navegador predeterminado (sin modo app)
      spawn('cmd.exe', ['/c', 'start', '', appUrl], { stdio: 'ignore', detached: true });
      return;
    }
  } else {
    // Otros sistemas: intentar xdg-open
    spawn('xdg-open', [appUrl], { stdio: 'ignore', detached: true });
    return;
  }

  // 5) Al cerrar la ventana, matar backend
  browser.on('exit', (code) => {
    console.log(`[launcher] Ventana cerrada (código ${code}). Terminando backend…`);
    try {
      backend.kill('SIGINT');
    } catch (e) {
      console.warn('[launcher] No se pudo terminar backend limpiamente:', e.message);
    }
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[launcher] Error fatal:', err);
  process.exit(1);
});

