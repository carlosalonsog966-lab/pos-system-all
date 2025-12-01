# Runbook: Respuesta a Incidentes

## Alcance
- Servicios: backend, frontend, desktop/tauri.
- Tipos: caída de servicio, degradación de performance, errores 5xx, fugas de memoria, vulnerabilidades.

## Detección
- Alertas: dashboards `exports/status/*` y métricas (`/health`, Prometheus).
- Confirmar impacto: usuarios afectados, endpoints fallando, tiempo desde inicio.

## Contención
- Activar flag/canary: deshabilitar feature problemática (`VITE_ENABLE_FEATURE_FLAGS`), rutas en backend.
- Rolback: revertir a última imagen/tag estable (`release/*`).
- Rate limit y headers de seguridad si aplica.

## Diagnóstico
- Logs: revisar `LOG_LEVEL=debug`, correlación por request ID.
- Contratos API: validar compatibilidad en `exports/endpoints.*`.
- DB: revisar migraciones recientes; aplicar `expand → migrate → switch → clean`.

## Remediación
- Hotfix: crear rama `hotfix/*`, pruebas (`lint`, `test`, `smoke`) y merge.
- Documentar causa raíz y acciones preventivas.

## Comunicación
- Notificar stakeholders y registrar cronología.
- Actualizar `progreso.md` y `CHANGELOG` si corresponde.

