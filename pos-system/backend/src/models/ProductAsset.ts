import { DataTypes, Model, Optional } from 'sequelize'
import { sequelize } from '../db/config'
import { Product } from './Product'

interface ProductAssetAttributes {
  id: string
  productId: string
  serial: string
  status: 'available' | 'reserved' | 'sold' | 'service'
  hallmark?: string
  condition?: string
  location?: string
  qrPayload?: string
  rfidEpc?: string
  metadata?: any
  createdAt?: Date
  updatedAt?: Date
}

interface ProductAssetCreationAttributes
  extends Optional<ProductAssetAttributes, 'id' | 'hallmark' | 'condition' | 'location' | 'qrPayload' | 'metadata' | 'createdAt' | 'updatedAt'> {}

class ProductAsset extends Model<ProductAssetAttributes, ProductAssetCreationAttributes> implements ProductAssetAttributes {
  public id!: string
  public productId!: string
  public serial!: string
  public status!: 'available' | 'reserved' | 'sold' | 'service'
  public hallmark?: string
  public condition?: string
  public location?: string
  public qrPayload?: string
  public rfidEpc?: string
  public metadata?: any
  public readonly createdAt!: Date
  public readonly updatedAt!: Date
}

export function initializeProductAsset(sequelizeInstance: any) {
  ProductAsset.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      productId: { type: DataTypes.UUID, allowNull: false },
      serial: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      status: { type: DataTypes.ENUM('available', 'reserved', 'sold', 'service'), allowNull: false, defaultValue: 'available' },
      hallmark: { type: DataTypes.STRING(50), allowNull: true },
      condition: { type: DataTypes.STRING(50), allowNull: true },
      location: { type: DataTypes.STRING(100), allowNull: true },
      qrPayload: { type: DataTypes.TEXT, allowNull: true },
      rfidEpc: { type: DataTypes.STRING(128), allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
    },
    {
      sequelize: sequelizeInstance || sequelize,
      modelName: 'ProductAsset',
      tableName: 'product_assets',
      timestamps: true,
      indexes: [
        { unique: true, fields: ['serial'] },
        { fields: ['productId'] },
        { fields: ['status'] },
        { fields: ['rfidEpc'] },
      ],
    }
  )

  ProductAsset.belongsTo(Product, { foreignKey: 'productId', as: 'product' })
  Product.hasMany(ProductAsset, { foreignKey: 'productId', as: 'assets' })

  return ProductAsset
}

export type { ProductAssetAttributes, ProductAssetCreationAttributes }
export { ProductAsset }
export default ProductAsset
