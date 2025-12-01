# Runbook: Rotación de Logs

## Objetivo
- Mantener logs consistentes, con retención y tamaño controlado.

## Política
- Nivel por entorno: `prod=info`, `staging=debug`, `dev=debug`.
- Retención: 14 días (ajustable).
- Tamaño máximo por archivo: 20MB con rotación y compresión.

## Implementación
- Backend: usar logger con `maxSize`, `maxFiles`, `zip`. Revisar variables `LOG_LEVEL`.
- Frontend: centralizar errores y eventos en consola y envío a backend si aplica.
- Tauri: habilitar rotación en archivo local del usuario.

## Auditoría
- Revisar alertas por crecimiento anómalo y PII accidental.

