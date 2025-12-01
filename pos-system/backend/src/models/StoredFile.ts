import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/config';

interface StoredFileAttributes {
  id: string;
  filename: string;
  mimeType?: string;
  size?: number;
  checksum: string;
  storage?: 'local' | 'memory' | 's3';
  path: string;
  entityType?: string;
  entityId?: string;
  metadata?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

interface StoredFileCreationAttributes
  extends Optional<StoredFileAttributes, 'id' | 'mimeType' | 'size' | 'storage' | 'entityType' | 'entityId' | 'metadata' | 'createdAt' | 'updatedAt'> {}

class StoredFile extends Model<StoredFileAttributes, StoredFileCreationAttributes> implements StoredFileAttributes {
  public id!: string;
  public filename!: string;
  public mimeType?: string;
  public size?: number;
  public checksum!: string;
  public storage?: 'local' | 'memory' | 's3';
  public path!: string;
  public entityType?: string;
  public entityId?: string;
  public metadata?: any;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function initializeStoredFile(sequelizeInstance: any) {
  StoredFile.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      filename: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      mimeType: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      size: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      checksum: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      storage: {
        type: DataTypes.ENUM('local', 'memory', 's3'),
        allowNull: false,
        defaultValue: 'local',
      },
      path: {
        type: DataTypes.STRING(500),
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
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      sequelize: sequelizeInstance || sequelize,
      modelName: 'StoredFile',
      tableName: 'files',
      timestamps: true,
      indexes: [
        { unique: true, fields: ['checksum'] },
        { fields: ['filename'] },
        { fields: ['entityType', 'entityId'] },
        { fields: ['createdAt'] },
      ],
    }
  );

  return StoredFile;
}

export type { StoredFileAttributes, StoredFileCreationAttributes };
export { StoredFile };
export default StoredFile;

