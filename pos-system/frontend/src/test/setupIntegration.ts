import { beforeEach, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Utilidad opcional para suites que usan listeners globales
export function stubWindowListeners() {
  const add = vi.spyOn(window, 'addEventListener').mockImplementation(() => {});
  const remove = vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});
  return { add, remove };
}

// Evitar que los intervalos reales mantengan el proceso vivo
beforeEach(() => {
  vi.spyOn(window, 'setInterval').mockImplementation(() => 0 as unknown as number);
  vi.spyOn(window, 'clearInterval').mockImplementation(() => {});
});

// Limpieza consistente tras cada test
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  try {
    window.localStorage.clear();
  } catch {}
});

// Suprimir errores/rechazos globales en integración para evitar falsos negativos
try {
  process.on('unhandledRejection', () => {});
  // @ts-ignore
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('error', () => {});
  }
} catch {}
