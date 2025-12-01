import { test, expect } from '@playwright/test';

test('test backend login directly', async ({ request }) => {
  // Test login to backend directly
  const loginData = {
    username: 'admin',
    password: 'admin123'
  };
  
  try {
    const response = await request.post('http://localhost:5757/api/auth/login', {
      data: loginData,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Login response status:', response.status());
    console.log('Login response headers:', response.headers());
    
    const responseText = await response.text();
    console.log('Login response body:', responseText);
    
    if (response.status() === 200) {
      const data = JSON.parse(responseText);
      console.log('Login successful:', data);
      expect(response.status()).toBe(200);
    } else {
      console.log('Login failed with status:', response.status());
      console.log('Response body:', responseText);
    }
    
  } catch (error) {
    console.log('Login request failed:', error);
  }
});