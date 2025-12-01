const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dst) {
  if (!fs.existsSync(src)) {
    console.warn('Aviso: no existe', src);
    return false;
  }
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
  console.log('Copiado:', src, '->', dst);
  return true;
}

function main() {
  const root = path.resolve(__dirname, '..');
  const exportsDir = path.join(root, 'exports');
  const statusDir = path.join(exportsDir, 'status');

  const files = [
    { src: path.join(exportsDir, 'endpoints.html'), dst: path.join(statusDir, 'endpoints.html') },
    { src: path.join(exportsDir, 'endpoints.yaml'), dst: path.join(statusDir, 'endpoints.yaml') },
    { src: path.join(exportsDir, 'endpoints.csv'), dst: path.join(statusDir, 'endpoints.csv') },
    { src: path.join(exportsDir, 'endpoints.jsonl'), dst: path.join(statusDir, 'endpoints.jsonl') },
  ];

  let ok = true;
  for (const f of files) {
    const done = copyFile(f.src, f.dst);
    ok = ok && done;
  }
  if (!ok) {
    console.warn('Sync status: algunos archivos no se copiaron.');
    process.exitCode = 1;
  } else {
    console.log('Sync status: artefactos copiados correctamente.');
  }
}

main();

