const fs = require('fs');
const path = require('path');

require('ts-node').register({ transpileOnly: true });

async function main() {
  const backendRoot = process.cwd();
  const legacyDir = path.join(backendRoot, 'data', 'backups');
  process.env.EXPORTS_BASE_PATH = path.resolve(path.join(backendRoot, 'exports').replace(/backend[\\\/]exports$/, 'exports'));
  const { ExportsIntegrityService } = require('../src/services/ExportsIntegrityService');

  const exportsBase = ExportsIntegrityService.getExportsBasePath();
  const destDir = path.join(exportsBase, 'backups', 'LEGACY_DB');

  console.log('[migrate-legacy-backups] legacyDir=', legacyDir);
  console.log('[migrate-legacy-backups] exportsBase=', exportsBase);
  console.log('[migrate-legacy-backups] destDir=', destDir);

  if (!fs.existsSync(legacyDir)) {
    console.log('[migrate-legacy-backups] No existe carpeta legacy, nada que migrar.');
    return;
  }

  fs.mkdirSync(destDir, { recursive: true });

  const files = fs.readdirSync(legacyDir);
  const moved = [];
  for (const f of files) {
    // Considerar archivos sqlite y sus WAL/SHM
    if (/\.db$|\.db-wal$|\.db-shm$/i.test(f)) {
      const src = path.join(legacyDir, f);
      const dst = path.join(destDir, f);
      fs.copyFileSync(src, dst);
      moved.push(dst);
      try {
        ExportsIntegrityService.recordFile(dst, 'backup', 'legacy-db');
      } catch (e) {
        console.warn('[migrate-legacy-backups] No se pudo registrar en manifest:', e?.message || e);
      }
    }
  }

  if (moved.length === 0) {
    console.log('[migrate-legacy-backups] No se encontraron archivos .db/.db-wal/.db-shm en legacy.');
  } else {
    console.log(`[migrate-legacy-backups] Migrados ${moved.length} archivos:`);
    for (const p of moved) console.log(' -', p);
  }
}

main().catch((e) => {
  console.error('[migrate-legacy-backups] Error:', e);
  process.exit(1);
});

