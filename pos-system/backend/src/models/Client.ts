import { DataTypes, Model, Optional, Op } from 'sequelize';
import { sequelize } from '../db/config';

interface ClientAttributes {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  birthDate?: Date;
  documentType?: 'CC' | 'CE' | 'TI' | 'PP' | 'NIT';
  documentNumber?: string;
  isActive: boolean;
  notes?: string;
  totalPurchases: number;
  loyaltyPoints: number;
  lastPurchaseDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ClientCreationAttributes extends Optional<ClientAttributes, 'id' | 'email' | 'phone' | 'address' | 'city' | 'country' | 'birthDate' | 'documentType' | 'documentNumber' | 'isActive' | 'notes' | 'totalPurchases' | 'loyaltyPoints' | 'lastPurchaseDate' | 'createdAt' | 'updatedAt'> {}

class Client extends Model<ClientAttributes, ClientCreationAttributes> implements ClientAttributes {
  public id!: string;
  public code!: string;
  public firstName!: string;
  public lastName!: string;
  public email?: string;
  public phone?: string;
  public address?: string;
  public city?: string;
  public country?: string;
  public birthDate?: Date;
  public documentType?: 'CC' | 'CE' | 'TI' | 'PP' | 'NIT';
  public documentNumber?: string;
  public isActive!: boolean;
  public notes?: string;
  public totalPurchases!: number;
  public loyaltyPoints!: number;
  public lastPurchaseDate?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Instance methods
  public getFullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  public updatePurchaseStats(amount: number): void {
    // Solo actualizar las propiedades, el save() se hace en el servicio
    this.setDataValue('totalPurchases', this.totalPurchases + amount);
    this.setDataValue('lastPurchaseDate', new Date());
  }

  public isVipClient(): boolean {
    return this.totalPurchases >= 10000; // VIP if total purchases >= $10,000
  }

  public getAge(): number | null {
    if (!this.birthDate) return null;
    const today = new Date();
    const birthDate = new Date(this.birthDate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }
}

// Función para inicializar el modelo Client
export function initializeClient(sequelizeInstance: any) {
  Client.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [1, 100],
        notEmpty: true,
      },
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [1, 100],
        notEmpty: true,
      },
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true,
      validate: {
        isEmail: true,
      },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        len: [5, 20],
      },
    },
    address: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    birthDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: true,
        isBefore: new Date().toISOString(),
      },
    },
    documentType: {
      type: DataTypes.ENUM('CC', 'CE', 'TI', 'PP', 'NIT'),
      allowNull: true,
    },
    documentNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    totalPurchases: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    loyaltyPoints: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    lastPurchaseDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    indexes: [
      {
        unique: true,
        fields: ['code'],
      },
      {
        fields: ['firstName', 'lastName'],
      },
      {
        fields: ['email'],
        unique: true,
        where: {
          email: {
            [Op.ne]: null,
          },
        },
      },
      {
        fields: ['phone'],
      },
      {
        fields: ['documentNumber'],
        unique: true,
        where: {
          documentNumber: {
            [Op.ne]: null,
          },
        },
      },
      {
        fields: ['isActive'],
      },
      {
        fields: ['totalPurchases'],
      },
      {
        fields: ['lastPurchaseDate'],
      },
    ],
    sequelize: sequelizeInstance,
    modelName: 'Client',
    tableName: 'clients',
    timestamps: true,
  });
}

export { Client };
export type { ClientAttributes, ClientCreationAttributes };
export default Client;