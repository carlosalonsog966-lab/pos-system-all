import { api } from '@/lib/api'

export interface TransferPayload {
  productId: string
  quantity: number
  fromBranchId: string
  toBranchId: string
  reason?: string
  reference?: string
  idempotencyKey?: string
}

export async function updateStock(productId: string, type: 'in' | 'out' | 'adjustment' | 'transfer', quantity: number, reason?: string, idempotencyKey?: string, reference?: string, notes?: string) {
  const { data } = await api.post('/inventory/update-stock', {
    productId,
    type,
    quantity,
    reason,
    reference,
    notes,
    idempotencyKey,
  })
  return data
}

export async function bulkUpdateStock(updates: Array<{ productId: string; newStock: number; reason: string; notes?: string }>, idempotencyKey?: string) {
  const { data } = await api.post('/inventory/bulk-update', { updates, idempotencyKey })
  return data
}

export async function transferStock(payload: TransferPayload) {
  const { data } = await api.post('/inventory/transfer', payload)
  return data
}

export async function getStockAlerts() {
  const { data } = await api.get('/inventory/alerts')
  return data
}

export async function getLowStockProducts() {
  const { data } = await api.get('/inventory/low-stock')
  return data
}

export async function getStockHistory(productId: string, page = 1, limit = 20) {
  const { data } = await api.get(`/inventory/products/${productId}/history`, { params: { page, limit } })
  return data
}

export async function getProductBalance(productId: string, branchId?: string) {
  const { data } = await api.get(`/inventory/products/${productId}/balance`, { params: { branchId } })
  return data
}

export async function reconcileProduct(productId: string) {
  const { data } = await api.post(`/inventory/products/${productId}/reconcile`)
  return data
}

export async function reconcileAllProducts() {
  const { data } = await api.post('/inventory/reconcile')
  return data
}
