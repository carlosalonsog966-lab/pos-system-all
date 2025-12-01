import React, { useState, useMemo } from 'react';
import { usePerformanceDashboard, useMemoryTracking } from '../../hooks/usePerformance';
import { PerformanceMetric } from '../../lib/performance';
import { getStableKey } from '@/lib/utils';

interface PerformanceDashboardProps {
  className?: string;
  refreshInterval?: number;
  showDetails?: boolean;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  className = '',
  refreshInterval = 2000,
  showDetails: initialShowDetails = false,
}) => {
  const { metrics, report, isLoading, clearMetrics, exportMetrics } = usePerformanceDashboard(refreshInterval);
  const memoryInfo = useMemoryTracking();
  const [selectedMetricType, setSelectedMetricType] = useState<string>('all');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDetails, setShowDetails] = useState(initialShowDetails);

  // Filtrar métricas por tipo
  const filteredMetrics = useMemo(() => {
    if (selectedMetricType === 'all') return metrics;
    return metrics.filter(metric => metric.type === selectedMetricType);
  }, [metrics, selectedMetricType]);

  // Calcular estadísticas rápidas
  const quickStats = useMemo(() => {
    const vitals = report?.vitals || {};
    const summary = report?.summary || {};
    
    return {
      totalMetrics: (summary as any)?.totalMetrics || 0,
      avgRenderTime: (summary as any)?.averages?.['Component_render'] || 0,
      apiCalls: metrics.filter(m => m.name.includes('api_')).length,
      errors: metrics.filter(m => m.name.includes('error')).length,
      fcp: vitals.fcp || 0,
      lcp: vitals.lcp || 0,
      cls: vitals.cls || 0,
      fid: vitals.fid || 0,
    };
  }, [metrics, report]);

  // Obtener color para Web Vitals
  const getVitalColor = (metric: string, value: number): string => {
    switch (metric) {
      case 'fcp':
        return value <= 1800 ? 'text-green-600' : value <= 3000 ? 'text-yellow-600' : 'text-red-600';
      case 'lcp':
        return value <= 2500 ? 'text-green-600' : value <= 4000 ? 'text-yellow-600' : 'text-red-600';
      case 'fid':
        return value <= 100 ? 'text-green-600' : value <= 300 ? 'text-yellow-600' : 'text-red-600';
      case 'cls':
        return value <= 0.1 ? 'text-green-600' : value <= 0.25 ? 'text-yellow-600' : 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  // Formatear valor de métrica
  const formatMetricValue = (metric: PerformanceMetric): string => {
    const { value, unit, type } = metric;
    
    if (type === 'timing' && unit === 'ms') {
      return `${value.toFixed(2)}ms`;
    } else if (unit) {
      return `${value.toFixed(2)} ${unit}`;
    } else {
      return value.toString();
    }
  };

  // Exportar métricas
  const handleExport = () => {
    const data = exportMetrics();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-metrics-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  if (isLoading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Dashboard de Rendimiento
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowExportModal(true)}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
          >
            Exportar
          </button>
          <button
            onClick={clearMetrics}
            className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-sm text-gray-500">Total Métricas</div>
          <div className="text-xl font-semibold text-gray-900">
            {quickStats.totalMetrics}
          </div>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-sm text-gray-500">Llamadas API</div>
          <div className="text-xl font-semibold text-gray-900">
            {quickStats.apiCalls}
          </div>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-sm text-gray-500">Errores</div>
          <div className="text-xl font-semibold text-red-600">
            {quickStats.errors}
          </div>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-sm text-gray-500">Render Promedio</div>
          <div className="text-xl font-semibold text-gray-900">
            {quickStats.avgRenderTime.toFixed(2)}ms
          </div>
        </div>
      </div>

      {/* Web Vitals */}
      <div className="mb-6">
        <h3 className="text-md font-medium text-gray-900 mb-3">Web Vitals</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-500">FCP</div>
            <div className={`text-lg font-semibold ${getVitalColor('fcp', quickStats.fcp)}`}>
              {quickStats.fcp > 0 ? `${quickStats.fcp.toFixed(0)}ms` : 'N/A'}
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-500">LCP</div>
            <div className={`text-lg font-semibold ${getVitalColor('lcp', quickStats.lcp)}`}>
              {quickStats.lcp > 0 ? `${quickStats.lcp.toFixed(0)}ms` : 'N/A'}
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-500">FID</div>
            <div className={`text-lg font-semibold ${getVitalColor('fid', quickStats.fid)}`}>
              {quickStats.fid > 0 ? `${quickStats.fid.toFixed(0)}ms` : 'N/A'}
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-500">CLS</div>
            <div className={`text-lg font-semibold ${getVitalColor('cls', quickStats.cls)}`}>
              {quickStats.cls > 0 ? quickStats.cls.toFixed(3) : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Memory Info */}
      {memoryInfo && (
        <div className="mb-6">
          <h3 className="text-md font-medium text-gray-900 mb-3">Memoria</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-500">Usada</div>
              <div className="text-lg font-semibold text-gray-900">
                {(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(1)} MB
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-500">Total</div>
              <div className="text-lg font-semibold text-gray-900">
                {(memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(1)} MB
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-500">Límite</div>
              <div className="text-lg font-semibold text-gray-900">
                {(memoryInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(1)} MB
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="mb-4">
        <div className="flex space-x-2">
          {['all', 'timing', 'counter', 'gauge'].map(type => (
            <button
              key={type}
              onClick={() => setSelectedMetricType(type)}
              className={`px-3 py-1 text-sm rounded-md ${
                selectedMetricType === type
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {type === 'all' ? 'Todas' : type}
            </button>
          ))}
        </div>
      </div>

      {/* Métricas detalladas */}
      {showDetails && (
        <div className="max-h-96 overflow-y-auto">
          <h3 className="text-md font-medium text-gray-900 mb-3">
            Métricas Detalladas ({filteredMetrics.length})
          </h3>
          <div className="space-y-2">
            {filteredMetrics.slice(-20).reverse().map((metric) => (
              <div
                key={getStableKey((metric as any)?.id, metric.name, metric.type, metric.timestamp)}
                className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
              >
                <div className="flex-1">
                  <span className="font-medium">{metric.name}</span>
                  {metric.tags && (
                    <span className="ml-2 text-gray-500">
                      {Object.entries(metric.tags).map(([key, value]) => (
                        <span key={key} className="mr-1">
                          {key}:{typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    metric.type === 'timing' ? 'bg-blue-100 text-blue-700' :
                    metric.type === 'counter' ? 'bg-green-100 text-green-700' :
                    metric.type === 'gauge' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {metric.type}
                  </span>
                  <span className="font-medium">
                    {formatMetricValue(metric)}
                  </span>
                  <span className="text-gray-400 text-xs">
                    {new Date(metric.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toggle detalles */}
      <div className="mt-4 text-center">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {showDetails ? 'Ocultar detalles' : 'Mostrar detalles'}
        </button>
      </div>

      {/* Modal de exportación */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Exportar Métricas
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Se exportarán todas las métricas de rendimiento en formato JSON.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleExport}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Exportar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente compacto para mostrar métricas básicas
export const PerformanceIndicator: React.FC<{
  className?: string;
}> = ({ className = '' }) => {
  const { report } = usePerformanceDashboard(5000);
  const memoryInfo = useMemoryTracking(10000);

  if (!report) return null;

  const vitals = report.vitals;
  const hasIssues = (vitals.lcp && vitals.lcp > 4000) || 
                   (vitals.fid && vitals.fid > 300) || 
                   (vitals.cls && vitals.cls > 0.25);

  return (
    <div className={`flex items-center space-x-2 text-sm ${className}`}>
      <div className={`w-2 h-2 rounded-full ${hasIssues ? 'bg-red-500' : 'bg-green-500'}`} />
      <span className="text-gray-600">
        Rendimiento: {hasIssues ? 'Necesita atención' : 'Bueno'}
      </span>
      {memoryInfo && (
        <span className="text-gray-500">
          | Memoria: {(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(0)}MB
        </span>
      )}
    </div>
  );
};

export default PerformanceDashboard;
