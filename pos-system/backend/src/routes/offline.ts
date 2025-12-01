import { Router } from 'express';
import { OfflineController, upload } from '../controllers/offlineController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Aplicar autenticación a todas las rutas
router.use(authenticateToken);

// Estado del sistema
router.get('/status', OfflineController.checkSystemStatus);
router.get('/stats', OfflineController.getStats);

// Gestión de productos
router.post('/products', OfflineController.saveProduct);
router.get('/products', OfflineController.getAllProducts);
router.get('/products/category/:category', OfflineController.getProductsByCategory);
router.get('/products/search', OfflineController.searchProducts);

// Importación desde Excel
router.post('/import/excel', upload.single('excel'), OfflineController.importFromExcel);
router.get('/template/generate', OfflineController.generateExcelTemplate);
router.get('/template/download', OfflineController.downloadTemplate);

// Generación de códigos de barras y etiquetas
router.post('/barcode/generate', OfflineController.generateBarcode);
router.post('/label/generate', OfflineController.generateLabel);
router.post('/label/asset', OfflineController.generateAssetLabel);
router.post('/label/assets/bulk', OfflineController.generateAssetLabelsBulk);

// Rutas para exportación de datos
router.get('/export/:type', authenticateToken, OfflineController.exportData);

// Rutas para gestión de respaldos
router.post('/backup/create', authenticateToken, OfflineController.createBackup);
router.get('/backup/history', authenticateToken, OfflineController.getBackupHistory);
router.post('/backup/restore', authenticateToken, OfflineController.restoreBackup);
router.get('/backup/config', authenticateToken, OfflineController.getBackupConfig);
router.put('/backup/config', authenticateToken, OfflineController.updateBackupConfig);

// Rutas para gestión de archivos
router.get('/files/:directory', authenticateToken, OfflineController.listFiles);
router.get('/stats/detailed', authenticateToken, OfflineController.getDetailedStats);
// Prueba de almacenamiento: lectura/escritura en ruta de datos
router.post('/test-storage', authenticateToken, OfflineController.testStorage);

export default router;
