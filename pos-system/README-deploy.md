# Guía de Deploy y Gobernanza

## Política de ramas

- `main`: estable, solo merges desde `release/*` con CI verde.
- `develop`: integración continua, base de features.
- `feature/*`: funcionalidad nueva; merge a `develop` tras CI.
- `release/*`: preparación de release; gate estricto (lint, build, test, smoke, security, package).
- `hotfix/*`: parches críticos; merge a `main` y `develop` con CI.

## Versionado

- SemVer `vX.Y.Z`. Publicar CHANGELOG y artefactos por tag.

## Gates de integración (CI)

- Pull Request: ejecutar `lint`, `build`, `test`, `smoke`, `security scan`, `package` según paquete.
- Gate de release: solo merge si todos los jobs pasan; adjuntar artefactos.

## Artefactos

- Backend: imagen Docker (`Dockerfile.backend`).
- Frontend: build de `dist/` y preview.
- Desktop/Tauri: binarios firmados si hay certificado.
- Observabilidad: dashboards y `exports/status/*` (trend, health).

## Contratos API

- Single source of truth en `pos-system/exports/endpoints.*` (CSV/JSONL/YAML).
- Compatibilidad: `expand → migrate → switch → clean` para DB y APIs.

## Feature Flags

- Activar nuevas rutas/flows mediante flags (env/feature switches) para evitar regresiones.

## Observabilidad mínima

- Health endpoint y métricas (`prom-client`) por servicio.
- Validar dashboards y alertas antes del merge.

## Reproducibilidad

- Builds determinísticos. Publicar hashes y artefactos por release.

## Definición de Listo

- CI verde, artefactos presentes, contratos actualizados, documentación al día, smoke/e2e en verde y readiness aceptable.

## Gates A/B y Variables de Entorno

- Gate A (CI listo): workflows activos (`ci.yml`, smoke/health, `security-scan.yml`), artefactos generados y `pos-system/.env.example` presente.
- Gate B (Contratos API): `exports/endpoints.*` sincronizados con tests (`tests/*.spec.ts`); `contracts-verify` en verde.

### Variables base (`pos-system/.env.example`)

- Entorno: `NODE_ENV`, `APP_ENV`.
- Backend: `PORT`, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `LOG_LEVEL`.
- Frontend: `VITE_API_BASE`, flags `VITE_ENABLE_FEATURE_FLAGS`.
- Observabilidad: `PROMETHEUS_ENABLED`, `PROMETHEUS_PORT`.
- Seguridad: `ENABLE_SECURITY_HEADERS`, `RATE_LIMIT_RPS`.
- Backups: `BACKUP_DIR`, `RESTORE_STRATEGY`.
- Docker: `DOCKER_REGISTRY`, `DOCKER_NAMESPACE`, imágenes backend/frontend.
- Tauri/Firma: `TAURI_SIGNING_CERT_PATH`, `TAURI_SIGNING_CERT_PASSWORD`.

Notas:
- No commitear secretos reales; usar variables protegidas en CI/CD.
- Smoke opcional local en pre-push: `HUSKY_SMOKE=1 git push`.
