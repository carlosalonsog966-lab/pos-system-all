Fecha: 2025-11-12
Contexto: Ejecución auditoría E2E total del POS (web).
Rutas auditadas: según ui-actions-map.json (Dashboard, Ventas, Caja, Joyas, Inventario, Clientes, Códigos, Rankings, Usuarios, Reportes, Configuración, Respaldos, Observabilidad, Salud, Jobs).
Resultados: PASS=22, FAIL=35, SKIP=0.
Críticos: FAIL en múltiples módulos por controles sin efecto observable y/o errores en consola/página.
Evidencia: exportada en pos-system/exports/reports/UI-AUDIT/<timestamp>/ y playwright-report.
Heurísticas aplicadas:
- Compatibilidad ESM en Playwright: se añadió fileURLToPath para resolver __dirname.
- Limpieza de duplicados HardwareScannerListener en ProductsPage y colocación única tras BarcodeScanner.
Siguientes acciones:
- Crear issues por cada FAIL con enlaces a evidencia y sugerencias de fix.
- Añadir data-testid a controles faltantes para mejorar localización.
- Revisar handlers en módulos con FAIL y asegurar efectos observables.
