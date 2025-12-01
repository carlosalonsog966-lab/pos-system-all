type RaygunWindow = Window & {
  rg4js?: any;
};

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = (e) => reject(e);
    document.head.appendChild(el);
  });
}

export async function initRaygun() {
  try {
    const apiKey = (import.meta.env.VITE_RAYGUN_API_KEY || '').toString();
    const appVersion = (import.meta.env.VITE_APP_VERSION || '').toString();
    const enablePulseRaw = (import.meta.env.VITE_RAYGUN_PULSE || 'false').toString().toLowerCase();
    const enablePulse = enablePulseRaw === 'true' || enablePulseRaw === '1';

    if (!apiKey) {
      console.warn('[Raygun] VITE_RAYGUN_API_KEY no configurado; Raygun deshabilitado');
      return;
    }

    await loadScript('https://cdn.raygun.io/raygun4js/raygun.min.js');
    const w = window as RaygunWindow;
    if (!w.rg4js) {
      console.warn('[Raygun] rg4js no disponible tras cargar script');
      return;
    }

    w.rg4js('apiKey', apiKey);
    if (appVersion) w.rg4js('setVersion', appVersion);

    // Filtrar datos sensibles
    w.rg4js('setFilterRules', [
      { pattern: 'password', replaceWith: '********' },
      { pattern: 'token', replaceWith: '********' },
      { pattern: 'authorization', replaceWith: '********' },
    ]);

    // Captura de errores
    w.rg4js('enableCrashReporting', true);

    // Pulse opcional (RUM)
    if (enablePulse) {
      w.rg4js('enablePulse', true);
    }

    console.info('[Raygun] Inicializado correctamente');
  } catch (error) {
    console.warn('[Raygun] Error al inicializar:', error);
  }
}

