# Inspección Módulo: Joyas / Inventario

## Localización del Módulo
- Rutas: `/inventory`, `/jewelry` (UI según menú)
- Frontend: componentes en `frontend/src/pages/Inventory/*.tsx`
- Backend:
  - `GET /api/inventory` (reportes de inventario)
  - `GET /api/products` (listado y filtros)
  - `GET /api/products/low-stock` (bajo stock)
  - `PATCH /api/products/:id/stock` (actualización de stock)
  - `POST /api/products` / `PUT /api/products/:id` / `DELETE /api/products/:id`
- Modelos: `Product` (`backend/src/models/Product.ts`)

## Comportamiento Esperado
- Alta/edición/baja de productos con atributos de joyería: metal, pureza, gramos, piedras, etc.
- Consulta de inventario con KPIs: total de joyas, valor total, bajo stock, categorías.
- Movimientos de stock con bloqueo optimista y validaciones (no negativo, gramos coherentes).

## Inspección de Flujo de Datos
- UI → `api.get('/products')` → `ProductController.getProducts` → BD → Respuesta → Render.
- Actualización de stock: UI → `PATCH /api/products/:id/stock` → `Product.updateStockWithLock` (`Product.ts:156`) → Persistencia.
- Reportes: `GET /api/reports/inventory` → `ReportService.generateInventoryReport` (`reportService.ts:386`).

## Pruebas Concretas
- Evidencia de modelo:
  - `salePrice` y `purchasePrice` definidos y validados (`Product.ts:238-251`).
  - Índices en `code`, `barcode`, y campos clave (`Product.ts:394-423`).
  - Bloqueo optimista y actualización de stock (`Product.ts:119-147`, `156-179`).
- Evidencia de reporte:
  - `generateInventoryReport` computa KPIs y lista de productos (`reportService.ts:386-430`).

## Correcciones Aplicadas
- Frontend Ventas ajustado a `product.salePrice` (varias ubicaciones listadas en INSPECCION_VENTAS.md).
- Sin cambios necesarios en backend para Inventario; endpoints presentes.

## Regresión Básica
- Verificada compatibilidad con Dashboard (inventario alimenta KPIs: `reportService.ts:528-539`).

## Estado del Módulo
- Estado del módulo: OK (lecturas); CON PENDIENTES (mutaciones requieren JWT para validar stock en entorno de prueba).

