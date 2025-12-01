import { api } from '@/lib/api'

export interface CreateAppraisalPayload {
  productAssetId: string
  appraiser: string
  appraisalDate: string | Date
  value: number
  currency: string
  notes?: string
  metadata?: Record<string, any>
}

export interface UpdateAppraisalPayload extends Partial<CreateAppraisalPayload> {}

export const AppraisalsService = {
  async list(params: { productAssetId?: string; minDate?: string | Date; maxDate?: string | Date; limit?: number; offset?: number } = {}) {
    const res = await api.get('/appraisals', { params })
    return res.data
  },
  async getById(id: string) {
    const res = await api.get(`/appraisals/${id}`)
    return res.data
  },
  async create(payload: CreateAppraisalPayload) {
    const res = await api.post('/appraisals', payload)
    return res.data
  },
  async update(id: string, payload: UpdateAppraisalPayload) {
    const res = await api.put(`/appraisals/${id}`, payload)
    return res.data
  },
  async remove(id: string) {
    const res = await api.delete(`/appraisals/${id}`)
    return res.data
  },
}

export default AppraisalsService

