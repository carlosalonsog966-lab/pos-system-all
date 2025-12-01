import fs from 'fs';
import path from 'path';
import { logger } from '../middleware/logger';

type IntegritySummary = {
  total: number;
  ok: number;
  missing: number;
  mismatch: number;
};

type IntegrityAlertEntry = IntegritySummary & {
  csvPath?: string;
  pdfPath?: string;
  triggeredBy?: string | null;
  jobId?: string | number | null;
  timestamp: string;
};

export class AlertService {
  static notifyIntegrityIssues(data: IntegritySummary & { csvPath?: string; pdfPath?: string; triggeredBy?: string | null; jobId?: any }) {
    try {
      const basePath = process.env.EXPORTS_BASE_PATH || path.join(process.cwd(), 'exports');
      const alertsFile = path.join(basePath, 'verification-alerts.json');
      if (!fs.existsSync(basePath)) fs.mkdirSync(basePath, { recursive: true });

      const entry: IntegrityAlertEntry = {
        total: data.total,
        ok: data.ok,
        missing: data.missing,
        mismatch: data.mismatch,
        csvPath: data.csvPath,
        pdfPath: data.pdfPath,
        triggeredBy: data.triggeredBy ?? null,
        jobId: data.jobId ?? null,
        timestamp: new Date().toISOString(),
      };

      let existing: IntegrityAlertEntry[] = [];
      if (fs.existsSync(alertsFile)) {
        try {
          const raw = fs.readFileSync(alertsFile, 'utf8');
          existing = JSON.parse(raw);
          if (!Array.isArray(existing)) existing = [];
        } catch {
          existing = [];
        }
      }

      existing.push(entry);
      // Evitar crecer sin límite
      const maxEntries = Number(process.env.ALERTS_MAX_ENTRIES || 500);
      if (existing.length > maxEntries) {
        existing = existing.slice(existing.length - maxEntries);
      }

      fs.writeFileSync(alertsFile, JSON.stringify(existing, null, 2), 'utf8');

      // Log explícito para observabilidad
      logger.warn(
        `[AlertService] Inconsistencias detectadas: missing=${data.missing}, mismatch=${data.mismatch} | CSV=${data.csvPath} | PDF=${data.pdfPath}`
      );
    } catch (err) {
      // No bloquear el flujo por errores de alerta
      logger.error(`[AlertService] Error escribiendo alerta: ${(err as Error).message}`);
    }
  }
}

