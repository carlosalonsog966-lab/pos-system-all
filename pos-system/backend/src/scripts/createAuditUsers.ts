import { sequelize } from '../db/config';
import User from '../models/User';
import bcrypt from 'bcryptjs';

async function createAuditUsers() {
  try {
    await sequelize.authenticate();
    
    // Check existing users
    const users = await User.findAll();
    console.log('Usuarios existentes:', users.map(u => ({ username: u.username, role: u.role })));
    
    // Create admin user if not exists
    const adminExists = users.some(u => u.username === 'admin');
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await User.create({
        username: 'admin',
        password: hashedPassword,
        role: 'admin',
        email: 'admin@joyeria.com',
        isActive: true
      });
      console.log('✅ Usuario admin creado');
    }
    
    // Create cashier user if not exists (equivalent to seller)
    const cashierExists = users.some(u => u.username === 'cashier');
    if (!cashierExists) {
      const hashedPassword = await bcrypt.hash('seller123', 10);
      await User.create({
        username: 'cashier',
        password: hashedPassword,
        role: 'cashier',
        email: 'cashier@joyeria.com',
        isActive: true
      });
      console.log('✅ Usuario cashier creado');
    }
    
    console.log('✅ Usuarios de auditoría creados exitosamente');
    
  } catch (error) {
    console.error('❌ Error creando usuarios:', error);
    throw error;
  }
}

if (require.main === module) {
  createAuditUsers()
    .then(() => {
      console.log('\n✅ Script finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}

export { createAuditUsers };