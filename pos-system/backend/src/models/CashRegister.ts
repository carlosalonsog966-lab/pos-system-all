import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/config';

interface CashRegisterAttributes {
  id: string;
  userId: string;
  openingAmount: number;
  closingAmount?: number;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalTransfer: number;
  status: 'open' | 'closed';
  openedAt: Date;
  closedAt?: Date;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface CashRegisterCreationAttributes extends Optional<CashRegisterAttributes, 'id' | 'closingAmount' | 'totalSales' | 'totalCash' | 'totalCard' | 'totalTransfer' | 'closedAt' | 'notes' | 'createdAt' | 'updatedAt'> {}

class CashRegister extends Model<CashRegisterAttributes, CashRegisterCreationAttributes> implements CashRegisterAttributes {
  public id!: string;
  public userId!: string;
  public openingAmount!: number;
  public closingAmount?: number;
  public totalSales!: number;
  public totalCash!: number;
  public totalCard!: number;
  public totalTransfer!: number;
  public status!: 'open' | 'closed';
  public openedAt!: Date;
  public closedAt?: Date;
  public notes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public User?: any;

  // Instance methods
  public calculateTotals(): void {
    this.totalSales = this.totalCash + this.totalCard + this.totalTransfer;
  }

  public addSale(amount: number, paymentMethod: 'cash' | 'card' | 'transfer'): void {
    switch (paymentMethod) {
      case 'cash':
        this.totalCash += amount;
        break;
      case 'card':
        this.totalCard += amount;
        break;
      case 'transfer':
        this.totalTransfer += amount;
        break;
    }
    this.calculateTotals();
  }

  public getExpectedCash(): number {
    return this.openingAmount + this.totalCash;
  }

  public getCashDifference(): number {
    if (!this.closingAmount) return 0;
    return this.closingAmount - this.getExpectedCash();
  }

  public getSessionDuration(): number {
    const endTime = this.closedAt || new Date();
    return Math.floor((endTime.getTime() - this.openedAt.getTime()) / (1000 * 60)); // in minutes
  }

  public canBeClosed(): boolean {
    return this.status === 'open';
  }

  public close(closingAmount: number, notes?: string): void {
    if (!this.canBeClosed()) {
      throw new Error('Cash register is already closed');
    }
    
    this.closingAmount = closingAmount;
    this.status = 'closed';
    this.closedAt = new Date();
    if (notes) {
      this.notes = notes;
    }
  }
}

// Inicializar el modelo CashRegister directamente
CashRegister.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    openingAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    closingAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: {
        min: 0,
      },
    },
    totalSales: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    totalCash: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    totalCard: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    totalTransfer: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    status: {
      type: DataTypes.ENUM('open', 'closed'),
      allowNull: false,
      defaultValue: 'open',
    },
    openedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    closedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    indexes: [
      {
        fields: ['userId'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['openedAt'],
      },
      {
        fields: ['closedAt'],
      },
      {
        fields: ['userId', 'status'],
      },
    ],
    hooks: {
      beforeUpdate: (cashRegister: CashRegister) => {
        if (cashRegister.changed('totalCash') || cashRegister.changed('totalCard') || cashRegister.changed('totalTransfer')) {
          cashRegister.calculateTotals();
        }
      },
    },
    sequelize,
    modelName: 'CashRegister',
    tableName: 'cash_registers',
    timestamps: true,
  });

// Función de compatibilidad para inicialización
export function initializeCashRegister(sequelizeInstance: any) {
  return CashRegister;
}

export { CashRegister };
export type { CashRegisterAttributes, CashRegisterCreationAttributes };
export default CashRegister;