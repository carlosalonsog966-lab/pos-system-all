import { Op } from 'sequelize';
// Generador simple de UUID v4 sin dependencias
function uuidv4() {
  // No crÃ­ptico; suficiente para IDs de jobs internos
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { JobQueue } from '../models/JobQueue';
import { logger } from '../middleware/logger';
import { Product } from '../models/Product';
import { ReportService } from './reportService';
import { TicketService } from './ticketService';
import { BarcodeService } from './BarcodeService';
import { AuditTrailService } from './AuditTrailService';
import { AlertService } from './AlertService';
import chartCaptureService from './chartCaptureService';
import ProductAsset from '../models/ProductAsset';

import { FileStorageService } from './FileStorageService';
import { ExportsIntegrityService } from './ExportsIntegrityService';

type JobHandler = (job: JobQueue) => Promise<void>;

export class JobQueueService {
  private static running = false;
  private static processing = false;
  private static intervalMs = Number(process.env.JOB_QUEUE_INTERVAL_MS || 2000);
  private static timer: any | null = null;
  private static handlers: Map<string, JobHandler> = new Map();

  static async start() {
    if (this.running) return;
    this.registerBuiltInHandlers();
    this.running = true;
    logger.info(`[JobQueue] Iniciando loop con intervalo ${this.intervalMs}ms`);
    this.timer = setInterval(() => this.loop().catch(err => logger.error('[JobQueue] Loop error', err)), this.intervalMs);
  }

  static async stop() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private static async loop() {
    if (!this.running || this.processing) return;
    this.processing = true;
    try {
      const now = new Date();
      const job = await JobQueue.findOne({
        where: {
          status: 'queued',
          [Op.or]: [
            { availableAt: { [Op.lte]: now } },
            { availableAt: null },
          ],
        },
        order: [['scheduledAt', 'ASC'], ['createdAt', 'ASC']],
      });

      if (!job) return; // nada que hacer

      await job.update({ status: 'processing', lockedAt: new Date(), attempts: (job.attempts || 0) + 1 });
      logger.info(`[JobQueue] Ejecutando job ${job.id} tipo=${job.type} intento=${job.attempts}`);

      const handler = this.handlers.get(job.type);
      if (!handler) throw new Error(`No existe handler para tipo '${job.type}'`);

      try {
        await handler(job);
        await job.update({ status: 'completed', error: null, lockedAt: null, availableAt: null });
        logger.info(`[JobQueue] Job ${job.id} completado`);
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        const maxAttempts = job.maxAttempts || 3;
        const attempts = job.attempts || 1;
        const willRetry = attempts < maxAttempts;
        await job.update({
          status: willRetry ? 'queued' : 'failed',
          error: errorMsg,
          lockedAt: null,
          availableAt: willRetry ? new Date(Date.now() + this.backoffMs(attempts)) : null,
        });
        logger.error(`[JobQueue] Job ${job.id} fallo: ${errorMsg}${willRetry ? ' (reintento programado)' : ''}`);
      }
    } finally {
      this.processing = false;
    }
  }

  private static backoffMs(attempt: number) {
    const base = Number(process.env.JOB_QUEUE_BACKOFF_MS || 5000);
    return base * Math.min(6, attempt); // lineal simple
  }

  static registerHandler(type: string, handler: JobHandler) {
    this.handlers.set(type, handler);
  }

  static async enqueue(type: string, payload: any, options?: { scheduledAt?: Date | null; availableAt?: Date | null; maxAttempts?: number }) {
    const scheduledAt = options?.scheduledAt ?? null;
    const availableAt = options?.availableAt ?? new Date();
    const maxAttempts = options?.maxAttempts ?? 3;
    const job = await JobQueue.create({ id: uuidv4(), type, status: 'queued', payload, attempts: 0, maxAttempts, scheduledAt, availableAt });
    logger.info(`[JobQueue] Enqueued job ${job.id} tipo=${type}`);
    return job;
  }

  static async retry(jobId: string) {
    const job = await JobQueue.findByPk(jobId);
    if (!job) throw new Error('Job no encontrado');
    await job.update({ status: 'queued', availableAt: new Date(), lockedAt: null, error: null });
    return job;
  }

  static isRunning(): boolean {
    return this.running;
  }

  static async getStats(): Promise<{
    pendingCount: number;
    processingCount: number;
    failedCount: number;
  }> {
    try {
      const [pendingCount, processingCount, failedCount] = await Promise.all([
        JobQueue.count({ where: { status: 'queued' } }),
        JobQueue.count({ where: { status: 'processing' } }),
        JobQueue.count({ where: { status: 'failed' } })
      ]);

      return {
        pendingCount,
        processingCount,
        failedCount
      };
    } catch (error) {
      return {
        pendingCount: 0,
        processingCount: 0,
        failedCount: 0
      };
    }
  }

  static async health() {
    try {
      const failedCount = await JobQueue.count({ where: { status: 'failed' } });
      const pendingCount = await JobQueue.count({ where: { status: 'queued' } });
      const processingCount = await JobQueue.count({ where: { status: 'processing' } });
      // Métricas avanzadas: edad de cola y tiempos de procesamiento
      const now = Date.now();
      const maxSample = Number(process.env.JOB_QUEUE_METRICS_SAMPLE || 1000);
      const queued = await JobQueue.findAll({ where: { status: 'queued' }, attributes: ['createdAt','availableAt'], order: [['createdAt','DESC']], limit: maxSample });
      const queueAgesMs: number[] = queued.map(j => {
        const base = (j.get('availableAt') as Date) || (j.get('createdAt') as Date);
        const t = base ? new Date(base).getTime() : 0;
        return t ? Math.max(0, now - t) : 0;
      }).filter(x => Number.isFinite(x) && x > 0);
      const processed = await JobQueue.findAll({ where: { status: { [Op.in]: ['completed','failed'] }, lockedAt: { [Op.ne]: null } }, attributes: ['lockedAt','updatedAt'], order: [['updatedAt','DESC']], limit: maxSample });
      const processingTimesMs: number[] = processed.map(j => {
        const locked = (j.get('lockedAt') as Date);
        const updated = (j.get('updatedAt') as Date);
        const lt = locked ? new Date(locked).getTime() : 0;
        const ut = updated ? new Date(updated).getTime() : 0;
        return (lt && ut && ut >= lt) ? (ut - lt) : 0;
      }).filter(x => Number.isFinite(x) && x > 0);

      const percentile = (arr: number[], p: number) => {
        const a = [...arr].filter(x => Number.isFinite(x)).sort((x,y) => x - y);
        if (!a.length) return 0;
        const idx = Math.min(a.length - 1, Math.max(0, Math.round((p / 100) * (a.length - 1))));
        return a[idx];
      };
      const stats = (arr: number[]) => {
        const a = arr.filter(x => Number.isFinite(x));
        if (!a.length) return { count: 0, min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0 };
        const min = Math.min(...a);
        const max = Math.max(...a);
        const mean = Math.round(a.reduce((s,v) => s + v, 0) / a.length);
        return {
          count: a.length,
          min,
          max,
          mean,
          p50: percentile(a, 50),
          p95: percentile(a, 95),
          p99: percentile(a, 99),
        };
      };
      const queueAgeMsStats = stats(queueAgesMs);
      const processingTimeMsStats = stats(processingTimesMs);
      return {
        running: this.running,
        intervalMs: this.intervalMs,
        failedCount,
        pendingCount,
        processingCount,
        queueAgeMsStats,
        processingTimeMsStats,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return {
        running: this.running,
        intervalMs: this.intervalMs,
        error: (err as any)?.message || String(err),
        timestamp: new Date().toISOString(),
      };
    }
  }

  private static registerBuiltInHandlers() {

    // Escaneo diario de integridad de archivos (CSV y PDF)
    this.registerHandler('files.integrity.scan.daily', async (job) => {
      // Normalizar payload por si viene como string
      let payload: any = job.payload || {};
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch { payload = {}; }
      }

      // Base de exportaciones unificada
      const exportBase = ExportsIntegrityService.getExportsBasePath();
      if (!fs.existsSync(exportBase)) fs.mkdirSync(exportBase, { recursive: true });

      const { entityType, entityId, limit } = payload;
      const { summary, items } = await FileStorageService.verifyAll({ entityType, entityId, limit: typeof limit === 'number' ? limit : undefined });

      // Construir CSV
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
      const csvName = `files_integrity_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
      const csvPath = path.join(exportBase, csvName);
      fs.writeFileSync(csvPath, csv, 'utf8');

      // Generar PDF (resumen + inconsistencias)
      const pdfName = `files_integrity_${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
      const pdfPath = path.join(exportBase, pdfName);
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

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
      for (const it of problematic.slice(0, 300)) {
        doc.text(` ${it.id} | ${it.filename} | ${it.path}`);
        doc.text(`  Existe: ${it.exists ? 'Sí' : 'No'} | Match: ${typeof it.match === 'boolean' ? (it.match ? 'Sí' : 'No') : 'N/A'}`);
        if (it.checksumDb || it.checksumActual) {
          doc.text(`  checksumDb: ${it.checksumDb ?? ''}`);
          doc.text(`  checksumActual: ${it.checksumActual ?? ''}`);
        }
        doc.moveDown(0.5);
      }

      doc.text('Generado automáticamente por Sistema POS', { align: 'right' });
      doc.end();

      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', (err) => reject(err));
      });

      // Registrar archivos en el manifest para expected/match en descargas
      try {
        ExportsIntegrityService.recordFile(csvPath, 'report');
      } catch {}
      try {
        ExportsIntegrityService.recordFile(pdfPath, 'report');
      } catch {}

      // Actualizar payload con resultado
      await job.update({ payload: { ...payload, result: { summary, csv: csvPath, pdf: pdfPath } } });

      // Auditoría
      try {
        await AuditTrailService.log({
          operation: 'files.integrity.scan.daily',
          entityType: entityType || undefined,
          entityId: entityId || undefined,
          result: 'success',
          message: `Integridad diaria: total=${summary.total}, ok=${summary.ok}, missing=${summary.missing}, mismatch=${summary.mismatch}`,
          details: { ...summary, csv: csvPath, pdf: pdfPath },
          actor: payload?.actor || null,
        });
      } catch (e) {
        // swallow audit errors
      }

      // Notificar alertas si se detectan inconsistencias
      if (summary.missing > 0 || summary.mismatch > 0) {
        try {
          AlertService.notifyIntegrityIssues({
            ...summary,
            csvPath,
            pdfPath,
            triggeredBy: payload?.actor || null,
            jobId: job.id,
          });
        } catch (err) {
          // ignorar errores de notificación
        }
      }

      // Escribir resumen en logs/verification-final.txt
      try {
        const logsDir = path.join(process.cwd(), 'logs');
        const finalLog = path.join(logsDir, 'verification-final.txt');
        const summaryLine = `[${new Date().toISOString()}] total=${summary.total}, ok=${summary.ok}, missing=${summary.missing}, mismatch=${summary.mismatch} | CSV=${csvPath} | PDF=${pdfPath}\n`;
        if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
        fs.appendFileSync(finalLog, summaryLine);
      } catch (err) {
        // ignorar errores de escritura de log
      }

      logger.info(`[JobQueue::files.integrity.scan.daily] CSV: ${csvPath} | PDF: ${pdfPath}`);
    });
    // Handler de eco para pruebas
    this.registerHandler('echo', async (job) => {
      const msg = (job.payload && job.payload.message) || '(sin mensaje)';
      logger.info(`[JobQueue::echo] ${msg}`);
    });

    // Limpieza de exportaciones antiguas
    this.registerHandler('cleanup.exports', async (job) => {
      const days = Number(job.payload?.days || 7);
      // Usar la misma base de exportaciones que el manifest
      const basePath = ExportsIntegrityService.getExportsBasePath();
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      if (!fs.existsSync(basePath)) return;
      const entries = fs.readdirSync(basePath);
      let removed = 0;
      for (const entry of entries) {
        const full = path.join(basePath, entry);
        const stat = fs.statSync(full);
        if (stat.isFile() && stat.mtimeMs < cutoff) {
          try {
            fs.unlinkSync(full);
            removed++;
          } catch (e) {
            // ignore
          }
        }
      }
      logger.info(`[JobQueue::cleanup.exports] Eliminados ${removed} archivos antiguos (> ${days} dÃ­as)`);
    });

    // Limpieza de gráficas PNG antiguas
    this.registerHandler('cleanup.charts', async (job) => {
      const days = Number(job.payload?.days || 7);
      const deleted = await chartCaptureService.cleanupOldCharts(days);
      logger.info(`[JobQueue::cleanup.charts] Eliminadas ${deleted} capturas PNG antiguas (> ${days} días)`);
    });

    // ActualizaciÃ³n diaria de precios basada en cotizaciÃ³n/metales
    this.registerHandler('prices.update.daily', async (job) => {
      // Normalizar payload: puede venir como string desde SQLite
      let payload: any = job.payload || {};
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch (e) {
          logger.warn('[JobQueue::prices.update.daily] No se pudo parsear payload JSON', { error: (e as any)?.message });
          payload = {};
        }
      }
      const rates: Record<string, number> = payload.rates || {
        'Oro Amarillo': 3000,
        'Oro Blanco': 3000,
        'Oro Rosa': 3000,
        'Plata 925': 80,
        'Acero Inoxidable': 25,
      };
      const markupMultiplier = typeof payload.markupMultiplier === 'number' ? payload.markupMultiplier : 1.25; // +25%
      const onlyCategory: string | undefined = payload.category || undefined;
      const onlyMetals: string[] | undefined = payload.metals || undefined;

      const purityFactor = (purity?: string | null): number => {
        if (!purity) return 1.0;
        const p = String(purity).toLowerCase();
        if (p.includes('18k')) return 0.75;
        if (p.includes('14k')) return 0.5833;
        if (p.includes('24k')) return 1.0;
        if (p.includes('925')) return 0.925;
        return 1.0;
      };

      const where: any = { isActive: true };
      if (onlyCategory) where.category = onlyCategory;
      if (onlyMetals && onlyMetals.length) where.metal = { [Op.in]: onlyMetals };

      const products = await Product.findAll({ where });
      let updated = 0;
      const changes: Array<{ id: string; name: string; metal?: string | null; grams?: number | null; oldPrice: number; newPrice: number }>= [];

      for (const p of products) {
        const metalName = (p as any).metal as string | null;
        const grams = Number((p as any).grams || 0);
        const salePrice = Number((p as any).salePrice || 0);
        if (!metalName || !rates[metalName]) continue;
        if (!grams || grams <= 0) continue;

        const rate = Number(rates[metalName]);
        const base = grams * rate * purityFactor((p as any).metalPurity as string | null);
        const newPrice = Math.round(base * markupMultiplier);

        if (newPrice > 0 && newPrice !== salePrice) {
          await (p as any).update({ salePrice: newPrice });
          updated++;
          const change = { id: (p as any).id, name: (p as any).name, metal: metalName, grams, oldPrice: salePrice, newPrice };
          changes.push(change);
          // AuditorÃ­a por producto actualizado
          try {
            const actorInfo = payload?.actor ? { id: payload.actor.id, role: payload.actor.role } : null;
            await AuditTrailService.log({
              operation: 'price.update.daily',
              entityType: 'product',
              entityId: (p as any).id,
              result: 'success',
              message: `Precio actualizado: ${salePrice} -> ${newPrice}`,
              details: { metal: metalName, grams, rate, purity: (p as any).metalPurity || null, markupMultiplier },
              actor: actorInfo,
            });
          } catch (e) {
            logger.warn('[JobQueue::prices.update.daily] AuditorÃ­a fallida', { error: (e as any)?.message });
          }
        }
      }

      const exportBase = process.env.EXPORTS_BASE_PATH || path.join(process.cwd(), 'exports');
      if (!fs.existsSync(exportBase)) fs.mkdirSync(exportBase, { recursive: true });
      const file = path.join(exportBase, `prices-update-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      fs.writeFileSync(file, JSON.stringify({ updated, changes, appliedRates: rates }, null, 2), 'utf8');

      // Adjuntar resultado al payload del job usando payload normalizado
      await job.update({ payload: { ...payload, result: { updated, file } } });
      logger.info(`[JobQueue::prices.update.daily] Actualizados ${updated} productos. Detalle: ${file}`);

      // AuditorÃ­a de resumen
      try {
        const actorInfo = payload?.actor ? { id: payload.actor.id, role: payload.actor.role } : null;
        await AuditTrailService.log({
          operation: 'price.update.daily.summary',
          entityType: 'system',
          result: 'success',
          message: `ActualizaciÃ³n diaria de precios aplicada a ${updated} productos`,
          details: { updated, exportFile: file, appliedRates: rates, filters: { category: onlyCategory, metals: onlyMetals } },
          actor: actorInfo,
        });
      } catch (e) {
        logger.warn('[JobQueue::prices.update.daily] AuditorÃ­a de resumen fallida', { error: (e as any)?.message });
      }
    });

    // ImpresiÃ³n de etiquetas en lote
    this.registerHandler('labels.print.bulk', async (job) => {
      const payload = job.payload || {};
      const category: string | undefined = payload.category || undefined;
      const limit = Number(payload.limit || 20);
      const where: any = { isActive: true };
      if (category) where.category = category;

      const products = await Product.findAll({ where, order: [['updatedAt', 'DESC']], limit });

      const items = products.map((p: any) => ({
        codigo: p.barcode || p.code || BarcodeService.generateProductCode(String(p.category || 'OTROS')),
        nombre: p.name,
        categoria: p.category || 'OTROS',
        precio: Number(p.salePrice || 0),
        metal: p.metal,
        peso: p.grams ? Number(p.grams) : undefined,
      }));

      const paths = await BarcodeService.generateBulkBarcodes(items);

      const exportBase = process.env.EXPORTS_BASE_PATH || path.join(process.cwd(), 'exports');
      if (!fs.existsSync(exportBase)) fs.mkdirSync(exportBase, { recursive: true });
      const file = path.join(exportBase, `labels-bulk-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      fs.writeFileSync(file, JSON.stringify({ count: paths.length, files: paths }, null, 2), 'utf8');

      await job.update({ payload: { ...job.payload, result: { count: paths.length, file } } });
      logger.info(`[JobQueue::labels.print.bulk] Generados ${paths.length} archivos de etiquetas/cÃ³digos. Detalle: ${file}`);
    });

    // Reporte de cierre diario (PDF)
    this.registerHandler('closing.daily.report', async (job) => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      const income = await ReportService.generateIncomeStatement(start, end);
      const cash = await ReportService.generateCashFlow(start, end);
      const movementsReport = await ReportService.generateMovementsReport(start, end);

      const exportBase = process.env.EXPORTS_BASE_PATH || path.join(process.cwd(), 'exports');
      if (!fs.existsSync(exportBase)) fs.mkdirSync(exportBase, { recursive: true });
      const filePath = path.join(exportBase, `cierre-diario-${start.toISOString().slice(0,10)}.pdf`);

      const doc = new PDFDocument({ margin: 40 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Encabezado
      doc.fontSize(18).text('Reporte de Cierre Diario', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Fecha: ${start.toLocaleDateString()}`);
      doc.moveDown();

      // Resumen ingresos
      doc.fontSize(14).text('Estado de Resultados');
      doc.fontSize(11).text(`Ventas totales: ${income.revenue.totalSales.toLocaleString()}`);
      doc.text(`Transacciones: ${income.revenue.salesCount}`);
      doc.text(`Costo de ventas: ${income.costs.costOfGoodsSold.toLocaleString()}`);
      doc.text(`Utilidad bruta: ${income.costs.grossProfit.toLocaleString()}`);
      doc.text(`Margen bruto: ${(income.costs.grossMargin * 100).toFixed(2)}%`);
      doc.text(`Utilidad neta: ${income.summary.netIncome.toLocaleString()}`);
      doc.text(`Margen neto: ${(income.summary.profitMargin * 100).toFixed(2)}%`);
      doc.moveDown();

      // Flujo de caja
      doc.fontSize(14).text('Flujo de Caja');
      doc.fontSize(11).text(`Ingresos efectivo: ${cash.inflows.salesCash.toLocaleString()}`);
      doc.text(`Ingresos tarjeta: ${cash.inflows.salesCard.toLocaleString()}`);
      doc.text(`Ingresos transferencia: ${cash.inflows.salesTransfer.toLocaleString()}`);
      doc.text(`Total ingresos: ${cash.inflows.total.toLocaleString()}`);
      doc.text(`Total egresos: ${cash.outflows.total.toLocaleString()}`);
      doc.text(`Flujo neto: ${cash.netCashFlow.toLocaleString()}`);
      doc.moveDown();

      // Movimientos
      doc.fontSize(14).text('Movimientos del DÃ­a');
      doc.fontSize(11);
      const maxItems = 20;
      const items = (movementsReport?.movements || []).slice(0, maxItems);
      for (const it of items) {
        doc.text(`â€¢ ${it.type?.toUpperCase() || 'venta'} #${it.id} â€” ${new Date(it.date).toLocaleString()} â€” ${Number(it.amount || 0).toLocaleString()}`);
      }
      if ((movementsReport?.movements || []).length > maxItems) {
        doc.text(`â€¦ y ${(movementsReport?.movements || []).length - maxItems} mÃ¡s`);
      }
      doc.moveDown();

      // Pie
      doc.text('Generado automÃ¡ticamente por Sistema POS', { align: 'right' });
      doc.end();

      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', (err) => reject(err));
      });

      await job.update({ payload: { ...job.payload, result: { file: filePath } } });
      logger.info(`[JobQueue::closing.daily.report] PDF generado en ${filePath}`);
    });

    // Generación de tickets en lote
    this.registerHandler('tickets.generate.bulk', async (job) => {
      const payload = job.payload || {};
      const saleIds: string[] = Array.isArray(payload.saleIds) ? payload.saleIds : [];
      const options = (payload.options || {}) as {
        locale?: string;
        template?: { compact?: boolean; includeLogo?: boolean; showCareTips?: boolean };
      };

      // Si no hay saleIds explÃ­citos, intentar seleccionar por rango de fechas
      let targets: string[] = saleIds;
      if (!targets.length) {
        const { startDate, endDate, limit = 50 } = payload;
        const where: any = {};
        if (startDate || endDate) {
          const start = startDate ? new Date(startDate) : new Date(0);
          const end = endDate ? new Date(endDate) : new Date();
          where.createdAt = { [Op.between]: [start, end] };
        }
        const rows = await (await import('../models/Sale')).Sale.findAll({ where, attributes: ['id'], order: [['createdAt', 'DESC']], limit: Number(limit) });
        targets = rows.map(r => (r as any).id);
      }

      let success = 0;
      const errors: Array<{ saleId: string; error: string }> = [];
      for (const id of targets) {
        try {
          await TicketService.saveTicketToFile(id, options);
          success++;
        } catch (err: any) {
          errors.push({ saleId: id, error: err?.message || String(err) });
        }
      }

      await job.update({ payload: { ...payload, result: { processed: targets.length, success, failed: errors.length, errors } } });
      logger.info(`[JobQueue::tickets.generate.bulk] Generados ${success}/${targets.length} tickets`);
    });

    // Impresión de etiquetas de activos por lote
    this.registerHandler('labels.assets.bulk', async (job) => {
      // Payload: { productId?: string, status?: string, limit?: number }
      let payload: any = job.payload || {};
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch { payload = {}; }
      }
      const productId: string | undefined = payload.productId || undefined;
      const status: string | undefined = payload.status || undefined;
      const limit: number | undefined = typeof payload.limit === 'number' ? payload.limit : undefined;

      const where: any = {};
      if (productId) where.productId = productId;
      if (status) where.status = status;
      const assets = await ProductAsset.findAll({ where, order: [['createdAt','DESC']], limit: limit || undefined });

      const files: string[] = [];
      for (const a of assets) {
        const prod = await Product.findByPk((a as any).productId);
        if (!prod) continue;
        const code = (prod as any).code || '';
        const productData = {
          codigo: code,
          nombre: (prod as any).name,
          categoria: (prod as any).category,
          precio: Number((prod as any).salePrice || 0),
          metal: (prod as any).metal,
          peso: Number((prod as any).grams || 0),
        };
        const assetData = {
          serial: (a as any).serial,
          hallmark: (a as any).hallmark,
        };
        try {
          const labelPath = await BarcodeService.saveAssetLabel(productData, assetData);
          files.push(labelPath);
        } catch {}
      }

      const exportBase = ExportsIntegrityService.getExportsBasePath();
      if (!fs.existsSync(exportBase)) fs.mkdirSync(exportBase, { recursive: true });
      const summaryFile = path.join(exportBase, `labels-assets-bulk-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      fs.writeFileSync(summaryFile, JSON.stringify({ count: files.length, files }, null, 2), 'utf8');

      await job.update({ payload: { ...payload, result: { count: files.length, files, manifest: summaryFile } } });

      try {
        await AuditTrailService.log({
          operation: 'labels.assets.bulk',
          entityType: productId ? 'product' : undefined,
          entityId: productId,
          result: 'success',
          message: `Generadas ${files.length} etiquetas de activos`,
          details: { productId, status, limit, manifest: summaryFile },
          actor: payload?.actor || null,
        });
      } catch {}
    });
  }
}

