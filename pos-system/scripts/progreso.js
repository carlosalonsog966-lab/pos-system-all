/**
 * Script de progreso y readiness
 * - Calcula un Release Readiness Score basado en señales del repo
 * - Genera `pos-system/exports/status/progreso.json` y `progreso.md`
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const statusDir = path.join(repoRoot, 'exports', 'status');

function exists(p) {
  try { fs.accessSync(p, fs.constants.F_OK); return true; } catch { return false; }
}

function existsDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function safeReadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

// Señales principales
const ciWorkflowsDir = path.join(repoRoot, '.github', 'workflows');
const ciWorkflowsCount = existsDir(ciWorkflowsDir) ? fs.readdirSync(ciWorkflowsDir).length : 0;
const ciReady = ciWorkflowsCount > 0;

const testsLastRunPath = path.join(repoRoot, 'test-results', '.last-run.json');
const testsLastRun = safeReadJson(testsLastRunPath);
const e2eReportExists = exists(path.join(repoRoot, 'playwright-report', 'index.html')) ||
                        exists(path.join(repoRoot, 'playwright-report', 'index.html'));
const qaReady = e2eReportExists || !!testsLastRun;

const endpointsReady = [
  path.join(repoRoot, 'exports', 'endpoints.yaml'),
  path.join(repoRoot, 'exports', 'endpoints.jsonl'),
  path.join(repoRoot, 'exports', 'endpoints.csv'),
].some(exists);

const dockerReady = [
  path.join(repoRoot, 'Dockerfile.backend'),
  path.join(repoRoot, 'Dockerfile.frontend'),
  path.join(repoRoot, 'docker-compose.yml'),
].every(exists);

const tauriReady = exists(path.join(repoRoot, 'src-tauri', 'tauri.conf.json'));

const observabilidadReady = [
  path.join(repoRoot, 'observability', 'prometheus.yml'),
  path.join(repoRoot, 'launcher', 'heartbeat.js'),
  path.join(repoRoot, 'launcher', 'watchdog.js'),
].filter(exists).length >= 2; // señales mínimas

const docsReady = [
  path.join(repoRoot, 'README.md'),
  path.join(repoRoot, 'TECHNICAL_DOCUMENTATION.md'),
  path.join(repoRoot, 'USER_GUIDE.md'),
  path.join(repoRoot, 'docs', 'PROGRESO-Y-SEGUIMIENTO.md'),
  path.join(repoRoot, 'docs', 'PLAN-BLOQUES-SINCRONIZADO.md'),
].filter(exists).length >= 4;

// Puntuación
function scoreBool(flag, weight) { return flag ? weight : 0; }
let score = 0;
score += scoreBool(ciReady, 20);
score += scoreBool(qaReady, 20);
score += scoreBool(endpointsReady, 15);
score += scoreBool(dockerReady, 15);
score += scoreBool(tauriReady, 10);
score += scoreBool(observabilidadReady, 10);
score += scoreBool(docsReady, 10);

// Detalles de pruebas
let testsInfo = null;
if (testsLastRun) {
  testsInfo = {
    startedAt: testsLastRun.startedAt || null,
    finishedAt: testsLastRun.finishedAt || null,
    passed: testsLastRun.passed || null,
    failed: testsLastRun.failed || null,
    total: testsLastRun.total || null,
  };
}

// Asegurar directorio de estado
fs.mkdirSync(statusDir, { recursive: true });

const payload = {
  generatedAt: new Date().toISOString(),
  releaseTargets: { RC: '2025-12-01', GA: '2025-12-19T20:00:00' },
  readinessScore: score,
  signals: {
    ciReady,
    ciWorkflowsCount,
    qaReady,
    e2eReportExists,
    testsLastRunPathExists: exists(testsLastRunPath),
    endpointsReady,
    dockerReady,
    tauriReady,
    observabilidadReady,
    docsReady,
  },
  testsInfo,
};

// Escribir JSON
fs.writeFileSync(path.join(statusDir, 'progreso.json'), JSON.stringify(payload, null, 2), 'utf-8');

// Escribir Markdown
const md = `# Progreso y Readiness\n\n` +
  `Fecha: ${payload.generatedAt}\n\n` +
  `## Score\n- Release Readiness Score: ${score}/100\n\n` +
  `## Señales\n` +
  `- CI listo: ${ciReady ? 'sí' : 'no'} (workflows: ${ciWorkflowsCount})\n` +
  `- QA/E2E: ${qaReady ? 'sí' : 'no'} (playwright-report: ${e2eReportExists ? 'sí' : 'no'})\n` +
  `- Contratos API: ${endpointsReady ? 'sí' : 'no'}\n` +
  `- Docker: ${dockerReady ? 'sí' : 'no'}\n` +
  `- Desktop/Tauri: ${tauriReady ? 'sí' : 'no'}\n` +
  `- Observabilidad: ${observabilidadReady ? 'sí' : 'no'}\n` +
  `- Documentación: ${docsReady ? 'sí' : 'no'}\n\n` +
  `## Pruebas\n` +
  (testsInfo ? `- Iniciado: ${testsInfo.startedAt}\n- Finalizado: ${testsInfo.finishedAt}\n- Pasados: ${testsInfo.passed} / Fallados: ${testsInfo.failed} / Total: ${testsInfo.total}\n` : `- No hay meta de última ejecución disponible.\n`);

fs.writeFileSync(path.join(statusDir, 'progreso.md'), md, 'utf-8');

console.log(`[progreso] Score: ${score}/100`);
console.log(`[progreso] Estado escrito en: ${path.join('pos-system', 'exports', 'status')}`);

