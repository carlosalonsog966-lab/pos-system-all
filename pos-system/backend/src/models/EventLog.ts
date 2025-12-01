import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/config';

export type EventType =
  | 'HEALTH_CHECK'
  | 'RATE_LIMIT'
  | 'ERROR'
  | 'USER_ACTION'
  | 'DATA_CHANGE'
  | 'SYSTEM'
  | 'HEALTH_METRICS';

export type EventSeverity = 'info' | 'warning' | 'error';

interface EventLogAttributes {
  id: string;
  type: EventType;
  severity: EventSeverity;
  message: string;
  context?: string;
  correlationId?: string;
  userId?: string;
  details?: any; // JSON payload with extra info
  createdAt?: Date;
  updatedAt?: Date;
}

interface EventLogCreationAttributes
  extends Optional<EventLogAttributes, 'id' | 'context' | 'userId' | 'details' | 'createdAt' | 'updatedAt'> {}

class EventLog
  extends Model<EventLogAttributes, EventLogCreationAttributes>
  implements EventLogAttributes {
  public id!: string;
  public type!: EventType;
  public severity!: EventSeverity;
  public message!: string;
  public context?: string;
  public correlationId?: string;
  public userId?: string;
  public details?: any;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EventLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    type: {
      type: DataTypes.ENUM('HEALTH_CHECK', 'RATE_LIMIT', 'ERROR', 'USER_ACTION', 'DATA_CHANGE', 'SYSTEM', 'HEALTH_METRICS'),
      allowNull: false,
    },
    severity: {
      type: DataTypes.ENUM('info', 'warning', 'error'),
      allowNull: false,
      defaultValue: 'info',
    },
    message: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    context: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    correlationId: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    details: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'EventLog',
    tableName: 'event_logs',
    timestamps: true,
    indexes: [
      { fields: ['correlationId'] },
      { fields: ['type'] },
      { fields: ['severity'] },
      { fields: ['createdAt'] },
    ],
  }
);

export function initializeEventLog() {
  return EventLog;
}

export { EventLog };
export type { EventLogAttributes, EventLogCreationAttributes };
export default EventLog;



