import { DataTypes, Model, Optional } from 'sequelize'
import { sequelize } from '../db/config'

interface CycleCountItemAttributes {
  id: string
  cycleCountId: string
  productId?: string | null
  productAssetId?: string | null
  expectedQty: number
  countedQty: number
  difference: number
  location?: string | null
  countedBy?: string | null
  resolved: boolean
  reason?: string | null
  createdAt?: Date
  updatedAt?: Date
}

interface CycleCountItemCreationAttributes extends Optional<CycleCountItemAttributes, 'id' | 'productId' | 'productAssetId' | 'location' | 'countedBy' | 'reason' | 'createdAt' | 'updatedAt'> {}

class CycleCountItem extends Model<CycleCountItemAttributes, CycleCountItemCreationAttributes> implements CycleCountItemAttributes {
  public id!: string
  public cycleCountId!: string
  public productId?: string | null
  public productAssetId?: string | null
  public expectedQty!: number
  public countedQty!: number
  public difference!: number
  public location?: string | null
  public countedBy?: string | null
  public resolved!: boolean
  public reason?: string | null
  public readonly createdAt!: Date
  public readonly updatedAt!: Date
}

export function initializeCycleCountItem(sequelizeInstance: any) {
  CycleCountItem.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      cycleCountId: { type: DataTypes.UUID, allowNull: false },
      productId: { type: DataTypes.UUID, allowNull: true },
      productAssetId: { type: DataTypes.UUID, allowNull: true },
      expectedQty: { type: DataTypes.INTEGER, allowNull: false },
      countedQty: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      difference: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      location: { type: DataTypes.STRING(200), allowNull: true },
      countedBy: { type: DataTypes.UUID, allowNull: true },
      resolved: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      reason: { type: DataTypes.STRING(500), allowNull: true },
    },
    {
      sequelize: sequelizeInstance || sequelize,
      modelName: 'CycleCountItem',
      tableName: 'cycle_count_items',
      timestamps: true,
      indexes: [
        { fields: ['cycleCountId'] },
        { fields: ['productId'] },
        { fields: ['productAssetId'] },
      ],
    }
  )

  return CycleCountItem
}

export type { CycleCountItemAttributes, CycleCountItemCreationAttributes }
export { CycleCountItem }
export default CycleCountItem
