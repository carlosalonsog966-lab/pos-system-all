import dotenv from 'dotenv';
import path from 'path';
import { sequelize } from './src/db/config';
import { Op } from 'sequelize';

// Cargar variables de entorno
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function debugUserQuery() {
  try {
    console.log('🔍 Conectando a la base de datos...');
    
    await sequelize.authenticate();
    console.log('✅ Conexión establecida');

    // Importar modelos
    const { initializeModels } = await import('./src/models');
    await initializeModels();
    
    const { User } = await import('./src/models/User');
    console.log('✅ Modelos cargados');

    // Probar consulta exacta del servicio
    console.log('\n🔍 Probando consulta para username "admin"...');
    const user1 = await User.findOne({
      where: {
        [Op.or]: [
          { username: 'admin' },
          { email: 'admin' }
        ],
        isActive: true
      }
    });
    
    console.log('Resultado:', user1 ? {
      id: user1.id,
      username: user1.username,
      email: user1.email,
      isActive: user1.isActive
    } : null);

    console.log('\n🔍 Probando consulta para email "admin@joyeria.com"...');
    const user2 = await User.findOne({
      where: {
        [Op.or]: [
          { username: 'admin@joyeria.com' },
          { email: 'admin@joyeria.com' }
        ],
        isActive: true
      }
    });
    
    console.log('Resultado:', user2 ? {
      id: user2.id,
      username: user2.username,
      email: user2.email,
      isActive: user2.isActive
    } : null);

    console.log('\n🔍 Probando consulta simple por username...');
    const user3 = await User.findOne({
      where: {
        username: 'admin',
        isActive: true
      }
    });
    
    console.log('Resultado:', user3 ? {
      id: user3.id,
      username: user3.username,
      email: user3.email,
      isActive: user3.isActive
    } : null);

    console.log('\n🔍 Listando todos los usuarios activos...');
    const allUsers = await User.findAll({
      where: {
        isActive: true
      },
      attributes: ['id', 'username', 'email', 'isActive']
    });
    
    console.log('Usuarios activos:', allUsers.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      isActive: u.isActive
    })));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sequelize.close();
  }
}

debugUserQuery();