const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function main() {
  const root = path.resolve(__dirname, '..');
  const sourceFile = path.join(root, 'exports', 'endpoints.jsonl');
  const statusDir = path.join(root, 'exports', 'status');
  const targetFile = path.join(statusDir, 'endpoints.jsonl');

  if (!fs.existsSync(sourceFile)) {
    console.error('No se encontró exports/endpoints.jsonl; nada que copiar.');
    process.exit(1);
  }

  ensureDir(statusDir);
  fs.copyFileSync(sourceFile, targetFile);
  console.log('endpoints.jsonl copiado a:', targetFile);
}

main();

