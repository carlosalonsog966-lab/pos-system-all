import { Op } from 'sequelize';
import { initializeJobQueue } from '../models/JobQueue';
import { sequelize } from '../db/config';

async function cleanupOrphanJobs() {
  try {
    console.log('🧹 Limpiando jobs huérfanos...');
    
    // Conectar a la base de datos e inicializar modelos
    await sequelize.authenticate();
    console.log('✅ Conexión DB establecida');
    
    // Inicializar el modelo JobQueue
    const JobQueue = initializeJobQueue(sequelize);
    await sequelize.sync();
    
    // Buscar jobs en estado 'processing' que están huérfanos
    const orphanJobs = await JobQueue.findAll({
      where: { 
        status: 'processing',
        // Jobs que llevan más de 1 hora en processing están huérfanos
        updatedAt: {
          [Op.lt]: new Date(Date.now() - 60 * 60 * 1000)
        }
      }
    });
    
    console.log(`📊 Encontrados ${orphanJobs.length} jobs huérfanos`);
    
    if (orphanJobs.length > 0) {
      // Actualizar todos a estado 'failed'
      const result = await JobQueue.update(
        { 
          status: 'failed',
          error: 'Job marcado como fallido: worker inactivo durante procesamiento'
        },
        {
          where: { 
            id: orphanJobs.map(job => job.id)
          }
        }
      );
      
      console.log(`✅ ${result[0]} jobs actualizados a 'failed'`);
    }
    
    // Verificar estado general
    const stats = await JobQueue.findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
      group: ['status']
    });
    
    console.log('\n📈 Estado actual de JobQueue:');
    stats.forEach(stat => {
      console.log(`  ${stat.get('status')}: ${stat.get('count')}`);
    });
    
    console.log('\n✅ Limpieza completada');
    
  } catch (error) {
    console.error('❌ Error en limpieza:', error);
  } finally {
    await sequelize.close();
  }
}

// Ejecutar si se corre directamente
if (require.main === module) {
  cleanupOrphanJobs();
}

export { cleanupOrphanJobs };