import { api, configureDualDriver, getDualDriverConfig } from './src/lib/api';
import { isTauriAvailable, executeTauriCommand } from './src/lib/tauri';

/**
 * Script de prueba para el sistema de driver dual
 * Ejecutar con: node test-dual-driver.js
 */

async function testDualDriver() {
  console.log('🚀 Iniciando pruebas del sistema de driver dual...\n');

  // Verificar disponibilidad de Tauri
  console.log('📋 Verificando disponibilidad de Tauri...');
  const tauriAvailable = isTauriAvailable();
  console.log(`Tauri disponible: ${tauriAvailable ? '✅ Sí' : '❌ No'}\n`);

  // Mostrar configuración inicial
  console.log('⚙️ Configuración inicial del driver dual:');
  const initialConfig = getDualDriverConfig();
  console.log(JSON.stringify(initialConfig, null, 2));
  console.log();

  try {
    // Test 1: Driver HTTP
    console.log('🔍 Test 1: Probando driver HTTP...');
    configureDualDriver({ preferredDriver: 'http' });
    
    console.log('Obteniendo productos vía HTTP...');
    const productsResponse = await api.get('/products');
    console.log(`✅ Productos obtenidos: ${productsResponse.data.data.length}`);
    
    console.log('Obteniendo clientes vía HTTP...');
    const clientsResponse = await api.get('/clients');
    console.log(`✅ Clientes obtenidos: ${clientsResponse.data.data.length}`);
    
    console.log('Obteniendo salud vía HTTP...');
    const healthResponse = await api.get('/health');
    console.log(`✅ Estado de salud: ${healthResponse.data.data.success ? 'OK' : 'Error'}\n`);

    // Test 2: Driver Invoke (solo si Tauri está disponible)
    if (tauriAvailable) {
      console.log('🔍 Test 2: Probando driver Invoke...');
      configureDualDriver({ preferredDriver: 'invoke' });
      
      console.log('Obteniendo productos vía Invoke...');
      const productsResult = await executeTauriCommand('products.list');
      if (productsResult.success) {
        console.log(`✅ Productos obtenidos: ${productsResult.data.length}`);
      } else {
        console.log(`❌ Error: ${productsResult.error}`);
      }
      
      console.log('Obteniendo clientes vía Invoke...');
      const clientsResult = await executeTauriCommand('clients.list');
      if (clientsResult.success) {
        console.log(`✅ Clientes obtenidos: ${clientsResult.data.length}`);
      } else {
        console.log(`❌ Error: ${clientsResult.error}`);
      }
      
      console.log('Obteniendo salud vía Invoke...');
      const healthResult = await executeTauriCommand('health.status');
      if (healthResult.success) {
        console.log(`✅ Estado de salud: ${healthResult.data.success ? 'OK' : 'Error'}`);
      } else {
        console.log(`❌ Error: ${healthResult.error}`);
      }
      console.log();
    } else {
      console.log('⚠️ Test 2: Omitido - Tauri no está disponible\n');
    }

    // Test 3: Driver automático
    console.log('🔍 Test 3: Probando driver automático (dual)...');
    configureDualDriver({ 
      preferredDriver: tauriAvailable ? 'invoke' : 'http',
      fallbackToHttp: true,
      fallbackToInvoke: true
    });
    
    console.log('Obteniendo productos con driver automático...');
    const autoProductsResponse = await api.get('/products');
    console.log(`✅ Productos obtenidos: ${autoProductsResponse.data.data.length}`);
    
    console.log('Obteniendo clientes con driver automático...');
    const autoClientsResponse = await api.get('/clients');
    console.log(`✅ Clientes obtenidos: ${autoClientsResponse.data.data.length}`);
    
    console.log('Obteniendo salud con driver automático...');
    const autoHealthResponse = await api.get('/health');
    console.log(`✅ Estado de salud: ${autoHealthResponse.data.data.success ? 'OK' : 'Error'}\n`);

    console.log('🎉 ¡Todas las pruebas del sistema de driver dual completadas exitosamente!');
    
  } catch (error) {
    console.error('❌ Error durante las pruebas:', error);
    process.exit(1);
  }
}

// Ejecutar las pruebas
testDualDriver().catch(console.error);