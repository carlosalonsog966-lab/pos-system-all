import sqlite3 from 'sqlite3';
import { promisify } from 'util';

async function applyMigration() {
  const db = new sqlite3.Database('c:\\Users\\Panda\\Music\\SISTEMA POS\\SISTEMA\\pos-system\\backend\\data\\pos_system.db');
  
  const run = promisify(db.run.bind(db));
  const get = promisify(db.get.bind(db));
  
  try {
    // Check if brand column already exists
    const schema = await run("PRAGMA table_info(products)");
    const columns = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(products)", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    const brandExists = columns.some(col => col.name === 'brand');
    
    if (brandExists) {
      console.log('✅ brand column already exists');
      return;
    }
    
    // Add brand column
    console.log('Adding brand column to products table...');
    await run("ALTER TABLE products ADD COLUMN brand VARCHAR(100)");
    console.log('✅ brand column added successfully');
    
    // Verify the change
    const newColumns = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(products)", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    const brandColumn = newColumns.find(col => col.name === 'brand');
    if (brandColumn) {
      console.log('✅ Migration verified: brand column exists');
    } else {
      console.log('❌ Migration failed: brand column not found');
    }
    
  } catch (error) {
    console.error('Error applying migration:', error);
  } finally {
    db.close();
  }
}

applyMigration();