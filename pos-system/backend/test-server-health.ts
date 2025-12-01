import axios from 'axios';

async function testServerHealth() {
  console.log('🏥 Testing Server Health...\n');

  const endpoints = [
    'http://localhost:3000',
    'http://localhost:3000/api',
    'http://localhost:3000/api/health',
    'http://localhost:3000/api/agencies',
    'http://localhost:3000/api/guides',
    'http://localhost:3000/api/employees',
    'http://localhost:3000/api/branches',
    'http://localhost:3000/api/sales'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing: ${endpoint}`);
      const response = await axios.get(endpoint, { timeout: 5000 });
      console.log(`✅ ${endpoint} - Status: ${response.status}`);
      if (response.data && typeof response.data === 'object') {
        if (Array.isArray(response.data)) {
          console.log(`   Response: Array with ${response.data.length} items`);
        } else {
          console.log(`   Response: Object with keys: ${Object.keys(response.data).join(', ')}`);
        }
      }
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`❌ ${endpoint} - Connection refused (server not running?)`);
      } else if (error.response) {
        console.log(`❌ ${endpoint} - Status: ${error.response.status} - ${error.response.statusText}`);
      } else {
        console.log(`❌ ${endpoint} - Error: ${error.message}`);
      }
    }
    console.log('');
  }

  console.log('🎉 Server health check completed!');
}

testServerHealth();