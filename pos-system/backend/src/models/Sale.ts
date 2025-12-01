import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/config';

interface SaleAttributes {
  id: string;
  saleNumber: string;
  clientId?: string;
  userId: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'mixed';
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  notes?: string;
  cardReference?: string;
  transferReference?: string;
  saleDate: Date;
  // Nuevos campos para sistema de turismo
  saleType: 'GUIDE' | 'STREET'; // Venta con guía o venta de calle
  agencyId?: string; // ID de la agencia (solo para ventas con guía)
  guideId?: string; // ID del guía (solo para ventas con guía)
  employeeId?: string; // ID del empleado/vendedor
  branchId?: string; // ID de la sucursal
  agencyCommission?: number; // Comisión calculada para la agencia
  guideCommission?: number; // Comisión calculada para el guía
  employeeCommission?: number; // Comisión calculada para el empleado
  createdAt?: Date;
  updatedAt?: Date;
}

interface SaleCreationAttributes extends Optional<SaleAttributes, 'id' | 'clientId' | 'taxAmount' | 'discountAmount' | 'notes' | 'saleDate' | 'saleType' | 'agencyId' | 'guideId' | 'employeeId' | 'branchId' | 'agencyCommission' | 'guideCommission' | 'employeeCommission' | 'createdAt' | 'updatedAt'> {}

class Sale extends Model<SaleAttributes, SaleCreationAttributes> implements SaleAttributes {
  public id!: string;
  public saleNumber!: string;
  public clientId?: string;
  public userId!: string;
  public subtotal!: number;
  public taxAmount!: number;
  public discountAmount!: number;
  public total!: number;
  public paymentMethod!: 'cash' | 'card' | 'transfer' | 'mixed';
  public status!: 'pending' | 'completed' | 'cancelled' | 'refunded';
  public notes?: string;
  public cardReference?: string;
  public transferReference?: string;
  public saleDate!: Date;
  // Nuevos campos para sistema de turismo
  public saleType!: 'GUIDE' | 'STREET';
  public agencyId?: string;
  public guideId?: string;
  public employeeId?: string;
  public branchId?: string;
  public agencyCommission?: number;
  public guideCommission?: number;
  public employeeCommission?: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public Client?: any;
  public User?: any;
  public SaleItems?: any[];
  public items?: any[];
  public Agency?: any;
  public Guide?: any;
  public Employee?: any;
  public Branch?: any;

  // Instance methods
  public calculateTotals(): void {
    this.total = this.subtotal + this.taxAmount - this.discountAmount;
  }

  public applyDiscount(amount: number): void {
    this.discountAmount = amount;
    this.calculateTotals();
  }

  public applyTax(rate: number): void {
    this.taxAmount = this.subtotal * (rate / 100);
    this.calculateTotals();
  }

  public canBeCancelled(): boolean {
    return this.status === 'pending' || this.status === 'completed';
  }

  public canBeRefunded(): boolean {
    return this.status === 'completed';
  }

  // Métodos para calcular comisiones
  public async calculateCommissions(): Promise<{
    agencyCommission: number;
    guideCommission: number;
    employeeCommission: number;
  }> {
    let agencyCommission = 0;
    let guideCommission = 0;
    let employeeCommission = 0;

    if (this.saleType === 'GUIDE' && this.agencyId && this.guideId && this.employeeId) {
      // Calcular comisiones para venta con guía
      const Agency = sequelize.models.Agency;
      const Guide = sequelize.models.Guide;
      const Employee = sequelize.models.Employee;

      const agency = await Agency.findByPk(this.agencyId);
      const guide = await Guide.findByPk(this.guideId);
      const employee = await Employee.findByPk(this.employeeId);

      if (agency && guide && employee) {
        agencyCommission = this.total * ((agency as any).commissionRate / 100);
        guideCommission = (guide as any).calculateCommission(this.total);
        employeeCommission = (employee as any).calculateCommission(this.total, 'GUIDE');
      }
    } else if (this.saleType === 'STREET' && this.employeeId) {
      // Calcular comisión para venta de calle
      const Employee = sequelize.models.Employee;
      const employee = await Employee.findByPk(this.employeeId);

      if (employee) {
        const commissionType = this.paymentMethod === 'card' ? 'STREET_CARD' : 'STREET_CASH';
        employeeCommission = (employee as any).calculateCommission(this.total, commissionType);
      }
    }

    // Actualizar las propiedades de la instancia
    this.agencyCommission = agencyCommission;
    this.guideCommission = guideCommission;
    this.employeeCommission = employeeCommission;

    return {
      agencyCommission,
      guideCommission,
      employeeCommission,
    };
  }

  public getTotalCommissions(): number {
    return (this.agencyCommission || 0) + (this.guideCommission || 0) + (this.employeeCommission || 0);
  }

  // Static methods
  public static generateSaleNumber(): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const time = now.getTime().toString().slice(-6);
    
    return `VT${year}${month}${day}${time}`;
  }
}

// Inicializar el modelo Sale directamente
Sale.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    saleNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },
    clientId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'clients',
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
    subtotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    taxAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
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
    paymentMethod: {
      type: DataTypes.ENUM('cash', 'card', 'transfer', 'mixed'),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'cancelled', 'refunded'),
      allowNull: false,
      defaultValue: 'pending',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cardReference: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    transferReference: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    saleDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    // Nuevos campos para sistema de turismo
    saleType: {
      type: DataTypes.ENUM('GUIDE', 'STREET'),
      allowNull: false,
      defaultValue: 'STREET',
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'agencies',
        key: 'id',
      },
    },
    guideId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'guides',
        key: 'id',
      },
    },
    employeeId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'employees',
        key: 'id',
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
    agencyCommission: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    guideCommission: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    employeeCommission: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
  },
  {
    indexes: [
      {
        unique: true,
        fields: ['saleNumber'],
      },
      {
        fields: ['clientId'],
      },
      {
        fields: ['userId'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['paymentMethod'],
      },
      {
        fields: ['saleDate'],
      },
      {
        fields: ['total'],
      },
      {
        fields: ['saleType'],
      },
      {
        fields: ['agencyId'],
      },
      {
        fields: ['guideId'],
      },
      {
        fields: ['employeeId'],
      },
      {
        fields: ['branchId'],
      },
    ],
    hooks: {
      beforeCreate: (sale: Sale) => {
        if (!sale.saleNumber) {
          sale.saleNumber = Sale.generateSaleNumber();
        }
        sale.calculateTotals();
      },
      beforeUpdate: (sale: Sale) => {
        if (sale.changed('subtotal') || sale.changed('taxAmount') || sale.changed('discountAmount')) {
          sale.calculateTotals();
        }
      },
    },
    sequelize,
    modelName: 'Sale',
    tableName: 'sales',
    timestamps: true,
  });

// Función de compatibilidad para inicialización
export function initializeSale(sequelizeInstance: any) {
  return Sale;
}

export { Sale };
export type { SaleAttributes, SaleCreationAttributes };
export default Sale;
