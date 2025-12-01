# Integridad de archivos y alertas

Este backend incluye un job diario `files.integrity.scan.daily` que verifica la integridad de los archivos gestionados y genera reportes en CSV y PDF, además de alertar cuando detecta inconsistencias.

## Programación automática

- El scheduler interno encola diariamente:
  - `files.integrity.scan.daily` a la hora configurada.
  - `cleanup.exports` para depurar exportaciones antiguas.

### Variables de entorno

- `INTEGRITY_SCAN_SCHEDULE_HOUR` (por defecto `2`): hora diaria para encolar el escaneo.
- `INTEGRITY_SCAN_SCHEDULE_MINUTE` (por defecto `15`): minuto diario para encolar el escaneo.
- `INTEGRITY_SCAN_LIMIT` (por defecto `1000`): límite de elementos a verificar por corrida.
- `EXPORTS_CLEANUP_SCHEDULE_HOUR` (por defecto `3`): hora diaria para limpiar exportaciones.
- `EXPORTS_CLEANUP_SCHEDULE_MINUTE` (por defecto `0`): minuto diario para limpiar exportaciones.
- `EXPORTS_CLEANUP_DAYS` (por defecto `14`): antigüedad de archivos a eliminar dentro de `exports/`.
- `EXPORTS_BASE_PATH` (por defecto `./exports` relativo al cwd): base donde se escriben los reportes y alertas.
- `ALERTS_MAX_ENTRIES` (por defecto `500`): máximo de entradas que se conservarán en `verification-alerts.json`.

## Reportes y auditoría

- Al finalizar el job, se generan:
  - CSV en `EXPORTS_BASE_PATH` con nombre `files_integrity_<ISO>Date>.csv`.
  - PDF con resumen y detalle de inconsistencias: `files_integrity_<ISO>Date>.pdf`.
  - Resumen append a `./logs/verification-final.txt` para trazabilidad.
  - Registro de auditoría via `AuditTrailService`.

## Alertas

- Si hay `missing > 0` o `mismatch > 0`, se registra un warning y se persiste una entrada en `EXPORTS_BASE_PATH/verification-alerts.json`.
- Cada entrada incluye: totales, rutas de CSV/PDF, usuario/actor que inició (si aplica) y `timestamp`.

## Endpoints útiles

- `GET /api/files/integrity/scan` — corrige/lanza escaneo inmediato.
- `GET /api/files/integrity/export/csv` — exporta CSV bajo demanda.
- `GET /api/files/integrity/export/pdf` — exporta PDF bajo demanda.
- `GET /api/files/integrity/latest/csv` — descarga el último CSV periódico desde disco con integridad completa.
- `GET /api/files/integrity/latest/pdf` — descarga el último PDF periódico desde disco con integridad completa.
- `POST /api/integrity/verify` — verifica el manifiesto actual y genera/actualiza `verification-summary.json`.

Además:
- `GET /api/integrity/summary` — devuelve el resumen y estado de exportaciones `{ base, writable }` para diagnóstico rápido.

Meta observabilidad:
- `GET /api/meta/endpoints?format=csv|jsonl|yaml&download=1` — al usar `download=1`, el backend persiste el archivo en `EXPORTS_BASE_PATH` y lo registra en `verification-manifest.json` para poblar `X-Checksum-Expected` en descargas posteriores.

## Encabezados de integridad en descargas

Todas las descargas relevantes (CSV, Excel, PDF, PNG, JSON) incluyen encabezados para verificación:

- `X-Checksum-SHA256`: checksum SHA256 calculado del contenido servido.
- `X-Checksum-Expected`: checksum esperado según `verification-manifest.json` si existe entrada por nombre de archivo.
- `X-Checksum-Match`: `true` si coincide con el esperado, `false` si difiere, vacío si no hay registro.
- `X-Integrity-Verified`: `true` indicando que se realizó el cálculo y comparación.

Esto aplica, entre otros, a: reportes (`reports`), ventas (`sales` CSV), inventario (`inventory` CSV), conteos de caja (`cash-register` CSV), auditoría de devoluciones (`audit` CSV), tickets PDF (`tickets`), exportaciones de endpoints (`/meta/endpoints` CSV/JSONL/YAML) y descarga de gráficas (`charts` PNG), además de backups de configuración (`settings` JSON).

## Notas

- Asegúrate de que el proceso tenga permisos de escritura en `EXPORTS_BASE_PATH` y `./logs`.
- Valida que `.env` incluya `EXPORTS_BASE_PATH` si necesitas ubicar los reportes en una ruta personalizada. Si no se define, se usará `./exports` relativo al `cwd` o, si existe, `../exports`.
- El backend valida al inicio que `EXPORTS_BASE_PATH` exista y sea escribible; también puedes verificarlo en `GET /api/integrity/summary` bajo `exports.writable`.
- Puedes integrar notificaciones externas (email, chat) leyendo `verification-alerts.json` y reaccionando a nuevas entradas.

## Backups unificados

- Los respaldos offline se escriben bajo `EXPORTS_BASE_PATH/backups/` con la siguiente estructura:
  - `MANUALES/` para respaldos disparados manualmente y con soporte opcional de `correlationId`.
  - `DIARIOS/`, `SEMANALES/`, `MENSUALES/` para respaldos automáticos según configuración.
- Todos los respaldos se registran en `verification-manifest.json` con su `relPath` bajo `exports/` y, si aplica, `correlationId`.
- La limpieza automática de respaldos excluye los manuales; solo aplica a `DIARIOS`, `SEMANALES` y `MENSUALES` conforme a los días de retención.
