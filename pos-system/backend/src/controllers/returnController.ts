import { Request, Response } from 'express'
import { sequelize } from '../db/config'
import { Sale } from '../models/Sale'
import { SaleItem } from '../models/SaleItem'
import { Product } from '../models/Product'
import { AuditTrailService } from '../services/AuditTrailService'

export const ReturnController = {
  async refundSale(req: Request, res: Response) {
    const { saleId } = req.params
    const { items, reason } = (req.body || {}) as { items?: Array<{ saleItemId?: string; productId?: string; quantity: number }>; reason?: string }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Se requieren items para devolución' })
    }
    const t = await sequelize.transaction()
    try {
      const sale = await Sale.findByPk(saleId, { transaction: t })
      if (!sale) {
        await t.rollback()
        return res.status(404).json({ success: false, error: 'Venta no encontrada' })
      }
      // Procesar devolución por item: reingreso de stock
      for (const it of items) {
        let productId = it.productId
        if (!productId && it.saleItemId) {
          const sItem = await SaleItem.findByPk(it.saleItemId, { transaction: t })
          productId = sItem ? (sItem as any).productId : undefined
        }
        if (!productId) continue
        const product = await Product.findByPk(productId, { transaction: t })
        if (!product) continue
        const qty = Number(it.quantity || 0)
        if (qty <= 0) continue
        await (product as any).updateStockWithLock(qty, 0, t)
        // Auditoría del movimiento de inventario
        try {
          await AuditTrailService.log({
            operation: 'inventory.return',
            entityType: 'product',
            entityId: productId,
            result: 'success',
            message: `Reingreso por devolución: +${qty}`,
            details: { saleId, reason: reason || 'return', quantity: qty },
            actor: (req as any).user || null,
            correlationId: (req.headers['x-correlation-id'] as string) || undefined,
          })
        } catch {}
      }
      // Marcar venta como refund si aplica
      await sale.update({ status: 'refunded' } as any, { transaction: t })
      await t.commit()
      return res.json({ success: true, data: { saleId, status: 'refunded' } })
    } catch (error) {
      await t.rollback()
      return res.status(500).json({ success: false, error: (error as Error).message })
    }
  },
}

export default ReturnController

