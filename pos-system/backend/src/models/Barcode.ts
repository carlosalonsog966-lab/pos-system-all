import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/config';

interface BarcodeAttributes {
  id: string;
  code: string; // El código de barras único
  type: 'GUIDE' | 'EMPLOYEE'; // Tipo de código
  entityId: string; // ID del guía o empleado
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface BarcodeCreationAttributes extends Optional<BarcodeAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class Barcode extends Model<BarcodeAttributes, BarcodeCreationAttributes> implements BarcodeAttributes {
  public id!: string;
  public code!: string;
  public type!: 'GUIDE' | 'EMPLOYEE';
  public entityId!: string;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public Guide?: any;
  public Employee?: any;

  // Static methods
  public static generateGuideBarcode(agencyCode: string, guideSequence: number): string {
    const paddedSequence = guideSequence.toString().padStart(3, '0');
    return `GUI-${agencyCode}-${paddedSequence}`;
  }

  public static generateEmployeeBarcode(branchCode: string, employeeSequence: number): string {
    const paddedSequence = employeeSequence.toString().padStart(3, '0');
    return `VEN-${branchCode}-${paddedSequence}`;
  }

  // Instance methods
  public async getEntity(): Promise<any> {
    if (this.type === 'GUIDE') {
      const Guide = sequelize.models.Guide;
      return await Guide.findByPk(this.entityId);
    } else if (this.type === 'EMPLOYEE') {
      const Employee = sequelize.models.Employee;
      return await Employee.findByPk(this.entityId);
    }
    return null;
  }
}

Barcode.init(
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
        len: [5, 50],
      },
      comment: 'Código de barras único (ej: GUI-AG001-001, VEN-SUC1-001)',
    },
    type: {
      type: DataTypes.ENUM('GUIDE', 'EMPLOYEE'),
      allowNull: false,
    },
    entityId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'ID del guía o empleado asociado',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'Barcode',
    tableName: 'barcodes',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['code'],
      },
      {
        fields: ['type'],
      },
      {
        fields: ['entityId'],
      },
      {
        fields: ['isActive'],
      },
      {
        unique: true,
        fields: ['type', 'entityId'],
        name: 'unique_type_entity',
      },
    ],
  }
);

export default Barcode;