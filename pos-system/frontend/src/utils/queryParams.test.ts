import { describe, it, expect } from 'vitest';
import {
  parseBooleanParam,
  parsePeriodParam,
  readDashboardFiltersFromSearch,
  readRecentSalesFiltersFromSearch,
} from './queryParams';

describe('utils/queryParams', () => {
  it('parseBooleanParam convierte cadenas en booleanos', () => {
    expect(parseBooleanParam('1', false)).toBe(true);
    expect(parseBooleanParam('true', false)).toBe(true);
    expect(parseBooleanParam('0', true)).toBe(false);
    expect(parseBooleanParam('false', true)).toBe(false);
    expect(parseBooleanParam(undefined, true)).toBe(true);
  });

  it('parsePeriodParam devuelve periodo esperado o default', () => {
    expect(parsePeriodParam('week', 'month')).toBe('week');
    expect(parsePeriodParam('unknown', 'month')).toBe('month');
    expect(parsePeriodParam(undefined, 'today')).toBe('today');
  });

  it('readDashboardFiltersFromSearch extrae y convierte correctamente', () => {
    const search = '?period=week&comparison=1&showAmounts=0';
    const result = readDashboardFiltersFromSearch(search, {
      period: 'month',
      comparison: false,
      showAmounts: true,
    });
    expect(result.period).toBe('week');
    expect(result.comparison).toBe(true);
    expect(result.showAmounts).toBe(false);
  });

  it('readRecentSalesFiltersFromSearch extrae referencia y query', () => {
    const search = '?recentRef=true&recentQuery=abc';
    const result = readRecentSalesFiltersFromSearch(search, {
      hasReference: false,
      referenceQuery: '',
    });
    expect(result.hasReference).toBe(true);
    expect(result.referenceQuery).toBe('abc');
  });
});

