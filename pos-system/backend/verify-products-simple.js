const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Conectar a la base de datos
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('📊 Verificando productos de joyería...\n');

// Consultar productos
db.all(`
  SELECT id, name, code, barcode, category, material, 
         salePrice, stock, description
  FROM products
  ORDER BY category, name
  LIMIT 15
`, (err, products) => {
  if (err) {
    console.error('❌ Error consultando productos:', err);
    return;
  }
  
  console.log(`📦 Total de productos encontrados: ${products.length}\n`);
  
  products.forEach((product, index) => {
    console.log(`${index + 1}. ${product.name}`);
    console.log(`   Código: ${product.code}`);
    console.log(`   Barcode: ${product.barcode}`);
    console.log(`   Categoría: ${product.category}`);
    console.log(`   Material: ${product.material}`);
    console.log(`   Precio: $${product.salePrice}`);
    console.log(`   Stock: ${product.stock}`);
    console.log(`   Descripción: ${product.description?.substring(0, 50)}...`);
    console.log('');
  });
  
  // Verificar categorías
  db.all(`
    SELECT category, COUNT(*) as count
    FROM products
    GROUP BY category
    ORDER BY count DESC
  `, (err, categories) => {
    if (err) {
      console.error('❌ Error consultando categorías:', err);
      return;
    }
    
    console.log('📊 Productos por categoría:');
    categories.forEach(cat => {
      console.log(`   ${cat.category}: ${cat.count} productos`);
    });
    
    // Verificar assets físicos
    console.log('\n💎 Verificando assets físicos...');
    const assetsDir = path.join(__dirname, 'uploads/products');
    
    if (fs.existsSync(assetsDir)) {
      const files = fs.readdirSync(assetsDir);
      console.log(`📁 Directorio de assets: ${assetsDir}`);
      console.log(`📄 Archivos encontrados: ${files.length}`);
      
      files.forEach(file => {
        const filePath = path.join(assetsDir, file);
        const stats = fs.statSync(filePath);
        console.log(`   - ${file} (${stats.size} bytes)`);
      });
    } else {
      console.log('⚠️  Directorio de assets no encontrado');
    }
    
    db.close();
    console.log('\n✅ Verificación completada');
  });
});