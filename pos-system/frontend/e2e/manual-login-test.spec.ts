import { test, expect } from '@playwright/test';

test('Manual login test', async ({ page }) => {
  const baseURL = 'http://localhost:5173';
  
  // Navigate to login page
  await page.goto(`${baseURL}/login`);
  await page.waitForLoadState('networkidle');
  
  console.log('Current URL:', page.url());
  
  // Take a screenshot to see the page
  await page.screenshot({ path: 'login-page.png', fullPage: true });
  
  // Check if login form exists
  const usernameInput = await page.locator('#username');
  const passwordInput = await page.locator('#password');
  const submitButton = await page.locator('button[type="submit"]');
  
  console.log('Username input visible:', await usernameInput.isVisible());
  console.log('Password input visible:', await passwordInput.isVisible());
  console.log('Submit button visible:', await submitButton.isVisible());
  
  // Fill login form
  await usernameInput.fill('admin');
  await passwordInput.fill('admin123');
  
  // Submit login form
  await submitButton.click();
  
  // Wait for navigation
  await page.waitForLoadState('networkidle');
  
  // Check current URL
  const currentUrl = page.url();
  console.log('URL after login:', currentUrl);
  
  // Take a screenshot after login
  await page.screenshot({ path: 'after-login.png', fullPage: true });
  
  // Check if we're logged in
  if (currentUrl.includes('/login')) {
    console.log('Login failed - still on login page');
    // Check for error messages
    const errorMessage = await page.locator('.text-danger-600').textContent();
    console.log('Error message:', errorMessage);
  } else {
    console.log('Login successful!');
    
    // Navigate to sales page to check if products load
    await page.goto(`${baseURL}/sales`);
    await page.waitForLoadState('networkidle');
    
    // Check if products are loaded
    const addToCartButtons = await page.locator('[data-testid="sales-add-to-cart-button"]').count();
    console.log(`Found ${addToCartButtons} add-to-cart buttons`);
    
    // Take screenshot of sales page
    await page.screenshot({ path: 'sales-page.png', fullPage: true });
  }
});