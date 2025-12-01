## Verify Alerts CI

- Objetivo: ejecutar una verificación de integridad de archivos contra el backend y publicar artefactos (CSV, JSON, PDF y logs) para análisis.
- Ubicación del workflow: `pos-system/.github/workflows/verify-alerts.yml`.

### Disparadores
- Manual (`workflow_dispatch`).
- `push` y `pull_request` en `main` con cambios bajo `pos-system/**`.
- Programado diario a las 06:15 (`cron: '15 6 * * *'`).

### Flujo de pasos
- `Checkout` y `Setup Node 18`.
- Instala y compila `pos-system/backend`.
- Arranca el backend (`npm start`) y espera salud en `GET ${POS_BASE_URL}/api/health`.
- Ejecuta `node pos-system/launcher/file-verification-alerts.js --once`.
- Lista y publica artefactos:
  - `pos-system/exports/*.csv` (incluye `verification-report.csv`).
  - `pos-system/exports/*.json` (incluye `verification-summary*.json` y `verification-alert-*.json`).
  - `pos-system/exports/*.pdf` (resumen en PDF por ejecución).
  - `pos-system/logs/verification-final.txt`.
- Detiene el backend.

### Variables de entorno
- `POS_BASE_URL`: ahora viene desde una matriz (`strategy.matrix`) por entorno; por defecto `http://localhost:5656`.
- `VERIFY_ENV_LABEL`: etiqueta de entorno mostrada en logs/alertas (vía matriz; ejemplo `CI-local`).
- Opcionales:
  - `VERIFY_ONLY_MISMATCHES`: exporta solo discrepancias.
  - `VERIFY_APPEND`: agrega filas al CSV existente.
  - `VERIFY_OUTPUT_CSV_PATH`: cambia la ruta del CSV.
  - `VERIFY_SLACK_WEBHOOK_URL`: si se define como Secret en Actions, el launcher enviará notificación cuando hay alerta.

### Runner y matriz
- Runner: `windows-latest` (PowerShell y Node 18 con `fetch` integrado).
- Matriz: `name`, `env_label` y `pos_base_url` para ejecutar sobre distintos entornos. Ejemplo incluido: `local`.

### Artefactos publicados
- CSV principal y versiones de discrepancias.
- `verification-summary.json` y versiones con timestamp.
- `verification-report-<timestamp>.pdf`.
- `verification-alert-*.json` (solo si hay discrepancias).
- `logs/verification-final.txt` con el timeline de cada ejecución.

### Ajustes comunes
- Si usas otro puerto/URL, ajusta `POS_BASE_URL` en el workflow.
- Si tienes autenticación distinta para admin, revisa `scripts/verify-files.ps1` y variables `POS_ADMIN_USERNAME` y `POS_ADMIN_PASSWORD` en tu `.env`.
- Para notificaciones en Slack, añade `VERIFY_SLACK_WEBHOOK_URL` como Secret del repo y descomenta en el workflow.

### Ejecución local equivalente
- Backend: `cd pos-system/backend && npm ci && npm run build && npm start`.
- Verificación: `node pos-system/launcher/file-verification-alerts.js --once`.
- Resultados en `pos-system/exports/` y `pos-system/logs/`.
