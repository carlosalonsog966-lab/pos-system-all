// Simple smoke test: checks backend health and builds frontend
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT, 'frontend');
const FRONTEND_DIST = path.join(FRONTEND_DIR, 'dist');
// No usar PORT global (puede venir de Vite). Permitir BACKEND_PORT específico.
const BACKEND_PORT = process.env.BACKEND_PORT ? Number(process.env.BACKEND_PORT) : 5656;
const USE_HTTPS = process.env.BACKEND_HTTPS === '1';
const HEALTH_URL = `${USE_HTTPS ? 'https' : 'http'}://localhost:${BACKEND_PORT}/api/test-health`;

function get(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode || 0, body });
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('timeout'));
    });
  });
}

async function waitForHealth(maxWaitMs = 12000, intervalMs = 2000) {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    try {
      const res = await get(HEALTH_URL, 4000);
      if (res.status >= 200 && res.status < 300) {
        return true;
      }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

async function main() {
  console.log('[smoke] Iniciando smoke test…');

  // 1) Verificar salud del backend (sin arrancarlo para evitar conflictos en dev)
  const healthy = await waitForHealth();
  if (!healthy) {
    console.error(`[smoke] Backend no responde en ${HEALTH_URL}.`);
    process.exit(1);
    return;
  }
  console.log('[smoke] Backend saludable.');

  // 2) Consultas básicas
  const sampleEndpoints = [
    `${USE_HTTPS ? 'https' : 'http'}://localhost:${BACKEND_PORT}/api/test-health`,
    `${USE_HTTPS ? 'https' : 'http'}://localhost:${BACKEND_PORT}/api/health`,
  ];
  for (const ep of sampleEndpoints) {
    try {
      const res = await get(ep, 5000);
      if (res.status < 200 || res.status >= 300) {
        console.error(`[smoke] Endpoint falló ${ep} -> status ${res.status}`);
        process.exit(1);
        return;
      }
      console.log(`[smoke] OK ${ep}`);
    } catch (err) {
      console.error(`[smoke] Error llamando ${ep}:`, err.message || err);
      process.exit(1);
      return;
    }
  }

  // 3) Construir frontend
  console.log('[smoke] Construyendo frontend (rápido)…');
  await new Promise((resolve, reject) => {
    const cmd = process.platform === 'win32' ? 'npm.cmd --prefix ./frontend run build:fast' : 'npm --prefix ./frontend run build:fast';
    exec(cmd, { cwd: ROOT }, (error, stdout, stderr) => {
      process.stdout.write(stdout || '');
      process.stderr.write(stderr || '');
      if (error) return reject(error);
      resolve();
    });
  });

  if (!fs.existsSync(FRONTEND_DIST) || !fs.existsSync(path.join(FRONTEND_DIST, 'index.html'))) {
    console.error('[smoke] No se generó dist/index.html en frontend.');
    process.exit(1);
    return;
  }
  console.log('[smoke] Frontend construido correctamente.');

  console.log('[smoke] Smoke test finalizado ok.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[smoke] Fallo inesperado:', err);
  process.exit(1);
});
