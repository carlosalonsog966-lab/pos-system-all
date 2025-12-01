import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { EventLogService } from '../services/eventLogService';
import { SettingsController } from '../controllers/settingsController';
import { validateBody } from '../middleware/validation';
import { authenticateToken, requireManagerOrAdmin, requireAnyRole } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// NOTA: Las rutas públicas deben declararse antes del middleware de autenticación

// Esquemas para validación
const categorySchema = z.object({
  category: z.enum(['company', 'pos', 'notifications', 'security', 'backup', 'theme', 'advanced']),
});

const settingsUpdateSchema = z.object({
  // Configuraciones de la empresa
  companyName: z.string().min(1).max(100).optional(),
  companyAddress: z.string().max(500).optional(),
  companyPhone: z.string().max(20).optional(),
  companyEmail: z.string().email().optional(),
  companyTaxId: z.string().max(50).optional(),
  companyLogo: z.string().optional(),
  
  // Configuraciones del POS
  currency: z.string().length(3).optional(),
  taxRate: z.number().min(0).max(1).optional(),
  receiptFooter: z.string().max(500).optional(),
  autoPrint: z.boolean().optional(),
  printerName: z.string().max(100).optional(),
  
  // Configuraciones de notificaciones
  lowStockAlert: z.boolean().optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  dailyReports: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  
  // Configuraciones de seguridad
  sessionTimeout: z.number().int().min(5).max(480).optional(),
  maxLoginAttempts: z.number().int().min(3).max(10).optional(),
  requireTwoFactor: z.boolean().optional(),
  passwordExpiry: z.number().int().min(30).max(365).optional(),
  
  // Configuraciones de respaldo
  autoBackup: z.boolean().optional(),
  backupFrequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  backupLocation: z.string().max(255).optional(),
  cloudBackup: z.boolean().optional(),
  
  // Configuraciones de tema
  theme: z.enum(['light', 'dark', 'auto']).optional(),
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  
  // Configuraciones avanzadas
  barcodeFormat: z.string().max(20).optional(),
  enableInventoryTracking: z.boolean().optional(),
  enableCustomerManagement: z.boolean().optional(),
}).strict();

const categoryUpdateSchema = z.object({
  // Configuraciones de la empresa
  companyName: z.string().min(1).max(100).optional(),
  companyAddress: z.string().max(500).optional(),
  companyPhone: z.string().max(20).optional(),
  companyEmail: z.string().email().optional(),
  companyTaxId: z.string().max(50).optional(),
  companyLogo: z.string().optional(),
  
  // Configuraciones del POS
  currency: z.string().length(3).optional(),
  taxRate: z.number().min(0).max(1).optional(),
  receiptFooter: z.string().max(500).optional(),
  autoPrint: z.boolean().optional(),
  printerName: z.string().max(100).optional(),
  
  // Configuraciones de notificaciones
  lowStockAlert: z.boolean().optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  dailyReports: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  
  // Configuraciones de seguridad
  sessionTimeout: z.number().int().min(5).max(480).optional(),
  maxLoginAttempts: z.number().int().min(3).max(10).optional(),
  requireTwoFactor: z.boolean().optional(),
  passwordExpiry: z.number().int().min(30).max(365).optional(),
  
  // Configuraciones de respaldo
  autoBackup: z.boolean().optional(),
  backupFrequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  backupLocation: z.string().max(255).optional(),
  cloudBackup: z.boolean().optional(),
  
  // Configuraciones de tema
  theme: z.enum(['light', 'dark', 'auto']).optional(),
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  
  // Configuraciones avanzadas
  barcodeFormat: z.string().max(20).optional(),
  enableInventoryTracking: z.boolean().optional(),
  enableCustomerManagement: z.boolean().optional(),
});

const importSchema = z.object({
  exportDate: z.string().optional(),
  version: z.string().optional(),
  settings: z.object({}).passthrough(),
});

// Rutas públicas (solo lectura para configuraciones básicas)
router.get('/public', SettingsController.getPublicSettings);
router.get(
  '/system-info',
  rateLimit({
    windowMs: 60_000,
    max: 60,
    handler: async (req, res) => {
      await EventLogService.record({
        type: 'RATE_LIMIT',
        severity: 'warning',
        message: 'Rate limit activado en /api/settings/system-info',
        context: 'system-info',
        details: { ip: (req as any).ip },
      });
      res.status(429).json({ error: 'Demasiadas solicitudes en /api/settings/system-info' });
    },
  }),
  async (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    next();
  },
  SettingsController.getSystemInfo
);

// El resto de rutas requieren autenticación
router.use(authenticateToken);

// Rutas de consulta (todos los roles autenticados)
router.get('/', requireAnyRole, SettingsController.getSettings);
router.get('/validate', requireAnyRole, SettingsController.validateSettings);
router.get('/category/:category', requireAnyRole, SettingsController.getSettingsByCategory);

// Rutas de modificación (solo manager y admin)
router.put('/', requireManagerOrAdmin, validateBody(settingsUpdateSchema), SettingsController.updateSettings);
router.put('/category/:category', requireManagerOrAdmin, validateBody(categoryUpdateSchema), SettingsController.updateSettingsByCategory);
router.post('/reset', requireManagerOrAdmin, SettingsController.resetSettings);

// Rutas de importación/exportación (solo admin)
router.get('/export', requireManagerOrAdmin, SettingsController.exportSettings);
router.post('/import', requireManagerOrAdmin, validateBody(importSchema), SettingsController.importSettings);

// Rutas de prueba (solo manager y admin)
router.post('/test-printer', requireManagerOrAdmin, SettingsController.testPrinter);

export default router;
