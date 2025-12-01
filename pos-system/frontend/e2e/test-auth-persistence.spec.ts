import { test, expect } from '@playwright/test';

test('Test authentication persistence', async ({ page, context }) => {
  const baseURL = 'http://localhost:5173';
  
  // Step 1: Login first
  console.log('Step 1: Logging in...');
  await page.goto(`${baseURL}/login`);
  await page.waitForLoadState('networkidle');
  
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  
  // Wait for navigation to dashboard
  await page.waitForLoadState('networkidle');
  
  console.log('After login, URL:', page.url());
  
  // Check if we're on dashboard
  const isDashboard = page.url().includes('/dashboard');
  console.log('Is on dashboard:', isDashboard);
  
  // Take screenshot of dashboard
  await page.screenshot({ path: 'dashboard-after-login.png', fullPage: true });
  
  // Step 2: Check localStorage/sessionStorage for auth tokens
  const localStorage = await page.evaluate(() => window.localStorage);
  console.log('LocalStorage keys:', Object.keys(localStorage));
  
  const sessionStorage = await page.evaluate(() => window.sessionStorage);
  console.log('SessionStorage keys:', Object.keys(sessionStorage));
  
  // Check for auth token
  const authToken = await page.evaluate(() => window.localStorage.getItem('auth_token'));
  console.log('Auth token in localStorage:', authToken);
  
  // Step 3: Navigate to sales page in the same context
  console.log('Step 3: Navigating to sales page...');
  await page.goto(`${baseURL}/sales`);
  await page.waitForLoadState('networkidle');
  
  console.log('Sales page URL:', page.url());
  
  // Take screenshot of sales page
  await page.screenshot({ path: 'sales-page-auth-test.png', fullPage: true });
  
  // Check if we're still authenticated
  const isStillAuthenticated = !page.url().includes('/login');
  console.log('Is still authenticated:', isStillAuthenticated);
  
  // Check for auth token again
  const authTokenAfter = await page.evaluate(() => window.localStorage.getItem('auth_token'));
  console.log('Auth token after navigation:', authTokenAfter);
  
  // Step 4: If authenticated, check for products
  if (isStillAuthenticated) {
    console.log('Still authenticated, checking for products...');
    
    const addToCartButtons = await page.locator('[data-testid="sales-add-to-cart-button"]').count();
    console.log(`Found ${addToCartButtons} add-to-cart buttons`);
    
    // Wait a bit more for products to load
    await page.waitForTimeout(2000);
    
    const addToCartButtonsAfter = await page.locator('[data-testid="sales-add-to-cart-button"]').count();
    console.log(`Found ${addToCartButtonsAfter} add-to-cart buttons after waiting`);
  } else {
    console.log('Lost authentication, redirecting to login');
  }
});