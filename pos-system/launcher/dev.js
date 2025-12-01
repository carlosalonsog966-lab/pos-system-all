// Dev launcher: arrancar backend y frontend, detectar puerto de Vite y abrir URL
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT, 'frontend');
const BACKEND_DIR = path.join(ROOT, 'backend');

function execNpm(args, cwd) {
  const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
}

function waitForUrl(url, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error('Timeout esperando ' + url));
        else setTimeout(tryOnce, 500);
      });
    };
    tryOnce();
  });
}

async function main() {
  console.log('[dev] Iniciando backend y frontend…');

  // Arrancar backend si no está saludable
  let backendReadyUrl = 'http://localhost:5656/api/test-health';
  let backendReady = false;
  try {
    await waitForUrl(backendReadyUrl, 3000);
    backendReady = true;
    console.log('[dev] Backend ya está arriba en 5656.');
  } catch {}

  let backendProc;
  if (!backendReady) {
    console.log('[dev] Arrancando backend (nodemon)…');
    backendProc = execNpm(['run', 'dev'], BACKEND_DIR);
    backendProc.stdout.on('data', (d) => process.stdout.write('[backend] ' + d.toString()));
    backendProc.stderr.on('data', (d) => process.stderr.write('[backend] ' + d.toString()));
    try {
      await waitForUrl(backendReadyUrl, 20000);
      console.log('[dev] Backend saludable.');
    } catch (e) {
      console.warn('[dev] Backend no respondió a tiempo:', e.message);
    }
  }

  // Arrancar frontend (vite) y detectar puerto
  console.log('[dev] Arrancando frontend (vite)…');
  const feProc = execNpm(['run', 'dev'], FRONTEND_DIR);
  let viteUrl = '';
  const viteUrlRegex = /(http:\/\/localhost:\d+\/)\s*$/i;
  feProc.stdout.on('data', (buf) => {
    const line = buf.toString();
    process.stdout.write('[frontend] ' + line);
    const m = line.match(viteUrlRegex);
    if (m && m[1]) {
      viteUrl = m[1];
    }
  });
  feProc.stderr.on('data', (buf) => process.stderr.write('[frontend] ' + buf.toString()));

  // Esperar a tener URL de Vite y ping exitoso
  const start = Date.now();
  while (!viteUrl) {
    await new Promise((r) => setTimeout(r, 200));
    if (Date.now() - start > 15000) break;
  }
  const finalUrl = viteUrl || 'http://localhost:5174/';
  try {
    await waitForUrl(finalUrl, 10000);
    console.log('[dev] Frontend saludable en:', finalUrl);
  } catch {
    console.warn('[dev] No se pudo verificar el frontend, intentando igualmente:', finalUrl);
  }

  // Abrir navegador
  const openCmd = process.platform === 'win32' ? 'start' : 'xdg-open';
  spawn(openCmd, [finalUrl], { shell: true, stdio: 'ignore' });

  console.log('[dev] Listo. URL:', finalUrl, '| API: http://localhost:5656/api');
}

main().catch((e) => {
  console.error('[dev] Error:', e);
  process.exit(1);
});
