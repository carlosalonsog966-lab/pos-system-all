import { sequelize } from '../db/config';
import { initializeModels } from '../models';
import { Op } from 'sequelize';

async function wipeSeedData(seedBatchId: string) {
  try {
    console.log(`🧹 Iniciando limpieza de datos para Batch ID: ${seedBatchId}`);

    // Inicializar modelos
    const { User, Product, Client, Sale, SaleItem, CashRegister } = await initializeModels();

    // Iniciar transacción
    const transaction = await sequelize.transaction();

    try {
      // 1. Eliminar SaleItems de ventas del batch
      console.log('🗑️  Eliminando items de ventas...');
      const sales = await Sale.findAll({
        where: {
          notes: {
            [Op.like]: `%${seedBatchId}%`
          }
        },
        transaction
      });

      const saleIds = sales.map(sale => sale.id);
      
      if (saleIds.length > 0) {
        const deletedSaleItems = await SaleItem.destroy({
          where: {
            saleId: {
              [Op.in]: saleIds
            }
          },
          transaction
        });
        console.log(`   ✅ ${deletedSaleItems} items de ventas eliminados`);
      }

      // 2. Eliminar Sales del batch
      console.log('🗑️  Eliminando ventas...');
      const deletedSales = await Sale.destroy({
        where: {
          notes: {
            [Op.like]: `%${seedBatchId}%`
          }
        },
        transaction
      });
      console.log(`   ✅ ${deletedSales} ventas eliminadas`);

      // 3. Eliminar Products del batch
      console.log('🗑️  Eliminando productos...');
      const deletedProducts = await Product.destroy({
        where: {
          supplier: {
            [Op.like]: `%${seedBatchId}%`
          }
        },
        transaction
      });
      console.log(`   ✅ ${deletedProducts} productos eliminados`);

      // 4. Eliminar Clients del batch
      console.log('🗑️  Eliminando clientes...');
      const deletedClients = await Client.destroy({
        where: {
          notes: {
            [Op.like]: `%${seedBatchId}%`
          }
        },
        transaction
      });
      console.log(`   ✅ ${deletedClients} clientes eliminados`);

      // 5. Eliminar CashRegisters del batch
      console.log('🗑️  Eliminando registros de caja...');
      const deletedCashRegisters = await CashRegister.destroy({
        where: {
          notes: {
            [Op.like]: `%${seedBatchId}%`
          }
        },
        transaction
      });
      console.log(`   ✅ ${deletedCashRegisters} registros de caja eliminados`);

      // Confirmar transacción
      await transaction.commit();

      console.log('\n✅ LIMPIEZA COMPLETADA EXITOSAMENTE');
      console.log('==================================');
      console.log(`📦 Batch ID limpiado: ${seedBatchId}`);
      console.log(`🗑️  Ventas eliminadas: ${deletedSales}`);
      console.log(`🗑️  Items eliminados: ${saleIds.length > 0 ? 'Sí' : 'No'}`);
      console.log(`🗑️  Productos eliminados: ${deletedProducts}`);
      console.log(`🗑️  Clientes eliminados: ${deletedClients}`);
      console.log(`🗑️  Cajas eliminadas: ${deletedCashRegisters}`);

      return {
        batchId: seedBatchId,
        deleted: {
          sales: deletedSales,
          products: deletedProducts,
          clients: deletedClients,
          cashRegisters: deletedCashRegisters
        }
      };

    } catch (error) {
      // Revertir transacción en caso de error
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    console.error('❌ Error en limpieza:', error);
    throw error;
  }
}

// Función para obtener conteos actuales
async function getCurrentCounts() {
  try {
    const { User, Product, Client, Sale, SaleItem, CashRegister } = await initializeModels();
    
    const counts = {
      users: await User.count(),
      products: await Product.count(),
      clients: await Client.count(),
      sales: await Sale.count(),
      saleItems: await SaleItem.count(),
      cashRegisters: await CashRegister.count()
    };

    console.log('\n📊 CONTEOS ACTUALES');
    console.log('==================');
    console.log(`👤 Usuarios: ${counts.users}`);
    console.log(`📦 Productos: ${counts.products}`);
    console.log(`👥 Clientes: ${counts.clients}`);
    console.log(`🛒 Ventas: ${counts.sales}`);
    console.log(`📋 Items de ventas: ${counts.saleItems}`);
    console.log(`💰 Registros de caja: ${counts.cashRegisters}`);

    return counts;
  } catch (error) {
    console.error('❌ Error obteniendo conteos:', error);
    throw error;
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  const args = process.argv.slice(2);
  const seedIndex = args.indexOf('--seed');
  
  if (seedIndex === -1 || !args[seedIndex + 1]) {
    console.error('❌ Uso: npx ts-node wipe_seed.ts --seed <SEED_BATCH_ID>');
    console.error('📝 Ejemplo: npx ts-node wipe_seed.ts --seed test_1698765432123');
    process.exit(1);
  }

  const seedBatchId = args[seedIndex + 1];

  // Mostrar conteos antes
  console.log('📊 CONTEOS ANTES DE LA LIMPIEZA:');
  getCurrentCounts()
    .then(() => {
      // Ejecutar limpieza
      return wipeSeedData(seedBatchId);
    })
    .then(() => {
      // Mostrar conteos después
      console.log('\n📊 CONTEOS DESPUÉS DE LA LIMPIEZA:');
      return getCurrentCounts();
    })
    .then(() => {
      console.log('\n🎉 Proceso completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

export { wipeSeedData, getCurrentCounts };