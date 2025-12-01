// Using built-in fetch (Node.js 18+)
const API_BASE_URL = 'http://localhost:5656/api';

interface AuthResponse {
  token: string;
  user: any;
}

interface ApiResponse {
  success?: boolean;
  data?: any;
  error?: string;
}

async function authenticateUser(): Promise<string | null> {
  try {
    console.log('🔐 Authenticating user...');
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    if (!response.ok) {
      console.log(`❌ Authentication failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log(`Error details: ${errorText}`);
      return null;
    }

    const authData = await response.json();
    console.log('✅ Authentication successful');
    
    // Try different possible token field names
    const token = authData.token || authData.accessToken || authData.access_token || authData.data?.token;
    
    if (!token) {
      console.log('❌ No token found in response');
      return null;
    }
    
    return token;
  } catch (error) {
    console.log(`❌ Authentication error: ${error}`);
    return null;
  }
}

async function testEndpoint(endpoint: string, token: string): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return { error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const data = await response.json();
    // Handle different response structures
    return data.data || data;
  } catch (error) {
    return { error: `Connection error: ${error}` };
  }
}

async function createSale(saleData: any, token: string): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/sales`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(saleData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { error: `HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    return data.data || data;
  } catch (error) {
    return { error: `Connection error: ${error}` };
  }
}

async function runTests() {
  console.log('🚀 Starting Frontend API Tests for Tourism Functionality\n');

  // Step 1: Authenticate
  const token = await authenticateUser();
  if (!token) {
    console.log('❌ Cannot proceed without authentication token');
    return;
  }

  console.log(`🔑 Using token: ${token.substring(0, 20)}...`);

  // Step 2: Test basic endpoints
  console.log('\n📋 Testing basic endpoints...');
  
  const endpoints = ['/agencies', '/guides', '/employees', '/branches', '/products'];
  const testData: any = {};

  for (const endpoint of endpoints) {
    console.log(`Testing ${endpoint}...`);
    const result = await testEndpoint(endpoint, token);
    if (result.error) {
      console.log(`❌ ${endpoint}: ${result.error}`);
    } else {
      console.log(`✅ ${endpoint}: ${Array.isArray(result) ? result.length : 'OK'} items`);
      testData[endpoint.substring(1)] = result;
    }
  }

  // Step 3: Get sample data for sales creation
  const agencies = testData.agencies || [];
  const guides = testData.guides || [];
  const employees = testData.employees || [];
  const branches = testData.branches || [];
  const products = testData.products || [];

  console.log(`Data counts - Agencies: ${agencies.length}, Guides: ${guides.length}, Employees: ${employees.length}, Branches: ${branches.length}, Products: ${products.length}`);

  if (agencies.length === 0 || guides.length === 0 || employees.length === 0 || branches.length === 0 || products.length === 0) {
    console.log('❌ Missing required data for sales creation');
    return;
  }

  // Step 4: Test creating STREET sale with tourism fields
  console.log('\n🏪 Testing STREET sale creation with tourism fields...');
  
  const streetSaleData = {
    type: 'STREET',
    paymentMethod: 'cash',
    status: 'completed',
    saleNumber: `ST-${Date.now()}`,
    taxAmount: 15.00,
    discountAmount: 5.00,
    saleDate: new Date().toISOString(),
    employeeId: employees[0]?.id,
    branchId: branches[0]?.id,
    // Tourism fields for STREET sale
    agencyId: agencies[0]?.id,
    touristName: 'John Doe',
    touristEmail: 'john.doe@email.com',
    touristPhone: '+1234567890',
    touristCountry: 'USA',
    items: [
      {
        productId: products[0]?.id, // Use real product ID
        quantity: 2,
        unitPrice: 25.00,
        totalPrice: 50.00
      }
    ]
  };

  console.log('Street sale data:', JSON.stringify(streetSaleData, null, 2));

  const streetSaleResult = await createSale(streetSaleData, token);
  if (streetSaleResult.error) {
    console.log(`❌ STREET sale creation failed: ${streetSaleResult.error}`);
  } else {
    console.log(`✅ STREET sale created successfully: ID ${streetSaleResult.id || streetSaleResult.data?.id}`);
  }

  // Step 5: Test creating GUIDE sale with tourism fields
  console.log('\n👨‍🏫 Testing GUIDE sale creation with tourism fields...');
  
  const guideSaleData = {
    type: 'GUIDE',
    paymentMethod: 'cash',
    status: 'completed',
    saleNumber: `GD-${Date.now()}`,
    taxAmount: 20.00,
    discountAmount: 10.00,
    saleDate: new Date().toISOString(),
    employeeId: employees[0]?.id,
    branchId: branches[0]?.id,
    // Tourism fields for GUIDE sale
    guideId: guides[0]?.id,
    touristName: 'Jane Smith',
    touristEmail: 'jane.smith@email.com',
    touristPhone: '+0987654321',
    touristCountry: 'Canada',
    items: [
      {
        productId: products[0]?.id, // Use real product ID
        quantity: 1,
        unitPrice: 75.00,
        totalPrice: 75.00
      }
    ]
  };

  console.log('Guide sale data:', JSON.stringify(guideSaleData, null, 2));

  const guideSaleResult = await createSale(guideSaleData, token);
  if (guideSaleResult.error) {
    console.log(`❌ GUIDE sale creation failed: ${guideSaleResult.error}`);
  } else {
    console.log(`✅ GUIDE sale created successfully: ID ${guideSaleResult.id || guideSaleResult.data?.id}`);
  }

  // Step 6: Test querying sales with tourism data
  console.log('\n🔍 Testing sales query...');
  
  const salesResult = await testEndpoint('/sales', token);
  if (salesResult.error) {
    console.log(`❌ Sales query failed: ${salesResult.error}`);
  } else {
    console.log(`✅ Sales query successful: ${Array.isArray(salesResult) ? salesResult.length : 'OK'} sales found`);
    
    // Check if tourism data is included
    if (Array.isArray(salesResult) && salesResult.length > 0) {
      const salesWithTourism = salesResult.filter(sale => 
        sale.touristName || sale.agencyId || sale.guideId
      );
      console.log(`📊 Sales with tourism data: ${salesWithTourism.length}`);
      
      // Show some sample tourism data
      if (salesWithTourism.length > 0) {
        console.log('Sample tourism sale:', JSON.stringify(salesWithTourism[0], null, 2));
      }
    }
  }

  // Step 7: Test specific sales endpoints
  console.log('\n📈 Testing specific sales endpoints...');
  
  const salesEndpoints = [
    '/sales?type=STREET',
    '/sales?type=GUIDE'
  ];

  for (const endpoint of salesEndpoints) {
    console.log(`Testing ${endpoint}...`);
    const result = await testEndpoint(endpoint, token);
    if (result.error) {
      console.log(`❌ ${endpoint}: ${result.error}`);
    } else {
      console.log(`✅ ${endpoint}: ${Array.isArray(result) ? result.length : 'OK'} sales found`);
    }
  }

  console.log('\n🎉 Frontend API Tests for Tourism Functionality completed!');
}

// Run the tests
runTests().catch(console.error);