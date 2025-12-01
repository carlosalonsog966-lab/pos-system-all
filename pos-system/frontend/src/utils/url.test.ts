import { describe, it, expect } from 'vitest';
import { mergeSearchParams, buildUrlWithParams } from './url';

describe('utils/url', () => {
  it('mergeSearchParams sobrescribe y elimina con overrides', () => {
    const base = '?a=1&b=2';
    const overrides = { a: '10', b: null, c: 'x' } as const;
    const merged = mergeSearchParams(base, overrides);
    // Debe mantener a=10, eliminar b y añadir c=x
    expect(merged).toContain('a=10');
    expect(merged).toContain('c=x');
    expect(merged).not.toContain('b=');
  });

  it('buildUrlWithParams construye una URL absoluta con búsqueda', () => {
    const url = buildUrlWithParams('/app', { q: 'hello', page: '2' });
    expect(url).toContain('/app');
    expect(url).toContain('q=hello');
    expect(url).toContain('page=2');
    // jsdom expone origin como http://localhost
    expect(url.startsWith('http://localhost')).toBe(true);
  });
});

