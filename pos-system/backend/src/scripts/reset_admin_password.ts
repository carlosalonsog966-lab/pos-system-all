import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import { sequelize } from '../db/config';
import { initializeModels } from '../models';
import { User } from '../models/User';

async function resetAdminPassword(newPassword: string) {
  try {
    initializeModels();
    await sequelize.authenticate();
    await sequelize.sync({ force: false });

    const admin = await User.findOne({ where: { username: 'admin' } });
    if (!admin) {
      console.error('❌ No existe usuario admin');
      process.exit(1);
      return;
    }

    admin.password = await User.hashPassword(newPassword);
    await admin.save();
    console.log('✅ Contraseña de admin actualizada');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error actualizando contraseña de admin:', error);
    process.exit(1);
  }
}

resetAdminPassword('admin123');
