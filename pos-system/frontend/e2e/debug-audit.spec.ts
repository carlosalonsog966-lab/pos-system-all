import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Simple test to debug the add-to-cart button
test('Debug Add to Cart Button', async ({ page }) => {
  const baseURL = 'http://localhost:5173';
  
  // Go to sales page
  await page.goto(`${baseURL}/sales`);
  await page.waitForLoadState('networkidle');
  
  // Wait a bit for products to load
  await page.waitForTimeout(3000);
  
  // Check what's on the page
  const pageText = await page.textContent('body');
  console.log('Page text preview:', pageText?.substring(0, 500));
  
  // Check if there are any products
  const productElements = await page.locator('[data-testid*="product"]').count();
  console.log('Product elements found:', productElements);
  
  // Find ALL add-to-cart buttons
  const allButtons = await page.getByTestId('sales-add-to-cart-button').all();
  console.log('Total add-to-cart buttons found:', allButtons.length);
  
  // Check if there are any buttons at all
  const allButtonsOnPage = await page.locator('button').count();
  console.log('Total buttons on page:', allButtonsOnPage);
  
  // Take a screenshot to see what's on the page
  await page.screenshot({ path: 'debug-sales-page-full.png', fullPage: true });
  
  if (allButtons.length === 0) {
    console.log('No add-to-cart buttons found - checking if products exist');
    
    // Check for "No products" message
    const noProductsText = await page.getByText('No se encontraron productos').count();
    console.log('No products message found:', noProductsText);
    
    // Check for loading state
    const loadingText = await page.getByText('Cargando').count();
    console.log('Loading text found:', loadingText);
    
    return;
  }
  
  // Test with the first button
  const firstButton = allButtons[0];
  
  // Monitor network requests
  const networkRequests = [];
  page.on('request', (request) => {
    console.log('Request:', request.method(), request.url());
    networkRequests.push({ method: request.method(), url: request.url() });
  });
  
  page.on('response', (response) => {
    console.log('Response:', response.status(), response.url());
  });
  
  // Monitor DOM changes
  const htmlBefore = await page.content();
  console.log('HTML length before:', htmlBefore.length);
  
  // Monitor toasts
  const toastsBefore = await page.getByRole('status').count();
  console.log('Toasts before:', toastsBefore);
  
  // Click the button
  await firstButton.click();
  console.log('Button clicked');
  
  // Wait for effects
  await page.waitForTimeout(1000);
  
  // Check results
  const htmlAfter = await page.content();
  console.log('HTML length after:', htmlAfter.length);
  
  const toastsAfter = await page.getByRole('status').count();
  console.log('Toasts after:', toastsAfter);
  
  const networkHit = networkRequests.some(req => req.url.includes('/sales/items'));
  console.log('Network hit detected:', networkHit);
  
  const domChanged = htmlBefore.length !== htmlAfter.length;
  console.log('DOM changed:', domChanged);
  
  const toastDetected = toastsAfter > toastsBefore;
  console.log('Toast detected:', toastDetected);
  
  console.log('Results:', { networkHit, domChanged, toastDetected });
});