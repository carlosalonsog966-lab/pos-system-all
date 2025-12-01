# INSTRUCCIONES DE USO - SISTEMA POS

## Inicio Rápido

### 1. Iniciar el Sistema

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

### 2. Acceso al Sistema

- **URL:** http://localhost:5174
- **Usuario:** admin
- **Contraseña:** admin123

### 3. Funcionalidades Principales

#### Gestión de Productos
- Crear, editar y eliminar productos de joyería
- Gestión de stock y precios
- Códigos de barras y QR
- Campos específicos para joyería (metal, pureza, gramos, etc.)

#### Gestión de Clientes
- Registro de clientes
- Historial de compras
- Clientes VIP

#### Punto de Venta
- Procesamiento de ventas
- Generación de tickets
- Múltiples métodos de pago

#### Inventario
- Control de stock en tiempo real
- Movimientos de inventario
- Alertas de stock bajo

#### Reportes
- Dashboard con métricas clave
- Reportes de ventas
- Análisis de inventario

### 4. Roles de Usuario

- **Admin:** Acceso completo al sistema
- **Manager:** Gestión de productos, clientes y reportes
- **Cashier:** Operaciones de venta y consultas básicas

### 5. Mantenimiento

#### Respaldo de Base de Datos
La base de datos se encuentra en: `backend/data/pos_system.db`

#### Logs del Sistema
Los logs se almacenan en: `backend/logs/`

#### Observabilidad y Trazabilidad
- Eventos del sistema (requiere autenticación): `GET /api/events` con filtros por `type`, `severity`, `from`, `to`.
- Crear evento manual (pruebas): `POST /api/events` con `{ type, message, context? }`.
- Métricas agregadas de las últimas 24h: `GET /api/metrics`.

#### Tickets Generados
Los tickets PDF se guardan en: `backend/exports/`

### 6. Solución de Problemas

#### El servidor no inicia
1. Verificar que el puerto 3000 esté libre
2. Revisar los logs en `backend/logs/`
3. Verificar la base de datos en `backend/data/`

#### Error de autenticación
1. Verificar credenciales de usuario
2. Limpiar caché del navegador
3. Reiniciar el servidor backend

#### Problemas con tickets
1. Verificar permisos de escritura en `backend/exports/`
2. Comprobar que la venta existe
3. Revisar logs de errores
