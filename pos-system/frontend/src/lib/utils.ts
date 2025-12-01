export function getStableKey(
  id?: string | number | null,
  ...parts: Array<string | number | null | undefined>
): string {
  // Normaliza el id si existe
  const base = id != null && id !== '' ? String(id) : null;
  if (base) return base;

  // Construye clave a partir de piezas relevantes
  const composite = parts
    .map((p) => (p == null ? 'na' : String(p)))
    .join('|');

  return composite || Math.random().toString(36).slice(2);
}

