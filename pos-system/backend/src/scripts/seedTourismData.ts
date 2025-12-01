import { sequelize } from '../db/config';
import { initializeDatabase } from '../app';
import Agency from '../models/Agency';
import Guide from '../models/Guide';
import Employee from '../models/Employee';
import Branch from '../models/Branch';
import Barcode from '../models/Barcode';

// Datos iniciales
const branchesData = [
  { code: 'TDA1', name: 'Tienda 1' },
  { code: 'MAL', name: 'Malecón' },
  { code: 'SSO', name: 'San Sebastián del Oeste' },
  { code: 'SAY', name: 'Sayulita' }
];

const agenciesData = [
  { code: 'AG001', name: 'TANI TOURS', commissionRate: 10 },
  { code: 'AG002', name: 'TRAVELEX', commissionRate: 10 },
  { code: 'AG003', name: 'VERANOS', commissionRate: 10 },
  { code: 'AG004', name: 'TTF', commissionRate: 10 },
  { code: 'AG005', name: 'TV TOURS', commissionRate: 10 },
  { code: 'AG006', name: 'DISCOVERY', commissionRate: 10 },
  { code: 'AG007', name: 'CALLE', commissionRate: 0 } // Ventas de calle - comisión manejada por empleado
];

const guidesData = [
  // TANI TOURS
  { name: 'MARINA', agencyCode: 'AG001', commissionFormula: 'DIRECT' as const, commissionRate: 10 },
  { name: 'DANIELA', agencyCode: 'AG001', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'GLORIA', agencyCode: 'AG001', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  
  // TRAVELEX
  { name: 'ROCIO', agencyCode: 'AG002', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'SEBASTIAN S', agencyCode: 'AG002', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'TEMO', agencyCode: 'AG002', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'SANTA', agencyCode: 'AG002', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'ANDRES C', agencyCode: 'AG002', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'MIGUEL', agencyCode: 'AG002', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'MIGUEL S', agencyCode: 'AG002', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'ZAREM', agencyCode: 'AG002', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'ZAVALA', agencyCode: 'AG002', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  
  // VERANOS
  { name: 'FREDY', agencyCode: 'AG003', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'CARLOS C', agencyCode: 'AG003', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'CHAVA', agencyCode: 'AG003', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'EMMANUEL', agencyCode: 'AG003', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'MARIO R', agencyCode: 'AG003', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'NETO', agencyCode: 'AG003', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'OMAR', agencyCode: 'AG003', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  
  // TTF
  { name: 'ALFONSO', agencyCode: 'AG004', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'DAVID', agencyCode: 'AG004', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'GILBERTO', agencyCode: 'AG004', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'EDUARDO', agencyCode: 'AG004', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'HUGO', agencyCode: 'AG004', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  
  // TV TOURS
  { name: 'GABINO', agencyCode: 'AG005', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'ADAN', agencyCode: 'AG005', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'MIGUEL I', agencyCode: 'AG005', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'MIGUEL R', agencyCode: 'AG005', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'JOSE A', agencyCode: 'AG005', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'HECTOR S', agencyCode: 'AG005', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'OSCAR', agencyCode: 'AG005', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  
  // DISCOVERY
  { name: 'JORGE N', agencyCode: 'AG006', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'CHILO', agencyCode: 'AG006', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'EMMA', agencyCode: 'AG006', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'GUSTAVO L', agencyCode: 'AG006', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'GUSTAVO C', agencyCode: 'AG006', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'ERIK', agencyCode: 'AG006', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 },
  { name: 'RAMON', agencyCode: 'AG006', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 10 }
];

const employeesData = [
  { name: 'VERO', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 5, commissionRate: 9, streetSaleCardRate: 12, streetSaleCashRate: 14 },
  { name: 'POCHIS', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 5, commissionRate: 9, streetSaleCardRate: 12, streetSaleCashRate: 14 },
  { name: 'ANGEL', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 18, commissionRate: 8, streetSaleCardRate: 12, streetSaleCashRate: 14 },
  { name: 'ROBERTO', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 5, commissionRate: 9, streetSaleCardRate: 12, streetSaleCashRate: 14 },
  { name: 'MANUEL', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 5, commissionRate: 9, streetSaleCardRate: 12, streetSaleCashRate: 14 },
  { name: 'ALDAIR', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 5, commissionRate: 7, streetSaleCardRate: 12, streetSaleCashRate: 14 },
  { name: 'SEBASTIAN', commissionFormula: 'DIRECT' as const, commissionRate: 10, streetSaleCardRate: 12, streetSaleCashRate: 14 },
  { name: 'EDITH', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 5, commissionRate: 9, streetSaleCardRate: 12, streetSaleCashRate: 14 },
  { name: 'JOVA', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 5, commissionRate: 9, streetSaleCardRate: 12, streetSaleCashRate: 14 },
  { name: 'ANDRES', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 5, commissionRate: 9, streetSaleCardRate: 12, streetSaleCashRate: 14 },
  { name: 'SERGIO', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 5, commissionRate: 9, streetSaleCardRate: 12, streetSaleCashRate: 14 },
  { name: 'MARTHA', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 5, commissionRate: 9, streetSaleCardRate: 12, streetSaleCashRate: 14 },
  { name: 'SAULA', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 5, commissionRate: 9, streetSaleCardRate: 12, streetSaleCashRate: 14 },
  { name: 'RAMSES', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 5, commissionRate: 9, streetSaleCardRate: 12, streetSaleCashRate: 14 },
  { name: 'PACO', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 5, commissionRate: 9, streetSaleCardRate: 12, streetSaleCashRate: 14 },
  { name: 'CARLOS', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 5, commissionRate: 9, streetSaleCardRate: 12, streetSaleCashRate: 14 },
  { name: 'DON ANGEL', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 5, commissionRate: 9, streetSaleCardRate: 12, streetSaleCashRate: 14 },
  { name: 'PANDA', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 5, commissionRate: 9, streetSaleCardRate: 12, streetSaleCashRate: 14 },
  { name: 'KARLA', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 5, commissionRate: 9, streetSaleCardRate: 12, streetSaleCashRate: 14 },
  { name: 'FRANCISCO', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 5, commissionRate: 9, streetSaleCardRate: 12, streetSaleCashRate: 14 },
  { name: 'RENE', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 5, commissionRate: 9, streetSaleCardRate: 12, streetSaleCashRate: 14 },
  { name: 'CHARLY', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 5, commissionRate: 9, streetSaleCardRate: 12, streetSaleCashRate: 14 },
  { name: 'CHAYO', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 5, commissionRate: 9, streetSaleCardRate: 12, streetSaleCashRate: 14 },
  { name: 'ISAURA', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 5, commissionRate: 9, streetSaleCardRate: 12, streetSaleCashRate: 14 },
  { name: 'KALY', commissionFormula: 'DISCOUNT_PERCENTAGE' as const, discountPercentage: 5, commissionRate: 9, streetSaleCardRate: 12, streetSaleCashRate: 14 }
];

export async function seedTourismData() {
  try {
    console.log('🌱 Iniciando población de datos de turismo...');
    try { await initializeDatabase(); } catch (e) { console.warn('Init DB warning:', (e as any)?.message); }

    // 1. Crear sucursales
    console.log('📍 Creando sucursales...');
    const branches = [];
    for (const branchData of branchesData) {
      const [branch] = await Branch.findOrCreate({
        where: { code: branchData.code },
        defaults: {
          code: branchData.code,
          name: branchData.name,
          isActive: true
        }
      });
      branches.push(branch);
      console.log(`✅ Sucursal creada: ${branch.name} (${branch.code})`);
    }

    // 2. Crear agencias
    console.log('🏢 Creando agencias...');
    const agencies = [];
    for (const agencyData of agenciesData) {
      const [agency] = await Agency.findOrCreate({
        where: { code: agencyData.code },
        defaults: {
          code: agencyData.code,
          name: agencyData.name,
          commissionRate: agencyData.commissionRate,
          isActive: true
        }
      });
      agencies.push(agency);
      console.log(`✅ Agencia creada: ${agency.name} (${agency.code})`);
    }

    // 3. Crear guías
    console.log('👥 Creando guías...');
    const guides = [];
    let guideSequence = 1;
    
    for (const guideData of guidesData) {
      const agency = agencies.find(a => a.code === guideData.agencyCode);
      if (!agency) {
        console.error(`❌ Agencia no encontrada: ${guideData.agencyCode}`);
        continue;
      }

      const guideCode = `GU${guideSequence.toString().padStart(3, '0')}-${agency.code}`;
      
      const [guide] = await Guide.findOrCreate({
        where: { code: guideCode },
        defaults: {
          code: guideCode,
          name: guideData.name,
          agencyId: agency.id,
          commissionFormula: guideData.commissionFormula,
          discountPercentage: guideData.discountPercentage,
          commissionRate: guideData.commissionRate,
          isActive: true
        }
      });
      
      guides.push(guide);
      
      // Crear código de barras para el guía (tolerante a constraint únicos)
      const barcodeCode = Barcode.generateGuideBarcode(agency.code, guideSequence);
      try {
        await Barcode.findOrCreate({
          where: { code: barcodeCode },
          defaults: {
            code: barcodeCode,
            type: 'GUIDE',
            entityId: guide.id,
            isActive: true
          }
        });
      } catch (err: any) {
        console.warn(`⚠️ No se pudo crear barcode de guía '${barcodeCode}': ${err?.message || err}`);
      }
      
      console.log(`✅ Guía creado: ${guide.name} (${guide.code}) - Barcode: ${barcodeCode}`);
      guideSequence++;
    }

    // 4. Crear empleados/vendedores
    console.log('👨‍💼 Creando empleados/vendedores...');
    const employees = [];
    let employeeSequence = 1;
    
    for (const employeeData of employeesData) {
      // Asignar a la primera sucursal por defecto (se puede cambiar después)
      const defaultBranch = branches[0];
      const employeeCode = `VE${employeeSequence.toString().padStart(3, '0')}`;
      
      const [employee] = await Employee.findOrCreate({
        where: { code: employeeCode },
        defaults: {
          code: employeeCode,
          name: employeeData.name,
          branchId: defaultBranch.id,
          commissionFormula: employeeData.commissionFormula,
          discountPercentage: employeeData.discountPercentage,
          commissionRate: employeeData.commissionRate,
          streetSaleCardRate: employeeData.streetSaleCardRate,
          streetSaleCashRate: employeeData.streetSaleCashRate,
          position: 'Vendedor',
          isActive: true
        }
      });
      
      employees.push(employee);
      
      // Crear código de barras para el empleado (tolerante a constraint únicos)
      const barcodeCode = Barcode.generateEmployeeBarcode(defaultBranch.code, employeeSequence);
      try {
        await Barcode.findOrCreate({
          where: { code: barcodeCode },
          defaults: {
            code: barcodeCode,
            type: 'EMPLOYEE',
            entityId: employee.id,
            isActive: true
          }
        });
      } catch (err: any) {
        console.warn(`⚠️ No se pudo crear barcode de empleado '${barcodeCode}': ${err?.message || err}`);
      }
      
      console.log(`✅ Empleado creado: ${employee.name} (${employee.code}) - Barcode: ${barcodeCode}`);
      employeeSequence++;
    }

    console.log('🎉 ¡Población de datos completada exitosamente!');
    console.log(`📊 Resumen:`);
    console.log(`   - ${branches.length} sucursales creadas`);
    console.log(`   - ${agencies.length} agencias creadas`);
    console.log(`   - ${guides.length} guías creados`);
    console.log(`   - ${employees.length} empleados creados`);
    console.log(`   - ${guides.length + employees.length} códigos de barras generados`);

    return {
      branches,
      agencies,
      guides,
      employees
    };

  } catch (error) {
    console.error('❌ Error al poblar datos de turismo:', error);
    throw error;
  }
}

// Función para ejecutar el script directamente
if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      console.log('🔗 Conexión a la base de datos establecida.');
      
      await seedTourismData();
      
      console.log('✅ Script completado exitosamente.');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error ejecutando el script:', error);
      process.exit(1);
    }
  })();
}
