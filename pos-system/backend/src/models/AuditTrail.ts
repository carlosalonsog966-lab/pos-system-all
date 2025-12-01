import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/config';

export type AuditResult = 'success' | 'failure' | 'partial';

interface AuditTrailAttributes {
  id: string;
  operation: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  actorRole?: string;
  result: AuditResult;
  message?: string;
  details?: any;
  correlationId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AuditTrailCreationAttributes
  extends Optional<AuditTrailAttributes, 'id' | 'entityType' | 'entityId' | 'actorId' | 'actorRole' | 'message' | 'details' | 'correlationId' | 'createdAt' | 'updatedAt'> {}

class AuditTrail extends Model<AuditTrailAttributes, AuditTrailCreationAttributes> implements AuditTrailAttributes {
  public id!: string;
  public operation!: string;
  public entityType?: string;
  public entityId?: string;
  public actorId?: string;
  public actorRole?: string;
  public result!: AuditResult;
  public message?: string;
  public details?: any;
  public correlationId?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function initializeAuditTrail(sequelizeInstance: any) {
  AuditTrail.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      operation: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      entityType: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      entityId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      actorId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      actorRole: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      result: {
        type: DataTypes.ENUM('success', 'failure', 'partial'),
        allowNull: false,
        defaultValue: 'success',
      },
      message: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      details: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      correlationId: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
    },
    {
      sequelize: sequelizeInstance || sequelize,
      modelName: 'AuditTrail',
      tableName: 'audit_trail',
      timestamps: true,
      indexes: [
        { fields: ['operation'] },
        { fields: ['entityType', 'entityId'] },
        { fields: ['actorId'] },
        { fields: ['createdAt'] },
      ],
    }
  );

  return AuditTrail;
}

export type { AuditTrailAttributes, AuditTrailCreationAttributes };
export { AuditTrail };
export default AuditTrail;

