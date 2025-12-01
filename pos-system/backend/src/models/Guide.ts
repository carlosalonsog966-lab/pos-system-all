import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/config';

interface GuideAttributes {
  id: string;
  code: string;
  name: string;
  agencyId: string;
  commissionFormula: 'DIRECT' | 'DISCOUNT_PERCENTAGE'; // DIRECT = directo, DISCOUNT_PERCENTAGE = descuento + porcentaje
  discountPercentage?: number; // Para fórmulas tipo -18%
  commissionRate: number; // Porcentaje final de comisión
  phone?: string;
  email?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface GuideCreationAttributes extends Optional<GuideAttributes, 'id' | 'discountPercentage' | 'phone' | 'email' | 'createdAt' | 'updatedAt'> {}

class Guide extends Model<GuideAttributes, GuideCreationAttributes> implements GuideAttributes {
  public id!: string;
  public code!: string;
  public name!: string;
  public agencyId!: string;
  public commissionFormula!: 'DIRECT' | 'DISCOUNT_PERCENTAGE';
  public discountPercentage?: number;
  public commissionRate!: number;
  public phone?: string;
  public email?: string;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public Agency?: any;

  // Instance methods
  public calculateCommission(saleTotal: number): number {
    if (this.commissionFormula === 'DIRECT') {
      return saleTotal * (this.commissionRate / 100);
    } else if (this.commissionFormula === 'DISCOUNT_PERCENTAGE' && this.discountPercentage) {
      const afterDiscount = saleTotal * (1 - this.discountPercentage / 100);
      return afterDiscount * (this.commissionRate / 100);
    }
    return 0;
  }
}

Guide.init(
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
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'agencies',
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
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'Guide',
    tableName: 'guides',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['code'],
      },
      {
        fields: ['agencyId'],
      },
      {
        fields: ['isActive'],
      },
    ],
  }
);

export default Guide;