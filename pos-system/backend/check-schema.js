import sqlite3 from 'sqlite3';
import { promisify } from 'util';

async function checkDatabaseSchema() {
  const db = new sqlite3.Database('c:\\Users\\Panda\\Music\\SISTEMA POS\\SISTEMA\\pos-system\\backend\\data\\pos_system.db');
  
  const run = promisify(db.all.bind(db));
  
  try {
    // Check products table schema
    const schema = await run("PRAGMA table_info(products)");
    console.log('Products table columns:');
    schema.forEach(col => {
      console.log(`- ${col.name}: ${col.type} (${col.notnull ? 'NOT NULL' : 'NULL'})`);
    });
    
    // Check if brand column exists
    const brandColumn = schema.find(col => col.name === 'brand');
    if (!brandColumn) {
      console.log('\n❌ brand column is missing!');
      console.log('Need to add brand column to products table.');
    } else {
      console.log('\n✅ brand column exists');
    }
    
    // Check first few products
    const products = await run("SELECT id, code, name FROM products LIMIT 5");
    console.log('\nFirst 5 products:');
    products.forEach(p => console.log(`- ${p.code}: ${p.name}`));
    
  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    db.close();
  }
}

checkDatabaseSchema();