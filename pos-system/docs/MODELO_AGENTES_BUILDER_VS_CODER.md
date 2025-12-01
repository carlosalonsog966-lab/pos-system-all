# Guía de Selección de Agentes: Builder vs Coder

## Resumen de Decisión
- Builder para infraestructura, empaquetado y orquestación.
- Coder para migraciones de lógica y cambios de código.
- Flujo recomendado: Builder primero para base sólida; Coder iterativo por módulos.

## Cuándo usar Builder
- Inicializar y configurar Tauri (`tauri.conf.json`, `Cargo.toml`).
- Scripts de arranque único (`dev-all.ps1`), puertos y entorno (`.env`).
- Servir frontend desde backend o alternar entre `5174/5176`.
- Empaquetado MSI/NSIS y preparación de auto‑update.
- Configurar CSP, permisos y seguridad de escritorio.

## Cuándo usar Coder
- Implementar comandos nativos (`invoke`) en Rust: `products.list`, `clients.list`, `inventory.alerts`, `sales.create`, `cash.open/close`, `inventory.updateStock`.
- Crear driver dual en `lib/api` y portar lecturas/mutaciones.
- Idempotencia y transacciones SQLite (ventas/caja/inventario).
- Offline seguro: cola persistente, reintentos y rehidratación.
- Observabilidad en UI: panel salud, jobs y métricas.
- Optimización: índices, caché selectivo, compresión.

## Flujo Recomendado
1. Builder: base Tauri, entorno unificado, scripts y seguridad.
2. Coder: driver dual y lecturas `invoke`.
3. Coder: mutaciones críticas con transacciones/idempotencia.
4. Coder: offline seguro y observabilidad.
5. Builder: empaquetado y actualización.

## Justificación
- Builder minimiza fricción operativa al inicio (menos errores de conexión, entorno estable).
- Coder maximiza velocidad y calidad en la migración lógica por módulos.
- Combina rapidez de puesta en marcha con robustez en código.

## Inicio Rápido
- Frontend preview estable: `npm run preview` → `http://localhost:5176/`.
- Backend: `npm run dev` → `http://localhost:5757/api`.
- Tauri dev: `npx tauri dev` (ventana de escritorio en tiempo real).
- Arranque unificado: `powershell -ExecutionPolicy Bypass -File .\dev-all.ps1`.