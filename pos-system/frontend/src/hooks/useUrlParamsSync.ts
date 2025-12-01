import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { mergeSearchParams } from '@/utils/url';
import { readDashboardFiltersFromSearch, readRecentSalesFiltersFromSearch } from '@/utils/queryParams';

export interface DashboardUrlSync {
  dashboardFromUrl: ReturnType<typeof readDashboardFiltersFromSearch>;
  recentFromUrl: ReturnType<typeof readRecentSalesFiltersFromSearch>;
  updateSearch: (overrides: Record<string, string | null | undefined>) => void;
}

// Hook ligero para centralizar lectura rápida de filtros desde la URL y escritura
export function useUrlParamsSync(): DashboardUrlSync {
  const location = useLocation();
  const navigate = useNavigate();

  const dashboardFromUrl = readDashboardFiltersFromSearch(location.search, {
    period: 'today',
    comparison: false,
    showAmounts: true,
  });
  const recentFromUrl = readRecentSalesFiltersFromSearch(location.search, {
    hasReference: false,
    referenceQuery: '',
  });

  const updateSearch = useCallback((overrides: Record<string, string | null | undefined>) => {
    try {
      const newSearch = mergeSearchParams(location.search, overrides);
      if (newSearch !== location.search) {
        navigate({ pathname: location.pathname, search: newSearch }, { replace: true });
      }
    } catch {
      // noop
    }
  }, [location.pathname, location.search, navigate]);

  return { dashboardFromUrl, recentFromUrl, updateSearch };
}
