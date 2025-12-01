import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, initializeApiBaseUrl } from '@/lib/api';
import { useOfflineStore } from '@/store/offlineStore';

interface ClientsState {
  clients: any[];
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

interface ClientsActions {
  loadClients: () => Promise<void>;
  setClients: (clients: any[]) => void;
  clearClients: () => void;
  getClientById: (id: string) => any | undefined;
  updateClientInStore: (client: any) => void;
}

export const useClientsStore = create<ClientsState & ClientsActions>()(
  persist(
    (set, get) => ({
      clients: [],
      loading: false,
      error: null,
      lastUpdated: null,

      setClients: (clients: any[]) => {
        set({ clients, lastUpdated: Date.now(), error: null });
      },

      clearClients: () => {
        set({ clients: [], lastUpdated: null });
      },

      getClientById: (id: string) => {
        return get().clients.find((c) => c?.id === id);
      },

      updateClientInStore: (client: any) => {
        set((state) => ({
          clients: state.clients.map((c) => (c?.id === client?.id ? { ...c, ...client } : c)),
          lastUpdated: Date.now(),
        }));
      },

      loadClients: async () => {
        try {
          set({ loading: true, error: null });

          // Fallback offline usando datos en persistencia
          try {
            const { isOffline } = useOfflineStore.getState();
            const cached = get().clients;
            if (isOffline && Array.isArray(cached) && cached.length > 0) {
              set({ clients: cached, lastUpdated: Date.now() });
              return;
            }
          } catch { /* noop */ }

          // Asegurar baseURL antes de llamar a la API
          try { await initializeApiBaseUrl(); } catch { /* noop */ }

          const response = await api.get('/clients', { __suppressGlobalError: true, headers: { 'x-cache-permit': '1', 'x-cache-ttl-ms': '180000' } } as any);
          const payload = response?.data;
          const data = Array.isArray(payload)
            ? payload
            : (payload?.data ?? payload ?? []);

          if (Array.isArray(data) && data.length > 0) {
            set({ clients: data, lastUpdated: Date.now() });
          } else {
            const cached = get().clients;
            set({ clients: Array.isArray(cached) ? cached : [], lastUpdated: Date.now() });
          }
        } catch (error: any) {
          const cached = get().clients;
          if (Array.isArray(cached) && cached.length > 0) {
            console.warn('API clients failed, using cached clients');
            set({ clients: cached, lastUpdated: Date.now() });
          } else {
            console.warn('API clients failed, no cached data available');
            set({ clients: [], error: error?.message || 'Error al cargar clientes' });
          }
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: 'clients-store',
      partialize: (state) => ({ clients: state.clients, lastUpdated: state.lastUpdated }),
    }
  )
);
