import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/config';

export interface CashCountAttributes {
  id: string;
  cashRegisterId: string;
  userId: string;
  denominations: Record<string, number>; // { "1000": 3, "500": 4 }
  countedAmount: number;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CashCountCreationAttributes
  extends Optional<CashCountAttributes, 'id' | 'notes' | 'createdAt' | 'updatedAt'> {}

export class CashCount extends Model<CashCountAttributes, CashCountCreationAttributes>
  implements CashCountAttributes {
  public id!: string;
  public cashRegisterId!: string;
  public userId!: string;
  public denominations!: Record<string, number>;
  public countedAmount!: number;
  public notes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CashCount.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    cashRegisterId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'cash_registers',
        key: 'id',
      },
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    // SQLite almacena JSON como TEXT; Sequelize JSON funciona como TEXT en SQLite
    denominations: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    countedAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    indexes: [
      { fields: ['cashRegisterId'] },
      { fields: ['userId'] },
      { fields: ['createdAt'] },
    ],
    sequelize,
    modelName: 'CashCount',
    tableName: 'cash_counts',
    timestamps: true,
  }
);

export function initializeCashCount(sequelizeInstance: any) {
  return CashCount;
}

// Named export is implicit via class declaration
