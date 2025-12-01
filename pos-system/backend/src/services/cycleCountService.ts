import { sequelize } from '../db/config'
import CycleCount from '../models/CycleCount'
import CycleCountItem from '../models/CycleCountItem'
import Product from '../models/Product'
import StockLedger from '../models/StockLedger'

export const CycleCountService = {
  async create(payload: { branchId?: string | null; type: 'cyclic' | 'general'; createdBy: string; tolerancePct?: number | null; note?: string | null }) {
    const count = await CycleCount.create({ branchId: payload.branchId ?? null, type: payload.type, status: 'pending', createdBy: payload.createdBy, tolerancePct: payload.tolerancePct ?? null, note: payload.note ?? null })
    return count
  },

  async list(params: { branchId?: string | null; status?: string | null; limit?: number; page?: number }) {
    const where: any = {}
    if (params.branchId) where.branchId = params.branchId
    if (params.status) where.status = params.status
    const limit = params.limit && params.limit > 0 ? params.limit : 50
    const page = params.page && params.page > 0 ? params.page : 1
    const offset = (page - 1) * limit
    const { rows, count } = await CycleCount.findAndCountAll({ where, limit, offset, order: [['createdAt', 'DESC']] })
    return { items: rows, pagination: { total: count, page, limit } }
  },

  async get(id: string) {
    const count = await CycleCount.findByPk(id)
    if (!count) throw new Error('Conteo no encontrado')
    const items = await CycleCountItem.findAll({ where: { cycleCountId: id }, order: [['createdAt', 'ASC']] })
    const totals = items.reduce((acc, it) => {
      acc.expected += it.expectedQty
      acc.counted += it.countedQty
      acc.difference += it.difference
      return acc
    }, { expected: 0, counted: 0, difference: 0 })
    return { count, items, totals }
  },

  async start(id: string) {
    const count = await CycleCount.findByPk(id)
    if (!count) throw new Error('Conteo no encontrado')
    await count.update({ status: 'in_progress', startedAt: new Date() })
    return count
  },

  async complete(id: string) {
    const count = await CycleCount.findByPk(id)
    if (!count) throw new Error('Conteo no encontrado')
    await count.update({ status: 'completed', completedAt: new Date() })
    return count
  },

  async preloadItemsFromBranch(id: string, branchId?: string | null) {
    const count = await CycleCount.findByPk(id)
    if (!count) throw new Error('Conteo no encontrado')
    const products = await Product.findAll({ where: { isActive: true }, order: [['name', 'ASC']] })
    const toCreate = products.map(p => ({ cycleCountId: id, productId: p.id, expectedQty: p.stock, countedQty: 0, difference: 0, resolved: false }))
    const created = await CycleCountItem.bulkCreate(toCreate)
    return { created: created.length }
  },

  async setItemCount(id: string, itemId: string, countedQty: number, countedBy?: string | null, reason?: string | null) {
    const item = await CycleCountItem.findOne({ where: { id: itemId, cycleCountId: id } })
    if (!item) throw new Error('Ítem no encontrado')
    const difference = countedQty - item.expectedQty
    await item.update({ countedQty, difference, countedBy: countedBy ?? null, reason: reason ?? null })
    return item
  },

  async applyAdjustments(id: string, userId: string) {
    const tx = await sequelize.transaction()
    try {
      const items = await CycleCountItem.findAll({ where: { cycleCountId: id }, transaction: tx, lock: tx.LOCK.UPDATE })
      for (const it of items) {
        if (it.difference === 0) continue
        const product = await Product.findByPk(it.productId as string, { transaction: tx })
        if (!product) continue
        const newStock = product.stock + it.difference
        if (newStock < 0) throw new Error('Stock insuficiente en ajuste')
        await product.updateStockWithLock(it.difference, 0, tx)
        await StockLedger.create({ productId: product.id, branchId: null, movementType: 'AJUSTE', quantityChange: it.difference, unitCost: product.purchasePrice as any, referenceType: 'ADJUSTMENT', referenceId: id }, { transaction: tx })
        await it.update({ resolved: true }, { transaction: tx })
      }
      await tx.commit()
      return { adjusted: items.filter(i => i.difference !== 0).length }
    } catch (e) {
      await tx.rollback()
      throw e
    }
  },
}

export default CycleCountService
