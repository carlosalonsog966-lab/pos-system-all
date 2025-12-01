// Alertas periódicas de verificación de integridad de archivos (batch)
// - Ejecuta verify-files-batch.ps1 para generar CSV y summary.json
// - Registra resumen en logs/verification-final.txt
// - Si hay discrepancias, guarda un archivo de alerta en exports/

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const https = require('https');
const PDFDocument = require('pdfkit');
// Cargar variables de entorno desde .env (si existe)
try { require('dotenv').config(); } catch (_) {}

const rootDir = path.resolve(__dirname, '..');
const scriptsDir = path.join(rootDir, 'scripts');
const exportsDir = path.join(rootDir, 'exports');
const logsDir = path.join(rootDir, 'logs');
const logFile = path.join(logsDir, 'verification-final.txt');
const lockFile = path.join(logsDir, 'verify-alerts.lock');

const VERIFY_INTERVAL_MS = process.env.VERIFY_INTERVAL_MS ? Number(process.env.VERIFY_INTERVAL_MS) : 15 * 60 * 1000;
const VERIFY_MAX_COUNT = process.env.VERIFY_MAX_COUNT ? Number(process.env.VERIFY_MAX_COUNT) : 0;
const ONLY_MISMATCHES = (() => {
  const v = (process.env.VERIFY_ONLY_MISMATCHES || '0').toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(v);
})();
const APPEND = (() => {
  const v = (process.env.VERIFY_APPEND || '0').toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(v);
})();
const OUTPUT_CSV_PATH = process.env.VERIFY_OUTPUT_CSV_PATH || path.join(exportsDir, 'verification-report.csv');
const SLACK_WEBHOOK_URL = process.env.VERIFY_SLACK_WEBHOOK_URL || '';
const POS_BASE_URL = process.env.POS_BASE_URL || 'http://localhost:5656';
const HEALTHCHECK_URL = process.env.VERIFY_HEALTHCHECK_URL || `${POS_BASE_URL}/api/health`;
const ENV_LABEL = process.env.VERIFY_ENV_LABEL || '';
const RETENTION_DAYS = process.env.VERIFY_RETENTION_DAYS ? Number(process.env.VERIFY_RETENTION_DAYS) : 30;

function ensureDirs() {
  for (const dir of [exportsDir, logsDir]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function stamp() {
  return new Date().toISOString();
}

function appendLog(line) {
  try {
    fs.appendFileSync(logFile, String(line) + '\n');
  } catch (_) {}
}

function stampSafe() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function acquireLock() {
  try {
    if (fs.existsSync(lockFile)) {
      const st = fs.statSync(lockFile);
      // Si el lock es reciente, evitar solapado
      const age = Date.now() - st.mtimeMs;
      if (age < VERIFY_INTERVAL_MS) {
        return false;
      }
      // Lock viejo: eliminar y continuar
      try { fs.unlinkSync(lockFile); } catch (_) {}
    }
    fs.writeFileSync(lockFile, JSON.stringify({ pid: process.pid, at: Date.now() }));
    return true;
  } catch (_) {
    return true; // En caso de error al crear lock, continuar para no bloquear ejecución
  }
}

function releaseLock() {
  try { if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile); } catch (_) {}
}

function httpGet(url, timeoutMs = 4000) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request({ hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname + (u.search || ''), method: 'GET', timeout: timeoutMs }, (res) => {
        // Consideramos saludable si 2xx
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode });
      });
      req.on('error', () => resolve({ ok: false, status: 0 }));
      req.on('timeout', () => { try { req.destroy(); } catch (_) {}; resolve({ ok: false, status: -1 }); });
      req.end();
    } catch (_) {
      resolve({ ok: false, status: 0 });
    }
  });
}

async function backendHealthy() {
  const res = await httpGet(HEALTHCHECK_URL, 4000);
  return !!res.ok;
}

function stampSafe() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function appendLog(line) {
  try {
    fs.appendFileSync(logFile, line + '\n');
  } catch (e) {
    console.log('[LOG WRITE ERROR]', e.message);
  }
}

async function postSlack(message) {
  if (!SLACK_WEBHOOK_URL) return { ok: false, reason: 'disabled' };
  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
    return { ok: res.ok };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

function cleanupOldAlerts(days = RETENTION_DAYS) {
  if (!days || days <= 0) return;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  // Limpiar sólo artefactos con timestamp generados por el verificador.
  // No elimina archivos agregados/estables como verification-report.csv o mismatches agregados.
  const patterns = [
    /^verification-summary-.*\.json$/i,
    /^verification-alert-.*\.json$/i,
    /^verification-report-.*\.pdf$/i,
    /^files_integrity_.*\.(csv|pdf)$/i,
  ];
  try {
    const entries = fs.readdirSync(exportsDir);
    for (const f of entries) {
      if (!patterns.some((re) => re.test(f))) continue;
      const p = path.join(exportsDir, f);
      const st = fs.statSync(p);
      if (st.mtimeMs < cutoff) {
        try { fs.unlinkSync(p); appendLog(`[${stamp()}] CLEANUP removed=${f}`); } catch (_) {}
      }
    }
  } catch (_) {}
}

function runBatchOnce() {
  return new Promise((resolve) => {
    const psScript = path.join(scriptsDir, 'verify-files-batch.ps1');
    const args = ['-ExecutionPolicy', 'Bypass', '-File', psScript];
    if (VERIFY_MAX_COUNT && VERIFY_MAX_COUNT > 0) {
      args.push('-MaxCount', String(VERIFY_MAX_COUNT));
    }
    if (ONLY_MISMATCHES) {
      args.push('-OnlyMismatches');
    }
    if (APPEND) {
      args.push('-Append');
    }
    if (OUTPUT_CSV_PATH) {
      args.push('-OutputCsvPath', OUTPUT_CSV_PATH);
    }

    const child = spawn('powershell', args, { stdio: 'inherit' });
    child.on('exit', (code) => resolve(code));
  });
}

function readSummary() {
  const summaryPath = path.join(exportsDir, 'verification-summary.json');
  try {
    let txt = fs.readFileSync(summaryPath, 'utf8');
    // Remover BOM si existe
    if (txt.charCodeAt(0) === 0xFEFF) {
      txt = txt.slice(1);
    }
    const json = JSON.parse(txt);
    return { json, path: summaryPath };
  } catch (e) {
    return null;
  }
}

async function verifyAndAlert() {
  ensureDirs();

  // Health-check: si el backend no responde, saltar para evitar ruido
  const healthy = await backendHealthy();
  if (!healthy) {
    appendLog(`[${stamp()}] VERIFY skip (backend sin salud): ${HEALTHCHECK_URL}`);
    return;
  }

  // Lock para evitar solapado
  if (!acquireLock()) {
    appendLog(`[${stamp()}] VERIFY skip (ejecución ya en curso)`);
    return;
  }

  const start = stamp();
  appendLog(`[${start}] VERIFY batch start`);

  const exitCode = await runBatchOnce();
  const done = stamp();

  const summary = readSummary();
  if (!summary) {
    appendLog(`[${done}] VERIFY batch end (no summary.json encontrado)`);
    return;
  }

  const s = summary.json;
  const counts = s.counts || {};
  const total = counts.total ?? 'n/a';
  const match = counts.match ?? 0;
  const mismatch = counts.mismatch ?? 0;
  const missing = counts.missing ?? 0;
  const error = counts.error ?? 0;
  const duration = s.durationMs ?? 'n/a';
  const csv = s.csvPath ? path.basename(s.csvPath) : path.basename(OUTPUT_CSV_PATH);

  // Generar PDF del resumen de verificación
  try {
    const pdfStamp = stampSafe();
    const pdfName = `verification-report-${pdfStamp}.pdf`;
    const pdfPath = path.join(exportsDir, pdfName);
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);
    // Encabezado
    doc.fontSize(18).text('Reporte de Verificación de Integridad de Archivos', { align: 'center' });
    doc.moveDown(0.5);
    const subtitle = ENV_LABEL ? `Entorno: ${ENV_LABEL}` : 'Entorno: N/A';
    doc.fontSize(11).text(`${subtitle}  |  Base: ${s.baseUrl || POS_BASE_URL}`);
    doc.text(`Generado: ${new Date().toLocaleString()}`);
    doc.moveDown();
    // Resumen
    doc.fontSize(12).text(`Total: ${total}`);
    doc.text(`Match: ${match}`);
    doc.text(`Mismatch: ${mismatch}`);
    doc.text(`Missing: ${missing}`);
    doc.text(`Error: ${error}`);
    doc.text(`Duración (ms): ${duration}`);
    doc.text(`CSV: ${csv}`);
    doc.moveDown();
    // Detalles adicionales
    doc.fontSize(11).text('Config:');
    doc.text(`MaxCount: ${VERIFY_MAX_COUNT}`);
    doc.text(`OnlyMismatches: ${ONLY_MISMATCHES}`);
    doc.text(`Append: ${APPEND}`);
    doc.moveDown();
    // Footer
    doc.fontSize(9).fillColor('#666').text(`Resumen JSON: ${summary.path}`, { link: summary.path, underline: false });
    doc.fillColor('#000');
    doc.end();
    await new Promise((resolve) => stream.on('finish', resolve));
    appendLog(`[${stamp()}] VERIFY PDF generado: ${pdfName}`);
    // Anotar referencia en summary json
    try {
      const enriched = { ...s, pdfPath: pdfPath };
      fs.writeFileSync(summary.path, JSON.stringify(enriched, null, 2));
    } catch (_) {}
  } catch (e) {
    appendLog(`[${stamp()}] VERIFY PDF error: ${e && e.message ? e.message : String(e)}`);
  }

  const problems = (mismatch || 0) + (missing || 0) + (error || 0);
  if (problems > 0) {
    const alertName = `verification-alert-${stampSafe()}.json`;
    const alertPath = path.join(exportsDir, alertName);
    try {
      fs.writeFileSync(alertPath, JSON.stringify(s, null, 2));
    } catch (_) {}
    const line = `[${done}] VERIFY ALERT total=${total} match=${match} mismatch=${mismatch} missing=${missing} error=${error} durationMs=${duration} csv=${csv} file=${alertName}`;
    appendLog(line);
    console.log('⚠️  Verificación: discrepancias detectadas. Ver exports/', alertName);
    const prefix = ENV_LABEL ? `[${ENV_LABEL}] ` : '';
    const slackMsg = `${prefix}⚠️ Verificación ALERTA\nbase=${s.baseUrl} total=${total} match=${match} mismatch=${mismatch} missing=${missing} error=${error}\ncsv=${csv}\narchivo=${alertName}`;
    const slack = await postSlack(slackMsg);
    if (slack.ok) {
      appendLog(`[${stamp()}] VERIFY notify=slack ok`);
    } else {
      appendLog(`[${stamp()}] VERIFY notify=slack ${slack.reason || 'fail'}`);
    }
  } else {
    appendLog(`[${done}] VERIFY OK total=${total} match=${match} durationMs=${duration} csv=${csv}`);
    console.log('✅ Verificación OK. total=', total, 'match=', match, 'csv=', csv);
  }

  // Liberar lock
  releaseLock();
}

async function main() {
  const once = process.argv.includes('--once');
  console.log(`🔎 Verificación programada iniciada. interval=${VERIFY_INTERVAL_MS}ms maxCount=${VERIFY_MAX_COUNT} onlyMismatches=${ONLY_MISMATCHES} append=${APPEND}`);
  await verifyAndAlert();
  cleanupOldAlerts(RETENTION_DAYS);
  if (once) return;
  setInterval(() => {
    verifyAndAlert().catch((err) => console.error('Scheduled verify error:', err));
    cleanupOldAlerts(RETENTION_DAYS);
  }, VERIFY_INTERVAL_MS);
}

main().catch((err) => {
  console.error('Fatal verify alerts error:', err);
  process.exit(1);
});
