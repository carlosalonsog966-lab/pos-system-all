# Smoke de Salud (CORS) Programado

Este documento explica cómo programar la verificación diaria de alineación CORS/URL y el smoke de reembolso.

## Scripts

- Runner: `pos-system/scripts/run-health-smoke-once.ps1`
- Registro de tarea: `pos-system/scripts/register-health-smoke-task.ps1`

## Registrar tarea (PowerShell)

```powershell
# Registrar tarea diaria a las 09:00
powershell -NoProfile -ExecutionPolicy Bypass -File \
  "C:\\...\\pos-system\\scripts\\register-health-smoke-task.ps1" -TaskName "POS_HealthSmoke" -Schedule Daily -StartTime "09:00"

# Ejecutar ahora
schtasks /Run /TN "POS_HealthSmoke"

# Consultar y eliminar
schtasks /Query /TN "POS_HealthSmoke" /V /FO LIST
schtasks /Delete /TN "POS_HealthSmoke" /F
```

## Notas de entorno

- El wrapper Node (`pos-system/launcher/run-health-smoke.js`) toma `EXPECTED_ORIGIN` desde variable de entorno o de `pos-system/backend/.env` (`FRONTEND_URL`). Por defecto aplica `STRICT_CORS_CHECK=1` y `REFUND_SMOKE=1`.
- Si cambias `FRONTEND_URL`, reinicia el backend para aplicar el nuevo origen público.
- En desarrollo:
  - Vite dev: `http://localhost:5175`
  - Vite preview (común): `http://localhost:4173` (override con `--expected http://localhost:5176` si tu preview usa 5176)

## Ejecución manual

```powershell
# Ejecutar una vez con origen por defecto del backend
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\\...\\pos-system\\scripts\\run-health-smoke-once.ps1"

# Ejecutar pasando EXPECTED_ORIGIN explícito
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\\...\\pos-system\\scripts\\run-health-smoke-once.ps1" -ExpectedOrigin "http://localhost:5176"
```

