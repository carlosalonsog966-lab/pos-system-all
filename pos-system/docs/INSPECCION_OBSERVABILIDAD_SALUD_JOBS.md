# Inspección Módulos: Observabilidad / Salud / Jobs

## Observabilidad
- Ruta: `/observability`
- Backend: `backend/src/routes/events.ts` (listado y creación de eventos)
- Comportamiento: listar eventos con filtros; crear eventos manuales para pruebas.
- Estado: OK (protegido por JWT; soporte de paginación y filtros).

## Salud
- Ruta: `/health`
- Backend: `backend/src/controllers/healthController.ts`
- Comportamiento: verifica DB, espacio en disco, cola de jobs y directorio de backups; retorna `healthy` y detalles.
- Estado: OK; cliente usa `backendStatus` para auto-refresh.

## Jobs
- Ruta: `/jobs`
- Backend: `backend/src/routes/jobs.ts`, `backend/src/services/jobQueueService.ts`, `backend/src/controllers/jobController.ts`
- Comportamiento: salud del worker, encolar jobs, listar, detalle, reintento.
- Estado: OK (lecturas y encolado protegido por roles; worker activo según health).

## Evidencia
- Health endpoint configurado en `routes/index.ts:120`.
- Job queue stats y running en `jobQueueService.ts`.

## Pendientes
- Validar encolado y reintento con JWT activo y revisar impacto en exportaciones/reports.

