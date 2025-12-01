import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/config';

export type MovementType = 'INGRESO' | 'VENTA' | 'AJUSTE' | 'TRANSFERENCIA_ENTRADA' | 'TRANSFERENCIA_SALIDA';
export type ReferenceType = 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'TRANSFER';

interface StockLedgerAttributes {
  id: string;
  productId: string;
  branchId?: string | null;
  movementType: MovementType;
  quantityChange: number;
  unitCost?: number | null;
  referenceType?: ReferenceType | null;
  referenceId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface StockLedgerCreationAttributes
  extends Optional<StockLedgerAttributes, 'id' | 'branchId' | 'unitCost' | 'referenceType' | 'referenceId' | 'createdAt' | 'updatedAt'> {}

class StockLedger extends Model<StockLedgerAttributes, StockLedgerCreationAttributes> implements StockLedgerAttributes {
  public id!: string;
  public productId!: string;
  public branchId?: string | null;
  public movementType!: MovementType;
  public quantityChange!: number;
  public unitCost?: number | null;
  public referenceType?: ReferenceType | null;
  public referenceId?: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function initializeStockLedger(sequelizeInstance: any) {
  StockLedger.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      productId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      branchId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      movementType: {
        type: DataTypes.ENUM('INGRESO', 'VENTA', 'AJUSTE', 'TRANSFERENCIA_ENTRADA', 'TRANSFERENCIA_SALIDA'),
        allowNull: false,
      },
      quantityChange: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      unitCost: {
        type: DataTypes.DECIMAL(12, 4),
        allowNull: true,
      },
      referenceType: {
        type: DataTypes.ENUM('SALE', 'PURCHASE', 'ADJUSTMENT', 'TRANSFER'),
        allowNull: true,
      },
      referenceId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      sequelize: sequelizeInstance || sequelize,
      modelName: 'StockLedger',
      tableName: 'stock_ledger',
      timestamps: true,
      indexes: [
        { fields: ['productId'] },
        { fields: ['branchId'] },
        { fields: ['createdAt'] },
        { fields: ['referenceType', 'referenceId'] },
      ],
    }
  );

  return StockLedger;
}

export type { StockLedgerAttributes, StockLedgerCreationAttributes };
export { StockLedger };
export default StockLedger;

