import { DataTypes, Model, Optional } from 'sequelize'
import { sequelize } from '../db/config'
import ProductAsset from './ProductAsset'

export type CertificationType = 'GIA' | 'IGI' | 'HRD' | 'Other'

interface CertificationAttributes {
  id: string
  productAssetId: string
  type: CertificationType
  authority: string
  certificateNumber: string
  issueDate: Date
  expiryDate?: Date | null
  metadata?: any
  createdAt?: Date
  updatedAt?: Date
}

interface CertificationCreationAttributes
  extends Optional<CertificationAttributes, 'id' | 'expiryDate' | 'metadata' | 'createdAt' | 'updatedAt'> {}

class Certification extends Model<CertificationAttributes, CertificationCreationAttributes> implements CertificationAttributes {
  public id!: string
  public productAssetId!: string
  public type!: CertificationType
  public authority!: string
  public certificateNumber!: string
  public issueDate!: Date
  public expiryDate?: Date | null
  public metadata?: any
  public readonly createdAt!: Date
  public readonly updatedAt!: Date
}

export function initializeCertification(sequelizeInstance: any) {
  Certification.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      productAssetId: { type: DataTypes.UUID, allowNull: false },
      type: { type: DataTypes.ENUM('GIA', 'IGI', 'HRD', 'Other'), allowNull: false },
      authority: { type: DataTypes.STRING(100), allowNull: false },
      certificateNumber: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      issueDate: { type: DataTypes.DATE, allowNull: false },
      expiryDate: { type: DataTypes.DATE, allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
    },
    {
      sequelize: sequelizeInstance || sequelize,
      modelName: 'Certification',
      tableName: 'certifications',
      timestamps: true,
      indexes: [
        { unique: true, fields: ['certificateNumber'] },
        { fields: ['productAssetId'] },
        { fields: ['type'] },
      ],
    }
  )

  Certification.belongsTo(ProductAsset, { foreignKey: 'productAssetId', as: 'asset' })
  ProductAsset.hasMany(Certification, { foreignKey: 'productAssetId', as: 'certifications' })

  return Certification
}

export type { CertificationAttributes, CertificationCreationAttributes }
export { Certification }
export default Certification

