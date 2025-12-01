# Inspección Módulo: Rankings

## Localización del Módulo
- Ruta: `/rankings`
- Frontend: `frontend/src/pages/Rankings/RankingsPage.tsx`
- Backend: `backend/src/routes/rankings.ts`, `backend/src/controllers/rankingController.ts`, `backend/src/services/rankingService.ts`

## Comportamiento Esperado
- Rankings semanales/mensuales de ventas y rendimiento.
- Rankings personalizados por filtros.
- Rendimiento por guía/empleado; rendimiento por productos/categorías/agencias.

## Inspección de Flujo de Datos
- UI → `GET /api/rankings/weekly|monthly|custom` → Controller → Service → BD → Respuesta → Render.
- Rendimientos: `GET /api/rankings/guide/:id/performance`, `employee/:id/performance`, `products/performance`, `agencies/performance`.
- Instrumentación de errores y SQL en controladores para depuración (`rankingController.ts:13-31`, `134-151`).

## Pruebas Concretas
- Endpoints presentes y protegidos por JWT (lecturas requieren auth, con bypass opcional si `ALLOW_READ_WITHOUT_AUTH=true`).
- Datos se basan en ventas reales y joins de entidades (ver `services/rankingService.ts`).

## Correcciones Aplicadas
- Sin cambios requeridos en backend; frontend compila tras correcciones globales.

## Regresión Básica
- Integración con Dashboard y Reportes (los rankings se alimentan de ventas correctamente).

## Estado del Módulo
- Estado del módulo: OK (lecturas). PENDIENTE: validar proyectos de rendimiento con dataset real de ventas una vez ejecutadas ventas end-to-end.

