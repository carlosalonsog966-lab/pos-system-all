import { DataTypes, Model, Optional } from 'sequelize'
import { sequelize } from '../db/config'
import ProductAsset from './ProductAsset'
import Sale from './Sale'

export type WarrantyStatus = 'active' | 'expired' | 'void' | 'service'

interface WarrantyAttributes {
  id: string
  productAssetId: string
  saleId?: string | null
  startDate: Date
  months: number
  status: WarrantyStatus
  terms?: string
  metadata?: any
  createdAt?: Date
  updatedAt?: Date
}

interface WarrantyCreationAttributes
  extends Optional<WarrantyAttributes, 'id' | 'saleId' | 'terms' | 'metadata' | 'createdAt' | 'updatedAt'> {}

class Warranty extends Model<WarrantyAttributes, WarrantyCreationAttributes> implements WarrantyAttributes {
  public id!: string
  public productAssetId!: string
  public saleId?: string | null
  public startDate!: Date
  public months!: number
  public status!: WarrantyStatus
  public terms?: string
  public metadata?: any
  public readonly createdAt!: Date
  public readonly updatedAt!: Date
}

export function initializeWarranty(sequelizeInstance: any) {
  Warranty.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      productAssetId: { type: DataTypes.UUID, allowNull: false },
      saleId: { type: DataTypes.UUID, allowNull: true },
      startDate: { type: DataTypes.DATE, allowNull: false },
      months: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 12, validate: { min: 0 } },
      status: { type: DataTypes.ENUM('active','expired','void','service'), allowNull: false, defaultValue: 'active' },
      terms: { type: DataTypes.TEXT, allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
    },
    {
      sequelize: sequelizeInstance || sequelize,
      modelName: 'Warranty',
      tableName: 'warranties',
      timestamps: true,
      indexes: [
        { fields: ['productAssetId'] },
        { fields: ['saleId'] },
        { fields: ['status'] },
      ],
    }
  )

  Warranty.belongsTo(ProductAsset, { foreignKey: 'productAssetId', as: 'asset' })
  ProductAsset.hasMany(Warranty, { foreignKey: 'productAssetId', as: 'warranties' })
  Warranty.belongsTo(Sale, { foreignKey: 'saleId', as: 'sale' })

  return Warranty
}

export type { WarrantyAttributes, WarrantyCreationAttributes }
export { Warranty }
export default Warranty

