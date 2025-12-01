import React from 'react'
import ProductAssetsService from '@/services/productAssetsService'
import CertificationsService from '@/services/certificationsService'
import WarrantiesService from '@/services/warrantiesService'
import AppraisalsService from '@/services/appraisalsService'
import LoadingSpinner from '@/components/Common/LoadingSpinner'
import { useNotificationStore } from '@/store/notificationStore'

export const AssetDocumentsPage: React.FC<{ assetId?: string }> = ({ assetId: propAssetId }) => {
  const [assetId, setAssetId] = React.useState<string>(propAssetId || '')
  const [asset, setAsset] = React.useState<any | null>(null)
  const [loading, setLoading] = React.useState(false)
  const { showSuccess, showError } = useNotificationStore()

  const [certs, setCerts] = React.useState<any[]>([])
  const [warrants, setWarrants] = React.useState<any[]>([])
  const [apps, setApps] = React.useState<any[]>([])

  const loadAll = React.useCallback(async () => {
    if (!assetId) return
    setLoading(true)
    try {
      const assetResp = await ProductAssetsService.getById(assetId)
      setAsset(assetResp?.data ?? assetResp)
      const certResp = await CertificationsService.list({ productAssetId: assetId })
      setCerts(certResp?.data ?? certResp)
      const warrResp = await WarrantiesService.list({ productAssetId: assetId })
      setWarrants(warrResp?.data ?? warrResp)
      const appResp = await AppraisalsService.list({ productAssetId: assetId })
      setApps(appResp?.data ?? appResp)
    } catch (e: any) {
      showError('No se pudieron cargar los documentos del asset')
    } finally {
      setLoading(false)
    }
  }, [assetId, showError])

  React.useEffect(() => { loadAll() }, [loadAll])

  const [newCert, setNewCert] = React.useState({ type: 'GIA', authority: '', certificateNumber: '', issueDate: new Date().toISOString().slice(0,10), expiryDate: '' })
  const [newWarr, setNewWarr] = React.useState({ startDate: new Date().toISOString().slice(0,10), months: 12, terms: '' })
  const [newApp, setNewApp] = React.useState({ appraiser: '', appraisalDate: new Date().toISOString().slice(0,10), value: 0, currency: 'USD', notes: '' })

  const createCert = async () => {
    try {
      await CertificationsService.create({ 
        productAssetId: assetId, 
        type: newCert.type as 'GIA' | 'IGI' | 'HRD' | 'Other', 
        authority: newCert.authority, 
        certificateNumber: newCert.certificateNumber, 
        issueDate: newCert.issueDate as any, 
        expiryDate: newCert.expiryDate as any 
      })
      showSuccess('Certificación creada')
      loadAll()
    } catch { showError('Error creando certificación') }
  }
  const createWarr = async () => {
    try {
      await WarrantiesService.create({ productAssetId: assetId, startDate: newWarr.startDate as any, months: newWarr.months, terms: newWarr.terms })
      showSuccess('Garantía creada')
      loadAll()
    } catch { showError('Error creando garantía') }
  }
  const createApp = async () => {
    try {
      await AppraisalsService.create({ productAssetId: assetId, ...newApp } as any)
      showSuccess('Tasación creada')
      loadAll()
    } catch { showError('Error creando tasación') }
  }

  const genLabel = async () => {
    try { await ProductAssetsService.generateVitrineLabelForAsset(assetId); showSuccess('Etiqueta de vitrina generada') } catch { showError('Error generando etiqueta') }
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-3">Documentos de Asset</h1>
      <div className="mb-4 flex gap-2 items-center">
        <input className="border px-2 py-1" placeholder="Asset ID" value={assetId} onChange={e => setAssetId(e.target.value)} />
        <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={loadAll}>Cargar</button>
        <button className="px-3 py-1 bg-gray-800 text-white rounded" onClick={genLabel} disabled={!assetId}>Etiqueta vitrina</button>
      </div>
      {loading && <LoadingSpinner size="md" />}
      {asset && (
        <div className="mb-4 text-sm text-gray-700">Serial: {asset.serial} · Estado: {asset.status} · Producto: {(asset as any)?.productId}</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <h2 className="font-medium mb-2">Certificaciones</h2>
          <ul className="mb-2 text-sm">
            {certs.map((c) => (
              <li key={c.id}>#{c.certificateNumber} · {c.type} · {new Date(c.issueDate).toLocaleDateString()}</li>
            ))}
          </ul>
          <div className="space-y-2">
            <input className="border px-2 py-1 w-full" placeholder="Autoridad" value={newCert.authority} onChange={e=>setNewCert({ ...newCert, authority: e.target.value })} />
            <input className="border px-2 py-1 w-full" placeholder="Número de certificado" value={newCert.certificateNumber} onChange={e=>setNewCert({ ...newCert, certificateNumber: e.target.value })} />
            <select className="border px-2 py-1 w-full" value={newCert.type} onChange={e=>setNewCert({ ...newCert, type: e.target.value })}>
              <option value="GIA">GIA</option>
              <option value="IGI">IGI</option>
              <option value="HRD">HRD</option>
              <option value="Other">Otra</option>
            </select>
            <div className="flex gap-2">
              <input className="border px-2 py-1 w-1/2" type="date" value={newCert.issueDate as any} onChange={e=>setNewCert({ ...newCert, issueDate: e.target.value })} />
              <input className="border px-2 py-1 w-1/2" type="date" value={newCert.expiryDate as any} onChange={e=>setNewCert({ ...newCert, expiryDate: e.target.value })} />
            </div>
            <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={createCert} disabled={!assetId}>Crear certificación</button>
          </div>
        </div>
        <div>
          <h2 className="font-medium mb-2">Garantías</h2>
          <ul className="mb-2 text-sm">
            {warrants.map((w) => (
              <li key={w.id}>{new Date(w.startDate).toLocaleDateString()} · {w.months} meses · {w.status}</li>
            ))}
          </ul>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input className="border px-2 py-1 w-1/2" type="date" value={newWarr.startDate as any} onChange={e=>setNewWarr({ ...newWarr, startDate: e.target.value })} />
              <input className="border px-2 py-1 w-1/2" type="number" value={newWarr.months} onChange={e=>setNewWarr({ ...newWarr, months: Number(e.target.value) })} />
            </div>
            <textarea className="border px-2 py-1 w-full" placeholder="Términos" value={newWarr.terms} onChange={e=>setNewWarr({ ...newWarr, terms: e.target.value })} />
            <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={createWarr} disabled={!assetId}>Crear garantía</button>
          </div>
        </div>
        <div>
          <h2 className="font-medium mb-2">Tasaciones</h2>
          <ul className="mb-2 text-sm">
            {apps.map((a) => (
              <li key={a.id}>{new Date(a.appraisalDate).toLocaleDateString()} · {a.appraiser} · {a.value} {a.currency}</li>
            ))}
          </ul>
          <div className="space-y-2">
            <input className="border px-2 py-1 w-full" placeholder="Tasador" value={newApp.appraiser} onChange={e=>setNewApp({ ...newApp, appraiser: e.target.value })} />
            <div className="flex gap-2">
              <input className="border px-2 py-1 w-1/2" type="date" value={newApp.appraisalDate as any} onChange={e=>setNewApp({ ...newApp, appraisalDate: e.target.value })} />
              <input className="border px-2 py-1 w-1/2" type="number" value={newApp.value} onChange={e=>setNewApp({ ...newApp, value: Number(e.target.value) })} />
            </div>
            <div className="flex gap-2">
              <input className="border px-2 py-1 w-1/2" placeholder="Moneda (ISO)" value={newApp.currency} onChange={e=>setNewApp({ ...newApp, currency: e.target.value.toUpperCase() })} />
              <input className="border px-2 py-1 w-1/2" placeholder="Notas" value={newApp.notes} onChange={e=>setNewApp({ ...newApp, notes: e.target.value })} />
            </div>
            <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={createApp} disabled={!assetId}>Crear tasación</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AssetDocumentsPage
