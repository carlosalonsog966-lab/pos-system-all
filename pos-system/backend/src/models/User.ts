import { DataTypes, Model, Optional } from 'sequelize';
import bcrypt from 'bcryptjs';
import { sequelize } from '../db/config';

interface UserAttributes {
  id: string;
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'cashier' | 'manager' | 'auditor';
  isActive: boolean;
  avatarUrl?: string;
  lastLogin?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'isActive' | 'lastLogin' | 'createdAt' | 'updatedAt'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: string;
  public username!: string;
  public email!: string;
  public password!: string;
  public role!: 'admin' | 'cashier' | 'manager' | 'auditor';
  public isActive!: boolean;
  public avatarUrl?: string;
  public lastLogin?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Instance methods
  public async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  public toJSON(): Omit<UserAttributes, 'password'> {
    const values = { ...this.get() } as any;
    delete values.password;
    return values;
  }

  // Static methods
  public static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }
}

// Inicializar el modelo User directamente
User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50],
        notEmpty: true,
      },
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true,
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [6, 255],
        notEmpty: true,
      },
    },
    role: {
      type: DataTypes.ENUM('admin', 'cashier', 'manager', 'auditor'),
      allowNull: false,
      defaultValue: 'cashier',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    avatarUrl: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    indexes: [
      {
        unique: true,
        fields: ['username'],
      },
      {
        unique: true,
        fields: ['email'],
      },
      {
        fields: ['role'],
      },
      {
        fields: ['isActive'],
      },
    ],
    hooks: {
      beforeCreate: async (user: User) => {
        if (user.password) {
          user.password = await User.hashPassword(user.password);
        }
      },
      beforeUpdate: async (user: User) => {
        if (user.changed('password')) {
          user.password = await User.hashPassword(user.password);
        }
      },
    },
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
  });

// Función para mantener compatibilidad con el sistema de inicialización
export function initializeUser(sequelizeInstance: any) {
  // El modelo ya está inicializado arriba
  return User;
}

export { User };
export type { UserAttributes, UserCreationAttributes };
export default User;
