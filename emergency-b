<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🚨 Bypass Emergencia - POS System</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', system-ui, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container { 
            background: white; 
            border-radius: 16px; 
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
            max-width: 500px;
            width: 100%;
            animation: slideIn 0.5s ease-out;
        }
        @keyframes slideIn {
            from { transform: translateY(-50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        .header { 
            background: linear-gradient(135deg, #e74c3c, #c0392b); 
            color: white; 
            padding: 30px; 
            text-align: center;
        }
        .header h1 { font-size: 24px; margin-bottom: 10px; }
        .header p { opacity: 0.9; font-size: 14px; }
        .content { padding: 30px; }
        .status { 
            padding: 15px; 
            border-radius: 8px; 
            margin: 15px 0;
            text-align: center;
            font-weight: 500;
        }
        .offline { background: #fee; color: #c33; border: 1px solid #fcc; }
        .online { background: #efe; color: #363; border: 1px solid #cfc; }
        .warning { background: #ffe; color: #663; border: 1px solid #ffc; }
        .btn {
            width: 100%;
            padding: 15px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            margin: 10px 0;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .btn-primary {
            background: linear-gradient(135deg, #3498db, #2980b9);
            color: white;
        }
        .btn-success {
            background: linear-gradient(135deg, #27ae60, #229954);
            color: white;
        }
        .btn-danger {
            background: linear-gradient(135deg, #e74c3c, #c0392b);
            color: white;
        }
        .btn-warning {
            background: linear-gradient(135deg, #f39c12, #e67e22);
            color: white;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(0,0,0,0.2);
        }
        .btn:active {
            transform: translateY(0);
        }
        .info-box {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
            font-size: 13px;
            color: #6c757d;
        }
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 10px;
            vertical-align: middle;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .hidden { display: none; }
        .result { 
            margin: 15px 0; 
            padding: 15px; 
            border-radius: 8px; 
            font-weight: 500;
            text-align: center;
        }
        .result.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .result.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .result.info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 Sistema de Bypass Emergencia</h1>
            <p>Restauración rápida del sistema POS</p>
        </div>
        
        <div class="content">
            <div id="current-status" class="status offline">
                <span>Analizando estado del sistema...</span>
            </div>
            
            <div class="info-box">
                <strong>ℹ️ Instrucciones:</strong><br>
                1. Haz clic en "FORZAR MODO ONLINE" para restaurar el sistema<br>
                2. Espera 3 segundos y el sistema se recargará automáticamente<br>
                3. Si el problema persiste, usa "LIMPIAR TODO Y REINICIAR"
            </div>
            
            <button class="btn btn-success" onclick="forceOnline()">
                ⚡ FORZAR MODO ONLINE
            </button>
            
            <button class="btn btn-warning" onclick="clearOfflineCache()">
                🧹 LIMPIAR MODO OFFLINE
            </button>
            
            <button class="btn btn-primary" onclick="resetAuthState()">
                🔑 RESETEAR AUTENTICACIÓN
            </button>
            
            <button class="btn btn-danger" onclick="nuclearOption()">
                💥 LIMPIAR TODO Y REINICIAR
            </button>
            
            <div id="result" class="hidden"></div>
            
            <div class="info-box">
                <strong>🔧 Estado del Sistema:</strong><br>
                <div id="system-info"></div>
            </div>
            
            <button class="btn btn-success" onclick="goToSystem()" style="margin-top: 20px;">
                🚀 IR AL SISTEMA POS
            </button>
        </div>
    </div>

    <script>
        function updateStatus(message, type = 'offline') {
            const statusDiv = document.getElementById('current-status');
            statusDiv.className = `status ${type}`;
            statusDiv.innerHTML = `<span>${message}</span>`;
        }
        
        function showResult(message, type = 'success') {
            const resultDiv = document.getElementById('result');
            resultDiv.className = `result ${type}`;
            resultDiv.textContent = message;
            resultDiv.classList.remove('hidden');
            
            setTimeout(() => {
                resultDiv.classList.add('hidden');
            }, 5000);
        }
        
        function updateSystemInfo() {
            const infoDiv = document.getElementById('system-info');
            
            const backendStatus = localStorage.getItem('__lastBackendStatus') || 'No definido';
            const overrideMode = localStorage.getItem('__backendStatusOverride') || 'No definido';
            const healthCheck = localStorage.getItem('__healthCheckStatus') || 'No definido';
            const authToken = localStorage.getItem('authToken') || 'No presente';
            const userData = localStorage.getItem('user') || 'No presente';
            const offlineMode = localStorage.getItem('offlineMode') || 'No definido';
            
            infoDiv.innerHTML = `
                <div><strong>Backend Status:</strong> ${backendStatus}</div>
                <div><strong>Override Mode:</strong> ${overrideMode}</div>
                <div><strong>Health Check:</strong> ${healthCheck.length > 50 ? 'Presente' : healthCheck}</div>
                <div><strong>Auth Token:</strong> ${authToken.length > 10 ? 'Presente' : authToken}</div>
                <div><strong>User Data:</strong> ${userData.length > 10 ? 'Presente' : userData}</div>
                <div><strong>Offline Mode:</strong> ${offlineMode}</div>
            `;
        }
        
        function forceOnline() {
            updateStatus('⚡ Forzando modo online...', 'warning');
            
            // Limpiar todo el estado de offline
            localStorage.setItem('__lastBackendStatus', 'up');
            localStorage.setItem('__backendStatusOverride', 'online');
            localStorage.setItem('__healthCheckStatus', JSON.stringify({ 
                status: 'healthy', 
                timestamp: Date.now(),
                forced: true 
            }));
            
            // Limpiar otros estados problemáticos
            localStorage.removeItem('offlineMode');
            localStorage.removeItem('backendDown');
            localStorage.removeItem('lastConnectionError');
            
            showResult('✅ Sistema forzado a modo online. Redirigiendo en 3 segundos...', 'success');
            
            setTimeout(() => {
                window.location.href = '/';
            }, 3000);
        }
        
        function clearOfflineCache() {
            updateStatus('🧹 Limpiando caché offline...', 'warning');
            
            const offlineKeys = [
                'offlineMode',
                'offlineData',
                'offlineQueue',
                'lastSyncTime',
                'pendingSync',
                'offlineProducts',
                'offlineSales',
                'offlineClients'
            ];
            
            offlineKeys.forEach(key => {
                localStorage.removeItem(key);
            });
            
            showResult('✅ Caché offline limpiado correctamente', 'success');
            updateStatus('Sistema listo. Intenta forzar modo online.', 'warning');
        }
        
        function resetAuthState() {
            updateStatus('🔑 Reseteando autenticación...', 'warning');
            
            const authKeys = [
                'authToken',
                'user',
                'isAuthenticated',
                'authExpiration',
                'refreshToken',
                'rememberMe'
            ];
            
            authKeys.forEach(key => {
                localStorage.removeItem(key);
            });
            
            showResult('✅ Estado de autenticación reseteado', 'success');
        }
        
        function nuclearOption() {
            if (confirm('⚠️ ¿Estás seguro? Esto limpiará TODA la configuración del sistema y recargará la página.')) {
                updateStatus('💥 Ejecutando opción nuclear...', 'warning');
                
                // Limpiar TODO el localStorage excepto cosas críticas
                const keepKeys = ['theme', 'language', 'currency'];
                const allKeys = Object.keys(localStorage);
                
                allKeys.forEach(key => {
                    if (!keepKeys.includes(key)) {
                        localStorage.removeItem(key);
                    }
                });
                
                showResult('✅ Sistema completamente reseteado. Recargando...', 'success');
                
                setTimeout(() => {
                    location.reload();
                }, 2000);
            }
        }
        
        function goToSystem() {
            updateStatus('🚀 Redirigiendo al sistema POS...', 'warning');
            
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        }
        
        // Inicializar
        document.addEventListener('DOMContentLoaded', () => {
            updateSystemInfo();
            
            // Detectar estado actual
            const backendStatus = localStorage.getItem('__lastBackendStatus');
            const overrideMode = localStorage.getItem('__backendStatusOverride');
            
            if (backendStatus === 'down' || overrideMode === 'offline') {
                updateStatus('❌ Sistema detectado en MODO OFFLINE', 'offline');
            } else if (backendStatus === 'up' || overrideMode === 'online') {
                updateStatus('✅ Sistema detectado en MODO ONLINE', 'online');
            } else {
                updateStatus('⚠️ Estado del sistema no determinado', 'warning');
            }
        });
    </script>
</body>
</html>