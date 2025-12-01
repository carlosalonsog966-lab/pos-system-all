import { createEnhancedLogger, logAudit, logPerformance } from '../utils/enhancedLogger';
import { MonitoringService } from '../services/monitoringService';

async function testEnhancedLogging() {
  console.log('🧪 Testing enhanced logging system...\n');

  try {
    // Crear logger mejorado
    const logger = createEnhancedLogger();
    
    console.log('✅ Enhanced logger created successfully');
    
    // Probar diferentes niveles de logging
    console.log('\n📋 Testing different log levels:');
    
    logger.info('TEST_INFO', { 
      message: 'This is an info message',
      timestamp: new Date().toISOString(),
      test: true 
    });
    
    logger.warn('TEST_WARNING', { 
      message: 'This is a warning message',
      details: 'Something might be wrong',
      test: true 
    });
    
    logger.error('TEST_ERROR', { 
      message: 'This is an error message',
      error: 'Something went wrong',
      stack: new Error('Test error').stack,
      test: true 
    });
    
    logger.debug('TEST_DEBUG', { 
      message: 'This is a debug message',
      debugData: { foo: 'bar', num: 42 },
      test: true 
    });
    
    console.log('✅ All log levels tested');
    
    // Probar logging de auditoría
    console.log('\n🔐 Testing audit logging:');
    
    logAudit('USER_LOGIN', 'user123', {
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0 Test Browser',
      success: true,
      timestamp: new Date().toISOString()
    });
    
    logAudit('USER_LOGOUT', 'user123', {
      sessionDuration: 3600, // 1 hour in seconds
      timestamp: new Date().toISOString()
    });
    
    logAudit('PRODUCT_CREATED', 'admin456', {
      productId: 'prod789',
      productName: 'Test Product',
      price: 99.99,
      timestamp: new Date().toISOString()
    });
    
    console.log('✅ Audit logging tested');
    
    // Probar logging de rendimiento
    console.log('\n⚡ Testing performance logging:');
    
    // Simular operaciones con diferentes duraciones
    const operations = [
      { name: 'DATABASE_QUERY', duration: 150, details: { query: 'SELECT * FROM products', rows: 42 } },
      { name: 'API_CALL', duration: 850, details: { endpoint: '/api/products', method: 'GET', status: 200 } },
      { name: 'FILE_UPLOAD', duration: 2500, details: { fileSize: '2.5MB', fileType: 'image/jpeg' } },
      { name: 'REPORT_GENERATION', duration: 5200, details: { reportType: 'sales', dateRange: '30 days' } }
    ];
    
    operations.forEach(op => {
      logPerformance(op.name, op.duration, op.details);
    });
    
    console.log('✅ Performance logging tested');
    
    // Probar logging con datos del sistema de monitoreo
    console.log('\n📊 Testing monitoring data logging:');
    
    const monitoringService = MonitoringService.getInstance();
    const metrics = await monitoringService.collectMetrics();
    
    logger.info('SYSTEM_METRICS', {
      memoryUsage: `${metrics.memory.percentage.toFixed(1)}%`,
      cpuUsage: `${metrics.cpu.usage}%`,
      uptime: `${metrics.uptime.toFixed(0)}s`,
      cacheHitRate: `${metrics.cache.hitRate.toFixed(1)}%`,
      avgResponseTime: `${metrics.requests.avgResponseTime.toFixed(2)}ms`,
      timestamp: metrics.timestamp.toISOString()
    });
    
    console.log('✅ Monitoring data logging tested');
    
    // Probar logging de errores complejos
    console.log('\n🚨 Testing complex error logging:');
    
    try {
      // Simular un error de base de datos
      throw new Error('Database connection timeout after 30 seconds');
    } catch (error: any) {
      logger.error('DATABASE_ERROR', {
        error: error.message,
        stack: error.stack,
        context: 'product_creation',
        userId: 'user123',
        timestamp: new Date().toISOString(),
        recoverySuggestion: 'Check database connection settings and network connectivity'
      });
    }
    
    console.log('✅ Complex error logging tested');
    
    // Esperar un momento para asegurar que los logs se escriban
    console.log('\n⏳ Waiting for logs to be written...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n✅ Enhanced logging system test completed successfully!');
    console.log('\n📁 Log files created:');
    console.log('   • logs/combined-YYYY-MM-DD.log (general logs)');
    console.log('   • logs/error-YYYY-MM-DD.log (error logs)');
    console.log('   • logs/audit-YYYY-MM-DD.log (audit logs)');
    console.log('   • logs/performance-YYYY-MM-DD.log (performance logs)');
    
  } catch (error: any) {
    console.error('❌ Enhanced logging test failed:', error.message);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testEnhancedLogging();
}

export { testEnhancedLogging };