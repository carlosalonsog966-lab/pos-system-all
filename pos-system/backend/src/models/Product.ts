import { DataTypes, Model, Optional, Op } from 'sequelize';
import { sequelize } from '../db/config';

interface ProductAttributes {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: 'Anillos' | 'Alianzas' | 'Cadenas' | 'Collares' | 'Pulseras' | 'Aretes' | 'Pendientes' | 'Broches' | 'Relojes' | 'Gemelos' | 'Dijes' | 'Charms' | 'Otros';
  material: 'Oro' | 'Plata' | 'Platino' | 'Paladio' | 'Acero' | 'Titanio' | 'Diamante' | 'Esmeralda' | 'Rubí' | 'Zafiro' | 'Perla' | 'Otros';
  weight?: number; // in grams
  purity?: string; // e.g., "18K", "925", "PT950"
  size?: string;
  color?: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  isActive: boolean;
  imageUrl?: string;
  barcode?: string;
  supplier?: string;
  // Nuevos campos de joyería
  brand?: string;
  metal?: string;
  metalPurity?: string;
  grams?: number;
  ringSize?: string;
  chainLengthCm?: number;
  stoneType?: string;
  stoneColor?: string;
  stoneCut?: string;
  stoneClarity?: string;
  stoneCarat?: number;
  finish?: string;
  plating?: string;
  hallmark?: string;
  collection?: string;
  gender?: 'hombre' | 'mujer' | 'unisex' | 'niño' | 'niña';
  isUniquePiece: boolean;
  warrantyMonths: number;
  metadata?: any;
  version: number;
  lastStockUpdate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ProductCreationAttributes extends Optional<ProductAttributes, 'id' | 'description' | 'weight' | 'purity' | 'size' | 'color' | 'isActive' | 'imageUrl' | 'barcode' | 'supplier' | 'metal' | 'metalPurity' | 'grams' | 'ringSize' | 'chainLengthCm' | 'stoneType' | 'stoneColor' | 'stoneCut' | 'stoneCarat' | 'finish' | 'plating' | 'hallmark' | 'collection' | 'gender' | 'isUniquePiece' | 'warrantyMonths' | 'metadata' | 'version' | 'lastStockUpdate' | 'createdAt' | 'updatedAt'> {}

class Product extends Model<ProductAttributes, ProductCreationAttributes> implements ProductAttributes {
  public id!: string;
  public code!: string;
  public name!: string;
  public description?: string;
  public category!: 'Anillos' | 'Alianzas' | 'Cadenas' | 'Collares' | 'Pulseras' | 'Aretes' | 'Pendientes' | 'Broches' | 'Relojes' | 'Gemelos' | 'Dijes' | 'Charms' | 'Otros';
  public material!: 'Oro' | 'Plata' | 'Platino' | 'Paladio' | 'Acero' | 'Titanio' | 'Diamante' | 'Esmeralda' | 'Rubí' | 'Zafiro' | 'Perla' | 'Otros';
  public weight?: number;
  public purity?: string;
  public size?: string;
  public color?: string;
  public purchasePrice!: number;
  public salePrice!: number;
  public stock!: number;
  public minStock!: number;
  public isActive!: boolean;
  public imageUrl?: string;
  public barcode?: string;
  public supplier?: string;
  // Nuevos campos de joyería
  public brand?: string;
  public metal?: string;
  public metalPurity?: string;
  public grams?: number;
  public ringSize?: string;
  public chainLengthCm?: number;
  public stoneType?: string;
  public stoneColor?: string;
  public stoneCut?: string;
  public stoneClarity?: string;
  public stoneCarat?: number;
  public finish?: string;
  public plating?: string;
  public hallmark?: string;
  public collection?: string;
  public gender?: 'hombre' | 'mujer' | 'unisex' | 'niño' | 'niña';
  public isUniquePiece!: boolean;
  public warrantyMonths!: number;
  public metadata?: any;
  public version!: number;
  public lastStockUpdate?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Instance methods
  public isLowStock(): boolean {
    return this.stock <= this.minStock;
  }

  public getMargin(): number {
    return this.salePrice - this.purchasePrice;
  }

  public getMarginPercentage(): number {
    if (this.purchasePrice === 0) return 0;
    return ((this.salePrice - this.purchasePrice) / this.purchasePrice) * 100;
  }

  public updateStock(quantity: number): void {
    this.stock += quantity;
  }

  /**
   * Actualiza el producto con optimistic locking
   * @param updates - Campos a actualizar
   * @param transaction - Transacción opcional
   * @returns Promise con el resultado de la actualización
   */
  public async updateWithOptimisticLock(
    updates: Partial<ProductAttributes>, 
    transaction?: any
  ): Promise<[number, Product[]]> {
    const currentVersion = this.version;
    const newVersion = currentVersion + 1;
    
    const [affectedCount, affectedRows] = await Product.update(
      { ...updates, version: newVersion },
      {
        where: {
          id: this.id,
          version: currentVersion
        },
        returning: true,
        transaction
      }
    );

    if (affectedCount === 0) {
      throw new Error(`Conflicto de concurrencia: El producto ${this.code} fue modificado por otro usuario. Intente nuevamente.`);
    }

    // Actualizar la instancia actual con la nueva versión
    this.version = newVersion;
    Object.assign(this, updates);

    return [affectedCount, affectedRows];
  }

  /**
   * Actualiza el stock con optimistic locking
   * @param stockDelta - Cambio en el stock (positivo o negativo)
   * @param gramsDelta - Cambio en gramos (opcional)
   * @param transaction - Transacción opcional
   * @returns Promise con el resultado de la actualización
   */
  public async updateStockWithLock(
    stockDelta: number, 
    gramsDelta: number = 0, 
    transaction?: any
  ): Promise<[number, Product[]]> {
    const newStock = this.stock + stockDelta;
    const newGrams = (this.grams || 0) + gramsDelta;

    // Validar que el stock no sea negativo
    if (newStock < 0) {
      throw new Error(`Stock insuficiente para ${this.code}. Stock actual: ${this.stock}, Cambio solicitado: ${stockDelta}`);
    }

    // Validar que los gramos no sean negativos
    if (newGrams < 0) {
      throw new Error(`Gramos insuficientes para ${this.code}. Gramos actuales: ${this.grams || 0}, Cambio solicitado: ${gramsDelta}`);
    }

    return this.updateWithOptimisticLock({
      stock: newStock,
      grams: newGrams,
      lastStockUpdate: new Date()
    }, transaction);
  }
}

// Función para inicializar el modelo Product
export function initializeProduct(sequelizeInstance: any) {
  Product.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        len: [1, 200],
        notEmpty: true,
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category: {
      type: DataTypes.ENUM('Anillos', 'Alianzas', 'Cadenas', 'Collares', 'Pulseras', 'Aretes', 'Pendientes', 'Broches', 'Relojes', 'Gemelos', 'Dijes', 'Charms', 'Otros'),
      allowNull: false,
    },
    material: {
      type: DataTypes.ENUM('Oro', 'Plata', 'Platino', 'Paladio', 'Acero', 'Titanio', 'Diamante', 'Esmeralda', 'Rubí', 'Zafiro', 'Perla', 'Otros'),
      allowNull: false,
    },
    weight: {
      type: DataTypes.DECIMAL(8, 3),
      allowNull: true,
      validate: {
        min: 0,
      },
    },
    purity: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    size: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    color: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    purchasePrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    salePrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    minStock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 0,
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    imageUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },
    barcode: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
    },
    supplier: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    // Nuevos campos de joyería
    brand: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    metal: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    metalPurity: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    grams: {
      type: DataTypes.DECIMAL(8, 3),
      allowNull: true,
      validate: {
        min: 0,
      },
    },
    ringSize: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    chainLengthCm: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
      validate: {
        min: 0,
      },
    },
    stoneType: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    stoneColor: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    stoneCut: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    stoneClarity: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    stoneCarat: {
      type: DataTypes.DECIMAL(6, 3),
      allowNull: true,
      validate: {
        min: 0,
      },
    },
    finish: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    plating: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    hallmark: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    collection: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    gender: {
      type: DataTypes.ENUM('hombre', 'mujer', 'unisex', 'niño', 'niña'),
      allowNull: true,
    },
    isUniquePiece: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    warrantyMonths: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1,
      },
    },
    lastStockUpdate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    indexes: [
      {
        unique: true,
        fields: ['code'],
      },
      {
        unique: true,
        fields: ['barcode'],
        where: {
          barcode: {
            [Op.ne]: null,
          },
        },
      },
      {
        fields: ['category'],
      },
      {
        fields: ['material'],
      },
      {
        fields: ['isActive'],
      },
      {
        fields: ['stock'],
      },
      {
        fields: ['name'],
      },
    ],
    sequelize: sequelizeInstance,
    modelName: 'Product',
    tableName: 'products',
    timestamps: true,
  });
}

export type { ProductAttributes, ProductCreationAttributes };
export { Product };
export default Product;
