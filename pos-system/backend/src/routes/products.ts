import { Router } from 'express';
import { ProductController } from '../controllers/productController';
import { validateBody, validateQuery } from '../middleware/validation';
import { authenticateToken, requireManagerOrAdmin, requireAnyRole } from '../middleware/auth';
import { createProductSchema, updateProductSchema, productQuerySchema, bulkImportProductsSchema } from '../schemas/product';
import { productValidation, validateResults, sanitizeInput, validateStockAvailability } from '../middleware/validation';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ensureUploadsSubdir } from '../utils/uploads';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Esquemas para validación de parámetros
const uuidSchema = z.object({
  id: z.string().uuid('ID inválido'),
});

const codeSchema = z.object({
  code: z.string().min(1, 'Código requerido'),
});

const stockUpdateSchema = z.object({
  quantity: z.number().int().positive('La cantidad debe ser un número positivo'),
  operation: z.enum(['add', 'subtract']),
});

// Aplicar sanitización a todas las rutas
router.use(sanitizeInput);

// Rutas de consulta (todos los roles)
router.get('/', requireAnyRole, validateQuery(productQuerySchema), ProductController.getProducts);
router.get('/low-stock', requireAnyRole, ProductController.getLowStockProducts);
router.get('/by-code/:code', requireAnyRole, ProductController.getProductByCode);
router.get('/:id', requireAnyRole, ProductController.getProductById);

// Rutas de modificación (manager y admin)
router.post('/', requireManagerOrAdmin, [...productValidation, validateResults], ProductController.createProduct);
router.put('/:id', requireManagerOrAdmin, validateBody(updateProductSchema), ProductController.updateProduct);
router.delete('/:id', requireManagerOrAdmin, ProductController.deleteProduct);
router.patch('/:id/stock', requireManagerOrAdmin, validateBody(stockUpdateSchema), ProductController.updateStock);

// Importación masiva JSON de productos
router.post('/import', requireManagerOrAdmin, validateBody(bulkImportProductsSchema), ProductController.bulkImportProducts);

// ===== Subida de imagen de producto =====
const productImagesDir = ensureUploadsSubdir('products');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!fs.existsSync(productImagesDir)) {
        fs.mkdirSync(productImagesDir, { recursive: true });
      }
    } catch (err) {
      console.error('[UPLOAD] Error creando directorio de imágenes de productos:', err);
    }
    cb(null, productImagesDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    const productId = (req.params as any)?.id || 'unknown';
    const unique = `${productId}-${base}-${Date.now()}${ext}`;
    cb(null, unique);
  }
});

const imageFileFilter: multer.Options['fileFilter'] = (req, file, cb) => {
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Tipo de archivo no permitido. Use PNG, JPG, JPEG o WEBP'));
};

const upload = multer({ storage, fileFilter: imageFileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/:id/image', requireManagerOrAdmin, upload.single('image'), ProductController.uploadProductImage);
// Subida múltiple de imágenes (hasta 8)
router.post('/:id/images', requireManagerOrAdmin, upload.array('images', 8), ProductController.uploadProductImages);
// Listado de imágenes del producto
router.get('/:id/images', requireAnyRole, ProductController.listProductImages);
// Eliminar una imagen del producto
router.delete('/:id/images', requireManagerOrAdmin, ProductController.deleteProductImage);
// Guardar orden de imágenes
router.put('/:id/images/order', requireManagerOrAdmin, ProductController.saveProductImagesOrder);

export default router;
