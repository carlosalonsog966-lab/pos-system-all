import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/config';

interface SaleItemAttributes {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discountAmount: number;
  total: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SaleItemCreationAttributes extends Optional<SaleItemAttributes, 'id' | 'discountAmount' | 'createdAt' | 'updatedAt'> {}

class SaleItem extends Model<SaleItemAttributes, SaleItemCreationAttributes> implements SaleItemAttributes {
  public id!: string;
  public saleId!: string;
  public productId!: string;
  public quantity!: number;
  public unitPrice!: number;
  public subtotal!: number;
  public discountAmount!: number;
  public total!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public Sale?: any;
  public Product?: any;

  // Instance methods
  public calculateTotals(): void {
    this.subtotal = this.quantity * this.unitPrice;
    this.total = this.subtotal - this.discountAmount;
  }

  public applyDiscount(amount: number): void {
    this.discountAmount = amount;
    this.calculateTotals();
  }

  public applyDiscountPercentage(percentage: number): void {
    const discountAmount = this.subtotal * (percentage / 100);
    this.applyDiscount(discountAmount);
  }

  public getDiscountPercentage(): number {
    if (this.subtotal === 0) return 0;
    return (this.discountAmount / this.subtotal) * 100;
  }
}

// Función para inicializar el modelo SaleItem
export function initializeSaleItem(sequelizeInstance: any) {
  SaleItem.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    saleId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'sales',
        key: 'id',
      },
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id',
      },
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },
    unitPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    subtotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    discountAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    total: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
  },
  {
    indexes: [
      {
        fields: ['saleId'],
      },
      {
        fields: ['productId'],
      },
      {
        fields: ['saleId', 'productId'],
      },
    ],
    hooks: {
      beforeCreate: (saleItem: SaleItem) => {
        saleItem.calculateTotals();
      },
      beforeUpdate: (saleItem: SaleItem) => {
        if (saleItem.changed('quantity') || saleItem.changed('unitPrice') || saleItem.changed('discountAmount')) {
          saleItem.calculateTotals();
        }
      },
    },
    sequelize: sequelizeInstance,
    modelName: 'SaleItem',
    tableName: 'sale_items',
    timestamps: true,
  });
}

export { SaleItem };
export type { SaleItemAttributes, SaleItemCreationAttributes };
export default SaleItem;