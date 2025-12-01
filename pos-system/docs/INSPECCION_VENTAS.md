# Inspección Módulo: Ventas

## Localización del Módulo
- Ruta: `/sales`
- Componentes: `frontend/src/pages/Sales/SalesPage.tsx`
- Servicios: `frontend/src/services/salesService.ts`, `frontend/src/lib/api.ts`
- Stores/Hooks: `useAuthStore`, `useNotificationStore`, `useOfflineStore`, `useSaleSync`
- Endpoints backend:
  - `GET /api/products` (búsqueda de productos)
  - `POST /api/sales` (crear venta)
  - `GET /api/tickets/generate/:saleId` (ticket)
  - Lecturas `GET` permitidas con `ALLOW_READ_WITHOUT_AUTH=true`; mutaciones requieren JWT.
- Modelos/BD: `Sale`, `SaleItem`, `Product`, `Client`

## Comportamiento Esperado
- Flujo completo de venta:
  - Buscar producto (código, nombre, filtros)
  - Agregar al carrito, ajustar cantidades y precios
  - Aplicar descuentos (porcentaje/importe)
  - Seleccionar método de pago (efectivo/tarjeta/transferencia/mixto)
  - Confirmar venta y generar ticket
- Efectos secundarios:
  - Crear `Sale` y `SaleItem` en BD
  - Actualizar stock de productos
  - Refrescar Dashboard (evento `sale:created`)
  - Registrar auditoría/exportaciones cuando aplique

## Inspección de Flujo de Datos
- UI → `api.post('/sales', data)` → `SaleController.createSale` → `SaleService.createSale` → BD (Sequelize) → Respuesta JSON → Actualización de estado y notificaciones.
- Fallbacks:
  - `tourismCheckout` intenta `/sales/tourism/checkout`; si 404, usa `/sales`.
  - Modo offline: cola de acciones `CREATE_SALE` con `idempotencyKey` y notificación.
- Tipos y validaciones:
  - `createSaleSchema` (Zod) validando estructura y negocio.
  - UI ajustada para usar `product.salePrice` en vez de `product.price`.

## Pruebas Concretas
- Caso: Crear venta básica
  - Preparación: Login JWT (`POST /api/auth/login`, usuario `admin/admin123`).
  - Acción: `POST /api/sales` con 1 item `{ productId, quantity:1, unitPrice: <salePrice> }`, `paymentMethod:'cash'`.
  - Resultado esperado: `201` `success=true`, nueva venta con `items`, stock actualizado; dashboard refleja cambios tras evento `sale:created`.
  - Estado actual: la UI está lista; el backend requiere JWT para mutaciones. Lecturas operan sin JWT.

## Correcciones Aplicadas
- Frontend:
  - Reemplazo consistente de referencias `product.price` → `product.salePrice` en `SalesPage.tsx`.
  - Remoción de opciones inválidas en notificaciones (`role`, `htmlAttributes`, `data-testid`) que rompían el build.
  - Inclusión de `showInfo` en el store de notificaciones donde se usa.
  - Ajustes de tipos en `HardwareScannerListener` y estructuras de `Employee`.
- Backend:
  - Confirmada ruta `POST /api/sales` con validación Zod y actualización de stock.

## Regresión Básica
- Verificado que los cambios no afectan carga de Dashboard ni otros módulos.
- Modo offline mantiene funcionalidad si backend no está disponible.

## Estado del Módulo
- Estado del módulo: OK (lecturas y flujo UI listos) / CON PENDIENTES (mutaciones requieren JWT en entorno de pruebas).
- Pendiente operativo: ejecutar prueba de venta end-to-end con autenticación activa y evidenciar la actualización de stock y KPIs.

