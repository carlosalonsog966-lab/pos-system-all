import { sequelize } from '../db/config';

async function generateTestSales(count: number = 10) {
  try {
    console.log(`🧪 Generando ${count} ventas de prueba...\n`);

    const [products]: any = await sequelize.query('SELECT * FROM products LIMIT 5');
    const [agencies]: any = await sequelize.query('SELECT * FROM agencies LIMIT 5');
    const [guides]: any = await sequelize.query('SELECT * FROM guides LIMIT 5');
    const [employees]: any = await sequelize.query('SELECT * FROM employees LIMIT 5');
    const [branches]: any = await sequelize.query('SELECT * FROM branches LIMIT 5');
    const [users]: any = await sequelize.query('SELECT * FROM users LIMIT 1');

    if (!products[0] || !employees[0] || !branches[0] || !users[0]) {
      console.error('❌ Faltan datos requeridos para crear ventas (productos, empleados, sucursales, usuarios)');
      return;
    }

    const pickAny = (arr: any[], idx: number) => arr[idx % arr.length];

    for (let i = 0; i < count; i++) {
      const product: any = pickAny(products, i);
      const employee: any = pickAny(employees, i);
      const branch: any = pickAny(branches, i);
      const user: any = users[0];

      const isGuideSale = i % 2 === 0 && agencies[0] && guides[0];
      const agency: any = isGuideSale ? pickAny(agencies, i) : null;
      const guide: any = isGuideSale ? pickAny(guides, i) : null;

      const saleId = `${isGuideSale ? 'guide' : 'street'}-${Date.now()}-${i}`;
      const saleNumber = `${isGuideSale ? 'GU' : 'ST'}-${Date.now()}-${i}`;

      const subtotal = product.salePrice;
      const taxAmount = 0;
      const discountAmount = 0;
      const total = subtotal - discountAmount + taxAmount;

      if (isGuideSale) {
        console.log(`🏛️ Creando venta GUIDE #${i + 1}...`);
        await sequelize.query(`
          INSERT INTO sales (
            id, saleNumber, userId, branchId, employeeId, agencyId, guideId, saleType,
            agencyCommission, guideCommission, employeeCommission,
            subtotal, taxAmount, discountAmount, total, paymentMethod, status, saleDate,
            createdAt, updatedAt
          ) VALUES (
            '${saleId}', '${saleNumber}', '${user.id}', '${branch.id}', '${employee.id}',
            '${agency.id}', '${guide.id}', 'GUIDE',
            15.0, 10.0, 5.0,
            ${subtotal}, ${taxAmount}, ${discountAmount}, ${total}, 'cash', 'completed', datetime('now'),
            datetime('now'), datetime('now')
          )
        `);
      } else {
        console.log(`🛍️ Creando venta STREET #${i + 1}...`);
        await sequelize.query(`
          INSERT INTO sales (
            id, saleNumber, userId, branchId, employeeId, saleType,
            subtotal, taxAmount, discountAmount, total, paymentMethod, status, saleDate,
            createdAt, updatedAt
          ) VALUES (
            '${saleId}', '${saleNumber}', '${user.id}', '${branch.id}', '${employee.id}', 'STREET',
            ${subtotal}, ${taxAmount}, ${discountAmount}, ${total}, 'cash', 'completed', datetime('now'),
            datetime('now'), datetime('now')
          )
        `);
      }
    }

    console.log(`\n✅ Ventas de prueba generadas: ${count}`);

    const [summary]: any = await sequelize.query(`
      SELECT saleType, COUNT(*) as total, SUM(total) as revenue
      FROM sales
      GROUP BY saleType
    `);

    console.log('📊 Resumen por tipo de venta:');
    summary.forEach((row: any) => {
      console.log(`   - ${row.saleType}: ${row.total} ventas, ingresos $${row.revenue || 0}`);
    });

    await sequelize.close();
  } catch (error) {
    console.error('❌ Error generando ventas de prueba:', error);
    await sequelize.close();
    process.exit(1);
  }
}

generateTestSales(10);
