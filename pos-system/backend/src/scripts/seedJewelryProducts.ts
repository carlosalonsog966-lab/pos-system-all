import { sequelize } from '../db/config';
import Product, { initializeProduct } from '../models/Product';
import { v4 as uuidv4 } from 'uuid';

// Productos básicos de joyería para las ventas
const jewelryProducts = [
  // ANILLOS
  { name: 'Anillo Oro 14k', category: 'Anillos' as const, material: 'Oro' as const, purity: '14K', basePrice: 150, weight: 3.5 },
  { name: 'Anillo Oro 18k', category: 'Anillos' as const, material: 'Oro' as const, purity: '18K', basePrice: 200, weight: 4.0 },
  { name: 'Anillo Plata 925', category: 'Anillos' as const, material: 'Plata' as const, purity: '925', basePrice: 45, weight: 5.0 },
  
  // ARETES
  { name: 'Aretes Oro 14k', category: 'Aretes' as const, material: 'Oro' as const, purity: '14K', basePrice: 120, weight: 2.5 },
  { name: 'Aretes Oro 18k', category: 'Aretes' as const, material: 'Oro' as const, purity: '18K', basePrice: 180, weight: 3.0 },
  { name: 'Aretes Plata 925', category: 'Aretes' as const, material: 'Plata' as const, purity: '925', basePrice: 35, weight: 3.5 },
  
  // CADENAS
  { name: 'Cadena Oro 14k', category: 'Cadenas' as const, material: 'Oro' as const, purity: '14K', basePrice: 300, weight: 8.0 },
  { name: 'Cadena Oro 18k', category: 'Cadenas' as const, material: 'Oro' as const, purity: '18K', basePrice: 450, weight: 10.0 },
  { name: 'Cadena Plata 925', category: 'Cadenas' as const, material: 'Plata' as const, purity: '925', basePrice: 80, weight: 12.0 },
  
  // PULSERAS
  { name: 'Pulsera Oro 14k', category: 'Pulseras' as const, material: 'Oro' as const, purity: '14K', basePrice: 250, weight: 6.0 },
  { name: 'Pulsera Oro 18k', category: 'Pulseras' as const, material: 'Oro' as const, purity: '18K', basePrice: 380, weight: 7.5 },
  { name: 'Pulsera Plata 925', category: 'Pulseras' as const, material: 'Plata' as const, purity: '925', basePrice: 65, weight: 8.0 },
  
  // DIJES
  { name: 'Dije Oro 14k', category: 'Dijes' as const, material: 'Oro' as const, purity: '14K', basePrice: 100, weight: 2.0 },
  { name: 'Dije Oro 18k', category: 'Dijes' as const, material: 'Oro' as const, purity: '18K', basePrice: 150, weight: 2.5 },
  { name: 'Dije Plata 925', category: 'Dijes' as const, material: 'Plata' as const, purity: '925', basePrice: 25, weight: 3.0 },
  
  // COLLARES
  { name: 'Collar Oro 14k', category: 'Collares' as const, material: 'Oro' as const, purity: '14K', basePrice: 400, weight: 12.0 },
  { name: 'Collar Oro 18k', category: 'Collares' as const, material: 'Oro' as const, purity: '18K', basePrice: 600, weight: 15.0 },
  { name: 'Collar Plata 925', category: 'Collares' as const, material: 'Plata' as const, purity: '925', basePrice: 120, weight: 18.0 },
  
  // SETS
  { name: 'Set Oro 14k (Aretes + Cadena)', category: 'Otros' as const, material: 'Oro' as const, purity: '14K', basePrice: 500, weight: 12.0 },
  { name: 'Set Oro 18k (Aretes + Cadena)', category: 'Otros' as const, material: 'Oro' as const, purity: '18K', basePrice: 750, weight: 15.0 },
  { name: 'Set Plata 925 (Aretes + Cadena)', category: 'Otros' as const, material: 'Plata' as const, purity: '925', basePrice: 150, weight: 18.0 },
];

export async function seedJewelryProducts() {
  try {
    console.log('🏺 Iniciando población de productos de joyería...');
    
    await sequelize.authenticate();
    console.log('🔗 Conexión a la base de datos establecida');

    // Inicializar el modelo Product
    initializeProduct(sequelize);
    console.log('🔧 Modelo Product inicializado');

    // Crear productos
    for (const productData of jewelryProducts) {
      const product = await Product.create({
        id: uuidv4(),
        code: `JOY-${productData.category.substring(0, 3)}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        name: productData.name,
        description: `${productData.name} - Material: ${productData.material} ${productData.purity}`,
        category: productData.category,
        salePrice: productData.basePrice,
        purchasePrice: productData.basePrice * 0.6, // 40% de margen
        stock: Math.floor(Math.random() * 50) + 10, // Stock aleatorio entre 10-60
        minStock: 5,
        isActive: true,
        // Campos específicos de joyería
        material: productData.material,
        purity: productData.purity,
        weight: productData.weight,
        // Campos opcionales
        supplier: 'PROVEEDOR LOCAL',
        isUniquePiece: false,
        warrantyMonths: 12,
        version: 1
      });

      console.log(`✅ Producto creado: ${product.name} (${product.code})`);
    }

    console.log('🎉 ¡Población de productos completada exitosamente!');
    console.log(`📊 Resumen: ${jewelryProducts.length} productos de joyería creados`);
    
  } catch (error) {
    console.error('❌ Error al poblar productos:', error);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  seedJewelryProducts()
    .then(() => {
      console.log('✅ Script completado exitosamente.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error en el script:', error);
      process.exit(1);
    });
}