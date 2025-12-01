import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  performanceMonitor, 
  PerformanceMetric, 
  PerformanceReport
} from '../lib/performance';

export interface UsePerformanceOptions {
  trackRenders?: boolean;
  trackEffects?: boolean;
  trackUserInteractions?: boolean;
  componentName?: string;
  autoReport?: boolean;
  reportInterval?: number;
}

export interface UsePerformanceReturn {
  startTimer: (name: string) => void;
  endTimer: (name: string, tags?: Record<string, string>) => number;
  measure: <T>(name: string, fn: () => T, tags?: Record<string, string>) => T;
  measureAsync: <T>(name: string, fn: () => Promise<T>, tags?: Record<string, string>) => Promise<T>;
  incrementCounter: (name: string, value?: number, tags?: Record<string, string>) => void;
  setGauge: (name: string, value: number, tags?: Record<string, string>) => void;
  getMetrics: (filter?: any) => PerformanceMetric[];
  generateReport: () => PerformanceReport;
  renderCount: number;
  lastRenderTime: number;
}

export function usePerformance(options: UsePerformanceOptions = {}): UsePerformanceReturn {
  const {
    trackRenders = true,
    trackEffects = true,
    // trackUserInteractions = true,
    componentName = 'Component',
    autoReport = false,
    reportInterval = 30000, // 30 segundos
  } = options;

  const [renderCount, setRenderCount] = useState(0);
  const [lastRenderTime, setLastRenderTime] = useState(0);
  const renderStartTime = useRef<number>(0);
  const reportIntervalRef = useRef<NodeJS.Timeout>();

  // Rastrear renders
  useEffect(() => {
    if (trackRenders) {
      const renderTime = performance.now() - renderStartTime.current;
      setLastRenderTime(renderTime);
      setRenderCount(prev => prev + 1);

      performanceMonitor.addMetric({
        name: `${componentName}_render`,
        value: renderTime,
        timestamp: Date.now(),
        type: 'timing',
        unit: 'ms',
        tags: { 
          component: componentName,
          render_count: renderCount.toString()
        },
      });
    }
  });

  // Inicializar timer de render
  if (trackRenders) {
    renderStartTime.current = performance.now();
  }

  // Rastrear montaje del componente
  useEffect(() => {
    if (trackEffects) {
      performanceMonitor.startTimer(`${componentName}_mount`);
      
      return () => {
        performanceMonitor.endTimer(`${componentName}_mount`, {
          component: componentName,
          total_renders: renderCount.toString(),
        });
      };
    }
  }, [componentName, trackEffects, renderCount]);

  // Auto-reporte
  useEffect(() => {
    if (autoReport && reportInterval > 0) {
      reportIntervalRef.current = setInterval(() => {
        const report = performanceMonitor.generateReport();
        console.log(`Performance Report for ${componentName}:`, report);
      }, reportInterval);

      return () => {
        if (reportIntervalRef.current) {
          clearInterval(reportIntervalRef.current);
        }
      };
    }
  }, [autoReport, reportInterval, componentName]);

  // Métodos del monitor
  const startTimer = useCallback((name: string) => {
    performanceMonitor.startTimer(`${componentName}_${name}`);
  }, [componentName]);

  const endTimer = useCallback((name: string, tags?: Record<string, string>) => {
    return performanceMonitor.endTimer(`${componentName}_${name}`, {
      component: componentName,
      ...tags,
    });
  }, [componentName]);

  const measure = useCallback(<T>(
    name: string, 
    fn: () => T, 
    tags?: Record<string, string>
  ): T => {
    return performanceMonitor.measure(`${componentName}_${name}`, fn, {
      component: componentName,
      ...tags,
    });
  }, [componentName]);

  const measureAsync = useCallback(<T>(
    name: string, 
    fn: () => Promise<T>, 
    tags?: Record<string, string>
  ): Promise<T> => {
    return performanceMonitor.measureAsync(`${componentName}_${name}`, fn, {
      component: componentName,
      ...tags,
    });
  }, [componentName]);

  const incrementCounter = useCallback((
    name: string, 
    value: number = 1, 
    tags?: Record<string, string>
  ) => {
    performanceMonitor.incrementCounter(`${componentName}_${name}`, value, {
      component: componentName,
      ...tags,
    });
  }, [componentName]);

  const setGauge = useCallback((
    name: string, 
    value: number, 
    tags?: Record<string, string>
  ) => {
    performanceMonitor.setGauge(`${componentName}_${name}`, value, {
      component: componentName,
      ...tags,
    });
  }, [componentName]);

  const getMetrics = useCallback((filter?: any) => {
    return performanceMonitor.getMetrics({
      ...filter,
      tags: { component: componentName, ...filter?.tags },
    });
  }, [componentName]);

  const generateReport = useCallback(() => {
    return performanceMonitor.generateReport();
  }, []);

  return {
    startTimer,
    endTimer,
    measure,
    measureAsync,
    incrementCounter,
    setGauge,
    getMetrics,
    generateReport,
    renderCount,
    lastRenderTime,
  };
}

// Hook para rastrear interacciones del usuario
export function useUserInteractionTracking(componentName: string = 'Component') {
  const trackClick = useCallback((elementName: string, metadata?: Record<string, any>) => {
    performanceMonitor.incrementCounter('user_clicks', 1, {
      component: componentName,
      element: elementName,
      ...metadata,
    });
  }, [componentName]);

  const trackFormSubmit = useCallback((formName: string, metadata?: Record<string, any>) => {
    performanceMonitor.incrementCounter('form_submits', 1, {
      component: componentName,
      form: formName,
      ...metadata,
    });
  }, [componentName]);

  const trackNavigation = useCallback((from: string, to: string) => {
    performanceMonitor.incrementCounter('navigations', 1, {
      component: componentName,
      from,
      to,
    });
  }, [componentName]);

  const trackError = useCallback((errorType: string, errorMessage: string) => {
    performanceMonitor.incrementCounter('errors', 1, {
      component: componentName,
      error_type: errorType,
      error_message: errorMessage,
    });
  }, [componentName]);

  return {
    trackClick,
    trackFormSubmit,
    trackNavigation,
    trackError,
  };
}

// Hook para rastrear APIs
export function useApiPerformanceTracking() {
  const trackApiCall = useCallback(async <T>(
    endpoint: string,
    method: string,
    apiCall: () => Promise<T>
  ): Promise<T> => {
    const metricName = `api_${method.toLowerCase()}_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    try {
      const result = await performanceMonitor.measureAsync(metricName, apiCall, {
        endpoint,
        method,
        status: 'success',
      });
      
      performanceMonitor.incrementCounter('api_calls_success', 1, {
        endpoint,
        method,
      });
      
      return result;
    } catch (error) {
      performanceMonitor.incrementCounter('api_calls_error', 1, {
        endpoint,
        method,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw error;
    }
  }, []);

  const trackApiLatency = useCallback((endpoint: string, latency: number) => {
    performanceMonitor.setGauge('api_latency', latency, { endpoint });
  }, []);

  return {
    trackApiCall,
    trackApiLatency,
  };
}

// Hook para métricas de memoria
export function useMemoryTracking(interval: number = 5000) {
  const [memoryInfo, setMemoryInfo] = useState<{
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null>(null);

  useEffect(() => {
    if (!('memory' in performance)) {
      console.warn('Memory API not available');
      return;
    }

    const trackMemory = () => {
      const memory = (performance as any).memory;
      const info = {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      };

      setMemoryInfo(info);

      // Registrar métricas
      performanceMonitor.setGauge('memory_used', info.usedJSHeapSize / 1024 / 1024, {
        unit: 'MB',
      });
      
      performanceMonitor.setGauge('memory_total', info.totalJSHeapSize / 1024 / 1024, {
        unit: 'MB',
      });

      performanceMonitor.setGauge('memory_limit', info.jsHeapSizeLimit / 1024 / 1024, {
        unit: 'MB',
      });
    };

    // Tracking inicial
    trackMemory();

    // Tracking periódico
    const intervalId = setInterval(trackMemory, interval);

    return () => clearInterval(intervalId);
  }, [interval]);

  return memoryInfo;
}

// Hook para rastrear el rendimiento de componentes específicos
export function useComponentPerformance<T extends Record<string, any>>(
  componentName: string,
  props: T
) {
  const { measure, incrementCounter, setGauge } = usePerformance({
    componentName,
    trackRenders: true,
  });

  // Rastrear cambios en props
  const prevProps = useRef<T>(props);
  const [propChanges, setPropChanges] = useState(0);

  useEffect(() => {
    const changes = Object.keys(props).filter(
      key => props[key] !== prevProps.current[key]
    ).length;

    if (changes > 0) {
      setPropChanges(prev => prev + changes);
      incrementCounter('prop_changes', changes);
    }

    prevProps.current = props;
  }, [props, incrementCounter]);

  // Rastrear complejidad de props
  useEffect(() => {
    const complexity = JSON.stringify(props).length;
    setGauge('props_complexity', complexity, { unit: 'bytes' });
  }, [props, setGauge]);

  return {
    measure,
    propChanges,
  };
}

// Hook para dashboard de métricas
export function usePerformanceDashboard(refreshInterval: number = 1000) {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const updateMetrics = () => {
      try {
        const currentMetrics = performanceMonitor.getMetrics();
        const currentReport = performanceMonitor.generateReport();
        
        setMetrics(currentMetrics);
        setReport(currentReport);
        setIsLoading(false);
      } catch (error) {
        console.error('Error updating performance metrics:', error);
      }
    };

    // Actualización inicial
    updateMetrics();

    // Actualización periódica
    const intervalId = setInterval(updateMetrics, refreshInterval);

    return () => clearInterval(intervalId);
  }, [refreshInterval]);

  const clearMetrics = useCallback(() => {
    performanceMonitor.clearMetrics();
    setMetrics([]);
    setReport(null);
  }, []);

  const exportMetrics = useCallback(() => {
    return performanceMonitor.exportMetrics();
  }, []);

  return {
    metrics,
    report,
    isLoading,
    clearMetrics,
    exportMetrics,
  };
}