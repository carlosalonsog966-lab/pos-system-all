import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { validateData, z } from '../middleware/zodValidation'
import { RfidService } from '../services/rfidService'

const ingestSchema = z.object({ epcs: z.array(z.string().min(1)).min(1) })
const assignSchema = z.object({ epc: z.string().min(1) })

export class RfidController {
  static async ingest(req: AuthRequest, res: Response) {
    const v = await validateData(req.body, ingestSchema)
    if (!v.success) return res.status(400).json({ success: false, message: 'Errores de validación', errors: v.errors })
    const r = await RfidService.ingest({ epcs: v.data.epcs })
    return res.status(200).json({ success: true, data: r })
  }
  static async assign(req: AuthRequest, res: Response) {
    const { assetId } = req.params as any
    const v = await validateData(req.body, assignSchema)
    if (!v.success) return res.status(400).json({ success: false, message: 'Errores de validación', errors: v.errors })
    const r = await RfidService.assign(assetId, v.data.epc)
    return res.status(200).json({ success: true, data: r })
  }
}

export default RfidController
