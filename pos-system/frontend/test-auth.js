import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5757/api',
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

async function testAuthentication() {
  console.log('Testing authentication...');
  
  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResp = await api.get('/health');
    console.log('Health response:', healthResp.data);
    
    // Test login
    console.log('2. Testing login...');
    const loginResp = await api.post('/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    console.log('Login response:', loginResp.data);
    
    if (loginResp.data.success) {
      const token = loginResp.data.data.token;
      console.log('3. Token received:', token.substring(0, 20) + '...');
      
      // Test products with token
      console.log('4. Testing products endpoint...');
      const productsResp = await api.get('/products', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('Products response:', productsResp.data);
      
      if (productsResp.data.success) {
        console.log('5. Products count:', productsResp.data.data.length);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testAuthentication();