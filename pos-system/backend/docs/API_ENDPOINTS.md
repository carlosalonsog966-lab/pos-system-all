# DOCUMENTACIÓN DE ENDPOINTS API

## Sistema POS - API REST

### Autenticación

- POST /api/auth/login - Iniciar sesión
- GET /api/auth/profile - Obtener perfil del usuario
- POST /api/auth/change-password - Cambiar contraseña
- POST /api/auth/logout - Cerrar sesión
- POST /api/auth/register - Registrar usuario (admin)

### Productos

- GET /api/products - Listar productos
- GET /api/products/:id - Obtener producto por ID
- GET /api/products/by-code/:code - Obtener producto por código
- GET /api/products/low-stock - Productos con stock bajo
- POST /api/products - Crear producto
- PUT /api/products/:id - Actualizar producto
- DELETE /api/products/:id - Eliminar producto
- PATCH /api/products/:id/stock - Actualizar stock

### Clientes

- GET /api/clients - Listar clientes
- GET /api/clients/:id - Obtener cliente por ID
- GET /api/clients/by-code/:code - Obtener cliente por código
- GET /api/clients/vip - Clientes VIP
- GET /api/clients/:id/stats - Estadísticas del cliente
- POST /api/clients - Crear cliente
- PUT /api/clients/:id - Actualizar cliente
- DELETE /api/clients/:id - Eliminar cliente

### Ventas

- GET /api/sales - Listar ventas
- GET /api/sales/:id - Obtener venta por ID
- POST /api/sales - Crear venta
- PUT /api/sales/:id - Actualizar venta
- DELETE /api/sales/:id - Eliminar venta

### Inventario

- GET /api/inventory/stats - Estadísticas de inventario
- POST /api/inventory/update-stock - Actualizar stock
- GET /api/inventory/movements - Movimientos de inventario

#### Nuevos endpoints de balance y reconciliación

- GET `/api/inventory/products/:productId/balance` — Obtiene el balance de stock para un producto.
  - Query params:
    - `branchId` (opcional): filtra el balance para una sucursal específica.
  - Respuesta:
    - `{ success: true, data: { productId, branchId?, currentStock, ledgerDelta, reconciled, issues: [] } }`

- POST `/api/inventory/products/:productId/reconcile` — Reconciliación de stock de un producto.
  - Body JSON:
    - `branchId` (opcional): sucursal objetivo para reconciliar.
  - Respuesta:
    - `{ success: true, data: { productId, branchId?, currentStock, ledgerDelta, reconciled: true, adjustments: [] } }`

- POST `/api/inventory/reconcile` — Reconciliación masiva de todos los productos.
  - Body JSON (opcional):
    - `branchId`: si se envía, reconcilia solo productos de esa sucursal.
  - Respuesta:
    - `{ success: true, data: { totalProducts, reconciledCount, failures: [] } }`

Notas:
- Todas las operaciones registran auditoría mediante `AuditTrailService` con resultados `success | failure | partial`.
- En caso de errores parciales en la reconciliación masiva, el resultado será `partial` y se incluirán detalles por producto.

### Reportes

- GET /api/reports/dashboard - Dashboard principal
- GET /api/reports/sales - Reporte de ventas
- GET /api/reports/inventory - Reporte de inventario

#### Parámetros comunes de reportes

- `startDate` y `endDate` (YYYY-MM-DD)
- `groupBy` (`hour|day|week|month|quarter|year`)
- `includeReturns`, `includeDiscounts`, `compareWithPrevious` (boolean)
- `categories`, `paymentMethods`, `customerSegments` (lista separada por comas)
- `minPrice`, `maxPrice` (número)
- `agencyId`, `guideId` (opcional)
- `branchId` (opcional): filtra por sucursal específica

#### Ejemplos

- Reporte de ventas por período y sucursal específica:

```
GET /api/reports/sales?startDate=2025-11-01&endDate=2025-11-08&groupBy=day&branchId=3b4e2f1a-9d2b-4c8e-8f1a-123456789abc
```

- Dashboard con sucursal:

```
GET /api/reports/dashboard?startDate=2025-11-01&endDate=2025-11-08&branchId=3b4e2f1a-9d2b-4c8e-8f1a-123456789abc
```

### Tickets

- GET /api/tickets/generate/:saleId - Generar ticket PDF
- POST /api/tickets/save/:saleId - Guardar ticket
- GET /api/tickets/preview/:saleId - Vista previa de ticket
- GET /api/tickets/list - Lista de tickets

### Sistema

- GET /api/health - Estado del servidor
- GET /api/debug-db - Debug de base de datos

## Autenticación

La mayoría de endpoints requieren autenticación mediante JWT token en el header:
```
Authorization: Bearer <token>
```

## Códigos de Respuesta

- **200** - Éxito
- **201** - Creado
- **400** - Error de validación
- **401** - No autorizado
- **403** - Prohibido
- **404** - No encontrado
- **500** - Error interno del servidor

## Clientes – Parámetros y reglas

### GET /api/clients

- Query params admitidos:
  - `page`: número de página. Acepta `number` o string numérica; se normaliza a entero positivo.
  - `limit`: tamaño de página. Acepta `number` o string numérica; se normaliza a entero positivo (máx. 100).
  - `search`: texto libre para buscar por nombre, email, teléfono, código, etc.
  - `isActive`: estado del cliente. Acepta `boolean` o string `'true'|'false'`; se normaliza a booleano.
  - `vip`: filtra clientes VIP. Acepta `boolean` o string `'true'|'false'`; se normaliza a booleano.

- Respuesta:
  - `success`: boolean.
  - `data`: array de clientes.
  - `pagination`: `{ page, limit, total, totalPages }` cuando se usa paginación.

### POST /api/clients (crear cliente)

- Body JSON (reglas principales):
  - `code` (string, requerido): código único del cliente.
  - `firstName` (string, requerido): nombre.
  - `lastName` (string, requerido): apellido.
  - `email` (string, opcional): debe ser email válido si se envía.
  - `phone` (string, opcional): si se envía, no debe estar vacío. Nota: el modelo valida longitudes típicas (p. ej. 5–20 caracteres).
  - `address`, `city`, `country` (string, opcional).
  - `birthDate` (string, opcional): fecha en formato ISO; se transforma internamente a `Date`.
  - `documentType` (enum, opcional): uno de `'CC' | 'CE' | 'TI' | 'PP' | 'NIT'`.
  - `documentNumber` (string, opcional).
  - `notes` (string, opcional).

- Respuesta: `{ success: boolean, data: Cliente }` o `error` con detalles de validación.

### PUT /api/clients/:id (actualizar cliente)

- Path param:
  - `id` (UUID): identificador del cliente.

- Body JSON:
  - Mismas reglas que `POST /api/clients`, todos los campos son opcionales (actualización parcial).

- Respuesta: `{ success: boolean, data: Cliente }` o `error` con detalles.

### DELETE /api/clients/:id (eliminar cliente)

- Path param:
  - `id` (UUID): identificador del cliente.

- Respuesta: `{ success: boolean }`.

### Ejemplos

- Listado paginado de clientes activos (acepta tipos mixtos):

```
GET /api/clients?page=1&limit=20&isActive=true
```

- Búsqueda por texto y filtro de VIP como string booleano:

```
GET /api/clients?search=garcia&vip=false
```

- Creación:

```json
POST /api/clients
{
  "code": "CLI001ABC",
  "firstName": "María",
  "lastName": "García",
  "email": "maria@example.com",
  "phone": "5512345678",
  "documentType": "CC",
  "documentNumber": "1234567890"
}
```

### Notas

- Autenticación: requiere JWT en `Authorization: Bearer <token>`.
- Normalización de tipos en queries: `page`, `limit`, `isActive`, `vip` aceptan `string`/`number`/`boolean` según corresponda y se transforman internamente.
- El frontend puede generar automáticamente `code` para nuevos clientes; el backend requiere que no esté vacío.
