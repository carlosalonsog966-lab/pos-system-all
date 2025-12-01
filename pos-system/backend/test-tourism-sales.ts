import { sequelize } from './src/db/config';

async function testTourismSales() {
  try {
    console.log('🧪 Testing Tourism Sales Creation...\n');

    // 1. Get sample data using raw queries
    const [products] = await sequelize.query('SELECT * FROM products LIMIT 1') as any[];
    const [agencies] = await sequelize.query('SELECT * FROM agencies LIMIT 1') as any[];
    const [guides] = await sequelize.query('SELECT * FROM guides LIMIT 1') as any[];
    const [employees] = await sequelize.query('SELECT * FROM employees LIMIT 1') as any[];
    const [branches] = await sequelize.query('SELECT * FROM branches LIMIT 1') as any[];
    const [users] = await sequelize.query('SELECT * FROM users LIMIT 1') as any[];

    if (!products[0] || !agencies[0] || !guides[0] || !employees[0] || !branches[0] || !users[0]) {
      console.error('❌ Missing required data for testing');
      return;
    }

    const product = products[0];
    const agency = agencies[0];
    const guide = guides[0];
    const employee = employees[0];
    const branch = branches[0];
    const user = users[0];

    console.log('📋 Sample Data Found:');
    console.log(`  Product: ${product.name} (${product.code}) - $${product.salePrice}`);
    console.log(`  Agency: ${agency.name} (${agency.code})`);
    console.log(`  Guide: ${guide.name} (${guide.code})`);
    console.log(`  Employee: ${employee.name} (${employee.code})`);
    console.log(`  Branch: ${branch.name} (${branch.code})`);
    console.log(`  User: ${user.username}\n`);

    // 2. Test STREET sale (without tourism fields)
    console.log('🛍️ Testing STREET Sale...');
    const streetSaleId = `street-${Date.now()}`;
    const streetSaleNumber = `ST-${Date.now()}`;
    
    await sequelize.query(`
      INSERT INTO sales (
        id, saleNumber, userId, branchId, employeeId, saleType,
        subtotal, taxAmount, discountAmount, total, paymentMethod, status, saleDate,
        createdAt, updatedAt
      ) VALUES (
        '${streetSaleId}', '${streetSaleNumber}', '${user.id}', '${branch.id}', '${employee.id}', 'STREET',
        ${product.salePrice}, 0, 0, ${product.salePrice}, 'cash', 'completed', datetime('now'),
        datetime('now'), datetime('now')
      )
    `);

    console.log(`✅ STREET Sale created: ${streetSaleId}`);
    console.log(`   Type: STREET`);
    console.log(`   Total: $${product.salePrice}`);
    console.log(`   Employee: ${employee.name}`);
    console.log(`   Branch: ${branch.name}\n`);

    // 3. Test GUIDE sale (with tourism fields)
    console.log('🏛️ Testing GUIDE Sale...');
    const guideSaleId = `guide-${Date.now()}`;
    const guideSaleNumber = `GU-${Date.now()}`;
    
    await sequelize.query(`
      INSERT INTO sales (
        id, saleNumber, userId, branchId, employeeId, agencyId, guideId, saleType,
        agencyCommission, guideCommission, employeeCommission,
        subtotal, taxAmount, discountAmount, total, paymentMethod, status, saleDate,
        createdAt, updatedAt
      ) VALUES (
        '${guideSaleId}', '${guideSaleNumber}', '${user.id}', '${branch.id}', '${employee.id}', 
        '${agency.id}', '${guide.id}', 'GUIDE',
        15.0, 10.0, 5.0,
        ${product.salePrice}, 0, 0, ${product.salePrice}, 'cash', 'completed', datetime('now'),
        datetime('now'), datetime('now')
      )
    `);

    console.log(`✅ GUIDE Sale created: ${guideSaleId}`);
    console.log(`   Type: GUIDE`);
    console.log(`   Total: $${product.salePrice}`);
    console.log(`   Agency: ${agency.name}`);
    console.log(`   Guide: ${guide.name}`);
    console.log(`   Employee: ${employee.name}`);
    console.log(`   Branch: ${branch.name}`);
    console.log(`   Agency Commission: 15.0%`);
    console.log(`   Guide Commission: 10.0%`);
    console.log(`   Employee Commission: 5.0%\n`);

    // 4. Test querying sales with tourism data
    console.log('📊 Testing Sales Query with Tourism Data...');
    const [salesWithTourism] = await sequelize.query(`
      SELECT 
        s.*,
        a.name as agency_name,
        g.name as guide_name,
        e.name as employee_name,
        b.name as branch_name
      FROM sales s
      LEFT JOIN agencies a ON s.agencyId = a.id
      LEFT JOIN guides g ON s.guideId = g.id
      LEFT JOIN employees e ON s.employeeId = e.id
      LEFT JOIN branches b ON s.branchId = b.id
      WHERE s.saleType = 'GUIDE'
      ORDER BY s.createdAt DESC
      LIMIT 5
    `) as any[];

    console.log(`✅ Found ${salesWithTourism.length} GUIDE sales with tourism data`);
    salesWithTourism.forEach((sale: any, index: number) => {
      console.log(`   ${index + 1}. Sale ${sale.id.substring(0, 8)}...`);
      console.log(`      Agency: ${sale.agency_name || 'N/A'}`);
      console.log(`      Guide: ${sale.guide_name || 'N/A'}`);
      console.log(`      Employee: ${sale.employee_name || 'N/A'}`);
      console.log(`      Branch: ${sale.branch_name || 'N/A'}`);
      console.log(`      Total: $${sale.total}`);
    });

    // 5. Test tourism statistics
    console.log('\n📈 Testing Tourism Statistics...');
    const [tourismStats] = await sequelize.query(`
      SELECT 
        COUNT(*) as total_guide_sales,
        SUM(total) as total_revenue,
        AVG(total) as avg_sale_amount,
        COUNT(DISTINCT agencyId) as unique_agencies,
        COUNT(DISTINCT guideId) as unique_guides
      FROM sales 
      WHERE saleType = 'GUIDE'
    `) as any[];

    const stats = tourismStats[0];
    console.log(`✅ Tourism Statistics:`);
    console.log(`   Total GUIDE Sales: ${stats.total_guide_sales}`);
    console.log(`   Total Revenue: $${stats.total_revenue || 0}`);
    console.log(`   Average Sale: $${stats.avg_sale_amount || 0}`);
    console.log(`   Unique Agencies: ${stats.unique_agencies}`);
    console.log(`   Unique Guides: ${stats.unique_guides}`);

    console.log('\n🎉 All tourism sales tests completed successfully!');

    await sequelize.close();
  } catch (error) {
    console.error('❌ Error testing tourism sales:', error);
    await sequelize.close();
  }
}

testTourismSales();