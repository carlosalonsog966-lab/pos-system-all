import { api, ApiResponse, apiUtils } from './api';

// Tipos para las configuraciones
export interface SettingsData {
  // Configuraciones de empresa
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyTaxId?: string;
  companyLogo?: string;
  
  // Configuraciones del POS
  currency: string;
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
  // Configuraciones de turismo
  defaultTourismEmployeeId?: string;
}

// Tipos para configuraciones públicas (solo lectura)
export interface PublicSettings {
  companyName: string;
  companyLogo?: string;
  currency: string;
  taxRate: number;
  theme: 'light' | 'dark' | 'auto';
  primaryColor?: string;
  enableInventoryTracking: boolean;
  enableCustomerManagement: boolean;
  lowStockThreshold: number;
  barcodeFormat: string;
}

// Tipos para actualización de configuraciones por categoría
export interface SettingsUpdateData {
  category: 'company' | 'pos' | 'notifications' | 'security' | 'backup' | 'theme' | 'advanced';
  data: Partial<SettingsData>;
}

// Tipos para importación/exportación
export interface SettingsExport {
  exportDate: string;
  version: string;
  settings: Partial<SettingsData>;
}

export interface SettingsImport {
  file: File;
  overwrite?: boolean;
}

// Servicio de configuraciones
export class SettingsService {
  
  /**
   * Obtener todas las configuraciones
   */
  static async getSettings(): Promise<SettingsData> {
    try {
      const response = await api.get<ApiResponse<SettingsData>>('/settings', {
        // Permitir uso de caché en modo offline y suprimir manejo global de 401
        headers: { 'x-cache-permit': '1' } as any,
        __suppressGlobalError: true as any,
      } as any);
      return response.data.data;
    } catch (error) {
      apiUtils.handleError(error, 'Error al obtener configuraciones');
      throw error;
    }
  }

  /**
   * Obtener configuraciones públicas (solo lectura)
   */
  static async getPublicSettings(): Promise<PublicSettings> {
    try {
      const response = await api.get<ApiResponse<PublicSettings>>('/settings/public', { __suppressGlobalError: true } as any);
      return response.data.data;
    } catch (error) {
      apiUtils.handleError(error, 'Error al obtener configuraciones públicas');
      throw error;
    }
  }

  /**
   * Obtener configuraciones por categoría
   */
  static async getSettingsByCategory(category: string): Promise<Partial<SettingsData>> {
    try {
      const response = await api.get<ApiResponse<Partial<SettingsData>>>(`/settings/category/${category}`);
      return response.data.data;
    } catch (error) {
      apiUtils.handleError(error, `Error al obtener configuraciones de ${category}`);
      throw error;
    }
  }

  /**
   * Actualizar configuraciones
   */
  static async updateSettings(data: SettingsUpdateData): Promise<SettingsData> {
    try {
      const response = await api.put<ApiResponse<SettingsData>>('/settings', data);
      apiUtils.showSuccess('Configuraciones actualizadas exitosamente');
      return response.data.data;
    } catch (error) {
      apiUtils.handleError(error, 'Error al actualizar configuraciones');
      throw error;
    }
  }

  /**
   * Restablecer configuraciones a valores por defecto
   */
  static async resetSettings(): Promise<SettingsData> {
    try {
      const response = await api.post<ApiResponse<SettingsData>>('/settings/reset');
      apiUtils.showSuccess('Configuraciones restablecidas a valores por defecto');
      return response.data.data;
    } catch (error) {
      apiUtils.handleError(error, 'Error al restablecer configuraciones');
      throw error;
    }
  }

  /**
   * Exportar configuraciones
   */
  static async exportSettings(): Promise<SettingsExport> {
    try {
      const response = await api.get<ApiResponse<SettingsExport>>('/settings/export', { __suppressGlobalError: true } as any);
      
      // Crear y descargar archivo
      const blob = new Blob([JSON.stringify(response.data.data, null, 2)], {
        type: 'application/json'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `configuraciones_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      apiUtils.showSuccess('Configuraciones exportadas exitosamente');
      return response.data.data;
    } catch (error) {
      apiUtils.handleError(error, 'Error al exportar configuraciones');
      throw error;
    }
  }

  /**
   * Importar configuraciones
   */
  static async importSettings(importData: SettingsImport): Promise<SettingsData> {
    try {
      const formData = new FormData();
      formData.append('file', importData.file);
      if (importData.overwrite) {
        formData.append('overwrite', 'true');
      }

      const response = await api.post<ApiResponse<SettingsData>>('/settings/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      apiUtils.showSuccess('Configuraciones importadas exitosamente');
      return response.data.data;
    } catch (error) {
      apiUtils.handleError(error, 'Error al importar configuraciones');
      throw error;
    }
  }

  /**
   * Validar configuraciones
   */
  static async validateSettings(data: Partial<SettingsData>): Promise<{ valid: boolean; errors?: string[] }> {
    try {
      const response = await api.post<ApiResponse<{ valid: boolean; errors?: string[] }>>('/settings/validate', data);
      return response.data.data;
    } catch (error) {
      apiUtils.handleError(error, 'Error al validar configuraciones');
      throw error;
    }
  }

  /**
   * Probar impresora
   */
  static async testPrinter(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post<ApiResponse<{ success: boolean; message: string }>>('/settings/test-printer');
      if (response.data.data.success) {
        apiUtils.showSuccess(response.data.data.message);
      }
      return response.data.data;
    } catch (error) {
      apiUtils.handleError(error, 'Error al probar impresora');
      throw error;
    }
  }

  /**
   * Obtener información del sistema
   */
  static async getSystemInfo(): Promise<any> {
    try {
      const response = await api.get<ApiResponse<any>>('/settings/system-info', { __suppressGlobalError: true } as any);
      return response.data.data;
    } catch (error) {
      apiUtils.handleError(error, 'Error al obtener información del sistema');
      throw error;
    }
  }
}

export default SettingsService;
