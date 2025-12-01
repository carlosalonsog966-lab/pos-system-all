import { api } from '@/lib/api'

export async function ingestEpcs(epcs: string[]) {
  const { data } = await api.post('/inventory/rfid/ingest', { epcs })
  return data
}

export async function assignEpc(assetId: string, epc: string) {
  const { data } = await api.post(`/inventory/rfid/assign/${assetId}`, { epc })
  return data
}
