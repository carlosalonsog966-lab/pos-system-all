import { Request, Response } from 'express';
import { sequelize } from '../db/config';
import { Product } from '../models/Product';
import { Op } from 'sequelize';
import { ProductService } from '../services/productService';
import { CreateProductInput, UpdateProductInput, ProductQueryInput, validateProductByCategory, getDefaultWarrantyByCategory } from '../schemas/product';
import path from 'path';
import { AuditTrailService } from '../services/AuditTrailService';

export class ProductController {
  static async createProduct(req: Request, res: Response) {
    try {
      const data: CreateProductInput = req.body;
      
      // Aplicar garantía por defecto si no se especifica
      if (!data.warrantyMonths && data.category) {
        data.warrantyMonths = getDefaultWarrantyByCategory(data.category);
      }
      
      // Validaciones específicas por categoría
      const categoryErrors = validateProductByCategory(data);
      if (categoryErrors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Errores de validación',
          details: categoryErrors,
        });
      }
      
      const result = await ProductService.createProduct(data);
      
      res.status(201).json({
        success: true,
        message: 'Producto creado exitosamente',
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al crear producto',
      });
    }
  }

  static async getProducts(req: Request, res: Response) {
    try {
      const query: ProductQueryInput = req.query;
      const result = await ProductService.getProducts(query);
      
      res.json({
        success: true,
        data: result.products,
        pagination: result.pagination,
      });
    } catch (error) {
      res.json({ success: true, data: [], pagination: { page: 1, limit: 0, total: 0, totalPages: 0 } });
    }
  }

  static async getProductById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await ProductService.getProductById(id);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Producto no encontrado',
      });
    }
  }

  static async getProductByCode(req: Request, res: Response) {
    try {
      const { code } = req.params;
      const result = await ProductService.getProductByCode(code);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Producto no encontrado',
      });
    }
  }

  static async updateProduct(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data: UpdateProductInput = req.body;
      
      // Validaciones específicas por categoría si se está actualizando la categoría
      if (data.category || Object.keys(data).some(key => ['ringSize', 'chainLengthCm', 'stoneType', 'stoneCarat', 'stoneColor', 'material', 'metal'].includes(key))) {
        const categoryErrors = validateProductByCategory(data);
        if (categoryErrors.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'Errores de validación',
            details: categoryErrors,
          });
        }
      }
      
      const user = (req as any).user || null;
      const actor = user ? { id: user.id, role: user.role } : undefined;
      const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
      const result = await ProductService.updateProduct(id, data, actor, correlationId);
      
      res.json({
        success: true,
        message: 'Producto actualizado exitosamente',
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al actualizar producto',
      });
    }
  }

  static async deleteProduct(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await ProductService.deleteProduct(id);
      
      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al eliminar producto',
      });
    }
  }

  static async updateStock(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { quantity, operation } = req.body;
      
      if (!['add', 'subtract'].includes(operation)) {
        return res.status(400).json({
          success: false,
          error: 'Operación inválida. Use "add" o "subtract"',
        });
      }

      const result = await ProductService.updateStock(id, quantity, operation);
      
      res.json({
        success: true,
        message: 'Stock actualizado exitosamente',
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al actualizar stock',
      });
    }
  }

  static async getLowStockProducts(req: Request, res: Response) {
    try {
      const result = await ProductService.getLowStockProducts();
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener productos con stock bajo',
      });
    }
  }

  // Subir imagen de producto y actualizar imageUrl
  static async uploadProductImage(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ success: false, error: 'ID de producto requerido' });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Archivo de imagen requerido' });
      }

      // Procesar imagen con sharp parametrizado por entorno
      const pathModule = await import('path');
      const fsModule = await import('fs');
      const sharpModule = await import('sharp');
      const uploadsUtils = await import('../utils/uploads');
      const path = pathModule.default;
      const fs = fsModule.default as typeof import('fs');
      const sharp = (sharpModule as any).default || sharpModule;

      const IMG_SIZE = Number.parseInt(process.env.PRODUCT_IMAGE_SIZE || '800', 10) || 800;
      const IMG_FORMAT = (process.env.PRODUCT_IMAGE_FORMAT || 'webp').toLowerCase();
      const IMG_QUALITY = Number.parseInt(process.env.PRODUCT_IMAGE_QUALITY || '85', 10) || 85;
      const outExt = IMG_FORMAT === 'jpeg' ? '.jpg' : `.${IMG_FORMAT}`;

      const originalPath = (req as any).file?.path as string;
      const outputDir = path.dirname(originalPath);
      const baseName = path.basename(((req as any).file?.originalname as string) || 'image', path.extname(((req as any).file?.originalname as string) || ''))
        .replace(/[^a-zA-Z0-9-_]/g, '_');
      const outputFilename = `${id}-${baseName}-${Date.now()}${outExt}`;
      let processedPath = path.join(outputDir, outputFilename);

      try {
        const pipeline = sharp(originalPath).resize(IMG_SIZE, IMG_SIZE, { fit: 'cover', position: 'center' });
        if (IMG_FORMAT === 'webp') {
          await pipeline.toFormat('webp', { quality: IMG_QUALITY }).toFile(processedPath);
        } else if (IMG_FORMAT === 'jpeg' || IMG_FORMAT === 'jpg') {
          await pipeline.jpeg({ quality: IMG_QUALITY }).toFile(processedPath);
        } else if (IMG_FORMAT === 'png') {
          await pipeline.png().toFile(processedPath);
        } else {
          await pipeline.toFile(processedPath);
        }
        try {
          if (fs.existsSync(originalPath)) fs.unlinkSync(originalPath);
        } catch (delErr) {
          console.warn('[PRODUCT UPLOAD] No se pudo eliminar archivo original:', delErr);
        }
      } catch (procErr) {
        console.error('[PRODUCT UPLOAD] Error procesando imagen con sharp, se usará el archivo original:', procErr);
        processedPath = originalPath;
      }

      // Construir URL pública y limpiar imagen previa si existe
      const publicUrl = uploadsUtils.publicUploadsUrl(req, 'products', path.basename(processedPath));

      try {
        const product = await ProductService.getProductById(id);
        const prevUrl = product?.get ? (product.get('imageUrl') as string) : (product as any)?.imageUrl;
        const prevPath = prevUrl ? uploadsUtils.resolveUploadsFileFromPublicUrl(prevUrl) : null;
        if (prevPath && fs.existsSync(prevPath)) {
          fs.unlinkSync(prevPath);
        }
      } catch (cleanupErr) {
        console.warn('[PRODUCT UPLOAD] No se pudo limpiar imagen previa del producto:', cleanupErr);
      }

      const updated = await ProductService.updateProduct(id, { imageUrl: publicUrl } as UpdateProductInput);

      return res.status(200).json({
        success: true,
        message: 'Imagen de producto actualizada exitosamente',
        data: { id: updated.id, imageUrl: (updated as any).get ? updated.get('imageUrl') || publicUrl : publicUrl },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al subir imagen de producto',
      });
    }
  }

  // Subir múltiples imágenes y devolver URLs públicas
  static async uploadProductImages(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ success: false, error: 'ID de producto requerido' });
      }

      const files = (req as any).files as Express.Multer.File[] || [];
      if (!files.length) {
        return res.status(400).json({ success: false, error: 'Debe adjuntar al menos una imagen' });
      }

      const pathModule = await import('path');
      const fsModule = await import('fs');
      const sharpModule = await import('sharp');
      const uploadsUtils = await import('../utils/uploads');
      const path = pathModule.default;
      const fs = fsModule.default as typeof import('fs');
      const sharp = (sharpModule as any).default || sharpModule;

      const IMG_SIZE = Number.parseInt(process.env.PRODUCT_IMAGE_SIZE || '800', 10) || 800;
      const IMG_FORMAT = (process.env.PRODUCT_IMAGE_FORMAT || 'webp').toLowerCase();
      const IMG_QUALITY = Number.parseInt(process.env.PRODUCT_IMAGE_QUALITY || '85', 10) || 85;
      const outExt = IMG_FORMAT === 'jpeg' ? '.jpg' : `.${IMG_FORMAT}`;

      const urls: string[] = [];
      for (const file of files) {
        const originalPath = (file as any).path as string;
        const outputDir = path.dirname(originalPath);
        const baseName = path.basename((file as any).originalname || 'image', path.extname((file as any).originalname || ''))
          .replace(/[^a-zA-Z0-9-_]/g, '_');
        const outputFilename = `${id}-${baseName}-${Date.now()}${outExt}`;
        let processedPath = path.join(outputDir, outputFilename);

        try {
          const pipeline = sharp(originalPath).resize(IMG_SIZE, IMG_SIZE, { fit: 'cover', position: 'center' });
          if (IMG_FORMAT === 'webp') {
            await pipeline.toFormat('webp', { quality: IMG_QUALITY }).toFile(processedPath);
          } else if (IMG_FORMAT === 'jpeg' || IMG_FORMAT === 'jpg') {
            await pipeline.jpeg({ quality: IMG_QUALITY }).toFile(processedPath);
          } else if (IMG_FORMAT === 'png') {
            await pipeline.png().toFile(processedPath);
          } else {
            await pipeline.toFile(processedPath);
          }
          try {
            if (fs.existsSync(originalPath)) fs.unlinkSync(originalPath);
          } catch (delErr) {
            console.warn('[PRODUCT UPLOAD] No se pudo eliminar archivo original:', delErr);
          }
        } catch (procErr) {
          console.error('[PRODUCT UPLOAD] Error procesando imagen con sharp, se usará el archivo original:', procErr);
          processedPath = originalPath;
        }

        const publicUrl = uploadsUtils.publicUploadsUrl(req, 'products', path.basename(processedPath));
        urls.push(publicUrl);
      }

      return res.status(200).json({
        success: true,
        message: 'Imágenes subidas exitosamente',
        data: { productId: id, images: urls },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al subir imágenes del producto',
      });
    }
  }

  // Listar las imágenes disponibles para un producto
  static async listProductImages(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ success: false, error: 'ID de producto requerido' });
      }

      const pathModule = await import('path');
      const fsModule = await import('fs');
      const uploadsUtils = await import('../utils/uploads');
      const path = pathModule.default;
      const fs = fsModule.default as typeof import('fs');

      const productImagesDir = uploadsUtils.ensureUploadsSubdir('products');
      if (!fs.existsSync(productImagesDir)) {
        return res.status(200).json({ success: true, data: [] });
      }

      const allFiles = fs.readdirSync(productImagesDir);
      const prefix = `${id}-`;
      const matched = allFiles.filter(name => name.startsWith(prefix));

      // Intentar aplicar orden desde manifest si existe
      const manifestPath = path.join(productImagesDir, `${id}-order.json`);
      let orderedNames = matched;
      if (fs.existsSync(manifestPath)) {
        try {
          const raw = fs.readFileSync(manifestPath, 'utf-8');
          const manifest: string[] = JSON.parse(raw);
          const setMatched = new Set(matched);
          // Mantener solo los presentes y en el orden del manifest
          const fromManifest = manifest.filter(name => setMatched.has(name));
          // Agregar cualquier archivo nuevo que no esté en manifest al final
          const extras = matched.filter(name => !fromManifest.includes(name));
          orderedNames = [...fromManifest, ...extras];
        } catch (e) {
          console.warn('[LIST IMAGES] Manifest inválido, usando orden por defecto:', e);
        }
      }

      const urls = orderedNames.map(name => uploadsUtils.publicUploadsUrl(req, 'products', name));

      return res.status(200).json({ success: true, data: urls });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al listar imágenes de producto',
      });
    }
  }

  // Eliminar una imagen de la galería del producto. Si era la principal, limpiar imageUrl
  static async deleteProductImage(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ success: false, error: 'ID de producto requerido' });
      }

      const url = (req.body as any)?.url as string | undefined;
      const filenameBody = (req.body as any)?.filename as string | undefined;

      if (!url && !filenameBody) {
        return res.status(400).json({ success: false, error: 'Se requiere url o filename para eliminar' });
      }

      const pathModule = await import('path');
      const fsModule = await import('fs');
      const uploadsUtils = await import('../utils/uploads');
      const path = pathModule.default;
      const fs = fsModule.default as typeof import('fs');

      // Determinar filename a partir de la URL o del cuerpo
      let filename = filenameBody;
      if (!filename && url) {
        try {
          const u = new URL(url);
          filename = path.basename(u.pathname);
        } catch {
          // Si no es una URL válida, intentar tomar el basename directamente
          filename = path.basename(url);
        }
      }

      if (!filename) {
        return res.status(400).json({ success: false, error: 'Filename inválido' });
      }

      // Seguridad: asegurar que el archivo corresponde al producto
      const expectedPrefix = `${id}-`;
      if (!filename.startsWith(expectedPrefix)) {
        return res.status(400).json({ success: false, error: 'El archivo no pertenece al producto indicado' });
      }

      const productImagesDir = uploadsUtils.ensureUploadsSubdir('products');
      const filePath = path.join(productImagesDir, filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'Imagen no encontrada' });
      }

      // Eliminar el archivo
      fs.unlinkSync(filePath);

      // Si la imagen eliminada era la principal, limpiar imageUrl
      const publicUrl = uploadsUtils.publicUploadsUrl(req, 'products', filename);
      let clearedPrimary = false;
      try {
        const product = await ProductService.getProductById(id);
        const currentImageUrl = product?.get ? product.get('imageUrl') : (product as any)?.imageUrl;
        if (currentImageUrl && String(currentImageUrl) === publicUrl) {
          await ProductService.updateProduct(id, ({ imageUrl: null } as unknown) as UpdateProductInput);
          clearedPrimary = true;
        }
      } catch (e) {
        // No bloquear la eliminación si falla la lectura/actualización del producto
        console.warn('[DELETE IMAGE] No se pudo verificar/limpiar imageUrl:', e);
      }

      return res.status(200).json({ success: true, message: 'Imagen eliminada', data: { filename, url: publicUrl, clearedPrimary } });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al eliminar imagen de producto',
      });
    }
  }

  // Guardar orden de imágenes del producto
  static async saveProductImagesOrder(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { order } = req.body as { order?: string[] };
      if (!id) {
        return res.status(400).json({ success: false, error: 'ID de producto requerido' });
      }
      if (!Array.isArray(order) || order.length === 0) {
        return res.status(400).json({ success: false, error: 'Se requiere un arreglo "order" con al menos un elemento' });
      }

      const pathModule = await import('path');
      const fsModule = await import('fs');
      const uploadsUtils = await import('../utils/uploads');
      const path = pathModule.default;
      const fs = fsModule.default as typeof import('fs');

      const productImagesDir = uploadsUtils.ensureUploadsSubdir('products');

      // Normalizar a filenames
      const filenames = order.map(item => {
        try {
          // Si viene como URL, extraer basename
          if (item.startsWith('http://') || item.startsWith('https://')) {
            const u = new URL(item);
            return path.basename(u.pathname);
          }
        } catch {}
        // Si ya es nombre de archivo o un path, tomar basename
        return path.basename(item);
      });

      const expectedPrefix = `${id}-`;
      // Validar que todas pertenecen al producto y existen
      for (const name of filenames) {
        if (!name.startsWith(expectedPrefix)) {
          return res.status(400).json({ success: false, error: 'Una o más imágenes no pertenecen al producto indicado' });
        }
        const filePath = path.join(productImagesDir, name);
        if (!fs.existsSync(filePath)) {
          return res.status(400).json({ success: false, error: `Imagen no encontrada: ${name}` });
        }
      }

      const manifestPath = path.join(productImagesDir, `${id}-order.json`);
      fs.writeFileSync(manifestPath, JSON.stringify(filenames, null, 2), 'utf-8');

      return res.status(200).json({ success: true, message: 'Orden de imágenes guardado', data: { count: filenames.length } });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al guardar orden de imágenes',
      });
    }
  }

  /**
   * Importación masiva de productos vía JSON
   */
  static async bulkImportProducts(req: Request, res: Response) {
    try {
      const { items, upsert = true, skipDuplicates = true, dryRun = false } = req.body as any;
      const importBatchId = (req.headers['x-correlation-id'] as string) || `bulk-${Date.now()}`;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'No se enviaron productos para importar' });
      }

      // Validaciones de entrada: duplicados en payload y reglas de categoría
      const seenCodes = new Set<string>();
      const seenBarcodes = new Set<string>();
      const inputErrors: { index: number; code?: string; errors: string[] }[] = [];

      items.forEach((item: any, idx: number) => {
        const errs: string[] = [];
        // Precio de venta no menor que compra (regla de margen básica)
        if (typeof item.purchasePrice === 'number' && typeof item.salePrice === 'number') {
          if (!Number.isFinite(item.purchasePrice) || !Number.isFinite(item.salePrice)) {
            errs.push('Los precios deben ser números finitos');
          } else if (item.salePrice < item.purchasePrice) {
            errs.push('El precio de venta no puede ser menor que el precio de compra');
          }
        }

        // Stock y mínimos
        if (typeof item.stock === 'number' && item.stock < 0) errs.push('El stock no puede ser negativo');
        if (typeof item.minStock === 'number' && item.minStock < 0) errs.push('El stock mínimo no puede ser negativo');

        // Duplicados en el payload
        if (item.code) {
          if (seenCodes.has(item.code)) errs.push('Código duplicado en el payload');
          else seenCodes.add(item.code);
        } else {
          errs.push('El código es requerido');
        }

        if (item.barcode) {
          if (seenBarcodes.has(item.barcode)) errs.push('Código de barras duplicado en el payload');
          else seenBarcodes.add(item.barcode);
        }

        // Validaciones específicas por categoría
        const catErrors = validateProductByCategory(item);
        if (catErrors.length) errs.push(...catErrors);

        if (errs.length) inputErrors.push({ index: idx, code: item.code, errors: errs });
      });

      if (inputErrors.length) {
        return res.status(400).json({
          success: false,
          message: 'Validación fallida en el payload',
          data: { errors: inputErrors },
        });
      }

      if (dryRun) {
        return res.status(200).json({
          success: true,
          message: 'Dry run exitoso. No se realizaron cambios.',
          data: { toImport: items.length },
        });
      }

      const results: { index: number; code: string; status: 'created' | 'updated' | 'skipped'; id?: string; error?: string }[] = [];

      await sequelize.transaction(async (t) => {
        for (let i = 0; i < items.length; i++) {
          const item = { ...items[i] };
          // Homologar barcode si no se envía
          if (!item.barcode) item.barcode = item.code;

          try {
            const existing = await Product.findOne({ where: { code: item.code }, transaction: t });
            if (existing) {
              if (!upsert) {
                if (skipDuplicates) {
                  results.push({ index: i, code: item.code, status: 'skipped' });
                  continue;
                } else {
                  throw new Error('El código de producto ya existe');
                }
              }

              // Validar unicidad de barcode si cambia
              if (item.barcode && item.barcode !== existing.barcode) {
                const barcodeConflict = await Product.findOne({
                  where: { barcode: item.barcode, id: { [Op.ne]: existing.id } as any },
                  transaction: t,
                });
                if (barcodeConflict) throw new Error('El código de barras ya existe');
              }

              // Detectar cambios de precio antes de actualizar
              const oldSalePrice = existing.salePrice;
              const oldPurchasePrice = (existing as any).purchasePrice;
              const newSalePrice = typeof item.salePrice === 'number' ? item.salePrice : oldSalePrice;
              const newPurchasePrice = typeof item.purchasePrice === 'number' ? item.purchasePrice : oldPurchasePrice;

              await existing.update(item, { transaction: t });

              // Auditoría de cambios de precio durante importación masiva
              const changes: Array<{ field: 'salePrice' | 'purchasePrice'; old: number | null; new: number | null }> = [];
              if (typeof item.salePrice === 'number' && newSalePrice !== oldSalePrice) {
                changes.push({ field: 'salePrice', old: oldSalePrice, new: newSalePrice });
              }
              if (typeof item.purchasePrice === 'number' && newPurchasePrice !== oldPurchasePrice) {
                changes.push({ field: 'purchasePrice', old: oldPurchasePrice, new: newPurchasePrice });
              }
              if (changes.length) {
                try {
                  const userBulk = (req as any).user || null;
                  const actorBulk = userBulk ? { id: userBulk.id, role: userBulk.role } : null;
                  await AuditTrailService.log({
                    operation: 'price.update.bulk',
                    entityType: 'product',
                    entityId: existing.id,
                    result: 'success',
                    message: 'Actualización de precio vía importación masiva',
                    details: { changes, source: 'bulkImport' },
                    actor: actorBulk,
                    correlationId: importBatchId,
                  });
                } catch (e) {
                  // no bloquear importación si falla auditoría
                }
              }
              results.push({ index: i, code: item.code, status: 'updated', id: existing.id });
            } else {
              // Validar unicidad de barcode para creación
              if (item.barcode) {
                const barcodeConflict = await Product.findOne({ where: { barcode: item.barcode }, transaction: t });
                if (barcodeConflict) throw new Error('El código de barras ya existe');
              }

              const created = await Product.create(item, { transaction: t });
              results.push({ index: i, code: item.code, status: 'created', id: created.id });
            }
          } catch (err: any) {
            if (skipDuplicates && /ya existe/i.test(err?.message || '')) {
              results.push({ index: i, code: item.code, status: 'skipped', error: err.message });
              continue;
            }
            throw err;
          }
        }
      });

      const created = results.filter(r => r.status === 'created').length;
      const updated = results.filter(r => r.status === 'updated').length;
      const skipped = results.filter(r => r.status === 'skipped').length;

      return res.status(200).json({
        success: true,
        message: `Importación completada: ${created} creados, ${updated} actualizados, ${skipped} omitidos`,
        data: { results, summary: { created, updated, skipped, total: results.length } },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error en importación masiva de productos',
      });
    }
  }
}
