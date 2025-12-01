import { Request, Response } from 'express';
import { TicketService } from '../services/ticketService';
import { AuditTrailService } from '../services/AuditTrailService';
import path from 'path';
import { sha256OfBuffer } from '../utils/hash';
import { ExportsIntegrityService } from '../services/ExportsIntegrityService';
import { applyIntegrityHeaders } from '../utils/integrityHeaders';

export class TicketController {
  /**
   * Genera y descarga un ticket PDF para una venta específica
   */
  static async generateTicket(req: Request, res: Response): Promise<void> {
    try {
      const { saleId } = req.params;

      if (!saleId) {
        res.status(400).json({
          success: false,
          message: 'ID de venta requerido'
        });
        return;
      }

      // Leer opciones desde query
      const { locale, compact, includeLogo, showCareTips } = req.query as Record<string, string>;
      const options = {
        locale: typeof locale === 'string' ? locale : undefined,
        template: {
          compact: compact === 'true',
          includeLogo: includeLogo !== 'false',
          showCareTips: showCareTips === 'true'
        }
      };

      // Generar PDF del ticket con opciones
      const pdfBuffer = await TicketService.generateTicketPDF(saleId, options);

      // Auditoría de generación de ticket
      try {
        const actorId = (req as any)?.user?.id;
        const actorRole = (req as any)?.user?.role;
        await AuditTrailService.log({
          operation: 'ticket.generate',
          entityType: 'sale',
          entityId: saleId,
          actor: actorId ? { id: actorId, role: actorRole } : undefined,
          result: 'success',
          message: 'Generación de ticket PDF',
          details: {
            bytes: pdfBuffer.length,
            filename: `ticket-${saleId}.pdf`,
            contentType: 'application/pdf',
            disposition: 'attachment'
          }
        });
      } catch (auditError) {
        // No bloquear respuesta si auditoría falla
      }

      // Configurar headers para descarga
      const filename = `ticket-${saleId}.pdf`;
      const checksum = sha256OfBuffer(pdfBuffer);
      const manifest = ExportsIntegrityService.readManifest();
      const expected = manifest.entries.find(e => e.filename === filename)?.sha256 || '';
      const match = expected ? (expected === checksum ? 'true' : 'false') : '';
      applyIntegrityHeaders(res, { filename, contentType: 'application/pdf', body: pdfBuffer, setContentLength: true });
      // Enviar el PDF
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generando ticket:', error);
      // Auditoría de error
      try {
        const actorId = (req as any)?.user?.id;
        const actorRole = (req as any)?.user?.role;
        await AuditTrailService.log({
          operation: 'ticket.generate',
          entityType: 'sale',
          entityId: req.params?.saleId,
          actor: actorId ? { id: actorId, role: actorRole } : undefined,
          result: 'failure',
          message: 'Fallo generando ticket PDF',
          details: { error: error instanceof Error ? error.message : 'Error desconocido' }
        });
      } catch {}
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error interno del servidor'
      });
    }
  }

  /**
   * Genera y guarda un ticket PDF en el servidor
   */
  static async saveTicket(req: Request, res: Response): Promise<void> {
    try {
      const { saleId } = req.params;

      if (!saleId) {
        res.status(400).json({
          success: false,
          message: 'ID de venta requerido'
        });
        return;
      }

      // Leer opciones desde query
      const { locale, compact, includeLogo, showCareTips } = req.query as Record<string, string>;
      const options = {
        locale: typeof locale === 'string' ? locale : undefined,
        template: {
          compact: compact === 'true',
          includeLogo: includeLogo !== 'false',
          showCareTips: showCareTips === 'true'
        }
      };

      // Guardar ticket en el servidor
      const filename = await TicketService.saveTicketToFile(saleId, options);

      // Auditoría de guardado de ticket
      try {
        const actorId = (req as any)?.user?.id;
        const actorRole = (req as any)?.user?.role;
        await AuditTrailService.log({
          operation: 'ticket.save',
          entityType: 'sale',
          entityId: saleId,
          actor: actorId ? { id: actorId, role: actorRole } : undefined,
          result: 'success',
          message: 'Ticket PDF guardado en servidor',
          details: {
            filename,
            path: `/exports/tickets/${filename}`
          }
        });
      } catch {}

      res.json({
        success: true,
        message: 'Ticket generado exitosamente',
        data: {
          filename,
          path: `/exports/tickets/${filename}`
        }
      });
    } catch (error) {
      console.error('Error guardando ticket:', error);
      // Auditoría de error
      try {
        const actorId = (req as any)?.user?.id;
        const actorRole = (req as any)?.user?.role;
        await AuditTrailService.log({
          operation: 'ticket.save',
          entityType: 'sale',
          entityId: req.params?.saleId,
          actor: actorId ? { id: actorId, role: actorRole } : undefined,
          result: 'failure',
          message: 'Fallo guardando ticket PDF',
          details: { error: error instanceof Error ? error.message : 'Error desconocido' }
        });
      } catch {}
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error interno del servidor'
      });
    }
  }

  /**
   * Genera un ticket PDF y lo devuelve como base64 para vista previa
   */
  static async previewTicket(req: Request, res: Response): Promise<void> {
    try {
      const { saleId } = req.params;

      if (!saleId) {
        res.status(400).json({
          success: false,
          message: 'ID de venta requerido'
        });
        return;
      }

      // Leer opciones desde query
      const { locale, compact, includeLogo, showCareTips } = req.query as Record<string, string>;
      const options = {
        locale: typeof locale === 'string' ? locale : undefined,
        template: {
          compact: compact === 'true',
          includeLogo: includeLogo !== 'false',
          showCareTips: showCareTips === 'true'
        }
      };

      // Generar PDF del ticket
      const pdfBuffer = await TicketService.generateTicketPDF(saleId, options);

      // Convertir a base64 para vista previa
      const base64PDF = pdfBuffer.toString('base64');

      // Auditoría de vista previa
      try {
        const actorId = (req as any)?.user?.id;
        const actorRole = (req as any)?.user?.role;
        await AuditTrailService.log({
          operation: 'ticket.preview',
          entityType: 'sale',
          entityId: saleId,
          actor: actorId ? { id: actorId, role: actorRole } : undefined,
          result: 'success',
          message: 'Vista previa de ticket PDF generada',
          details: { bytes: pdfBuffer.length }
        });
      } catch {}

      res.json({
        success: true,
        message: 'Vista previa del ticket generada',
        data: {
          pdf: base64PDF,
          mimeType: 'application/pdf'
        }
      });
    } catch (error) {
      console.error('Error generando vista previa del ticket:', error);
      // Auditoría de error
      try {
        const actorId = (req as any)?.user?.id;
        const actorRole = (req as any)?.user?.role;
        await AuditTrailService.log({
          operation: 'ticket.preview',
          entityType: 'sale',
          entityId: req.params?.saleId,
          actor: actorId ? { id: actorId, role: actorRole } : undefined,
          result: 'failure',
          message: 'Fallo generando vista previa de ticket',
          details: { error: error instanceof Error ? error.message : 'Error desconocido' }
        });
      } catch {}
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtiene la lista de tickets generados
   */
  static async getTicketsList(req: Request, res: Response): Promise<void> {
    try {
      const fs = require('fs/promises');
      const ticketsDir = path.join(process.cwd(), 'exports', 'tickets');

      try {
        const files = await fs.readdir(ticketsDir);
        const ticketFiles = files
          .filter((file: string) => file.endsWith('.pdf'))
          .map((file: string) => {
            const stats = require('fs').statSync(path.join(ticketsDir, file));
            return {
              filename: file,
              path: `/exports/tickets/${file}`,
              size: stats.size,
              created: stats.birthtime,
              modified: stats.mtime
            };
          })
          .sort((a: any, b: any) => new Date(b.created).getTime() - new Date(a.created).getTime());

        // Auditoría de listado
        try {
          const actorId = (req as any)?.user?.id;
          const actorRole = (req as any)?.user?.role;
          await AuditTrailService.log({
            operation: 'ticket.list',
            entityType: 'ticket',
            result: 'success',
            actor: actorId ? { id: actorId, role: actorRole } : undefined,
            message: 'Lista de tickets generada',
            details: { count: ticketFiles.length }
          });
        } catch {}

        res.json({
          success: true,
          message: 'Lista de tickets obtenida exitosamente',
          data: ticketFiles
        });
      } catch (dirError) {
        // Si el directorio no existe, devolver lista vacía
        try {
          const actorId = (req as any)?.user?.id;
          const actorRole = (req as any)?.user?.role;
          await AuditTrailService.log({
            operation: 'ticket.list',
            entityType: 'ticket',
            result: 'success',
            actor: actorId ? { id: actorId, role: actorRole } : undefined,
            message: 'Lista de tickets vacía (directorio no encontrado)',
            details: { count: 0 }
          });
        } catch {}

        res.json({
          success: true,
          message: 'No hay tickets generados',
          data: []
        });
      }
    } catch (error) {
      console.error('Error obteniendo lista de tickets:', error);
      // Auditoría de error
      try {
        const actorId = (req as any)?.user?.id;
        const actorRole = (req as any)?.user?.role;
        await AuditTrailService.log({
          operation: 'ticket.list',
          entityType: 'ticket',
          result: 'failure',
          actor: actorId ? { id: actorId, role: actorRole } : undefined,
          message: 'Fallo obteniendo lista de tickets',
          details: { error: error instanceof Error ? error.message : 'Error desconocido' }
        });
      } catch {}
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error interno del servidor'
      });
    }
  }
}
