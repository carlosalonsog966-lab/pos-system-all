import path from 'path';
import fs from 'fs';
import type { Request } from 'express';

// Ruta por defecto en Windows: C:\ProgramData\SistemaPOS\DATOS\IMAGENES
// Usar doble barra invertida para representar backslash en string.
const DEFAULT_BASE = 'C:\\ProgramData\\SistemaPOS\\DATOS\\IMAGENES';

export function getUploadsBasePath() {
  const configured = process.env.UPLOADS_BASE_PATH;
  try {
    // Si se configuró una ruta absoluta válida, usarla tal cual
    const resolved = configured ? path.resolve(configured) : path.resolve(DEFAULT_BASE);
    return resolved;
  } catch {
    return path.resolve(DEFAULT_BASE);
  }
}

export function ensureUploadsSubdir(subdir: string) {
  const base = getUploadsBasePath();
  const dir = subdir ? path.join(base, subdir) : base;
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      console.error('[UPLOADS] Error creando directorio:', dir, err);
    }
  }
  return dir;
}

export function publicUploadsUrl(req: Request, subdir: string, filename: string) {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const urlPath = subdir ? `/uploads/${subdir}/${filename}` : `/uploads/${filename}`;
  return `${baseUrl}${urlPath}`;
}

export function resolveUploadsFileFromPublicUrl(publicUrl: string): string | null {
  try {
    const idx = publicUrl.indexOf('/uploads/');
    if (idx === -1) return null;
    const rel = publicUrl.substring(idx + '/uploads/'.length);
    const parts = rel.split('/');
    const full = path.join(getUploadsBasePath(), ...parts);
    return full;
  } catch {
    return null;
  }
}
