import { Request, Response } from 'express'
import { validateData } from '../middleware/zodValidation'
import { createWarrantySchema, updateWarrantySchema, warrantyQuerySchema, type CreateWarrantyInput, type UpdateWarrantyInput } from '../schemas/warranty'
import Warranty from '../models/Warranty'
import ProductAsset from '../models/ProductAsset'

export const WarrantyController = {
  async create(req: Request, res: Response) {
    const validation = await validateData(req.body || {}, createWarrantySchema)
    if (!validation.success) return res.status(400).json({ success: false, errors: validation.errors })
    const data: CreateWarrantyInput = validation.data
    const asset = await ProductAsset.findByPk(data.productAssetId)
    if (!asset) return res.status(404).json({ success: false, error: 'Asset no encontrado' })
    const created = await Warranty.create({ ...data })
    return res.status(201).json({ success: true, data: created })
  },

  async list(req: Request, res: Response) {
    const validation = await validateData(req.query || {}, warrantyQuerySchema)
    if (!validation.success) return res.status(400).json({ success: false, errors: validation.errors })
    const { productAssetId, saleId, status, limit = 100, offset = 0 } = validation.data as any
    const where: any = {}
    if (productAssetId) where.productAssetId = productAssetId
    if (saleId) where.saleId = saleId
    if (status) where.status = status
    const rows = await Warranty.findAll({ where, order: [['startDate','DESC']], limit, offset })
    return res.json({ success: true, data: rows })
  },

  async getById(req: Request, res: Response) {
    const { id } = req.params
    const row = await Warranty.findByPk(id)
    if (!row) return res.status(404).json({ success: false, error: 'Garantía no encontrada' })
    return res.json({ success: true, data: row })
  },

  async update(req: Request, res: Response) {
    const { id } = req.params
    const row = await Warranty.findByPk(id)
    if (!row) return res.status(404).json({ success: false, error: 'Garantía no encontrada' })
    const validation = await validateData(req.body || {}, updateWarrantySchema)
    if (!validation.success) return res.status(400).json({ success: false, errors: validation.errors })
    const data: UpdateWarrantyInput = validation.data
    await row.update({
      saleId: (data as any).saleId ?? row.saleId,
      startDate: data.startDate ?? row.startDate,
      months: data.months ?? row.months,
      status: data.status ?? row.status,
      terms: data.terms ?? row.terms,
      metadata: data.metadata ?? row.metadata,
    })
    return res.json({ success: true, data: row })
  },

  async remove(req: Request, res: Response) {
    const { id } = req.params
    const row = await Warranty.findByPk(id)
    if (!row) return res.status(404).json({ success: false, error: 'Garantía no encontrada' })
    await row.destroy()
    return res.json({ success: true })
  },
}

export default WarrantyController

