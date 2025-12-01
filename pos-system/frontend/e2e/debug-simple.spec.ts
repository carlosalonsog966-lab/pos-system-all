import { test, expect } from '@playwright/test';

test('debug simple page check', async ({ page }) => {
  const baseURL = 'http://localhost:5173';
  
  // Navigate to home page
  await page.goto(`${baseURL}/#/login`);
  await page.waitForLoadState('networkidle');
  
  console.log('Current URL:', page.url());
  
  // Check if the page has any content
  const bodyContent = await page.textContent('body');
  console.log('Body content:', bodyContent);
  
  // Check if there's a root element
  const rootElement = await page.$('#root');
  console.log('Root element found:', !!rootElement);
  
  if (rootElement) {
    const rootContent = await rootElement.textContent();
    console.log('Root content:', rootContent);
  }
  
  // Take screenshot
  await page.screenshot({ path: 'debug-simple.png' });
  
  // Check if there are any console errors
  page.on('console', msg => {
    console.log('Console message:', msg.text());
  });
  
  // Check if there are any network errors
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log('Network error:', response.status(), response.url());
    }
  });
  
  // Wait a bit more to see if content loads
  await page.waitForTimeout(2000);
  
  const finalContent = await page.textContent('body');
  console.log('Final body content:', finalContent);
});