import { api } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';
import { useProductsStore } from '@/store/productsStore';
import { useClientsStore } from '@/store/clientsStore';

function mergeById<T extends { id: string; updatedAt?: string }>(current: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  for (const c of current) map.set(c.id, c);
  for (const n of incoming) {
    const prev = map.get(n.id);
    if (!prev) { map.set(n.id, n); continue; }
    const pu = prev.updatedAt ? Date.parse(prev.updatedAt) : 0;
    const nu = n.updatedAt ? Date.parse(n.updatedAt) : 0;
    map.set(n.id, nu >= pu ? { ...prev, ...n } : prev);
  }
  return Array.from(map.values());
}

export async function syncDownloadEntities() {
  const { selectedBranchId } = useBranchStore.getState();
  if (!selectedBranchId) return;
  const productsResp = await api.get('/sync/download', { params: { entity: 'products', branchId: selectedBranchId }, __suppressGlobalError: true } as any);
  const clientsResp = await api.get('/sync/download', { params: { entity: 'clients', branchId: selectedBranchId }, __suppressGlobalError: true } as any);
  const pItems = (productsResp.data?.data ?? productsResp.data ?? []) as any[];
  const cItems = (clientsResp.data?.data ?? clientsResp.data ?? []) as any[];
  const pStore = useProductsStore.getState();
  const cStore = useClientsStore.getState();
  pStore.setProducts(mergeById<any>(Array.isArray(pStore.products) ? pStore.products : [], Array.isArray(pItems) ? pItems : []));
  cStore.setClients(mergeById<any>(Array.isArray(cStore.clients) ? cStore.clients : [], Array.isArray(cItems) ? cItems : []));
}
