import '@testing-library/jest-dom';

// Silenciar errores de navegación reemplazando history en jsdom si fuese necesario
// (Evita ruido en pruebas que usan react-router)
try {
  // noop, placeholder por si se requiere configuración adicional
} catch {
  // noop
}

// Silenciar advertencias conocidas de React Router v6 sobre future flags
const originalWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  const msg = String(args[0] ?? '');
  if (
    msg.includes('React Router Future Flag Warning') ||
    msg.includes('v7_startTransition') ||
    msg.includes('v7_relativeSplatPath')
  ) {
    return; // Ignorar estas advertencias en entorno de tests
  }
  originalWarn(...args as any);
};

// Adaptador por defecto para axios en entorno de tests: evita XHR reales
;(async () => {
  try {
    const { api } = await import('@/lib/api');
    (api as any).defaults.adapter = async (config: any) => {
      const url = String(config?.url || '');
      const method = String((config?.method || 'get')).toLowerCase();
      if (url.includes('/auth/login') && method === 'post') {
        return {
          data: { success: true, data: { user: { id: 'u1', username: 'admin', email: 'admin@example.com', firstName: 'Admin', lastName: 'User', role: 'admin', isActive: true }, token: 'testtoken', refreshToken: 'refreshtoken' } },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {} as any,
        } as any;
      }
      return {
        data: { success: true, data: {} },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        request: {} as any,
      } as any;
    };
  } catch {}
})();
