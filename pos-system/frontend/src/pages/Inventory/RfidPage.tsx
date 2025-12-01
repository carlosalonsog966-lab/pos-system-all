import React from 'react'
import { useNotificationStore } from '@/store/notificationStore'
import { ingestEpcs, assignEpc } from '@/services/rfidService'

const RfidPage: React.FC = () => {
  const { showSuccess, showError } = useNotificationStore()
  const [input, setInput] = React.useState('')
  const [mapped, setMapped] = React.useState<any[]>([])
  const [unmatched, setUnmatched] = React.useState<string[]>([])

  const onIngest = async () => {
    try {
      const epcs = input.split(/\s|,|;/).map(s => s.trim()).filter(Boolean)
      const r = await ingestEpcs(epcs)
      setMapped(r?.data?.mapped ?? [])
      setUnmatched(r?.data?.unmatched ?? [])
      showSuccess('EPCs procesados')
    } catch (e: any) {
      showError(e?.message || 'Error procesando EPCs')
    }
  }

  const onAssign = async (assetId: string, epc: string) => {
    try {
      await assignEpc(assetId, epc)
      showSuccess('Asignado')
    } catch (e: any) { showError(e?.message || 'Error asignando') }
  }

  return (
    <div className="bg-white rounded shadow p-4">
      <h2 className="font-semibold mb-3">RFID</h2>
      <textarea className="w-full input-field h-24" placeholder="Pega EPCs separados por espacio, coma o punto y coma" value={input} onChange={e=>setInput(e.target.value)} />
      <div className="mt-2">
        <button className="px-3 py-2 bg-gray-800 text-white rounded" onClick={onIngest}>Procesar</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div>
          <h3 className="font-semibold mb-2">Mapeados</h3>
          <ul className="divide-y">
            {mapped.map(m => (
              <li key={m.id} className="py-2 text-sm">
                <div>{m.serial} · {m.rfidEpc}</div>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold mb-2">Sin coincidencia</h3>
          <ul className="divide-y">
            {unmatched.map(e => (
              <li key={e} className="py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span>{e}</span>
                  <input className="input-field w-64" placeholder="Asset ID" id={`asset-${e}`} />
                  <button className="px-2 py-1 bg-blue-600 text-white rounded" onClick={()=>{
                    const assetIdInput = document.getElementById(`asset-${e}`) as HTMLInputElement
                    const assetId = assetIdInput?.value || ''
                    if (!assetId) { showError('Ingresa Asset ID'); return }
                    onAssign(assetId, e)
                  }}>Asignar</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default RfidPage
