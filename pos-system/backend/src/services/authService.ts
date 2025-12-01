import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { LoginInput, RegisterInput, ChangePasswordInput } from '../schemas/auth';
import { User } from '../models/User';
import { Op } from 'sequelize';
import { SettingsService } from './settingsService';
import EventLog from '../models/EventLog';

export class AuthService {
  static async login(data: LoginInput) {
    const { username, password } = data;

    // Verificar bloqueos por intentos fallidos recientes
    const settings = await SettingsService.getSettings();
    const maxAttempts = settings.maxLoginAttempts || 5;
    const windowMinutes = 15; // ventana de tiempo para contar intentos fallidos
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
    const recentFails = await EventLog.count({
      where: {
        type: 'ERROR',
        context: `auth:${username}`,
        createdAt: { [Op.gte]: windowStart }
      }
    });

    if (recentFails >= maxAttempts) {
      throw new Error('Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intenta más tarde.');
    }

    // Buscar usuario por username o email
    const user = await User.findOne({
      attributes: ['id', 'username', 'email', 'role', 'isActive', 'password', 'lastLogin'],
      where: {
        [Op.or]: [
          { username },
          { email: username }
        ],
        isActive: true
      }
    });

    if (!user) {
      // Registrar intento fallido
      await EventLog.create({
        type: 'ERROR',
        severity: 'warning',
        message: 'Login fallido: usuario no encontrado',
        context: `auth:${username}`,
        details: { username }
      });
      throw new Error('Credenciales inválidas');
    }

    const passwordValid = await bcrypt.compare(password, user.password);

    if (!passwordValid) {
      await EventLog.create({
        type: 'ERROR',
        severity: 'warning',
        message: 'Login fallido: contraseña incorrecta',
        context: `auth:${username}`,
        userId: user.id,
        details: { username }
      });
      throw new Error('Credenciales inválidas');
    }

    // Actualizar último login
    user.lastLogin = new Date();
    await user.save();

    const payload = { userId: user.id, username: user.username, role: user.role };
    const secret = process.env.JWT_SECRET || 'default-secret-key';
    const token = jwt.sign(payload, secret, { expiresIn: '24h' });

    // Registrar login exitoso
    await EventLog.create({
      type: 'USER_ACTION',
      severity: 'info',
      message: 'Login exitoso',
      context: `auth:${user.username}`,
      userId: user.id,
      details: { username: user.username }
    });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        lastLogin: user.lastLogin,
      },
    };
  }

  static async register(data: RegisterInput) {
    const { username, email, password, role } = data;
    


    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({
      where: { username },
    });

    if (existingUser) {
      throw new Error('El nombre de usuario ya existe');
    }

    // Verificar si el email ya existe
    if (email) {
      const existingEmail = await User.findOne({
        where: { email },
      });

      if (existingEmail) {
        throw new Error('El email ya está registrado');
      }
    }

    const user = await User.create({
      username,
      email,
      password,
      role,
      isActive: true,
    });

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };
  }

  static async changePassword(userId: string, data: ChangePasswordInput) {
    const { currentPassword, newPassword } = data;
    


    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    if (!(await bcrypt.compare(currentPassword, user.password))) {
      throw new Error('Contraseña actual incorrecta');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    await user.save();

    return { message: 'Contraseña actualizada exitosamente' };
  }

  static async getProfile(userId: string) {

    
    const user = await User.findByPk(userId, {
      attributes: ['id', 'username', 'email', 'role', 'isActive', 'lastLogin', 'createdAt'],
    });

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    return user;
  }

  static async refresh(userId: string) {
    const user = await User.findByPk(userId, {
      attributes: ['id', 'username', 'email', 'role', 'isActive', 'lastLogin']
    });
    if (!user || !user.isActive) {
      throw new Error('Usuario no válido o inactivo');
    }
    const payload = { userId: user.id, username: user.username, role: user.role };
    const secret = process.env.JWT_SECRET || 'default-secret-key';
    const token = jwt.sign(payload, secret, { expiresIn: '24h' });
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        lastLogin: user.lastLogin,
      },
    };
  }
}
