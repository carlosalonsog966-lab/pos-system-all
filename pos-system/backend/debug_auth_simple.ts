import dotenv from 'dotenv';
import path from 'path';
import { sequelize } from './src/db/config';
import { Op } from 'sequelize';

// Cargar variables de entorno
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function debugAuthSimple() {
  try {
    console.log('🔍 Conectando a la base de datos...');
    
    await sequelize.authenticate();
    console.log('✅ Conexión establecida');

    // Importar modelos sin reinicializar
    const { User } = await import('./src/models/User');
    console.log('✅ Modelo User importado');

    // Importar AuthService
    const { AuthService } = await import('./src/services/authService');
    console.log('✅ AuthService importado');

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

    // Verificar directamente con consulta
    console.log('\n🔍 Verificación directa con consulta...');
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { username: 'admin' },
          { email: 'admin' }
        ],
        isActive: true
      }
    });
    console.log('Usuario encontrado directamente:', !!user);
    if (user) {
      console.log('Detalles:', { id: user.id, username: user.username, email: user.email });
    }

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugAuthSimple();