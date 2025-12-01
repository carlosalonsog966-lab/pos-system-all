import { api } from '@/lib/api'

export async function createCycleCount(payload: { branchId?: string; type: 'cyclic' | 'general'; tolerancePct?: number; note?: string }) {
  const { data } = await api.post('/inventory/cycle-counts', payload)
  return data
}

export async function listCycleCounts(params?: { branchId?: string; status?: 'pending' | 'in_progress' | 'completed' | 'canceled'; page?: number; limit?: number }) {
  const { data } = await api.get('/inventory/cycle-counts', { params })
  return data
}

export async function getCycleCount(id: string) {
  const { data } = await api.get(`/inventory/cycle-counts/${id}`)
  return data
}

export async function startCycleCount(id: string) {
  const { data } = await api.post(`/inventory/cycle-counts/${id}/start`)
  return data
}

export async function completeCycleCount(id: string) {
  const { data } = await api.post(`/inventory/cycle-counts/${id}/complete`)
  return data
}

export async function preloadCycleCountItems(id: string, branchId?: string) {
  const { data } = await api.post(`/inventory/cycle-counts/${id}/preload`, { branchId })
  return data
}

export async function setItemCount(id: string, itemId: string, countedQty: number, countedBy?: string, reason?: string) {
  const { data } = await api.post(`/inventory/cycle-counts/${id}/items/${itemId}/count`, { countedQty, countedBy, reason })
  return data
}

export async function applyAdjustments(id: string) {
  const { data } = await api.post(`/inventory/cycle-counts/${id}/apply-adjustments`)
  return data
}
