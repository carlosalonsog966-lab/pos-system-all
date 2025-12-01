import React from 'react'
import { backendStatus, type BackendStatus as Status, initializeApiBaseUrl, checkBackendStatus } from '@/lib/api'
import { useNotificationStore } from '@/store/notificationStore'

const colorMap: Record<Status, string> = {
  ok: 'bg-green-600',
  no_health: 'bg-yellow-500',
  down: 'bg-red-600',
}

const labelMap: Record<Status, string> = {
  ok: 'Online',
  no_health: 'Servidor sin health',
  down: 'Offline',
}

const BackendStatusIndicator: React.FC = () => {
  const [status, setStatus] = React.useState<Status>(backendStatus.getLastStatus())
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    const cb = (s: Status) => setStatus(s)
    backendStatus.onStatus(cb)
    return () => backendStatus.offStatus(cb)
  }, [])
  const retry = async () => {
    setBusy(true)
    try {
      const base = await initializeApiBaseUrl()
      const s = await checkBackendStatus(base)
      backendStatus.applyOverride(s === 'ok' ? 'ok' : s)
      try {
        const notify = useNotificationStore.getState()
        if (s === 'ok') notify.showSuccess('Conexión restaurada')
        else notify.showError('Servidor no disponible', 'Sigue sin responder')
      } catch {}
    } finally {
      setBusy(false)
    }
  }
  const cls = colorMap[status] || 'bg-gray-600'
  const label = labelMap[status] || 'Desconocido'
  return (
    <div className="fixed bottom-2 left-2 z-[60] flex items-center gap-2">
      <div className={`px-2 py-1 text-xs text-white rounded ${cls}`}>{label}</div>
      {status !== 'ok' && (
        <button onClick={retry} disabled={busy} className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50">
          {busy ? 'Reintentando...' : 'Reintentar'}
        </button>
      )}
    </div>
  )
}

export default BackendStatusIndicator