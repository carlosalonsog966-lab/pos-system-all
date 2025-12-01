/**
 * Registro de tendencia del progreso
 * - Lee `exports/status/progreso.json` (generado por progreso.js)
 * - Anexa una fila a `exports/status/trend.csv`
 * - Genera `exports/status/trend.html` con tabla y gráfico simple
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const statusDir = path.join(repoRoot, 'exports', 'status');
const progresoJsonPath = path.join(statusDir, 'progreso.json');
const trendCsvPath = path.join(statusDir, 'trend.csv');
const trendHtmlPath = path.join(statusDir, 'trend.html');
const READINESS_MIN_SCORE = process.env.READINESS_MIN_SCORE ? Number(process.env.READINESS_MIN_SCORE) : 70;
const READINESS_MAX_DROP = process.env.READINESS_MAX_DROP ? Number(process.env.READINESS_MAX_DROP) : 5; // caída máxima permitida entre mediciones consecutivas
const READINESS_STRICT = (process.env.READINESS_STRICT || '0') === '1';

function exists(p) {
  try { fs.accessSync(p, fs.constants.F_OK); return true; } catch { return false; }
}

function safeReadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

// Asegurar estado actual: si no existe progreso.json, intentar calcular señales básicas
let progreso = safeReadJson(progresoJsonPath);
if (!progreso) {
  // Señales mínimas (fallback)
  function file(p) { return exists(path.join(repoRoot, p)); }
  const payload = {
    generatedAt: new Date().toISOString(),
    readinessScore: 0,
    signals: {
      ciReady: exists(path.join(repoRoot, '.github', 'workflows')),
      ciWorkflowsCount: exists(path.join(repoRoot, '.github', 'workflows')) ? fs.readdirSync(path.join(repoRoot, '.github', 'workflows')).length : 0,
      qaReady: file('playwright-report/index.html') || file('test-results/.last-run.json'),
      e2eReportExists: file('playwright-report/index.html'),
      testsLastRunPathExists: file('test-results/.last-run.json'),
      endpointsReady: file('exports/endpoints.yaml') || file('exports/endpoints.jsonl') || file('exports/endpoints.csv'),
      dockerReady: file('Dockerfile.backend') && file('Dockerfile.frontend') && file('docker-compose.yml'),
      tauriReady: file('src-tauri/tauri.conf.json'),
      observabilidadReady: file('observability/prometheus.yml') || (file('launcher/heartbeat.js') && file('launcher/watchdog.js')),
      docsReady: file('README.md') && file('TECHNICAL_DOCUMENTATION.md') && file('USER_GUIDE.md'),
    },
  };
  // Ponderación igual a progreso.js
  const s = payload.signals;
  let score = 0;
  score += s.ciReady ? 20 : 0;
  score += s.qaReady ? 20 : 0;
  score += s.endpointsReady ? 15 : 0;
  score += s.dockerReady ? 15 : 0;
  score += s.tauriReady ? 10 : 0;
  score += s.observabilidadReady ? 10 : 0;
  score += s.docsReady ? 10 : 0;
  payload.readinessScore = score;
  progreso = payload;
}

// Asegurar directorio
fs.mkdirSync(statusDir, { recursive: true });

// Preparar CSV
const headers = ['timestamp','score','ciWorkflowsCount','qaReady','endpointsReady','dockerReady','tauriReady','observabilidadReady','docsReady'];
if (!exists(trendCsvPath)) {
  fs.writeFileSync(trendCsvPath, headers.join(',') + '\n', 'utf-8');
}

// Leer último score antes de agregar nueva fila para calcular delta
let previousScore = null;
try {
  if (exists(trendCsvPath)) {
    const csv = fs.readFileSync(trendCsvPath, 'utf-8').trim();
    const lines = csv.split(/\r?\n/);
    if (lines.length > 1) {
      const lastLine = lines[lines.length - 1];
      const cols = lastLine.split(',');
      const s = Number(cols[1]);
      if (!isNaN(s)) previousScore = s;
    }
  }
} catch {}

const row = [
  progreso.generatedAt,
  progreso.readinessScore,
  progreso.signals.ciWorkflowsCount || 0,
  progreso.signals.qaReady ? 1 : 0,
  progreso.signals.endpointsReady ? 1 : 0,
  progreso.signals.dockerReady ? 1 : 0,
  progreso.signals.tauriReady ? 1 : 0,
  progreso.signals.observabilidadReady ? 1 : 0,
  progreso.signals.docsReady ? 1 : 0,
].join(',');

fs.appendFileSync(trendCsvPath, row + '\n', 'utf-8');

// Evaluación de alertas
let alertReason = '';
const currentScore = progreso.readinessScore;
if (currentScore < READINESS_MIN_SCORE) {
  alertReason = `Score actual ${currentScore} < umbral mínimo ${READINESS_MIN_SCORE}`;
} else if (previousScore !== null) {
  const delta = currentScore - previousScore;
  if (delta < 0 && Math.abs(delta) > READINESS_MAX_DROP) {
    alertReason = `Caída de score ${Math.abs(delta)} > máximo permitido ${READINESS_MAX_DROP}`;
  }
}

// Generar HTML (embebiendo el CSV para portabilidad)
const csvContent = fs.readFileSync(trendCsvPath, 'utf-8');
const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tendencia de Progreso</title>
  <style>
    :root {
      --bg: #0f172a; /* slate-900 */
      --card: #111827; /* gray-900 */
      --text: #e5e7eb; /* gray-200 */
      --muted: #94a3b8; /* slate-400 */
      --primary: #60a5fa; /* blue-400 */
      --accent: #a78bfa; /* violet-400 */
      --good: #34d399; /* emerald-400 */
      --warn: #fbbf24; /* amber-400 */
      --bad: #f87171; /* red-400 */
      --grid: #1f2937; /* gray-800 */
      --border: #1f2937;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 24px; background: linear-gradient(180deg, #0b1220 0%, #0f172a 100%);
      color: var(--text); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial;
    }
    .wrap { max-width: 1060px; margin: 0 auto; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 10px 20px rgba(0,0,0,.25); padding: 18px; }
    .header { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    h1 { font-size: 1.25rem; margin: 0; letter-spacing: .3px; }
    .sub { color: var(--muted); font-size: .92rem; }
    .chips { display:flex; gap:8px; flex-wrap:wrap; }
    .chip { padding: 6px 10px; border-radius: 999px; font-size: .86rem; border: 1px solid var(--border); background: #0b1322; }
    .chip.good { color: var(--good); border-color: rgba(52,211,153,.4); background: rgba(52,211,153,.08); }
    .chip.warn { color: var(--warn); border-color: rgba(251,191,36,.35); background: rgba(251,191,36,.08); }
    .chip.bad  { color: var(--bad);  border-color: rgba(248,113,113,.35); background: rgba(248,113,113,.08); }
    .grid { margin-top: 14px; display: grid; grid-template-columns: 1fr; gap: 14px; }
    .chart { position: relative; }
    canvas { width: 100%; height: 320px; display: block; border-radius: 10px; border: 1px solid var(--border); background: #0b1322; }
    .alert { margin-top: 8px; color: var(--bad); }
    table { border-collapse: collapse; width: 100%; }
    thead th { position: sticky; top: 0; background: #0b1322; }
    th, td { border: 1px solid var(--border); padding: 8px; font-size: 0.93rem; }
    tbody tr:nth-child(odd) { background: rgba(255,255,255,.02); }
    footer { margin-top: 12px; color: var(--muted); font-size: .86rem; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="header">
        <div>
          <h1>Tendencia de Progreso (Release Readiness)</h1>
          <div class="sub">Score histórico y señales del repositorio</div>
        </div>
        <div class="chips">
          <span class="chip" id="chipCount">Mediciones: 0</span>
          <span class="chip" id="chipScore">Último score: —</span>
        </div>
      </div>
      <div class="grid">
        <div class="chart">
          <canvas id="chart"></canvas>
        </div>
        ${alertReason ? `<div class="alert">ALERTA: ${alertReason}</div>` : ''}
        <table id="tbl"><thead></thead><tbody></tbody></table>
        <div id="err" class="alert" style="display:none"></div>
      </div>
      <footer>Umbral mínimo: ${READINESS_MIN_SCORE} | Generado: ${new Date().toLocaleString()}</footer>
    </div>
  </div>
  <script id="csv" type="text/plain">${csvContent.replace(/</g,'&lt;')}</script>
  <script>
    window.addEventListener('DOMContentLoaded', function(){
      try {
        function parseCSV(text){
          const normalized = (typeof text === 'string') ? (text || '').split('\\r').join('') : '';
          const lines = normalized.trim().split('\\n');
          if (!lines.length) return { headers: [], rows: [] };
          const headers = lines[0].split(',');
          const rows = lines.slice(1).filter(Boolean).map(l=>{const cols=l.split(','); const o={}; headers.forEach((h,i)=>o[h]=cols[i]); return o;});
          return { headers, rows };
        }
        const csvEl = document.getElementById('csv');
        const data = parseCSV(csvEl ? csvEl.textContent : '');
        // Tabla
        const thead = document.querySelector('#tbl thead');
        const tbody = document.querySelector('#tbl tbody');
        if (data.headers.length) {
          thead.innerHTML = '<tr>' + data.headers.map(h=>'<th>'+h+'</th>').join('') + '</tr>';
        } else {
          thead.innerHTML = '<tr><th>No hay datos</th></tr>';
        }
        if (data.rows.length) {
          tbody.innerHTML = data.rows.map(r=>'<tr>' + data.headers.map(h=>'<td>'+r[h]+'</td>').join('') + '</tr>').join('');
        } else {
          tbody.innerHTML = '<tr><td>El histórico está vacío. Ejecuta el script de tendencia para registrar mediciones.</td></tr>';
        }
        // Chips
        const scores = data.rows.map(r=>Number(r.score)).filter(n=>!isNaN(n));
        const n = scores.length;
        const last = n>0 ? scores[n-1] : null;
        const minThreshold = ${READINESS_MIN_SCORE};
        const chipCount = document.getElementById('chipCount');
        const chipScore = document.getElementById('chipScore');
        chipCount.textContent = 'Mediciones: ' + n;
        if (last !== null) {
          chipScore.textContent = 'Último score: ' + last;
          chipScore.classList.remove('good','warn','bad');
          if (last >= 85) chipScore.classList.add('good');
          else if (last >= minThreshold) chipScore.classList.add('warn');
          else chipScore.classList.add('bad');
        }
        // Gráfico responsive con umbral
        const c = document.getElementById('chart');
        const ctx = c.getContext('2d');
        function draw(){
          const dpr = window.devicePixelRatio || 1;
          const cssW = c.clientWidth; const cssH = c.clientHeight;
          c.width = Math.floor(cssW * dpr); c.height = Math.floor(cssH * dpr);
          const w = c.width, h = c.height; const pad = Math.floor(28 * dpr); const max = 100;
          ctx.setTransform(1,0,0,1,0,0);
          ctx.fillStyle = '#0b1322'; ctx.fillRect(0,0,w,h);
          // Ejes
          ctx.strokeStyle = '#475569'; ctx.lineWidth = 1*dpr; ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(pad, h-pad); ctx.lineTo(w-pad, h-pad); ctx.stroke();
          // Grid
          ctx.strokeStyle = '#1f2937'; for (let v=20; v<max; v+=20){ const y = h-pad - (v/max)*(h-2*pad); ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w-pad, y); ctx.stroke(); }
          // Umbral
          const yT = h-pad - (minThreshold/max)*(h-2*pad);
          ctx.setLineDash([6*dpr,4*dpr]); ctx.strokeStyle = '#f87171'; ctx.beginPath(); ctx.moveTo(pad, yT); ctx.lineTo(w-pad, yT); ctx.stroke(); ctx.setLineDash([]);
          // Línea principal
          ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2*dpr; ctx.beginPath();
          const dx = n>1 ? (w-2*pad)/(n-1) : (w-2*pad);
          scores.forEach((s,i)=>{ const x = pad + i*dx; const y = h-pad - (s/max)*(h-2*pad); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
          if (n>0) ctx.stroke();
          // Puntos
          ctx.fillStyle = '#93c5fd'; scores.forEach((s,i)=>{ const x = pad + i*dx; const y = h-pad - (s/max)*(h-2*pad); ctx.beginPath(); ctx.arc(x,y,3*dpr,0,Math.PI*2); ctx.fill(); });
        }
        draw();
        window.addEventListener('resize', draw);
      } catch (e) {
        const errEl = document.getElementById('err');
        errEl.style.display = 'block';
        errEl.textContent = 'Error renderizando tablero: ' + e.message;
        console.error(e);
      }
    });
  </script>
</body>
</html>`;

fs.writeFileSync(trendHtmlPath, html, 'utf-8');

console.log('[trend] Fila agregada a trend.csv');
console.log('[trend] Dashboard generado en trend.html');
if (alertReason) {
  console.error('[trend][ALERT]', alertReason);
  if (READINESS_STRICT) {
    console.error('[trend] Modo estricto activo: saliendo con código de error');
    process.exit(2);
  }
}
