import React, { useState, useEffect } from 'react';
import { api, configureDualDriver } from '@/lib/api';

/**
 * Componente de prueba para validar los reportes de la Fase 5
 */
export const ReportTest: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Log component initialization
  useEffect(() => {
    console.log('🧪 ReportTest component initialized - ready for dual driver testing');
    addLog('🧪 Componente de testing inicializado');
  }, []);

  const addLog = (message: string) => {
    console.log(`[ReportTest] ${message}`);
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const testReportsViaHttp = async () => {
    setLoading(true);
    setError(null);
    addLog('🔄 Probando reportes vía HTTP...');
    
    try {
      configureDualDriver({ preferredDriver: 'http' });
      
      // Test Sales Report
      addLog('📊 Obteniendo reporte de ventas...');
      const salesResponse = await api.get('/reports/sales', {
        params: { startDate: '2024-01-01', endDate: '2024-12-31' }
      });
      setResults((prev: Record<string, any>) => ({ ...prev, sales: (salesResponse.data as any).data }));
      addLog(`✅ Reporte de ventas: ${(salesResponse.data as any).data.totalSales} ventas totales`);
      
      // Test Inventory Report
      addLog('📦 Obteniendo reporte de inventario...');
      const inventoryResponse = await api.get('/reports/inventory');
      setResults((prev: Record<string, any>) => ({ ...prev, inventory: (inventoryResponse.data as any).data }));
      addLog(`✅ Reporte de inventario: ${(inventoryResponse.data as any).data.totalProducts} productos`);
      
      // Test Clients Report
      addLog('👥 Obteniendo reporte de clientes...');
      const clientsResponse = await api.get('/reports/clients');
      setResults((prev: Record<string, any>) => ({ ...prev, clients: (clientsResponse.data as any).data }));
      addLog(`✅ Reporte de clientes: ${(clientsResponse.data as any).data.totalClients} clientes`);
      
      // Test Dashboard Report
      addLog('📈 Obteniendo dashboard...');
      const dashboardResponse = await api.get('/reports/dashboard');
      setResults((prev: Record<string, any>) => ({ ...prev, dashboard: (dashboardResponse.data as any).data }));
      addLog(`✅ Dashboard: ${(dashboardResponse.data as any).data.totalRevenue} ingresos totales`);
      
      // Test Ledger Report
      addLog('📚 Obteniendo libro mayor...');
      const ledgerResponse = await api.get('/ledger');
      setResults((prev: Record<string, any>) => ({ ...prev, ledger: (ledgerResponse.data as any).data }));
      const ledgerData = (ledgerResponse.data as any).data;
      addLog(`✅ Libro Mayor: ${ledgerData.length} entradas de movimiento`);
      
      addLog('✅ Todos los reportes HTTP funcionando correctamente');
      
    } catch (err) {
      setError(`Error HTTP: ${err instanceof Error ? err.message : 'Error desconocido'}`);
      addLog(`❌ Error en reportes HTTP: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const testReportsViaInvoke = async () => {
    setLoading(true);
    setError(null);
    addLog('🔄 Probando reportes vía Tauri Invoke...');
    
    try {
      configureDualDriver({ preferredDriver: 'invoke' });
      
      // Test Sales Report
      addLog('📊 Obteniendo reporte de ventas...');
      const salesResponse = await api.get('/reports/sales', {
        params: { startDate: '2024-01-01', endDate: '2024-12-31' }
      });
      setResults((prev: Record<string, any>) => ({ ...prev, salesInvoke: (salesResponse.data as any).data }));
      addLog(`✅ Reporte de ventas: ${(salesResponse.data as any).data.totalSales} ventas totales`);
      
      // Test Inventory Report
      addLog('📦 Obteniendo reporte de inventario...');
      const inventoryResponse = await api.get('/reports/inventory');
      setResults((prev: Record<string, any>) => ({ ...prev, inventoryInvoke: (inventoryResponse.data as any).data }));
      addLog(`✅ Reporte de inventario: ${(inventoryResponse.data as any).data.totalProducts} productos`);
      
      // Test Clients Report
      addLog('👥 Obteniendo reporte de clientes...');
      const clientsResponse = await api.get('/reports/clients');
      setResults((prev: Record<string, any>) => ({ ...prev, clientsInvoke: (clientsResponse.data as any).data }));
      addLog(`✅ Reporte de clientes: ${(clientsResponse.data as any).data.totalClients} clientes`);
      
      // Test Dashboard Report
      addLog('📈 Obteniendo dashboard...');
      const dashboardResponse = await api.get('/reports/dashboard');
      setResults((prev: Record<string, any>) => ({ ...prev, dashboardInvoke: (dashboardResponse.data as any).data }));
      addLog(`✅ Dashboard: ${(dashboardResponse.data as any).data.totalRevenue} ingresos totales`);
      
      // Test Ledger Report
      addLog('📚 Obteniendo libro mayor...');
      const ledgerResponse = await api.get('/ledger');
      setResults((prev: Record<string, any>) => ({ ...prev, ledgerInvoke: (ledgerResponse.data as any).data }));
      const ledgerData = (ledgerResponse.data as any).data;
      addLog(`✅ Libro Mayor: ${ledgerData.length} entradas de movimiento`);
      
      addLog('✅ Todos los reportes Invoke funcionando correctamente');
      
    } catch (err) {
      setError(`Error Invoke: ${err instanceof Error ? err.message : 'Error desconocido'}`);
      addLog(`❌ Error en reportes Invoke: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">🧪 Testing de Reportes - Fase 5</h2>
      
      <div className="mb-4 space-x-4">
        <button
          onClick={testReportsViaHttp}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? '⏳ Cargando...' : '🌐 Probar Reportes HTTP'}
        </button>
        
        <button
          onClick={testReportsViaInvoke}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          {loading ? '⏳ Cargando...' : '⚡ Probar Reportes Invoke'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          ❌ Error: {error}
        </div>
      )}

      {/* Resultados de Reportes */}
      {Object.keys(results).length > 0 && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded">
          <h3 className="font-bold text-green-800 mb-2">📊 Resultados de Reportes:</h3>
          
          {results.sales && (
            <div className="mb-2">
              <strong>Reporte de Ventas:</strong> {(results.sales as any).totalSales} ventas, ${(results.sales as any).totalRevenue} ingresos
            </div>
          )}
          
          {results.inventory && (
            <div className="mb-2">
              <strong>Reporte de Inventario:</strong> {(results.inventory as any).totalProducts} productos, ${(results.inventory as any).totalValue} valor total
            </div>
          )}
          
          {results.clients && (
            <div className="mb-2">
              <strong>Reporte de Clientes:</strong> {(results.clients as any).totalClients} clientes, ${(results.clients as any).totalDebt} deuda total
            </div>
          )}
          
          {results.dashboard && (
            <div className="mb-2">
              <strong>Dashboard:</strong> {(results.dashboard as any).totalRevenue} ingresos últimos 30 días
            </div>
          )}
          
          {results.ledger && (
            <div className="mb-2">
              <strong>Libro Mayor:</strong> {(results.ledger as any).length} entradas de movimiento
            </div>
          )}
        </div>
      )}

      {/* Logs */}
      <div className="mt-6">
        <h3 className="font-bold text-gray-700 mb-2">📝 Logs de Testing:</h3>
        <div className="bg-gray-100 p-3 rounded max-h-64 overflow-y-auto font-mono text-sm">
          {logs.map((log, index) => (
            <div key={index} className="mb-1">{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
};