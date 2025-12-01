// Métricas automáticas cada 15 minutos: ventas, productos, clientes, ingresos
// - Obtiene token JWT (admin/admin123 por defecto) y consulta endpoints de reportes
// - Guarda metrics-YYYY.json en captures/ y registra resumen en logs/verification-final.txt

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BACKEND_BASE = process.env.BACKEND_URL || 'http://localhost:5656/api';
const USERNAME = process.env.BACKEND_USER || 'admin';
const PASSWORD = process.env.BACKEND_PASS || 'admin123';
const INTERVAL_MS = process.env.METRICS_INTERVAL_MS ? Number(process.env.METRICS_INTERVAL_MS) : 15 * 60 * 1000;
const OBS_ENABLED = (() => {
  const v = (process.env.METRICS_OBSERVABILITY || '1').toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(v);
})();
const RETENTION_DAYS = process.env.METRICS_RETENTION_DAYS ? Number(process.env.METRICS_RETENTION_DAYS) : 90;

const rootDir = path.resolve(__dirname, '..');
const capturesDir = path.join(rootDir, 'captures');
const logsDir = path.join(rootDir, 'logs');
const logFile = path.join(logsDir, 'verification-final.txt');

function ensureDirs() {
  for (const dir of [capturesDir, logsDir]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function nowIsoSafe() {
  return new Date().toISOString().replace(/[:]/g, '-');
}

function sha256Of(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function fetchWithRetry(url, options = {}, attempts = 3) {
  let tryNo = 0;
  let lastErr;
  const baseDelay = 500; // ms
  while (tryNo < attempts) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      lastErr = err;
      const wait = baseDelay * Math.pow(2, tryNo);
      await new Promise(r => setTimeout(r, wait));
      tryNo++;
    }
  }
  throw lastErr || new Error('fetchWithRetry: unknown error');
}

async function getToken() {
  try {
    const res = await fetchWithRetry(`${BACKEND_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    }, 4);
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Login failed: ${res.status} ${res.statusText} ${t}`);
    }
    const data = await res.json();
    const token = data.token || data.accessToken || data.access_token || data.data?.token;
    if (!token) throw new Error('No token in login response');
    return token;
  } catch (err) {
    throw new Error(`Auth error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function getJson(pathname, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetchWithRetry(`${BACKEND_BASE}${pathname}`, { headers }, 3);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function cleanOldCaptures(days) {
  if (!Number.isFinite(days) || days <= 0) return;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  try {
    const files = fs.readdirSync(capturesDir);
    for (const f of files) {
      const full = path.join(capturesDir, f);
      const stat = fs.statSync(full);
      if (stat.isFile() && stat.mtimeMs < cutoff) {
        try {
          fs.unlinkSync(full);
        } catch {}
      }
    }
  } catch {}
}

async function collectMetrics() {
  ensureDirs();
  const ts = nowIsoSafe();
  const stamp = new Date().toISOString();

  let summaryLine = `[${stamp}] METRICS `;
  let metrics = {
    timestamp: stamp,
    source: BACKEND_BASE,
    ok: false,
    dashboard: null,
    inventory: null,
    counts: {
      products: null,
      sales: null,
      clients: null,
    },
    error: null,
  };

  try {
    const token = await getToken();
    const dash = await getJson('/reports/dashboard', token);
    const inv = await getJson('/inventory/stats', token);
    // Optional list endpoints for counts if dashboard doesn't include them
    let productsCount = null;
    let salesCount = null;
    let clientsCount = null;
    try {
      const products = await getJson('/products', token);
      productsCount = Array.isArray(products?.data) ? products.data.length : (Array.isArray(products) ? products.length : null);
    } catch {}
    try {
      const sales = await getJson('/sales', token);
      salesCount = Array.isArray(sales?.data) ? sales.data.length : (Array.isArray(sales) ? sales.length : null);
    } catch {}
    try {
      const clients = await getJson('/clients', token);
      clientsCount = Array.isArray(clients?.data) ? clients.data.length : (Array.isArray(clients) ? clients.length : null);
    } catch {}

    metrics.ok = true;
    metrics.dashboard = dash?.data || dash;
    metrics.inventory = inv?.data || inv;
    metrics.counts = {
      products: productsCount,
      sales: salesCount,
      clients: clientsCount,
    };

    const totalSales = metrics.dashboard?.totalSales ?? metrics.dashboard?.sales?.total ?? null;
    const totalProducts = metrics.dashboard?.totalProducts ?? metrics.inventory?.totalProducts ?? productsCount;
    const totalCustomers = metrics.dashboard?.totalCustomers ?? clientsCount;
    const revenue = metrics.dashboard?.totalRevenue ?? metrics.dashboard?.revenue ?? null;

    summaryLine += `OK sales=${totalSales ?? 'n/a'} products=${totalProducts ?? 'n/a'} clients=${totalCustomers ?? 'n/a'} revenue=${revenue ?? 'n/a'}`;
    // Meta observabilidad (opcional por flag)
    if (OBS_ENABLED) {
      let metaEndpoints = null;
      let metaConfig = null;
      try {
        metaEndpoints = await getJson('/meta/endpoints?scope=public&group=module', undefined);
      } catch (e) {
        metaEndpoints = { error: e instanceof Error ? e.message : String(e) };
      }
      try {
        metaConfig = await getJson('/meta/config?verbose=1', undefined);
      } catch (e) {
        metaConfig = { error: e instanceof Error ? e.message : String(e) };
      }

      // Guardar snapshots de meta endpoints y config
      try {
        const epPath = path.join(capturesDir, `meta-endpoints-${ts}.json`);
        const cfgPath = path.join(capturesDir, `meta-config-${ts}.json`);
        const epPayload = JSON.stringify(metaEndpoints);
        const cfgPayload = JSON.stringify(metaConfig);
        fs.writeFileSync(epPath, epPayload);
        fs.writeFileSync(cfgPath, cfgPayload);
        const epHash = sha256Of(epPayload);
        const cfgHash = sha256Of(cfgPayload);
        summaryLine += ` endpoints=${metaEndpoints?.count ?? (Array.isArray(metaEndpoints?.endpoints) ? metaEndpoints.endpoints.length : 'n/a')}`;
        const v = metaConfig?.data?.validation || metaConfig?.validation;
        if (v) summaryLine += ` configOk=${v.ok ?? 'n/a'} errors=${Array.isArray(v.errors) ? v.errors.length : (v.errors ?? 'n/a')} warnings=${Array.isArray(v.warnings) ? v.warnings.length : (v.warnings ?? 'n/a')}`;
        fs.appendFileSync(logFile, `[${stamp}] META endpoints=${path.basename(epPath)} sha256=${epHash} config=${path.basename(cfgPath)} sha256=${cfgHash}\n`);
      } catch (e) {
        // no interrumpe el ciclo si falla guardar meta
      }
    } else {
      summaryLine += ' meta=disabled';
    }
  } catch (err) {
    metrics.error = err instanceof Error ? err.message : String(err);
    summaryLine += `FAIL error=${metrics.error}`;
  }

  const outPath = path.join(capturesDir, `metrics-${ts}.json`);
  const payload = JSON.stringify(metrics);
  fs.writeFileSync(outPath, payload);
  const hash = sha256Of(payload);

  fs.appendFileSync(logFile, `${summaryLine} file=${path.basename(outPath)} sha256=${hash}\n`);
  console.log(summaryLine);

  // Retención/rotación de capturas
  cleanOldCaptures(RETENTION_DAYS);
}

console.log(`📊 Metrics collector started. Base=${BACKEND_BASE} interval=${INTERVAL_MS}ms observability=${OBS_ENABLED} retentionDays=${RETENTION_DAYS}`);
collectMetrics().catch(err => console.error('Initial metrics error:', err));
setInterval(() => {
  collectMetrics().catch(err => console.error('Scheduled metrics error:', err));
}, INTERVAL_MS);
