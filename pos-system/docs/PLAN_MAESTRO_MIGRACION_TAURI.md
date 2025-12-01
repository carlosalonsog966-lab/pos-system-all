# Plan Maestro de Migración a Tauri con Comandos Nativos

## Objetivo
- Unificar el POS en una app de escritorio robusta, sin puertos ni CORS, usando Tauri + SQLite local.
- Mantener operación continua con fallback HTTP durante la transición.

## Arquitectura Destino
- Core nativo: comandos Tauri (`invoke`) para CRUD y lógica de negocio; SQLite embebido.
- UI React dentro de Tauri (preview/HMR según necesidad).
- Fallback HTTP solo mientras migramos; retirada progresiva al finalizar.

## Enfoque
- Migración por fases, iniciando con driver dual (HTTP | invoke) en `lib/api` y moviendo primero lecturas y luego mutaciones.
- Idempotencia y transacciones locales para Ventas, Caja e Inventario.
- Observabilidad dentro de Tauri: salud, jobs, latencia y logs.

## Fases
- Fase 0: Auditoría y Base
  - Inventariar flujos críticos: Productos, Clientes, Ventas, Caja, Inventario, Backup, Jobs.
  - Confirmar SQLite y modelos actuales.
- Fase 1: Driver Dual en `lib/api`
  - Añadir `apiDriver` (HTTP | invoke) y `invokeClient`.
  - Portar lecturas: `products.list`, `clients.list`, `health.status`.
- Fase 2: Comandos Nativos (Lecturas)
  - Implementar `products.list`, `clients.list`, `inventory.alerts`, `settings.public`.
- Fase 3: Mutaciones Críticas
  - `sales.create`, `cash.open/close/move`, `inventory.updateStock` con transacciones e idempotencia.
- Fase 4: Offline Seguro + Idempotencia
  - Cola local persistente, reintentos y rehidratación; estados `ok|degraded|down`.
- Fase 5: Observabilidad Interna
  - Panel Salud, logs estructurados, estado de jobs locales.
- Fase 6: Rendimiento
  - Índices en tablas calientes, batch ops, prepared statements, cache selectivo.
- Fase 7: Empaquetado y Actualizaciones
  - Build MSI/NSIS, auto-update opcional, script de primer arranque.
- Fase 8: Seguridad y Configuración
  - CSP mínima, permisos Tauri, validaciones de configuración.
- Fase 9: QA Operativo
  - Checklist de humo y flujos críticos, reconexión y modo offline.

## Entregables
- Driver dual y comandos nativos para lecturas y mutaciones clave.
- Cola offline idempotente y transaccional.
- Panel de salud, logs y métricas.
- Instalador Tauri listo con guía de uso.

## Métricas
- Latencia por comando y vista; tasa de errores/reintentos.
- Tiempo de reconexión; estabilidad de sesión; éxito de sincronización.

## Riesgos y Mitigación
- Divergencia HTTP/invoke → pruebas de paridad por flujo.
- Concurrencia SQLite → transacciones + bloqueo optimista.
- Complejidad de migración → dual driver y retirada gradual.

## Cronograma Referencial
- Semana 1: Fase 0–1 (driver dual, lecturas invoke).
- Semana 2: Fase 2–3 (mutaciones críticas).
- Semana 3: Fase 4–5 (offline + observabilidad).
- Semana 4: Fase 6–7 (performance + empaquetado).
- Semana 5: Fase 8–9 (seguridad + QA).

## Próximos Pasos
- Implementar `apiDriver` y portar `products.list`, `clients.list`, `health.status` a `invoke` manteniendo la app operativa.