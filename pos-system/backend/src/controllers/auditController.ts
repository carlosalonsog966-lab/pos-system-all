import { Request, Response } from 'express';
import { AuditTrailService } from '../services/AuditTrailService';
import { sha256OfBuffer } from '../utils/hash';
import { ExportsIntegrityService } from '../services/ExportsIntegrityService';
import { applyIntegrityHeaders } from '../utils/integrityHeaders';

export const AuditController = {
  async list(req: Request, res: Response) {
    try {
      const { entityType, entityId, actorId, operation } = req.query as any;
      const rows = await AuditTrailService.list({ entityType, entityId, actorId, operation });
      return res.json({ success: true, data: rows });
    } catch (error) {
      return res.status(500).json({ success: false, error: (error as Error).message });
    }
  },

  async refunds(req: Request, res: Response) {
    try {
      const { saleId, actorId, result, startDate, endDate } = req.query as any;
      const rows = await AuditTrailService.listRefunds({ saleId, actorId, result, startDate, endDate });
      return res.json({ success: true, data: rows });
    } catch (error) {
      return res.status(500).json({ success: false, error: (error as Error).message });
    }
  },

  async refundsCsv(req: Request, res: Response) {
    try {
      const { saleId, actorId, result, startDate, endDate } = req.query as any;
      const rows = await AuditTrailService.listRefunds({ saleId, actorId, result, startDate, endDate });
      const headers = ['id','operation','entityType','entityId','actorId','actorRole','result','message','correlationId','createdAt'];
      const escape = (val: any) => {
        if (val === null || val === undefined) return '';
        const s = String(val);
        // Escapar comillas dobles
        const esc = s.replace(/"/g, '""');
        // Envolver en comillas si contiene coma, salto de línea o comillas
        return /[",\n]/.test(esc) ? `"${esc}"` : esc;
      };
      let csv = headers.join(',') + '\n';
      for (const r of rows) {
        const line = [
          escape((r as any).id),
          escape((r as any).operation),
          escape((r as any).entityType),
          escape((r as any).entityId),
          escape((r as any).actorId),
          escape((r as any).actorRole),
          escape((r as any).result),
          escape((r as any).message),
          escape((r as any).correlationId),
          escape((r as any).createdAt?.toISOString?.() || (r as any).createdAt),
        ].join(',');
        csv += line + '\n';
      }
      const bom = '\ufeff';
      const payload = bom + csv;
      const buf = Buffer.from(payload, 'utf8');
      const checksum = sha256OfBuffer(buf);
      const filename = 'refunds-audit.csv';
      const manifest = ExportsIntegrityService.readManifest();
      const expected = manifest.entries.find(e => e.filename === filename)?.sha256 || '';
      applyIntegrityHeaders(res, { filename, contentType: 'text/csv; charset=utf-8', body: buf, setContentLength: true });
      return res.status(200).send(buf);
    } catch (error) {
      return res.status(500).send('error,' + (error as Error).message);
    }
  },

  async report(req: Request, res: Response) {
    try {
      const { startDate, endDate, operation, entityType, entityId, actorId, result, correlationId } = req.query as any;
      const summary = await AuditTrailService.report({ startDate, endDate, operation, entityType, entityId, actorId, result, correlationId });
      return res.json({ success: true, data: summary });
    } catch (error) {
      return res.status(500).json({ success: false, error: (error as Error).message });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const row = await AuditTrailService.getById(id);
      if (!row) return res.status(404).json({ success: false, error: 'Registro no encontrado' });
      return res.json({ success: true, data: row });
    } catch (error) {
      return res.status(500).json({ success: false, error: (error as Error).message });
    }
  },
};

