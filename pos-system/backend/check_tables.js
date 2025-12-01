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

// Check all tables
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
  if (err) {
    console.error('Error checking tables:', err);
    db.close();
    return;
  }
  
  console.log('Tables in database:');
  tables.forEach(table => {
    console.log('-', table.name);
  });
  
  db.close();
});