import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, initializeApiBaseUrl } from '@/lib/api';

interface BranchState {
  selectedBranchId: string | null;
  branches: Array<{ id: string; name: string }>; 
  loading: boolean;
  error: string | null;
}

interface BranchActions {
  loadBranches: () => Promise<void>;
  setSelectedBranch: (id: string | null) => void;
}

export const useBranchStore = create<BranchState & BranchActions>()(
  persist(
    (set) => ({
      selectedBranchId: null,
      branches: [],
      loading: false,
      error: null,
      setSelectedBranch: (id: string | null) => set({ selectedBranchId: id }),
      loadBranches: async () => {
        try {
          set({ loading: true, error: null });
          try { await initializeApiBaseUrl(); } catch {}
          const resp = await api.get('/branches', { params: { isActive: true }, __suppressGlobalError: true } as any);
          const list: Array<{ id: string; name: string }> = (resp.data?.data || resp.data || [])
            .map((b: any) => ({ id: String(b.id ?? ''), name: String(b.name ?? '') }))
            .filter((b: { id: string; name: string }) => !!b.id && !!b.name);
          set({ branches: list });
        } catch (e: any) {
          set({ branches: [], error: e?.message || 'Error al cargar sucursales' });
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: 'branch-store',
      partialize: (state) => ({ selectedBranchId: state.selectedBranchId, branches: state.branches }),
    }
  )
);