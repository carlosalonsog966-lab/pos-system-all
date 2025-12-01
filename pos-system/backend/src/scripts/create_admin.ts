import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { sequelize } from '../db/config';
import { initializeModels } from '../models';
import { User } from '../models/User';

async function ensureAdmin() {
  try {
    console.log('🔧 Inicializando modelos...');
    initializeModels();

    console.log('🔗 Autenticando conexión a la base de datos...');
    await sequelize.authenticate();

    // Asegurar que las tablas existen sin alterar estructuras
    console.log('🗃️ Sincronizando modelos (alter: true)...');
    await sequelize.sync({ alter: true });

    console.log('👤 Verificando/creando usuario administrador...');
    const [admin, created] = await User.findOrCreate({
      where: { username: 'admin' },
      defaults: {
        username: 'admin',
        email: 'admin@joyeria.com',
        password: 'admin123', // Se hashea por hook beforeCreate
        role: 'admin',
        isActive: true,
      },
    });

    if (created) {
      console.log('✅ Usuario administrador creado');
    } else {
      console.log('ℹ️ Usuario administrador ya existía');
    }

    console.log('Admin:', { id: admin.id, username: admin.username, role: admin.role });
    process.exit(0);
  } catch (error) {
    console.error('❌ Error asegurando usuario admin:', error);
    process.exit(1);
  }
}

ensureAdmin();
