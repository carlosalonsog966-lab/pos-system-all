import { chromium } from '@playwright/test';

async function testAddToCart() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Go to sales page
  await page.goto('http://localhost:5173/sales');
  await page.waitForLoadState('networkidle');
  
  // Wait for products to load
  await page.waitForTimeout(2000);
  
  // Find and click the first add-to-cart button
  const addToCartButton = await page.getByTestId('sales-add-to-cart-button').first();
  
  if (addToCartButton) {
    console.log('Found add-to-cart button');
    
    // Set up network monitoring
    let networkHit = false;
    page.on('response', (response) => {
      if (response.url().includes('/sales/items')) {
        console.log('Network hit detected:', response.url());
        networkHit = true;
      }
    });
    
    // Set up toast monitoring
    let toastDetected = false;
    page.on('domcontentloaded', () => {
      console.log('DOM content loaded');
    });
    
    // Click the button
    await addToCartButton.click();
    console.log('Button clicked');
    
    // Wait for effects
    await page.waitForTimeout(1000);
    
    // Check for toast
    const toast = await page.getByRole('status').first();
    if (toast) {
      const text = await toast.textContent();
      console.log('Toast detected:', text);
      toastDetected = true;
    }
    
    // Check for DOM changes
    const htmlAfter = await page.content();
    console.log('HTML length after:', htmlAfter.length);
    
    console.log('Network hit:', networkHit);
    console.log('Toast detected:', toastDetected);
    
  } else {
    console.log('Add-to-cart button not found');
  }
  
  await browser.close();
}

testAddToCart().catch(console.error);