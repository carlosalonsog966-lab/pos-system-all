import { MonitoringService } from '../services/monitoringService';
import { logger } from '../middleware/logger';

async function startMonitoring() {
  console.log('🚀 Starting system monitoring...\n');

  try {
    const monitoringService = MonitoringService.getInstance();
    
    // Iniciar monitoreo con intervalo de 30 segundos
    monitoringService.startMonitoring(30000);
    
    console.log('✅ System monitoring started successfully!');
    console.log('📊 Monitoring interval: 30 seconds');
    console.log('📈 Metrics will be collected and stored automatically');
    console.log('⚠️  Alerts will be generated for performance issues\n');
    
    // Mostrar métricas iniciales
    setTimeout(async () => {
      const metrics = monitoringService.getCurrentMetrics();
      if (metrics) {
        console.log('📋 Current System Metrics:');
        console.log(`   • Memory Usage: ${metrics.memory.percentage.toFixed(1)}%`);
        console.log(`   • CPU Usage: ${metrics.cpu.usage}%`);
        console.log(`   • Database Queries: ${metrics.database.totalQueries}`);
        console.log(`   • Slow Queries: ${metrics.database.slowQueries}`);
        console.log(`   • Cache Hit Rate: ${metrics.cache.hitRate.toFixed(1)}%`);
        console.log(`   • Avg Response Time: ${metrics.requests.avgResponseTime.toFixed(2)}ms`);
      }
    }, 2000);
    
    // Manejar cierre graceful
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping system monitoring...');
      monitoringService.stopMonitoring();
      console.log('✅ System monitoring stopped');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('\n🛑 Stopping system monitoring...');
      monitoringService.stopMonitoring();
      console.log('✅ System monitoring stopped');
      process.exit(0);
    });
    
  } catch (error: any) {
    console.error('❌ Failed to start system monitoring:', error.message);
    logger.error('Failed to start system monitoring', { error });
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  startMonitoring();
}

export { startMonitoring };