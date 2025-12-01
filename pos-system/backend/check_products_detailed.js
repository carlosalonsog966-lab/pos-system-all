const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'pos_system.db');
console.log('Checking database at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    return;
  }
  console.log('Database opened successfully');
});

// Check products table structure and data
db.serialize(() => {
  // Get table schema
  db.all("PRAGMA table_info(products)", (err, columns) => {
    if (err) {
      console.error('Error getting table schema:', err);
      return;
    }
    console.log('Products table columns:');
    columns.forEach(col => {
      console.log(`- ${col.name}: ${col.type}`);
    });
    
    // Count products
    db.get("SELECT COUNT(*) as count FROM products", (err, countRow) => {
      if (err) {
        console.error('Error counting products:', err);
        db.close();
        return;
      }
      console.log('Total products:', countRow.count);
      
      if (countRow.count > 0) {
        // Show first 5 products
        db.all("SELECT id, name, price, stock FROM products LIMIT 5", (err, products) => {
          if (err) {
            console.error('Error fetching products:', err);
            db.close();
            return;
          }
          console.log('First 5 products:', products);
          db.close();
        });
      } else {
        console.log('No products found in database');
        db.close();
      }
    });
  });
});