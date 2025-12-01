# PLAN DE BLOQUES SINCRONIZADO

Este plan orquesta la entrega por bloques con gates y fechas duras.

## Hitos
- RC (01/12/2025): artefactos sin firma si aplica, Docker images RC, docs iniciales.
- GA (19/12/2025 20:00): instalador Windows firmado (si certificado), imágenes Docker, checklists, E2E/Smoke aprobados.

## Bloques
1. Infraestructura del monorepo y CI/CD.
2. Contratos API y validación.
3. Migraciones y seeds MySQL.
4. Seguridad (helmet/CSP/CORS/validación/rate-limit/logs).
5. Observabilidad (Sentry/OTEL/health/metrics).
6. QA: Jest + Playwright + smoke.
7. Desktop Tauri empaquetado y updater.
8. Documentación y runbooks.
9. Release: changelog, artefactos, publicación y despliegue.

## Gates
- Merge a `release/*` solo con CI verde (lint/build/test/smoke/security).
- 0 vulnerabilidades “high/critical” para GA.

