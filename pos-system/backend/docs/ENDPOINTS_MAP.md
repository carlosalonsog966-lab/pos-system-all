# Mapa de Endpoints y Routers (Backend POS)

Este documento resume los prefijos montados en `app.use('/api', routes)` y los routers registrados en `src/routes/index.ts`, con referencia a sus áreas funcionales.

- Prefijo base: `/api`
  - `GET /api/health` — Salud avanzada (headers `X-Health-Source`, payload con `db`, `config`, `uptimeSec`).
  - `GET /api/debug-db` — Depuración de base de datos (tablas, usuarios, ruta de DB).
  - `Router /api/auth` — Autenticación (login, profile, cambio de contraseña, logout, register).
  - `Router /api/products` — Productos (CRUD, stock, low-stock, búsqueda por código).
  - `Router /api/categories` — Categorías.
  - `Router /api/clients` — Clientes (CRUD, VIP, stats, búsqueda por código).
  - `Router /api/sales` — Ventas (CRUD, creación/cierre de venta, futuras transacciones).
  - `Router /api/reports` — Reportes (dashboard, ventas, inventario).
  - `Router /api/charts` — Capturas/gráficas para reportes.
  - `Router /api/tickets` — Tickets (generación/guardado/preview/listado).
  - `Router /api/test-tickets` — Endpoints de prueba de tickets.
  - `Router /api/checkout` — Flujo de checkout.
  - `Router /api/inventory` — Inventario (stats, movimientos, actualización de stock).
    - Endpoints adicionales: `update-stock`, `bulk-update`, `transfer`, `alerts`, `report`, `low-stock`, `stats`, `history`.
    - Balance/Reconciliación:
      - `GET /api/inventory/products/:productId/balance`
      - `POST /api/inventory/products/:productId/reconcile`
      - `POST /api/inventory/reconcile`
  - `Router /api/settings` — Configuración (público y `system-info`, pruebas de impresora, import/export).
  - `Router /api/backup` — Respaldo del sistema.
  - `Router /api/cash-register` — Caja registradora.
  - `Router /api/offline` — Operaciones offline/colas.
  - `Router /api/users` — Usuarios (gestión y roles).
  - Turismo:
    - `Router /api/agencies` — Agencias.
    - `Router /api/guides` — Guías.
    - `Router /api/employees` — Empleados.
    - `Router /api/branches` — Sucursales (lista, stats).
    - `Router /api/barcodes` — Códigos de barras.
    - `Router /api/guide-registrations` — Registro diario de guías.
  - `Router /api/rankings` — Rankings.
  - `Router /api/events` — Eventos del sistema (listado y creación).
  - `Router /api/metrics` — Métricas agregadas de eventos (24h).

Estáticos:
- `/exports` — Archivos exportados (tickets, charts).
- `/uploads` — Archivos subidos (base configurable por `ensureUploadsSubdir`).

Notas:
- Middleware de logging previo a routers: `=== BEFORE ROUTES MIDDLEWARE ===`.
- Handler global de errores + 404 JSON.
- Rate limit instrumentado registra eventos `RATE_LIMIT`.
- Health instrumentado registra `HEALTH_CHECK` y errores como `ERROR`.
- En producción, se sirve frontend SPA desde `frontend/dist` (fallback para rutas no `/api`).
