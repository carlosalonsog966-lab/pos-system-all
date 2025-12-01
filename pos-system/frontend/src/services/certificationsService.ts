import { api } from '@/lib/api'

export interface CreateCertificationPayload {
  productAssetId: string
  type: 'GIA' | 'IGI' | 'HRD' | 'Other'
  authority: string
  certificateNumber: string
  issueDate: string | Date
  expiryDate?: string | Date
  metadata?: Record<string, any>
}

export interface UpdateCertificationPayload extends Partial<CreateCertificationPayload> {}

export const CertificationsService = {
  async list(params: { productAssetId?: string; type?: string; q?: string; limit?: number; offset?: number } = {}) {
    const res = await api.get('/certifications', { params })
    return res.data
  },
  async getById(id: string) {
    const res = await api.get(`/certifications/${id}`)
    return res.data
  },
  async create(payload: CreateCertificationPayload) {
    const res = await api.post('/certifications', payload)
    return res.data
  },
  async update(id: string, payload: UpdateCertificationPayload) {
    const res = await api.put(`/certifications/${id}`, payload)
    return res.data
  },
  async remove(id: string) {
    const res = await api.delete(`/certifications/${id}`)
    return res.data
  },
}

export default CertificationsService

