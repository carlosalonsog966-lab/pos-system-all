import { sequelize } from './src/db/config';

async function checkData() {
  try {
    // Check products
    const [products] = await sequelize.query('SELECT COUNT(*) as count FROM products') as any[];
    console.log(`📦 Products: ${products[0].count}`);

    // Check users
    const [users] = await sequelize.query('SELECT COUNT(*) as count FROM users') as any[];
    console.log(`👤 Users: ${users[0].count}`);

    // Check agencies
    const [agencies] = await sequelize.query('SELECT COUNT(*) as count FROM agencies') as any[];
    console.log(`🏢 Agencies: ${agencies[0].count}`);

    // Check guides
    const [guides] = await sequelize.query('SELECT COUNT(*) as count FROM guides') as any[];
    console.log(`👥 Guides: ${guides[0].count}`);

    // Check employees
    const [employees] = await sequelize.query('SELECT COUNT(*) as count FROM employees') as any[];
    console.log(`👨‍💼 Employees: ${employees[0].count}`);

    // Check branches
    const [branches] = await sequelize.query('SELECT COUNT(*) as count FROM branches') as any[];
    console.log(`📍 Branches: ${branches[0].count}`);

    // Show some sample data
    if (products[0].count > 0) {
      const [sampleProducts] = await sequelize.query('SELECT id, code, name, salePrice FROM products LIMIT 3') as any[];
      console.log('\n📦 Sample Products:');
      sampleProducts.forEach((p: any) => console.log(`  - ${p.code}: ${p.name} ($${p.salePrice})`));
    }

    if (agencies[0].count > 0) {
      const [sampleAgencies] = await sequelize.query('SELECT id, code, name FROM agencies LIMIT 3') as any[];
      console.log('\n🏢 Sample Agencies:');
      sampleAgencies.forEach((a: any) => console.log(`  - ${a.code}: ${a.name}`));
    }

    if (guides[0].count > 0) {
      const [sampleGuides] = await sequelize.query('SELECT id, code, name, agencyId FROM guides LIMIT 3') as any[];
      console.log('\n👥 Sample Guides:');
      sampleGuides.forEach((g: any) => console.log(`  - ${g.code}: ${g.name} (Agency: ${g.agencyId})`));
    }

    await sequelize.close();
  } catch (error) {
    console.error('Error:', error);
    await sequelize.close();
  }
}

checkData();