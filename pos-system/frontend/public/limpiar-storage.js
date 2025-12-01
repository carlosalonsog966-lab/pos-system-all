// Script para limpiar el almacenamiento local y resolver problemas de conexión
console.log('🧹 LIMPIANDO ALMACENAMIENTO LOCAL...');

// Limpiar todas las claves problemáticas
const keysToRemove = [
    'observability:useMocks',
    '__lastBackendStatus', 
    'backendDown',
    'backendStatus',
    'useMocks',
    'lastHealthCheck'
];

keysToRemove.forEach(key => {
    const value = localStorage.getItem(key);
    if (value !== null) {
        console.log(`🗑️ Eliminando: ${key} = ${value}`);
        localStorage.removeItem(key);
    }
});

// Verificar qué queda
console.log('📊 ALMACENAMIENTO RESTANTE:');
for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    console.log(`${key}: ${localStorage.getItem(key)}`);
}

console.log('✅ LIMPIEZA COMPLETA');
console.log('🔄 Recargando página...');

// Recargar después de un momento
setTimeout(() => {
    location.reload();
}, 1000);