import { DataTypes, Model, Optional } from 'sequelize'
import { sequelize } from '../db/config'

type TransferStatus = 'requested' | 'shipped' | 'received' | 'canceled'

interface StockTransferAttributes {
  id: string
  productId: string
  quantity: number
  fromBranchId: string
  toBranchId: string
  status: TransferStatus
  requestedBy: string
  shippedBy?: string | null
  receivedBy?: string | null
  reference?: string | null
  idempotencyKey?: string | null
  createdAt?: Date
  updatedAt?: Date
}

interface StockTransferCreationAttributes extends Optional<StockTransferAttributes, 'id' | 'status' | 'shippedBy' | 'receivedBy' | 'reference' | 'idempotencyKey' | 'createdAt' | 'updatedAt'> {}

class StockTransfer extends Model<StockTransferAttributes, StockTransferCreationAttributes> implements StockTransferAttributes {
  public id!: string
  public productId!: string
  public quantity!: number
  public fromBranchId!: string
  public toBranchId!: string
  public status!: TransferStatus
  public requestedBy!: string
  public shippedBy?: string | null
  public receivedBy?: string | null
  public reference?: string | null
  public idempotencyKey?: string | null
  public readonly createdAt!: Date
  public readonly updatedAt!: Date
}

export function initializeStockTransfer(sequelizeInstance: any) {
  StockTransfer.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      productId: { type: DataTypes.UUID, allowNull: false },
      quantity: { type: DataTypes.INTEGER, allowNull: false },
      fromBranchId: { type: DataTypes.UUID, allowNull: false },
      toBranchId: { type: DataTypes.UUID, allowNull: false },
      status: { type: DataTypes.ENUM('requested', 'shipped', 'received', 'canceled'), allowNull: false, defaultValue: 'requested' },
      requestedBy: { type: DataTypes.UUID, allowNull: false },
      shippedBy: { type: DataTypes.UUID, allowNull: true },
      receivedBy: { type: DataTypes.UUID, allowNull: true },
      reference: { type: DataTypes.STRING(200), allowNull: true },
      idempotencyKey: { type: DataTypes.STRING(100), allowNull: true },
    },
    {
      sequelize: sequelizeInstance || sequelize,
      modelName: 'StockTransfer',
      tableName: 'stock_transfers',
      timestamps: true,
      indexes: [
        { fields: ['productId'] },
        { fields: ['fromBranchId'] },
        { fields: ['toBranchId'] },
        { fields: ['status'] },
        { fields: ['createdAt'] },
      ],
    }
  )

  return StockTransfer
}

export type { StockTransferAttributes, StockTransferCreationAttributes }
export { StockTransfer }
export default StockTransfer
