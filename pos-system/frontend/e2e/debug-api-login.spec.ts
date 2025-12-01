import { test, expect } from '@playwright/test';

test('debug API login', async ({ page }) => {
  const baseURL = 'http://localhost:5173';
  
  // Navigate to login page
  await page.goto(`${baseURL}/#/login`);
  await page.waitForLoadState('networkidle');
  
  // Capture network requests
  const networkRequests: any[] = [];
  page.on('request', request => {
    if (request.url().includes('/auth/login')) {
      networkRequests.push({
        method: request.method(),
        url: request.url(),
        headers: request.headers(),
        postData: request.postData()
      });
      console.log('Login request captured:', request.method(), request.url());
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('/auth/login')) {
      console.log('Login response:', response.status(), response.url());
    }
  });
  
  // Fill login form with demo credentials
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  
  // Submit login form
  await page.click('button[type="submit"]');
  
  // Wait for response
  await page.waitForTimeout(3000);
  
  console.log('Network requests captured:', networkRequests.length);
  
  // Check if we're still on login page
  const currentUrl = page.url();
  console.log('Current URL after login:', currentUrl);
  
  // Check for error messages
  const errorElement = await page.$('.bg-red-50');
  if (errorElement) {
    const errorText = await errorElement.textContent();
    console.log('Error message:', errorText);
  }
  
  // Take screenshot
  await page.screenshot({ path: 'debug-api-login.png' });
});