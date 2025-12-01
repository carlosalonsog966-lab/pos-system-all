# Inspección General POS Joyería

## Módulos Revisados (en orden)
- Dashboard: OK
- Ventas: OK / CON PENDIENTES (mutaciones requieren JWT para entorno de prueba)
- Caja: CON PENDIENTES (flujo completo requiere JWT)
- Joyas / Inventario: OK / CON PENDIENTES (mutaciones requieren JWT)
- Clientes: OK / CON PENDIENTES (mutaciones requieren JWT)
- Códigos QR/Barras: OK
- Rankings: OK / CON PENDIENTES (validación con dataset de ventas end-to-end)
- Usuarios: OK / CON PENDIENTES (mutaciones requieren JWT)
- Reportes: OK
- Configuración: OK / CON PENDIENTES (actualizaciones requieren JWT)
- Respaldos: OK / CON PENDIENTES (ejecución real con permisos FS)
- Observabilidad: OK
- Salud: OK
- Jobs: OK / CON PENDIENTES (pruebas de encolado y reintento con JWT)

## Problemas Encontrados y Solucionados
- Frontend no compilaba por atributos inválidos en notificaciones (`role`, `htmlAttributes`, `data-testid`).
  - Solución: remoción de atributos inválidos; uso de store de notificaciones (`showSuccess`, `showError`, `showInfo`).
- Inconsistencia de campos de precio en UI de Ventas (`product.price` vs `product.salePrice`).
  - Solución: reemplazo consistente por `product.salePrice` en `SalesPage.tsx`.
- Tipos DOM en `HardwareScannerListener` y tipos mínimos de `Employee`.
  - Solución: casts y ampliación de interface.

## Sincronización entre Módulos
- Evento global `sale:created` disparado tras crear venta refresca Dashboard y Reportes.
- Inventario y Ventas: actualización de stock a través de `Product.updateStockWithLock`.
- Rankings se basan en ventas reales; Reportes alimenta gráficos y KPIs del Dashboard.

## Pendientes para Revisión Manual
- Ejecutar flujo de ventas end-to-end con JWT activo y verificar:
  - Actualización de stock por producto
  - KPIs del Dashboard (ventas del día/mes, ticket promedio)
  - Movimientos de Caja (ventas en efectivo)
  - Rankings (productos y vendedores)
  - Reportes de período y exportaciones CSV/Excel/PDF
- Verificar respaldos: creación, restauración y eliminación con permisos de FS
- Probar encolado y reintento de jobs específicos

## Documentación por Módulo
- Ver archivos en `pos-system/docs/INSPECCION_*.md` para detalles y evidencias.

