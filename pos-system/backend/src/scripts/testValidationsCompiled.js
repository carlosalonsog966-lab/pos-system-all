// Simple validation test
const { productValidation, saleValidation, clientValidation } = require('../middleware/validation');

// Test product validation
console.log('=== TESTING PRODUCT VALIDATION ===');

// Test 1: Valid product
const validProduct = {
  name: 'Anillo de Oro 18k',
  barcode: '12345-ABC',
  category: 'Anillos',
  cost: 150.00,
  salePrice: 250.00,
  stock: 10,
  minStock: 2
};

const mockReq1 = { body: validProduct };
const mockRes1 = { status: (code) => ({ json: (data) => console.log('Response:', code, data) }) };
const mockNext1 = () => console.log('✅ Product validation PASSED');

console.log('Testing valid product...');
productValidation[0](mockReq1, mockRes1, mockNext1);

// Test 2: Invalid product (salePrice < cost)
const invalidProduct = {
  name: 'Anillo de Oro 18k',
  barcode: '12345-ABC',
  category: 'Anillos',
  cost: 150.00,
  salePrice: 100.00, // Less than cost
  stock: 10,
  minStock: 2
};

const mockReq2 = { body: invalidProduct };
const mockRes2 = { 
  status: (code) => ({
    json: (data) => {
      console.log('❌ Product validation FAILED:', data.message);
      if (data.errors) {
        data.errors.forEach((err) => console.log('  -', err.message));
      }
    }
  })
};
const mockNext2 = () => console.log('This should not be called');

console.log('\nTesting invalid product (salePrice < cost)...');
productValidation[0](mockReq2, mockRes2, mockNext2);

console.log('\n=== VALIDATION TESTS COMPLETED ===');