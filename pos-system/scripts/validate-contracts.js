/**
 * Validador simple de contratos mínimos contra `exports/endpoints.yaml`.
 * - Verifica presencia de rutas críticas.
 * - Salida: código 0 si todo OK; 1 si faltan rutas.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const yamlPath = path.join(root, 'exports', 'endpoints.yaml');

function parseYamlRoutes(yamlText) {
  // Parser mínimo por regex para evitar dependencias YAML (best-effort)
  const lines = yamlText.split(/\r?\n/);
  const routes = [];
  for (const line of lines) {
    const m = line.match(/\s*-\s+method:\s*(GET|POST|PUT|PATCH|DELETE)\s+path:\s*(\S+)/i);
    if (m) routes.push({ method: m[1].toUpperCase(), path: m[2] });
  }
  return routes;
}

function main() {
  if (!fs.existsSync(yamlPath)) {
    console.warn('[contracts] endpoints.yaml not found; skipping');
    process.exit(0);
  }
  const yamlText = fs.readFileSync(yamlPath, 'utf-8');
  const routes = parseYamlRoutes(yamlText);
  const have = new Set(routes.map(r => `${r.method} ${r.path}`));

  const required = [
    ['POST', '/auth/login'],
    ['GET', '/health'],
    ['GET', '/metrics'],
    ['GET', '/products'],
    ['POST', '/products'],
    ['PUT', '/products/:id'],
    ['DELETE', '/products/:id'],
    ['POST', '/sales'],
    ['GET', '/reports/daily-sales'],
  ];

  const missing = required.filter(([m, p]) => !have.has(`${m} ${p}`));
  if (missing.length) {
    console.error('[contracts] Missing routes:', missing.map(x => x.join(' ')).join(', '));
    process.exit(1);
  }
  console.log('[contracts] All required routes present');
}

main();

