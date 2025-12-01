import { buildUrlWithParams } from './url';

type NotifyFn = (n: { type: 'success' | 'error'; title: string; message: string }) => void;

export async function copyUrlWithParams(
  pathname: string,
  search: string,
  overrides: Record<string, string | null | undefined> | undefined,
  notify: NotifyFn,
  messages?: {
    successTitle?: string;
    successMessage?: string;
    errorTitle?: string;
    errorMessage?: string;
  }
) {
  try {
    const url = buildUrlWithParams(pathname, search, overrides);
    await navigator.clipboard.writeText(url);
    setTimeout(() => {
      notify({
        type: 'success',
        title: messages?.successTitle ?? 'Enlace copiado',
        message: messages?.successMessage ?? 'URL con filtros',
      });
    }, 0);
  } catch (err) {
    setTimeout(() => {
      notify({
        type: 'error',
        title: messages?.errorTitle ?? 'No se pudo copiar',
        message: messages?.errorMessage ?? 'Hubo un problema al copiar el enlace',
      });
    }, 0);
  }
}

