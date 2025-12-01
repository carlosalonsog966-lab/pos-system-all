import { sequelize } from '../db/config'
import StockTransfer from '../models/StockTransfer'
import Product from '../models/Product'
import StockLedger from '../models/StockLedger'

export const StockTransferService = {
  async request(payload: { productId: string; quantity: number; fromBranchId: string; toBranchId: string; requestedBy: string; reference?: string | null; idempotencyKey?: string | null }) {
    const t = await StockTransfer.create({ productId: payload.productId, quantity: payload.quantity, fromBranchId: payload.fromBranchId, toBranchId: payload.toBranchId, status: 'requested', requestedBy: payload.requestedBy, reference: payload.reference ?? null, idempotencyKey: payload.idempotencyKey ?? null })
    return t
  },

  async list(params: { status?: string | null; limit?: number; page?: number }) {
    const where: any = {}
    if (params.status) where.status = params.status
    const limit = params.limit && params.limit > 0 ? params.limit : 50
    const page = params.page && params.page > 0 ? params.page : 1
    const offset = (page - 1) * limit
    const { rows, count } = await StockTransfer.findAndCountAll({ where, limit, offset, order: [['createdAt', 'DESC']] })
    return { items: rows, pagination: { total: count, page, limit } }
  },

  async ship(id: string, userId: string) {
    const tx = await sequelize.transaction()
    try {
      const tr = await StockTransfer.findByPk(id, { transaction: tx, lock: tx.LOCK.UPDATE })
      if (!tr) throw new Error('Transferencia no encontrada')
      if (tr.status !== 'requested') throw new Error('Estado inválido para envío')
      const product = await Product.findByPk(tr.productId, { transaction: tx })
      if (!product) throw new Error('Producto no encontrado')
      if (product.stock < tr.quantity) throw new Error('Stock insuficiente')
      await product.updateStockWithLock(-tr.quantity, 0, tx)
      await StockLedger.create({ productId: tr.productId, branchId: tr.fromBranchId, movementType: 'TRANSFERENCIA_SALIDA', quantityChange: -tr.quantity, unitCost: product.purchasePrice as any, referenceType: 'TRANSFER', referenceId: tr.id }, { transaction: tx })
      await tr.update({ status: 'shipped', shippedBy: userId }, { transaction: tx })
      await tx.commit()
      return tr
    } catch (e) {
      await tx.rollback()
      throw e
    }
  },

  async receive(id: string, userId: string) {
    const tx = await sequelize.transaction()
    try {
      const tr = await StockTransfer.findByPk(id, { transaction: tx, lock: tx.LOCK.UPDATE })
      if (!tr) throw new Error('Transferencia no encontrada')
      if (tr.status !== 'shipped') throw new Error('Estado inválido para recepción')
      const product = await Product.findByPk(tr.productId, { transaction: tx })
      if (!product) throw new Error('Producto no encontrado')
      await product.updateStockWithLock(tr.quantity, 0, tx)
      await StockLedger.create({ productId: tr.productId, branchId: tr.toBranchId, movementType: 'TRANSFERENCIA_ENTRADA', quantityChange: tr.quantity, unitCost: product.purchasePrice as any, referenceType: 'TRANSFER', referenceId: tr.id }, { transaction: tx })
      await tr.update({ status: 'received', receivedBy: userId }, { transaction: tx })
      await tx.commit()
      return tr
    } catch (e) {
      await tx.rollback()
      throw e
    }
  },
}

export default StockTransferService
