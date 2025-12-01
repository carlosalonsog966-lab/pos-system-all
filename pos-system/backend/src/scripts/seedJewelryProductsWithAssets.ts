import { sequelize } from '../db/config';
import Product, { initializeProduct } from '../models/Product';
import { ProductAsset, initializeProductAsset } from '../models/ProductAsset';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

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

// Generar imagen dummy de joyería (100x100px PNG transparente con borde dorado/plateado)
async function generateJewelryImage(material: 'Oro' | 'Plata', category: string): Promise<Buffer> {
  // SVG simple que representa joyería
  const color = material === 'Oro' ? '#D4AF37' : '#C0C0C0';
  const svg = `
    <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#f8f8f8"/>
      <circle cx="50" cy="50" r="30" fill="none" stroke="${color}" stroke-width="3"/>
      <circle cx="50" cy="50" r="20" fill="none" stroke="${color}" stroke-width="2"/>
      <text x="50" y="85" text-anchor="middle" font-size="10" fill="${color}">${category}</text>
    </svg>
  `;
  
  // Renderizar a PNG usando sharp para evitar errores de tipo
  return await sharp(Buffer.from(svg)).png({ quality: 90 }).toBuffer();
}

export async function seedJewelryProductsWithAssets() {
  try {
    console.log('🏺 Iniciando población de productos de joyería con assets...');
    
    await sequelize.authenticate();
    console.log('🔗 Conexión a la base de datos establecida');

    // Inicializar modelos
    await initializeProduct(sequelize);
    await initializeProductAsset(sequelize);
    await sequelize.sync();
    console.log('✅ Modelos sincronizados');

    // Crear directorio de assets si no existe
    const assetsDir = path.join(process.cwd(), '..', 'data', 'assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
      console.log(`✅ Directorio de assets creado: ${assetsDir}`);
    }

    const createdProducts = [];
    const createdAssets = [];

    for (let i = 0; i < jewelryProducts.length; i++) {
      const productData = jewelryProducts[i];
      const sku = `JOY-${productData.material.substring(0, 3)}-${productData.category.substring(0, 3)}-${String(i + 1).padStart(3, '0')}`;
      
      // Idempotencia: buscar producto por código; crear si no existe
      const existingProduct = await Product.findOne({ where: { code: sku } });
      const product = existingProduct ?? await Product.create({
        id: uuidv4(),
        code: sku,
        name: productData.name,
        description: `${productData.name} - Material: ${productData.material} ${productData.purity}, Peso: ${productData.weight}g`,
        category: productData.category,
        material: productData.material,
        purity: productData.purity,
        purchasePrice: productData.basePrice,
        salePrice: Math.round(productData.basePrice * 1.3), // 30% markup
        stock: Math.floor(Math.random() * 50) + 10, // 10-60 unidades
        minStock: 5,
        weight: productData.weight,
        barcode: sku,
        isActive: true,
        isUniquePiece: false,
        warrantyMonths: 12,
        version: 1
      });
      
      if (!existingProduct) {
        createdProducts.push(product);
        console.log(`✅ Producto creado: ${product.name} (${sku})`);
      } else {
        console.log(`↺ Producto existente, omitido: ${product.name} (${sku})`);
      }
      
      // Crear asset de imagen
      const imageBuffer = await generateJewelryImage(productData.material, productData.category);
      const filename = `${sku}.png`;
      const filePath = path.join(assetsDir, filename);
      
      // Guardar imagen en disco (idempotente)
      try {
        fs.writeFileSync(filePath, imageBuffer);
        console.log(`  📸 Imagen guardada: ${filename} (${imageBuffer.length} bytes)`);
      } catch (e) {
        console.warn(`  ⚠️ No se pudo escribir imagen, continuando: ${String(e)}`);
      }
      
      // Idempotencia: buscar asset por serial; crear si no existe
      const existingAsset = await ProductAsset.findOne({ where: { serial: sku } });
      const asset = existingAsset ?? await ProductAsset.create({
        id: uuidv4(),
        productId: product.id,
        serial: sku,
        status: 'available',
        metadata: {
          filename: filename,
          originalName: filename,
          mimeType: 'image/png',
          size: imageBuffer.length,
          path: `./data/assets/${filename}`,
          url: `/api/product-assets/${filename}`,
          isPrimary: true,
          order: 0,
          width: 100,
          height: 100,
          format: 'png',
          createdAt: new Date().toISOString()
        }
      });
      
      if (!existingAsset) {
        createdAssets.push(asset);
        console.log(`  💎 Asset creado: ${asset.serial}`);
      } else {
        console.log(`  ↺ Asset existente, omitido: ${asset.serial}`);
      }
    }
    
    console.log(`\n🎉 Seed completado exitosamente!`);
    console.log(`📊 Resumen:`);
    console.log(`  - Productos creados: ${createdProducts.length}`);
    console.log(`  - Assets creados: ${createdAssets.length}`);
    console.log(`  - Directorio assets: ${path.join(process.cwd(), '..', 'data', 'assets')}`);
    
    return { products: createdProducts, assets: createdAssets };
    
  } catch (error) {
    console.error('❌ Error en seed de productos con assets:', error);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  seedJewelryProductsWithAssets()
    .then(() => {
      console.log('\n✅ Script finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}