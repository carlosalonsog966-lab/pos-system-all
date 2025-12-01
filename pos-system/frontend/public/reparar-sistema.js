// Script de reparación automática para el sistema POS
// Este script limpia todas las configuraciones que puedan causar modo offline

console.log('🔧 INICIANDO REPARACIÓN AUTOMÁTICA DEL SISTEMA POS');

// Función para limpiar configuraciones problemáticas
function limpiarConfiguraciones() {
    console.log('🧹 Limpiando configuraciones problemáticas...');
    
    const configuracionesProblemas = [
        // Configuraciones de modo offline/mock
        'observability:useMocks',
        '__lastBackendStatus',
        'backendDown',
        'backendStatus',
        'useMocks',
        'lastHealthCheck',
        '__backendStatus',
        'forceOfflineMode',
        '__backendDown',
        '__useMocks',
        '__lastBackendCheck',
        'backendStatusOverride',
        'forceMockMode',
        'offlineMode',
        'mockMode',
        'forceLocalMode',
        
        // Configuraciones de caché y estado
        '__backendStatusCheck',
        'lastConnectionAttempt',
        'connectionFailures',
        'backendConnectionStatus',
        'apiConnectionStatus',
        
        // Configuraciones del sistema
        'pos:offlineMode',
        'pos:useMocks',
        'pos:backendDown',
        'system:offlineMode',
        'system:useMocks'
    ];
    
    let limpiadas = 0;
    configuracionesProblemas.forEach(key => {
        if (localStorage.getItem(key) !== null) {
            console.log(`🗑️ Eliminando: ${key} = ${localStorage.getItem(key)}`);
            localStorage.removeItem(key);
            limpiadas++;
        }
    });
    
    console.log(`✅ ${limpiadas} configuraciones problemáticas eliminadas`);
    return limpiadas;
}

// Función para verificar y resetear el estado del backend
function resetearEstadoBackend() {
    console.log('🔄 Resetenado estado del backend...');
    
    // Forzar verificación nueva del backend
    localStorage.setItem('__lastBackendStatus', 'unknown');
    localStorage.removeItem('backendDown');
    localStorage.removeItem('__backendDown');
    
    console.log('✅ Estado del backend reseteado');
}

// Función para verificar conexión real
async function verificarConexionReal() {
    console.log('🌐 Verificando conexión real con el backend...');
    
    const endpoints = [
        '/api/health',
        '/api/test-health',
        '/api/categories',
        '/api/settings/public'
    ];
    
    let conexionExitosa = false;
    let ultimoError = null;
    
    for (const endpoint of endpoints) {
        try {
            console.log(`🔄 Probando: ${endpoint}`);
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Éxito en ${endpoint}:`, data.message || 'Conexión establecida');
                conexionExitosa = true;
                break;
            } else {
                console.log(`⚠️ ${endpoint} respondió con estado: ${response.status}`);
            }
        } catch (error) {
            console.log(`❌ Falló ${endpoint}: ${error.message}`);
            ultimoError = error.message;
        }
    }
    
    return { exitosa: conexionExitosa, error: ultimoError };
}

// Función para forzar modo online
function forzarModoOnline() {
    console.log('🚀 Forzando modo online...');
    
    // Eliminar cualquier indicador de modo offline
    localStorage.removeItem('forceOfflineMode');
    localStorage.removeItem('offlineMode');
    localStorage.removeItem('mockMode');
    
    // Establecer que el sistema debe usar el backend real
    localStorage.setItem('forceOnlineMode', 'true');
    localStorage.setItem('__backendStatus', 'ok');
    
    console.log('✅ Sistema forzado a modo online');
}

// Función principal de reparación
async function repararSistema() {
    console.log('');
    console.log('🛠️ INICIANDO REPARACIÓN COMPLETA DEL SISTEMA');
    console.log('='.repeat(50));
    
    try {
        // Paso 1: Limpiar configuraciones
        const limpiadas = limpiarConfiguraciones();
        
        // Paso 2: Resetear estado del backend
        resetearEstadoBackend();
        
        // Paso 3: Forzar modo online
        forzarModoOnline();
        
        // Paso 4: Verificar conexión real
        console.log('');
        console.log('🔍 VERIFICANDO CONEXIÓN REAL...');
        const resultado = await verificarConexionReal();
        
        // Paso 5: Resultado final
        console.log('');
        console.log('='.repeat(50));
        
        if (resultado.exitosa) {
            console.log('🎉 ¡REPARACIÓN EXITOSA!');
            console.log('✅ El sistema ahora está conectado al backend');
            console.log('✅ Las categorías y otros datos deberían cargar correctamente');
            
            // Limpiar el forzador de modo online para que funcione normalmente
            setTimeout(() => {
                localStorage.removeItem('forceOnlineMode');
                console.log('🔄 Modo forzado online desactivado - sistema funcionando normalmente');
            }, 2000);
            
        } else {
            console.log('❌ REPARACIÓN INCOMPLETA');
            console.log(`💡 Problema persistente: ${resultado.error}`);
            console.log('');
            console.log('🔧 SUGERENCIAS:');
            console.log('1. Verifica que el backend esté ejecutándose: cd backend && npm start');
            console.log('2. Comprueba que el puerto 5757 esté disponible');
            console.log('3. Reinicia el servidor backend');
            console.log('4. Verifica la configuración del proxy en vite.config.ts');
        }
        
        console.log('');
        console.log('🔄 La página se recargará automáticamente en 3 segundos...');
        
        setTimeout(() => {
            window.location.href = '/';
        }, 3000);
        
    } catch (error) {
        console.error('❌ ERROR EN LA REPARACIÓN:', error.message);
        alert('Error durante la reparación: ' + error.message);
    }
}

// Función de diagnóstico rápido
function diagnosticoRapido() {
    console.log('🔍 DIAGNÓSTICO RÁPIDO DEL SISTEMA');
    console.log('='.repeat(30));
    
    // Verificar almacenamiento local
    const problemas = [];
    const claves = Object.keys(localStorage);
    
    claves.forEach(key => {
        if (key.includes('mock') || key.includes('offline') || key.includes('backend') || key.includes('down')) {
            problemas.push({ key, value: localStorage.getItem(key) });
        }
    });
    
    if (problemas.length > 0) {
        console.log('⚠️ Problemas detectados en almacenamiento:');
        problemas.forEach(p => console.log(`  - ${p.key}: ${p.value}`));
    } else {
        console.log('✅ No se detectaron problemas obvios en almacenamiento');
    }
    
    return problemas.length > 0;
}

// Verificar si hay problemas al cargar
window.addEventListener('load', () => {
    console.log('🔧 Herramienta de reparación cargada');
    
    const hayProblemas = diagnosticoRapido();
    
    if (hayProblemas) {
        console.log('');
        console.log('💡 Se detectaron problemas. ¿Deseas reparar el sistema?');
        console.log('📞 Ejecuta: repararSistema()');
        
        // Mostrar botón de reparación si existe un contenedor
        const container = document.getElementById('repair-container');
        if (container) {
            container.innerHTML = `
                <div style="position: fixed; top: 20px; right: 20px; background: #e74c3c; color: white; padding: 15px; border-radius: 8px; z-index: 9999;">
                    <strong>⚠️ Problemas detectados en el sistema</strong><br>
                    <button onclick="repararSistema()" style="background: white; color: #e74c3c; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 10px;">
                        🛠️ Reparar Sistema
                    </button>
                </div>
            `;
        }
    }
});

// Hacer la función disponible globalmente
window.repararSistema = repararSistema;
window.diagnosticoRapido = diagnosticoRapido;

console.log('✅ Herramienta de reparación lista para usar');
console.log('📞 Comandos disponibles:');
console.log('  - repararSistema() : Ejecuta reparación completa');
console.log('  - diagnosticoRapido() : Verifica problemas rápidamente');