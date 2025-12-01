import { DataTypes, Model, Optional } from 'sequelize'
import { sequelize } from '../db/config'
import ProductAsset from './ProductAsset'

interface AppraisalAttributes {
  id: string
  productAssetId: string
  appraiser: string
  appraisalDate: Date
  value: number
  currency: string
  notes?: string
  metadata?: any
  createdAt?: Date
  updatedAt?: Date
}

interface AppraisalCreationAttributes
  extends Optional<AppraisalAttributes, 'id' | 'notes' | 'metadata' | 'createdAt' | 'updatedAt'> {}

class Appraisal extends Model<AppraisalAttributes, AppraisalCreationAttributes> implements AppraisalAttributes {
  public id!: string
  public productAssetId!: string
  public appraiser!: string
  public appraisalDate!: Date
  public value!: number
  public currency!: string
  public notes?: string
  public metadata?: any
  public readonly createdAt!: Date
  public readonly updatedAt!: Date
}

export function initializeAppraisal(sequelizeInstance: any) {
  Appraisal.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      productAssetId: { type: DataTypes.UUID, allowNull: false },
      appraiser: { type: DataTypes.STRING(120), allowNull: false },
      appraisalDate: { type: DataTypes.DATE, allowNull: false },
      value: { type: DataTypes.DECIMAL(12,2), allowNull: false, validate: { min: 0 } },
      currency: { type: DataTypes.STRING(3), allowNull: false },
      notes: { type: DataTypes.TEXT, allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
    },
    {
      sequelize: sequelizeInstance || sequelize,
      modelName: 'Appraisal',
      tableName: 'appraisals',
      timestamps: true,
      indexes: [
        { fields: ['productAssetId'] },
        { fields: ['appraisalDate'] },
      ],
    }
  )

  Appraisal.belongsTo(ProductAsset, { foreignKey: 'productAssetId', as: 'asset' })
  ProductAsset.hasMany(Appraisal, { foreignKey: 'productAssetId', as: 'appraisals' })

  return Appraisal
}

export type { AppraisalAttributes, AppraisalCreationAttributes }
export { Appraisal }
export default Appraisal

