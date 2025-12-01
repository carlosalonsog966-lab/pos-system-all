import { describe, it, expect, beforeEach } from 'vitest';
import { useOfflineStore } from '@/store/offlineStore';
import { useProductsStore } from '@/store/productsStore';

describe('OfflineStore sync en testMode', () => {
  beforeEach(() => {
    useOfflineStore.setState({ isOffline: false, pendingActions: [], syncInProgress: false, lastSyncTime: null, syncStatus: { isOnline: true, lastSync: null, syncInProgress: false, failedActions: 0, totalActions: 0, syncErrors: [] }, autoSyncEnabled: false, syncInterval: 30000, maxStorageSize: 50, compressionEnabled: true });
    useProductsStore.setState({ products: [], loading: false, error: null, lastUpdated: null });
    try { (window as any).location.hash = '#/products?tm=1'; } catch {}
  });

  it('procesa BULK_IMPORT_PRODUCTS y actualiza productsStore', async () => {
    const items = [
      { code: 'SKU-1', name: 'Producto 1', category: 'Anillos', stock: 5, purchasePrice: 10, salePrice: 20 },
      { code: 'SKU-2', name: 'Producto 2', category: 'Collares', stock: 3, purchasePrice: 15, salePrice: 30 },
    ];
    useOfflineStore.getState().addPendingAction({ type: 'BULK_IMPORT_PRODUCTS', data: { items }, priority: 'high', maxRetries: 3 });
    expect(useOfflineStore.getState().pendingActions.length).toBe(1);

    await useOfflineStore.getState().syncPendingActions();

    const prods = useProductsStore.getState().products;
    expect(Array.isArray(prods)).toBe(true);
    expect(prods.length).toBeGreaterThanOrEqual(2);
    expect(useOfflineStore.getState().pendingActions.length).toBe(0);
  });
});