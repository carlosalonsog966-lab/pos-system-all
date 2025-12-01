# Seguimiento de Progreso

Este archivo describe cómo ver y actualizar el estado de avance hacia RC (01/12) y GA (19/12 20:00).

## Cómo obtener el estado
- Ejecuta: `node pos-system/scripts/progreso.js`
- Revisa: `pos-system/exports/status/progreso.json` y `progreso.md`

## Tendencia del progreso
- Ejecuta: `node pos-system/scripts/progreso-trend.js` para agregar una fila y generar `trend.html`.
- Revisa: `pos-system/exports/status/trend.csv` (histórico) y `trend.html` (tabla + gráfico).

### Alertas y modo estricto (CI)
- Variables de entorno:
  - `READINESS_MIN_SCORE` (por defecto `70`): umbral mínimo aceptable.
  - `READINESS_MAX_DROP` (por defecto `5`): caída máxima permitida entre mediciones consecutivas.
  - `READINESS_STRICT` (`1`/`0`, por defecto `0` local, `1` en CI): si hay alerta y está activo, el script sale con error para que el workflow falle.
- El workflow `progreso.yml` define estos valores en `env` y sube artefactos incluso si hay fallo.
- En local, puedes probar: `READINESS_STRICT=1 READINESS_MIN_SCORE=95 node pos-system/scripts/progreso-trend.js`.

## En CI
- Workflow: `pos-system/.github/workflows/progreso.yml` corre en `push` y `pull_request`.
- Publica artefactos con los archivos de estado para auditoría y comunicación.
  - También ejecuta diariamente (cron) para mantener la tendencia actualizada.

## Cómo navegar el status-dashboard
- En local: inicia el servidor estático sobre `pos-system/exports/status` y abre `http://localhost:8080/index.html`.
  - Comando: `node pos-system/scripts/static-server.js pos-system/exports/status 8080`
  - Navegación rápida: `Índice de endpoints`, `Reporte de contratos`, `YAML`, `CSV`, `JSONL`.
- En CI: abre la ejecución del workflow y descarga el artefacto `status-dashboard`.
  - Ruta: `Actions → Runs → Artifacts → status-dashboard`.
  - Descomprime y abre `index.html` para acceder a los enlaces de `endpoints.html`, `endpoints.yaml`, `endpoints.csv`, `endpoints.jsonl` y `contracts.html`.

## Documentos relevantes
- Plan: `pos-system/docs/PLAN-BLOQUES-SINCRONIZADO.md`
- Seguimiento: `pos-system/docs/PROGRESO-Y-SEGUIMIENTO.md`
