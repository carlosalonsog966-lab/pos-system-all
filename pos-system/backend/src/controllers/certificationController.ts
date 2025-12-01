import { Request, Response } from 'express'
import { validateData } from '../middleware/zodValidation'
import { createCertificationSchema, updateCertificationSchema, certificationQuerySchema, type CreateCertificationInput, type UpdateCertificationInput } from '../schemas/certification'
import Certification from '../models/Certification'
import ProductAsset from '../models/ProductAsset'

export const CertificationController = {
  async create(req: Request, res: Response) {
    const validation = await validateData(req.body || {}, createCertificationSchema)
    if (!validation.success) return res.status(400).json({ success: false, errors: validation.errors })
    const data: CreateCertificationInput = validation.data
    const asset = await ProductAsset.findByPk(data.productAssetId)
    if (!asset) return res.status(404).json({ success: false, error: 'Asset no encontrado' })
    const created = await Certification.create({ ...data })
    return res.status(201).json({ success: true, data: created })
  },

  async list(req: Request, res: Response) {
    const validation = await validateData(req.query || {}, certificationQuerySchema)
    if (!validation.success) return res.status(400).json({ success: false, errors: validation.errors })
    const { productAssetId, type, q, limit = 100, offset = 0 } = validation.data as any
    const where: any = {}
    if (productAssetId) where.productAssetId = productAssetId
    if (type) where.type = type
    if (q) where.certificateNumber = { $like: `%${q}%` }
    const rows = await Certification.findAll({ where, order: [['issueDate','DESC']], limit, offset })
    return res.json({ success: true, data: rows })
  },

  async getById(req: Request, res: Response) {
    const { id } = req.params
    const row = await Certification.findByPk(id)
    if (!row) return res.status(404).json({ success: false, error: 'Certificación no encontrada' })
    return res.json({ success: true, data: row })
  },

  async update(req: Request, res: Response) {
    const { id } = req.params
    const row = await Certification.findByPk(id)
    if (!row) return res.status(404).json({ success: false, error: 'Certificación no encontrada' })
    const validation = await validateData(req.body || {}, updateCertificationSchema)
    if (!validation.success) return res.status(400).json({ success: false, errors: validation.errors })
    const data: UpdateCertificationInput = validation.data
    await row.update({
      type: data.type ?? row.type,
      authority: data.authority ?? row.authority,
      certificateNumber: data.certificateNumber ?? row.certificateNumber,
      issueDate: data.issueDate ?? row.issueDate,
      expiryDate: data.expiryDate ?? row.expiryDate,
      metadata: data.metadata ?? row.metadata,
    })
    return res.json({ success: true, data: row })
  },

  async remove(req: Request, res: Response) {
    const { id } = req.params
    const row = await Certification.findByPk(id)
    if (!row) return res.status(404).json({ success: false, error: 'Certificación no encontrada' })
    await row.destroy()
    return res.json({ success: true })
  },
}

export default CertificationController

