import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/config';

export type PresetScope = 'user' | 'global';

interface FilterPresetAttributes {
  id: string;
  name: string;
  area: string; // e.g., 'inventory'
  scope: PresetScope;
  userId?: string | null; // required when scope='user'
  payload: any; // JSON object
  isDefault: boolean; // if scope='user', default for that user+area; if 'global', default global for area
  createdAt?: Date;
  updatedAt?: Date;
}

interface FilterPresetCreationAttributes extends Optional<FilterPresetAttributes, 'id' | 'userId' | 'isDefault' | 'createdAt' | 'updatedAt'> {}

class FilterPreset extends Model<FilterPresetAttributes, FilterPresetCreationAttributes> implements FilterPresetAttributes {
  public id!: string;
  public name!: string;
  public area!: string;
  public scope!: PresetScope;
  public userId?: string | null;
  public payload!: any;
  public isDefault!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function initializeFilterPreset() {
  FilterPreset.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      area: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      scope: {
        type: DataTypes.ENUM('user', 'global'),
        allowNull: false,
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      payload: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      isDefault: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: 'FilterPreset',
      tableName: 'filter_presets',
      timestamps: true,
      indexes: [
        { fields: ['area'] },
        { fields: ['scope'] },
        { fields: ['userId'] },
        { unique: false, fields: ['area', 'scope'] },
      ],
    }
  );

  return FilterPreset;
}

export default FilterPreset;

