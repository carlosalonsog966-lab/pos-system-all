import type { } from 'react';

export type DashboardPeriod = 'today' | 'week' | 'month' | 'quarter' | 'year';

export function parseBooleanParam(value: string | null | undefined, fallback: boolean): boolean {
  if (value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;
  return fallback;
}

export function parsePeriodParam(value: string | null | undefined, fallback: DashboardPeriod): DashboardPeriod {
  const valid: DashboardPeriod[] = ['today', 'week', 'month', 'quarter', 'year'];
  return value && (valid as string[]).includes(value) ? (value as DashboardPeriod) : fallback;
}

export function readDashboardFiltersFromSearch<T extends { period: DashboardPeriod; comparison: boolean; showAmounts: boolean }>(
  search: string,
  current: T
): T {
  const params = new URLSearchParams(search || '');
  const period = parsePeriodParam(params.get('period'), current.period);
  const comparison = parseBooleanParam(params.get('comparison'), current.comparison);
  const showAmounts = parseBooleanParam(params.get('showAmounts'), current.showAmounts);
  return { ...current, period, comparison, showAmounts };
}

export function readRecentSalesFiltersFromSearch(
  search: string,
  current: { hasReference: boolean; referenceQuery: string }
): { hasReference: boolean; referenceQuery: string } {
  const params = new URLSearchParams(search || '');
  const hasRefParam = params.get('recentRef');
  const queryParam = params.get('recentQuery') || '';
  const hasReference = hasRefParam === '1' || hasRefParam === 'true';
  return { ...current, hasReference, referenceQuery: queryParam };
}

