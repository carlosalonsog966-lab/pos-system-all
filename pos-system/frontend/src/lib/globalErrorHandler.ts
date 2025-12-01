import { useNotificationStore } from '../store/notificationStore';

let __lastGlobalErrorAt = 0;

let initialized = false;

export function initGlobalErrorHandlers() {
  if (initialized) return;
  initialized = true;

  const notify = useNotificationStore.getState();

  // Capturar errores no manejados
  window.addEventListener('error', (event: ErrorEvent) => {
    try {
      const msg = event?.error?.message || event?.message || 'Error de ejecución';
      const now = Date.now();
      const noisy = /Failed to fetch dynamically imported module|Loading chunk \d+ failed/i.test(msg || '');
      if (import.meta.env.DEV && noisy) return;
      if (!__lastGlobalErrorAt || now - __lastGlobalErrorAt > 20000) {
        setTimeout(() => notify.showError('Error no manejado', msg, { scope: 'global-errors' }), 0);
        __lastGlobalErrorAt = now;
      }
      // eslint-disable-next-line no-console
      console.error('[GlobalError]', event.error || event);
  } catch (error) { console.warn('Global error handler failed to process error:', error); }
  });

  // Capturar rechazos de promesas no manejados
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    try {
      // Algunos navegadores envían un objeto con message; otros, un string
      const reason: any = event.reason;
      const msg = reason?.message || String(reason) || 'Promesa rechazada sin manejar';
      const now = Date.now();
      const noisy = /NetworkError|TypeError: Failed to fetch|ERR_NETWORK|ERR_CONNECTION|Failed to fetch dynamically imported module/i.test(msg || '');
      if (import.meta.env.DEV && noisy) return;
      if (!__lastGlobalErrorAt || now - __lastGlobalErrorAt > 20000) {
        setTimeout(() => notify.showError('Error de promesa', msg, { scope: 'global-errors' }), 0);
        __lastGlobalErrorAt = now;
      }
      // eslint-disable-next-line no-console
      console.error('[UnhandledRejection]', reason);
  } catch (error) { console.warn('Global error handler failed to show notification:', error); }
  });
}
