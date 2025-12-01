import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/config';

interface SettingsAttributes {
  id: string;
  // Configuraciones de la empresa
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string | null;
  companyTaxId?: string;
  companyLogo?: string;
  
  // Configuraciones del POS
  currency: string;
  locale?: string;
  taxRate: number;
  receiptFooter?: string;
  autoPrint: boolean;
  printerName?: string;
  
  // Configuraciones de notificaciones
  lowStockAlert: boolean;
  lowStockThreshold: number;
  dailyReports: boolean;
  emailNotifications: boolean;
  
  // Configuraciones de seguridad
  sessionTimeout: number;
  maxLoginAttempts: number;
  requireTwoFactor: boolean;
  passwordExpiry: number;
  
  // Configuraciones de respaldo
  autoBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  backupLocation?: string;
  cloudBackup: boolean;
  
  // Configuraciones de tema
  theme: 'light' | 'dark' | 'auto';
  primaryColor?: string;
  
  // Configuraciones avanzadas
  barcodeFormat: string;
  enableInventoryTracking: boolean;
  enableCustomerManagement: boolean;
  
  // Presets de UI (JSON como TEXT)
  inventoryFilterPresets?: string; // JSON string (array de presets)
  
  createdAt?: Date;
  updatedAt?: Date;
}

interface SettingsCreationAttributes extends Optional<SettingsAttributes, 
  'id' | 'companyAddress' | 'companyPhone' | 'companyEmail' | 'companyTaxId' | 'companyLogo' |
  'receiptFooter' | 'printerName' | 'backupLocation' | 'primaryColor' | 'createdAt' | 'updatedAt'
> {}

class Settings extends Model<SettingsAttributes, SettingsCreationAttributes> implements SettingsAttributes {
  public id!: string;
  
  // Configuraciones de la empresa
  public companyName!: string;
  public companyAddress?: string;
  public companyPhone?: string;
  public companyEmail?: string | null;
  public companyTaxId?: string;
  public companyLogo?: string;
  
  // Configuraciones del POS
  public currency!: string;
  public locale?: string;
  public taxRate!: number;
  public receiptFooter?: string;
  public autoPrint!: boolean;
  public printerName?: string;
  
  // Configuraciones de notificaciones
  public lowStockAlert!: boolean;
  public lowStockThreshold!: number;
  public dailyReports!: boolean;
  public emailNotifications!: boolean;
  
  // Configuraciones de seguridad
  public sessionTimeout!: number;
  public maxLoginAttempts!: number;
  public requireTwoFactor!: boolean;
  public passwordExpiry!: number;
  
  // Configuraciones de respaldo
  public autoBackup!: boolean;
  public backupFrequency!: 'daily' | 'weekly' | 'monthly';
  public backupLocation?: string;
  public cloudBackup!: boolean;
  
  // Configuraciones de tema
  public theme!: 'light' | 'dark' | 'auto';
  public primaryColor?: string;
  
  // Configuraciones avanzadas
  public barcodeFormat!: string;
  public enableInventoryTracking!: boolean;
  public enableCustomerManagement!: boolean;
  
  // Presets de UI
  public inventoryFilterPresets?: string;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Método para obtener configuraciones por categoría
  public getByCategory(category: string): any {
    const values = this.get() as any;
    
    switch (category) {
      case 'company':
        return {
          companyName: values.companyName,
          companyAddress: values.companyAddress,
          companyPhone: values.companyPhone,
          companyEmail: values.companyEmail,
          companyTaxId: values.companyTaxId,
          companyLogo: values.companyLogo,
        };
      case 'pos':
        return {
          currency: values.currency,
          taxRate: values.taxRate,
          receiptFooter: values.receiptFooter,
          autoPrint: values.autoPrint,
          printerName: values.printerName,
        };
      case 'notifications':
        return {
          lowStockAlert: values.lowStockAlert,
          lowStockThreshold: values.lowStockThreshold,
          dailyReports: values.dailyReports,
          emailNotifications: values.emailNotifications,
        };
      case 'security':
        return {
          sessionTimeout: values.sessionTimeout,
          maxLoginAttempts: values.maxLoginAttempts,
          requireTwoFactor: values.requireTwoFactor,
          passwordExpiry: values.passwordExpiry,
        };
      case 'backup':
        return {
          autoBackup: values.autoBackup,
          backupFrequency: values.backupFrequency,
          backupLocation: values.backupLocation,
          cloudBackup: values.cloudBackup,
        };
      default:
        return values;
    }
  }
}

// Inicializar el modelo Settings directamente
Settings.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // Configuraciones de la empresa
    companyName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'Mi Empresa',
      validate: {
        len: [1, 100],
        notEmpty: true,
      },
    },
    companyAddress: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    companyPhone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    companyEmail: {
      type: DataTypes.STRING(100),
      allowNull: true,
      // Permitir cadena vacía convirtiéndola a null para no disparar isEmail
      set(value: any) {
        const v = typeof value === 'string' ? value.trim() : value;
        // si es cadena vacía o undefined, almacenar como null
        this.setDataValue('companyEmail', v ? v : null);
      },
      validate: {
        isEmail: true,
      },
    },
    companyTaxId: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    companyLogo: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    
    // Configuraciones del POS
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'USD',
      validate: {
        len: [3, 3],
      },
    },
    locale: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: 'es-CO',
    },
    taxRate: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0.0000,
      validate: {
        min: 0,
        max: 1,
      },
    },
    receiptFooter: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    autoPrint: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    printerName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    
    // Configuraciones de notificaciones
    lowStockAlert: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    lowStockThreshold: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
      validate: {
        min: 0,
      },
    },
    dailyReports: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    emailNotifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    
    // Configuraciones de seguridad
    sessionTimeout: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
      validate: {
        min: 5,
        max: 480,
      },
    },
    maxLoginAttempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
      validate: {
        min: 3,
        max: 10,
      },
    },
    requireTwoFactor: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    passwordExpiry: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 90,
      validate: {
        min: 30,
        max: 365,
      },
    },
    
    // Configuraciones de respaldo
    autoBackup: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    backupFrequency: {
      type: DataTypes.ENUM('daily', 'weekly', 'monthly'),
      allowNull: false,
      defaultValue: 'weekly',
    },
    backupLocation: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    cloudBackup: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    
    // Configuraciones de tema
    theme: {
      type: DataTypes.ENUM('light', 'dark', 'auto'),
      allowNull: false,
      defaultValue: 'light',
    },
    primaryColor: {
      type: DataTypes.STRING(7),
      allowNull: true,
      validate: {
        is: /^#[0-9A-F]{6}$/i,
      },
    },
    
    // Configuraciones avanzadas
    barcodeFormat: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'CODE128',
    },
    enableInventoryTracking: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    enableCustomerManagement: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    
    // Presets de UI (JSON string)
    inventoryFilterPresets: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '[]',
    },
  },
  {
    indexes: [
      {
        fields: ['companyName'],
      },
      {
        fields: ['theme'],
      },
    ],
    sequelize,
    modelName: 'Settings',
    tableName: 'settings',
    timestamps: true,
  });

// Función para mantener compatibilidad con el sistema de inicialización
export function initializeSettings(sequelizeInstance: any) {
  // El modelo ya está inicializado arriba
  return Settings;
}

export { Settings };
export type { SettingsAttributes, SettingsCreationAttributes };
export default Settings;
