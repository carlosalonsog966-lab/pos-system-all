import { test, expect } from '@playwright/test';

test('verificar login en auditoría', async ({ page }) => {
  console.log('🚀 Navegando a login...');
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  
  console.log('📸 Tomando screenshot inicial...');
  await page.screenshot({ path: 'audit-login-1-initial.png' });
  
  console.log('📝 Llenando formulario con credenciales admin/admin123...');
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  
  console.log('📸 Screenshot después de llenar formulario...');
  await page.screenshot({ path: 'audit-login-2-filled.png' });
  
  console.log('🖱️ Haciendo click en botón submit...');
  await page.click('button[type="submit"]');
  
  console.log('⏳ Esperando navegación...');
  await page.waitForTimeout(3000);
  
  console.log('📸 Screenshot después de click...');
  await page.screenshot({ path: 'audit-login-3-after-submit.png' });
  
  const currentUrl = page.url();
  console.log('🔍 URL actual:', currentUrl);
  
  // Verificar si hay mensajes de error
  const errorElements = page.locator('[role="alert"], .error, .text-red-500, .bg-red-50');
  const errorCount = await errorElements.count();
  console.log('❌ Elementos de error encontrados:', errorCount);
  
  if (errorCount > 0) {
    for (let i = 0; i < errorCount; i++) {
      const errorText = await errorElements.nth(i).textContent();
      console.log(`Error ${i + 1}:`, errorText);
    }
  }
  
  // Verificar si hay algún indicador de carga
  const loadingElements = page.locator('.loading, [aria-busy="true"], .spinner');
  const loadingCount = await loadingElements.count();
  console.log('⏳ Elementos de carga encontrados:', loadingCount);
  
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
  
  // Esperar un poco más para capturar network activity
  await page.waitForTimeout(2000);
  console.log('📡 Respuestas de API capturadas:', responses);
  
  // Verificar si el login fue exitoso
  if (currentUrl.includes('/dashboard')) {
    console.log('✅ Login exitoso - estamos en dashboard');
  } else {
    console.log('❌ Login fallido - aún estamos en login');
  }
});