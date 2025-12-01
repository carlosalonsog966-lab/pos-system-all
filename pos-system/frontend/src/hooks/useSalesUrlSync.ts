import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useUrlParamsSync } from '@/hooks/useUrlParamsSync';

export interface SalesFilters {
  dateFrom?: string;
  dateTo?: string;
  clientId?: string;
  status?: string;
  paymentMethod?: string;
  minAmount?: number;
  maxAmount?: number;
  hasReference?: boolean;
  referenceQuery?: string;
}

function parseNumber(value: string | null | undefined): number | undefined {
  if (value === undefined || value === null || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseBoolean(value: string | null | undefined): boolean | undefined {
  if (value === undefined || value === null || value.trim() === '') return undefined;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return undefined;
}

export function useSalesUrlSync(activeTab: 'new-sale' | 'guide-sale' | 'sales-history' | 'analytics') {
  const location = useLocation();
  const { updateSearch } = useUrlParamsSync();

  const [salesFilters, setSalesFilters] = useState<SalesFilters>({});

  // Leer filtros desde la URL cuando se abre Historial de Ventas
  useEffect(() => {
    if (activeTab !== 'sales-history') return;
    const params = new URLSearchParams(location.search || '');
    const read = (key: string) => params.get(key) || undefined;
    const next: SalesFilters = {
      dateFrom: read('dateFrom'),
      dateTo: read('dateTo'),
      clientId: read('clientId'),
      status: read('status'),
      paymentMethod: read('paymentMethod'),
      minAmount: parseNumber(read('minAmount') || null),
      maxAmount: parseNumber(read('maxAmount') || null),
      hasReference: parseBoolean(read('hasReference') || null),
      referenceQuery: read('referenceQuery'),
    };
    const hasAny = Array.from(params.keys()).some(k => (
      ['dateFrom','dateTo','clientId','status','paymentMethod','minAmount','maxAmount','hasReference','referenceQuery'].includes(k)
    ));
    if (hasAny) {
      setSalesFilters(next);
    }
  }, [activeTab, location.search]);

  // Escribir filtros en la URL cuando cambian en Historial de Ventas
  useEffect(() => {
    if (activeTab !== 'sales-history') return;
    const overrides: Record<string, string | null | undefined> = {
      tab: 'sales-history',
      dateFrom: salesFilters.dateFrom,
      dateTo: salesFilters.dateTo,
      clientId: salesFilters.clientId,
      status: salesFilters.status,
      paymentMethod: salesFilters.paymentMethod,
      minAmount: salesFilters.minAmount !== undefined ? String(salesFilters.minAmount) : undefined,
      maxAmount: salesFilters.maxAmount !== undefined ? String(salesFilters.maxAmount) : undefined,
      hasReference: typeof salesFilters.hasReference === 'boolean' ? (salesFilters.hasReference ? 'true' : 'false') : undefined,
      referenceQuery: salesFilters.referenceQuery,
    };
    updateSearch(overrides);
  }, [activeTab, salesFilters, updateSearch]);

  const handleSalesFilterChange = useCallback((patch: Partial<SalesFilters>) => {
    setSalesFilters(prev => ({ ...prev, ...patch }));
  }, []);

  return { salesFilters, setSalesFilters, handleSalesFilterChange };
}

