# CI/CD Básico del Monorepo POS

Este documento describe el pipeline mínimo de CI configurado y cómo usarlo en el flujo diario.

## Alcance

- Repositorio: `pos-system`
- Módulos: `backend` y `frontend`
- Acciones: `lint`, `build`, `test` por módulo

## Disparadores

- `push` en ramas: `main`, `feature/**`, `feat/**`, `fix/**`, `chore/**`
- `pull_request` hacia cualquier rama

## Jobs y pasos

Cada módulo ejecuta:

1. Checkout del repositorio
2. Setup de Node `20.x` con cache `npm`
3. `npm ci` (instalación limpia)
4. `npm run lint --if-present`
5. `npm run build --if-present`
6. `npm test --if-present`

La configuración vive en `pos-system/.github/workflows/ci.yml`.

## Requisitos locales

- Node `>=18`, recomendado `20`
- Locks presentes (`package-lock.json`) en backend y frontend
- Husky instalado: ejecuta `npm run prepare` en la raíz para activar hooks

## Buenas prácticas de PR

- Mensajes de commit con convención (commitlint): `type(scope): subject`
- CI verde (todos los checks en verde)
- Plantilla de PR en `.github/pull_request_template.md` completa y checklist marcado

## Troubleshooting

- Fallos de lint: ejecutar `npm run lint` en el módulo afectado y corregir
- Fallos de build: revisar imports/paths y variables de entorno declaradas en `.env.example`
- Fallos de test: correr `npm test` localmente y adjuntar logs en el PR

## Próximos pasos (evolución)

- Publicación de artefactos (bundles y reports) con `actions/upload-artifact`
- Gates adicionales: smoke e2e y health checks
- Matriz de versiones Node y sistema operativo

## Nuevos workflows incluidos

- `ci.yml`: lint/build/test para backend y frontend.
- `smoke-health.yml`: ejecuta health smoke con `launcher/*` y tests del backend, sincroniza `exports/status` y sube artefactos (`test-results`, `playwright-report`, `status-dashboard`). Comenta automáticamente en PR con enlaces a la ejecución y cómo abrir `index.html` del dashboard.
- `contracts-verify.yml`: valida `exports/endpoints.*`, sincroniza `exports/status` y publica `api-contracts` (endpoints en YAML/JSONL/CSV/HTML y reportes). También publica `status-dashboard` y comenta automáticamente en PR con enlaces a la ejecución.
- `release-artifacts.yml`: al crear un tag `vX.Y.Z`, compila backend y frontend y sube `dist/` como artefactos.

Estos workflows implementan gates mínimos de integración y aseguran que cambios en API/health no rompan el sistema antes del merge.

## Gate de release

- Crea un tag semántico `vX.Y.Z` solo con CI verde en `ci.yml`, `smoke-health.yml` y `contracts-verify.yml`.
- `release-artifacts.yml` generará y publicará artefactos de build (`backend dist`, `frontend dist`).
- Para Tauri/Windows, se añadirá un job dedicado en un siguiente paso (requiere runner Windows y certificados si se firma).

## Comentarios automáticos en PR

- En `smoke-health.yml` y `contracts-verify.yml`, al ejecutarse sobre `pull_request` se añade un comentario con:
  - Enlace directo a la ejecución de Actions (`Runs → Artifacts`).
  - Indicaciones para descargar el artefacto y abrir `index.html` de `status-dashboard`.
  - En `contracts-verify.yml`, referencia adicional a `api-contracts` para revisar `endpoints.yaml/csv/html` y el reporte.

## Artefactos publicados

- `status-dashboard`: paquete navegable de `pos-system/exports/status/**` con `index.html`, `endpoints.html`, `endpoints.yaml`, `endpoints.csv`, `contracts-report.json`.
- `api-contracts`: contratos y endpoints (`yaml/jsonl/csv/html`) más reportes de comparación.
- `health-and-smoke-artifacts`: resultados de smoke y health (`test-results`, `playwright-report`).
