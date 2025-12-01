import { create } from 'zustand';
import { rankingService, RankingData, RankingPeriod } from '@/services/rankingService';
import { initializeApiBaseUrl } from '@/lib/api';

export type RankingPeriodType = 'weekly' | 'monthly' | 'custom';

interface RankingStore {
  // Estado
  rankings: RankingData | null;
  loading: boolean;
  error: string | null;
  currentPeriod: RankingPeriodType;
  customPeriod: RankingPeriod | null;

  // Acciones
  setCurrentPeriod: (period: RankingPeriodType) => void;
  setCustomPeriod: (period: RankingPeriod) => void;
  loadRankings: () => Promise<void>;
  loadWeeklyRankings: () => Promise<void>;
  loadMonthlyRankings: () => Promise<void>;
  loadCustomRankings: (startDate: string, endDate: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export const useRankingStore = create<RankingStore>((set, get) => ({
  // Estado inicial
  rankings: null,
  loading: false,
  error: null,
  currentPeriod: 'weekly',
  customPeriod: null,

  // Acciones
  setCurrentPeriod: (period) => {
    set({ currentPeriod: period });
  },

  setCustomPeriod: (period) => {
    set({ customPeriod: period });
  },

  loadRankings: async () => {
    const { currentPeriod, customPeriod } = get();
    // Asegurar baseURL antes de llamadas para evitar errores de conexión
    try {
      await initializeApiBaseUrl();
    } catch (error) {
      console.warn('initializeApiBaseUrl failed in rankingStore.loadRankings:', error);
    }
    
    switch (currentPeriod) {
      case 'weekly':
        await get().loadWeeklyRankings();
        break;
      case 'monthly':
        await get().loadMonthlyRankings();
        break;
      case 'custom':
        if (customPeriod) {
          await get().loadCustomRankings(customPeriod.startDate, customPeriod.endDate);
        }
        break;
    }
  },

  loadWeeklyRankings: async () => {
    set({ loading: true, error: null });
    try {
      const rankings = await rankingService.getWeeklyRankings();
      set({ rankings, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Error al cargar rankings semanales',
        loading: false 
      });
    }
  },

  loadMonthlyRankings: async () => {
    set({ loading: true, error: null });
    try {
      const rankings = await rankingService.getMonthlyRankings();
      set({ rankings, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Error al cargar rankings mensuales',
        loading: false 
      });
    }
  },

  loadCustomRankings: async (startDate: string, endDate: string) => {
    set({ loading: true, error: null });
    try {
      const rankings = await rankingService.getCustomRankings(startDate, endDate);
      set({ rankings, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Error al cargar rankings personalizados',
        loading: false 
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({
      rankings: null,
      loading: false,
      error: null,
      currentPeriod: 'weekly',
      customPeriod: null,
    });
  },
}));
