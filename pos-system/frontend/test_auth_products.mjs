// Test authentication and products API
import axios from 'axios';

const API_BASE = 'http://localhost:5173/api';

async function testAuthAndProducts() {
  try {
    console.log('1. Authenticating...');
    
    // Login to get token
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    console.log('Login response:', loginResponse.data);
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.data.token;
      console.log('✅ Authentication successful!');
      console.log('Token:', token.substring(0, 20) + '...');
      
      console.log('\n2. Testing products API...');
      
      // Test products API with token
      const productsResponse = await axios.get(`${API_BASE}/products`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Products API response status:', productsResponse.status);
      console.log('Products count:', productsResponse.data.data?.length || 0);
      
      if (productsResponse.data.data && productsResponse.data.data.length > 0) {
        console.log('✅ Products API working! Found', productsResponse.data.data.length, 'products');
        console.log('First product:', productsResponse.data.data[0].name);
      } else {
        console.log('❌ No products found');
      }
      
    } else {
      console.log('❌ Authentication failed');
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testAuthAndProducts();