## Objetivos
- Eliminar errores y estabilizar el sistema para operación diaria en sucursales.
- Implementar funciones clave de punto de venta específicas para joyería de alto valor.
- Preparar empaquetado (instalador Windows y Docker) y operación con respaldo/seguridad.

## Enfoque de Trabajo
- Cadencia semanal con entregables funcionales y pruebas.
- Triage continuo de errores: registrar, priorizar Top‑10, corregir y verificar con smoke/e2e.
- Gates: no avanzar de fase si smoke/e2e del bloque actual no están en verde.

## Fase 0: Diagnóstico y Endurecimiento
- Activar logs y capturas: revisar `logs/*`, `captures/*` y endpoints `/api/health`.
- Frontend: añadir `vitest.config.ts`, estandarizar `tests/` y fortalecer `ErrorBoundary`.
- Backend: revisar middlewares (`auth`, `rate-limit`, `helmet`, CORS), normalizar respuestas.
- Configuración: alinear `VITE_API_URL`, `.env` y puertos para entorno sucursal.

## Fase 1: Corrección de Errores Críticos
- Autenticación: flujo `login`/`logout`, manejo de `401`, persistencia y renovación segura.
- API cliente: interceptores de `axios`, reintentos, deduplicación y estados de salud.
- Offline: cola y sincronización, backoff exponencial y resolución de conflictos.
- UI: loading y errores consistentes; evitar bloqueos en rutas protegidas.

## Fase 2: Flujo POS Base
- Venta: carrito, búsqueda/escaneo, descuentos acotados, impuestos, múltiples pagos.
- Impresión: ticket y recibo en alta calidad (DPI), códigos de barras/QR.
- Caja: apertura/cierre de turno, arqueo, conciliación, reportes diarios.
- Devoluciones/intercambios: políticas, reingreso a inventario y auditoría.

## Fase 3: Modelo de Joyería
- Producto extendido: metal (oro/plata/platino), quilataje, gemas (tipo, quilates, claridad, color, corte), marca y colecciones.
- Identidad y trazabilidad: `Serial/Asset` único por pieza, hallmarks y estados.
- Certificaciones: GIA/otras, adjuntos PDF/imagen y vencimientos.
- Garantías y tasaciones: documentos y flujos de servicio.
- Etiquetado: formatos de etiqueta/colgante, impresión para vitrina.

## Fase 4: Inventario y Movimientos
- Libro mayor de stock: entradas/salidas por pieza, costos y valuación.
- Conteos: inventarios cíclicos y generales; diferencias y ajustes.
- Transferencias entre sucursales: solicitud, envío y recepción.
- RFID/escaneo: soporte progresivo y mapeo de etiquetas.

## Fase 5: Reportes
- Ventas y márgenes: por sucursal, periodo, vendedor y categoría/material/gema.
- Inventario: valuación, envejecimiento y rotación de piezas.
- Certificados y garantías: seguimiento de vencimientos y estados.
- Auditoría: cambios en piezas y caja, accesos y operaciones sensibles.

## Fase 6: Multi‑Sucursal y Sincronización
- Entidades de sucursal y usuario por sucursal/rol.
- Arquitectura: servidor central (MySQL/PostgreSQL) + nodos locales (SQLite).
- Sincronización: jobs de subida/descarga y reconciliación; conflictos y reglas.

## Fase 7: Seguridad y Cumplimiento
- Roles/permisos: `admin`, `manager`, `cashier`, `auditor`.
- Endurecimiento: `helmet`, CSP básica, CORS restrictivo, límites de rate.
- TLS y secretos: manejo seguro de `.env` y certificados.
- Backups: programados y verificados; restauración documentada.

## Fase 8: Packaging y Operación
- Instalador Windows (Tauri): build, firma si disponible, auto‑update opcional.
- Docker: imágenes `backend`/`frontend` versionadas y `docker-compose.yml` productivo.
- CI/CD: pipelines de build/test/scan/release con artefactos y checksums.
- Documentación: `README-deploy.md`, `USER_GUIDE.md`, runbooks y `CHANGELOG.md`.

## Faltantes Identificados
- `CHANGELOG.md` ausente; crear y automatizar por tag.
- `vitest.config.ts` y estructura de tests en frontend; consolidar `playwright.config.ts`.
- `ENABLE_BACKUPS` no implementado en backend; añadir y documentar.
- Firma de código Tauri: configurar en `src-tauri/tauri.conf.json` y pipeline.
- Pipeline Docker: build/push con tags `vX.Y.Z` y multi‑arch.

## Priorización Inicial (Próximas 2–3 semanas)
- Semana 1: Fase 0–1 (diagnóstico + corrección Top‑10 errores y auth/API/offline).
- Semana 2: Fase 2 (flujo de venta, impresión, caja) y inicio Fase 3 (modelo de joyería).
- Semana 3: Fase 3–4 (certificaciones/seriales, inventario/transferencias) y reportes base.

## Criterios de Éxito
- Smoke/e2e verdes en `login`, `venta`, `impresión`, `cierre de caja` y `inventario`.
- Sin errores críticos en logs en jornada completa de prueba.
- Instalador en Windows con arranque limpio y configuración por sucursal.
- Backups ejecutados y restauración verificada.

## Dependencias y Preparación
- Certificado de firma (si disponible), acceso a registro Docker y repositorio de releases.
- Variables definitivas: `JWT_SECRET`, `DB_CLIENT`, `VITE_API_URL`, `SENTRY_DSN`, `ENABLE_OTEL`, `ENABLE_BACKUPS`.

¿Procedo con la ejecución de la Fase 0–1 (diagnóstico y correcciones críticas) y la preparación de tests y pipelines necesarios?