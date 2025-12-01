# Definición de Listo (DoD) y Criterios de Aceptación

## Bloque 0: Gobernanza y Control de Cambios
- PR con checklist completo y revisores asignados (CODEOWNERS).
- CI verde en todos los jobs requeridos.
- README-deploy actualizado; plantilla de PR en `.github/`.

## Bloque 1: Monorepo y Configuración
- Hooks Husky funcionando (pre-push y commit-msg) y `prepare` configurado.
- Lint y tests sin errores críticos en backend y frontend.
- `.env.example` alineado y consensuado.

## Bloque 2: CI/CD
- Workflows para lint/build/test/smoke/security/package por paquete.
- Artefactos publicados por tag; gate de release activo.

## Bloque 3: Backend
- Contratos API consistentes con `exports/endpoints.*`.
- Migraciones seguras (expand → migrate → switch → clean) sin pérdida.
- Health y métricas validadas; smoke y e2e verdes.

## Bloque 4: Frontend
- Build reproducible; errores capturados a logs.
- Pruebas UI (Playwright/Vitest) ≥95% verde; contratos respetados.

## Bloque 5: Desktop/Tauri
- Instalador reproducible; updater estable; firma si disponible.
- Pruebas de instalación/arranque/actualización/desinstalación.

## Bloque 6: QA
- Unitarias, integración, e2e y smoke con cobertura suficiente.
- Reportes en `playwright-report/` y `test-results/.last-run.json`.

## Bloque 7: Seguridad
- Scans sin hallazgos críticos; rate-limit y auth robusto.
- Dependencias auditadas y actualizadas.

## Bloque 8: Observabilidad
- Dashboards y alertas configurados; health endpoints expuestos.
- Métricas básicas publicadas y monitoreadas.

## Bloque 9: Documentación
- Guías técnicas y de usuario actualizadas.
- URL y enlaces de compartición verificados.

## Bloque 10: Distribución
- Artefactos empaquetados y publicados con hashes.
- Release notes completas y validadas.

