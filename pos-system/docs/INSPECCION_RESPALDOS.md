# Inspección Módulo: Respaldos

## Localización del Módulo
- Ruta: `/backup`
- Frontend: `frontend/src/pages/Backup/BackupPage.tsx`
- Backend: `backend/src/routes/backup.ts`, `backend/src/services/backupService.ts`

## Comportamiento Esperado
- Listado y estadísticas de respaldos.
- Creación de respaldo manual, restauración y eliminación.
- Configuración de respaldos automáticos.

## Inspección de Flujo de Datos
- UI → `GET /api/backup` y `POST /api/backup` → Service → FS/BD → Respuesta.
- Protegido por JWT y rol admin.

## Pruebas Concretas
- Endpoints presentes y respuestas estructuradas (`backup.ts:15-166`).

## Correcciones Aplicadas
- Frontend: remoción de atributos inválidos en toasts.

## Regresión Básica
- Sin impacto negativo en otros módulos.

## Estado del Módulo
- Estado del módulo: OK (servicios presentes). PENDIENTE: ejecución real de creación/restauración con JWT y permisos de FS.

