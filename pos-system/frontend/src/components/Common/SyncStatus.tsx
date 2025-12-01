import React, { useState, useEffect } from 'react';
import { getStableKey } from '@/lib/utils';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  // Download,
  Upload,
  Settings
} from 'lucide-react';
import { useOfflineStore } from '@/store/offlineStore';
import { useAppState } from '@/hooks/useAppState';
import { useToast } from '@/hooks/useToast';

interface SyncStatusProps {
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({ 
  className = '', 
  showDetails = false,
  compact = false 
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');
  
  const {
    isOffline,
    pendingActions,
    syncStatus,
    syncInProgress,
    // syncPendingActions,
    retryFailedActions,
    clearPendingActions,
    setAutoSync,
    autoSyncEnabled
  } = useOfflineStore();

  const { forceSync, retryConnection } = useAppState();
  const { showSuccess, showError, showWarning } = useToast();

  // Actualizar tiempo de última sincronización
  useEffect(() => {
    const updateLastSyncTime = () => {
      if (syncStatus.lastSync) {
        const now = Date.now();
        const diff = now - syncStatus.lastSync;
        
        if (diff < 60000) {
          setLastUpdateTime('Hace menos de 1 minuto');
        } else if (diff < 3600000) {
          const minutes = Math.floor(diff / 60000);
          setLastUpdateTime(`Hace ${minutes} minuto${minutes > 1 ? 's' : ''}`);
        } else if (diff < 86400000) {
          const hours = Math.floor(diff / 3600000);
          setLastUpdateTime(`Hace ${hours} hora${hours > 1 ? 's' : ''}`);
        } else {
          setLastUpdateTime('Hace más de 1 día');
        }
      } else {
        setLastUpdateTime('Nunca');
      }
    };

    updateLastSyncTime();
    const interval = setInterval(updateLastSyncTime, 30000); // Actualizar cada 30 segundos

    return () => clearInterval(interval);
  }, [syncStatus.lastSync]);

  // Manejar sincronización manual
  const handleManualSync = async () => {
    try {
      if (isOffline) {
        await retryConnection();
        showWarning('Verificando conexión...');
      } else {
        await forceSync();
        showSuccess('Sincronización completada');
      }
    } catch (error) {
      showError('Error durante la sincronización');
    }
  };

  // Manejar reintentos de acciones fallidas
  const handleRetryFailed = async () => {
    try {
      await retryFailedActions();
      showSuccess('Reintentando acciones fallidas');
    } catch (error) {
      showError('Error al reintentar acciones');
    }
  };

  // Limpiar acciones pendientes
  const handleClearPending = () => {
    clearPendingActions();
    showSuccess('Acciones pendientes eliminadas');
  };

  // Alternar auto-sincronización
  const handleToggleAutoSync = () => {
    setAutoSync(!autoSyncEnabled);
    showSuccess(`Auto-sincronización ${!autoSyncEnabled ? 'activada' : 'desactivada'}`);
  };

  // Obtener icono de estado
  const getStatusIcon = () => {
    if (syncInProgress) {
      return <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />;
    }
    if (isOffline) {
      return <WifiOff className="w-4 h-4 text-red-500" />;
    }
    if (syncStatus.failedActions > 0) {
      return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
    if (pendingActions.length > 0) {
      return <Upload className="w-4 h-4 text-orange-500" />;
    }
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  };

  // Obtener texto de estado
  const getStatusText = () => {
    if (syncInProgress) return 'Sincronizando...';
    if (isOffline) return 'Sin conexión';
    if (syncStatus.failedActions > 0) return `${syncStatus.failedActions} errores`;
    if (pendingActions.length > 0) return `${pendingActions.length} pendientes`;
    return 'Sincronizado';
  };

  // Obtener color de estado
  const getStatusColor = () => {
    if (syncInProgress) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (isOffline) return 'text-red-600 bg-red-50 border-red-200';
    if (syncStatus.failedActions > 0) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (pendingActions.length > 0) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  if (compact) {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition-colors ${getStatusColor()}`}
          title={getStatusText()}
        >
          {getStatusIcon()}
          {!isOffline && pendingActions.length > 0 && (
            <span className="text-xs font-medium">{pendingActions.length}</span>
          )}
        </button>

        {showDropdown && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">Estado de Sincronización</h3>
                <button
                  onClick={() => setShowDropdown(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Estado:</span>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon()}
                    <span className="text-sm font-medium">{getStatusText()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Última sincronización:</span>
                  <span className="text-sm text-gray-900">{lastUpdateTime}</span>
                </div>

                {pendingActions.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Acciones pendientes:</span>
                    <span className="text-sm font-medium text-orange-600">{pendingActions.length}</span>
                  </div>
                )}

                {syncStatus.failedActions > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Acciones fallidas:</span>
                    <span className="text-sm font-medium text-red-600">{syncStatus.failedActions}</span>
                  </div>
                )}

                <div className="border-t pt-3 space-y-2">
                  <button
                    onClick={handleManualSync}
                    disabled={syncInProgress}
                    className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncInProgress ? 'animate-spin' : ''}`} />
                    <span>Sincronizar ahora</span>
                  </button>

                  {syncStatus.failedActions > 0 && (
                    <button
                      onClick={handleRetryFailed}
                      className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                    >
                      <AlertCircle className="w-4 h-4" />
                      <span>Reintentar fallidas</span>
                    </button>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Auto-sincronización:</span>
                    <button
                      onClick={handleToggleAutoSync}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        autoSyncEnabled 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {autoSyncEnabled ? 'Activada' : 'Desactivada'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Estado de Sincronización</h3>
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className="text-sm font-medium">{getStatusText()}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${isOffline ? 'bg-red-100' : 'bg-green-100'}`}>
            {isOffline ? (
              <WifiOff className="w-5 h-5 text-red-600" />
            ) : (
              <Wifi className="w-5 h-5 text-green-600" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {isOffline ? 'Sin conexión' : 'Conectado'}
            </p>
            <p className="text-xs text-gray-500">Estado de red</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{lastUpdateTime}</p>
            <p className="text-xs text-gray-500">Última sincronización</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-orange-100">
            <Upload className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{pendingActions.length}</p>
            <p className="text-xs text-gray-500">Acciones pendientes</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-red-100">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{syncStatus.failedActions}</p>
            <p className="text-xs text-gray-500">Acciones fallidas</p>
          </div>
        </div>
      </div>

      {showDetails && syncStatus.syncErrors.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Errores recientes:</h4>
          <div className="space-y-1">
            {syncStatus.syncErrors.slice(-3).map((error) => (
              <p key={getStableKey(error)} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                {error}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="flex space-x-2">
        <button
          onClick={handleManualSync}
          disabled={syncInProgress}
          className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${syncInProgress ? 'animate-spin' : ''}`} />
          <span>Sincronizar</span>
        </button>

        {syncStatus.failedActions > 0 && (
          <button
            onClick={handleRetryFailed}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
          >
            <AlertCircle className="w-4 h-4" />
            <span>Reintentar</span>
          </button>
        )}

        <button
          onClick={handleToggleAutoSync}
          className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-md ${
            autoSyncEnabled 
              ? 'bg-green-600 text-white hover:bg-green-700' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>{autoSyncEnabled ? 'Auto ON' : 'Auto OFF'}</span>
        </button>

        {pendingActions.length > 0 && (
          <button
            onClick={handleClearPending}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            <span>Limpiar</span>
          </button>
        )}
      </div>
    </div>
  );
};
