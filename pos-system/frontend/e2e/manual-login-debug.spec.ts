import { test, expect } from '@playwright/test';

test('Manual login test with console logs', async ({ page }) => {
  const baseURL = 'http://localhost:5173';
  
  // Capture console messages
  page.on('console', msg => {
    console.log('Console:', msg.type(), msg.text());
  });
  
  // Capture network errors
  page.on('response', response => {
    if (!response.ok()) {
      console.log('Network error:', response.status(), response.url());
    }
  });
  
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
  
  // Check form values
  console.log('Username value:', await usernameInput.inputValue());
  console.log('Password value:', await passwordInput.inputValue());
  
  // Submit login form
  await submitButton.click();
  
  // Wait a bit longer for any responses
  await page.waitForTimeout(2000);
  
  // Check current URL
  const currentUrl = page.url();
  console.log('URL after login:', currentUrl);
  
  // Take screenshot after login
  await page.screenshot({ path: 'after-login.png', fullPage: true });
  
  // Check if we're logged in
  if (currentUrl.includes('/login')) {
    console.log('Login failed - still on login page');
    
    // Check for specific error message (not the asterisks)
    const errorMessages = await page.locator('.text-danger-600').all();
    for (let i = 0; i < errorMessages.length; i++) {
      const text = await errorMessages[i].textContent();
      if (text && text !== '*') {
        console.log('Error message:', text);
      }
    }
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