import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/config';

export type JobStatus = 'queued' | 'processing' | 'failed' | 'completed';

interface JobQueueAttributes {
  id: string;
  type: string;
  status: JobStatus;
  payload?: any;
  attempts: number;
  maxAttempts: number;
  scheduledAt?: Date | null;
  availableAt?: Date | null;
  lockedAt?: Date | null;
  error?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface JobQueueCreationAttributes
  extends Optional<JobQueueAttributes, 'id' | 'status' | 'payload' | 'attempts' | 'maxAttempts' | 'scheduledAt' | 'availableAt' | 'lockedAt' | 'error' | 'createdAt' | 'updatedAt'> {}

class JobQueue extends Model<JobQueueAttributes, JobQueueCreationAttributes> implements JobQueueAttributes {
  public id!: string;
  public type!: string;
  public status!: JobStatus;
  public payload?: any;
  public attempts!: number;
  public maxAttempts!: number;
  public scheduledAt?: Date | null;
  public availableAt?: Date | null;
  public lockedAt?: Date | null;
  public error?: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function initializeJobQueue(sequelizeInstance: any) {
  JobQueue.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      type: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('queued', 'processing', 'failed', 'completed'),
        allowNull: false,
        defaultValue: 'queued',
      },
      payload: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      maxAttempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5,
      },
      scheduledAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      availableAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      lockedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      error: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize: sequelizeInstance || sequelize,
      modelName: 'JobQueue',
      tableName: 'job_queue',
      timestamps: true,
      indexes: [
        { fields: ['status'] },
        { fields: ['type'] },
        { fields: ['availableAt'] },
        { fields: ['scheduledAt'] },
      ],
    }
  );

  return JobQueue;
}

export type { JobQueueAttributes, JobQueueCreationAttributes };
export { JobQueue };
export default JobQueue;

