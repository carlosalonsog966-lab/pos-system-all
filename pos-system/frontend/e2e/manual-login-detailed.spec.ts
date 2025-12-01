import { test, expect } from '@playwright/test';

test('Manual login test - detailed network capture', async ({ page }) => {
  const baseURL = 'http://localhost:5173';
  
  // Capture all network requests and responses
  page.on('request', request => {
    console.log('Request:', request.method(), request.url());
    if (request.method() === 'POST') {
      console.log('Request body:', request.postData());
    }
  });
  
  page.on('response', response => {
    console.log('Response:', response.status(), response.url());
    if (!response.ok()) {
      console.log('Response error:', response.status(), response.statusText());
    }
  });
  
  // Capture console messages
  page.on('console', msg => {
    console.log('Console:', msg.type(), msg.text());
  });
  
  // Navigate to login page
  await page.goto(`${baseURL}/login`);
  await page.waitForLoadState('networkidle');
  
  console.log('Current URL:', page.url());
  
  // Fill login form
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  
  // Click submit and wait for navigation
  await Promise.all([
    page.waitForNavigation(), // Wait for navigation
    page.click('button[type="submit"]')
  ]);
  
  // Check current URL after navigation
  const currentUrl = page.url();
  console.log('URL after login:', currentUrl);
  
  // Take screenshot after login
  await page.screenshot({ path: 'after-login-detailed.png', fullPage: true });
  
  // Check if we're logged in by checking for dashboard elements
  const dashboardElements = await page.locator('[data-testid*="dashboard"]').count();
  console.log(`Found ${dashboardElements} dashboard elements`);
  
  // Check for navigation menu or other logged-in indicators
  const navMenu = await page.locator('nav').count();
  console.log(`Found ${navMenu} navigation menus`);
  
  // Check if there's a user menu or profile
  const userMenu = await page.locator('text="admin"').count();
  console.log(`Found ${userMenu} admin text references`);
});