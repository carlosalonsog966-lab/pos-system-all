import { test, expect } from '@playwright/test';

test('verificar login funciona', async ({ page }) => {
  // Navegar a login
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  
  // Verificar que estamos en login
  await expect(page).toHaveURL(/.*login/);
  
  // Llenar formulario
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  
  // Hacer click en submit
  await page.click('button[type="button"]');
  
  // Esperar navegación
  await page.waitForLoadState('networkidle');
  
  // Verificar que estamos en dashboard
  await expect(page).toHaveURL(/.*dashboard/);
  
  console.log('✅ Login exitoso');
});

test('verificar productos cargan después de login', async ({ page }) => {
  // Login primero
  await page.goto('http://localhost:5173/login');
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type="button"]');
  await page.waitForLoadState('networkidle');
  
  // Ir a ventas
  await page.goto('http://localhost:5173/sales');
  await page.waitForLoadState('networkidle');
  
  // Verificar que hay productos
  const products = page.locator('[data-testid^="product-"]').first();
  await expect(products).toBeVisible({ timeout: 5000 });
  
  console.log('✅ Productos visibles en ventas');
});