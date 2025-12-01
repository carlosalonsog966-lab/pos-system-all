import { test, expect } from '@playwright/test';

test('Test products loading on sales page after login', async ({ page }) => {
  const baseURL = 'http://localhost:5173';
  
  // Step 1: Login first
  await page.goto(`${baseURL}/login`);
  await page.waitForLoadState('networkidle');
  
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  
  // Wait for navigation to dashboard
  await page.waitForLoadState('networkidle');
  
  console.log('Logged in successfully, URL:', page.url());
  
  // Step 2: Navigate to sales page
  await page.goto(`${baseURL}/sales`);
  await page.waitForLoadState('networkidle');
  
  console.log('Sales page URL:', page.url());
  
  // Take screenshot of sales page
  await page.screenshot({ path: 'sales-page-with-login.png', fullPage: true });
  
  // Check if products are loaded
  const addToCartButtons = await page.locator('[data-testid="sales-add-to-cart-button"]').count();
  console.log(`Found ${addToCartButtons} add-to-cart buttons`);
  
  // Check if there are any product elements
  const productElements = await page.locator('[data-testid*="product"]').count();
  console.log(`Found ${productElements} product elements`);
  
  // Check for "no products" message
  const noProductsMessage = await page.locator('text="No se encontraron productos"').count();
  console.log(`No products message visible: ${noProductsMessage > 0}`);
  
  // Check for product cards or grid
  const productCards = await page.locator('.product-card, [class*="product"], .grid > *').count();
  console.log(`Found ${productCards} potential product cards`);
  
  // If no products found, check if we need to load them or if there's an error
  if (addToCartButtons === 0) {
    console.log('No products found. Checking for filters or search issues...');
    
    // Check if there's a search input
    const searchInput = await page.locator('[data-testid="sales-search-input"]').count();
    console.log(`Search input found: ${searchInput > 0}`);
    
    // Check if there are category filters
    const categoryFilter = await page.locator('[data-testid="sales-category-filter"]').count();
    console.log(`Category filter found: ${categoryFilter > 0}`);
    
    // Try clearing search or filters if they exist
    if (searchInput > 0) {
      await page.fill('[data-testid="sales-search-input"]', '');
      await page.waitForTimeout(1000); // Wait for search to update
      
      // Check again for products
      const addToCartButtonsAfter = await page.locator('[data-testid="sales-add-to-cart-button"]').count();
      console.log(`Found ${addToCartButtonsAfter} add-to-cart buttons after clearing search`);
    }
  }
});