import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/config';

interface EmployeeAttributes {
  id: string;
  code: string;
  name: string;
  branchId?: string;
  commissionFormula: 'DIRECT' | 'DISCOUNT_PERCENTAGE'; // DIRECT = directo, DISCOUNT_PERCENTAGE = descuento + porcentaje
  discountPercentage?: number; // Para fórmulas tipo -5%
  commissionRate: number; // Porcentaje final de comisión
  streetSaleCardRate?: number; // Comisión para ventas de calle con tarjeta
  streetSaleCashRate?: number; // Comisión para ventas de calle en efectivo
  phone?: string;
  email?: string;
  position?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface EmployeeCreationAttributes extends Optional<EmployeeAttributes, 'id' | 'branchId' | 'discountPercentage' | 'streetSaleCardRate' | 'streetSaleCashRate' | 'phone' | 'email' | 'position' | 'createdAt' | 'updatedAt'> {}

class Employee extends Model<EmployeeAttributes, EmployeeCreationAttributes> implements EmployeeAttributes {
  public id!: string;
  public code!: string;
  public name!: string;
  public branchId?: string;
  public commissionFormula!: 'DIRECT' | 'DISCOUNT_PERCENTAGE';
  public discountPercentage?: number;
  public commissionRate!: number;
  public streetSaleCardRate?: number;
  public streetSaleCashRate?: number;
  public phone?: string;
  public email?: string;
  public position?: string;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public Branch?: any;

  // Instance methods
  public calculateCommission(saleTotal: number, saleType: 'GUIDE' | 'STREET_CARD' | 'STREET_CASH' = 'GUIDE'): number {
    // Para ventas de calle con tarjeta
    if (saleType === 'STREET_CARD' && this.streetSaleCardRate) {
      if (this.commissionFormula === 'DIRECT') {
        // Fórmula directa: aplicar tasa directamente
        return saleTotal * (this.streetSaleCardRate / 100);
      } else if (this.commissionFormula === 'DISCOUNT_PERCENTAGE' && this.discountPercentage) {
        // Fórmula con descuento: aplicar descuento primero, luego tasa
        const afterDiscount = saleTotal * (1 - this.discountPercentage / 100);
        return afterDiscount * (this.streetSaleCardRate / 100);
      }
    }
    
    // Para ventas de calle en efectivo
    if (saleType === 'STREET_CASH' && this.streetSaleCashRate) {
      if (this.commissionFormula === 'DIRECT') {
        // Fórmula directa: aplicar tasa directamente
        return saleTotal * (this.streetSaleCashRate / 100);
      } else if (this.commissionFormula === 'DISCOUNT_PERCENTAGE' && this.discountPercentage) {
        // Fórmula con descuento: aplicar descuento primero, luego tasa
        const afterDiscount = saleTotal * (1 - this.discountPercentage / 100);
        return afterDiscount * (this.streetSaleCashRate / 100);
      }
    }

    // Comisión normal (con guías)
    if (this.commissionFormula === 'DIRECT') {
      // Fórmula directa: aplicar tasa de comisión directamente al total
      return saleTotal * (this.commissionRate / 100);
    } else if (this.commissionFormula === 'DISCOUNT_PERCENTAGE' && this.discountPercentage) {
      // Fórmula con descuento: aplicar descuento primero, luego tasa de comisión
      const afterDiscount = saleTotal * (1 - this.discountPercentage / 100);
      return afterDiscount * (this.commissionRate / 100);
    }
    
    return 0;
  }
}

Employee.init(
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
    branchId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'branches',
        key: 'id',
      },
    },
    commissionFormula: {
      type: DataTypes.ENUM('DIRECT', 'DISCOUNT_PERCENTAGE'),
      allowNull: false,
      defaultValue: 'DISCOUNT_PERCENTAGE',
    },
    discountPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 100,
      },
      comment: 'Porcentaje de descuento antes de aplicar comisión',
    },
    commissionRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 100,
      },
      comment: 'Porcentaje de comisión final',
    },
    streetSaleCardRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 100,
      },
      comment: 'Comisión para ventas de calle con tarjeta (-5% * rate%)',
    },
    streetSaleCashRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 100,
      },
      comment: 'Comisión para ventas de calle en efectivo (directo)',
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
    position: {
      type: DataTypes.STRING(50),
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
    modelName: 'Employee',
    tableName: 'employees',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['code'],
      },
      {
        fields: ['branchId'],
      },
      {
        fields: ['isActive'],
      },
    ],
  }
);

export default Employee;