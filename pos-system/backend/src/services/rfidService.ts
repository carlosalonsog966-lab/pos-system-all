import ProductAsset from '../models/ProductAsset'

export const RfidService = {
  async ingest(payload: { epcs: string[] }) {
    const cleaned = Array.from(new Set((payload.epcs || []).map(s => s.trim()).filter(Boolean)))
    const assets = await ProductAsset.findAll({ where: { rfidEpc: cleaned } as any })
    const mapped = assets.map(a => ({ id: a.id, productId: a.productId, serial: a.serial, rfidEpc: a.rfidEpc }))
    const mappedEpcs = new Set(mapped.map(m => m.rfidEpc).filter(Boolean) as string[])
    const unmatched = cleaned.filter(e => !mappedEpcs.has(e))
    return { count: cleaned.length, mapped, unmatched }
  },
  async assign(assetId: string, epc: string) {
    const asset = await ProductAsset.findByPk(assetId)
    if (!asset) throw new Error('Activo no encontrado')
    await asset.update({ rfidEpc: epc })
    return { id: asset.id, serial: asset.serial, rfidEpc: asset.rfidEpc }
  },
}

export default RfidService
