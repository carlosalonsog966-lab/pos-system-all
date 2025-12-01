import React, { useState, useEffect } from 'react';
import {
  CloudIcon,
  ClockIcon,
  TrashIcon,
  ArrowPathIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { BackupService, BackupInfo, BackupStats } from '../../services/backupService';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import { useNotificationStore } from '../../store/notificationStore';
import { backendStatus } from '../../lib/api';

type BackupPageProps = { testMode?: boolean };
const DEFAULT_BACKUP_STATS: BackupStats = {
  totalBackups: 0,
  totalSize: 0,
  lastBackup: undefined,
  nextScheduledBackup: undefined,
  automaticBackupsEnabled: false,
};

export const BackupPage: React.FC<BackupPageProps> = ({ testMode = false }) => {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(testMode ? DEFAULT_BACKUP_STATS : null);
  const [loading, setLoading] = useState(!testMode);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [backendHealthMode, setBackendHealthMode] = useState<'ok' | 'no_health' | 'down'>('ok');

  const { showSuccess, showError } = useNotificationStore();

  useEffect(() => {
    if (testMode) return; // evitar carga inicial en modo prueba
    loadData();
  }, [testMode]);

  // Monitorear salud del backend y deshabilitar acciones sensibles en modo degradado/caído
  useEffect(() => {
    const cb = (st: 'ok' | 'no_health' | 'down') => setBackendHealthMode(st);
    try {
      if (typeof (backendStatus as any)?.onStatus === 'function') {
        (backendStatus as any).onStatus(cb);
      }
      if (typeof (backendStatus as any)?.startPolling === 'function') {
        (backendStatus as any).startPolling(60000);
      }
    } catch {}
    return () => {
      try {
        if (typeof (backendStatus as any)?.offStatus === 'function') {
          (backendStatus as any).offStatus(cb);
        }
      } catch {}
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [backupsData, statsData] = await Promise.all([
        BackupService.getBackups(),
        BackupService.getBackupStats()
      ]);
      setBackups(backupsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading backup data:', error);
      showError('Error al cargar los datos de respaldos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    if (backendHealthMode !== 'ok') {
      showError('Acción deshabilitada temporalmente: backend no disponible');
      return;
    }
    try {
      setCreating(true);
      const backup = await BackupService.createBackup(description || 'Respaldo manual');
      showSuccess(`Respaldo creado exitosamente: ${backup.filename} - Tipo: ${backup.type} - Tamaño: ${BackupService.formatFileSize(backup.size)}`, '');
      setDescription('');
      await loadData();
    } catch (error) {
      console.error('Error creating backup:', error);
      showError(error instanceof Error ? error.message : 'Error al crear respaldo');
    } finally {
      setCreating(false);
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    if (backendHealthMode !== 'ok') {
      showError('Acción deshabilitada temporalmente: backend no disponible');
      return;
    }
    try {
      setRestoring(backupId);
      await BackupService.restoreBackup(backupId);
      showSuccess(`Base de datos restaurada exitosamente desde respaldo ID: ${backupId}. Se recomienda reiniciar la aplicación.`);
      setShowRestoreConfirm(null);
      await loadData();
    } catch (error) {
      console.error('Error restoring backup:', error);
      showError(error instanceof Error ? error.message : 'Error al restaurar respaldo');
    } finally {
      setRestoring(null);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (backendHealthMode !== 'ok') {
      showError('Acción deshabilitada temporalmente: backend no disponible');
      return;
    }
    try {
      setDeleting(backupId);
      await BackupService.deleteBackup(backupId);
      showSuccess(`Respaldo ID: ${backupId} eliminado exitosamente`);
      setShowDeleteConfirm(null);
      await loadData();
    } catch (error) {
      console.error('Error deleting backup:', error);
      showError(error instanceof Error ? error.message : 'Error al eliminar respaldo');
    } finally {
      setDeleting(null);
    }
  };

  const handleSetupAutomaticBackups = async () => {
    if (backendHealthMode !== 'ok') {
      showError('Acción deshabilitada temporalmente: backend no disponible');
      return;
    }
    try {
      await BackupService.setupAutomaticBackups();
      showSuccess(`Respaldos automáticos reconfigurados exitosamente - Estado: ${stats?.automaticBackupsEnabled ? 'Deshabilitados' : 'Habilitados'}`);
      await loadData();
    } catch (error) {
      console.error('Error setting up automatic backups:', error);
      showError(error instanceof Error ? error.message : 'Error al configurar respaldos automáticos');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Respaldos</h1>
          <p className="text-gray-600">Administra los respaldos de tu base de datos</p>
        </div>
        <button
          onClick={handleCreateBackup}
          disabled={creating || backendHealthMode !== 'ok'}
          className="btn-primary"
          title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : 'Crear Respaldo'}
          data-testid="backup-create-button"
        >
          {creating ? (
            <LoadingSpinner size="sm" />
          ) : (
            <PlusIcon className="w-5 h-5 mr-2" />
          )}
          Crear Respaldo
        </button>
      </div>

      {/* Banner de salud del backend para escrituras */}
      {backendHealthMode !== 'ok' && (
        <div className={`mt-2 rounded-md px-3 py-2 text-sm border ${backendHealthMode === 'down' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-800 border-yellow-200'}`}>
          {backendHealthMode === 'down' ? 'Backend caído: acciones de escritura deshabilitadas temporalmente.' : 'Backend degradado o sin health: acciones de escritura deshabilitadas temporalmente.'}
        </div>
      )}

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card">
            <div className="flex items-center">
              <CloudIcon className="w-8 h-8 text-blue-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Total Respaldos</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalBackups}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <InformationCircleIcon className="w-8 h-8 text-green-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Tamaño Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  {BackupService.formatFileSize(stats.totalSize)}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <ClockIcon className="w-8 h-8 text-yellow-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Último Respaldo</p>
                <p className="text-sm font-bold text-gray-900">
                  {stats.lastBackup 
                    ? BackupService.formatDate(stats.lastBackup)
                    : 'Nunca'
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <ArrowPathIcon className="w-8 h-8 text-purple-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Automáticos</p>
                <p className="text-sm font-bold text-gray-900">
                  {stats.automaticBackupsEnabled ? 'Habilitados' : 'Deshabilitados'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Crear respaldo manual */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Crear Respaldo Manual</h3>
        <div className="flex space-x-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Descripción del respaldo (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field"
            />
          </div>
          <button
            onClick={handleCreateBackup}
            disabled={creating || backendHealthMode !== 'ok'}
            className="btn-primary"
            title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : 'Crear'}
            data-testid="backup-manual-create-button"
          >
            {creating ? <LoadingSpinner size="sm" /> : 'Crear'}
          </button>
        </div>
      </div>

      {/* Configuración automática */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Respaldos Automáticos</h3>
            <p className="text-sm text-gray-600">
              Los respaldos automáticos se configuran desde la página de configuraciones
            </p>
          </div>
          <button
            onClick={handleSetupAutomaticBackups}
            className="btn-secondary"
            disabled={backendHealthMode !== 'ok'}
            title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : 'Reconfigurar'}
            data-testid="backup-auto-configure-button"
          >
            <ArrowPathIcon className="w-5 h-5 mr-2" />
            Reconfigurar
          </button>
        </div>
      </div>

      {/* Lista de respaldos */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Respaldos Disponibles</h3>
        
        {backups.length === 0 ? (
          <div className="text-center py-8">
            <CloudIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No hay respaldos disponibles</p>
            <p className="text-sm text-gray-400">Crea tu primer respaldo usando el botón de arriba</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Archivo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tamaño
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {backups.map((backup) => (
                  <tr key={backup.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <CloudIcon className="w-5 h-5 text-gray-400 mr-3" />
                        <span className="text-sm font-medium text-gray-900">
                          {backup.filename}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        backup.type === 'automatic' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {backup.type === 'automatic' ? 'Automático' : 'Manual'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {BackupService.formatFileSize(backup.size)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {BackupService.formatDate(backup.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {backup.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => setShowRestoreConfirm(backup.id)}
                          disabled={restoring === backup.id || backendHealthMode !== 'ok'}
                          className="text-blue-600 hover:text-blue-900"
                          title="Restaurar"
                        >
                          {restoring === backup.id ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <ArrowPathIcon className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(backup.id)}
                          disabled={deleting === backup.id || backendHealthMode !== 'ok'}
                          className="text-red-600 hover:text-red-900"
                          title="Eliminar"
                        >
                          {deleting === backup.id ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <TrashIcon className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de confirmación para restaurar */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <ExclamationTriangleIcon className="w-16 h-16 text-yellow-500 mx-auto" />
              <h3 className="text-lg font-medium text-gray-900 mt-4">
                ¿Restaurar Respaldo?
              </h3>
              <p className="text-sm text-gray-500 mt-2">
                Esta acción reemplazará la base de datos actual con el respaldo seleccionado. 
                Se recomienda crear un respaldo antes de continuar.
              </p>
              <div className="flex justify-center space-x-4 mt-6">
                <button
                  onClick={() => setShowRestoreConfirm(null)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleRestoreBackup(showRestoreConfirm)}
                  className="btn-danger"
                  disabled={backendHealthMode !== 'ok'}
                  title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : 'Restaurar'}
                >
                  Restaurar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mx-auto" />
              <h3 className="text-lg font-medium text-gray-900 mt-4">
                ¿Eliminar Respaldo?
              </h3>
              <p className="text-sm text-gray-500 mt-2">
                Esta acción no se puede deshacer. El archivo de respaldo será eliminado permanentemente.
              </p>
              <div className="flex justify-center space-x-4 mt-6">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeleteBackup(showDeleteConfirm)}
                  className="btn-danger"
                  disabled={backendHealthMode !== 'ok'}
                  title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : 'Eliminar'}
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
