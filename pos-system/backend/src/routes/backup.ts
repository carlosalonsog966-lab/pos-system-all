import { Router } from 'express';
import { BackupService } from '../services/backupService';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Aplicar autenticación a todas las rutas
router.use(authenticateToken);

/**
 * @route GET /api/backup
 * @desc Obtener lista de respaldos
 * @access Admin
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const backups = await BackupService.listBackups();
    res.json({
      success: true,
      data: backups
    });
  } catch (error) {
    console.error('Error obteniendo respaldos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * @route GET /api/backup/stats
 * @desc Obtener estadísticas de respaldos
 * @access Admin
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await BackupService.getBackupStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas de respaldos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * @route POST /api/backup
 * @desc Crear respaldo manual
 * @access Admin
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { description } = req.body;
    
    const result = await BackupService.createBackup('manual', description);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Respaldo creado exitosamente',
        data: result.backup
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Error creando respaldo'
      });
    }
  } catch (error) {
    console.error('Error creando respaldo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * @route POST /api/backup/:id/restore
 * @desc Restaurar desde un respaldo
 * @access Admin
 */
router.post('/:id/restore', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await BackupService.restoreBackup(id);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Base de datos restaurada exitosamente'
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Error restaurando respaldo'
      });
    }
  } catch (error) {
    console.error('Error restaurando respaldo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * @route DELETE /api/backup/:id
 * @desc Eliminar un respaldo
 * @access Admin
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await BackupService.deleteBackup(id);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Respaldo eliminado exitosamente'
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Error eliminando respaldo'
      });
    }
  } catch (error) {
    console.error('Error eliminando respaldo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * @route POST /api/backup/setup
 * @desc Reconfigurar respaldos automáticos
 * @access Admin
 */
router.post('/setup', requireAdmin, async (req, res) => {
  try {
    await BackupService.setupAutomaticBackups();
    
    res.json({
      success: true,
      message: 'Respaldos automáticos reconfigurados exitosamente'
    });
  } catch (error) {
    console.error('Error configurando respaldos automáticos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

export default router;