import { Request, Response } from 'express'
import Product from '../models/Product'
import ProductAsset from '../models/ProductAsset'
import { BarcodeService } from '../services/BarcodeService'

export const LabelController = {
  async generateVitrineLabelForAsset(req: Request, res: Response) {
    try {
      const { id } = req.params
      const asset = await ProductAsset.findByPk(id)
      if (!asset) return res.status(404).json({ success: false, error: 'Asset no encontrado' })
      const product = await Product.findByPk(asset.productId)
      if (!product) return res.status(404).json({ success: false, error: 'Producto no encontrado para el asset' })
      const path = await BarcodeService.saveVitrineLabel(product.toJSON?.() || (product as any), asset.toJSON?.() || (asset as any))
      return res.status(200).json({ success: true, data: { filePath: path } })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || 'Error generando etiqueta de vitrina' })
    }
  },
}

export default LabelController

