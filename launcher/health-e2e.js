// E2E de salud: verifica módulos clave del backend y resume estado
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.BACKEND_PORT ? Number(process.env.BACKEND_PORT) : 5656;
const USE_HTTPS = process.env.BACKEND_HTTPS === '1';
const API_BASE = `${USE_HTTPS ? 'https' : 'http'}://localhost:${PORT}/api`;
const AUTH_TOKEN = process.env.AUTH_TOKEN || process.env.BEARER_TOKEN || '';
const CAPTURE_DIR = path.join(process.cwd(), 'captures');
try { if (!fs.existsSync(CAPTURE_DIR)) fs.mkdirSync(CAPTURE_DIR, { recursive: true }); } catch (_) {}

function get(url, timeoutMs = 5000, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request({
      method: 'GET',
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + (u.search || ''),
      headers,
    }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode || 0, body, headers: res.headers || {} });
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

async function call(ep, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.auth && AUTH_TOKEN) headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  try {
    const res = await get(ep, opts.timeoutMs || 8000, headers);
    let data = null;
    try { data = JSON.parse(res.body); } catch (_) {}
    return { ok: res.status >= 200 && res.status < 300, status: res.status, data, raw: res.body };
  } catch (err) {
    return { ok: false, status: 0, error: err.message || String(err) };
  }
}

async function checkBackendStatus() {
  // ok | no_health | down (alineado con frontend/src/lib/api.ts)
  const r1 = await call(`${API_BASE}/health`);
  if (r1.ok && ((r1.data && (r1.data.success ?? true)) || !r1.data)) return 'ok';
  const r2 = await call(`${API_BASE}/test-health`);
  if (r2.ok) return 'ok';
  const r3 = await call(`${API_BASE}/settings/system-info`);
  if (r3.ok || r3.status === 429) return 'no_health';
  const r4 = await call(`${API_BASE}/settings/public`);
  if (r4.ok || r4.status === 429) return 'no_health';
  return 'down';
}

async function main() {
  console.log(`[health-e2e] Iniciando verificación contra ${API_BASE}…`);
  const startedAt = new Date().toISOString();

  const summary = { startedAt, base: API_BASE, port: PORT, https: USE_HTTPS, authProvided: Boolean(AUTH_TOKEN), checks: [] };

  // Baseline status
  const baseline = await checkBackendStatus();
  summary.baseline = baseline;
  summary.checks.push({ name: 'baseline', statusText: baseline });

  // Endpoints públicos
  const publicEndpoints = [
    { name: 'test-health', url: `${API_BASE}/test-health` },
    { name: 'health', url: `${API_BASE}/health` },
    { name: 'settings/public', url: `${API_BASE}/settings/public` },
    { name: 'settings/system-info', url: `${API_BASE}/settings/system-info` },
  ];
  for (const ep of publicEndpoints) {
    const r = await call(ep.url);
    summary.checks.push({ name: ep.name, url: ep.url, ok: r.ok, status: r.status });
  }

  // Endpoints protegidos opcionales (solo si hay token)
  const protectedEndpoints = [
    { name: 'sales/health', url: `${API_BASE}/sales/health` },
    { name: 'jobs/health', url: `${API_BASE}/jobs/health` },
  ];
  for (const ep of protectedEndpoints) {
    const r = await call(ep.url, { auth: true });
    summary.checks.push({ name: ep.name, url: ep.url, ok: r.ok, status: r.status });
  }

  // Offline status
  const offlineEp = `${USE_HTTPS ? 'https' : 'http'}://localhost:${PORT}/offline/status`;
  const offline = await call(offlineEp);
  summary.checks.push({ name: 'offline/status', url: offlineEp, ok: offline.ok, status: offline.status });

  const finishedAt = new Date().toISOString();
  summary.finishedAt = finishedAt;

  // Archivo
  const file = path.join(CAPTURE_DIR, `health-e2e-${finishedAt.replace(/[:]/g, '-')}.json`);
  try { fs.writeFileSync(file, JSON.stringify(summary, null, 2), 'utf8'); } catch (_) {}

  // Criterios de salida: si baseline es down -> error
  if (baseline === 'down') {
    console.error('[health-e2e] Backend DOWN. Ver detalles en captura:', path.basename(file));
    process.exit(1);
    return;
  }
  console.log('[health-e2e] OK. Baseline:', baseline.toUpperCase(), '->', path.basename(file));
  process.exit(0);
}

main().catch((err) => {
  console.error('[health-e2e] Fallo inesperado:', err);
  process.exit(1);
});

