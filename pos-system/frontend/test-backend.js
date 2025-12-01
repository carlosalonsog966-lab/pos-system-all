import axios from 'axios';

async function testLogin() {
  try {
    console.log('🧪 Probando login...');
    
    // Test login
    const response = await axios.post('http://localhost:5656/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    console.log('✅ Login exitoso:', response.data);
    
    // Test products
    const productsResponse = await axios.get('http://localhost:5656/api/products', {
      headers: {
        'Authorization': `Bearer ${response.data.token}`
      }
    });
    
    console.log('✅ Productos cargados:', productsResponse.data.length, 'productos');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testLogin();