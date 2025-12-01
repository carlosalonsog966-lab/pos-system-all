import Employee from '../models/Employee';
import { sequelize } from '../db/config';

async function testCommissionCalculations() {
  try {
    await sequelize.authenticate();
    console.log('🔗 Conexión a la base de datos establecida');

    // Obtener algunos empleados con diferentes fórmulas
    const employees = await Employee.findAll({
      where: { isActive: true },
      limit: 10
    });

    console.log('\n📊 PRUEBAS DE CÁLCULO DE COMISIONES');
    console.log('='.repeat(60));

    const testSaleAmount = 1000; // $1000 de venta de prueba

    for (const employee of employees) {
      console.log(`\n👤 ${employee.name} (${employee.code})`);
      console.log(`   Fórmula: ${employee.commissionFormula}`);
      console.log(`   Descuento: ${employee.discountPercentage || 0}%`);
      console.log(`   Tasa comisión: ${employee.commissionRate}%`);
      console.log(`   Tasa calle tarjeta: ${employee.streetSaleCardRate || 0}%`);
      console.log(`   Tasa calle efectivo: ${employee.streetSaleCashRate || 0}%`);

      // Calcular comisiones para diferentes tipos de venta
      const guideCommission = employee.calculateCommission(testSaleAmount, 'GUIDE');
      const streetCardCommission = employee.calculateCommission(testSaleAmount, 'STREET_CARD');
      const streetCashCommission = employee.calculateCommission(testSaleAmount, 'STREET_CASH');

      console.log(`   💰 Comisión con guía: $${guideCommission.toFixed(2)}`);
      console.log(`   💳 Comisión calle tarjeta: $${streetCardCommission.toFixed(2)}`);
      console.log(`   💵 Comisión calle efectivo: $${streetCashCommission.toFixed(2)}`);

      // Mostrar cálculo detallado para fórmula DISCOUNT_PERCENTAGE
      if (employee.commissionFormula === 'DISCOUNT_PERCENTAGE' && employee.discountPercentage) {
        const afterDiscount = testSaleAmount * (1 - employee.discountPercentage / 100);
        console.log(`   📝 Cálculo detallado:`);
        console.log(`      - Venta original: $${testSaleAmount}`);
        console.log(`      - Después descuento ${employee.discountPercentage}%: $${afterDiscount.toFixed(2)}`);
        console.log(`      - Comisión ${employee.commissionRate}%: $${(afterDiscount * employee.commissionRate / 100).toFixed(2)}`);
      }
    }

    console.log('\n✅ Pruebas de comisiones completadas');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
  } finally {
    await sequelize.close();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testCommissionCalculations();
}

export { testCommissionCalculations };