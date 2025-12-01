import { test, expect } from '@playwright/test';

test('debug console errors', async ({ page }) => {
  const baseURL = 'http://localhost:5173';
  
  // Capture console messages
  const consoleMessages: string[] = [];
  page.on('console', msg => {
    const message = `[${msg.type()}] ${msg.text()}`;
    consoleMessages.push(message);
    console.log('Console:', message);
  });
  
  // Capture page errors
  const pageErrors: string[] = [];
  page.on('pageerror', error => {
    const message = `Page error: ${error.message}`;
    pageErrors.push(message);
    console.log('Page error:', message);
  });
  
  // Navigate to home page
  await page.goto(`${baseURL}/#/login`);
  
  // Wait for content to load
  await page.waitForTimeout(3000);
  
  console.log('Console messages captured:', consoleMessages.length);
  console.log('Page errors captured:', pageErrors.length);
  
  // Check if there are any network requests
  const networkRequests: string[] = [];
  page.on('request', request => {
    networkRequests.push(`Request: ${request.method()} ${request.url()}`);
  });
  
  page.on('response', response => {
    networkRequests.push(`Response: ${response.status()} ${response.url()}`);
  });
  
  // Wait a bit more to capture network activity
  await page.waitForTimeout(2000);
  
  console.log('Network requests captured:', networkRequests.length);
  networkRequests.forEach(msg => console.log('Network:', msg));
  
  // Take screenshot
  await page.screenshot({ path: 'debug-console.png' });
  
  // Check the HTML content
  const html = await page.content();
  console.log('HTML content length:', html.length);
  
  // Check if there are any script tags
  const scriptTags = await page.$$('script');
  console.log('Script tags found:', scriptTags.length);
  
  // Check if there are any link tags
  const linkTags = await page.$$('link');
  console.log('Link tags found:', linkTags.length);
});