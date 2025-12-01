import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { validateData, z } from '../middleware/zodValidation'
import { CycleCountService } from '../services/cycleCountService'

const createSchema = z.object({
  branchId: z.string().uuid().optional(),
  type: z.enum(['cyclic', 'general']),
  tolerancePct: z.number().min(0).max(100).optional(),
  note: z.string().max(1000).optional(),
})

const preloadSchema = z.object({ branchId: z.string().uuid().optional() })

const listSchema = z.object({
  branchId: z.string().uuid().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'canceled']).optional(),
  page: z.number().min(1).optional(),
  limit: z.number().min(1).max(200).optional(),
})

const countItemSchema = z.object({ countedQty: z.number().min(0), countedBy: z.string().uuid().optional(), reason: z.string().max(500).optional() })

export class CycleCountController {
  static async create(req: AuthRequest, res: Response) {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ success: false, message: 'Usuario no autenticado' })
    const v = await validateData(req.body, createSchema)
    if (!v.success) return res.status(400).json({ success: false, message: 'Errores de validación', errors: v.errors })
    const c = await CycleCountService.create({ branchId: v.data.branchId ?? null, type: v.data.type, createdBy: userId, tolerancePct: v.data.tolerancePct ?? null, note: v.data.note ?? null })
    return res.status(200).json({ success: true, data: c })
  }

  static async list(req: AuthRequest, res: Response) {
    const v = await validateData(req.query, listSchema)
    if (!v.success) return res.status(400).json({ success: false, message: 'Errores de validación', errors: v.errors })
    const r = await CycleCountService.list({ branchId: v.data.branchId ?? null, status: v.data.status ?? null, page: v.data.page, limit: v.data.limit })
    return res.status(200).json({ success: true, data: r })
  }

  static async get(req: AuthRequest, res: Response) {
    const { id } = req.params
    const r = await CycleCountService.get(id)
    return res.status(200).json({ success: true, data: r })
  }

  static async start(req: AuthRequest, res: Response) {
    const { id } = req.params
    const r = await CycleCountService.start(id)
    return res.status(200).json({ success: true, data: r })
  }

  static async complete(req: AuthRequest, res: Response) {
    const { id } = req.params
    const r = await CycleCountService.complete(id)
    return res.status(200).json({ success: true, data: r })
  }

  static async preloadItems(req: AuthRequest, res: Response) {
    const { id } = req.params
    const v = await validateData(req.body ?? {}, preloadSchema)
    if (!v.success) return res.status(400).json({ success: false, message: 'Errores de validación', errors: v.errors })
    const r = await CycleCountService.preloadItemsFromBranch(id, v.data.branchId ?? null)
    return res.status(200).json({ success: true, data: r })
  }

  static async setItemCount(req: AuthRequest, res: Response) {
    const { id, itemId } = req.params as any
    const v = await validateData(req.body, countItemSchema)
    if (!v.success) return res.status(400).json({ success: false, message: 'Errores de validación', errors: v.errors })
    const r = await CycleCountService.setItemCount(id, itemId, v.data.countedQty, v.data.countedBy ?? null, v.data.reason ?? null)
    return res.status(200).json({ success: true, data: r })
  }

  static async applyAdjustments(req: AuthRequest, res: Response) {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ success: false, message: 'Usuario no autenticado' })
    const { id } = req.params
    const r = await CycleCountService.applyAdjustments(id, userId)
    return res.status(200).json({ success: true, data: r })
  }
}

export default CycleCountController
