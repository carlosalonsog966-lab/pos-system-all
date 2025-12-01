import { Settings } from '../models/Settings';
import { SettingsAttributes, SettingsCreationAttributes } from '../models/Settings';

export class SettingsService {
  // Obtener configuraciones (siempre debe haber solo una instancia)
  static async getSettings(): Promise<Settings> {
    let settings = await Settings.findOne();
    
    // Si no existe configuración, crear una con valores por defecto
    if (!settings) {
      settings = await Settings.create({
        companyName: 'Mi Empresa',
        companyAddress: '',
        companyPhone: '',
        // No establecer cadena vacía para evitar validación isEmail
        companyEmail: null,
        companyTaxId: '',
        companyLogo: undefined,
        currency: 'USD',
        locale: 'es-CO',
        taxRate: 0.0000,
        receiptFooter: undefined,
        autoPrint: false,
        printerName: undefined,
        lowStockAlert: true,
        lowStockThreshold: 10,
        dailyReports: false,
        emailNotifications: false,
        sessionTimeout: 30,
        maxLoginAttempts: 5,
        requireTwoFactor: false,
        passwordExpiry: 90,
        autoBackup: false,
        backupFrequency: 'weekly',
        backupLocation: undefined,
        cloudBackup: false,
        theme: 'light',
        primaryColor: undefined,
        barcodeFormat: 'CODE128',
        enableInventoryTracking: true,
        enableCustomerManagement: true,
        inventoryFilterPresets: '[]',
      });
    }
    
    return settings;
  }

  // Obtener configuraciones por categoría
  static async getSettingsByCategory(category: string): Promise<any> {
    const settings = await this.getSettings();
    return settings.getByCategory(category);
  }

  // Actualizar configuraciones
  static async updateSettings(data: Partial<SettingsAttributes>): Promise<Settings> {
    const settings = await this.getSettings();
    
    // Validaciones específicas
    if (data.taxRate !== undefined) {
      if (data.taxRate < 0 || data.taxRate > 1) {
        throw new Error('La tasa de impuesto debe estar entre 0 y 1');
      }
    }
    
    if (data.sessionTimeout !== undefined) {
      if (data.sessionTimeout < 5 || data.sessionTimeout > 480) {
        throw new Error('El timeout de sesión debe estar entre 5 y 480 minutos');
      }
    }
    
    if (data.maxLoginAttempts !== undefined) {
      if (data.maxLoginAttempts < 3 || data.maxLoginAttempts > 10) {
        throw new Error('Los intentos máximos de login deben estar entre 3 y 10');
      }
    }
    
    if (data.lowStockThreshold !== undefined) {
      if (data.lowStockThreshold < 0) {
        throw new Error('El umbral de stock bajo no puede ser negativo');
      }
    }
    
    if (data.passwordExpiry !== undefined) {
      if (data.passwordExpiry < 30 || data.passwordExpiry > 365) {
        throw new Error('La expiración de contraseña debe estar entre 30 y 365 días');
      }
    }
    
    if (data.companyEmail && data.companyEmail.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.companyEmail)) {
        throw new Error('El email de la empresa no es válido');
      }
    }
    
    if (data.primaryColor && data.primaryColor.trim() !== '') {
      const colorRegex = /^#[0-9A-F]{6}$/i;
      if (!colorRegex.test(data.primaryColor)) {
        throw new Error('El color primario debe ser un código hexadecimal válido (ej: #FF0000)');
      }
    }

    await settings.update(data);
    return settings;
  }

  // Actualizar configuraciones por categoría
  static async updateSettingsByCategory(category: string, data: any): Promise<Settings> {
    const validCategories = ['company', 'pos', 'notifications', 'security', 'backup', 'theme', 'advanced'];
    
    if (!validCategories.includes(category)) {
      throw new Error(`Categoría inválida. Las categorías válidas son: ${validCategories.join(', ')}`);
    }

    // Mapear los datos según la categoría
    let updateData: Partial<SettingsAttributes> = {};
    
    switch (category) {
      case 'company':
        updateData = {
          companyName: data.companyName,
          companyAddress: data.companyAddress,
          companyPhone: data.companyPhone,
          companyEmail: data.companyEmail,
          companyTaxId: data.companyTaxId,
          companyLogo: data.companyLogo,
        };
        break;
      case 'pos':
        updateData = {
          currency: data.currency,
          locale: data.locale,
          taxRate: data.taxRate,
          receiptFooter: data.receiptFooter,
          autoPrint: data.autoPrint,
          printerName: data.printerName,
        };
        break;
      case 'notifications':
        updateData = {
          lowStockAlert: data.lowStockAlert,
          lowStockThreshold: data.lowStockThreshold,
          dailyReports: data.dailyReports,
          emailNotifications: data.emailNotifications,
        };
        break;
      case 'security':
        updateData = {
          sessionTimeout: data.sessionTimeout,
          maxLoginAttempts: data.maxLoginAttempts,
          requireTwoFactor: data.requireTwoFactor,
          passwordExpiry: data.passwordExpiry,
        };
        break;
      case 'backup':
        updateData = {
          autoBackup: data.autoBackup,
          backupFrequency: data.backupFrequency,
          backupLocation: data.backupLocation,
          cloudBackup: data.cloudBackup,
        };
        break;
      case 'theme':
        updateData = {
          theme: data.theme,
          primaryColor: data.primaryColor,
        };
        break;
      case 'advanced':
        updateData = {
          barcodeFormat: data.barcodeFormat,
          enableInventoryTracking: data.enableInventoryTracking,
          enableCustomerManagement: data.enableCustomerManagement,
          // Permitir actualizar presets desde categoría avanzada
          inventoryFilterPresets: data.inventoryFilterPresets,
        };
        break;
    }

    // Filtrar valores undefined
    const filteredData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined)
    );

    return this.updateSettings(filteredData);
  }

  // Resetear configuraciones a valores por defecto
  static async resetSettings(): Promise<Settings> {
    const settings = await this.getSettings();
    
    const defaultData: Partial<SettingsAttributes> = {
      companyName: 'Mi Empresa',
      companyAddress: undefined,
      companyPhone: undefined,
      companyEmail: undefined,
      companyTaxId: undefined,
      companyLogo: undefined,
      currency: 'USD',
      locale: 'es-CO',
      taxRate: 0.0000,
      receiptFooter: undefined,
      
      printerName: undefined,
      lowStockAlert: true,
      lowStockThreshold: 10,
      dailyReports: false,
      emailNotifications: false,
      sessionTimeout: 30,
      maxLoginAttempts: 5,
      requireTwoFactor: false,
      passwordExpiry: 90,
      autoBackup: false,
      backupFrequency: 'weekly',
      backupLocation: undefined,
      cloudBackup: false,
      
      theme: 'light',
      primaryColor: undefined,
      barcodeFormat: 'CODE128',
      enableInventoryTracking: true,
      enableCustomerManagement: true,
    };

    await settings.update(defaultData);
    return settings;
  }

  // Exportar configuraciones
  static async exportSettings(): Promise<any> {
    const settings = await this.getSettings();
    const settingsData = settings.toJSON();
    
    // Remover campos sensibles
    const { id, createdAt, updatedAt, ...exportData } = settingsData;
    
    return {
      exportDate: new Date().toISOString(),
      version: '1.0',
      settings: exportData
    };
  }

  // Importar configuraciones
  static async importSettings(importData: any): Promise<Settings> {
    if (!importData.settings) {
      throw new Error('Datos de importación inválidos');
    }

    const { settings: settingsData } = importData;
    
    // Validar que los datos tengan la estructura correcta
    const requiredFields = ['companyName', 'currency'];
    for (const field of requiredFields) {
      if (!settingsData[field]) {
        throw new Error(`Campo requerido faltante: ${field}`);
      }
    }

    return this.updateSettings(settingsData);
  }

  // Verificar si las configuraciones están completas
  static async validateSettings(): Promise<{ isValid: boolean; errors: string[] }> {
    const settings = await this.getSettings();
    const errors: string[] = [];

    // Validaciones básicas
    if (!settings.companyName || settings.companyName.trim() === '') {
      errors.push('El nombre de la empresa es requerido');
    }

    if (!settings.currency || settings.currency.trim() === '') {
      errors.push('La moneda es requerida');
    }

    if (settings.taxRate < 0 || settings.taxRate > 1) {
      errors.push('La tasa de impuesto debe estar entre 0 y 1');
    }

    if (settings.lowStockThreshold < 0) {
      errors.push('El umbral de stock bajo no puede ser negativo');
    }

    if (settings.sessionTimeout < 5 || settings.sessionTimeout > 480) {
      errors.push('El timeout de sesión debe estar entre 5 y 480 minutos');
    }

    if (settings.companyEmail && settings.companyEmail.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(settings.companyEmail)) {
        errors.push('El email de la empresa no es válido');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
