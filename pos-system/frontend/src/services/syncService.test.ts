import { describe, it, expect } from 'vitest';

describe('syncService descarga y merge', () => {
  it('mergea por id usando updatedAt', async () => {
    const { syncDownloadEntities } = await import('@/services/syncService');
    const { useBranchStore } = await import('@/store/branchStore');
    const { useProductsStore } = await import('@/store/productsStore');
    const { api } = await import('@/lib/api');
    useBranchStore.setState({ selectedBranchId: 'BR-1', branches: [], loading: false, error: null });
    useProductsStore.setState({ products: [{ id: 'P1', name: 'Old', updatedAt: '2020-01-01T00:00:00.000Z' }], loading: false, error: null, lastUpdated: null });
    (api.get as any) = async (url: string, cfg?: any) => {
      if (String(cfg?.params?.entity) === 'products') {
        return { data: { success: true, data: [{ id: 'P1', name: 'New', updatedAt: '2025-01-01T00:00:00.000Z' }] } } as any;
      }
      return { data: { success: true, data: [] } } as any;
    };
    await syncDownloadEntities();
    const p = useProductsStore.getState().products.find((x:any)=>x.id==='P1');
    expect(p.name).toBe('New');
  });
});