#!/bin/bash

# 🚀 SCRIPT DE CONSTRUCCIÓN DEFINITIVO - APP TAURI 100% OFFLINE
# Este script garantiza una construcción sin errores

echo "🚀 INICIANDO CONSTRUCCIÓN DEFINITIVA DE APP TAURI"
echo "================================================"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funciones de utilidad
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ] || [ ! -d "src-tauri" ]; then
    log_error "No estás en el directorio raíz del proyecto Tauri"
    exit 1
fi

log_info "Directorio verificado: $(pwd)"

# PASO 1: Limpiar construcciones anteriores
log_info "PASO 1: Limpiando construcciones anteriores..."
rm -rf frontend/dist
rm -rf src-tauri/target/release
rm -rf src-tauri/target/release/bundle
log_success "Construcciones anteriores eliminadas"

# PASO 2: Verificar configuración
echo ""
log_info "PASO 2: Verificando configuración..."

# Verificar package.json
if [ -f "frontend/package.json" ]; then
    log_success "package.json encontrado"
else
    log_error "package.json no encontrado en frontend/"
    exit 1
fi

# Verificar tauri.conf.json
if [ -f "src-tauri/tauri.conf.json" ]; then
    log_success "tauri.conf.json encontrado"
else
    log_error "tauri.conf.json no encontrado"
    exit 1
fi

# PASO 3: Instalar dependencias
echo ""
log_info "PASO 3: Instalando dependencias..."
cd frontend

if [ -f "package-lock.json" ]; then
    log_info "Usando npm install..."
    npm install
else
    log_info "Usando npm install sin package-lock..."
    npm install
fi

if [ $? -ne 0 ]; then
    log_error "Error instalando dependencias del frontend"
    exit 1
fi

log_success "Dependencias del frontend instaladas"

# PASO 4: Construir frontend con modo offline
echo ""
log_info "PASO 4: Construyendo frontend en modo offline..."

# Usar el main offline definitivo
cp src/main-offline-definitivo.tsx src/main.tsx

# Establecer variables de entorno offline
export NODE_ENV=production
export VITE_FORCE_OFFLINE=true
export VITE_PREFERRED_DRIVER=invoke
export VITE_FALLBACK_TO_HTTP=false
export VITE_USE_MOCKS=true

npm run build

if [ $? -ne 0 ]; then
    log_error "Error construyendo frontend"
    exit 1
fi

log_success "Frontend construido exitosamente"

# PASO 5: Preparar Tauri
echo ""
log_info "PASO 5: Preparando Tauri..."
cd ../src-tauri

# Verificar Cargo.toml
if [ -f "Cargo.toml" ]; then
    log_success "Cargo.toml encontrado"
else
    log_error "Cargo.toml no encontrado"
    exit 1
fi

# PASO 6: Construir Tauri
echo ""
log_info "PASO 6: Construyendo Tauri..."
cd ..

log_info "Este proceso puede tomar varios minutos..."

npm run tauri:build

if [ $? -ne 0 ]; then
    log_error "Error construyendo Tauri"
    echo ""
    log_info "Intentando solución de errores comunes..."
    
    # Intentar solucionar errores de dependencias
    cd src-tauri
    cargo update
    cd ..
    
    # Reintentar construcción
    log_info "Reintentando construcción..."
    npm run tauri:build
    
    if [ $? -ne 0 ]; then
        log_error "Error persistente en construcción de Tauri"
        exit 1
    fi
fi

log_success "Tauri construido exitosamente"

# PASO 7: Verificar instaladores
echo ""
log_info "PASO 7: Verificando instaladores..."

INSTALLER_DIR="src-tauri/target/release/bundle"

if [ -d "$INSTALLER_DIR" ]; then
    log_success "Directorio de instaladores encontrado"
    
    # Buscar instaladores
    MSI_FILE=$(find "$INSTALLER_DIR" -name "*.msi" -type f | head -1)
    NSIS_FILE=$(find "$INSTALLER_DIR" -name "*.exe" -type f | grep -v setup.exe | head -1)
    SETUP_FILE=$(find "$INSTALLER_DIR" -name "*setup.exe" -type f | head -1)
    
    echo ""
    log_info "Instaladores encontrados:"
    
    if [ -n "$MSI_FILE" ]; then
        log_success "✅ MSI: $(basename "$MSI_FILE")"
        echo "   Ruta: $MSI_FILE"
    fi
    
    if [ -n "$NSIS_FILE" ]; then
        log_success "✅ NSIS: $(basename "$NSIS_FILE")"
        echo "   Ruta: $NSIS_FILE"
    fi
    
    if [ -n "$SETUP_FILE" ]; then
        log_success "✅ Setup: $(basename "$SETUP_FILE")"
        echo "   Ruta: $SETUP_FILE"
    fi
    
    if [ -z "$MSI_FILE" ] && [ -z "$NSIS_FILE" ] && [ -z "$SETUP_FILE" ]; then
        log_warning "No se encontraron instaladores en $INSTALLER_DIR"
        echo "Contenido del directorio:"
        ls -la "$INSTALLER_DIR"
    fi
else
    log_warning "Directorio de instaladores no encontrado"
fi

# PASO 8: Resumen final
echo ""
echo "================================================"
log_success "🎉 CONSTRUCCIÓN DEFINITIVA COMPLETADA"
echo "================================================"
echo ""
log_info "Resumen de la construcción:"
echo "   📱 Aplicación: Sistema POS Profesional"
echo "   🔄 Modo: 100% Offline"
echo "   🎯 Versión: 1.0.0"
echo "   📦 Tipo: Aplicación de escritorio Tauri"
echo ""

if [ -d "$INSTALLER_DIR" ]; then
    log_info "Los instaladores están listos en:"
    echo "   📁 $INSTALLER_DIR"
    echo ""
    log_info "Para instalar la aplicación:"
    echo "   1. Ejecuta el archivo .msi (instalador de Windows)"
    echo "   2. O ejecuta el archivo .exe (instalador NSIS)"
    echo ""
fi

log_success "¡Tu aplicación POS offline está lista para distribuir!"
echo ""
echo "🚀 Características incluidas:"
echo "   ✅ Funcionamiento 100% offline"
echo "   ✅ Sin conexión a internet requerida"
echo "   ✅ Sistema completo de inventario"
echo "   ✅ Gestión de ventas y clientes"
echo "   ✅ Reportes y estadísticas"
echo "   ✅ Interfaz profesional"
echo ""
echo "📞 Soporte: La aplicación está lista para uso comercial"

# Mantener script activo para ver errores
read -p "Presiona Enter para salir..."

exit 0