import { Request, Response } from 'express'
import { validateData } from '../middleware/zodValidation'
import { createAppraisalSchema, updateAppraisalSchema, appraisalQuerySchema, type CreateAppraisalInput, type UpdateAppraisalInput } from '../schemas/appraisal'
import Appraisal from '../models/Appraisal'
import ProductAsset from '../models/ProductAsset'

export const AppraisalController = {
  async create(req: Request, res: Response) {
    const validation = await validateData(req.body || {}, createAppraisalSchema)
    if (!validation.success) return res.status(400).json({ success: false, errors: validation.errors })
    const data: CreateAppraisalInput = validation.data
    const asset = await ProductAsset.findByPk(data.productAssetId)
    if (!asset) return res.status(404).json({ success: false, error: 'Asset no encontrado' })
    const created = await Appraisal.create({ ...data })
    return res.status(201).json({ success: true, data: created })
  },

  async list(req: Request, res: Response) {
    const validation = await validateData(req.query || {}, appraisalQuerySchema)
    if (!validation.success) return res.status(400).json({ success: false, errors: validation.errors })
    const { productAssetId, minDate, maxDate, limit = 100, offset = 0 } = validation.data as any
    const where: any = {}
    if (productAssetId) where.productAssetId = productAssetId
    if (minDate || maxDate) where.appraisalDate = {
      ...(minDate ? { $gte: minDate } : {}),
      ...(maxDate ? { $lte: maxDate } : {}),
    }
    const rows = await Appraisal.findAll({ where, order: [['appraisalDate','DESC']], limit, offset })
    return res.json({ success: true, data: rows })
  },

  async getById(req: Request, res: Response) {
    const { id } = req.params
    const row = await Appraisal.findByPk(id)
    if (!row) return res.status(404).json({ success: false, error: 'Tasación no encontrada' })
    return res.json({ success: true, data: row })
  },

  async update(req: Request, res: Response) {
    const { id } = req.params
    const row = await Appraisal.findByPk(id)
    if (!row) return res.status(404).json({ success: false, error: 'Tasación no encontrada' })
    const validation = await validateData(req.body || {}, updateAppraisalSchema)
    if (!validation.success) return res.status(400).json({ success: false, errors: validation.errors })
    const data: UpdateAppraisalInput = validation.data
    await row.update({
      appraiser: data.appraiser ?? row.appraiser,
      appraisalDate: data.appraisalDate ?? row.appraisalDate,
      value: (data as any).value ?? row.value,
      currency: data.currency ?? row.currency,
      notes: data.notes ?? row.notes,
      metadata: data.metadata ?? row.metadata,
    })
    return res.json({ success: true, data: row })
  },

  async remove(req: Request, res: Response) {
    const { id } = req.params
    const row = await Appraisal.findByPk(id)
    if (!row) return res.status(404).json({ success: false, error: 'Tasación no encontrada' })
    await row.destroy()
    return res.json({ success: true })
  },
}

export default AppraisalController

