import React from 'react'
import { requestTransfer, listTransfers, shipTransfer, receiveTransfer } from '@/services/transferService'
import { useNotificationStore } from '@/store/notificationStore'

interface Props { testMode?: boolean }

const TransferPage: React.FC<Props> = ({ testMode = false }) => {
  const { showSuccess, showError } = useNotificationStore()
  const [productId, setProductId] = React.useState('')
  const [quantity, setQuantity] = React.useState<number>(1)
  const [fromBranchId, setFromBranchId] = React.useState('')
  const [toBranchId, setToBranchId] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [transfers, setTransfers] = React.useState<any[]>([])

  const reload = async () => {
    try {
      const r = await listTransfers({ limit: 50 })
      setTransfers(r?.data?.items ?? [])
    } catch (e: any) {
      showError(e?.message || 'Error listando transferencias')
    }
  }

  React.useEffect(() => { reload() }, [])

  React.useEffect(() => {
    if (testMode) {
      setProductId('prod-001')
      setFromBranchId('branch-a')
      setToBranchId('branch-b')
      setReason('Test transfer')
      setQuantity(2)
    }
  }, [testMode])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (!productId || !fromBranchId || !toBranchId || quantity <= 0) {
        throw new Error('Completa todos los campos y cantidad > 0')
      }
      const idempotencyKey = `transfer-${productId}-${Date.now()}`
      await requestTransfer({ productId, quantity, fromBranchId, toBranchId, reference: reason, idempotencyKey })
      showSuccess(
        'Transferencia solicitada exitosamente',
        `Producto: ${productId} | Cantidad: ${quantity} | De: ${fromBranchId} → A: ${toBranchId} | Motivo: ${reason}`
      )
      await reload()
    } catch (err: any) {
      showError(err?.message || 'Error al transferir stock')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded shadow p-4">
      <h2 className="font-semibold mb-3">Registrar Transferencia</h2>
      <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={onSubmit}>
        <div>
          <label className="text-sm">Producto (ID)</label>
          <input 
            data-testid="transfer-product-id-input"
            className="input-field" 
            value={productId} 
            onChange={e=>setProductId(e.target.value)} 
            placeholder="prod-001" 
          />
        </div>
        <div>
          <label className="text-sm">Cantidad</label>
          <input 
            data-testid="transfer-quantity-input"
            className="input-field" 
            type="number" 
            value={quantity} 
            onChange={e=>setQuantity(Number(e.target.value))} 
          />
        </div>
        <div>
          <label className="text-sm">Sucursal Origen</label>
          <input 
            data-testid="transfer-from-branch-input"
            className="input-field" 
            value={fromBranchId} 
            onChange={e=>setFromBranchId(e.target.value)} 
            placeholder="branch-a" 
          />
        </div>
        <div>
          <label className="text-sm">Sucursal Destino</label>
          <input 
            data-testid="transfer-to-branch-input"
            className="input-field" 
            value={toBranchId} 
            onChange={e=>setToBranchId(e.target.value)} 
            placeholder="branch-b" 
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-sm">Motivo</label>
          <input 
            data-testid="transfer-reason-input"
            className="input-field" 
            value={reason} 
            onChange={e=>setReason(e.target.value)} 
            placeholder="Reabastecimiento" 
          />
        </div>
        <div className="md:col-span-2">
          <button 
            data-testid="transfer-submit-button"
            type="submit" 
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50" 
            disabled={loading}
          >
            {loading ? 'Procesando...' : 'Registrar'}
          </button>
        </div>
      </form>
      <div className="mt-6">
        <h3 className="font-semibold mb-2">Transferencias</h3>
        <div className="overflow-auto max-h-80 border rounded">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left">ID</th>
                <th className="p-2 text-left">Producto</th>
                <th className="p-2 text-right">Cantidad</th>
                <th className="p-2 text-left">Estado</th>
                <th className="p-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map(t => (
                <tr key={t.id} className="border-t">
                  <td className="p-2">{t.id}</td>
                  <td className="p-2">{t.productId}</td>
                  <td className="p-2 text-right">{t.quantity}</td>
                  <td className="p-2">{t.status}</td>
                  <td className="p-2 text-right">
                    {t.status==='requested' && (
                      <button 
                        data-testid="transfer-ship-button"
                        className="px-2 py-1 bg-gray-800 text-white rounded mr-2" 
                        onClick={async()=>{ 
                          setLoading(true); 
                          try { 
                            await shipTransfer(t.id); 
                            showSuccess(
                              'Transferencia enviada exitosamente',
                              `ID: ${t.id} | Producto: ${t.productId} | Cantidad: ${t.quantity}`
                            );
                            await reload(); 
                          } catch(e:any){ 
                            showError(e?.message||'Error al enviar') 
                          } finally{ 
                            setLoading(false) 
                          } 
                        }}
                      >
                        Enviar
                      </button>
                    )}
                    {t.status==='shipped' && (
                      <button 
                        data-testid="transfer-receive-button"
                        className="px-2 py-1 bg-green-600 text-white rounded" 
                        onClick={async()=>{ 
                          setLoading(true); 
                          try { 
                            await receiveTransfer(t.id); 
                            showSuccess(
                              'Transferencia recibida exitosamente',
                              `ID: ${t.id} | Producto: ${t.productId} | Cantidad: ${t.quantity}`
                            );
                            await reload(); 
                          } catch(e:any){ 
                            showError(e?.message||'Error al recibir') 
                          } finally{ 
                            setLoading(false) 
                          } 
                        }}
                      >
                        Recibir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default TransferPage
