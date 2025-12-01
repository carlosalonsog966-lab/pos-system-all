import { api } from '@/lib/api'

export type WarrantyStatus = 'active' | 'expired' | 'void' | 'service'

export interface CreateWarrantyPayload {
  productAssetId: string
  saleId?: string
  startDate: string | Date
  months: number
  status?: WarrantyStatus
  terms?: string
  metadata?: Record<string, any>
}

export interface UpdateWarrantyPayload extends Partial<CreateWarrantyPayload> {}

export const WarrantiesService = {
  async list(params: { productAssetId?: string; saleId?: string; status?: WarrantyStatus; limit?: number; offset?: number } = {}) {
    const res = await api.get('/warranties', { params })
    return res.data
  },
  async getById(id: string) {
    const res = await api.get(`/warranties/${id}`)
    return res.data
  },
  async create(payload: CreateWarrantyPayload) {
    const res = await api.post('/warranties', payload)
    return res.data
  },
  async update(id: string, payload: UpdateWarrantyPayload) {
    const res = await api.put(`/warranties/${id}`, payload)
    return res.data
  },
  async remove(id: string) {
    const res = await api.delete(`/warranties/${id}`)
    return res.data
  },
}

export default WarrantiesService

