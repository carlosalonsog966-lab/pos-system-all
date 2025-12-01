import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/config';

interface AgencyAttributes {
  id: string;
  code: string;
  name: string;
  commissionRate: number; // Porcentaje de comisión para la agencia
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AgencyCreationAttributes extends Optional<AgencyAttributes, 'id' | 'contactPerson' | 'phone' | 'email' | 'address' | 'createdAt' | 'updatedAt'> {}

class Agency extends Model<AgencyAttributes, AgencyCreationAttributes> implements AgencyAttributes {
  public id!: string;
  public code!: string;
  public name!: string;
  public commissionRate!: number;
  public contactPerson?: string;
  public phone?: string;
  public email?: string;
  public address?: string;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public Guides?: any[];
}

Agency.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [2, 20],
      },
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 100],
      },
    },
    commissionRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 100,
      },
      comment: 'Porcentaje de comisión (0-100)',
    },
    contactPerson: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        isEmail: true,
      },
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'Agency',
    tableName: 'agencies',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['code'],
      },
      {
        fields: ['isActive'],
      },
    ],
  }
);

export default Agency;