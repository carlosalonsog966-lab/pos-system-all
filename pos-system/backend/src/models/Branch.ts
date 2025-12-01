import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/config';

interface BranchAttributes {
  id: string;
  code: string;
  name: string;
  address?: string;
  phone?: string;
  manager?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface BranchCreationAttributes extends Optional<BranchAttributes, 'id' | 'address' | 'phone' | 'manager' | 'createdAt' | 'updatedAt'> {}

class Branch extends Model<BranchAttributes, BranchCreationAttributes> implements BranchAttributes {
  public id!: string;
  public code!: string;
  public name!: string;
  public address?: string;
  public phone?: string;
  public manager?: string;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public Employees?: any[];
  public Sales?: any[];
}

Branch.init(
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
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    manager: {
      type: DataTypes.STRING(100),
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
    modelName: 'Branch',
    tableName: 'branches',
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

export default Branch;