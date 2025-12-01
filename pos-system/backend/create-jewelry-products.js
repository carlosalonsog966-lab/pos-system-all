const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Conectar a la base de datos
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('💎 Creando productos de joyería con assets...\n');

// Productos de joyería de ejemplo
const jewelryProducts = [
  {
    name: 'Anillo de Oro 18k',
    barcode: 'JOY-ORO-ANI-001',
    category: 'Anillos',
    description: 'Anillo de oro 18k con diseño clásico y elegante',
    cost: 1500.00,
    salePrice: 2500.00,
    stock: 5,
    minStock: 2
  },
  {
    name: 'Cadena de Plata 925',
    barcode: 'JOY-PLA-CAD-002',
    category: 'Cadenas',
    description: 'Cadena de plata 925 con eslabones cubanos',
    cost: 800.00,
    salePrice: 1400.00,
    stock: 8,
    minStock: 3
  },
  {
    name: 'Aretes de Diamante',
    barcode: 'JOY-DIA-ARE-003',
    category: 'Aretes',
    description: 'Aretes con diamantes naturales talla brillante',
    cost: 3000.00,
    salePrice: 5000.00,
    stock: 2,
    minStock: 1
  },
  {
    name: 'Pulsera de Oro Blanco',
    barcode: 'JOY-ORO-PUL-004',
    category: 'Pulseras',
    description: 'Pulsera de oro blanco 14k con diseño moderno',
    cost: 2000.00,
    salePrice: 3500.00,
    stock: 4,
    minStock: 2
  },
  {
    name: 'Colgante de Esmeralda',
    barcode: 'JOY-ESM-COL-005',
    category: 'Colgantes',
    description: 'Colgante con esmeralda natural en montura de oro',
    cost: 2500.00,
    salePrice: 4200.00,
    stock: 3,
    minStock: 1
  }
];

// Crear directorio de uploads si no existe
const uploadsDir = path.join(__dirname, 'uploads/products');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`📁 Directorio creado: ${uploadsDir}`);
}

// Insertar productos
jewelryProducts.forEach((product, index) => {
  const now = new Date().toISOString();
  
  db.run(`
    INSERT INTO products (name, barcode, category, description, cost, salePrice, stock, minStock, isActive, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `, [
    product.name,
    product.barcode,
    product.category,
    product.description,
    product.cost,
    product.salePrice,
    product.stock,
    product.minStock,
    now,
    now
  ], function(err) {
    if (err) {
      console.error(`❌ Error insertando ${product.name}:`, err.message);
      return;
    }
    
    const productId = this.lastID;
    console.log(`✅ Producto creado: ${product.name} (ID: ${productId})`);
    
    // Crear archivo de imagen dummy
    const imageContent = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="#f0f0f0"/>
      <circle cx="100" cy="100" r="80" fill="gold" stroke="#333" stroke-width="2"/>
      <text x="100" y="110" text-anchor="middle" font-size="14" fill="#333">${product.name}</text>
    </svg>`;
    
    const imageFileName = `product_${productId}.svg`;
    const imagePath = path.join(uploadsDir, imageFileName);
    
    fs.writeFileSync(imagePath, imageContent);
    console.log(`   📸 Imagen creada: ${imageFileName}`);
  });
});

db.close(() => {
  console.log('\n✅ Proceso de creación de productos completado');
});