// 🚨 SCRIPT DE EMERGENCIA PARA PANTALLA NEGRA DEL POS
// Copiar y pegar esto en la consola del navegador (F12 -> Consola)

(function() {
    console.log('🚨 INICIANDO BYPASS DE EMERGENCIA PARA PANTALLA NEGRA');
    
    // Función para limpiar todo el estado problemático
    function clearAllProblematicState() {
        console.log('🧹 Limpiando estado problemático...');
        
        const keysToRemove = [
            '__lastBackendStatus',
            '__backendStatusOverride', 
            '__healthCheckStatus',
            'backendStatus',
            'lastHealthCheck',
            'offlineMode',
            'backendDown',
            'lastConnectionError',
            'offlineData',
            'offlineQueue',
            'pendingSync',
            'offlineProducts',
            'offlineSales',
            'offlineClients',
            'authToken',
            'user',
            'isAuthenticated',
            'authExpiration',
            'refreshToken'
        ];
        
        keysToRemove.forEach(key => {
            const value = localStorage.getItem(key);
            if (value) {
                localStorage.removeItem(key);
                console.log(`✅ Limpiado: ${key}`);
            }
        });
        
        console.log('✅ Estado problemático limpiado');
    }
    
    // Función para forzar modo online
    function forceOnlineMode() {
        console.log('⚡ Forzando modo online...');
        
        localStorage.setItem('__lastBackendStatus', 'up');
        localStorage.setItem('__backendStatusOverride', 'online');
        localStorage.setItem('__healthCheckStatus', JSON.stringify({ 
            status: 'healthy', 
            timestamp: Date.now(),
            forced: true 
        }));
        
        console.log('✅ Sistema forzado a modo online');
    }
    
    // Función para verificar el estado actual
    function checkCurrentState() {
        console.log('🔍 Verificando estado actual...');
        
        const backendStatus = localStorage.getItem('__lastBackendStatus');
        const overrideMode = localStorage.getItem('__backendStatusOverride');
        const offlineMode = localStorage.getItem('offlineMode');
        const authToken = localStorage.getItem('authToken');
        
        console.log('Estado actual:');
        console.log(`- Backend Status: ${backendStatus || 'No definido'}`);
        console.log(`- Override Mode: ${overrideMode || 'No definido'}`);
        console.log(`- Offline Mode: ${offlineMode || 'No definido'}`);
        console.log(`- Auth Token: ${authToken ? 'Presente' : 'No presente'}`);
        
        return { backendStatus, overrideMode, offlineMode, authToken };
    }
    
    // Función principal de emergencia
    function emergencyBypass() {
        console.log('🚀 INICIANDO BYPASS DE EMERGENCIA');
        console.log('=' .repeat(50));
        
        // 1. Verificar estado actual
        const currentState = checkCurrentState();
        
        // 2. Si está en modo offline, limpiar todo
        if (currentState.backendStatus === 'down' || currentState.overrideMode === 'offline' || currentState.offlineMode) {
            console.log('❌ Detectado modo offline - aplicando corrección');
            clearAllProblematicState();
            forceOnlineMode();
            
            console.log('✅ BYPASS COMPLETADO');
            console.log('🔄 La página se recargará en 3 segundos...');
            
            setTimeout(() => {
                console.log('🔄 Recargando página...');
                window.location.reload();
            }, 3000);
            
        } else {
            console.log('✅ El sistema parece estar en modo online');
            console.log('🔄 Recargando página para verificar...');
            
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
    }
    
    // Función para crear un botón de emergencia flotante
    function createEmergencyButton() {
        const button = document.createElement('button');
        button.innerHTML = '🚨 BYPASS';
        button.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 999999;
            background: #e74c3c;
            color: white;
            border: none;
            padding: 15px 20px;
            border-radius: 50px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(231, 76, 60, 0.4);
            transition: all 0.3s ease;
            font-size: 14px;
        `;
        
        button.onmouseover = () => {
            button.style.transform = 'scale(1.05)';
            button.style.boxShadow = '0 6px 16px rgba(231, 76, 60, 0.6)';
        };
        
        button.onmouseout = () => {
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 4px 12px rgba(231, 76, 60, 0.4)';
        };
        
        button.onclick = emergencyBypass;
        
        document.body.appendChild(button);
        console.log('✅ Botón de emergencia creado');
    }
    
    // Ejecutar el bypass inmediatamente
    emergencyBypass();
    
    // Crear botón flotante para futuros usos
    setTimeout(() => {
        if (document.body) {
            createEmergencyButton();
        }
    }, 1000);
    
    console.log('🎯 SCRIPT DE EMERGENCIA CARGADO');
    console.log('💡 Si el sistema sigue en negro, recarga la página (F5)');
    
})();