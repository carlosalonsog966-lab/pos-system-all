import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { ExportsIntegrityService } from '../services/ExportsIntegrityService';

export const IntegrityController = {
  summary(req: Request, res: Response) {
    try {
      const base = ExportsIntegrityService.getExportsBasePath();
      const summaryPath = path.join(base, 'verification-summary.json');
      const manifestPath = path.join(base, 'verification-manifest.json');

      // Verificar si la base de exportaciones es escribible
      let writable = false;
      try {
        const testFile = path.join(base, '.__write_test__');
        fs.writeFileSync(testFile, 'ok');
        fs.unlinkSync(testFile);
        writable = true;
      } catch {
        writable = false;
      }

      let summary: any = null;
      let manifest: any = null;
      if (fs.existsSync(summaryPath)) {
        try { summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8')); } catch {}
      }
      if (fs.existsSync(manifestPath)) {
        try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch {}
      }

      const manifestCount = Array.isArray(manifest?.entries) ? manifest.entries.length : 0;
      const payload = {
        success: true,
        data: {
          summary,
          manifest: {
            count: manifestCount,
            updatedAt: manifest?.updatedAt || null,
          },
          exports: {
            base,
            writable,
          },
        },
      };
      return res.json(payload);
    } catch (e) {
      return res.status(500).json({ success: false, error: (e as Error).message });
    }
  },
  verify(req: Request, res: Response) {
    try {
      const { limit, types, writeSummary } = req.body || {};
      const summary = ExportsIntegrityService.verifyManifest({
        limit: typeof limit === 'number' ? limit : undefined,
        types: Array.isArray(types) ? types : undefined,
        writeSummary: writeSummary === true,
      });

      res.setHeader('X-Integrity-Verified', 'true');
      return res.json({ success: true, data: summary });
    } catch (e) {
      return res.status(500).json({ success: false, error: (e as Error).message });
    }
  },
};
