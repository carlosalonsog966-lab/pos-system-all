# Verificación de archivos: scheduler y arranque al login

Este documento resume cómo se ejecuta la verificación de integridad de archivos de forma periódica y al iniciar sesión.

## Tarea programada cada N minutos

- Nombre: `POS_VerifyAlerts`
- Frecuencia: cada 15 minutos (configurable)
- Ejecuta: `pos-system\scripts\run-verify-alerts-once.ps1`

Comandos útiles:

```
schtasks /Query /TN "POS_VerifyAlerts" /V /FO LIST
schtasks /Run /TN "POS_VerifyAlerts"
schtasks /Delete /TN "POS_VerifyAlerts" /F
```

Para cambiar el intervalo, recrea la tarea con otro `MO` (por ejemplo, 10 minutos):

```
schtasks /Create /TN "POS_VerifyAlerts" /SC MINUTE /MO 10 /TR "powershell -NoProfile -ExecutionPolicy Bypass -File \"C:\\...\\pos-system\\scripts\\run-verify-alerts-once.ps1\"" /F /IT
```

## Arranque al iniciar sesión (HKCU Run)

Para ejecutar una verificación única al abrir sesión, se usa una entrada de registro:

- Clave: `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
- Valor: `POS_VerifyAlerts`
- Comando: `powershell -NoProfile -ExecutionPolicy Bypass -File "...\pos-system\scripts\run-verify-alerts-once.ps1"`

Administración:

```
reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v POS_VerifyAlerts
reg add   "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v POS_VerifyAlerts /t REG_SZ /d "powershell -NoProfile -ExecutionPolicy Bypass -File \"C:\\...\\pos-system\\scripts\\run-verify-alerts-once.ps1\"" /f
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v POS_VerifyAlerts /f
```

## Configuración (.env)

Variables relevantes (ver `.env.example`):

- `VERIFY_INTERVAL_MS`: intervalo en ms (por defecto 900000).
- `VERIFY_MAX_COUNT`: límite de archivos (0 = todos).
- `VERIFY_ONLY_MISMATCHES`: exportar solo discrepancias.
- `VERIFY_APPEND`: agregar filas al CSV existente.
- `VERIFY_OUTPUT_CSV_PATH`: ruta del CSV.
- `VERIFY_SLACK_WEBHOOK_URL`: webhook para notificar ALERT.
- `VERIFY_RETENTION_DAYS`: limpieza de `summary-*.json` y `alert-*.json`.
- `POS_BASE_URL`: base del backend.
- `VERIFY_HEALTHCHECK_URL`: URL explícita de health-check (si no, `${POS_BASE_URL}/api/health`).
- `VERIFY_ENV_LABEL`: etiqueta del entorno (aparece en Slack).

## Robustez añadida

- Health-check previo: si el backend no está saludable, la verificación se salta para evitar ruido.
- Lockfile (`logs/verify-alerts.lock`): evita ejecuciones solapadas en caso de que un ciclo demore más que el intervalo.
- Retención: limpieza de archivos de resumen y alerta tras `VERIFY_RETENTION_DAYS`.

## Resultados

- Logs: `pos-system\logs\verification-final.txt` (`VERIFY OK` / `VERIFY ALERT`).
- CSV: `pos-system\exports\verification-report.csv` y `verification-report-mismatches.csv` (si aplica).
- Resumen: `pos-system\exports\verification-summary.json` y versionado con timestamp.

## Backups

- El backend realiza respaldos offline en `pos-system/exports/backups/` con carpetas por tipo:
  - `MANUALES/` (manuales, opcionalmente con `correlationId`).
  - `DIARIOS/`, `SEMANALES/`, `MENSUALES/` (automáticos programados).
- La limpieza automática respeta la política de retención solo para `DIARIOS`, `SEMANALES` y `MENSUALES`. Los manuales no se autolimpian.
- El registro en manifest (`verification-manifest.json`) permite auditoría y trazabilidad de cada respaldo.

## Limpieza de exportaciones y charts (PNG)

- Además de los respaldos y verificación, el backend programa diariamente:
  - `cleanup.exports`: elimina archivos antiguos en `pos-system/exports/` según `EXPORTS_CLEANUP_DAYS` (por defecto 14).
  - `cleanup.charts`: elimina capturas PNG antiguas en `pos-system/exports/charts/` según `CHARTS_CLEANUP_DAYS` (por defecto igual a `EXPORTS_CLEANUP_DAYS`).

- Horario configurable mediante variables de entorno:
  - `EXPORTS_CLEANUP_SCHEDULE_HOUR` (por defecto 3)
  - `EXPORTS_CLEANUP_SCHEDULE_MINUTE` (por defecto 0)
  - `EXPORTS_CLEANUP_DAYS` (por defecto 14)
  - `CHARTS_CLEANUP_DAYS` (opcional; si no se define, usa `EXPORTS_CLEANUP_DAYS`)

- Logs:
  - `[Scheduler] Encolando cleanup.exports` y `[Scheduler] Encolando cleanup.charts` se muestran al disparar.
  - En ejecución, `[JobQueue::cleanup.exports]` y `[JobQueue::cleanup.charts]` reportan la cantidad limpiada.
