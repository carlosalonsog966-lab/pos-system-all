// E2E de salud: verifica módulos clave del backend y resume estado
const http = require('http');
const https = require('https');
const fs = require('fs');
const { spawnSync } = require('child_process');
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
  console.log(`[health-e2e] Iniciando verificación contra ${API_BASE}`);
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
    { name: 'health/metrics', url: `${API_BASE}/health/metrics` },
    { name: 'settings/public', url: `${API_BASE}/settings/public` },
    { name: 'settings/system-info', url: `${API_BASE}/settings/system-info` },
    { name: 'meta/config (fields)', url: `${API_BASE}/meta/config?fields=env,db,cors,uploads,envFlags` },
  ];
  for (const ep of publicEndpoints) {
    const r = await call(ep.url);
    summary.checks.push({ name: ep.name, url: ep.url, ok: r.ok, status: r.status });
  }

  // Regla de salida: si health o meta/config (fields) fallan, marcar error
  const healthCheck = summary.checks.find((c) => c.name === 'health');
  const configFieldsCheck = summary.checks.find((c) => c.name === 'meta/config (fields)');
  const criticalFailed = (healthCheck && !healthCheck.ok) || (configFieldsCheck && !configFieldsCheck.ok);

  // Endpoints protegidos opcionales (solo si hay token)
  const protectedEndpoints = [
    { name: 'sales/health', url: `${API_BASE}/sales/health` },
    { name: 'jobs/health', url: `${API_BASE}/jobs/health` },
  ];
  for (const ep of protectedEndpoints) {
    const r = await call(ep.url, { auth: true });
    summary.checks.push({ name: ep.name, url: ep.url, ok: r.ok, status: r.status });
  }

  // Validación de alineación CORS/URL con EXPECTED_ORIGIN (por defecto http://localhost:5175)
  const EXPECTED_ORIGIN = process.env.EXPECTED_ORIGIN || 'http://localhost:5175';
  const STRICT_CORS_CHECK = process.env.STRICT_CORS_CHECK === '1';
  const corsResp = await call(`${API_BASE}/meta/config?fields=cors`);
  let corsAligned = null;
  let corsAllowed = null;
  let corsDetails = null;
  if (corsResp.ok && corsResp.data && corsResp.data.data && corsResp.data.data.cors) {
    const cors = corsResp.data.data.cors;
    const frontendUrl = String(cors.frontendUrl || '');
    let backendOrigin = '';
    try { backendOrigin = frontendUrl ? new URL(frontendUrl).origin : ''; } catch { backendOrigin = frontendUrl.replace(/\/+$/,''); }
    const computed = Array.isArray(cors.computedOrigins) ? cors.computedOrigins : [];
    corsAligned = Boolean(backendOrigin && EXPECTED_ORIGIN && backendOrigin === EXPECTED_ORIGIN);
    corsAllowed = Boolean(EXPECTED_ORIGIN && computed.includes(EXPECTED_ORIGIN));
    corsDetails = { expectedOrigin: EXPECTED_ORIGIN, backendFrontendUrl: frontendUrl, backendOrigin, computedOriginsCount: computed.length };
  } else {
    corsDetails = { error: 'No se pudo obtener /meta/config?fields=cors', status: corsResp.status };
  }
  summary.corsAlignment = { aligned: corsAligned, allowed: corsAllowed, details: corsDetails };

  // Offline status
  const offlineEp = `${USE_HTTPS ? 'https' : 'http'}://localhost:${PORT}/offline/status`;
  const offline = await call(offlineEp);
  summary.checks.push({ name: 'offline/status', url: offlineEp, ok: offline.ok, status: offline.status });

  // Opcional: ejecutar smoke de reembolso si REFUND_SMOKE=1
  let refundSmokeOk = null;
  if (process.env.REFUND_SMOKE === '1') {
    console.log('[health-e2e] Ejecutando smoke de reembolso...');
    const backendDir = path.join(process.cwd(), 'backend');
    const proc = spawnSync(process.execPath, ['scripts/refund-inline.js'], {
      cwd: backendDir,
      env: { ...process.env },
      timeout: 60000,
      stdio: 'pipe'
    });
    refundSmokeOk = proc.status === 0;
    const output = (proc.stdout || Buffer.from('')).toString('utf8');
    const errorOut = (proc.stderr || Buffer.from('')).toString('utf8');
    summary.checks.push({ name: 'refund-smoke', ok: refundSmokeOk, status: refundSmokeOk ? 200 : 500 });
    // Guardar salida para diagnóstico
    const smokeFile = path.join(CAPTURE_DIR, `refund-smoke-${new Date().toISOString().replace(/[:]/g, '-')}.log`);
    try { fs.writeFileSync(smokeFile, `STDOUT:\n${output}\n\nSTDERR:\n${errorOut}`, 'utf8'); } catch (_) {}
  }

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
  if (criticalFailed) {
    console.error('[health-e2e] Checks críticos FALLIDOS (/health o /meta/config). Ver detalles en captura:', path.basename(file));
    process.exit(1);
    return;
  }
  if (STRICT_CORS_CHECK && summary.corsAlignment && summary.corsAlignment.aligned === false) {
    console.error('[health-e2e] CORS/URL MISALIGNED. EXPECTED_ORIGIN:', EXPECTED_ORIGIN, 'Detalles en captura:', path.basename(file));
    process.exit(1);
    return;
  }
  if (refundSmokeOk === false) {
    console.error('[health-e2e] Refund smoke FAILED. Ver detalles en captura:', path.basename(file));
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
