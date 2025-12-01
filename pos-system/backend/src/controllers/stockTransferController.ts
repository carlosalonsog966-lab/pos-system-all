import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { validateData, z } from '../middleware/zodValidation'
import { StockTransferService } from '../services/stockTransferService'

const requestSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
  fromBranchId: z.string().uuid(),
  toBranchId: z.string().uuid(),
  reference: z.string().max(200).optional(),
  idempotencyKey: z.string().max(100).optional(),
})

const listSchema = z.object({ status: z.enum(['requested', 'shipped', 'received', 'canceled']).optional(), page: z.number().min(1).optional(), limit: z.number().min(1).max(200).optional() })

export class StockTransferController {
  static async request(req: AuthRequest, res: Response) {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ success: false, message: 'Usuario no autenticado' })
    const v = await validateData(req.body, requestSchema)
    if (!v.success) return res.status(400).json({ success: false, message: 'Errores de validación', errors: v.errors })
    const r = await StockTransferService.request({ ...v.data, requestedBy: userId })
    return res.status(200).json({ success: true, data: r })
  }

  static async list(req: AuthRequest, res: Response) {
    const v = await validateData(req.query, listSchema)
    if (!v.success) return res.status(400).json({ success: false, message: 'Errores de validación', errors: v.errors })
    const r = await StockTransferService.list({ status: v.data.status ?? null, page: v.data.page, limit: v.data.limit })
    return res.status(200).json({ success: true, data: r })
  }

  static async ship(req: AuthRequest, res: Response) {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ success: false, message: 'Usuario no autenticado' })
    const { id } = req.params
    const r = await StockTransferService.ship(id, userId)
    return res.status(200).json({ success: true, data: r })
  }

  static async receive(req: AuthRequest, res: Response) {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ success: false, message: 'Usuario no autenticado' })
    const { id } = req.params
    const r = await StockTransferService.receive(id, userId)
    return res.status(200).json({ success: true, data: r })
  }
}

export default StockTransferController
