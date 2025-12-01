import React from 'react'
import { useNotificationStore } from '@/store/notificationStore'
import { createCycleCount, listCycleCounts, getCycleCount, startCycleCount, preloadCycleCountItems, setItemCount, applyAdjustments, completeCycleCount } from '@/services/cycleCountsService'

const CycleCountsPage: React.FC<{ testMode?: boolean }> = ({ testMode = false }) => {
  const { showSuccess, showError } = useNotificationStore()
  const [counts, setCounts] = React.useState<any[]>([])
  const [selectedId, setSelectedId] = React.useState<string>('')
  const [details, setDetails] = React.useState<any | null>(null)
  const [loading, setLoading] = React.useState(false)

  const reload = async () => {
    try {
      const r = await listCycleCounts({ limit: 50 })
      setCounts(r?.data?.items ?? [])
    } catch (e: any) {
      showError(e?.message || 'Error listando conteos')
    }
  }

  React.useEffect(() => { reload() }, [])

  const create = async () => {
    setLoading(true)
    try {
      const r = await createCycleCount({ type: 'general' })
      const id = r?.data?.id || r?.data?.data?.id
      if (id) {
        setSelectedId(id)
        await startCycleCount(id)
        await preloadCycleCountItems(id)
        await loadDetails(id)
      showSuccess(
        'Conteo cíclico creado exitosamente',
        `ID: ${id} | Tipo: ${r?.data?.type} | Estado: Iniciado`
      )
        await reload()
      }
    } catch (e: any) {
      showError(e?.message || 'Error creando conteo')
    } finally { setLoading(false) }
  }

  const loadDetails = async (id: string) => {
    setLoading(true)
    try {
      const r = await getCycleCount(id)
      setDetails(r?.data || r)
    } catch (e: any) { showError(e?.message || 'Error obteniendo detalles') }
    finally { setLoading(false) }
  }

  const updateItem = async (itemId: string, countedQty: number) => {
    if (!selectedId) return
    setLoading(true)
    try {
      await setItemCount(selectedId, itemId, countedQty)
      await loadDetails(selectedId)
      showSuccess(
        'Cantidad actualizada exitosamente',
        `Item: ${itemId} | Nueva cantidad: ${countedQty}`
      )
    } catch (e: any) { showError(e?.message || 'Error actualizando ítem') }
    finally { setLoading(false) }
  }

  const apply = async () => {
    if (!selectedId) return
    setLoading(true)
    try {
      await applyAdjustments(selectedId)
      await completeCycleCount(selectedId)
      await loadDetails(selectedId)
      showSuccess(
        'Ajustes de inventario aplicados exitosamente',
        `Conteo: ${selectedId} | Esperado: ${details.totals?.expected} | Contado: ${details.totals?.counted} | Diferencia: ${details.totals?.difference}`
      )
      await reload()
    } catch (e: any) { showError(e?.message || 'Error aplicando ajustes') }
    finally { setLoading(false) }
  }

  return (
    <div className="bg-white rounded shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Conteos Cíclicos</h2>
        <button 
          data-testid="cycle-count-create-button"
          className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-50" 
          onClick={create} 
          disabled={loading}
        >
          Nuevo Conteo
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <ul className="divide-y">
            {counts.map((c) => (
              <li 
                data-testid={`cycle-count-item-${c.id}`}
                key={c.id} 
                className={`py-2 cursor-pointer ${selectedId===c.id?'font-semibold':''}`} 
                onClick={() => { setSelectedId(c.id); loadDetails(c.id) }}
              >
                <div data-testid="cycle-count-type-status" className="text-sm">{c.type} · {c.status}</div>
                <div data-testid="cycle-count-date" className="text-xs text-gray-600">{new Date(c.createdAt).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-2">
          {details ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm">Esperado: {details.totals?.expected} · Contado: {details.totals?.counted} · Diferencia: {details.totals?.difference}</div>
                <button 
                  data-testid="cycle-count-apply-button"
                  className="px-3 py-2 bg-green-600 text-white rounded disabled:opacity-50" 
                  onClick={apply} 
                  disabled={loading}
                >
                  Aplicar Ajustes
                </button>
              </div>
              <div className="overflow-auto max-h-96 border rounded">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 text-left">Producto</th>
                      <th className="p-2 text-right">Esperado</th>
                      <th className="p-2 text-right">Contado</th>
                      <th className="p-2 text-right">Dif.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(details.items||[]).map((it: any) => (
                      <tr key={it.id} className="border-t">
                        <td className="p-2">{it.productId || it.productAssetId}</td>
                        <td className="p-2 text-right">{it.expectedQty}</td>
                        <td className="p-2 text-right">
                          <input 
                            data-testid={`cycle-count-item-input-${it.id}`}
                            type="number" 
                            className="w-24 input-field" 
                            value={it.countedQty} 
                            onChange={(e)=>updateItem(it.id, Number(e.target.value))} 
                          />
                        </td>
                        <td className="p-2 text-right">{it.difference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600">Selecciona un conteo para ver detalles</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default CycleCountsPage
