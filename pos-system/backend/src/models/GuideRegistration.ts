import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/config';
import Guide from './Guide';
import Employee from './Employee';
import Branch from './Branch';

export interface GuideRegistrationAttributes {
  id: string;
  guideId: string;
  employeeId?: string;
  branchId?: string;
  registrationDate: Date;
  peopleCount: number;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GuideRegistrationCreationAttributes 
  extends Optional<GuideRegistrationAttributes, 'id' | 'createdAt' | 'updatedAt' | 'isActive'> {}

export class GuideRegistration extends Model<GuideRegistrationAttributes, GuideRegistrationCreationAttributes> 
  implements GuideRegistrationAttributes {
  public id!: string;
  public guideId!: string;
  public employeeId?: string;
  public branchId?: string;
  public registrationDate!: Date;
  public peopleCount!: number;
  public notes?: string;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Asociaciones
  public readonly guide?: Guide;
  public readonly employee?: Employee;
  public readonly branch?: Branch;
}

GuideRegistration.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    guideId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Guide,
        key: 'id',
      },
    },
    employeeId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: Employee,
        key: 'id',
      },
    },
    branchId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: Branch,
        key: 'id',
      },
    },
    registrationDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    peopleCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 1000,
      },
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'guide_registrations',
    timestamps: true,
    indexes: [
      {
        fields: ['guideId'],
      },
      {
        fields: ['employeeId'],
      },
      {
        fields: ['branchId'],
      },
      {
        fields: ['registrationDate'],
      },
      {
        fields: ['isActive'],
      },
    ],
  }
);

// Definir asociaciones
GuideRegistration.belongsTo(Guide, {
  foreignKey: 'guideId',
  as: 'guide',
});

GuideRegistration.belongsTo(Employee, {
  foreignKey: 'employeeId',
  as: 'employee',
});

GuideRegistration.belongsTo(Branch, {
  foreignKey: 'branchId',
  as: 'branch',
});

// Asociaciones inversas
Guide.hasMany(GuideRegistration, {
  foreignKey: 'guideId',
  as: 'registrations',
});

Employee.hasMany(GuideRegistration, {
  foreignKey: 'employeeId',
  as: 'guideRegistrations',
});

Branch.hasMany(GuideRegistration, {
  foreignKey: 'branchId',
  as: 'guideRegistrations',
});

