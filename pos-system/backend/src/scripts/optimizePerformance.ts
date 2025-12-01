import { createDatabaseIndexes } from '../middleware/performance';
import { sequelize } from '../db/config';

async function optimizePerformance() {
  console.log('🚀 Starting performance optimization...\n');

  try {
    // Test database connection
    console.log('📡 Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connection successful\n');

    // Create database indexes
    console.log('📊 Creating database indexes...');
    await createDatabaseIndexes();
    console.log('');

    // Analyze current database performance
    console.log('🔍 Analyzing database performance...');
    
    // Get table sizes
    const tables = ['products', 'sales', 'clients', 'users', 'audit_trail', 'job_queue'];
    
    for (const table of tables) {
      try {
        const [result] = await sequelize.query(`SELECT COUNT(*) as count FROM ${table}`) as any[];
        const count = result[0].count;
        console.log(`📋 Table ${table}: ${count} records`);
      } catch (error: any) {
        console.log(`⚠️  Could not analyze table ${table}: ${error.message}`);
      }
    }
    
    console.log('');

    // Check for missing indexes
    console.log('🔎 Checking for potential performance issues...');
    
    // Check for products without indexes
    try {
      const [productsWithoutIndexes] = await sequelize.query(`
        SELECT COUNT(*) as count FROM products 
        WHERE category IS NULL OR category = ''
      `) as any[];
      
      if (productsWithoutIndexes[0].count > 0) {
        console.log(`⚠️  ${productsWithoutIndexes[0].count} products without category (may affect indexing)`);
      }
    } catch (error: any) {
      console.log('⚠️  Could not check product categories');
    }

    // Check for old audit records that could be archived
    try {
      const [oldAuditRecords] = await sequelize.query(`
        SELECT COUNT(*) as count FROM audit_trail 
        WHERE createdAt < datetime('now', '-6 months')
      `) as any[];
      
      if (oldAuditRecords[0].count > 1000) {
        console.log(`💡 Consider archiving ${oldAuditRecords[0].count} old audit records (> 6 months)`);
      }
    } catch (error: any) {
      console.log('⚠️  Could not check old audit records');
    }

    // Check for completed jobs that could be cleaned up
    try {
      const [oldJobs] = await sequelize.query(`
        SELECT COUNT(*) as count FROM job_queue 
        WHERE status IN ('completed', 'failed') 
        AND createdAt < datetime('now', '-1 month')
      `) as any[];
      
      if (oldJobs[0].count > 100) {
        console.log(`💡 Consider cleaning up ${oldJobs[0].count} old completed/failed jobs (> 1 month)`);
      }
    } catch (error: any) {
      console.log('⚠️  Could not check old jobs');
    }

    console.log('');
    console.log('✅ Performance optimization completed successfully!');
    console.log('');
    console.log('📈 Performance Recommendations:');
    console.log('   • Monitor slow queries regularly');
    console.log('   • Consider archiving old audit records');
    console.log('   • Clean up old completed jobs periodically');
    console.log('   • Monitor cache hit rates');
    console.log('   • Review database indexes quarterly');

  } catch (error: any) {
    console.error('❌ Performance optimization failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run optimization
optimizePerformance();