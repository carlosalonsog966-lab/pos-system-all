// Heartbeat de verificación cada 5 minutos
// - Pings a backend y frontends
// - Lista artefactos en exports
// - Escribe bitácora en logs/verification-final.txt

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const LOG_DIR = path.resolve(__dirname, '..', 'logs');
const LOG_PATH = path.resolve(LOG_DIR, 'verification-final.txt');
const EXPORTS_ROOT = path.resolve(__dirname, '..', '..', 'exports');
const POS_EXPORTS = path.resolve(__dirname, '..', 'exports');
const CAPTURES_DIR = path.resolve(__dirname, '..', 'captures');

function ensureLogDir() {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    if (!fs.existsSync(CAPTURES_DIR)) fs.mkdirSync(CAPTURES_DIR, { recursive: true });
  } catch (e) {
    // noop
  }
}

function timestamp() {
  return new Date().toISOString();
}

function appendLog(line) {
  try {
    fs.appendFileSync(LOG_PATH, line + '\n');
  } catch (e) {
    // fallback to console
    console.log('[LOG WRITE ERROR]', e.message);
  }
}

function ping(url) {
  return new Promise((resolve) => {
    try {
      const req = http.get(url, (res) => {
        let size = 0;
        const chunks = [];
        res.on('data', (chunk) => { size += Buffer.byteLength(chunk); chunks.push(chunk); });
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          resolve({ url, ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode, length: size, body: body.toString('utf8') });
        });
      });
      req.on('error', (err) => resolve({ url, ok: false, error: err.message }));
      req.setTimeout(3000, () => {
        req.abort();
        resolve({ url, ok: false, error: 'timeout' });
      });
    } catch (e) {
      resolve({ url, ok: false, error: e.message });
    }
  });
}

function listArtifacts(dir) {
  try {
    const files = fs.readdirSync(dir).filter((f) => /\.(pdf|csv)$/i.test(f));
    return files.map((f) => {
      const p = path.join(dir, f);
      const stat = fs.statSync(p);
      return { file: p, size: stat.size, sha256: sha256File(p) };
    });
  } catch (e) {
    return [];
  }
}

function sha256File(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch (e) {
    return 'N/A';
  }
}

async function runOnce() {
  ensureLogDir();
  const start = timestamp();
  appendLog(`[${start}] Heartbeat start`);

  // URLs a verificar (backend y dos frontends)
  const urls = [
    'http://localhost:5656/api/health',
    'http://localhost:5174/#/dashboard?testMode=1',
    'http://localhost:5175/'
  ];

  const results = [];
  for (const url of urls) {
    results.push(await ping(url));
  }

  const artifacts = [...listArtifacts(EXPORTS_ROOT), ...listArtifacts(POS_EXPORTS)].slice(0, 10);

  appendLog(
    'Status: ' +
      results
        .map((r) => `${r.url} => ${r.status || 'ERR'} (${r.ok ? 'OK' : 'FAIL'})${r.length ? ` len=${r.length}` : r.error ? ` err=${r.error}` : ''}`)
        .join(' | ')
  );

  if (artifacts.length) {
    appendLog('Artifacts: ' + artifacts.map((a) => `${a.file} (${a.size} bytes) sha256=${a.sha256}`).join(' | '));
  } else {
    appendLog('Artifacts: none');
  }

  // Guardar snapshots ligeros en captures
  const tsSafe = start.replace(/[:.]/g, '-');
  try {
    const health = results.find((r) => r.url.includes('/api/health'));
    if (health && (health.body || health.status)) {
      const content = health.body || JSON.stringify({ status: health.status }, null, 2);
      fs.writeFileSync(path.join(CAPTURES_DIR, `health-${tsSafe}.json`), content);
    }
  } catch (_) {}

  try {
    const dash = results.find((r) => r.url.includes('#/dashboard'));
    if (dash && dash.body) fs.writeFileSync(path.join(CAPTURES_DIR, `dashboard-${tsSafe}.html`), dash.body);
  } catch (_) {}

  try {
    const home5175 = results.find((r) => r.url.endsWith('5175/'));
    if (home5175 && home5175.body) fs.writeFileSync(path.join(CAPTURES_DIR, `frontend5175-${tsSafe}.html`), home5175.body);
  } catch (_) {}

  // Escribir resumen de verificación con timestamp en exports
  try {
    const okCount = results.filter((r) => r.ok).length;
    const failCount = results.length - okCount;
    const summary = {
      timestamp: start,
      counts: { ok: okCount, fail: failCount },
      urls: results.map((r) => ({ url: r.url, status: r.status || 'ERR', ok: !!r.ok, length: r.length || 0, error: r.error || '' })),
      artifacts: artifacts.map((a) => ({ file: a.file, size: a.size, sha256: a.sha256 })),
      durationMs: (() => { try { return Date.now() - new Date(start).getTime(); } catch (_) { return null } })()
    };
    const outPath = path.join(POS_EXPORTS, `verification-summary-${tsSafe}.json`);
    try { fs.mkdirSync(POS_EXPORTS, { recursive: true }); } catch (_) {}
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8');
    appendLog(`Summary written: ${outPath}`);
  } catch (e) {
    appendLog(`[SUMMARY ERROR] ${e && e.message ? e.message : String(e)}`);
  }

  appendLog(`[${timestamp()}] Heartbeat end\n`);
}

// Ejecutar de inmediato y luego cada 5 minutos
runOnce();
setInterval(runOnce, 5 * 60 * 1000);
