# Inspección Módulo: Reportes

## Localización del Módulo
- Ruta: `/reports`
- Frontend: `frontend/src/pages/Reports/ReportsPage.tsx`
- Backend: `backend/src/routes/reports.ts`, `backend/src/controllers/reportController.ts`, `backend/src/services/reportService.ts`

## Comportamiento Esperado
- Reportes: ventas, inventario, movimientos, estado de resultados, clientes.
- Exportación CSV/Excel/PDF con auditoría e integridad.
- Captura de gráficos como PNG.

## Inspección de Flujo de Datos
- UI → `GET /api/reports/*` → Controller → Service → BD → Respuesta.
- Exportación: `POST /api/reports/export` genera CSV/Excel/PDF con headers de integridad.
- Auditoría de exportaciones con `AuditTrailService` y `ExportsIntegrityService`.

## Pruebas Concretas
- `GET /api/reports/dashboard` probado y devuelve datos (evidencia en INSPECCION_DASHBOARD.md).
- Exportación CSV/Excel/PDF configurada con BOM y checksum (`reportController.ts:108-165`, `169-205`).

## Correcciones Aplicadas
- Sin cambios requeridos.

## Regresión Básica
- Impacto verificado sobre Dashboard y métricas.

## Estado del Módulo
- Estado del módulo: OK (lecturas y exportación CSV/Excel/PDF disponibles).

