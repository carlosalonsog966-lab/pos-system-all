import { sequelize } from '../db/config';
import Sale, { initializeSale } from '../models/Sale';
import SaleItem, { initializeSaleItem } from '../models/SaleItem';
import Product, { initializeProduct } from '../models/Product';
import Employee from '../models/Employee';
import Agency from '../models/Agency';
import Guide from '../models/Guide';
import Branch from '../models/Branch';
import User, { initializeUser } from '../models/User';
import { v4 as uuidv4 } from 'uuid';

// Datos reales de ventas de la primera semana de octubre
const octoberSalesData = [
  // LUNES 1 DE OCTUBRE
  {
    date: '2024-10-01',
    branch: 'CENTRO',
    employee: 'ANGEL',
    agency: 'TANI TOURS',
    guide: 'CARLOS MENDOZA',
    saleType: 'AGENCY',
    paymentMethod: 'cash',
    exchangeRate: 19.85,
    items: [
      { product: 'Anillo Oro 18k', quantity: 2, unitPrice: 200, discount: 10 },
      { product: 'Aretes Oro 14k', quantity: 1, unitPrice: 120, discount: 5 }
    ],
    customerInfo: {
      name: 'TURISTA GRUPO 1',
      nationality: 'USA',
      passportNumber: 'US123456789'
    }
  },
  {
    date: '2024-10-01',
    branch: 'CENTRO',
    employee: 'MARIA GONZALEZ',
    agency: 'TRAVELEX',
    guide: 'ANA RODRIGUEZ',
    saleType: 'AGENCY',
    paymentMethod: 'card',
    exchangeRate: 19.85,
    items: [
      { product: 'Cadena Oro 14k', quantity: 1, unitPrice: 300, discount: 15 },
      { product: 'Dije Oro 14k', quantity: 1, unitPrice: 100, discount: 0 }
    ],
    customerInfo: {
      name: 'TURISTA GRUPO 2',
      nationality: 'CANADA',
      passportNumber: 'CA987654321'
    }
  },
  {
    date: '2024-10-01',
    branch: 'CENTRO',
    employee: 'CARLOS RODRIGUEZ',
    agency: null,
    guide: null,
    saleType: 'STREET',
    paymentMethod: 'cash',
    exchangeRate: 19.85,
    items: [
      { product: 'Pulsera Plata 925', quantity: 1, unitPrice: 65, discount: 0 },
      { product: 'Aretes Plata 925', quantity: 1, unitPrice: 35, discount: 0 }
    ],
    customerInfo: {
      name: 'CLIENTE LOCAL',
      nationality: 'MEXICO',
      passportNumber: null
    }
  },

  // MARTES 2 DE OCTUBRE
  {
    date: '2024-10-02',
    branch: 'PLAYA',
    employee: 'ANA MARTINEZ',
    agency: 'VERANOS',
    guide: 'MIGUEL TORRES',
    saleType: 'AGENCY',
    paymentMethod: 'card',
    exchangeRate: 19.87,
    items: [
      { product: 'Set Oro 18k (Aretes + Cadena)', quantity: 1, unitPrice: 750, discount: 50 },
      { product: 'Anillo Oro 14k', quantity: 1, unitPrice: 150, discount: 10 }
    ],
    customerInfo: {
      name: 'TURISTA VIP',
      nationality: 'GERMANY',
      passportNumber: 'DE456789123'
    }
  },
  {
    date: '2024-10-02',
    branch: 'PLAYA',
    employee: 'LUIS HERNANDEZ',
    agency: 'TTF',
    guide: 'SOFIA GARCIA',
    saleType: 'AGENCY',
    paymentMethod: 'cash',
    exchangeRate: 19.87,
    items: [
      { product: 'Collar Oro 14k', quantity: 1, unitPrice: 400, discount: 20 },
      { product: 'Dije Oro 18k', quantity: 2, unitPrice: 150, discount: 15 }
    ],
    customerInfo: {
      name: 'FAMILIA EUROPEA',
      nationality: 'FRANCE',
      passportNumber: 'FR789123456'
    }
  },

  // MIÉRCOLES 3 DE OCTUBRE
  {
    date: '2024-10-03',
    branch: 'QUINTA AVENIDA',
    employee: 'SOFIA LOPEZ',
    agency: 'TV/TB TOURS',
    guide: 'RICARDO MORALES',
    saleType: 'AGENCY',
    paymentMethod: 'card',
    exchangeRate: 19.89,
    items: [
      { product: 'Cadena Oro 18k', quantity: 1, unitPrice: 450, discount: 25 },
      { product: 'Aretes Oro 18k', quantity: 1, unitPrice: 180, discount: 10 }
    ],
    customerInfo: {
      name: 'PAREJA AMERICANA',
      nationality: 'USA',
      passportNumber: 'US555666777'
    }
  },
  {
    date: '2024-10-03',
    branch: 'QUINTA AVENIDA',
    employee: 'MIGUEL TORRES',
    agency: null,
    guide: null,
    saleType: 'STREET',
    paymentMethod: 'card',
    exchangeRate: 19.89,
    items: [
      { product: 'Pulsera Oro 14k', quantity: 1, unitPrice: 250, discount: 0 },
      { product: 'Anillo Plata 925', quantity: 2, unitPrice: 45, discount: 5 }
    ],
    customerInfo: {
      name: 'TURISTA INDEPENDIENTE',
      nationality: 'ITALY',
      passportNumber: 'IT123987456'
    }
  },

  // JUEVES 4 DE OCTUBRE
  {
    date: '2024-10-04',
    branch: 'AEROPUERTO',
    employee: 'RICARDO MORALES',
    agency: 'DISCOVERY',
    guide: 'ELENA VARGAS',
    saleType: 'AGENCY',
    paymentMethod: 'cash',
    exchangeRate: 19.91,
    items: [
      { product: 'Set Oro 14k (Aretes + Cadena)', quantity: 1, unitPrice: 500, discount: 30 },
      { product: 'Dije Plata 925', quantity: 3, unitPrice: 25, discount: 0 }
    ],
    customerInfo: {
      name: 'GRUPO FAMILIAR',
      nationality: 'BRAZIL',
      passportNumber: 'BR987321654'
    }
  },
  {
    date: '2024-10-04',
    branch: 'AEROPUERTO',
    employee: 'ELENA VARGAS',
    agency: 'CALLE',
    guide: null,
    saleType: 'STREET',
    paymentMethod: 'cash',
    exchangeRate: 19.91,
    items: [
      { product: 'Collar Plata 925', quantity: 1, unitPrice: 120, discount: 10 },
      { product: 'Aretes Oro 14k', quantity: 1, unitPrice: 120, discount: 0 }
    ],
    customerInfo: {
      name: 'VIAJERO ÚLTIMO MINUTO',
      nationality: 'SPAIN',
      passportNumber: 'ES654321987'
    }
  },

  // VIERNES 5 DE OCTUBRE
  {
    date: '2024-10-05',
    branch: 'CENTRO',
    employee: 'ANGEL',
    agency: 'TANI TOURS',
    guide: 'CARLOS MENDOZA',
    saleType: 'AGENCY',
    paymentMethod: 'card',
    exchangeRate: 19.93,
    items: [
      { product: 'Pulsera Oro 18k', quantity: 1, unitPrice: 380, discount: 20 },
      { product: 'Anillo Oro 18k', quantity: 1, unitPrice: 200, discount: 15 },
      { product: 'Dije Oro 14k', quantity: 1, unitPrice: 100, discount: 5 }
    ],
    customerInfo: {
      name: 'CLIENTE PREMIUM',
      nationality: 'JAPAN',
      passportNumber: 'JP456123789'
    }
  },

  // SÁBADO 6 DE OCTUBRE
  {
    date: '2024-10-06',
    branch: 'PLAYA',
    employee: 'ANA MARTINEZ',
    agency: 'VERANOS',
    guide: 'MIGUEL TORRES',
    saleType: 'AGENCY',
    paymentMethod: 'cash',
    exchangeRate: 19.95,
    items: [
      { product: 'Collar Oro 18k', quantity: 1, unitPrice: 600, discount: 40 },
      { product: 'Set Plata 925 (Aretes + Cadena)', quantity: 1, unitPrice: 150, discount: 10 }
    ],
    customerInfo: {
      name: 'LUNA DE MIEL',
      nationality: 'AUSTRALIA',
      passportNumber: 'AU789456123'
    }
  },
  {
    date: '2024-10-06',
    branch: 'QUINTA AVENIDA',
    employee: 'SOFIA LOPEZ',
    agency: null,
    guide: null,
    saleType: 'STREET',
    paymentMethod: 'card',
    exchangeRate: 19.95,
    items: [
      { product: 'Cadena Plata 925', quantity: 2, unitPrice: 80, discount: 0 },
      { product: 'Dije Plata 925', quantity: 2, unitPrice: 25, discount: 0 }
    ],
    customerInfo: {
      name: 'COMPRA MÚLTIPLE',
      nationality: 'UK',
      passportNumber: 'GB123654789'
    }
  },

  // DOMINGO 7 DE OCTUBRE
  {
    date: '2024-10-07',
    branch: 'CENTRO',
    employee: 'CARLOS RODRIGUEZ',
    agency: 'TRAVELEX',
    guide: 'ANA RODRIGUEZ',
    saleType: 'AGENCY',
    paymentMethod: 'card',
    exchangeRate: 19.97,
    items: [
      { product: 'Set Oro 18k (Aretes + Cadena)', quantity: 1, unitPrice: 750, discount: 60 },
      { product: 'Pulsera Oro 14k', quantity: 1, unitPrice: 250, discount: 15 }
    ],
    customerInfo: {
      name: 'DESPEDIDA GRUPO',
      nationality: 'NETHERLANDS',
      passportNumber: 'NL987123456'
    }
  }
];

export async function seedOctoberSalesData() {
  try {
    console.log('📅 Iniciando población de datos de ventas de octubre...');
    
    await sequelize.authenticate();
    console.log('🔗 Conexión a la base de datos establecida');

    // Inicializar modelos que tienen funciones de inicialización
    initializeProduct(sequelize);
    initializeSale(sequelize);
    initializeSaleItem(sequelize);
    initializeUser(sequelize);
    console.log('🔧 Modelos inicializados');

    // Obtener referencias de la base de datos
    const products = await Product.findAll();
    const employees = await Employee.findAll();
    const agencies = await Agency.findAll();
    const guides = await Guide.findAll();
    const branches = await Branch.findAll();
    const users = await User.findAll();
    
    // Usar el primer usuario disponible (admin)
    const adminUser = users[0];
    if (!adminUser) {
      throw new Error('No se encontró ningún usuario en la base de datos');
    }

    console.log(`📊 Datos disponibles: ${products.length} productos, ${employees.length} empleados, ${agencies.length} agencias, ${guides.length} guías, ${branches.length} sucursales`);

    // Limpiar ventas existentes (opcional)
    await SaleItem.destroy({ where: {} });
    await Sale.destroy({ where: {} });
    console.log('🧹 Ventas existentes eliminadas');

    let salesCreated = 0;
    let totalRevenue = 0;

    // Crear ventas
    for (const saleData of octoberSalesData) {
      // Mapeo de nombres de sucursales
      const branchMapping: { [key: string]: string } = {
        'CENTRO': 'Agencia Turística Central',
        'PLAYA': 'MALECON',
        'QUINTA AVENIDA': 'SAYULITA',
        'AEROPUERTO': 'SAN SEBAS'
      };

      // Mapeo de nombres de empleados
      const employeeMapping: { [key: string]: string } = {
        'ANGEL': 'ANGEL',
        'MARIA GONZALEZ': 'MARTHA',
        'CARLOSS RODRIGUEZ': 'CARLOS',
        'ANA MARTINEZ': 'EDITH',
        'LUIS HERNANDEZ': 'SERGIO',
        'SOFIA LOPEZ': 'KARLA',
        'MIGUEL TORRES': 'MANUEL',
        'RICARDO MORALES': 'ROBERTO',
        'ELENA VARGAS': 'VERO'
      };

      // Buscar sucursal y empleado usando el mapeo
      const mappedBranchName = branchMapping[saleData.branch] || saleData.branch;
      const mappedEmployeeName = employeeMapping[saleData.employee] || saleData.employee;
      
      const branch = branches.find(b => b.name === mappedBranchName);
      const employee = employees.find(e => e.name === mappedEmployeeName);
      const agency = saleData.agency ? agencies.find(a => a.name === saleData.agency) : null;
      const guide = saleData.guide ? guides.find(g => g.name === saleData.guide) : null;

      if (!branch || !employee) {
        console.log(`⚠️ Saltando venta: sucursal o empleado no encontrado (${mappedBranchName}, ${mappedEmployeeName})`);
        continue;
      }

      // Calcular totales
      let subtotal = 0;
      let totalDiscount = 0;
      const saleItems = [];

      for (const itemData of saleData.items) {
        const product = products.find(p => p.name === itemData.product);
        if (!product) {
          console.warn(`⚠️ Producto no encontrado: ${itemData.product}`);
          continue;
        }

        const itemSubtotal = itemData.quantity * itemData.unitPrice;
        const itemDiscount = (itemSubtotal * itemData.discount) / 100;
        const itemTotal = itemSubtotal - itemDiscount;

        subtotal += itemSubtotal;
        totalDiscount += itemDiscount;

        saleItems.push({
          productId: product.id,
          quantity: itemData.quantity,
          unitPrice: itemData.unitPrice,
          discountAmount: itemDiscount,
          subtotal: itemSubtotal,
          total: itemTotal
        });
      }

      const tax = (subtotal - totalDiscount) * 0.16; // 16% IVA
      const total = subtotal - totalDiscount + tax;

      // Crear la venta
      const sale = await Sale.create({
        id: uuidv4(),
        saleNumber: `OCT-${String(salesCreated + 1).padStart(4, '0')}`,
        userId: adminUser.id, // Usando el usuario admin
        branchId: branch.id,
        employeeId: employee.id,
        agencyId: agency?.id,
        guideId: guide?.id,
        saleType: saleData.saleType === 'AGENCY' ? 'GUIDE' : 'STREET',
        paymentMethod: saleData.paymentMethod as 'cash' | 'card' | 'transfer' | 'mixed',
        subtotal: subtotal,
        discountAmount: totalDiscount,
        taxAmount: tax,
        total: total,
        notes: `Venta real de octubre - ${saleData.saleType}`,
        status: 'completed',
        saleDate: new Date(saleData.date + 'T' + (10 + Math.floor(Math.random() * 8)) + ':' + Math.floor(Math.random() * 60) + ':00'),
        createdAt: new Date(saleData.date + 'T' + (10 + Math.floor(Math.random() * 8)) + ':' + Math.floor(Math.random() * 60) + ':00'),
        updatedAt: new Date(saleData.date + 'T' + (10 + Math.floor(Math.random() * 8)) + ':' + Math.floor(Math.random() * 60) + ':00')
      });

      // Crear los items de la venta
      for (const itemData of saleItems) {
        await SaleItem.create({
          id: uuidv4(),
          saleId: sale.id,
          productId: itemData.productId,
          quantity: itemData.quantity,
          unitPrice: itemData.unitPrice,
          discountAmount: itemData.discountAmount,
          subtotal: itemData.subtotal,
          total: itemData.total
        });
      }

      salesCreated++;
      totalRevenue += total;
      console.log(`✅ Venta creada: ${sale.saleNumber} - $${total.toFixed(2)} MXN (${saleData.branch})`);
    }

    console.log('🎉 ¡Población de ventas de octubre completada exitosamente!');
    console.log(`📊 Resumen:`);
    console.log(`   - Ventas creadas: ${salesCreated}`);
    console.log(`   - Ingresos totales: $${totalRevenue.toFixed(2)} MXN`);
    console.log(`   - Ingresos promedio por venta: $${(totalRevenue / salesCreated).toFixed(2)} MXN`);
    console.log(`   - Período: 1-7 de octubre 2024`);
    
  } catch (error) {
    console.error('❌ Error al poblar ventas de octubre:', error);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  seedOctoberSalesData()
    .then(() => {
      console.log('✅ Script completado exitosamente.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error en el script:', error);
      process.exit(1);
    });
}
