import sqlite3 from 'sqlite3';
import { promisify } from 'util';

async function addMissingColumns() {
  const db = new sqlite3.Database('c:\\Users\\Panda\\Music\\SISTEMA POS\\SISTEMA\\pos-system\\backend\\data\\pos_system.db');
  
  const run = promisify(db.run.bind(db));
  
  try {
    // Get current columns
    const columns = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(products)", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    const columnNames = columns.map(col => col.name);
    console.log('Current columns:', columnNames);
    
    // Define all required columns from the Product model
    const requiredColumns = [
      { name: 'brand', type: 'VARCHAR(100)', nullable: true },
      { name: 'stoneClarity', type: 'VARCHAR(30)', nullable: true },
      { name: 'stoneCarat', type: 'DECIMAL(6,3)', nullable: true },
      { name: 'isUniquePiece', type: 'TINYINT(1)', nullable: false, defaultValue: '0' },
      { name: 'warrantyMonths', type: 'INTEGER', nullable: false, defaultValue: '0' },
      { name: 'version', type: 'INTEGER', nullable: false, defaultValue: '1' }
    ];
    
    // Add missing columns
    for (const col of requiredColumns) {
      if (!columnNames.includes(col.name)) {
        console.log(`Adding ${col.name} column...`);
        let sql = `ALTER TABLE products ADD COLUMN ${col.name} ${col.type}`;
        if (!col.nullable) {
          sql += ' NOT NULL';
        }
        if (col.defaultValue !== undefined) {
          sql += ` DEFAULT ${col.defaultValue}`;
        }
        
        await run(sql);
        console.log(`✅ ${col.name} column added`);
      } else {
        console.log(`➖ ${col.name} column already exists`);
      }
    }
    
    console.log('✅ All missing columns added successfully');
    
  } catch (error) {
    console.error('Error adding columns:', error);
  } finally {
    db.close();
  }
}

addMissingColumns();