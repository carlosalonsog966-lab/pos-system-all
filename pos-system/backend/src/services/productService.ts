import { Op } from 'sequelize';
import { Product } from '../models/Product';
import { CreateProductInput, UpdateProductInput, ProductQueryInput } from '../schemas/product';
import { AuditTrailService } from './AuditTrailService';
import { SettingsService } from './settingsService';

export class ProductService {
  static async createProduct(data: CreateProductInput) {
    // Verificar si el código ya existe
    const existingProduct = await Product.findOne({
      where: { code: data.code },
    });

    if (existingProduct) {
      throw new Error('El código de producto ya existe');
    }

    // Homologar: si no se proporciona barcode, usar el mismo código
    if (!data.barcode) {
      data.barcode = data.code;
    }

    // Verificar si el código de barras ya existe
    if (data.barcode) {
      const existingBarcode = await Product.findOne({
        where: { barcode: data.barcode },
      });

      if (existingBarcode) {
        throw new Error('El código de barras ya existe');
      }
    }

    const product = await Product.create(data);
    return product;
  }

  static async getProducts(query: ProductQueryInput) {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      material,
      isActive,
      lowStock,
    } = query;

    const offset = (page - 1) * limit;
    const where: any = {};

    // Filtros
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { code: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { supplier: { [Op.like]: `%${search}%` } },
      ];
    }

    if (category) where.category = category;
    if (material) where.material = material;
    // Por defecto, devolver solo productos activos si no se especifica
    if (isActive !== undefined) {
      where.isActive = isActive;
    } else {
      where.isActive = true;
    }

    // Filtro de stock bajo
    if (lowStock) {
      where[Op.and] = [
        { stock: { [Op.lte]: { [Op.col]: 'minStock' } } },
      ];
    }

    const { rows: products, count } = await Product.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      products,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit),
      },
    };
  }

  static async getProductById(id: string) {
    const product = await Product.findByPk(id);
    if (!product) {
      throw new Error('Producto no encontrado');
    }
    return product;
  }

  static async getProductByCode(code: string) {
    const product = await Product.findOne({
      where: { code, isActive: true },
    });
    if (!product) {
      throw new Error('Producto no encontrado');
    }
    return product;
  }

  static async updateProduct(id: string, data: UpdateProductInput, actor?: { id?: string; role?: string }, correlationId?: string) {
    const product = await Product.findByPk(id);
    if (!product) {
      throw new Error('Producto no encontrado');
    }

    // Verificar código único si se está actualizando
    if (data.code && data.code !== product.code) {
      const existingProduct = await Product.findOne({
        where: { code: data.code, id: { [Op.ne]: id } },
      });
      if (existingProduct) {
        throw new Error('El código de producto ya existe');
      }
    }

    // Si se actualiza el código y no se proporciona barcode, sincronizar barcode con el nuevo código
    if (data.code && data.code !== product.code && !data.barcode) {
      data.barcode = data.code;
    }

    // Verificar código de barras único si se está actualizando
    if (data.barcode && data.barcode !== product.barcode) {
      const existingBarcode = await Product.findOne({
        where: { barcode: data.barcode, id: { [Op.ne]: id } },
      });
      if (existingBarcode) {
        throw new Error('El código de barras ya existe');
      }
    }

    // Detectar cambios de precio antes de actualizar
    const priceChanges: Array<{ field: 'salePrice' | 'purchasePrice'; old: number | null; new: number | null }> = [];
    if (typeof data.salePrice === 'number' && data.salePrice !== product.salePrice) {
      priceChanges.push({ field: 'salePrice', old: product.salePrice, new: data.salePrice });
    }
    if (typeof data.purchasePrice === 'number' && data.purchasePrice !== product.purchasePrice) {
      priceChanges.push({ field: 'purchasePrice', old: product.purchasePrice, new: data.purchasePrice });
    }

    await product.update(data);

    // Auditoría de cambios de precio (manual)
    if (priceChanges.length) {
      try {
        const msgParts = priceChanges.map(c => `${c.field}: ${c.old ?? ''} -> ${c.new ?? ''}`);

        // Calcular diferencias y enriquecer detalles
        const enrichedChanges = priceChanges.map(c => ({
          ...c,
          difference: (typeof c.new === 'number' ? c.new : 0) - (typeof c.old === 'number' ? c.old : 0),
        }));

        // Obtener moneda de configuración si no se envía en la petición
        let currency = (data as any).priceUpdateCurrency as string | undefined;
        if (!currency) {
          try {
            const settings = await SettingsService.getSettings();
            currency = settings.currency || 'USD';
          } catch {
            currency = 'USD';
          }
        }

        const reason = (data as any).priceUpdateReason || 'N/A';
        await AuditTrailService.log({
          operation: 'price.update.manual',
          entityType: 'product',
          entityId: product.id,
          result: 'success',
          message: `Actualización de precio: ${msgParts.join('; ')}${reason && reason !== 'N/A' ? ` (razón: ${reason})` : ''}`,
          details: { changes: enrichedChanges, reason, currency, source: 'manual' },
          actor: actor || null,
          correlationId,
        });
      } catch (e) {
        // no bloquear por falla de auditoría
      }
    }
    return product;
  }

  static async deleteProduct(id: string) {
    const product = await Product.findByPk(id);
    if (!product) {
      throw new Error('Producto no encontrado');
    }

    // Soft delete - marcar como inactivo
    await product.update({ isActive: false });
    return { message: 'Producto eliminado exitosamente' };
  }

  static async updateStock(id: string, quantity: number, operation: 'add' | 'subtract') {
    const product = await Product.findByPk(id);
    if (!product) {
      throw new Error('Producto no encontrado');
    }

    const newStock = operation === 'add' 
      ? product.stock + quantity 
      : product.stock - quantity;

    if (newStock < 0) {
      throw new Error('Stock insuficiente');
    }

    await product.update({ stock: newStock });
    return product;
  }

  static async getLowStockProducts() {
    const products = await Product.findAll({
      where: {
        isActive: true,
        stock: { [Op.lte]: { [Op.col]: 'minStock' } },
      },
      order: [['stock', 'ASC']],
    });

    return products;
  }
}
