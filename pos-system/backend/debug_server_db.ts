import dotenv from 'dotenv';
import path from 'path';

// Simular exactamente cómo carga las variables el servidor
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function debugServerDb() {
  try {
    console.log('🔍 Simulando configuración del servidor...');
    console.log('__dirname:', __dirname);
    console.log('Ruta del .env:', path.join(__dirname, '../../.env'));
    
    console.log('\nVariables de entorno cargadas:');
    console.log('- DB_CLIENT:', process.env.DB_CLIENT);
    console.log('- SQLITE_PATH:', process.env.SQLITE_PATH);
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('- CWD:', process.cwd());
    
    // Calcular la ruta como lo hace el servidor
    const sqlitePath = process.env.SQLITE_PATH || './data/pos_system.db';
    const absolutePath = path.resolve(sqlitePath);
    console.log('\nRutas calculadas por el servidor:');
    console.log('- sqlitePath (relativa):', sqlitePath);
    console.log('- absolutePath:', absolutePath);
    
    // Verificar si el archivo existe
    const fs = await import('fs');
    console.log('- Archivo existe:', fs.existsSync(absolutePath));
    
    if (fs.existsSync(absolutePath)) {
      const stats = fs.statSync(absolutePath);
      console.log('- Tamaño del archivo:', stats.size, 'bytes');
    }
    
    // Importar la configuración de Sequelize
    console.log('\n🔍 Importando configuración de Sequelize...');
    const { sequelize } = await import('./src/db/config');
    console.log('- Storage configurado:', (sequelize as any).options.storage);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugServerDb();