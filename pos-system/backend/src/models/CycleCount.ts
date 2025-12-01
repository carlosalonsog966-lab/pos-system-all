import { DataTypes, Model, Optional } from 'sequelize'
import { sequelize } from '../db/config'

type CycleCountType = 'cyclic' | 'general'
type CycleCountStatus = 'pending' | 'in_progress' | 'completed' | 'canceled'

interface CycleCountAttributes {
  id: string
  branchId?: string | null
  type: CycleCountType
  status: CycleCountStatus
  createdBy: string
  startedAt?: Date | null
  completedAt?: Date | null
  tolerancePct?: number | null
  note?: string | null
  createdAt?: Date
  updatedAt?: Date
}

interface CycleCountCreationAttributes extends Optional<CycleCountAttributes, 'id' | 'branchId' | 'startedAt' | 'completedAt' | 'tolerancePct' | 'note' | 'createdAt' | 'updatedAt'> {}

class CycleCount extends Model<CycleCountAttributes, CycleCountCreationAttributes> implements CycleCountAttributes {
  public id!: string
  public branchId?: string | null
  public type!: CycleCountType
  public status!: CycleCountStatus
  public createdBy!: string
  public startedAt?: Date | null
  public completedAt?: Date | null
  public tolerancePct?: number | null
  public note?: string | null
  public readonly createdAt!: Date
  public readonly updatedAt!: Date
}

export function initializeCycleCount(sequelizeInstance: any) {
  CycleCount.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      branchId: { type: DataTypes.UUID, allowNull: true },
      type: { type: DataTypes.ENUM('cyclic', 'general'), allowNull: false },
      status: { type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'canceled'), allowNull: false, defaultValue: 'pending' },
      createdBy: { type: DataTypes.UUID, allowNull: false },
      startedAt: { type: DataTypes.DATE, allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: true },
      tolerancePct: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      note: { type: DataTypes.STRING(1000), allowNull: true },
    },
    {
      sequelize: sequelizeInstance || sequelize,
      modelName: 'CycleCount',
      tableName: 'cycle_counts',
      timestamps: true,
      indexes: [
        { fields: ['branchId'] },
        { fields: ['status'] },
        { fields: ['createdAt'] },
      ],
    }
  )

  return CycleCount
}

export type { CycleCountAttributes, CycleCountCreationAttributes }
export { CycleCount }
export default CycleCount
