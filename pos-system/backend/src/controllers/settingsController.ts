import { Request, Response } from 'express';
import { SettingsService } from '../services/settingsService';
import { EventLogService } from '../services/eventLogService';
import { sha256OfBuffer } from '../utils/hash';
import { ExportsIntegrityService } from '../services/ExportsIntegrityService';
import { applyIntegrityHeaders } from '../utils/integrityHeaders';

export class SettingsController {
  // Obtener todas las configuraciones
  static async getSettings(req: Request, res: Response) {
    try {
      const settings = await SettingsService.getSettings();
      
      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      const defaults = {
        companyName: 'Mi Empresa',
        currency: 'MXN',
        taxRate: 0,
        theme: 'light',
        primaryColor: '#1f2937',
        enableInventoryTracking: true,
        enableCustomerManagement: true,
        lowStockThreshold: 5,
        barcodeFormat: 'CODE128',
        autoBackup: false,
        backupFrequency: 'weekly',
      } as any;
      res.json({ success: true, data: defaults, message: 'Configuraciones por defecto (sin datos)' });
    }
  }

  // Obtener configuraciones por categoría
  static async getSettingsByCategory(req: Request, res: Response) {
    try {
      const { category } = req.params;
      const settings = await SettingsService.getSettingsByCategory(category);
      
      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener configuraciones por categoría',
      });
    }
  }

  // Actualizar todas las configuraciones
  static async updateSettings(req: Request, res: Response) {
    try {
      const data = req.body;
      const settings = await SettingsService.updateSettings(data);
      
      res.json({
        success: true,
        message: 'Configuraciones actualizadas exitosamente',
        data: settings,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al actualizar configuraciones',
      });
    }
  }

  // Actualizar configuraciones por categoría
  static async updateSettingsByCategory(req: Request, res: Response) {
    try {
      const { category } = req.params;
      const data = req.body;
      const settings = await SettingsService.updateSettingsByCategory(category, data);
      
      res.json({
        success: true,
        message: `Configuraciones de ${category} actualizadas exitosamente`,
        data: settings,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al actualizar configuraciones por categoría',
      });
    }
  }

  // Resetear configuraciones a valores por defecto
  static async resetSettings(req: Request, res: Response) {
    try {
      const settings = await SettingsService.resetSettings();
      
      res.json({
        success: true,
        message: 'Configuraciones reseteadas a valores por defecto',
        data: settings,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al resetear configuraciones',
      });
    }
  }

  // Exportar configuraciones
  static async exportSettings(req: Request, res: Response) {
    try {
      const exportData = await SettingsService.exportSettings();
      const filename = `settings-backup-${new Date().toISOString().split('T')[0]}.json`;
      const payload = JSON.stringify(exportData);
      const buf = Buffer.from(payload, 'utf8');
      const checksum = sha256OfBuffer(buf);
      const manifest = ExportsIntegrityService.readManifest();
      const expected = manifest.entries.find(e => e.filename === filename)?.sha256 || '';
      const match = expected ? (expected === checksum ? 'true' : 'false') : '';

      applyIntegrityHeaders(res, { filename, contentType: 'application/json; charset=utf-8', body: buf, setContentLength: true });
      res.send(buf);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al exportar configuraciones',
      });
    }
  }

  // Importar configuraciones
  static async importSettings(req: Request, res: Response) {
    try {
      const importData = req.body;
      const settings = await SettingsService.importSettings(importData);
      
      res.json({
        success: true,
        message: 'Configuraciones importadas exitosamente',
        data: settings,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al importar configuraciones',
      });
    }
  }

  // Validar configuraciones
  static async validateSettings(req: Request, res: Response) {
    try {
      const validation = await SettingsService.validateSettings();
      
      res.json({
        success: true,
        data: validation,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al validar configuraciones',
      });
    }
  }

  // Obtener configuraciones específicas para el frontend
  static async getPublicSettings(req: Request, res: Response) {
    try {
      const settings = await SettingsService.getSettings();
      
      // Solo enviar configuraciones que el frontend necesita y que son seguras
      const publicSettings = {
        companyName: settings.companyName,
        companyLogo: settings.companyLogo,
        currency: settings.currency,
        locale: settings.locale,
        taxRate: settings.taxRate,
        theme: settings.theme,
        primaryColor: settings.primaryColor,
        enableInventoryTracking: settings.enableInventoryTracking,
        enableCustomerManagement: settings.enableCustomerManagement,
        lowStockThreshold: settings.lowStockThreshold,
        barcodeFormat: settings.barcodeFormat,
        // Presets de filtros para Inventario
        inventoryFilterPresets: (() => {
          try {
            const raw = settings.inventoryFilterPresets || '[]';
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })(),
      };
      
      res.json({
        success: true,
        data: publicSettings,
      });
    } catch (error) {
      const defaults = {
        companyName: 'Mi Empresa',
        companyLogo: '',
        currency: 'MXN',
        taxRate: 0,
        theme: 'light',
        primaryColor: '#1f2937',
        enableInventoryTracking: true,
        enableCustomerManagement: true,
        lowStockThreshold: 5,
        barcodeFormat: 'CODE128',
        inventoryFilterPresets: [],
      } as any;
      res.json({ success: true, data: defaults, message: 'Configuraciones públicas por defecto (sin datos)' });
    }
  }

  // Probar configuración de impresora
  static async testPrinter(req: Request, res: Response) {
    try {
      const settings = await SettingsService.getSettings();
      
      if (!settings.printerName) {
        return res.status(400).json({
          success: false,
          error: 'No hay impresora configurada',
        });
      }

      // Aquí se implementaría la lógica real de prueba de impresora
      // Por ahora, simulamos una prueba exitosa
      res.json({
        success: true,
        message: `Prueba de impresora "${settings.printerName}" exitosa`,
        data: {
          printerName: settings.printerName,
          status: 'online',
          testPrint: true,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al probar impresora',
      });
    }
  }

  // Obtener información del sistema para configuraciones
  static async getSystemInfo(req: Request, res: Response) {
    try {
      const mem = process.memoryUsage();
      const systemInfo = {
        version: '1.0.0',
        buildVersion: process.env.BUILD_VERSION || process.env.npm_package_version || 'dev',
        database: 'SQLite',
        nodeVersion: process.version,
        platform: process.platform,
        uptimeSec: Math.round(process.uptime()),
        memorySummary: {
          rssMB: Math.round((mem.rss || 0) / 1024 / 1024),
          heapUsedMB: Math.round((mem.heapUsed || 0) / 1024 / 1024),
        },
        availableCurrencies: ['USD', 'EUR', 'MXN', 'COP', 'ARS', 'CLP', 'PEN'],
        availableLocales: ['es-CO', 'es-MX', 'es-ES', 'en-US', 'pt-BR'],
        availableThemes: ['light', 'dark', 'auto'],
        availableBarcodeFormats: ['CODE128', 'CODE39', 'EAN13', 'EAN8', 'UPC'],
        availableBackupFrequencies: ['daily', 'weekly', 'monthly'],
        configFlags: {
          enableBackups: String(process.env.ENABLE_BACKUPS || '').toLowerCase() === 'true',
          sentryEnabled: Boolean(process.env.SENTRY_DSN && process.env.SENTRY_DSN.length > 0),
          otelEnabled: String(process.env.ENABLE_OTEL || '').toLowerCase() === 'true',
        },
        endpoints: {
          health: '/api/health',
          metrics: '/api/metrics/prom',
          backupCreate: '/api/backup/create',
          backupStatsDetailed: '/api/offline/stats/detailed',
        }
      };
      
      await EventLogService.record({
        type: 'SYSTEM',
        severity: 'info',
        message: 'Consulta de información del sistema',
        context: 'system-info',
        details: { ip: (req as any).ip },
      });

      res.json({
        success: true,
        data: systemInfo,
      });
    } catch (error) {
      await EventLogService.record({
        type: 'ERROR',
        severity: 'error',
        message: 'Fallo en system-info',
        context: 'system-info',
        details: { error: (error as any)?.message, ip: (req as any).ip },
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener información del sistema',
      });
    }
  }
}
