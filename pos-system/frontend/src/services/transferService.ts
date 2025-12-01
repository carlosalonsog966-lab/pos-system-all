import { api } from '@/lib/api'

export async function requestTransfer(payload: { productId: string; quantity: number; fromBranchId: string; toBranchId: string; reference?: string; idempotencyKey?: string }) {
  const { data } = await api.post('/inventory/transfers/request', payload)
  return data
}

export async function listTransfers(params?: { status?: 'requested' | 'shipped' | 'received' | 'canceled'; page?: number; limit?: number }) {
  const { data } = await api.get('/inventory/transfers', { params })
  return data
}

export async function shipTransfer(id: string) {
  const { data } = await api.post(`/inventory/transfers/${id}/ship`)
  return data
}

export async function receiveTransfer(id: string) {
  const { data } = await api.post(`/inventory/transfers/${id}/receive`)
  return data
}
