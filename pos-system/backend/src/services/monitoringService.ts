import { EventLogService } from './eventLogService';
import { performanceMetrics } from '../middleware/performance';
import { sequelize } from '../db/config';
import { logger } from '../middleware/logger';

export interface SystemMetrics {
  timestamp: Date;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  database: {
    connections: number;
    slowQueries: number;
    totalQueries: number;
  };
  requests: {
    total: number;
    slow: number;
    avgResponseTime: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}

export class MonitoringService {
  private static instance: MonitoringService;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private metricsHistory: SystemMetrics[] = [];
  private readonly MAX_HISTORY_SIZE = 100;

  private constructor() {}

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  /**
   * Iniciar monitoreo automático del sistema
   */
  public startMonitoring(intervalMs: number = 30000): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    console.log(`🔍 Starting system monitoring with ${intervalMs}ms interval...`);
    
    this.monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        this.storeMetrics(metrics);
        await this.checkAlerts(metrics);
      } catch (error) {
        logger.error('Error collecting system metrics', { error });
      }
    }, intervalMs);

    // Registrar evento de inicio
    EventLogService.record({
      type: 'SYSTEM',
      severity: 'info',
      message: 'System monitoring started',
      context: 'monitoring',
      details: { intervalMs }
    });
  }

  /**
   * Detener monitoreo automático
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      
      EventLogService.record({
        type: 'SYSTEM',
        severity: 'info',
        message: 'System monitoring stopped',
        context: 'monitoring'
      });
    }
  }

  /**
   * Recopilar métricas del sistema
   */
  public async collectMetrics(): Promise<SystemMetrics> {
    const memoryUsage = process.memoryUsage();
    const memoryTotal = 1024 * 1024 * 1024; // 1GB estimado
    const memoryUsed = memoryUsage.heapUsed;
    
    // Obtener estadísticas de base de datos
    let dbConnections = 0;
    let slowQueries = 0;
    let totalQueries = 0;
    
    try {
      // Estimar conexiones (para SQLite, siempre 1)
      dbConnections = 1;
      slowQueries = performanceMetrics.slowQueries;
      totalQueries = performanceMetrics.totalRequests;
    } catch (error) {
      logger.error('Error collecting database metrics', { error });
    }

    // Calcular hit rate del cache
    const totalCacheOps = performanceMetrics.cacheHits + performanceMetrics.cacheMisses;
    const cacheHitRate = totalCacheOps > 0 
      ? (performanceMetrics.cacheHits / totalCacheOps) * 100 
      : 0;

    const metrics: SystemMetrics = {
      timestamp: new Date(),
      uptime: process.uptime(),
      memory: {
        used: memoryUsed,
        total: memoryTotal,
        percentage: (memoryUsed / memoryTotal) * 100
      },
      cpu: {
        usage: await this.getCPUUsage()
      },
      database: {
        connections: dbConnections,
        slowQueries,
        totalQueries
      },
      requests: {
        total: performanceMetrics.totalRequests,
        slow: performanceMetrics.slowQueries,
        avgResponseTime: performanceMetrics.avgResponseTime
      },
      cache: {
        hits: performanceMetrics.cacheHits,
        misses: performanceMetrics.cacheMisses,
        hitRate: cacheHitRate
      }
    };

    return metrics;
  }

  /**
   * Obtener uso de CPU (simplificado)
   */
  private async getCPUUsage(): Promise<number> {
    // Método simplificado - en producción se usaría una librería como 'pidusage'
    const cpus = require('os').cpus() as Array<{ times: Record<string, number> }>;
    const avgUsage = cpus.reduce((acc: number, cpu: { times: Record<string, number> }) => {
      const timeValues = Object.values(cpu.times) as number[];
      const total = timeValues.reduce((a: number, b: number) => a + b, 0);
      const idle = cpu.times.idle as number;
      const usage = total > 0 ? (1 - idle / total) : 0;
      return acc + usage;
    }, 0) / (cpus.length || 1);
    
    return Math.round(avgUsage * 100);
  }

  /**
   * Almacenar métricas en el historial
   */
  private storeMetrics(metrics: SystemMetrics): void {
    this.metricsHistory.push(metrics);
    
    // Mantener solo el historial reciente
    if (this.metricsHistory.length > this.MAX_HISTORY_SIZE) {
      this.metricsHistory.shift();
    }
  }

  /**
   * Verificar alertas basadas en métricas
   */
  private async checkAlerts(metrics: SystemMetrics): Promise<void> {
    const alerts: string[] = [];

    // Alerta de memoria alta
    if (metrics.memory.percentage > 80) {
      alerts.push(`High memory usage: ${metrics.memory.percentage.toFixed(1)}%`);
    }

    // Alerta de CPU alta
    if (metrics.cpu.usage > 80) {
      alerts.push(`High CPU usage: ${metrics.cpu.usage}%`);
    }

    // Alerta de queries lentas
    if (metrics.requests.slow > 10) {
      alerts.push(`High number of slow queries: ${metrics.requests.slow}`);
    }

    // Alerta de bajo hit rate de cache
    if (metrics.cache.hitRate < 50 && metrics.cache.hits + metrics.cache.misses > 10) {
      alerts.push(`Low cache hit rate: ${metrics.cache.hitRate.toFixed(1)}%`);
    }

    // Registrar alertas
    if (alerts.length > 0) {
      await EventLogService.record({
        type: 'SYSTEM',
        severity: 'warning',
        message: 'System performance alerts detected',
        context: 'monitoring',
        details: {
          alerts,
          metrics: {
            memory: metrics.memory.percentage,
            cpu: metrics.cpu.usage,
            slowQueries: metrics.requests.slow,
            cacheHitRate: metrics.cache.hitRate
          }
        }
      });

      logger.warn('System performance alerts', { alerts, metrics });
    }
  }

  /**
   * Obtener métricas actuales
   */
  public getCurrentMetrics(): SystemMetrics | null {
    if (this.metricsHistory.length === 0) {
      return null;
    }
    return this.metricsHistory[this.metricsHistory.length - 1];
  }

  /**
   * Obtener historial de métricas
   */
  public getMetricsHistory(limit?: number): SystemMetrics[] {
    const history = [...this.metricsHistory];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Obtener estadísticas de rendimiento
   */
  public getPerformanceStats(): any {
    if (this.metricsHistory.length === 0) {
      return null;
    }

    const recentMetrics = this.metricsHistory.slice(-10); // Últimas 10 métricas
    
    return {
      avgMemoryUsage: recentMetrics.reduce((acc, m) => acc + m.memory.percentage, 0) / recentMetrics.length,
      avgCPUUsage: recentMetrics.reduce((acc, m) => acc + m.cpu.usage, 0) / recentMetrics.length,
      avgResponseTime: recentMetrics.reduce((acc, m) => acc + m.requests.avgResponseTime, 0) / recentMetrics.length,
      avgCacheHitRate: recentMetrics.reduce((acc, m) => acc + m.cache.hitRate, 0) / recentMetrics.length,
      totalRequests: performanceMetrics.totalRequests,
      slowQueries: performanceMetrics.slowQueries,
      uptime: process.uptime()
    };
  }

  /**
   * Limpiar métricas antiguas
   */
  public clearMetrics(): void {
    this.metricsHistory = [];
    
    // Reiniciar métricas de performance
    performanceMetrics.totalRequests = 0;
    performanceMetrics.slowQueries = 0;
    performanceMetrics.cacheHits = 0;
    performanceMetrics.cacheMisses = 0;
    performanceMetrics.avgResponseTime = 0;
    performanceMetrics.responseTimes = [];

    EventLogService.record({
      type: 'SYSTEM',
      severity: 'info',
      message: 'Performance metrics cleared',
      context: 'monitoring'
    });
  }
}

export default MonitoringService;
