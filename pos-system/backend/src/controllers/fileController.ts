import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { FileStorageService } from '../services/FileStorageService';
import { AuditTrailService } from '../services/AuditTrailService';
import { validateData } from '../middleware/zodValidation';
import { fileUploadSchema } from '../schemas/file';
import { Product } from '../models/Product';
import { ProductAsset } from '../models/ProductAsset';
import { Client } from '../models/Client';
import { Sale } from '../models/Sale';
import PDFDocument from 'pdfkit';
import { FileQueryInput, FileIdParamsInput } from '../schemas/file';
import { getUploadsBasePath } from '../utils/uploads';
import { applyIntegrityHeaders } from '../utils/integrityHeaders';
import { ExportsIntegrityService } from '../services/ExportsIntegrityService';

function buildPublicUrl(req: Request, relPath: string) {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads/${relPath.replace(/\\/g, '/')}`;
}

export const FileController = {
  async upload(req: Request, res: Response) {
    try {
      // Validar entrada con Zod
      const validation = await validateData(req.body || {}, fileUploadSchema);
      if (!validation.success) {
        return res.status(400).json({ success: false, message: 'Errores de validación', errors: validation.errors });
      }

      const { filename, mimeType, dataBase64, entityType, entityId, metadata } = validation.data;

      // Validar existencia de entidad referenciada
      if (entityType && entityId) {
        let exists = false;
        if (entityType === 'product') {
          const p = await Product.findByPk(entityId);
          exists = !!p;
        } else if (entityType === 'client') {
          const c = await Client.findByPk(entityId);
          exists = !!c;
        } else if (entityType === 'sale') {
          const s = await Sale.findByPk(entityId);
          exists = !!s;
        } else if (entityType === 'productAsset') {
          const a = await ProductAsset.findByPk(entityId);
          exists = !!a;
        }
        if (!exists) {
          return res.status(400).json({ success: false, error: `Entidad no encontrada para ${entityType} con id ${entityId}` });
        }
      }

      const stored = await FileStorageService.saveFile({ filename, mimeType, dataBase64, entityType, entityId, metadata });
      const publicUrl = buildPublicUrl(req, stored.path);

      // Auditoría
      await AuditTrailService.log({
        operation: 'file.upload',
        entityType: stored.entityType,
        entityId: stored.entityId,
        result: 'success',
        message: `Archivo subido: ${stored.filename}`,
        details: { id: stored.id, mimeType: stored.mimeType, size: stored.size, metadata: stored.metadata },
        actor: (req as any).user || null,
        correlationId: (req.headers['x-correlation-id'] as string) || undefined,
      });

      return res.status(201).json({ success: true, data: { ...stored, publicUrl } });
    } catch (error) {
      return res.status(500).json({ success: false, error: (error as Error).message });
    }
  },

  async list(req: Request, res: Response) {
    try {
      const { entityType, entityId } = req.query as FileQueryInput;
      const data = await FileStorageService.listFiles({ entityType, entityId });
      const withUrls = data.map(d => ({ ...d, publicUrl: buildPublicUrl(req, d.path) }));
      return res.json({ success: true, data: withUrls });
    } catch (error) {
      return res.status(500).json({ success: false, error: (error as Error).message });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params as FileIdParamsInput;
      const data = await FileStorageService.getFile(id);
      if (!data) return res.status(404).json({ success: false, error: 'Archivo no encontrado' });
      const publicUrl = buildPublicUrl(req, data.path);
      return res.json({ success: true, data: { ...data, publicUrl } });
    } catch (error) {
      return res.status(500).json({ success: false, error: (error as Error).message });
    }
  },

  async remove(req: Request, res: Response) {
    try {
      const { id } = req.params as FileIdParamsInput;
      const deleted = await FileStorageService.deleteFile(id);
      if (!deleted) return res.status(404).json({ success: false, error: 'Archivo no encontrado' });

      // Auditoría
      await AuditTrailService.log({
        operation: 'file.delete',
        result: 'success',
        message: `Archivo eliminado: ${id}`,
        details: { id },
        actor: (req as any).user || null,
      });

      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, error: (error as Error).message });
    }
  },

  async verify(req: Request, res: Response) {
    try {
      const { id } = req.params as FileIdParamsInput;
      const result = await FileStorageService.verifyFile(id);
      if (!result) return res.status(404).json({ success: false, error: 'Archivo no encontrado' });

      // Auditoría de verificación
      await AuditTrailService.log({
        operation: 'file.verify',
        entityType: 'file',
        entityId: id,
        result: result.exists && result.match ? 'success' : result.exists ? 'partial' : 'failure',
        message: result.exists ? (result.match ? 'Checksum coincide' : 'Checksum NO coincide') : 'Archivo físico ausente',
        details: { checksumDb: result.checksumDb, checksumActual: result.checksumActual, path: result.path },
        actor: (req as any).user || null,
      });

      return res.json({ success: true, data: result });
    } catch (error) {
      return res.status(500).json({ success: false, error: (error as Error).message });
    }
  },

  async download(req: Request, res: Response) {
    try {
      const { id } = req.params as FileIdParamsInput;
      const meta = await FileStorageService.getFile(id);
      if (!meta) return res.status(404).json({ success: false, error: 'Archivo no encontrado' });

      const verification = await FileStorageService.verifyFile(id);
      if (!verification) return res.status(404).json({ success: false, error: 'Archivo no encontrado' });

      const resultStatus = verification.exists && verification.match ? 'success' : verification.exists ? 'partial' : 'failure';
      const message = verification.exists ? (verification.match ? 'Checksum coincide' : 'Checksum NO coincide') : 'Archivo físico ausente';

      // Auditoría de descarga con verificación
      await AuditTrailService.log({
        operation: 'file.download',
        entityType: 'file',
        entityId: id,
        result: resultStatus,
        message,
        details: { checksumDb: verification.checksumDb, checksumActual: verification.checksumActual, path: verification.path },
        actor: (req as any).user || null,
        correlationId: (req.headers['x-correlation-id'] as string) || undefined,
      });

      if (!verification.exists) {
        return res.status(410).json({ success: false, error: 'Archivo físico ausente' });
      }

      // Encabezados de integridad unificados
      applyIntegrityHeaders(res, {
        filename: meta.filename,
        contentType: meta.mimeType || 'application/octet-stream',
        checksum: verification.checksumActual || '',
        expected: verification.checksumDb || '',
      });

      // Stream del archivo (ruta física resuelta desde uploads base + meta.path)
      const absolute = path.join(getUploadsBasePath(), meta.path);
      const stream = fs.createReadStream(absolute);
      stream.on('error', (err: Error) => {
        return res.status(500).json({ success: false, error: 'Error leyendo archivo', details: err.message });
      });
      stream.pipe(res);
    } catch (error) {
      return res.status(500).json({ success: false, error: (error as Error).message });
    }
  },

  async integrityScan(req: Request, res: Response) {
    try {
      const { entityType, entityId, limit } = req.query as FileQueryInput;
      const result = await FileStorageService.verifyAll({ entityType, entityId, limit: limit ? Number(limit) : undefined });

      await AuditTrailService.log({
        operation: 'files.integrity.scan',
        entityType: entityType || undefined,
        entityId: entityId || undefined,
        result: 'success',
        message: `Escaneo de integridad: total=${result.summary.total}, ok=${result.summary.ok}, missing=${result.summary.missing}, mismatch=${result.summary.mismatch}`,
        details: result.summary,
        actor: (req as any).user || null,
      });

      return res.json({ success: true, data: result });
    } catch (error) {
      return res.status(500).json({ success: false, error: (error as Error).message });
    }
  },

  async exportIntegrityCSV(req: Request, res: Response) {
    try {
      const { entityType, entityId, limit } = req.query as FileQueryInput;
      const { summary, items } = await FileStorageService.verifyAll({ entityType, entityId, limit: limit ? Number(limit) : undefined });

      const headers = ['id','filename','path','exists','checksumDb','checksumActual','match','entityType','entityId','createdAt'];
      const lines = [headers.join(',')];
      for (const it of items) {
        lines.push([
          it.id,
          JSON.stringify(it.filename ?? ''),
          JSON.stringify(it.path ?? ''),
          it.exists ? 'true' : 'false',
          it.checksumDb ?? '',
          it.checksumActual ?? '',
          typeof it.match === 'boolean' ? (it.match ? 'true' : 'false') : '',
          it.entityType ?? '',
          it.entityId ?? '',
          it.createdAt ? new Date(it.createdAt).toISOString() : '',
        ].join(','));
      }
      const csv = lines.join('\n');

      const filename = `files_integrity_${new Date().toISOString().slice(0,10)}.csv`;
      const bom = '\uFEFF';
      const body = bom + csv;
      const byteLength = Buffer.byteLength(body, 'utf8');
      applyIntegrityHeaders(res, { filename, contentType: 'text/csv; charset=utf-8', body, setContentLength: true });

      await AuditTrailService.log({
        operation: 'files.integrity.export.csv',
        result: 'success',
        message: `Exportación CSV integridad: total=${summary.total}, ok=${summary.ok}, missing=${summary.missing}, mismatch=${summary.mismatch}`,
        details: { ...summary, filename },
        actor: (req as any).user || null,
      });

      return res.status(200).send(body);
    } catch (error) {
      return res.status(500).json({ success: false, error: (error as Error).message });
    }
  },

  async exportIntegrityPDF(req: Request, res: Response) {
    try {
      const { entityType, entityId, limit } = req.query as FileQueryInput;
      const { summary, items } = await FileStorageService.verifyAll({ entityType, entityId, limit: limit ? Number(limit) : undefined });
      const filename = `files_integrity_${new Date().toISOString().slice(0,10)}.pdf`;

      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', async () => {
        const pdfBuffer = Buffer.concat(chunks);
        applyIntegrityHeaders(res, { filename, contentType: 'application/pdf', body: pdfBuffer });
        await AuditTrailService.log({
          operation: 'files.integrity.export.pdf',
          result: 'success',
          message: `Exportación PDF integridad: total=${summary.total}, ok=${summary.ok}, missing=${summary.missing}, mismatch=${summary.mismatch}`,
          details: { ...summary, filename },
          actor: (req as any).user || null,
        });
        return res.status(200).send(pdfBuffer);
      });

      doc.fontSize(16).text('Reporte de Integridad de Archivos', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Fecha: ${new Date().toLocaleString()}`);
      doc.moveDown();
      doc.text(`Total: ${summary.total}`);
      doc.text(`OK: ${summary.ok}`);
      doc.text(`Faltantes: ${summary.missing}`);
      doc.text(`Checksum NO coincide: ${summary.mismatch}`);
      doc.moveDown();
      doc.text('Detalles de inconsistencias:', { underline: true });
      doc.moveDown();

      const problematic = items.filter(it => !it.exists || it.match === false);
      for (const it of problematic.slice(0, 200)) {
        doc.text(` ${it.id} | ${it.filename} | ${it.path}`);
        doc.text(`  Existe: ${it.exists ? 'Sí' : 'No'} | Match: ${typeof it.match === 'boolean' ? (it.match ? 'Sí' : 'No') : 'N/A'}`);
        if (it.checksumDb || it.checksumActual) {
          doc.text(`  checksumDb: ${it.checksumDb ?? ''}`);
          doc.text(`  checksumActual: ${it.checksumActual ?? ''}`);
        }
        doc.moveDown(0.5);
      }

      doc.end();
    } catch (error) {
      return res.status(500).json({ success: false, error: (error as Error).message });
    }
  },

  async exportIntegrityLatestCSV(req: Request, res: Response) {
    try {
      const base = ExportsIntegrityService.getExportsBasePath();
      if (!fs.existsSync(base)) return res.status(404).json({ success: false, error: 'Base de exportaciones no encontrada' });
      const entries = fs.readdirSync(base);
      const candidates = entries.filter(name => name.startsWith('files_integrity_') && name.endsWith('.csv'));
      if (candidates.length === 0) return res.status(404).json({ success: false, error: 'No hay CSV periódico disponible' });
      const withStats = candidates.map(name => {
        const full = path.join(base, name);
        const st = fs.statSync(full);
        return { name, full, mtimeMs: st.mtimeMs };
      });
      withStats.sort((a, b) => b.mtimeMs - a.mtimeMs);
      const latest = withStats[0];
      const body = fs.readFileSync(latest.full);

      applyIntegrityHeaders(res, { filename: latest.name, contentType: 'text/csv; charset=utf-8', body, setContentLength: true });

      await AuditTrailService.log({
        operation: 'files.integrity.latest.csv',
        result: 'success',
        message: `Descarga último CSV de integridad: ${latest.name}`,
        details: { filename: latest.name, path: latest.full },
        actor: (req as any).user || null,
      });

      return res.status(200).send(body);
    } catch (error) {
      return res.status(500).json({ success: false, error: (error as Error).message });
    }
  },

  async exportIntegrityLatestPDF(req: Request, res: Response) {
    try {
      const base = ExportsIntegrityService.getExportsBasePath();
      if (!fs.existsSync(base)) return res.status(404).json({ success: false, error: 'Base de exportaciones no encontrada' });
      const entries = fs.readdirSync(base);
      const candidates = entries.filter(name => name.startsWith('files_integrity_') && name.endsWith('.pdf'));
      if (candidates.length === 0) return res.status(404).json({ success: false, error: 'No hay PDF periódico disponible' });
      const withStats = candidates.map(name => {
        const full = path.join(base, name);
        const st = fs.statSync(full);
        return { name, full, mtimeMs: st.mtimeMs };
      });
      withStats.sort((a, b) => b.mtimeMs - a.mtimeMs);
      const latest = withStats[0];
      const body = fs.readFileSync(latest.full);

      applyIntegrityHeaders(res, { filename: latest.name, contentType: 'application/pdf', body, setContentLength: true });

      await AuditTrailService.log({
        operation: 'files.integrity.latest.pdf',
        result: 'success',
        message: `Descarga último PDF de integridad: ${latest.name}`,
        details: { filename: latest.name, path: latest.full },
        actor: (req as any).user || null,
      });

      return res.status(200).send(body);
    } catch (error) {
      return res.status(500).json({ success: false, error: (error as Error).message });
    }
  },
};

