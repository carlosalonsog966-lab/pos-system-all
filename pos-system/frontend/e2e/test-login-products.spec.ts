import { test, expect } from '@playwright/test';

test('Test login and products loading', async ({ page }) => {
  // Navigate to login page
  await page.goto('http://localhost:5173/login');
  
  // Fill login form
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'admin123');
  
  // Submit login form
  await page.click('button[type="submit"]');
  
  // Wait for navigation to complete
  await page.waitForLoadState('networkidle');
  
  // Navigate to sales page
  await page.goto('http://localhost:5173/sales');
  await page.waitForLoadState('networkidle');
  
  // Wait a bit for products to load
  await page.waitForTimeout(2000);
  
  // Check if products are loaded
  const productElements = await page.locator('[data-testid*="product"]').count();
  const addToCartButtons = await page.locator('[data-testid="sales-add-to-cart-button"]').count();
  
  console.log('Product elements found:', productElements);
  console.log('Add to cart buttons found:', addToCartButtons);
  
  // Take a screenshot for debugging
  await page.screenshot({ path: 'sales-page-after-login.png', fullPage: true });
});