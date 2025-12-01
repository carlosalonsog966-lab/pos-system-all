import { useState, useMemo, useCallback } from 'react';
import { useDebounce } from './useDebounce';

export interface FilterConfig<T> {
  searchFields: (keyof T)[];
  filterFields: {
    [K in keyof T]?: {
      type: 'select' | 'range' | 'boolean' | 'date';
      options?: any[];
      min?: number;
      max?: number;
    };
  };
}

export interface FilterState {
  search: string;
  filters: Record<string, any>;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface UseAdvancedFiltersReturn<T> {
  filteredData: T[];
  filterState: FilterState;
  setSearch: (search: string) => void;
  setFilter: (key: string, value: any) => void;
  setSorting: (field: string, order?: 'asc' | 'desc') => void;
  clearFilters: () => void;
  clearSearch: () => void;
  resetAll: () => void;
  isFiltering: boolean;
  resultCount: number;
}

export function useAdvancedFilters<T extends Record<string, any>>(
  data: T[],
  config: FilterConfig<T>,
  debounceMs: number = 300
): UseAdvancedFiltersReturn<T> {
  const [filterState, setFilterState] = useState<FilterState>({
    search: '',
    filters: {},
    sortBy: '',
    sortOrder: 'asc',
  });

  // Debounce search term for performance
  const debouncedSearch = useDebounce(filterState.search, debounceMs);

  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply search filter
    if (debouncedSearch.trim()) {
      const searchLower = debouncedSearch.toLowerCase();
      result = result.filter(item =>
        config.searchFields.some(field => {
          const value = item[field];
          if (value == null) return false;
          return String(value).toLowerCase().includes(searchLower);
        })
      );
    }

    // Apply field filters
    Object.entries(filterState.filters).forEach(([key, value]) => {
      if (value == null || value === '' || value === 'all') return;

      const fieldConfig = config.filterFields[key as keyof T];
      if (!fieldConfig) return;

      result = result.filter(item => {
        const itemValue = item[key];

        switch (fieldConfig.type) {
          case 'select':
            return itemValue === value;

          case 'boolean':
            return Boolean(itemValue) === Boolean(value);

          case 'range':
            if (typeof value === 'object' && value.min != null && value.max != null) {
              const numValue = Number(itemValue);
              return numValue >= value.min && numValue <= value.max;
            }
            return true;

          case 'date':
            if (typeof value === 'object' && value.start && value.end) {
              const itemDate = new Date(itemValue);
              const startDate = new Date(value.start);
              const endDate = new Date(value.end);
              return itemDate >= startDate && itemDate <= endDate;
            }
            return true;

          default:
            return String(itemValue).toLowerCase().includes(String(value).toLowerCase());
        }
      });
    });

    // Apply sorting
    if (filterState.sortBy) {
      result.sort((a, b) => {
        const aValue = a[filterState.sortBy];
        const bValue = b[filterState.sortBy];

        let comparison = 0;
        if (aValue < bValue) comparison = -1;
        if (aValue > bValue) comparison = 1;

        return filterState.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return result;
  }, [data, debouncedSearch, filterState.filters, filterState.sortBy, filterState.sortOrder, config]);

  const setSearch = useCallback((search: string) => {
    setFilterState(prev => ({ ...prev, search }));
  }, []);

  const setFilter = useCallback((key: string, value: any) => {
    setFilterState(prev => ({
      ...prev,
      filters: { ...prev.filters, [key]: value }
    }));
  }, []);

  const setSorting = useCallback((field: string, order: 'asc' | 'desc' = 'asc') => {
    setFilterState(prev => ({
      ...prev,
      sortBy: field,
      sortOrder: order
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilterState(prev => ({ ...prev, filters: {} }));
  }, []);

  const clearSearch = useCallback(() => {
    setFilterState(prev => ({ ...prev, search: '' }));
  }, []);

  const resetAll = useCallback(() => {
    setFilterState({
      search: '',
      filters: {},
      sortBy: '',
      sortOrder: 'asc',
    });
  }, []);

  const isFiltering = useMemo(() => {
    return debouncedSearch.trim() !== '' || 
           Object.values(filterState.filters).some(value => 
             value != null && value !== '' && value !== 'all'
           ) ||
           filterState.sortBy !== '';
  }, [debouncedSearch, filterState.filters, filterState.sortBy]);

  return {
    filteredData,
    filterState,
    setSearch,
    setFilter,
    setSorting,
    clearFilters,
    clearSearch,
    resetAll,
    isFiltering,
    resultCount: filteredData.length,
  };
}

export default useAdvancedFilters;