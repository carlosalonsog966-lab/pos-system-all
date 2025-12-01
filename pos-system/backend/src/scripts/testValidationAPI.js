// Test validation API calls
const axios = require('axios');

const API_BASE = 'http://localhost:5757/api';

async function testValidations() {
  console.log('=== TESTING VALIDATION SYSTEM ===\n');

  // Test 1: Create product with invalid data (salePrice < cost)
  console.log('1. Testing product validation - salePrice < cost...');
  try {
    const response = await axios.post(`${API_BASE}/products`, {
      name: 'Test Product',
      barcode: '12345',
      category: 'Anillos',
      cost: 100.00,
      salePrice: 80.00, // Less than cost - should fail
      stock: 10,
      minStock: 2
    }, {
      headers: {
        'Authorization': 'Bearer test-token', // This will be ignored for read operations
        'Content-Type': 'application/json'
      }
    });
    console.log('❌ Expected validation error but got success:', response.data);
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✅ Validation correctly rejected:', error.response.data.message);
      if (error.response.data.errors) {
        error.response.data.errors.forEach(err => console.log('  -', err.message));
      }
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }

  // Test 2: Create product with valid data
  console.log('\n2. Testing product validation - valid data...');
  try {
    const response = await axios.post(`${API_BASE}/products`, {
      name: 'Test Product Valid',
      barcode: '12345',
      category: 'Anillos',
      cost: 100.00,
      salePrice: 150.00, // Greater than cost - should pass
      stock: 10,
      minStock: 2
    }, {
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Valid product created:', response.data.success);
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('✅ Authentication required (expected):', error.response.data.message);
    } else if (error.response && error.response.status === 400) {
      console.log('❌ Validation failed:', error.response.data.message);
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }

  // Test 3: Test sale validation with invalid total
  console.log('\n3. Testing sale validation - invalid total...');
  try {
    const response = await axios.post(`${API_BASE}/sales`, {
      items: [
        { productId: 1, quantity: 2, price: 100.00 },
        { productId: 2, quantity: 1, price: 50.00 }
      ],
      total: 300.00 // Should be 250.00 - should fail validation
    }, {
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      }
    });
    console.log('❌ Expected validation error but got success:', response.data);
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✅ Validation correctly rejected:', error.response.data.message);
      if (error.response.data.errors) {
        error.response.data.errors.forEach(err => console.log('  -', err.message));
      }
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }

  console.log('\n=== VALIDATION TESTS COMPLETED ===');
}

// Run the tests
testValidations().catch(console.error);