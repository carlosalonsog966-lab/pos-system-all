export function buildUrlWithParams(
  pathname: string,
  search: string,
  overrides?: Record<string, string | null | undefined>
): string {
  const params = new URLSearchParams(search || '');
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      const str = value === undefined || value === null ? '' : String(value).trim();
      if (!str) {
        params.delete(key);
      } else {
        params.set(key, str);
      }
    }
  }
  const qs = params.toString();
  return `${window.location.origin}${pathname}${qs ? `?${qs}` : ''}`;
}

export function mergeSearchParams(
  search: string,
  overrides?: Record<string, string | null | undefined>
): string {
  const params = new URLSearchParams(search || '');
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      const str = value === undefined || value === null ? '' : String(value).trim();
      if (!str) {
        params.delete(key);
      } else {
        params.set(key, str);
      }
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
