# Observabilidad del Backend

Este documento describe los endpoints de observabilidad disponibles para inspeccionar el estado del servicio, la lista de rutas expuestas y la configuración efectiva del entorno.

## Endpoints

- `GET /api/health`
  - Propósito: Verificar salud general del servicio (uptime, versión, estado de base de datos y validación de configuración).
  - Respuesta (ejemplo):
    ```json
    {
      "success": true,
      "message": "OK",
      "timestamp": "2025-11-08T00:22:00.000Z",
      "version": "1.0.0",
      "uptimeSec": 1234,
      "db": { "healthy": true },
      "config": { "ok": true, "errors": 0, "warnings": 0 }
    }
    ```

- `GET /api/meta/endpoints`
  - Propósito: Listar las rutas expuestas por el router principal, incluyendo subrouters montados.
  - Detalles: La lista se obtiene dinámicamente inspeccionando el stack del router y normalizando rutas y métodos.
  - Parámetros opcionales:
    - `q`: filtra por substring en `path` (ej. `q=/api/settings`).
    - `method`: filtra por método HTTP (ej. `GET`, `POST`).
    - `base`: filtra por módulo base (ej. `base=settings` → `/api/settings/*`).
    - `group=module`: agrega `groups` con conteo por módulo principal.
    - `scope=public|protected|all|preset`: filtra por alcance.
      - `public|protected`: usa heurística y también patrones de `.env` si están definidos.
      - `preset`: usa únicamente los patrones definidos en `.env` (ver abajo). Si no hay patrones, retorna todos.
    - `format=csv|jsonl|yaml`: exporta en CSV (`method,path`), JSONL/NDJSON (una entrada JSON por línea) o YAML.
      - `download=1`: añade `Content-Disposition` para descarga.
  - Presets vía `.env` (coma-separado, soporta `*`):
    - `PUBLIC_ENDPOINTS=/api/health,/api/meta/*,/api/settings/system-info`
    - `PROTECTED_ENDPOINTS=/api/auth/*,/api/sales/*,/api/users/*`
  - Respuesta (ejemplo):
    ```json
    {
      "success": true,
      "count": 42,
      "endpoints": [
        { "method": "GET", "path": "/api/health" },
        { "method": "GET", "path": "/api/meta/endpoints" },
        { "method": "POST", "path": "/api/auth/login" }
      ]
    }
    ```

- `GET /api/meta/config`
  - Propósito: Exponer una vista segura y sanitizada de configuración y entorno efectivo, útil para diagnóstico.
  - Incluye: `env` (puerto, host, HTTPS), `cors` (orígenes efectivos), `db` (dialecto y almacenamiento), `uploads` (base path), `rateLimit` (valores clave), y `validation` (resultado y detalles de `validateConfig`).
  - Parámetros opcionales:
    - `verbose=1|true`: añade `process` (pid, uptime, memory, versions) y `envFlags` (presencia de variables sensibles sin exponer su valor).
      - Seguridad: `verbose` sólo se aplica si el entorno es `development` o si se envía encabezado `Authorization` (Bearer). En producción sin `Authorization`, `verbose` queda deshabilitado.
    - `fields=env,cors,db,uploads,rateLimit,validation,process,envFlags`: selecciona secciones específicas del payload.
    - `format=yaml` y `download=1`: exporta la respuesta en YAML y envía `Content-Disposition` para descarga.
  - Cache: devuelve `Cache-Control: private, max-age=60` para evitar scraping agresivo.
  - Respuesta (ejemplo abreviado):
    ```json
    {
      "success": true,
      "data": {
        "env": { "nodeEnv": "development", "host": "0.0.0.0", "port": 5656, "httpsEnabled": false },
        "cors": { "appHost": "localhost", "computedOrigins": ["http://localhost:5175"] },
        "db": { "dialect": "sqlite", "storagePath": ".../backend/data/pos_system.db" },
        "uploads": { "basePath": "C:\\ProgramData\\SistemaPOS\\DATOS\\IMAGENES" },
        "rateLimit": { "globalEnabled": false, "health": { "windowMs": 60000, "max": 120 } },
        "validation": { "ok": true, "errors": [], "warnings": [], "details": { "PORT": 5656 } }
      }
    }
    ```

## Job de métricas en `launcher/metrics.js`

El job ejecuta capturas cada N minutos y guarda snapshots en `captures/` y logs en `logs/verification-final.txt`.

- Capturas principales:
  - `GET /api/reports/dashboard`
  - `GET /api/inventory/stats`
  - Conteos (cuando aplica): `GET /api/products`, `GET /api/sales`, `GET /api/clients`
- Observabilidad (opcional):
  - `GET /api/meta/endpoints?scope=public&group=module`
  - `GET /api/meta/config?verbose=1`
- Backoff: las solicitudes usan reintentos exponenciales para mejorar resiliencia ante fallos temporales.
- Retención: limpieza automática de archivos antiguos en `captures/` según la configuración.

### Variables de entorno del lanzador

- `BACKEND_URL` (por defecto `http://localhost:5656/api`)
- `BACKEND_USER`, `BACKEND_PASS` (credenciales para obtener token JWT)
- `METRICS_INTERVAL_MS` (intervalo de captura, default 900000 ms)
- `METRICS_OBSERVABILITY` (`1`/`0` para habilitar/deshabilitar capturas de `/meta/*`)
- `METRICS_RETENTION_DAYS` (días de retención de archivos en `captures/`)

## Buenas prácticas

- No exponer secretos: Los valores sensibles (pfx, key/cert, secretos) se reportan como "configured"/"not-configured".
- Usar estos endpoints sólo para diagnóstico y observabilidad; no deben utilizarse para lógica de negocio.
- En producción, el rate limit global protege `/api`; los endpoints de salud y meta tienen límites específicos.

## Pruebas rápidas (PowerShell)

```powershell
Invoke-RestMethod -Uri 'http://localhost:5656/api/health' -Method GET | ConvertTo-Json -Depth 6
Invoke-RestMethod -Uri 'http://localhost:5656/api/meta/endpoints' -Method GET | ConvertTo-Json -Depth 6
Invoke-RestMethod -Uri 'http://localhost:5656/api/meta/endpoints?scope=public&group=module' -Method GET | ConvertTo-Json -Depth 6
Invoke-WebRequest -Uri 'http://localhost:5656/api/meta/endpoints?scope=public&format=csv&download=1' -Method GET | Select-Object -ExpandProperty Content
Invoke-WebRequest -Uri 'http://localhost:5656/api/meta/endpoints?scope=public&format=jsonl' -Method GET | Select-Object -ExpandProperty Content
Invoke-WebRequest -Uri 'http://localhost:5656/api/meta/endpoints?scope=public&group=module&format=yaml' -Method GET | Select-Object -ExpandProperty Content
Invoke-RestMethod -Uri 'http://localhost:5656/api/meta/config' -Method GET | ConvertTo-Json -Depth 6

## Job de métricas (launcher)

El script `pos-system/launcher/metrics.js` ejecuta cada `METRICS_INTERVAL_MS` (por defecto 15 minutos):
- Captura dashboard (`/reports/dashboard`) e inventario (`/inventory/stats`).
- Guarda `metrics-<timestamp>.json` en `pos-system/captures/` y registra resumen en `pos-system/logs/verification-final.txt`.
- Adicionalmente captura observabilidad:
  - `meta-endpoints-<timestamp>.json` desde `GET /api/meta/endpoints?scope=public&group=module`.
  - `meta-config-<timestamp>.json` desde `GET /api/meta/config?verbose=1`.

Para ejecución manual:
```powershell
node .\pos-system\launcher\metrics.js
```
```
