import { MonitoringService } from '../services/monitoringService';
import { logger } from '../middleware/logger';

async function testMonitoring() {
  console.log('🧪 Testing system monitoring...\n');

  try {
    const monitoringService = MonitoringService.getInstance();
    
    // Iniciar monitoreo con intervalo corto para pruebas
    monitoringService.startMonitoring(5000); // 5 segundos para pruebas
    
    console.log('✅ System monitoring started for testing');
    console.log('⏳ Collecting metrics for 15 seconds...\n');
    
    // Esperar 15 segundos para recolectar algunas métricas
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Obtener métricas actuales
    const currentMetrics = monitoringService.getCurrentMetrics();
    const performanceStats = monitoringService.getPerformanceStats();
    const history = monitoringService.getMetricsHistory();
    
    console.log('📊 Current System Metrics:');
    if (currentMetrics) {
      console.log(`   • Timestamp: ${currentMetrics.timestamp.toISOString()}`);
      console.log(`   • Uptime: ${currentMetrics.uptime.toFixed(0)} seconds`);
      console.log(`   • Memory Usage: ${currentMetrics.memory.percentage.toFixed(1)}% (${(currentMetrics.memory.used / 1024 / 1024).toFixed(1)} MB)`);
      console.log(`   • CPU Usage: ${currentMetrics.cpu.usage}%`);
      console.log(`   • Database Connections: ${currentMetrics.database.connections}`);
      console.log(`   • Total Queries: ${currentMetrics.database.totalQueries}`);
      console.log(`   • Slow Queries: ${currentMetrics.database.slowQueries}`);
      console.log(`   • Cache Hit Rate: ${currentMetrics.cache.hitRate.toFixed(1)}%`);
      console.log(`   • Avg Response Time: ${currentMetrics.requests.avgResponseTime.toFixed(2)}ms`);
    } else {
      console.log('   ⚠️  No metrics collected yet');
    }
    
    console.log('\n📈 Performance Stats:');
    if (performanceStats) {
      console.log(`   • Average Memory Usage: ${performanceStats.avgMemoryUsage.toFixed(1)}%`);
      console.log(`   • Average CPU Usage: ${performanceStats.avgCPUUsage.toFixed(1)}%`);
      console.log(`   • Average Response Time: ${performanceStats.avgResponseTime.toFixed(2)}ms`);
      console.log(`   • Average Cache Hit Rate: ${performanceStats.avgCacheHitRate.toFixed(1)}%`);
      console.log(`   • Total Requests: ${performanceStats.totalRequests}`);
      console.log(`   • Slow Queries: ${performanceStats.slowQueries}`);
      console.log(`   • Uptime: ${performanceStats.uptime.toFixed(0)} seconds`);
    }
    
    console.log(`\n📜 Metrics History: ${history.length} records`);
    
    // Probar endpoints de monitoreo
    console.log('\n🌐 Testing monitoring endpoints...');
    
    // Test monitoring status endpoint
    try {
      const response = await fetch('http://localhost:3000/api/monitoring/status');
      if (response.ok) {
        const data = await response.json();
        console.log('✅ /api/monitoring/status endpoint working');
        console.log(`   • Monitoring active: ${data.monitoring.active}`);
        console.log(`   • History size: ${data.monitoring.historySize}`);
      } else {
        console.log(`❌ /api/monitoring/status endpoint failed: ${response.status}`);
      }
    } catch (error: any) {
      console.log(`⚠️  Could not test /api/monitoring/status: ${error.message}`);
    }
    
    // Test performance metrics endpoint
    try {
      const response = await fetch('http://localhost:3000/api/performance/metrics');
      if (response.ok) {
        const data = await response.json();
        console.log('✅ /api/performance/metrics endpoint working');
        console.log(`   • Total requests: ${data.metrics.totalRequests}`);
        console.log(`   • Cache hit rate: ${data.metrics.cacheHitRate}`);
        console.log(`   • Avg response time: ${data.metrics.avgResponseTime}`);
      } else {
        console.log(`❌ /api/performance/metrics endpoint failed: ${response.status}`);
      }
    } catch (error: any) {
      console.log(`⚠️  Could not test /api/performance/metrics: ${error.message}`);
    }
    
    console.log('\n✅ System monitoring test completed successfully!');
    
    // Detener monitoreo
    monitoringService.stopMonitoring();
    console.log('🛑 System monitoring stopped');
    
  } catch (error: any) {
    console.error('❌ System monitoring test failed:', error.message);
    logger.error('System monitoring test failed', { error });
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testMonitoring();
}

export { testMonitoring };