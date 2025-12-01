import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno exactamente como el servidor
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function debugServerConfig() {
  try {
    console.log('🔍 Iniciando con la misma configuración del servidor...');
    
    // Importar exactamente como en server.ts
    const { initializeDatabase } = await import('./src/app');
    await initializeDatabase();
    console.log('✅ Base de datos inicializada');

    // Importar AuthService exactamente como en el controlador
    const { AuthService } = await import('./src/services/authService');
    
    console.log('\n🔍 Probando AuthService.login con "admin"...');
    try {
      const result1 = await AuthService.login({ username: 'admin', password: 'admin123' });
      console.log('✅ Login exitoso:', { username: result1.user.username, email: result1.user.email });
    } catch (error) {
      console.log('❌ Login falló:', error instanceof Error ? error.message : String(error));
    }

    console.log('\n🔍 Probando AuthService.login con "admin@joyeria.com"...');
    try {
      const result2 = await AuthService.login({ username: 'admin@joyeria.com', password: 'admin123' });
      console.log('✅ Login exitoso:', { username: result2.user.username, email: result2.user.email });
    } catch (error) {
      console.log('❌ Login falló:', error instanceof Error ? error.message : String(error));
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugServerConfig();