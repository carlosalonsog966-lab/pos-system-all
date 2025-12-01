import { Page } from '@playwright/test';

export async function navigateTo(
  page: Page,
  path: string,
  waitUntil: 'load' | 'domcontentloaded' | 'networkidle' = 'load'
) {
  // Si path es absoluto, navegar directamente.
  if (/^https?:\/\//i.test(path)) {
    console.log(`[navigateTo] absolute ${path}`);
    return page.goto(path, { waitUntil });
  }

  // Preferir rutas relativas para que Playwright resuelva con baseURL.
  const normalized = path.startsWith('/') ? path : `/${path}`;
  console.log(`[navigateTo] relative ${normalized}`);
  return page.goto(normalized, { waitUntil });
}
