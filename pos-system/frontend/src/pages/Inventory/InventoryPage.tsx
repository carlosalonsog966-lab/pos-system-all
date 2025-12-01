import React from 'react'
import { ClipboardDocumentListIcon, ArrowsRightLeftIcon, RadioIcon } from '@heroicons/react/24/outline'
import TransferPage from './TransferPage'
import CycleCountsPage from './CycleCountsPage'
import RfidPage from './RfidPage'

interface Props { testMode?: boolean }

const InventoryPage: React.FC<Props> = ({ testMode = false }) => {
  const [tab, setTab] = React.useState<'resumen' | 'transfer' | 'count' | 'rfid'>('resumen')

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-mono text-xl font-bold">Inventario de Productos</h1>
        <div className="flex gap-2">
          <button
            data-testid="inventory-summary-tab"
            className={`px-3 py-1 rounded ${tab==='resumen'?'bg-gray-800 text-white':'bg-gray-200 text-gray-800'}`}
            onClick={() => setTab('resumen')}
          >
            Resumen
          </button>
          <button
            data-testid="inventory-transfer-tab"
            className={`px-3 py-1 rounded ${tab==='transfer'?'bg-gray-800 text-white':'bg-gray-200 text-gray-800'}`}
            onClick={() => setTab('transfer')}
          >
            Transferencias
          </button>
          <button
            data-testid="inventory-count-tab"
            className={`px-3 py-1 rounded ${tab==='count'?'bg-gray-800 text-white':'bg-gray-200 text-gray-800'}`}
            onClick={() => setTab('count')}
          >
            Conteos
          </button>
          <button
            data-testid="inventory-rfid-tab"
            className={`px-3 py-1 rounded ${tab==='rfid'?'bg-gray-800 text-white':'bg-gray-200 text-gray-800'}`}
            onClick={() => setTab('rfid')}
          >
            RFID
          </button>
        </div>
      </div>

      {tab === 'resumen' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 p-4 bg-white rounded shadow">
            <h2 className="font-semibold mb-2">Búsqueda rápida</h2>
            <input
              data-testid="inventory-search-input"
              type="text"
              placeholder="Buscar por nombre, SKU, código de barras, marca..."
              className="input-field w-full"
            />
          </div>
          <div className="p-4 bg-white rounded shadow">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardDocumentListIcon className="w-5 h-5 text-gray-700" />
              <h2 className="font-semibold">Alertas de Stock</h2>
            </div>
            <p className="text-sm text-gray-600">Consulta productos con bajo stock y sin stock en la sección de Reportes.</p>
          </div>
          <div className="p-4 bg-white rounded shadow">
            <div className="flex items-center gap-2 mb-2">
              <ArrowsRightLeftIcon className="w-5 h-5 text-gray-700" />
              <h2 className="font-semibold">Transferencias</h2>
            </div>
            <p className="text-sm text-gray-600">Registra movimientos entre sucursales para mantener el balance del inventario.</p>
          </div>
        </div>
      )}

      {tab === 'transfer' && <TransferPage testMode={testMode} />}
      {tab === 'count' && <CycleCountsPage testMode={testMode} />}
      {tab === 'rfid' && <RfidPage />}
    </div>
  )
}

export default InventoryPage
