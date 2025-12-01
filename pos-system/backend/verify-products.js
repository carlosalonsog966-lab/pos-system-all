const { sequelize } = require('./dist/db/config');
const { Product, ProductAsset } = require('./dist/models');

async function verifyProducts() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a base de datos establecida');
    
    // Verificar productos
    const products = await Product.findAll({
      limit: 10
    });
    
    // Obtener assets por producto
    for (let product of products) {
      const assets = await ProductAsset.findAll({
        where: { productId: product.id }
      });
      product.assets = assets;
    }
    
    console.log(`📦 Total de productos encontrados: ${products.length}`);
    
    products.forEach((product, index) => {
      console.log(`\n${index + 1}. ${product.name}`);
      console.log(`   Código: ${product.code}`);
      console.log(`   Barcode: ${product.barcode}`);
      console.log(`   Categoría: ${product.category}`);
      console.log(`   Precio: $${product.salePrice}`);
      console.log(`   Stock: ${product.stock}`);
      console.log(`   Assets: ${product.assets ? product.assets.length : 0}`);
      
      if (product.assets && product.assets.length > 0) {
        product.assets.forEach(asset => {
          console.log(`     - Asset: ${asset.serial} (${asset.status})`);
        });
      }
    });
    
    // Verificar assets totales
    const totalAssets = await ProductAsset.count();
    console.log(`\n💎 Total de assets de productos: ${totalAssets}`);
    
    // Verificar categorías
    const categories = await Product.findAll({
      attributes: ['category', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['category']
    });
    
    console.log('\n📊 Productos por categoría:');
    categories.forEach(cat => {
      console.log(`   ${cat.category}: ${cat.dataValues.count}`);
    });
    
  } catch (error) {
    console.error('❌ Error verificando productos:', error);
  } finally {
    await sequelize.close();
  }
}

verifyProducts();