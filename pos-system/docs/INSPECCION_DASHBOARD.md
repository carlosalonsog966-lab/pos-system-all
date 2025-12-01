# Inspección Módulo: Dashboard

## Localización del Módulo
- Ruta: `/dashboard`
- Componente principal: `frontend/src/pages/Dashboard/DashboardPage.tsx`
- Estado/Stores: `useAuthStore`, `useNotificationStore`, `useOfflineStore`, `useDashboardUrlSync`
- Endpoints consumidos: `GET /api/reports/dashboard?period=<today|week|month|quarter|year>`
- Modelos relacionados: `Sale`, `SaleItem`, `Product`, `Client`

## Comportamiento Esperado
- Mostrar KPIs reales: ventas totales, ingresos, clientes, inventario.
- Mostrar métricas del día: ventas, ingresos, transacciones y ticket promedio.
- Gráficas: ventas semanales, ingresos mensuales, ventas por hora, métodos de pago.
- Listado de ventas recientes con método de pago y referencias.
- Reacción a eventos de creación de venta (`window.dispatchEvent('sale:created')`) para refrescar en tiempo real.

## Inspección de Flujo de Datos
- UI → `api.get('/reports/dashboard')` → `ReportController.getDashboardMetrics` → `ReportService.generateDashboardMetrics` → BD (Sequelize) → Respuesta JSON → Actualización de `stats` en frontend.
- Mapeos en `DashboardPage.tsx`:
  - `totalSales` ← `data.sales.thisMonth`
  - `totalRevenue` ← suma `revenueData.ingresos` o `recentSales.total`
  - `totalJewelry`, `lowStockJewelry` ← `data.inventory.*`
  - `topClients` ← `data.customers.topCustomers`
  - Gráficas ← `salesData`, `revenueData`, `hourlyData`, `paymentMethodData`

## Pruebas Concretas
- Caso: Obtener métricas del dashboard
  - Acción: `GET http://localhost:5656/api/reports/dashboard?period=month`
  - Resultado esperado: `success=true` y objetos `sales`, `inventory`, `customers`, `salesData`, `revenueData`, `hourlyData`.
  - Resultado real (evidencia):
    - `inventory.totalJewelry=42`, `inventory.totalValue=416207`
    - `sales.thisMonth=0` (sin ventas registradas)
    - `salesData` y `revenueData` con datos agregados por período

## Correcciones Aplicadas
- No se requirieron cambios de backend: endpoint `/api/reports/dashboard` presente y funcional.
- Validaciones en frontend confirmadas: uso de `parseApiResponseWithSchema` y caché local en caso de fallo.
- Confirmada tolerancia a backend sin health con `backendStatus` y reintentos con backoff.

## Regresión Básica
- Login y lectura pública verificados: lectura `GET` permitida por `ALLOW_READ_WITHOUT_AUTH=true`.
- Otros módulos no afectados por esta verificación.

## Estado del Módulo
- Estado del módulo: OK
- Observaciones: los KPIs muestran 0 mientras no existan ventas registradas; esto es consistente con la BD.

