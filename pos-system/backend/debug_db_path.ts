import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Cargar variables de entorno
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function debugDbPath() {
  try {
    console.log('🔍 Verificando configuración de base de datos...');
    
    // Variables de entorno
    console.log('Variables de entorno:');
    console.log('- DB_CLIENT:', process.env.DB_CLIENT);
    console.log('- SQLITE_PATH:', process.env.SQLITE_PATH);
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('- CWD:', process.cwd());
    
    // Ruta calculada
    const sqlitePath = process.env.SQLITE_PATH || './data/pos_system.db';
    const absolutePath = path.resolve(sqlitePath);
    console.log('\nRutas calculadas:');
    console.log('- sqlitePath (relativa):', sqlitePath);
    console.log('- absolutePath:', absolutePath);
    console.log('- Archivo existe:', fs.existsSync(absolutePath));
    
    if (fs.existsSync(absolutePath)) {
      const stats = fs.statSync(absolutePath);
      console.log('- Tamaño del archivo:', stats.size, 'bytes');
      console.log('- Última modificación:', stats.mtime);
    }
    
    // Verificar otros posibles archivos de base de datos
    console.log('\n🔍 Verificando otros archivos de base de datos...');
    const possiblePaths = [
      './database.sqlite',
      './data/pos_system.db',
      './src/database.sqlite',
      path.join(process.cwd(), 'database.sqlite'),
      path.join(process.cwd(), 'data', 'pos_system.db')
    ];
    
    for (const dbPath of possiblePaths) {
      const resolved = path.resolve(dbPath);
      const exists = fs.existsSync(resolved);
      console.log(`- ${dbPath} → ${resolved} (existe: ${exists})`);
      if (exists) {
        const stats = fs.statSync(resolved);
        console.log(`  Tamaño: ${stats.size} bytes, Modificado: ${stats.mtime}`);
      }
    }
    
    // Importar configuración de Sequelize
    console.log('\n🔍 Importando configuración de Sequelize...');
    const { sequelize } = await import('./src/db/config');
    console.log('- Sequelize importado correctamente');
    console.log('- Dialect:', sequelize.getDialect());
    console.log('- Storage:', (sequelize as any).options.storage);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugDbPath();