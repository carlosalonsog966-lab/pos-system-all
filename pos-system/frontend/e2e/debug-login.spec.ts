import { test, expect } from '@playwright/test';

test('debug login paso a paso', async ({ page }) => {
  // Habilitar console logs
  page.on('console', msg => console.log('Console:', msg.text()));
  page.on('pageerror', error => console.log('Page error:', error.message));
  
  console.log('🚀 Navegando a login...');
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  
  console.log('📸 Tomando screenshot inicial...');
  await page.screenshot({ path: 'debug-login-1-initial.png' });
  
  console.log('📝 Llenando formulario...');
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  
  console.log('📸 Screenshot después de llenar formulario...');
  await page.screenshot({ path: 'debug-login-2-filled.png' });
  
  console.log('🖱️ Haciendo click en botón...');
  await page.click('button[type="button"]');
  
  console.log('⏳ Esperando 3 segundos...');
  await page.waitForTimeout(3000);
  
  console.log('📸 Screenshot después de click...');
  await page.screenshot({ path: 'debug-login-3-after-click.png' });
  
  console.log('🔍 URL actual:', page.url());
  
  // Verificar si hay errores visibles
  const errorMessage = await page.locator('[role="alert"], .error, .text-red-500').first();
  if (await errorMessage.count() > 0) {
    console.log('❌ Mensaje de error encontrado:', await errorMessage.textContent());
  }
  
  // Verificar network activity
  const responses = [];
  page.on('response', response => {
    if (response.url().includes('/api/')) {
      responses.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText()
      });
    }
  });
  
  console.log('📡 Respuestas de API:', responses);
});