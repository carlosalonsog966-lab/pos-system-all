import { Router } from 'express';
import { BarcodeController } from '../controllers/barcodeController';

const router = Router();

// Escanear código de barras
router.get('/scan/:code', BarcodeController.scanBarcode);

// Obtener todos los códigos de barras
router.get('/', BarcodeController.getAllBarcodes);

// Generar nuevo código de barras
router.post('/generate', BarcodeController.generateBarcode);

// Activar/desactivar código de barras
router.patch('/:id/toggle-status', BarcodeController.toggleBarcodeStatus);

// Obtener códigos para impresión
router.get('/printable', BarcodeController.getPrintableBarcodes);

export default router;