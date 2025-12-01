import { sequelize } from '../db/config';
import { Op } from 'sequelize';
import { initializeModels } from '../models/index';

const SEED_BATCH_ID = 'jewelry_baseline_2024';

// Datos de productos de joyería
const jewelryProducts = [
  {
    code: 'ANI001',
    name: 'Anillo Solitario Diamante',
    description: 'Elegante anillo solitario con diamante de 0.5ct en oro blanco 18k',
    category: 'Anillos' as const,
    material: 'Oro' as const,
    weight: 3.2,
    purity: '18k',
    size: '6',
    color: 'Blanco',
    purchasePrice: 8500,
    salePrice: 12000,
    stock: 3,
    minStock: 1,
    isActive: true,
    metal: 'Oro Blanco',
    metalPurity: '18k',
    grams: 3.2,
    ringSize: '6',
    stoneType: 'Diamante',
    stoneCarat: 0.5,
    finish: 'Pulido',
    collection: 'Clásica',
    gender: 'mujer' as const,
    isUniquePiece: false,
    warrantyMonths: 12,
    barcode: '7501234567890'
  },
  {
    code: 'CAD001',
    name: 'Cadena Oro Rosa 18k',
    description: 'Cadena de oro rosa 18k con eslabones tipo barbada',
    category: 'Cadenas' as const,
    material: 'Oro' as const,
    weight: 15.5,
    purity: '18k',
    color: 'Rosa',
    purchasePrice: 18000,
    salePrice: 25000,
    stock: 5,
    minStock: 2,
    isActive: true,
    metal: 'Oro Rosa',
    metalPurity: '18k',
    grams: 15.5,
    chainLengthCm: 50,
    finish: 'Pulido',
    collection: 'Moderna',
    gender: 'unisex' as const,
    isUniquePiece: false,
    warrantyMonths: 24,
    barcode: '7501234567891'
  },
  {
    code: 'ARE001',
    name: 'Aretes Perla Cultivada',
    description: 'Aretes de perla cultivada con base en plata 925',
    category: 'Aretes' as const,
    material: 'Plata' as const,
    weight: 2.8,
    purity: '925',
    color: 'Blanco',
    purchasePrice: 1200,
    salePrice: 1800,
    stock: 8,
    minStock: 3,
    isActive: true,
    metal: 'Plata',
    metalPurity: '925',
    grams: 2.8,
    stoneType: 'Perla',
    finish: 'Pulido',
    collection: 'Elegante',
    gender: 'mujer' as const,
    isUniquePiece: false,
    warrantyMonths: 6,
    barcode: '7501234567892'
  },
  {
    code: 'PUL001',
    name: 'Pulsera Tenis Diamantes',
    description: 'Pulsera tipo tenis con diamantes en oro blanco 18k',
    category: 'Pulseras' as const,
    material: 'Oro' as const,
    weight: 12.3,
    purity: '18k',
    color: 'Blanco',
    purchasePrice: 35000,
    salePrice: 48000,
    stock: 2,
    minStock: 1,
    isActive: true,
    metal: 'Oro Blanco',
    metalPurity: '18k',
    grams: 12.3,
    stoneType: 'Diamante',
    stoneCarat: 2.0,
    finish: 'Pulido',
    collection: 'Lujo',
    gender: 'mujer' as const,
    isUniquePiece: true,
    warrantyMonths: 24,
    barcode: '7501234567893'
  },
  {
    code: 'COL001',
    name: 'Collar Esmeralda',
    description: 'Collar con esmeralda central y diamantes en oro amarillo 18k',
    category: 'Collares' as const,
    material: 'Esmeralda' as const,
    weight: 8.7,
    purity: '18k',
    color: 'Verde',
    purchasePrice: 28000,
    salePrice: 38000,
    stock: 1,
    minStock: 1,
    isActive: true,
    metal: 'Oro Amarillo',
    metalPurity: '18k',
    grams: 8.7,
    chainLengthCm: 45,
    stoneType: 'Esmeralda',
    stoneCarat: 1.5,
    finish: 'Pulido',
    collection: 'Exclusiva',
    gender: 'mujer' as const,
    isUniquePiece: true,
    warrantyMonths: 36,
    barcode: '7501234567894'
  }
];

// Datos de clientes
const jewelryClients = [
  {
    code: 'CLI001',
    firstName: 'María',
    lastName: 'González',
    email: 'maria.gonzalez@email.com',
    phone: '+52 55 1234 5678',
    address: 'Av. Reforma 123',
    city: 'Ciudad de México',
    country: 'México',
    documentType: 'CC' as const,
    documentNumber: 'GORM850315ABC',
    birthDate: '1985-03-15',
    totalPurchases: 25000,
    lastPurchaseDate: '2024-01-15',
    isActive: true,
    notes: 'Cliente VIP, prefiere oro blanco'
  },
  {
    code: 'CLI002',
    firstName: 'Carlos',
    lastName: 'Mendoza',
    email: 'carlos.mendoza@email.com',
    phone: '+52 55 2345 6789',
    address: 'Calle Madero 456',
    city: 'Guadalajara',
    country: 'México',
    documentType: 'CC' as const,
    documentNumber: 'MESC780922XYZ',
    birthDate: '1978-09-22',
    totalPurchases: 15000,
    lastPurchaseDate: '2024-01-10',
    isActive: true,
    notes: 'Compra para regalos especiales'
  }
];

async function seedJewelryData() {
  try {
    console.log('🚀 Iniciando seed de datos de joyería...');

    // Conectar a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida');

    // Inicializar modelos
    const models = await initializeModels();
    const { User, Product, Client, Sale, SaleItem } = models;
    console.log('✅ Modelos inicializados');

    // Sincronizar base de datos
    await sequelize.sync({ force: false, alter: true });
    console.log('✅ Base de datos sincronizada');

    // Crear o encontrar usuario administrador
    const [adminUser] = await User.findOrCreate({
      where: { username: 'admin' },
      defaults: {
        username: 'admin',
        email: 'admin@joyeria.com',
        password: 'admin123', // Se hasheará automáticamente
        role: 'admin',
        isActive: true
      }
    });
    console.log('✅ Usuario administrador creado/encontrado');

    // Limpiar datos existentes del batch
    try {
      await Product.destroy({ 
        where: sequelize.literal("json_extract(metadata, '$.seedBatchId') = '" + SEED_BATCH_ID + "'")
      });
    } catch (error) {
      console.log('ℹ️ No hay productos anteriores para limpiar');
    }
    
    try {
      await Client.destroy({ where: { code: { [Op.like]: 'CLI%' } } });
    } catch (error) {
      console.log('ℹ️ No hay clientes anteriores para limpiar');
    }
    console.log('✅ Datos anteriores limpiados');

    // Crear productos
    console.log('📦 Creando productos de joyería...');
    const createdProducts = [];
    for (const productData of jewelryProducts) {
      const product = await Product.create({
        ...productData,
        metadata: { seedBatchId: SEED_BATCH_ID, type: 'jewelry' }
      });
      createdProducts.push(product);
      console.log(`  ✓ Producto creado: ${product.name}`);
    }

    // Crear clientes
    console.log('👥 Creando clientes...');
    const createdClients = [];
    for (const clientData of jewelryClients) {
      const client = await Client.create({
        ...clientData,
        birthDate: new Date(clientData.birthDate),
        lastPurchaseDate: new Date(clientData.lastPurchaseDate)
      });
      createdClients.push(client);
      console.log(`  ✓ Cliente creado: ${client.firstName} ${client.lastName}`);
    }

    // Crear algunas ventas de ejemplo
    console.log('💰 Creando ventas de ejemplo...');
    const sale1 = await Sale.create({
      saleNumber: 'VTA-001',
      clientId: createdClients[0].id,
      userId: adminUser.id,
      subtotal: 12000,
      taxAmount: 1920,
      discountAmount: 0,
      total: 13920,
      paymentMethod: 'card' as const,
      status: 'completed',
      notes: 'Venta de anillo solitario'
    });

    await SaleItem.create({
      saleId: sale1.id,
      productId: createdProducts[0].id,
      quantity: 1,
      unitPrice: 12000,
      subtotal: 12000,
      discountAmount: 0,
      total: 12000
    });

    // Actualizar stock
    await createdProducts[0].update({ stock: createdProducts[0].stock - 1 });

    console.log('💰 Venta registrada correctamente');

    console.log('✅ Venta de ejemplo creada');

    console.log('🎉 Seed completado exitosamente!');
    console.log(`📊 Resumen:`);
    console.log(`   - Productos creados: ${createdProducts.length}`);
    console.log(`   - Clientes creados: ${createdClients.length}`);
    console.log(`   - Ventas creadas: 1`);
    console.log(`   - Batch ID: ${SEED_BATCH_ID}`);

  } catch (error) {
    console.error('❌ Error durante el seed:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Ejecutar el seed
if (require.main === module) {
  seedJewelryData()
    .then(() => {
      console.log('✅ Proceso de seed finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error en el proceso de seed:', error);
      process.exit(1);
    });
}

export { seedJewelryData };