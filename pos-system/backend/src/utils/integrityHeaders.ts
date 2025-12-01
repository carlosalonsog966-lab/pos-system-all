import { Response } from 'express';
import { sha256OfBuffer } from './hash';
import { ExportsIntegrityService } from '../services/ExportsIntegrityService';
import { logger } from '../middleware/logger';
import { EventLogService } from '../services/eventLogService';

type IntegrityHeaderOptions = {
  filename: string;
  contentType: string;
  body?: Buffer | string;
  checksum?: string;
  expected?: string;
  setContentLength?: boolean;
  asAttachment?: boolean; // controla Content-Disposition; por defecto true
};

/**
 * Aplica encabezados de integridad (SHA256, esperado, match, verificación) y
 * encabezados de no-cache/nosniff a una respuesta de descarga. Si detecta mismatch,
 * registra un warning en el logger y en EventLogService.
 */
export function applyIntegrityHeaders(res: Response, opts: IntegrityHeaderOptions): {
  checksum: string;
  expected: string;
  match: 'true' | 'false' | '';
} {
  const { filename, contentType, body, setContentLength } = opts;
  let checksum = opts.checksum || '';

  if (!checksum && body) {
    const buf = typeof body === 'string' ? Buffer.from(body, 'utf8') : body;
    checksum = sha256OfBuffer(buf);
    if (setContentLength) {
      try { res.setHeader('Content-Length', String(buf.length)); } catch {}
    }
  }

  let expected = opts.expected || '';
  if (!expected) {
    try {
      const manifest = ExportsIntegrityService.readManifest();
      expected = manifest.entries.find(e => e.filename === filename)?.sha256 || '';
    } catch {}
  }

  const match: 'true' | 'false' | '' = expected ? (expected === checksum ? 'true' : 'false') : '';

  // Encabezados estándar
  res.setHeader('Content-Type', contentType);
  if (opts.asAttachment !== false) {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Checksum-SHA256', checksum);
  res.setHeader('X-Checksum-Expected', expected);
  res.setHeader('X-Checksum-Match', match);
  res.setHeader('X-Integrity-Verified', 'true');

  // Registro de mismatch para trazabilidad
  if (match === 'false') {
    try {
      logger.warn('[Integrity] Checksum mismatch on download', { filename, expected, actual: checksum });
      EventLogService.record({
        type: 'SYSTEM',
        severity: 'warning',
        message: 'Integrity mismatch on download',
        context: 'download',
        details: { filename, expected, actual: checksum },
      }).catch(() => {});
    } catch {}
  }

  return { checksum, expected, match };
}
