// Utilidad para corregir textos con mojibake (acentos/eñes mal codificados)
// Aplica reemplazos comunes de ISO-8859-1/Windows-1252 mal interpretados como UTF-8
export function fixMojibake(input: string | undefined | null): string {
  if (!input) return '';
  let s = String(input);
  const map: Record<string, string> = {
    'Ã¡': 'á', 'Ã©': 'é', 'Ã­': 'í', 'Ã³': 'ó', 'Ãº': 'ú',
    'ÃÁ': 'Á', 'Ã‰': 'É', 'ÃÍ': 'Í', 'ÃÓ': 'Ó', 'ÃÚ': 'Ú',
    'Ã±': 'ñ', 'Ã‘': 'Ñ',
    'Â¡': '¡', 'Â¿': '¿',
    'Âº': 'º', 'Âª': 'ª', 'Â°': '°',
    'â€”': '—', 'â€“': '–', 'â€¦': '…', 'â€œ': '“', 'â€': '”', 'â€˜': '‘', 'â€™': '’', 'â€¢': '•',
    'Ã¼': 'ü', 'Ãœ': 'Ü', 'Ã¶': 'ö', 'Ã–': 'Ö'
  };
  // Reemplazar todas las ocurrencias conocidas
  for (const [bad, good] of Object.entries(map)) {
    s = s.split(bad).join(good);
  }
  return s;
}

// Opción segura: si el texto no contiene patrones comunes, devuelve original
export function maybeFixMojibake(input: string | undefined | null): string {
  if (!input) return '';
  const s = String(input);
  return /Ã|Â|â/.test(s) ? fixMojibake(s) : s;
}
