import path from 'path';
import fs from 'fs';

async function main() {
  // Forzar base de exportaciones al path preferido del proyecto
  process.env.EXPORTS_BASE_PATH = path.resolve(
    path.join(process.cwd(), '..', 'exports')
  );

  const { OfflineBackupService } = await import('../src/services/OfflineBackupService');
  const { ExportsIntegrityService } = await import('../src/services/ExportsIntegrityService');

  const svc = OfflineBackupService.getInstance();

  const base = ExportsIntegrityService.getExportsBasePath();
  const bp = (sub: string) => path.join(base, 'backups', sub);

  console.log('[test-backups] Base de exportaciones:', base);

  // Ejecutar respaldos
  const manual = await svc.performBackup('manual', 'phase1-e2e-001');
  const daily = await svc.performBackup('daily');
  const weekly = await svc.performBackup('weekly');
  const monthly = await svc.performBackup('monthly');

  // Validar rutas esperadas
  const checks = [
    { name: 'manual', expectedDir: bp('MANUALES'), result: manual },
    { name: 'daily', expectedDir: bp('DIARIOS'), result: daily },
    { name: 'weekly', expectedDir: bp('SEMANALES'), result: weekly },
    { name: 'monthly', expectedDir: bp('MENSUALES'), result: monthly },
  ];

  for (const c of checks) {
    if (!c.result.success || !c.result.filePath) {
      console.error(`[test-backups] ${c.name} failed:`, c.result.error);
      continue;
    }
    const exists = fs.existsSync(c.result.filePath);
    const inFolder = c.result.filePath.startsWith(c.expectedDir);
    console.log(
      `[test-backups] ${c.name}: ok=${c.result.success} exists=${exists} folder=${inFolder} -> ${c.result.filePath}`
    );
  }

  // Validar manifest actualizado
  const manifestPath = path.join(base, 'verification-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const lastEntries = manifest.entries.slice(-4);
  console.log('[test-backups] últimas 4 entradas de manifiesto:');
  for (const e of lastEntries) {
    console.log(` - type=${e.type} relPath=${e.relPath} correlationId=${e.correlationId || ''}`);
  }

  console.log('[test-backups] Done');
}

main().catch((e) => {
  console.error('[test-backups] Error:', e);
  process.exit(1);
});

