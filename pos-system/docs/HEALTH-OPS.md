# Procedimientos Operativos de Salud

Este documento define cómo validar la salud del sistema y los criterios de aceptación.

## Comandos principales
- `npm run health:e2e` — Ejecuta verificación E2E contra el backend.
- `npm run smoke` — Verifica endpoints de salud y construye frontend.
- `npm run watch:health` — Inicia el Watchdog y registra cambios de estado.

## Variables de entorno
- `BACKEND_PORT` (por defecto `5656`)
- `BACKEND_HTTPS` (`1` para HTTPS, vacío para HTTP)
- `AUTH_TOKEN` ó `BEARER_TOKEN` (opcional, para endpoints protegidos)
- `WATCHDOG_SLACK_WEBHOOK_URL` (opcional, para alertas Slack)

## Estados de salud
- `UP / ok` — Salud confirmada por `/api/health` o `/api/test-health`.
- `NO-HEALTH / no_health` — Público accesible pero sin health explícito (`/settings/*`).
- `DOWN / down` — No hay endpoints accesibles.

## Criterios de aceptación
- Baseline `ok` o `no_health` para consideración de sistema operativo.
- Si baseline `down`, se debe investigar y corregir antes de continuar.

## Artefactos
- Capturas en `captures/health-*.json` y `captures/health-e2e-*.json`.
- Logs de Watchdog indican transiciones de estado y envían alertas si está configurado.
