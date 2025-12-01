// Compara rutas reales del backend con contratos en exports/endpoints.jsonl
// Heurística basada en regex para router/app.<method>("/path") en archivos .ts/.js

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const routesDir = path.join(root, 'backend', 'src', 'routes');
const appFile = path.join(root, 'backend', 'src', 'app.ts');
const indexRoutesFile = path.join(routesDir, 'index.ts');
const contractsFile = path.join(root, 'exports', 'endpoints.jsonl');
const reportDir = path.join(root, 'exports', 'test');
const reportFile = path.join(reportDir, 'contracts-report.json');
// Copia adicional para el servidor de status (8080) que sirve únicamente exports/status
const statusDir = path.join(root, 'exports', 'status');
const statusReportFile = path.join(statusDir, 'contracts-report.json');

function walk(dir) {
  const entries = fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : [];
  const files = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walk(p));
    else if (e.isFile() && (p.endsWith('.ts') || p.endsWith('.js'))) files.push(p);
  }
  return files;
}

function extractRoutesFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const routes = [];
  // Captura paths delimitados por ' " o ` sin cruzar otros delimitadores
  const regexes = [
    /router\.(get|post|put|patch|delete)\s*\(\s*(["'`])([^"'`]+)\2/gm,
    /app\.(get|post|put|patch|delete)\s*\(\s*(["'`])([^"'`]+)\2/gm,
  ];
  for (const rx of regexes) {
    let m;
    while ((m = rx.exec(content)) !== null) {
      const method = m[1].toUpperCase();
      const routePath = m[3];
      if (routePath && routePath.startsWith('/')) {
        routes.push({ method, path: routePath });
      }
    }
  }
  return routes;
}

// Detectar base '/api' desde app.ts
function detectApiBase() {
  try {
    const content = fs.readFileSync(appFile, 'utf8');
    const m = content.match(/app\.use\(\s*(["'`])([^"'`]+)\1\s*,\s*routes\s*\)/);
    if (m && m[2]) return m[2];
  } catch {}
  return '/api';
}

// Mapear montajes: './jobs' -> '/jobs'
function loadMountMap() {
  const map = new Map();
  try {
    const content = fs.readFileSync(indexRoutesFile, 'utf8');
    // import jobRoutes from './jobs';
    const imports = [];
    const importRx = /import\s+(\w+)\s+from\s+['"]\.\/([\w-]+)['"];?/gm;
    let im;
    while ((im = importRx.exec(content)) !== null) {
      const varName = im[1];
      const fileStem = im[2];
      imports.push({ varName, fileStem });
    }
    // router.use('/jobs', jobRoutes);
    const useRx = /router\.use\(\s*(["'`])([^"'`]+)\1\s*,\s*(\w+)\s*\)/gm;
    let um;
    while ((um = useRx.exec(content)) !== null) {
      const mountPath = um[2];
      const varName = um[3];
      const imp = imports.find((i) => i.varName === varName);
      if (imp) {
        map.set(imp.fileStem, mountPath);
      }
    }
  } catch {}
  return map; // e.g., { 'jobs' => '/jobs' }
}

function loadBackendRoutes() {
  const files = walk(routesDir);
  const set = new Set();
  const apiBase = detectApiBase();
  const mountMap = loadMountMap();
  for (const f of files) {
    for (const r of extractRoutesFromFile(f)) {
      let fullPath = r.path;
      // Si la ruta proviene de index.ts, prefijar apiBase
      if (path.normalize(f) === path.normalize(indexRoutesFile)) {
        if (!fullPath.startsWith(apiBase)) fullPath = `${apiBase}${fullPath}`;
      } else {
        // Buscar si el archivo corresponde a un montaje en index.ts
        const stem = path.basename(f).replace(/\.(ts|js)$/,'');
        const mount = mountMap.get(stem);
        if (mount) {
          // Gestionar '/' como raíz
          const prefix = mount === '/' ? '' : mount;
          fullPath = `${apiBase}${prefix}${fullPath}`;
        } else {
          // Sin mapeo: si no empieza por '/api', añadir base
          if (!fullPath.startsWith(apiBase)) fullPath = `${apiBase}${fullPath}`;
        }
      }
      set.add(`${r.method} ${fullPath}`);
    }
  }
  // Además, considerar endpoints definidos directamente en app.ts (ya incluyen '/api')
  try {
    for (const r of extractRoutesFromFile(appFile)) {
      set.add(`${r.method} ${r.path}`);
    }
  } catch {}
  return set;
}

function loadContracts() {
  if (!fs.existsSync(contractsFile)) return new Set();
  const content = fs.readFileSync(contractsFile, 'utf8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const set = new Set();
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj && typeof obj.path === 'string' && typeof obj.method === 'string') {
        set.add(`${obj.method.toUpperCase()} ${obj.path}`);
      }
    } catch (_) {
      // ignorar líneas inválidas
    }
  }
  return set;
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function diffSets(a, b) {
  const onlyA = [];
  const onlyB = [];
  for (const x of a) if (!b.has(x)) onlyA.push(x);
  for (const y of b) if (!a.has(y)) onlyB.push(y);
  return { onlyA, onlyB };
}

function main() {
  const backendRoutes = loadBackendRoutes();
  const contractRoutes = loadContracts();

  const { onlyA: missingInContracts, onlyB: extraInContracts } = diffSets(backendRoutes, contractRoutes);

  ensureDir(reportDir);
  const report = {
    summary: {
      backendRoutesCount: backendRoutes.size,
      contractRoutesCount: contractRoutes.size,
      missingInContractsCount: missingInContracts.length,
      extraInContractsCount: extraInContracts.length,
    },
    missingInContracts,
    extraInContracts,
  };
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  try {
    ensureDir(statusDir);
    fs.writeFileSync(statusReportFile, JSON.stringify(report, null, 2));
  } catch (e) {
    console.warn('No se pudo escribir copia de reporte en status:', (e && e.message) || String(e));
  }

  console.log('Contrato vs rutas reporte escrito en:', reportFile);

  // Modo opcional: reescribir contratos para alinear con rutas reales
  if (process.argv.includes('--rewrite-contracts')) {
    try {
      const lines = Array.from(backendRoutes)
        .sort((a, b) => a.localeCompare(b))
        .map((entry) => {
          const [method, p] = entry.split(' ');
          return JSON.stringify({ method, path: p });
        });
      fs.writeFileSync(contractsFile, lines.join('\n'));

      // Mantener CSV en sincronía
      const csvPath = path.join(root, 'exports', 'endpoints.csv');
      const csvLines = ['method,path', ...Array.from(backendRoutes)
        .sort((a, b) => a.localeCompare(b))
        .map((entry) => {
          const [method, p] = entry.split(' ');
          return `${method},${p}`;
        })];
      fs.writeFileSync(csvPath, csvLines.join('\n'));

      // Mantener YAML en sincronía (grupos por primer segmento tras /api)
      const yamlPath = path.join(root, 'exports', 'endpoints.yaml');
      const endpointsArr = Array.from(backendRoutes)
        .sort((a, b) => a.localeCompare(b))
        .map((entry) => {
          const [method, p] = entry.split(' ');
          return { method, path: p };
        });
      const groupsMap = new Map();
      for (const ep of endpointsArr) {
        const m = (ep.path || '').startsWith('/api/') ? ep.path.slice('/api/'.length) : (ep.path || '').replace(/^\//,'');
        const seg = (m.split('/')[0] || '').trim() || 'root';
        groupsMap.set(seg, (groupsMap.get(seg) || 0) + 1);
      }
      const yaml = [
        `count: ${endpointsArr.length}`,
        'endpoints:',
        ...endpointsArr.map((ep) => `  - method: "${ep.method}"\n    path: "${ep.path}"`),
        'groups:',
        ...Array.from(groupsMap.entries()).map(([module, count]) => `  - module: "${module}"\n    count: ${count}`),
      ].join('\n');
      fs.writeFileSync(yamlPath, yaml);
      console.log('Contratos reescritos desde rutas reales.');

      // Recalcular diff tras la reescritura para actualizar reporte y estado
      const refreshedContracts = loadContracts();
      const { onlyA: missingAfterRewrite, onlyB: extraAfterRewrite } = diffSets(backendRoutes, refreshedContracts);
      const updatedReport = {
        summary: {
          backendRoutesCount: backendRoutes.size,
          contractRoutesCount: refreshedContracts.size,
          missingInContractsCount: missingAfterRewrite.length,
          extraInContractsCount: extraAfterRewrite.length,
        },
        missingInContracts: missingAfterRewrite,
        extraInContracts: extraAfterRewrite,
      };
      fs.writeFileSync(reportFile, JSON.stringify(updatedReport, null, 2));
      try {
        ensureDir(statusDir);
        fs.writeFileSync(statusReportFile, JSON.stringify(updatedReport, null, 2));
      } catch (e) {
        console.warn('No se pudo escribir copia de reporte en status (post-rewrite):', (e && e.message) || String(e));
      }
      if (missingAfterRewrite.length === 0 && extraAfterRewrite.length === 0) {
        console.log('Contratos alineados tras reescritura.');
        return; // exit code 0
      }
    } catch (e) {
      console.error('Error reescribiendo contratos:', (e && e.message) || String(e));
      process.exitCode = 1;
      return;
    }
  }

  if (missingInContracts.length > 0 || extraInContracts.length > 0) {
    console.error('Desalineación detectada entre backend y contratos.');
    process.exitCode = 1;
  } else {
    console.log('Contratos alineados con rutas backend.');
  }
}

main();
