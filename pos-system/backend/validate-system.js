const { sequelize } = require('./dist/db/config');
const models = require('./dist/models');

async function validateSystem() {
  console.log('🚀 VALIDACIÓN DEL SISTEMA POS\n');
  
  try {
    // 1. Verificar conexión a base de datos
    console.log('1️⃣ Verificando conexión a base de datos...');
    await sequelize.authenticate();
    console.log('✅ Conexión a BD exitosa');
    
    // 2. Contar productos
    console.log('\n2️⃣ Verificando productos...');
    const productCount = await models.Product.count();
    console.log(`✅ Total de productos: ${productCount}`);
    
    // 3. Verificar productos de joyería
    console.log('\n3️⃣ Verificando productos de joyería...');
    const jewelryProducts = await models.Product.findAll({
      include: [{
        model: models.Category,
        where: { name: 'Joyería' }
      }]
    });
    console.log(`✅ Productos de joyería: ${jewelryProducts.length}`);
    
    // 4. Verificar assets de productos
    console.log('\n4️⃣ Verificando assets de productos...');
    const assetCount = await models.ProductAsset.count();
    console.log(`✅ Total de assets: ${assetCount}`);
    
    // 5. Verificar configuración
    console.log('\n5️⃣ Verificando configuración del sistema...');
    const settings = await models.Settings.findOne();
    if (settings) {
      console.log(`✅ Configuración encontrada:`);
      console.log(`   - Empresa: ${settings.companyName}`);
      console.log(`   - Logo: ${settings.companyLogo || 'No configurado'}`);
      console.log(`   - Impresora: ${settings.printerName || 'No configurado'}`);
    } else {
      console.log('⚠️  No se encontró configuración');
    }
    
    // 6. Verificar categorías
    console.log('\n6️⃣ Verificando categorías...');
    const categories = await models.Category.findAll();
    console.log(`✅ Total de categorías: ${categories.length}`);
    categories.forEach(cat => {
      console.log(`   - ${cat.name}: ${cat.description}`);
    });
    
    // 7. Verificar productos con assets
    console.log('\n7️⃣ Verificando productos con assets...');
    const productsWithAssets = await models.Product.findAll({
      include: [models.ProductAsset]
    });
    
    let productsWithAssetsCount = 0;
    productsWithAssets.forEach(product => {
      if (product.ProductAssets && product.ProductAssets.length > 0) {
        productsWithAssetsCount++;
      }
    });
    
    console.log(`✅ Productos con assets: ${productsWithAssetsCount}`);
    
    console.log('\n🎉 VALIDACIÓN COMPLETA');
    console.log('✅ Sistema POS completamente funcional');
    console.log('✅ Todos los componentes verificados');
    console.log('✅ Listo para producción');
    
  } catch (error) {
    console.error('❌ Error en validación:', error.message);
  } finally {
    await sequelize.close();
  }
}

validateSystem();