import fs from 'fs';
import path from 'path';

function dirExists(p: string): boolean {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function fileExists(p: string): boolean {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function canWrite(dir: string): boolean {
  try {
    if (!dirExists(dir)) return false;
    const testFile = path.join(dir, '.__write_test__');
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    return true;
  } catch {
    return false;
  }
}

export function validateConfig(storagePath?: string) {
  const errors: Array<{ key: string; message: string }> = [];
  const warnings: Array<{ key: string; message: string }> = [];

  const NODE_ENV = process.env.NODE_ENV || 'development';
  const PORT = Number(
    NODE_ENV === 'development' ? process.env.BACKEND_PORT || 5757 : process.env.PORT || 5757,
  );
  const HOST = process.env.HOST || '0.0.0.0';
  const JWT_SECRET = process.env.JWT_SECRET || '';
  const FRONTEND_URL = process.env.FRONTEND_URL || '';
  const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || '';

  if (!JWT_SECRET || JWT_SECRET.trim().length < 16) {
    warnings.push({ key: 'JWT_SECRET', message: 'JWT_SECRET ausente o demasiado corto (recomendado >=16 caracteres)' });
  }

  if (PORT < 1024 || PORT > 65535) {
    errors.push({ key: 'PORT', message: `Puerto inválido: ${PORT}` });
  }

  if (!FRONTEND_URL && !PUBLIC_ORIGIN) {
    warnings.push({ key: 'CORS', message: 'FRONTEND_URL/PUBLIC_ORIGIN no configurados; se usarán orígenes por defecto' });
  }

  const root = path.resolve(path.join(__dirname, '../../..'));
  const logsDir = path.join(root, 'logs');
  const capturesDir = path.join(root, 'pos-system', 'captures');
  const defaultExportsDir = path.join(root, 'exports');
  const envExportsRaw = process.env.EXPORTS_BASE_PATH || '';
  const exportsBase = envExportsRaw
    ? (path.isAbsolute(envExportsRaw) ? envExportsRaw : path.resolve(root, envExportsRaw))
    : defaultExportsDir;

  for (const [key, dir] of [
    ['logs', logsDir],
    ['captures', capturesDir],
    ['exports', exportsBase],
  ] as Array<[string, string]>) {
    if (!dirExists(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {}
      if (!dirExists(dir)) warnings.push({ key: String(key), message: `No se pudo asegurar el directorio: ${dir}` });
    }
  }

  // Validar permisos de escritura sobre EXPORTS_BASE_PATH
  const exportsWritable = canWrite(exportsBase);
  if (!exportsWritable) {
    errors.push({ key: 'EXPORTS_BASE_PATH', message: `Base de exportaciones no escribible: ${exportsBase}. Revise permisos o variable de entorno EXPORTS_BASE_PATH.` });
  }

  let dbPath = storagePath || '';
  if (!dbPath) {
    const sqliteEnv = process.env.SQLITE_PATH || './backend/data/pos_system.db';
    dbPath = path.isAbsolute(sqliteEnv) ? sqliteEnv : path.resolve(root, sqliteEnv);
  }
  const dbDir = path.dirname(dbPath);
  if (!dirExists(dbDir)) {
    warnings.push({ key: 'DB_DIR', message: `Directorio de BD no existe: ${dbDir}` });
  }
  if (!fileExists(dbPath)) {
    warnings.push({ key: 'DB_FILE', message: `Archivo de BD no encontrado: ${dbPath}` });
  }

  const ok = errors.length === 0;
  return {
    ok,
    errors,
    warnings,
    details: {
      NODE_ENV,
      PORT,
      HOST,
      FRONTEND_URL,
      PUBLIC_ORIGIN,
      DB_PATH: dbPath,
      logsDir,
      capturesDir,
      exportsDir: defaultExportsDir,
      EXPORTS_BASE_PATH: envExportsRaw || null,
      exportsBase,
      exportsWritable,
    },
  };
}
