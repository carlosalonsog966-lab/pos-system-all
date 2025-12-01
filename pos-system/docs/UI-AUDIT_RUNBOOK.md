# UI AUDIT RUNBOOK
- Ejecuta local: `docker compose -f docker-compose.test.yml up -d`; `cd pos-system/frontend && npm run audit:ui`.
- Reporte HTML: `npm run audit:ui:html` → `pos-system/frontend/playwright-report/index.html`.
- Artefactos CSV/medios: `pos-system/exports/reports/UI-AUDIT/<timestamp>/`.
- Criterios CRÍTICOS (bloquean CI):
  1) Botón esencial sin acción observable (no-op: sin network/dom/route/modal/toast).
  2) `pageerror` o `console.error` en módulos clave.
  3) CRUDs que no persisten después de reload.
  4) Ruta clave que no carga.
- Para cada fallo, abrir issue con evidencia (screenshot/video/trace) y etiqueta `fix/ui-handler` o `fix/persistencia`.
# UI AUDIT RUNBOOK
- Ejecuta local: `docker compose -f docker-compose.test.yml up -d`; `cd pos-system/frontend && npm run audit:ui`.
- Reporte HTML: `npm run audit:ui:html` → `pos-system/frontend/playwright-report/index.html`.
- Artefactos CSV/medios: `pos-system/exports/reports/UI-AUDIT/<timestamp>/`.
- Criterios CRÍTICOS (bloquean CI):
  1) Botón esencial sin acción observable (no-op: sin network/dom/route/modal/toast).
  2) `pageerror` o `console.error` en módulos clave.
  3) CRUDs que no persisten después de reload.
  4) Ruta clave que no carga.
- Para cada fallo, abrir issue con evidencia (screenshot/video/trace) y etiqueta `fix/ui-handler` o `fix/persistencia`.
