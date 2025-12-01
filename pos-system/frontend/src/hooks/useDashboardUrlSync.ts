import { useEffect, useState, useCallback } from 'react';
import { useUrlParamsSync } from '@/hooks/useUrlParamsSync';

export interface DashboardFilters {
  period: 'today' | 'week' | 'month' | 'quarter' | 'year';
  comparison: boolean;
  showAmounts: boolean;
}

export interface RecentSalesFilters {
  hasReference: boolean;
  referenceQuery: string;
}

const DASHBOARD_FILTERS_KEY = 'dashboard_filters_v1';

export function useDashboardUrlSync() {
  const { updateSearch, dashboardFromUrl, recentFromUrl } = useUrlParamsSync();

  const [filters, setFilters] = useState<DashboardFilters>({
    period: 'today',
    comparison: false,
    showAmounts: true,
  });

  const [recentSalesFilters, setRecentSalesFilters] = useState<RecentSalesFilters>({
    hasReference: false,
    referenceQuery: '',
  });

  // Lectura inicial de localStorage y URL
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DASHBOARD_FILTERS_KEY);
      if (raw) {
        const saved: DashboardFilters = JSON.parse(raw);
        setFilters(prev => ({ ...prev, ...saved }));
      }
    } catch { /* noop */ }
    // Mezclar filtros provenientes de URL
    try {
      setFilters(prev => ({ ...prev, ...dashboardFromUrl }));
      setRecentSalesFilters(prev => ({ ...prev, ...recentFromUrl }));
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistir filtros y escribir a la URL cuando cambian
  useEffect(() => {
    try {
      localStorage.setItem(DASHBOARD_FILTERS_KEY, JSON.stringify(filters));
    } catch { /* noop */ }
    updateSearch({
      period: filters.period,
      comparison: filters.comparison ? '1' : '0',
      showAmounts: filters.showAmounts ? '1' : '0',
    });
  }, [filters.period, filters.comparison, filters.showAmounts, updateSearch]);

  // Escribir filtros de referencia de ventas recientes a la URL cuando cambian
  useEffect(() => {
    const q = (recentSalesFilters.referenceQuery || '').trim();
    updateSearch({
      recentRef: recentSalesFilters.hasReference ? '1' : null,
      recentQuery: q || null,
    });
  }, [recentSalesFilters.hasReference, recentSalesFilters.referenceQuery, updateSearch]);

  const handleFilterChange = useCallback((patch: Partial<DashboardFilters>) => {
    setFilters(prev => ({ ...prev, ...patch }));
  }, []);

  return {
    filters,
    setFilters,
    recentSalesFilters,
    setRecentSalesFilters,
    handleFilterChange,
  };
}

