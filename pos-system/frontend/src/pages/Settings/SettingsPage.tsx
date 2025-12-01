import React, { useState, useEffect, useCallback } from 'react';
import { CogIcon, ArrowDownTrayIcon, ArrowPathIcon, ArrowUpTrayIcon, PrinterIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { api } from '@/lib/api';
import { useNotificationStore } from '@/store/notificationStore';
import LoadingSpinner from '@/components/Common/LoadingSpinner';
import { useAuthStore } from '@/store/authStore';

interface SettingsData {
  // Company settings
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyTaxId?: string;
  companyLogo?: string;
  
  // POS settings
  currency: string;
  locale?: string;
  taxRate: number;
  receiptFooter?: string;
  autoPrint: boolean;
  printerName?: string;
  
  // Notification settings
  lowStockAlert: boolean;
  lowStockThreshold: number;
  dailyReports: boolean;
  emailNotifications: boolean;
  
  // Security settings
  sessionTimeout: number;
  maxLoginAttempts: number;
  requireTwoFactor: boolean;
  passwordExpiry: number;
  
  // Backup settings
  autoBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  backupLocation?: string;
  cloudBackup: boolean;
  
  // Theme settings
  theme: 'light' | 'dark' | 'auto';
  primaryColor?: string;
  
  // Advanced settings
  barcodeFormat: string;
  enableInventoryTracking: boolean;
  enableCustomerManagement: boolean;
}

interface SystemInfo {
  availableCurrencies: string[];
  availableLocales: string[];
  availableThemes: string[];
  availableBarcodeFormats: string[];
  availableBackupFrequencies: string[];
}

interface AutoSaveState {
  enabled: boolean;
  interval: NodeJS.Timeout | null;
  lastSaved: Date | null;
  unsavedChanges: boolean;
}

const SettingsPage: React.FC = () => {
  const { showSuccess, showError, showWarning } = useNotificationStore();
  const { user } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [originalSettings, setOriginalSettings] = useState<SettingsData | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [activeTab, setActiveTab] = useState('company');
  const [autoSave, setAutoSave] = useState<AutoSaveState>({
    enabled: true,
    interval: null,
    lastSaved: null,
    unsavedChanges: false
  });
  
  // Backup state before changes
  const [backupState, setBackupState] = useState<{[key: string]: any}>({});

  // Auto-save draft functionality
  const saveDraft = useCallback(() => {
    if (settings && autoSave.unsavedChanges) {
      const draftKey = `settings_draft_${user?.id || 'default'}`;
      localStorage.setItem(draftKey, JSON.stringify({
        data: settings,
        timestamp: new Date().toISOString(),
        userId: user?.id
      }));
      setAutoSave(prev => ({ ...prev, lastSaved: new Date(), unsavedChanges: false }));
    }
  }, [settings, autoSave.unsavedChanges, user]);

  // Load draft on component mount
  const loadDraft = useCallback(() => {
    const draftKey = `settings_draft_${user?.id || 'default'}`;
    const draftData = localStorage.getItem(draftKey);
    
    if (draftData) {
      try {
        const parsed = JSON.parse(draftData);
        const draftAge = Date.now() - new Date(parsed.timestamp).getTime();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (draftAge < maxAge && parsed.userId === user?.id) {
          showWarning('Se encontró un borrador de configuración guardado automáticamente');
          return parsed.data;
        } else {
          localStorage.removeItem(draftKey);
        }
      } catch (error) {
        console.error('Error loading draft:', error);
        localStorage.removeItem(draftKey);
      }
    }
    return null;
  }, [user, showWarning]);

  // Setup auto-save interval
  useEffect(() => {
    if (autoSave.enabled && !autoSave.interval) {
      const interval = setInterval(saveDraft, 30000); // Auto-save every 30 seconds
      setAutoSave(prev => ({ ...prev, interval }));
    }
    
    return () => {
      if (autoSave.interval) {
        clearInterval(autoSave.interval);
        setAutoSave(prev => ({ ...prev, interval: null }));
      }
    };
  }, [autoSave.enabled, saveDraft, autoSave.interval]);

  // Load settings and system info
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      
      // Check for existing draft first
      const draft = loadDraft();
      
      const [settingsResponse, systemInfoResponse] = await Promise.all([
        api.get('/api/settings'),
        api.get('/api/settings/system-info')
      ]);
      
      if (settingsResponse.data?.success && systemInfoResponse.data?.success) {
        const loadedSettings = draft || settingsResponse.data.data;
        setSettings(loadedSettings);
        setOriginalSettings(loadedSettings);
        setSystemInfo(systemInfoResponse.data.data);
        
        // Clear draft if we loaded from server
        if (!draft) {
          const draftKey = `settings_draft_${user?.id || 'default'}`;
          localStorage.removeItem(draftKey);
        }
      } else {
        throw new Error('Error al cargar configuraciones');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      showError('Error al cargar las configuraciones');
      
      // Try to load from draft as fallback
      const draft = loadDraft();
      if (draft) {
        setSettings(draft);
        setOriginalSettings(draft);
        showWarning('Se cargaron configuraciones desde borrador automático');
      }
    } finally {
      setLoading(false);
    }
  }, [loadDraft, showError, showWarning, user]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Handle settings changes with backup
  const handleSettingsChange = (field: keyof SettingsData, value: any) => {
    if (!settings) return;
    
    // Create backup of current state before changes
    if (!backupState[field]) {
      setBackupState(prev => ({
        ...prev,
        [field]: settings[field]
      }));
    }
    
    setSettings(prev => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
    
    setAutoSave(prev => ({ ...prev, unsavedChanges: true }));
  };

  // Save settings with error recovery
  const handleSave = async () => {
    if (!settings) return;
    
    try {
      setSaving(true);
      
      // Create full backup before saving
      const backupKey = `settings_backup_${Date.now()}`;
      localStorage.setItem(backupKey, JSON.stringify({
        original: originalSettings,
        current: settings,
        timestamp: new Date().toISOString(),
        userId: user?.id
      }));
      
      const response = await api.put('/api/settings', settings);
      
      if (response.data?.success) {
        setOriginalSettings(settings);
        setBackupState({}); // Clear backup state
        
        // Clear draft and backup
        const draftKey = `settings_draft_${user?.id || 'default'}`;
        localStorage.removeItem(draftKey);
        localStorage.removeItem(backupKey);
        
        showSuccess('Configuraciones guardadas exitosamente');
        setAutoSave(prev => ({ ...prev, unsavedChanges: false, lastSaved: new Date() }));
      } else {
        throw new Error(response.data?.error || 'Error al guardar configuraciones');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      
      // Offer recovery options
      const shouldRecover = window.confirm(
        'Error al guardar configuraciones. ¿Desea restaurar los valores anteriores o intentar nuevamente?\n\n' +
        'Presione OK para restaurar o Cancelar para mantener los cambios actuales.'
      );
      
      if (shouldRecover && originalSettings) {
        setSettings(originalSettings);
        setBackupState({});
        showWarning('Configuraciones restauradas a valores anteriores');
      }
      
      showError('Error al guardar las configuraciones');
    } finally {
      setSaving(false);
    }
  };

  // Reset to defaults with confirmation
  const handleReset = async () => {
    const confirmed = window.confirm(
      '¿Está seguro de que desea restablecer todas las configuraciones a sus valores predeterminados?\n\n' +
      'Esta acción no se puede deshacer.'
    );
    
    if (confirmed) {
      try {
        setSaving(true);
        const response = await api.post('/api/settings/reset');
        
        if (response.data?.success) {
          const resetSettings = response.data.data;
          setSettings(resetSettings);
          setOriginalSettings(resetSettings);
          setBackupState({});
          
          // Clear draft and backup
          const draftKey = `settings_draft_${user?.id || 'default'}`;
          localStorage.removeItem(draftKey);
          
          showSuccess('Configuraciones restablecidas a valores predeterminados');
          setAutoSave(prev => ({ ...prev, unsavedChanges: false, lastSaved: new Date() }));
        }
      } catch (error) {
        console.error('Error resetting settings:', error);
        showError('Error al restablecer configuraciones');
      } finally {
        setSaving(false);
      }
    }
  };

  // Test printer functionality
  const handleTestPrinter = async () => {
    try {
      const response = await api.post('/api/settings/test-printer');
      
      if (response.data?.success) {
        showSuccess(response.data.message);
      } else {
        throw new Error(response.data?.error || 'Error al probar impresora');
      }
    } catch (error) {
      console.error('Error testing printer:', error);
      showError('Error al probar la impresora');
    }
  };

  // Export settings
  const handleExport = async () => {
    try {
      const response = await api.get('/api/settings/export', {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `settings-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      showSuccess('Configuraciones exportadas exitosamente');
    } catch (error) {
      console.error('Error exporting settings:', error);
      showError('Error al exportar configuraciones');
    }
  };

  // Tab content components
  const CompanyTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre de la Empresa *
          </label>
          <input
            type="text"
            value={settings?.companyName || ''}
            onChange={(e) => handleSettingsChange('companyName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Mi Empresa"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            NIT/RUT
          </label>
          <input
            type="text"
            value={settings?.companyTaxId || ''}
            onChange={(e) => handleSettingsChange('companyTaxId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="NIT o RUT de la empresa"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dirección
          </label>
          <input
            type="text"
            value={settings?.companyAddress || ''}
            onChange={(e) => handleSettingsChange('companyAddress', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Dirección de la empresa"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Teléfono
          </label>
          <input
            type="text"
            value={settings?.companyPhone || ''}
            onChange={(e) => handleSettingsChange('companyPhone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Teléfono de contacto"
          />
        </div>
        
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Correo Electrónico
          </label>
          <input
            type="email"
            value={settings?.companyEmail || ''}
            onChange={(e) => handleSettingsChange('companyEmail', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="correo@empresa.com"
          />
        </div>
      </div>
    </div>
  );

  const POSTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Moneda *
          </label>
          <select
            value={settings?.currency || 'USD'}
            onChange={(e) => handleSettingsChange('currency', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {systemInfo?.availableCurrencies?.map(currency => (
              <option key={currency} value={currency}>{currency}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tasa de Impuesto (%)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={(settings?.taxRate || 0) * 100}
            onChange={(e) => handleSettingsChange('taxRate', parseFloat(e.target.value) / 100)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Impresora
          </label>
          <input
            type="text"
            value={settings?.printerName || ''}
            onChange={(e) => handleSettingsChange('printerName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Nombre de la impresora"
          />
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="autoPrint"
            checked={settings?.autoPrint || false}
            onChange={(e) => handleSettingsChange('autoPrint', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="autoPrint" className="ml-2 block text-sm text-gray-900">
            Imprimir automáticamente
          </label>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Pie de Recibo
        </label>
        <textarea
          value={settings?.receiptFooter || ''}
          onChange={(e) => handleSettingsChange('receiptFooter', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Mensaje personalizado para el pie del recibo"
        />
      </div>
      
      <div className="flex justify-end">
        <button
          onClick={handleTestPrinter}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <PrinterIcon className="h-4 w-4 mr-2" />
          Probar Impresora
        </button>
      </div>
    </div>
  );

  const NotificationTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="lowStockAlert"
            checked={settings?.lowStockAlert || false}
            onChange={(e) => handleSettingsChange('lowStockAlert', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="lowStockAlert" className="ml-2 block text-sm text-gray-900">
            Alertas de inventario bajo
          </label>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Umbral de inventario bajo
          </label>
          <input
            type="number"
            min="0"
            value={settings?.lowStockThreshold || 10}
            onChange={(e) => handleSettingsChange('lowStockThreshold', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="dailyReports"
            checked={settings?.dailyReports || false}
            onChange={(e) => handleSettingsChange('dailyReports', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="dailyReports" className="ml-2 block text-sm text-gray-900">
            Reportes diarios
          </label>
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="emailNotifications"
            checked={settings?.emailNotifications || false}
            onChange={(e) => handleSettingsChange('emailNotifications', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="emailNotifications" className="ml-2 block text-sm text-gray-900">
            Notificaciones por email
          </label>
        </div>
      </div>
    </div>
  );

  const SecurityTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tiempo de expiración de sesión (minutos)
          </label>
          <input
            type="number"
            min="5"
            max="480"
            value={settings?.sessionTimeout || 30}
            onChange={(e) => handleSettingsChange('sessionTimeout', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Máximo de intentos de login
          </label>
          <input
            type="number"
            min="3"
            max="10"
            value={settings?.maxLoginAttempts || 5}
            onChange={(e) => handleSettingsChange('maxLoginAttempts', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Expiración de contraseña (días)
          </label>
          <input
            type="number"
            min="30"
            max="365"
            value={settings?.passwordExpiry || 90}
            onChange={(e) => handleSettingsChange('passwordExpiry', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="requireTwoFactor"
            checked={settings?.requireTwoFactor || false}
            onChange={(e) => handleSettingsChange('requireTwoFactor', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="requireTwoFactor" className="ml-2 block text-sm text-gray-900">
            Requerir autenticación de dos factores
          </label>
        </div>
      </div>
    </div>
  );

  const BackupTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="autoBackup"
            checked={settings?.autoBackup || false}
            onChange={(e) => handleSettingsChange('autoBackup', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="autoBackup" className="ml-2 block text-sm text-gray-900">
            Respaldos automáticos
          </label>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Frecuencia de respaldo
          </label>
          <select
            value={settings?.backupFrequency || 'weekly'}
            onChange={(e) => handleSettingsChange('backupFrequency', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {systemInfo?.availableBackupFrequencies?.map(frequency => (
              <option key={frequency} value={frequency}>
                {frequency === 'daily' ? 'Diario' : frequency === 'weekly' ? 'Semanal' : 'Mensual'}
              </option>
            ))}
          </select>
        </div>
        
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ubicación de respaldo
          </label>
          <input
            type="text"
            value={settings?.backupLocation || ''}
            onChange={(e) => handleSettingsChange('backupLocation', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="/ruta/a/carpeta/de/respaldo"
          />
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="cloudBackup"
            checked={settings?.cloudBackup || false}
            onChange={(e) => handleSettingsChange('cloudBackup', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="cloudBackup" className="ml-2 block text-sm text-gray-900">
            Respaldo en la nube
          </label>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'company', name: 'Empresa', icon: CogIcon },
    { id: 'pos', name: 'POS', icon: CogIcon },
    { id: 'notifications', name: 'Notificaciones', icon: CogIcon },
    { id: 'security', name: 'Seguridad', icon: ShieldCheckIcon },
    { id: 'backup', name: 'Respaldo', icon: CogIcon },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-600">Cargando configuraciones...</span>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">Error al cargar las configuraciones. Por favor, intente nuevamente.</p>
          <button
            onClick={loadSettings}
            className="mt-2 inline-flex items-center px-3 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <CogIcon className="h-6 w-6 mr-2" />
          <h1 className="text-2xl font-bold">Configuración</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          {autoSave.lastSaved && (
            <span className="text-sm text-gray-500">
              Guardado: {autoSave.lastSaved.toLocaleTimeString()}
            </span>
          )}
          
          <button
            onClick={handleExport}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Exportar
          </button>
          
          <button
            onClick={handleReset}
            disabled={saving}
            className="inline-flex items-center px-3 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Restablecer
          </button>
          
          <button
            onClick={handleSave}
            disabled={saving || !autoSave.unsavedChanges}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Guardando...
              </>
            ) : (
              <>
                <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </div>

      {/* Auto-save indicator */}
      {autoSave.unsavedChanges && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse mr-2"></div>
            <p className="text-sm text-yellow-800">
              Hay cambios sin guardar. Se guardarán automáticamente en 30 segundos o use el botón Guardar.
            </p>
          </div>
        </div>
      )}

      {/* Tab navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-lg shadow p-6">
        {activeTab === 'company' && <CompanyTab />}
        {activeTab === 'pos' && <POSTab />}
        {activeTab === 'notifications' && <NotificationTab />}
        {activeTab === 'security' && <SecurityTab />}
        {activeTab === 'backup' && <BackupTab />}
      </div>
    </div>
  );
};

export default SettingsPage;