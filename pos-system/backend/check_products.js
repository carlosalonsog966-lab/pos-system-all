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

// Check if Products table exists and has data
db.serialize(() => {
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='Products'", (err, row) => {
    if (err) {
      console.error('Error checking table:', err);
      return;
    }
    if (row) {
      console.log('Products table exists');
      
      // Count products
      db.get("SELECT COUNT(*) as count FROM Products", (err, countRow) => {
        if (err) {
          console.error('Error counting products:', err);
          return;
        }
        console.log('Total products:', countRow.count);
        
        // Show first 5 products
        db.all("SELECT id, name, price, stock FROM Products LIMIT 5", (err, products) => {
          if (err) {
            console.error('Error fetching products:', err);
            return;
          }
          console.log('First 5 products:', products);
          
          db.close();
        });
      });
    } else {
      console.log('Products table does not exist');
      db.close();
    }
  });
});