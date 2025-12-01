import React from 'react';

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  type: 'timing' | 'counter' | 'gauge' | 'histogram';
  tags?: Record<string, string>;
  unit?: string;
}

export interface PerformanceReport {
  metrics: PerformanceMetric[];
  summary: {
    totalMetrics: number;
    timeRange: { start: number; end: number };
    averages: Record<string, number>;
    peaks: Record<string, number>;
  };
  vitals: {
    fcp?: number; // First Contentful Paint
    lcp?: number; // Largest Contentful Paint
    fid?: number; // First Input Delay
    cls?: number; // Cumulative Layout Shift
    ttfb?: number; // Time to First Byte
  };
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private observers: Map<string, PerformanceObserver> = new Map();
  private timers: Map<string, number> = new Map();
  private counters: Map<string, number> = new Map();
  private config: {
    maxMetrics: number;
    enableWebVitals: boolean;
    enableResourceTiming: boolean;
    enableUserTiming: boolean;
    enableNavigationTiming: boolean;
    sampleRate: number;
  };

  constructor(config: Partial<typeof PerformanceMonitor.prototype.config> = {}) {
    this.config = {
      maxMetrics: 1000,
      enableWebVitals: true,
      enableResourceTiming: true,
      enableUserTiming: true,
      enableNavigationTiming: true,
      sampleRate: 1.0,
      ...config,
    };

    this.initialize();
  }

  private initialize(): void {
    if (typeof window === 'undefined' || !('performance' in window)) {
      console.warn('Performance API not available');
      return;
    }

    this.setupWebVitals();
    this.setupResourceTiming();
    this.setupUserTiming();
    this.setupNavigationTiming();
  }

  // Configurar Web Vitals
  private setupWebVitals(): void {
    if (!this.config.enableWebVitals) return;

    // First Contentful Paint
    this.observePerformanceEntries('paint', (entries) => {
      entries.forEach((entry) => {
        if (entry.name === 'first-contentful-paint') {
          this.addMetric({
            name: 'fcp',
            value: entry.startTime,
            timestamp: Date.now(),
            type: 'timing',
            unit: 'ms',
            tags: { vital: 'true' },
          });
        }
      });
    });

    // Largest Contentful Paint
    this.observePerformanceEntries('largest-contentful-paint', (entries) => {
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        this.addMetric({
          name: 'lcp',
          value: lastEntry.startTime,
          timestamp: Date.now(),
          type: 'timing',
          unit: 'ms',
          tags: { vital: 'true' },
        });
      }
    });

    // First Input Delay
    this.observePerformanceEntries('first-input', (entries) => {
      entries.forEach((entry: any) => {
        this.addMetric({
          name: 'fid',
          value: entry.processingStart - entry.startTime,
          timestamp: Date.now(),
          type: 'timing',
          unit: 'ms',
          tags: { vital: 'true' },
        });
      });
    });

    // Cumulative Layout Shift
    this.observePerformanceEntries('layout-shift', (entries) => {
      let clsValue = 0;
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });

      if (clsValue > 0) {
        this.addMetric({
          name: 'cls',
          value: clsValue,
          timestamp: Date.now(),
          type: 'gauge',
          tags: { vital: 'true' },
        });
      }
    });
  }

  // Configurar Resource Timing
  private setupResourceTiming(): void {
    if (!this.config.enableResourceTiming) return;

    this.observePerformanceEntries('resource', (entries) => {
      entries.forEach((entry: any) => {
        const duration = entry.responseEnd - entry.startTime;
        const resourceType = this.getResourceType(entry.name);

        this.addMetric({
          name: 'resource_load_time',
          value: duration,
          timestamp: Date.now(),
          type: 'timing',
          unit: 'ms',
          tags: {
            resource_type: resourceType,
            url: entry.name,
          },
        });

        // Métricas específicas por tipo de recurso
        if (resourceType === 'image') {
          this.incrementCounter('images_loaded');
        } else if (resourceType === 'script') {
          this.incrementCounter('scripts_loaded');
        } else if (resourceType === 'stylesheet') {
          this.incrementCounter('stylesheets_loaded');
        }
      });
    });
  }

  // Configurar User Timing
  private setupUserTiming(): void {
    if (!this.config.enableUserTiming) return;

    this.observePerformanceEntries('measure', (entries) => {
      entries.forEach((entry) => {
        this.addMetric({
          name: entry.name,
          value: entry.duration,
          timestamp: Date.now(),
          type: 'timing',
          unit: 'ms',
          tags: { type: 'user_timing' },
        });
      });
    });
  }

  // Configurar Navigation Timing
  private setupNavigationTiming(): void {
    if (!this.config.enableNavigationTiming) return;

    this.observePerformanceEntries('navigation', (entries) => {
      entries.forEach((entry: any) => {
        // Time to First Byte
        const ttfb = entry.responseStart - entry.requestStart;
        this.addMetric({
          name: 'ttfb',
          value: ttfb,
          timestamp: Date.now(),
          type: 'timing',
          unit: 'ms',
          tags: { vital: 'true' },
        });

        // DOM Content Loaded
        const dcl = entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart;
        this.addMetric({
          name: 'dom_content_loaded',
          value: dcl,
          timestamp: Date.now(),
          type: 'timing',
          unit: 'ms',
        });

        // Load Event
        const loadTime = entry.loadEventEnd - entry.loadEventStart;
        this.addMetric({
          name: 'load_event',
          value: loadTime,
          timestamp: Date.now(),
          type: 'timing',
          unit: 'ms',
        });
      });
    });
  }

  // Observar entradas de performance
  private observePerformanceEntries(
    type: string,
    callback: (entries: PerformanceEntry[]) => void
  ): void {
    try {
      const observer = new PerformanceObserver((list) => {
        if (Math.random() <= this.config.sampleRate) {
          callback(list.getEntries());
        }
      });

      observer.observe({ type, buffered: true });
      this.observers.set(type, observer);
    } catch (error) {
      console.warn(`Failed to observe ${type} entries:`, error);
    }
  }

  // Métodos públicos

  // Iniciar un timer
  startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }

  // Finalizar un timer
  endTimer(name: string, tags?: Record<string, string>): number {
    const startTime = this.timers.get(name);
    if (startTime === undefined) {
      console.warn(`Timer ${name} was not started`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(name);

    this.addMetric({
      name,
      value: duration,
      timestamp: Date.now(),
      type: 'timing',
      unit: 'ms',
      tags,
    });

    return duration;
  }

  // Medir una función
  measure<T>(name: string, fn: () => T, tags?: Record<string, string>): T {
    this.startTimer(name);
    try {
      const result = fn();
      this.endTimer(name, tags);
      return result;
    } catch (error) {
      this.endTimer(name, { ...tags, error: 'true' });
      throw error;
    }
  }

  // Medir una función async
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    this.startTimer(name);
    try {
      const result = await fn();
      this.endTimer(name, tags);
      return result;
    } catch (error) {
      this.endTimer(name, { ...tags, error: 'true' });
      throw error;
    }
  }

  // Incrementar contador
  incrementCounter(name: string, value: number = 1, tags?: Record<string, string>): void {
    const currentValue = this.counters.get(name) || 0;
    const newValue = currentValue + value;
    this.counters.set(name, newValue);

    this.addMetric({
      name,
      value: newValue,
      timestamp: Date.now(),
      type: 'counter',
      tags,
    });
  }

  // Establecer gauge
  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    this.addMetric({
      name,
      value,
      timestamp: Date.now(),
      type: 'gauge',
      tags,
    });
  }

  // Agregar métrica personalizada
  addMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Limpiar métricas antiguas si excedemos el límite
    if (this.metrics.length > this.config.maxMetrics) {
      this.metrics = this.metrics.slice(-this.config.maxMetrics);
    }
  }

  // Obtener métricas
  getMetrics(filter?: {
    name?: string;
    type?: PerformanceMetric['type'];
    since?: number;
    tags?: Record<string, string>;
  }): PerformanceMetric[] {
    let filtered = this.metrics;

    if (filter) {
      if (filter.name) {
        filtered = filtered.filter(m => m.name === filter.name);
      }
      if (filter.type) {
        filtered = filtered.filter(m => m.type === filter.type);
      }
      if (filter.since) {
        filtered = filtered.filter(m => m.timestamp >= filter.since!);
      }
      if (filter.tags) {
        filtered = filtered.filter(m => {
          if (!m.tags) return false;
          return Object.entries(filter.tags!).every(
            ([key, value]) => m.tags![key] === value
          );
        });
      }
    }

    return filtered;
  }

  // Generar reporte
  generateReport(timeRange?: { start: number; end: number }): PerformanceReport {
    const metrics = timeRange
      ? this.metrics.filter(m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end)
      : this.metrics;

    const averages: Record<string, number> = {};
    const peaks: Record<string, number> = {};
    const vitals: PerformanceReport['vitals'] = {};

    // Calcular estadísticas
    const metricsByName = new Map<string, number[]>();
    
    metrics.forEach(metric => {
      if (!metricsByName.has(metric.name)) {
        metricsByName.set(metric.name, []);
      }
      metricsByName.get(metric.name)!.push(metric.value);

      // Recopilar Web Vitals
      if (metric.tags?.vital === 'true') {
        switch (metric.name) {
          case 'fcp':
            vitals.fcp = metric.value;
            break;
          case 'lcp':
            vitals.lcp = metric.value;
            break;
          case 'fid':
            vitals.fid = metric.value;
            break;
          case 'cls':
            vitals.cls = metric.value;
            break;
          case 'ttfb':
            vitals.ttfb = metric.value;
            break;
        }
      }
    });

    // Calcular promedios y picos
    metricsByName.forEach((values, name) => {
      averages[name] = values.reduce((sum, val) => sum + val, 0) / values.length;
      peaks[name] = Math.max(...values);
    });

    return {
      metrics,
      summary: {
        totalMetrics: metrics.length,
        timeRange: timeRange || {
          start: Math.min(...metrics.map(m => m.timestamp)),
          end: Math.max(...metrics.map(m => m.timestamp)),
        },
        averages,
        peaks,
      },
      vitals,
    };
  }

  // Limpiar métricas
  clearMetrics(): void {
    this.metrics = [];
    this.counters.clear();
  }

  // Exportar métricas
  exportMetrics(): string {
    return JSON.stringify({
      metrics: this.metrics,
      counters: Object.fromEntries(this.counters),
      timestamp: Date.now(),
    });
  }

  // Destruir monitor
  destroy(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.timers.clear();
    this.counters.clear();
    this.metrics = [];
  }

  // Métodos privados auxiliares

  private getResourceType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension || '')) {
      return 'image';
    } else if (['js', 'mjs'].includes(extension || '')) {
      return 'script';
    } else if (['css'].includes(extension || '')) {
      return 'stylesheet';
    } else if (['woff', 'woff2', 'ttf', 'otf'].includes(extension || '')) {
      return 'font';
    } else if (url.includes('/api/')) {
      return 'api';
    } else {
      return 'other';
    }
  }
}

// Instancia global del monitor
export const performanceMonitor = new PerformanceMonitor();

// Decorador para medir métodos
export function measureMethod(name?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const metricName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = function (...args: any[]) {
      return performanceMonitor.measure(metricName, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

// Decorador para medir métodos async
export function measureAsyncMethod(name?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const metricName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = function (...args: any[]) {
      return performanceMonitor.measureAsync(metricName, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

// Utilidades para React
export const withPerformanceTracking = <P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) => {
  const WrappedComponent = (props: P) => {
    const name = componentName || Component.displayName || Component.name || 'Component';
    
    React.useEffect(() => {
      performanceMonitor.startTimer(`${name}_mount`);
      return () => {
        performanceMonitor.endTimer(`${name}_mount`);
      };
    }, []);

    return React.createElement(Component, props);
  };

  WrappedComponent.displayName = `withPerformanceTracking(${Component.displayName || Component.name})`;
  return WrappedComponent;
};