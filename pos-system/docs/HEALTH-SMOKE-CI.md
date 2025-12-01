# Health Smoke en CI

Este documento describe el workflow de CI que arranca el backend, ejecuta el smoke test de salud y publica las capturas como artefactos.

## Objetivos

- Arrancar el backend (`dist/server.js`) en el puerto `5656`.
- Ejecutar el wrapper `run-health-smoke.js` en modo `--once` con `STRICT_CORS_CHECK` y `REFUND_SMOKE` activos.
- Alinear `EXPECTED_ORIGIN` con `FRONTEND_URL` del backend para validar CORS.
- Subir capturas (`pos-system/captures/*.json` y `*.log`) como artefacto.

## Ubicación del workflow

- Ruta: `pos-system/.github/workflows/health-smoke.yml`
- Disparadores:
  - `push` a `main` sobre cambios en `pos-system/**`
  - `schedule` diario a las `06:00 UTC`
  - `workflow_dispatch` manual

## Resumen de pasos

1. Checkout y Node 18.
2. `npm ci` y `npm run build` en `pos-system/backend` (compila TypeScript a `dist/`).
3. Arranca el backend en background con:
   - `PORT=5656`
   - `FRONTEND_URL=http://localhost:4173`
   - `NODE_ENV=production`
4. Espera a que `GET http://localhost:5656/api/test-health` responda.
5. Ejecuta el smoke:
   - `node pos-system/launcher/run-health-smoke.js --once --expected=http://localhost:4173`
   - Variables de entorno del job: `STRICT_CORS_CHECK=1`, `REFUND_SMOKE=1` (enforced en el workflow)
6. Lista y publica capturas como artefacto `health-smoke-captures`.
7. Detiene el backend por `PID`.

## Variables y puertos

- `PORT=5656`: puerto estándar del backend en Fase 0 (documentado en `TECHNICAL_DOCUMENTATION.md`).
- `FRONTEND_URL`: debe coincidir con `EXPECTED_ORIGIN` para validar CORS.
- `EXPECTED_ORIGIN`: parámetro pasado al wrapper; por defecto usamos `http://localhost:4173` (preview local). Cambia si tu entorno utiliza otro origen.

## Artefactos

- Nombre: `health-smoke-captures`
- Contenido:
  - `pos-system/captures/*.json`
  - `pos-system/captures/*.log`

## Validación del status-dashboard en CI

- Publicar (o adjuntar) artefacto `status-dashboard` con:
  - `pos-system/exports/status/index.html`
  - `pos-system/exports/status/endpoints.html`
  - `pos-system/exports/endpoints.yaml`
  - `pos-system/exports/endpoints.csv`
  - `pos-system/exports/endpoints.jsonl`
- Navegación y verificación manual/automática:
  - Abrir `index.html` y verificar la sección “Descargas rápidas” y su estado “Disponible/No disponible”.
  - Usar “Accesos directos” para abrir `endpoints.html` con filtros vía hash (p. ej., `#method=GET`).
  - En `endpoints.html`, probar el botón “Copiar enlace”; debe copiar la URL con filtros activos.
  - Si existen `contracts.html` o `contracts-diff.html`, abrirlos para revisar alineación de contratos.

### Comprobación automática

El script `pos-system/scripts/verify-files.ps1` registra la presencia de artefactos clave del dashboard:

```
status/index.html
status/endpoints.html
exports/endpoints.yaml
exports/endpoints.csv
exports/endpoints.jsonl
status/contracts.html
status/contracts-diff.html
```

Se recomienda incluir este script como paso informativo en el workflow (no bloqueante), para tener trazabilidad de artefactos publicados.

## Ajustes comunes

- Cambiar origen esperado:
  - Edita el paso `Run health smoke` y ajusta `--expected=...`.
  - O bien cambia `FRONTEND_URL` al mismo valor.
- Cambiar horario del cron:
  - Edita `schedule.cron` en `health-smoke.yml`.
- Aumentar tiempo de espera del backend:
  - Incrementa el bucle en el paso `Wait for backend health` o añade más `sleep`.

## Ejecución local equivalente

- Con backend ya corriendo en `5656`:
  - `npm run smoke:health:once --prefix pos-system`
  - o `node pos-system/launcher/run-health-smoke.js --once --expected=http://localhost:4173`

## Notas

- No es necesario iniciar el frontend en CI para validar CORS; se compara el `EXPECTED_ORIGIN` con el `FRONTEND_URL` del backend y la lista de `computedOrigins`.
- Algunas rutas protegidas pueden devolver `401` en el resumen; esto es esperado si no se envía un token.
