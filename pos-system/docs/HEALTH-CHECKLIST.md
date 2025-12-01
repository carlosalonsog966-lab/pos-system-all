# Checklist de Salud Binaria

Use este checklist para una validación rápida antes de despliegues o cambios.

- [ ] Backend responde en `/api/test-health` (200).
- [ ] Health avanzado en `/api/health` (200, `success: true`).
- [ ] Ajustes públicos en `/api/settings/public` (200).
- [ ] System info en `/api/settings/system-info` (200 o 429).
- [ ] Estado offline en `/offline/status` (200).
- [ ] (Opcional) Ventas `/api/sales/health` con token (200).
- [ ] (Opcional) Jobs `/api/jobs/health` con token (200).

## Ejecución
- `npm run health:e2e` y revisar el archivo generado en `captures/`.
- `npm run watch:health` para monitoreo continuo.
