import { Request, Response } from 'express'
import { ProductAsset } from '../models/ProductAsset'
import { Product } from '../models/Product'
import { validateData } from '../middleware/zodValidation'
import { createProductAssetSchema, updateProductAssetSchema, productAssetQuerySchema, CreateProductAssetInput, UpdateProductAssetInput } from '../schemas/productAsset'

export const ProductAssetController = {
  async create(req: Request, res: Response) {
    const validation = await validateData(req.body || {}, createProductAssetSchema)
    if (!validation.success) {
      return res.status(400).json({ success: false, errors: validation.errors })
    }
    const data: CreateProductAssetInput = validation.data
    const product = await Product.findByPk(data.productId)
    if (!product) return res.status(404).json({ success: false, error: 'Producto no encontrado' })
    const created = await ProductAsset.create({
      productId: data.productId,
      serial: data.serial,
      status: data.status || 'available',
      hallmark: data.hallmark,
      condition: data.condition,
      location: data.location,
      qrPayload: data.qrPayload,
      metadata: data.metadata,
    })
    return res.status(201).json({ success: true, data: created })
  },

  async list(req: Request, res: Response) {
    const validation = await validateData(req.query || {}, productAssetQuerySchema)
    if (!validation.success) {
      return res.status(400).json({ success: false, errors: validation.errors })
    }
    const { productId, status, q, limit = 100, offset = 0 } = validation.data
    const where: any = {}
    if (productId) where.productId = productId
    if (status) where.status = status
    if (q) where.serial = { $like: `%${q}%` }
    const rows = await ProductAsset.findAll({ where, order: [['createdAt', 'DESC']], limit, offset })
    return res.json({ success: true, data: rows })
  },

  async getById(req: Request, res: Response) {
    const { id } = req.params
    const row = await ProductAsset.findByPk(id)
    if (!row) return res.status(404).json({ success: false, error: 'Asset no encontrado' })
    return res.json({ success: true, data: row })
  },

  async update(req: Request, res: Response) {
    const { id } = req.params
    const row = await ProductAsset.findByPk(id)
    if (!row) return res.status(404).json({ success: false, error: 'Asset no encontrado' })
    const validation = await validateData(req.body || {}, updateProductAssetSchema)
    if (!validation.success) {
      return res.status(400).json({ success: false, errors: validation.errors })
    }
    const data: UpdateProductAssetInput = validation.data
    await row.update({
      status: data.status ?? row.status,
      hallmark: data.hallmark ?? row.hallmark,
      condition: data.condition ?? row.condition,
      location: data.location ?? row.location,
      qrPayload: data.qrPayload ?? row.qrPayload,
      metadata: data.metadata ?? row.metadata,
    })
    return res.json({ success: true, data: row })
  },

  async remove(req: Request, res: Response) {
    const { id } = req.params
    const row = await ProductAsset.findByPk(id)
    if (!row) return res.status(404).json({ success: false, error: 'Asset no encontrado' })
    await row.destroy()
    return res.json({ success: true })
  },
}

export default ProductAssetController

