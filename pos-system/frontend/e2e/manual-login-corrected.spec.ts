import { test, expect } from '@playwright/test';

test('Manual login test - corrected', async ({ page }) => {
  const baseURL = 'http://localhost:5173';
  
  // Navigate to login page
  await page.goto(`${baseURL}/login`);
  await page.waitForLoadState('networkidle');
  
  console.log('Current URL:', page.url());
  
  // Fill login form
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  
  // Wait for navigation
  await page.waitForLoadState('networkidle');
  
  // Check current URL - should be dashboard, not login page
  const currentUrl = page.url();
  console.log('URL after login:', currentUrl);
  
  // Take screenshot after login
  await page.screenshot({ path: 'after-login-corrected.png', fullPage: true });
  
  // Check if we're logged in by checking if we're NOT on login page
  if (currentUrl.includes('/login#/login')) {
    console.log('Login failed - still on login page');
  } else if (currentUrl.includes('/dashboard')) {
    console.log('Login successful! - On dashboard page');
    
    // Navigate to sales page to check if products load
    await page.goto(`${baseURL}/sales`);
    await page.waitForLoadState('networkidle');
    
    // Check if products are loaded
    const addToCartButtons = await page.locator('[data-testid="sales-add-to-cart-button"]').count();
    console.log(`Found ${addToCartButtons} add-to-cart buttons`);
    
    // Take screenshot of sales page
    await page.screenshot({ path: 'sales-page-corrected.png', fullPage: true });
    
    // Check if products are displayed
    const productElements = await page.locator('[data-testid*="product"]').count();
    console.log(`Found ${productElements} product elements`);
    
    // Check if there's a "no products" message
    const noProductsMessage = await page.locator('text="No se encontraron productos"').count();
    console.log(`No products message visible: ${noProductsMessage > 0}`);
    
  } else {
    console.log('Login result unclear - unexpected URL:', currentUrl);
  }
});