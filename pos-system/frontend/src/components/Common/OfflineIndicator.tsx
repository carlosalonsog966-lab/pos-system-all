import React from 'react';
import { ExclamationTriangleIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';
import { useOfflineStore } from '@/store/offlineStore';

const OfflineIndicator: React.FC = () => {
  const { pendingActions, syncInProgress, syncPendingActions } = useOfflineStore();

  const handleSync = () => {
    if (!syncInProgress) {
      syncPendingActions();
    }
  };

  return (
    <div className="offline-indicator">
      <div className="flex items-center justify-center space-x-2">
        <ExclamationTriangleIcon className="w-5 h-5" />
        <span className="font-medium">
          Modo sin conexión
        </span>
        {pendingActions.length > 0 && (
          <>
            <span className="text-sm">
              ({pendingActions.length} acciones pendientes)
            </span>
            <button
              onClick={handleSync}
              disabled={syncInProgress}
              className="ml-4 px-3 py-1 bg-white bg-opacity-20 hover:bg-opacity-30 rounded text-sm font-medium transition-colors duration-200 disabled:opacity-50"
            >
              {syncInProgress ? (
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  <span>Sincronizando...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1">
                  <CloudArrowUpIcon className="w-4 h-4" />
                  <span>Sincronizar</span>
                </div>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default OfflineIndicator;