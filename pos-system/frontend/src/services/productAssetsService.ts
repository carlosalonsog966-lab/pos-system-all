import { api } from '@/lib/api'

export interface CreateProductAssetPayload {
  productId: string
  serial: string
  status?: 'available' | 'reserved' | 'sold' | 'service'
  hallmark?: string
  condition?: string
  location?: string
  qrPayload?: string
  metadata?: Record<string, any>
}

export interface UpdateProductAssetPayload {
  status?: 'available' | 'reserved' | 'sold' | 'service'
  hallmark?: string
  condition?: string
  location?: string
  qrPayload?: string
  metadata?: Record<string, any>
}

export interface ProductAssetQuery {
  productId?: string
  status?: 'available' | 'reserved' | 'sold' | 'service'
  q?: string
  limit?: number
  offset?: number
}

export const ProductAssetsService = {
  async list(query: ProductAssetQuery = {}) {
    const res = await api.get(`/product-assets`, { params: query })
    return res.data
  },

  async getById(id: string) {
    const res = await api.get(`/product-assets/${id}`)
    return res.data
  },

  async create(payload: CreateProductAssetPayload) {
    const res = await api.post(`/product-assets`, payload)
    return res.data
  },

  async update(id: string, payload: UpdateProductAssetPayload) {
    const res = await api.put(`/product-assets/${id}`, payload)
    return res.data
  },

  async remove(id: string) {
    const res = await api.delete(`/product-assets/${id}`)
    return res.data
  },

  async generateLabel(payload: { codigo: string; serial: string; nombre?: string; categoria?: string; precio?: number; metal?: string; peso?: number; hallmark?: string }) {
    const res = await api.post(`/offline/label/asset`, payload)
    return res.data
  },
  async generateVitrineLabelForAsset(assetId: string) {
    const res = await api.post(`/labels/product-assets/${encodeURIComponent(assetId)}/vitrine`)
    return res.data
  },
}

export default ProductAssetsService
