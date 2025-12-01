import React from 'react'
import { getProductBalance, reconcileProduct } from '@/services/inventoryService'
import { useNotificationStore } from '@/store/notificationStore'

interface Props { testMode?: boolean }

const StockCountPage: React.FC<Props> = ({ testMode = false }) => {
  const { showSuccess, showError } = useNotificationStore()
  const [productId, setProductId] = React.useState('')
  const [balance, setBalance] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (testMode) {
      setProductId('prod-001')
    }
  }, [testMode])

  const fetchBalance = async () => {
    setLoading(true)
    try {
      if (!productId) throw new Error('Ingresa un ID de producto')
      const data = await getProductBalance(productId)
      setBalance(Number(data?.data?.balance ?? 0))
    } catch (err: any) {
      showError(err?.message || 'Error al consultar balance')
    } finally {
      setLoading(false)
    }
  }

  const doReconcile = async () => {
    setLoading(true)
    try {
      if (!productId) throw new Error('Ingresa un ID de producto')
      await reconcileProduct(productId)
      showSuccess('Producto reconciliado')
      await fetchBalance()
    } catch (err: any) {
      showError(err?.message || 'Error al reconciliar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded shadow p-4">
      <h2 className="font-semibold mb-3">Conteo y Reconciliación</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-sm">Producto (ID)</label>
          <input className="input-field" value={productId} onChange={e=>setProductId(e.target.value)} placeholder="prod-001" />
        </div>
        <div className="flex items-end gap-2">
          <button className="px-3 py-2 bg-gray-800 text-white rounded disabled:opacity-50" onClick={fetchBalance} disabled={loading}>Consultar Balance</button>
          <button className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-50" onClick={doReconcile} disabled={loading}>Reconciliar</button>
        </div>
      </div>
      <div className="mt-4">
        <p className="text-sm text-gray-700">Balance actual: {balance === null ? '—' : balance}</p>
      </div>
    </div>
  )
}

export default StockCountPage

