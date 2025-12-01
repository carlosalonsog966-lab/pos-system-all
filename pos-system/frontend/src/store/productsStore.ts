import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, initializeApiBaseUrl, normalizeListPayloadWithSchema } from '@/lib/api';
import { useOfflineStore } from '@/store/offlineStore';
import { normalizeProducts } from '@/utils/normalization';
import { productRawSchema } from '@/schemas/product';

interface ProductsState {
  products: any[];
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

interface ProductsActions {
  loadProducts: () => Promise<void>;
  setProducts: (products: any[]) => void;
  clearProducts: () => void;
  getProductById: (id: string) => any | undefined;
  updateProductInStore: (product: any) => void;
}

export const useProductsStore = create<ProductsState & ProductsActions>()(
  persist(
    (set, get) => ({
      products: [],
      loading: false,
      error: null,
      lastUpdated: null,

      setProducts: (products: any[]) => {
        set({ products, lastUpdated: Date.now(), error: null });
      },

      clearProducts: () => {
        set({ products: [], lastUpdated: null });
      },

      getProductById: (id: string) => {
        return get().products.find((p) => p?.id === id);
      },

      updateProductInStore: (product: any) => {
        set((state) => ({
          products: state.products.map((p) => (p?.id === product?.id ? { ...p, ...product } : p)),
          lastUpdated: Date.now(),
        }));
      },

      loadProducts: async () => {
        try {
          set({ loading: true, error: null });

          // Si estamos offline y hay datos en persistencia, usarlos
          try {
            const { isOffline } = useOfflineStore.getState();
            const cached = get().products;
            if (isOffline && Array.isArray(cached) && cached.length > 0) {
              set({ products: cached, lastUpdated: Date.now() });
              return;
            }
          } catch { /* noop */ }

          // Asegurar baseURL antes de llamar a la API
          try { await initializeApiBaseUrl(); } catch { /* noop */ }

          const response = await api.get('/products', { __suppressGlobalError: true, headers: { 'x-cache-permit': '1', 'x-cache-ttl-ms': '120000' } } as any);
          const payload = response?.data;
          const data = normalizeListPayloadWithSchema<any>(payload, productRawSchema);

          if (Array.isArray(data) && data.length > 0) {
            set({ products: normalizeProducts(data), lastUpdated: Date.now() });
          } else {
            // Fallback a datos persistidos si API devuelve vacío
            const cached = get().products;
            set({ products: normalizeProducts(Array.isArray(cached) ? cached : []), lastUpdated: Date.now() });
          }
        } catch (error: any) {
          // Fallback silencioso en caso de error de red/servidor
          const cached = get().products;
          if (Array.isArray(cached) && cached.length > 0) {
            console.warn('API products failed, using cached products');
            set({ products: normalizeProducts(cached), lastUpdated: Date.now() });
          } else {
            console.warn('API products failed, no cached data available');
            set({ products: [], error: error?.message || 'Error al cargar productos' });
          }
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: 'products-store',
      partialize: (state) => ({ products: state.products, lastUpdated: state.lastUpdated }),
    }
  )
);
