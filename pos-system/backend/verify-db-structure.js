const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Conectar a la base de datos
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('📊 Verificando estructura de base de datos...\n');

// Verificar estructura de tabla products
db.all("PRAGMA table_info(products);", (err, columns) => {
  if (err) {
    console.error('❌ Error verificando estructura:', err);
    return;
  }
  
  console.log('📋 Columnas de la tabla products:');
  columns.forEach(col => {
    console.log(`   ${col.cid}: ${col.name} (${col.type}) - ${col.notnull ? 'NOT NULL' : 'NULL'}`);
  });
  
  console.log('\n📦 Primeros productos:');
  // Consultar con las columnas correctas
  db.all(`
    SELECT id, name, barcode, category, cost, salePrice, stock, description
    FROM products
    ORDER BY name
    LIMIT 10
  `, (err, products) => {
    if (err) {
      console.error('❌ Error consultando productos:', err);
      return;
    }
    
    console.log(`Total de productos: ${products.length}\n`);
    
    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   ID: ${product.id}`);
      console.log(`   Barcode: ${product.barcode}`);
      console.log(`   Categoría: ${product.category}`);
      console.log(`   Precio Costo: $${product.cost}`);
      console.log(`   Precio Venta: $${product.salePrice}`);
      console.log(`   Stock: ${product.stock}`);
      console.log(`   Descripción: ${product.description?.substring(0, 60)}...`);
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
      
      db.close();
      console.log('\n✅ Verificación completada');
    });
  });
});