import React, { useState, useEffect, useCallback } from 'react';
import { getStableKey } from '@/lib/utils';
import {
  DollarSign,
  CreditCard,
  Smartphone,
  Calculator,
  Clock,
  User,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  XCircle,
  Lock,
  Unlock,
  Receipt,
  Printer,
  RefreshCw,
  Eye,
  EyeOff,
  Plus,
  Minus,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Banknote,
  Coins,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  Settings,
  AlertTriangle,
  Info,
  CheckCircle2,
  X,
  Save,
  LogOut,
  LogIn,
  Timer,
  Target,
  Zap
} from 'lucide-react';
import { api, backendStatus } from '@/lib/api';
import { useNotificationStore } from '@/store/notificationStore';
import { useOfflineStore } from '@/store/offlineStore';
import { useAuthStore } from '@/store/authStore';
import LoadingSpinner from '@/components/Common/LoadingSpinner';
import Modal from '@/components/Modal';

// Interfaces
interface CashRegister {
  id: string;
  userId: string;
  userName: string;
  openingAmount: number;
  closingAmount?: number;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalTransfer: number;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string;
  notes?: string;
  sessionDuration?: number;
  expectedCash: number;
  cashDifference: number;
}

interface Transaction {
  id: string;
  type: 'sale' | 'return' | 'cash_in' | 'cash_out' | 'opening' | 'closing';
  amount: number;
  paymentMethod: 'cash' | 'card' | 'transfer';
  description: string;
  timestamp: string;
  reference?: string;
  userId: string;
  userName: string;
}

interface CashMovement {
  id?: string;
  type: 'cash_in' | 'cash_out';
  amount: number;
  reason: string;
  description?: string;
  timestamp?: string;
}

interface DenominationCountRow {
  id: string;
  createdAt: string;
  userName: string;
  countedAmount: number;
  expectedCash: number;
  cashDifference: number;
  notes?: string;
}

interface SessionStats {
  totalTransactions: number;
  averageTicket: number;
  peakHour: string;
  topPaymentMethod: string;
  hourlyBreakdown: Array<{
    hour: string;
    sales: number;
    transactions: number;
  }>;
}

type CashRegisterPageProps = { testMode?: boolean };
const CashRegisterPage: React.FC<CashRegisterPageProps> = ({ testMode = false }) => {
  const [backendHealthMode, setBackendHealthMode] = useState<'ok' | 'no_health' | 'down'>('ok');
  // Estados principales
  const [currentSession, setCurrentSession] = useState<CashRegister | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(!testMode);
  const [processing, setProcessing] = useState(false);

  // Estados de modales
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showCashMovementModal, setShowCashMovementModal] = useState(false);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);

  // Estados de formularios
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [cashMovement, setCashMovement] = useState<CashMovement>({
    type: 'cash_in',
    amount: 0,
    reason: '',
    description: ''
  });

  // Estados de vista
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'movements' | 'analytics'>('overview');
  const [showAmounts, setShowAmounts] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(testMode ? false : true);
  const [lastBackupTime, setLastBackupTime] = useState<Date | null>(null);

  // Hooks
  const { addNotification, showSuccess, showError } = useNotificationStore();
  const { isOffline } = useOfflineStore();
  const { user } = useAuthStore();

  // Estado para conteos de denominaciones
  const [counts, setCounts] = useState<DenominationCountRow[]>([]);
  const [countsPage, setCountsPage] = useState(1);
  const [countsPageSize, setCountsPageSize] = useState(10);
  const [countsTotal, setCountsTotal] = useState(0);
  const [countsLoading, setCountsLoading] = useState(false);
  const [countsFrom, setCountsFrom] = useState<string>('');
  const [countsTo, setCountsTo] = useState<string>('');
  const [countsUserId, setCountsUserId] = useState<string>('');
  const [countsOnlyMine, setCountsOnlyMine] = useState<boolean>(false);

  const loadCashRegisterData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Cargar sesión actual
      const sessionResponse = await api.get('/cash-register/current', { __suppressGlobalError: true } as any);
      // El backend envía { success, data, message }, usamos el campo data
      setCurrentSession(sessionResponse.data?.data || null);

      // Cargar transacciones del día
      const transactionsResponse = await api.get('/cash-register/transactions/today', { __suppressGlobalError: true } as any);
      setTransactions(transactionsResponse.data?.data || []);

      // Cargar estadísticas de la sesión
      const sessionId = sessionResponse.data?.data?.id;
      if (sessionId) {
        const statsResponse = await api.get(`/cash-register/stats/${sessionId}`, { __suppressGlobalError: true } as any);
        setSessionStats(statsResponse.data?.data);

        // Cargar movimientos guardados localmente para esta sesión
        try {
          const storedMovements = localStorage.getItem(`cashMovements_${sessionId}`);
          setCashMovements(storedMovements ? JSON.parse(storedMovements) : []);
        } catch (e) {
          console.error('Error leyendo movimientos locales:', e);
          setCashMovements([]);
        }

        // Cargar conteos de denominaciones
        await loadDenominationCounts(1, countsPageSize, sessionId);
        setCountsPage(1);
      } else {
        setCashMovements([]);
        setCounts([]);
        setCountsTotal(0);
      }

    } catch (error) {
      console.error('Error loading cash register data:', error);
      
      if (isOffline) {
        // Cargar datos del localStorage en modo offline
        const offlineData = localStorage.getItem('cashRegisterData');
        if (offlineData) {
          try {
            const data = JSON.parse(offlineData);
            setCurrentSession(data.session || null);
            setTransactions(data.transactions || []);
            addNotification({
              type: 'warning',
              title: 'Modo Offline',
              message: 'Mostrando datos guardados localmente'
            });
          } catch (parseError) {
            console.error('Error parsing offline data:', parseError);
            addNotification({
              type: 'error',
              title: 'Error',
              message: 'No se pudieron cargar los datos de caja registradora'
            });
          }
        } else {
          addNotification({
            type: 'warning',
            title: 'Sin datos offline',
            message: 'No hay datos de caja registradora disponibles offline'
          });
        }
      } else {
        addNotification({
          type: 'error',
          title: 'Error de conexión',
          message: 'No se pudieron cargar los datos de caja registradora. Verifique su conexión.'
        });
      }
    } finally {
      setLoading(false);
    }
  }, [isOffline]);

  const loadDenominationCounts = async (page = 1, pageSize = countsPageSize, sessionIdOverride?: string) => {
    try {
      setCountsLoading(true);
      const sessionId = sessionIdOverride || currentSession?.id;
      if (!sessionId) return;
      // Construir filtros
      const params: Record<string, any> = { page, pageSize };
      const userFilter = countsOnlyMine ? (user?.id || '') : countsUserId;
      if (userFilter) params.userId = userFilter;
      if (countsFrom) {
        const fromISO = new Date(countsFrom).toISOString();
        params.from = fromISO;
      }
      if (countsTo) {
        const toISO = new Date(countsTo).toISOString();
        params.to = toISO;
      }
      const response = await api.get(`/cash-register/denomination-counts/${sessionId}`, { params, __suppressGlobalError: true } as any);
      const data = response.data?.data;
      const items: any[] = data?.items || [];
      setCounts(items.map((it) => ({
        id: it.id,
        createdAt: it.createdAt,
        userName: it.userName,
        countedAmount: it.countedAmount,
        expectedCash: it.expectedCash,
        cashDifference: it.cashDifference,
        notes: it.notes,
      })));
      const pag = data?.pagination || { page, limit: pageSize, total: items.length, totalPages: 1 };
      setCountsPage(pag.page);
      setCountsPageSize(pag.limit);
      setCountsTotal(pag.total);
    } catch (error) {
      console.error('Error cargando conteos de denominaciones:', error);
    } finally {
      setCountsLoading(false);
    }
  };

  const exportCountsCSV = async () => {
    try {
      if (!currentSession?.id) return;
      const params: Record<string, any> = {};
      const userFilter = countsOnlyMine ? (user?.id || '') : countsUserId;
      if (userFilter) params.userId = userFilter;
      if (countsFrom) params.from = new Date(countsFrom).toISOString();
      if (countsTo) params.to = new Date(countsTo).toISOString();
      const resp = await api.get(`/cash-register/denomination-counts/${currentSession.id}/export`, {
        responseType: 'blob',
        params,
        __suppressGlobalError: true as any,
      } as any);
      const blob = new Blob([resp.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `denomination-counts-${currentSession.id}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.response?.data?.message || 'Error al exportar CSV de conteos';
      showError(msg);
    }
  };

  // Cargar datos iniciales
  useEffect(() => {
    if (testMode) return;
    loadCashRegisterData();
    if (autoRefresh) {
      const interval = setInterval(loadCashRegisterData, 30000); // Actualizar cada 30 segundos
      return () => clearInterval(interval);
    }
  }, [autoRefresh, loadCashRegisterData, testMode]);

  // Sistema de respaldo automático para formularios de caja - cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      // Respaldo del formulario de apertura
      if (showOpenModal && openingAmount.trim()) {
        const backupKey = `cashregister-open-backup-${Date.now()}`;
        const backupData = {
          openingAmount,
          timestamp: new Date().toISOString(),
          type: 'opening'
        };
        
        try {
          localStorage.setItem(backupKey, JSON.stringify(backupData));
          setLastBackupTime(new Date());
          
          // Limpiar backups antiguos (más de 24 horas)
          const keys = Object.keys(localStorage).filter(key => key.startsWith('cashregister-open-backup-'));
          const now = Date.now();
          keys.forEach(key => {
            try {
              const data = JSON.parse(localStorage.getItem(key) || '{}');
              const timestamp = new Date(data.timestamp).getTime();
              if (now - timestamp > 24 * 60 * 60 * 1000) {
                localStorage.removeItem(key);
              }
            } catch {
              localStorage.removeItem(key);
            }
          });
        } catch (error) {
          console.warn('No se pudo guardar el respaldo del formulario de apertura:', error);
        }
      }
      
      // Respaldo del formulario de cierre
      if (showCloseModal && (closingAmount.trim() || closingNotes.trim())) {
        const backupKey = `cashregister-close-backup-${Date.now()}`;
        const backupData = {
          closingAmount,
          closingNotes,
          timestamp: new Date().toISOString(),
          type: 'closing'
        };
        
        try {
          localStorage.setItem(backupKey, JSON.stringify(backupData));
          setLastBackupTime(new Date());
          
          // Limpiar backups antiguos (más de 24 horas)
          const keys = Object.keys(localStorage).filter(key => key.startsWith('cashregister-close-backup-'));
          const now = Date.now();
          keys.forEach(key => {
            try {
              const data = JSON.parse(localStorage.getItem(key) || '{}');
              const timestamp = new Date(data.timestamp).getTime();
              if (now - timestamp > 24 * 60 * 60 * 1000) {
                localStorage.removeItem(key);
              }
            } catch {
              localStorage.removeItem(key);
            }
          });
        } catch (error) {
          console.warn('No se pudo guardar el respaldo del formulario de cierre:', error);
        }
      }
      
      // Respaldo del formulario de movimientos de efectivo
      if (showCashMovementModal && (cashMovement.amount > 0 || cashMovement.reason.trim() || cashMovement.description?.trim())) {
        const backupKey = `cashregister-movement-backup-${Date.now()}`;
        const backupData = {
          cashMovement,
          timestamp: new Date().toISOString(),
          type: 'movement'
        };
        
        try {
          localStorage.setItem(backupKey, JSON.stringify(backupData));
          setLastBackupTime(new Date());
          
          // Limpiar backups antiguos (más de 24 horas)
          const keys = Object.keys(localStorage).filter(key => key.startsWith('cashregister-movement-backup-'));
          const now = Date.now();
          keys.forEach(key => {
            try {
              const data = JSON.parse(localStorage.getItem(key) || '{}');
              const timestamp = new Date(data.timestamp).getTime();
              if (now - timestamp > 24 * 60 * 60 * 1000) {
                localStorage.removeItem(key);
              }
            } catch {
              localStorage.removeItem(key);
            }
          });
        } catch (error) {
          console.warn('No se pudo guardar el respaldo del formulario de movimientos:', error);
        }
      }
    }, 30000); // Cada 30 segundos

    return () => clearInterval(interval);
  }, [showOpenModal, showCloseModal, showCashMovementModal, openingAmount, closingAmount, closingNotes, cashMovement]);

  // Función para verificar y recuperar borradores al abrir formularios
  const checkForFormBackup = useCallback((formType: 'opening' | 'closing' | 'movement') => {
    const backupPrefix = `cashregister-${formType}-backup-`;
    const keys = Object.keys(localStorage).filter(key => key.startsWith(backupPrefix));
    
    if (keys.length > 0) {
      // Encontrar el backup más reciente
      const latestBackup = keys.reduce((latest, current) => {
        try {
          const latestData = JSON.parse(localStorage.getItem(latest) || '{}');
          const currentData = JSON.parse(localStorage.getItem(current) || '{}');
          return new Date(currentData.timestamp) > new Date(latestData.timestamp) ? current : latest;
        } catch {
          return current;
        }
      });

      try {
        const backupData = JSON.parse(localStorage.getItem(latestBackup) || '{}');
        const timeDiff = Date.now() - new Date(backupData.timestamp).getTime();
        
        // Solo ofrecer recuperación si tiene menos de 24 horas
        if (timeDiff < 24 * 60 * 60 * 1000) {
          let shouldRecover = false;
          let message = '';
          
          switch (formType) {
            case 'opening':
              message = `¿Deseas recuperar el borrador de apertura de caja?\n\nMonto: $${backupData.openingAmount}\nGuardado: ${new Date(backupData.timestamp).toLocaleString()}`;
              break;
            case 'closing':
              message = `¿Deseas recuperar el borrador de cierre de caja?\n\nMonto: $${backupData.closingAmount}${backupData.closingNotes ? '\nNotas: ' + backupData.closingNotes : ''}\nGuardado: ${new Date(backupData.timestamp).toLocaleString()}`;
              break;
            case 'movement':
              message = `¿Deseas recuperar el borrador de movimiento de efectivo?\n\nTipo: ${backupData.cashMovement.type === 'cash_in' ? 'Entrada' : 'Salida'}\nMonto: $${backupData.cashMovement.amount}${backupData.cashMovement.reason ? '\nMotivo: ' + backupData.cashMovement.reason : ''}\nGuardado: ${new Date(backupData.timestamp).toLocaleString()}`;
              break;
          }
          
          shouldRecover = window.confirm(message + '\n\nSi eliges NO recuperar, el borrador se eliminará.');
          
          if (shouldRecover) {
            switch (formType) {
              case 'opening':
                setOpeningAmount(backupData.openingAmount);
                break;
              case 'closing':
                setClosingAmount(backupData.closingAmount);
                setClosingNotes(backupData.closingNotes);
                break;
              case 'movement':
                setCashMovement(backupData.cashMovement);
                break;
            }
            showSuccess('Formulario recuperado exitosamente', 'Se restauraron los datos del borrador');
          }
          
          // Limpiar backup procesado
          localStorage.removeItem(latestBackup);
          return shouldRecover;
        } else {
          // Backup antiguo, eliminar
          localStorage.removeItem(latestBackup);
        }
      } catch (error) {
        console.warn('Error al procesar backup:', error);
        localStorage.removeItem(latestBackup);
      }
    }
    
    return false;
  }, []);

  // Función mejorada de manejo de errores con recuperación
  const handleCashRegisterError = async (error: any, operation: 'open' | 'close' | 'movement', originalData: any) => {
    console.error(`Error en operación de caja (${operation}):`, error);
    
    const userChoice = window.confirm(
      `Error al ${operation === 'open' ? 'abrir' : operation === 'close' ? 'cerrar' : 'registrar movimiento en'} la caja: ${error.message || 'Error desconocido'}\n\n` +
      `¿Qué deseas hacer?\n\n` +
      `Aceptar = Guardar datos como borrador y cerrar\n` +
      `Cancelar = Mantener formulario abierto para corregir`
    );
    
    if (userChoice) {
      // Guardar como borrador
      const draftKey = `cashregister-${operation}-draft-${Date.now()}`;
      localStorage.setItem(draftKey, JSON.stringify({
        operation,
        data: originalData,
        timestamp: new Date().toISOString(),
        error: error.message
      }));
      
      // Cerrar modales según la operación
      if (operation === 'open') {
        setShowOpenModal(false);
      } else if (operation === 'close') {
        setShowCloseModal(false);
      } else if (operation === 'movement') {
        setShowCashMovementModal(false);
      }
      
      showSuccess('Datos guardados como borrador', 'Puedes recuperarlos más tarde');
    } else {
      // Mantener formulario abierto para corrección
      setProcessing(false);
    }
  };

  const openCashRegister = async () => {
    if (openingAmount.trim().length === 0 || parseFloat(openingAmount) < 0) {
      showError('Por favor ingresa un monto de apertura válido');
      return;
    }

    try {
      setProcessing(true);
      console.log('Abriendo caja: Iniciando nueva sesión de caja registradora...');
      
      const response = await api.post('/cash-register/open', {
        openingAmount: parseFloat(openingAmount),
        userId: user?.id
      });

      const sessionData = response.data?.data;
      setCurrentSession(sessionData || null);
      setOpeningAmount('');
      setShowOpenModal(false);
      
      // Notificación detallada para auditoría
      showSuccess(
        'Caja registradora abierta exitosamente',
        `Sesión #${sessionData?.id?.slice(-6)} iniciada | Monto inicial: $${parseFloat(openingAmount).toLocaleString()} | Usuario: ${user?.email}`
      );
      
      // Recargar datos
      await loadCashRegisterData();
    } catch (error: any) {
      // Usar el nuevo manejo de errores con recuperación
      await handleCashRegisterError(error, 'open', { openingAmount, userId: user?.id });
    } finally {
      setProcessing(false);
    }
  };

  const closeCashRegister = async () => {
    if (closingAmount.trim().length === 0 || parseFloat(closingAmount) < 0) {
      showError('Por favor ingresa un monto de cierre válido');
      return;
    }

    try {
      setProcessing(true);
      console.log('Cerrando caja: Finalizando sesión de caja registradora...');
      
      const response = await api.post(`/cash-register/close/${currentSession?.id}`, {
        closingAmount: parseFloat(closingAmount),
        notes: closingNotes
      });

      const sessionData = response.data?.data;
      setCurrentSession(sessionData || null);
      setClosingAmount('');
      setClosingNotes('');
      setShowCloseModal(false);
      
      // Notificación detallada para auditoría
      const sessionDuration = sessionData?.sessionDuration || 0;
      const hours = Math.floor(sessionDuration / 3600);
      const minutes = Math.floor((sessionDuration % 3600) / 60);
      
      showSuccess(
        'Caja registradora cerrada exitosamente',
        `Sesión finalizada | Duración: ${hours}h ${minutes}m | Monto cierre: $${parseFloat(closingAmount).toLocaleString()} | Diferencia: $${sessionData?.cashDifference?.toLocaleString() || '0'}`
      );
      
      // Recargar datos
      await loadCashRegisterData();
    } catch (error: any) {
      // Usar el nuevo manejo de errores con recuperación
      await handleCashRegisterError(error, 'close', { closingAmount, closingNotes, sessionId: currentSession?.id });
    } finally {
      setProcessing(false);
    }
  };

  const addCashMovement = async () => {
    if (!cashMovement.amount || cashMovement.amount <= 0 || !cashMovement.reason.trim()) {
      showError('Por favor completa todos los campos requeridos');
      return;
    }

    try {
      setProcessing(true);
      const response = await api.post('/cash-register/cash-movement', {
        ...cashMovement,
        sessionId: currentSession?.id
      });

      // Tomar la transacción devuelta por el backend y almacenarla para mostrarla en UI
      const tx = response.data?.data;
      const newMovement: CashMovement = {
        id: tx?.id,
        type: tx?.type,
        amount: tx?.amount,
        reason: cashMovement.reason,
        description: cashMovement.description || '',
        timestamp: tx?.timestamp
      };

      const updatedMovements = [newMovement, ...cashMovements];
      setCashMovements(updatedMovements);
      if (currentSession?.id) {
        try {
          localStorage.setItem(`cashMovements_${currentSession.id}`, JSON.stringify(updatedMovements));
        } catch (e) {
          console.error('No se pudo guardar movimientos en localStorage:', e);
        }
      }

      setCashMovement({
        type: 'cash_in',
        amount: 0,
        reason: '',
        description: ''
      });
      setShowCashMovementModal(false);
      showSuccess('Movimiento de efectivo registrado exitosamente', '');
      
      // Recargar datos
      await loadCashRegisterData();
    } catch (error: any) {
      // Usar el nuevo manejo de errores con recuperación
      await handleCashRegisterError(error, 'movement', { ...cashMovement, sessionId: currentSession?.id });
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getSessionDuration = () => {
    if (!currentSession?.openedAt) return 0;
    const start = new Date(currentSession.openedAt);
    const end = currentSession.closedAt ? new Date(currentSession.closedAt) : new Date();
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-500" />
              Caja Registradora
            </h1>
            <p className="text-gray-600 mt-1">
              Gestión de sesiones de caja y operaciones de efectivo
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Indicador de respaldo automático */}
            {lastBackupTime && (
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                <Save className="w-3 h-3" />
                Último respaldo: {lastBackupTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            
            <button
              onClick={() => setShowAmounts(!showAmounts)}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              title={showAmounts ? 'Ocultar montos' : 'Mostrar montos'}
            >
              {showAmounts ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
            
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`p-2 transition-colors ${
                autoRefresh ? 'text-green-500 hover:text-green-600' : 'text-gray-500 hover:text-gray-700'
              }`}
              title={autoRefresh ? 'Desactivar actualización automática' : 'Activar actualización automática'}
            >
              <RefreshCw className={`w-5 h-5 ${autoRefresh ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={loadCashRegisterData}
              className="p-2 text-blue-500 hover:text-blue-600 transition-colors"
              title="Actualizar datos"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Estado de la sesión */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Estado de la Sesión</h2>
          
          {currentSession ? (
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                currentSession.status === 'open' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {currentSession.status === 'open' ? (
                  <Unlock className="w-4 h-4" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                {currentSession.status === 'open' ? 'Abierta' : 'Cerrada'}
              </div>
              
              {currentSession.status === 'open' && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  {formatDuration(getSessionDuration())}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
              <XCircle className="w-4 h-4" />
              Sin sesión activa
            </div>
          )}
        </div>

        {currentSession ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Información de la sesión */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Cajero</label>
                <div className="flex items-center gap-2 mt-1">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900">{currentSession.userName}</span>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Apertura</label>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900">{formatTime(currentSession.openedAt)}</span>
                </div>
              </div>
              
              {currentSession.closedAt && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Cierre</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900">{formatTime(currentSession.closedAt)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Montos de efectivo */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Monto de Apertura</label>
                <div className="flex items-center gap-2 mt-1">
                  <Banknote className="w-4 h-4 text-green-500" />
                  <span className="text-lg font-semibold text-gray-900">
                    {showAmounts ? formatCurrency(currentSession.openingAmount) : '****'}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Efectivo Esperado</label>
                <div className="flex items-center gap-2 mt-1">
                  <Calculator className="w-4 h-4 text-blue-500" />
                  <span className="text-lg font-semibold text-gray-900">
                    {showAmounts ? formatCurrency(currentSession.expectedCash) : '****'}
                  </span>
                </div>
              </div>
              
              {currentSession.closingAmount !== undefined && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Monto de Cierre</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Banknote className="w-4 h-4 text-red-500" />
                    <span className="text-lg font-semibold text-gray-900">
                      {showAmounts ? formatCurrency(currentSession.closingAmount) : '****'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Ventas por método de pago */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Ventas en Efectivo</label>
                <div className="flex items-center gap-2 mt-1">
                  <Banknote className="w-4 h-4 text-green-500" />
                  <span className="text-lg font-semibold text-gray-900">
                    {showAmounts ? formatCurrency(currentSession.totalCash) : '****'}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Ventas con Tarjeta</label>
                <div className="flex items-center gap-2 mt-1">
                  <CreditCard className="w-4 h-4 text-blue-500" />
                  <span className="text-lg font-semibold text-gray-900">
                    {showAmounts ? formatCurrency(currentSession.totalCard) : '****'}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Transferencias</label>
                <div className="flex items-center gap-2 mt-1">
                  <Smartphone className="w-4 h-4 text-purple-500" />
                  <span className="text-lg font-semibold text-gray-900">
                    {showAmounts ? formatCurrency(currentSession.totalTransfer) : '****'}
                  </span>
                </div>
              </div>
            </div>

            {/* Totales y diferencias */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Total de Ventas</label>
                <div className="flex items-center gap-2 mt-1">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-lg font-semibold text-gray-900">
                    {showAmounts ? formatCurrency(currentSession.totalSales) : '****'}
                  </span>
                </div>
              </div>
              
              {currentSession.cashDifference !== 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Diferencia de Efectivo</label>
                  <div className="flex items-center gap-2 mt-1">
                    {currentSession.cashDifference > 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    )}
                    <span className={`text-lg font-semibold ${
                      currentSession.cashDifference > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {showAmounts ? formatCurrency(Math.abs(currentSession.cashDifference)) : '****'}
                      {currentSession.cashDifference > 0 ? ' (Sobrante)' : ' (Faltante)'}
                    </span>
                  </div>
                </div>
              )}
              
              {sessionStats && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Transacciones</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Receipt className="w-4 h-4 text-gray-500" />
                    <span className="text-lg font-semibold text-gray-900">
                      {sessionStats.totalTransactions}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Lock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay sesión activa</h3>
            <p className="text-gray-600 mb-6">
              Abre una nueva sesión de caja para comenzar a procesar transacciones
            </p>
            <button
              data-testid="cash-register-open-button"
              onClick={() => {
                const hasRecovered = checkForFormBackup('opening');
                if (!hasRecovered) {
                  setShowOpenModal(true);
                }
              }}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 mx-auto"
            >
              <Unlock className="w-5 h-5" />
              Abrir Caja Registradora
            </button>
          </div>
        )}
      </div>

      {/* Acciones rápidas */}
      {currentSession && currentSession.status === 'open' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              data-testid="cash-register-cash-in-button"
              onClick={() => {
                const hasRecovered = checkForFormBackup('movement');
                if (!hasRecovered) {
                  setCashMovement(prev => ({ ...prev, type: 'cash_in' }));
                  setShowCashMovementModal(true);
                }
              }}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ArrowUpRight className="w-6 h-6 text-green-500" />
              <div className="text-left">
                <div className="font-medium text-gray-900">Entrada de Efectivo</div>
                <div className="text-sm text-gray-600">Registrar ingreso</div>
              </div>
            </button>
            
            <button
              data-testid="cash-register-cash-out-button"
              onClick={() => {
                const hasRecovered = checkForFormBackup('movement');
                if (!hasRecovered) {
                  setCashMovement(prev => ({ ...prev, type: 'cash_out' }));
                  setShowCashMovementModal(true);
                }
              }}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ArrowDownLeft className="w-6 h-6 text-red-500" />
              <div className="text-left">
                <div className="font-medium text-gray-900">Salida de Efectivo</div>
                <div className="text-sm text-gray-600">Registrar egreso</div>
              </div>
            </button>
            
            <button
              onClick={() => setShowTransactionsModal(true)}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <History className="w-6 h-6 text-blue-500" />
              <div className="text-left">
                <div className="font-medium text-gray-900">Ver Transacciones</div>
                <div className="text-sm text-gray-600">Historial del día</div>
              </div>
            </button>
            
            <button
              data-testid="cash-register-close-button"
              onClick={() => {
                const hasRecovered = checkForFormBackup('closing');
                if (!hasRecovered) {
                  setShowCloseModal(true);
                }
              }}
              className="flex items-center gap-3 p-4 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Lock className="w-6 h-6 text-red-500" />
              <div className="text-left">
                <div className="font-medium text-red-900">Cerrar Caja</div>
                <div className="text-sm text-red-600">Finalizar sesión</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Pestañas de contenido */}
      {currentSession && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'overview', label: 'Resumen', icon: BarChart3 },
                { id: 'transactions', label: 'Transacciones', icon: Receipt },
                { id: 'movements', label: 'Movimientos', icon: Activity },
                { id: 'analytics', label: 'Análisis', icon: PieChart }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* KPIs de la sesión */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-600 text-sm font-medium">Total Ventas</p>
                        <p className="text-2xl font-bold text-green-900">
                          {showAmounts ? formatCurrency(currentSession.totalSales) : '****'}
                        </p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-green-500" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-600 text-sm font-medium">Transacciones</p>
                        <p className="text-2xl font-bold text-blue-900">
                          {sessionStats?.totalTransactions || 0}
                        </p>
                      </div>
                      <Receipt className="w-8 h-8 text-blue-500" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-600 text-sm font-medium">Ticket Promedio</p>
                        <p className="text-2xl font-bold text-purple-900">
                          {showAmounts ? formatCurrency(sessionStats?.averageTicket || 0) : '****'}
                        </p>
                      </div>
                      <Target className="w-8 h-8 text-purple-500" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-6 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-orange-600 text-sm font-medium">Duración</p>
                        <p className="text-2xl font-bold text-orange-900">
                          {formatDuration(getSessionDuration())}
                        </p>
                      </div>
                      <Timer className="w-8 h-8 text-orange-500" />
                    </div>
                  </div>
                </div>

                {/* Distribución de métodos de pago */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribución de Métodos de Pago</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center justify-between p-4 bg-white rounded-lg">
                      <div className="flex items-center gap-3">
                        <Banknote className="w-6 h-6 text-green-500" />
                        <span className="font-medium text-gray-900">Efectivo</span>
                      </div>
                      <span className="text-lg font-bold text-gray-900">
                        {showAmounts ? formatCurrency(currentSession.totalCash) : '****'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white rounded-lg">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-6 h-6 text-blue-500" />
                        <span className="font-medium text-gray-900">Tarjeta</span>
                      </div>
                      <span className="text-lg font-bold text-gray-900">
                        {showAmounts ? formatCurrency(currentSession.totalCard) : '****'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white rounded-lg">
                      <div className="flex items-center gap-3">
                        <Smartphone className="w-6 h-6 text-purple-500" />
                        <span className="font-medium text-gray-900">Transferencia</span>
                      </div>
                      <span className="text-lg font-bold text-gray-900">
                        {showAmounts ? formatCurrency(currentSession.totalTransfer) : '****'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Conteos de denominaciones (arqueos) */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Coins className="w-5 h-5 text-yellow-600" />
                      Arqueos de Efectivo
                    </h3>
                    <button
                      onClick={exportCountsCSV}
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      disabled={backendHealthMode !== 'ok'}
                      title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : undefined}
                    >
                      <Printer className="w-4 h-4" />
                      Exportar CSV
                    </button>
                  </div>

                  {backendHealthMode !== 'ok' && (
                    <div className={`mt-2 rounded-md px-3 py-2 text-sm border ${backendHealthMode === 'down' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-800 border-yellow-200'}`}>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        <span>
                          {backendHealthMode === 'down'
                            ? 'Backend caído: exportaciones deshabilitadas temporalmente.'
                            : 'Backend degradado: exportaciones deshabilitadas temporalmente.'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Filtros de arqueos */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                    <div className="flex flex-col">
                      <label className="text-xs text-gray-600 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Desde</label>
                      <input
                        type="datetime-local"
                        value={countsFrom}
                        onChange={(e) => setCountsFrom(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs text-gray-600 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Hasta</label>
                      <input
                        type="datetime-local"
                        value={countsTo}
                        onChange={(e) => setCountsTo(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs text-gray-600 mb-1 flex items-center gap-1"><User className="w-3 h-3" /> Usuario (ID)</label>
                      <input
                        type="text"
                        value={countsUserId}
                        onChange={(e) => setCountsUserId(e.target.value)}
                        placeholder="Opcional"
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                        disabled={countsOnlyMine}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="countsOnlyMine"
                        type="checkbox"
                        checked={countsOnlyMine}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setCountsOnlyMine(checked);
                          if (checked) setCountsUserId('');
                        }}
                        className="h-4 w-4"
                      />
                      <label htmlFor="countsOnlyMine" className="text-sm text-gray-700">Solo mis arqueos</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => loadDenominationCounts(1)}
                        className="px-3 py-2 text-sm bg-gray-800 text-white rounded-md hover:bg-gray-900"
                      >
                        Aplicar filtros
                      </button>
                      <button
                        onClick={() => { setCountsFrom(''); setCountsTo(''); setCountsUserId(''); setCountsOnlyMine(false); loadDenominationCounts(1); }}
                        className="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                      >
                        Limpiar
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha/Hora</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contado</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Esperado</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Diferencia</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notas</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {countsLoading ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-4 text-center">
                              <LoadingSpinner size="sm" />
                            </td>
                          </tr>
                        ) : counts.length > 0 ? (
                          counts.map((c) => (
                            <tr key={c.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {new Date(c.createdAt).toLocaleString('es-MX')}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{c.userName}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {showAmounts ? formatCurrency(c.countedAmount) : '****'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {showAmounts ? formatCurrency(c.expectedCash) : '****'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={`font-semibold ${c.cashDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {showAmounts ? formatCurrency(Math.abs(c.cashDifference)) : '****'}
                                  {c.cashDifference >= 0 ? ' (Sobrante)' : ' (Faltante)'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900">{c.notes || ''}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="px-6 py-4 text-center text-gray-500">No hay arqueos registrados</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginación */}
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-gray-600">
                      Página {countsPage} de {Math.max(1, Math.ceil(countsTotal / countsPageSize))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={countsPage <= 1 || countsLoading}
                        onClick={() => loadDenominationCounts(countsPage - 1)}
                        className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Anterior
                      </button>
                      <button
                        disabled={countsPage >= Math.ceil(countsTotal / countsPageSize) || countsLoading}
                        onClick={() => loadDenominationCounts(countsPage + 1)}
                        className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'transactions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Transacciones del Día</h3>
                  <button
                    onClick={loadCashRegisterData}
                    className="text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Hora
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tipo
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Método
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Monto
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Descripción
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Usuario
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {transactions.map((transaction) => (
                        <tr key={transaction.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatTime(transaction.timestamp)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              transaction.type === 'sale' ? 'bg-green-100 text-green-800' :
                              transaction.type === 'return' ? 'bg-red-100 text-red-800' :
                              transaction.type === 'cash_in' ? 'bg-blue-100 text-blue-800' :
                              transaction.type === 'cash_out' ? 'bg-orange-100 text-orange-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {transaction.type === 'sale' ? 'Venta' :
                               transaction.type === 'return' ? 'Devolución' :
                               transaction.type === 'cash_in' ? 'Entrada' :
                               transaction.type === 'cash_out' ? 'Salida' :
                               transaction.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center gap-2">
                              {transaction.paymentMethod === 'cash' && <Banknote className="w-4 h-4 text-green-500" />}
                              {transaction.paymentMethod === 'card' && <CreditCard className="w-4 h-4 text-blue-500" />}
                              {transaction.paymentMethod === 'transfer' && <Smartphone className="w-4 h-4 text-purple-500" />}
                              {transaction.paymentMethod === 'cash' ? 'Efectivo' :
                               transaction.paymentMethod === 'card' ? 'Tarjeta' :
                               'Transferencia'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {showAmounts ? formatCurrency(transaction.amount) : '****'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {transaction.description}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {transaction.userName}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {transactions.length === 0 && (
                    <div className="text-center py-12">
                      <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No hay transacciones registradas</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'movements' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Movimientos de Efectivo</h3>
                  <button
                    onClick={() => setShowCashMovementModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Nuevo Movimiento
                  </button>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">
                    Los movimientos de efectivo incluyen entradas y salidas que no están relacionadas con ventas,
                    como cambio de billetes, gastos menores, o ajustes de caja.
                  </p>
                </div>

            {/* Aquí se mostrarían los movimientos de efectivo */}
                {cashMovements.length > 0 ? (
                  <div className="space-y-3">
                    {cashMovements.map((m) => (
                      <div key={m.id || `${m.timestamp}-${m.amount}`} className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3">
                          {m.type === 'cash_in' ? (
                            <ArrowUpRight className="w-5 h-5 text-green-500" />
                          ) : (
                            <ArrowDownLeft className="w-5 h-5 text-red-500" />
                          )}
                          <div>
                            <div className="font-medium text-gray-900">
                              {m.type === 'cash_in' ? 'Entrada' : 'Salida'} - {m.reason}
                            </div>
                            {m.description && (
                              <div className="text-sm text-gray-600">{m.description}</div>
                            )}
                            {m.timestamp && (
                              <div className="text-xs text-gray-500">{formatTime(m.timestamp)}</div>
                            )}
                          </div>
                        </div>
                        <div className={`text-lg font-semibold ${m.type === 'cash_in' ? 'text-green-600' : 'text-red-600'}`}>
                          {showAmounts ? formatCurrency(m.amount) : '****'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No hay movimientos de efectivo registrados</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'analytics' && sessionStats && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Análisis de la Sesión</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <h4 className="text-md font-medium text-gray-900 mb-4">Información General</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Hora pico:</span>
                        <span className="font-medium text-gray-900">{sessionStats.peakHour}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Método de pago preferido:</span>
                        <span className="font-medium text-gray-900">{sessionStats.topPaymentMethod}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Ticket promedio:</span>
                        <span className="font-medium text-gray-900">
                          {showAmounts ? formatCurrency(sessionStats.averageTicket) : '****'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-6 rounded-lg">
                    <h4 className="text-md font-medium text-gray-900 mb-4">Rendimiento por Hora</h4>
                    <div className="space-y-2">
                      {sessionStats.hourlyBreakdown.map((hour) => (
                        <div key={getStableKey(hour.hour, hour.sales, hour.transactions)} className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">{hour.hour}:00</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">
                              {hour.transactions} trans.
                            </span>
                            <span className="text-sm text-gray-600">
                              {showAmounts ? formatCurrency(hour.sales) : '****'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de apertura de caja */}
      <Modal
        isOpen={showOpenModal}
        onClose={() => setShowOpenModal(false)}
        title="Abrir Caja Registradora"
        size="md"
      >
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-900">Información importante</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Ingresa el monto inicial de efectivo en la caja registradora. Este monto se utilizará
                  para calcular las diferencias al final del día.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monto de Apertura
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="number"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowOpenModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              data-testid="caja.open-session"
              onClick={openCashRegister}
              disabled={processing || openingAmount.trim().length === 0}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  Abrir Caja
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de cierre de caja */}
      <Modal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        title="Cerrar Caja Registradora"
        size="md"
      >
        <div className="space-y-6">
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-yellow-900">Atención</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  Una vez cerrada la caja, no podrás realizar más transacciones hasta abrir una nueva sesión.
                  Asegúrate de contar todo el efectivo antes de continuar.
                </p>
              </div>
            </div>
          </div>

          {currentSession && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Resumen de la Sesión</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Monto de apertura:</span>
                  <div className="font-medium text-gray-900">
                    {formatCurrency(currentSession.openingAmount)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Efectivo esperado:</span>
                  <div className="font-medium text-gray-900">
                    {formatCurrency(currentSession.expectedCash)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Total ventas:</span>
                  <div className="font-medium text-gray-900">
                    {formatCurrency(currentSession.totalSales)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Duración:</span>
                  <div className="font-medium text-gray-900">
                    {formatDuration(getSessionDuration())}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monto de Cierre (Efectivo Contado)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="number"
                value={closingAmount}
                onChange={(e) => setClosingAmount(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
            {closingAmount && currentSession && (
              <div className="mt-2">
                {(() => {
                  const difference = parseFloat(closingAmount) - currentSession.expectedCash;
                  return (
                    <p className={`text-sm ${
                      difference === 0 ? 'text-green-600' :
                      difference > 0 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {difference === 0 ? '✓ Cuadra exacto' :
                       difference > 0 ? `Sobrante: ${formatCurrency(difference)}` :
                       `Faltante: ${formatCurrency(Math.abs(difference))}`}
                    </p>
                  );
                })()}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notas (Opcional)
            </label>
            <textarea
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="Observaciones sobre el cierre de caja..."
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowCloseModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              data-testid="caja.close-session"
              onClick={closeCashRegister}
              disabled={processing || closingAmount.trim().length === 0}
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Cerrar Caja
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de movimiento de efectivo */}
      <Modal
        isOpen={showCashMovementModal}
        onClose={() => setShowCashMovementModal(false)}
        title={`${cashMovement.type === 'cash_in' ? 'Entrada' : 'Salida'} de Efectivo`}
        size="md"
      >
        <div className="space-y-6">
          <div className="flex gap-4">
            <button
              onClick={() => setCashMovement(prev => ({ ...prev, type: 'cash_in' }))}
              className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                cashMovement.type === 'cash_in'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <ArrowUpRight className="w-6 h-6 mx-auto mb-2" />
              <div className="text-sm font-medium">Entrada</div>
            </button>
            <button
              onClick={() => setCashMovement(prev => ({ ...prev, type: 'cash_out' }))}
              className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                cashMovement.type === 'cash_out'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <ArrowDownLeft className="w-6 h-6 mx-auto mb-2" />
              <div className="text-sm font-medium">Salida</div>
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monto
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="number"
                value={cashMovement.amount || ''}
                onChange={(e) => setCashMovement(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Motivo
            </label>
            <select
              value={cashMovement.reason}
              onChange={(e) => setCashMovement(prev => ({ ...prev, reason: e.target.value }))}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Seleccionar motivo</option>
              {cashMovement.type === 'cash_in' ? (
                <>
                  <option value="change_bills">Cambio de billetes</option>
                  <option value="cash_deposit">Depósito de efectivo</option>
                  <option value="correction">Corrección</option>
                  <option value="other">Otro</option>
                </>
              ) : (
                <>
                  <option value="change_bills">Cambio de billetes</option>
                  <option value="petty_cash">Gastos menores</option>
                  <option value="bank_deposit">Depósito bancario</option>
                  <option value="correction">Corrección</option>
                  <option value="other">Otro</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción (Opcional)
            </label>
            <textarea
              value={cashMovement.description}
              onChange={(e) => setCashMovement(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="Detalles adicionales del movimiento..."
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowCashMovementModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={addCashMovement}
              disabled={processing || !cashMovement.amount || !cashMovement.reason}
              className={`flex-1 px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                cashMovement.type === 'cash_in' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {processing ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Registrar
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CashRegisterPage;
