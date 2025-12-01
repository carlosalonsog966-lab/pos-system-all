// Watchdog de salud: monitorea el backend y reporta cambios con estados reales
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.BACKEND_PORT ? Number(process.env.BACKEND_PORT) : 5656;
const USE_HTTPS = process.env.BACKEND_HTTPS === '1';
const INTERVAL_MS = process.env.WATCH_INTERVAL_MS ? Number(process.env.WATCH_INTERVAL_MS) : 60000;
const API_BASE = `${USE_HTTPS ? 'https' : 'http'}://localhost:${PORT}/api`;
const CAPTURE_DIR = path.join(process.cwd(), 'captures');
try { if (!fs.existsSync(CAPTURE_DIR)) fs.mkdirSync(CAPTURE_DIR, { recursive: true }); } catch (_) {}

let cleanup;
try { cleanup = require('./cleanup-captures').cleanupCaptures; } catch (_) { cleanup = null; }

function get(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode || 0, body, headers: res.headers || {} });
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
  });
}

async function checkBackendStatus() {
  try {
    const r = await get(`${API_BASE}/health`, 8000);
    if (r.status >= 200 && r.status < 300) {
      try { const data = JSON.parse(r.body); if (data && (data.success ?? true)) return 'ok'; } catch (_) { return 'ok'; }
    }
  } catch (_) {}
  try {
    const r = await get(`${API_BASE}/test-health`, 8000);
    if (r.status >= 200 && r.status < 300) return 'ok';
  } catch (_) {}
  try {
    const r = await get(`${API_BASE}/settings/system-info`, 8000);
    if (r.status === 429) return 'ok';
    if (r.status >= 200 && r.status < 300) return 'no_health';
  } catch (_) {}
  try {
    const r = await get(`${API_BASE}/settings/public`, 8000);
    if (r.status === 429) return 'ok';
    if (r.status >= 200 && r.status < 300) return 'no_health';
  } catch (_) {}
  return 'down';
}

async function notifySlack(text) {
  const webhook = process.env.VERIFY_SLACK_WEBHOOK_URL || process.env.WATCHDOG_SLACK_WEBHOOK_URL || '';
  if (!webhook) return;
  try {
    const u = new URL(webhook);
    const lib = u.protocol === 'https:' ? https : http;
    await new Promise((resolve, reject) => {
      const req = lib.request({ method: 'POST', hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname + (u.search || ''), headers: { 'Content-Type': 'application/json' } }, (res) => { res.on('data', () => {}); res.on('end', resolve); });
      req.on('error', reject);
      req.write(JSON.stringify({ text }));
      req.end();
    });
  } catch (_) {}
}

let lastStatus = 'unknown';

async function checkOnce() {
  try {
    const current = await checkBackendStatus();
    const ts = new Date().toISOString();
    if (current !== lastStatus) {
      const msg = `[watchdog ${ts}] Estado cambió: ${String(lastStatus).toUpperCase()} -> ${current.toUpperCase()}`;
      console.log(msg);
      lastStatus = current;
      notifySlack(msg).catch(() => {});
    } else {
      console.log(`[watchdog ${ts}] Estado actual: ${current.toUpperCase()}`);
    }
    try {
      const safeTs = ts.replace(/[:]/g, '-');
      const captureFile = path.join(CAPTURE_DIR, `health-${safeTs}.json`);
      const capture = { url: `${API_BASE}`, statusText: current.toUpperCase(), capturedAt: ts };
      fs.writeFile(captureFile, JSON.stringify(capture, null, 2), { flag: 'w' }, () => {});
      if (cleanup) try { cleanup(); } catch (_) {}
    } catch (_) {}
  } catch (err) {
    const ts = new Date().toISOString();
    if (lastStatus !== 'down') {
      console.log(`[watchdog ${ts}] Error de salud, marcando como DOWN: ${err.message || err}`);
      lastStatus = 'down';
    }
    try {
      const safeTs = ts.replace(/[:]/g, '-');
      const captureFile = path.join(CAPTURE_DIR, `health-error-${safeTs}.json`);
      const capture = { url: `${API_BASE}`, status: 0, capturedAt: ts, error: String(err && err.message ? err.message : err) };
      fs.writeFile(captureFile, JSON.stringify(capture, null, 2), { flag: 'w' }, () => {});
      if (cleanup) try { cleanup(); } catch (_) {}
    } catch (_) {}
  }
}

console.log(`[watchdog] Monitoreando ${API_BASE} cada ${INTERVAL_MS}ms`);
checkOnce();
setInterval(checkOnce, INTERVAL_MS);

if (cleanup) {
  const CLEAN_INTERVAL_MS = 10 * 60 * 1000;
  setInterval(() => { try { cleanup(); } catch (_) {} }, CLEAN_INTERVAL_MS);
}
