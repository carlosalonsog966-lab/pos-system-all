# Checklist Pruebas Manuales POS Joyería

## Flujo de Venta Completo
- Pasos:
  - Iniciar sesión como `admin` o `cashier`.
  - Ir a `/sales` y buscar un producto.
  - Agregar al carrito, ajustar cantidades y aplicar descuento.
  - Seleccionar método de pago (efectivo/tarjeta/transferencia/mixto) y referencias si aplica.
  - Confirmar venta, aceptar impresión de ticket.
- Resultados Esperados:
  - Se crea `Sale` y `SaleItem` en BD.
  - Stock de producto disminuye correctamente.
  - Dashboard se actualiza (ventas del día/mes, ticket promedio).
  - Caja registra movimiento (si pago efectivo).

## Apertura/Cierre de Caja
- Pasos:
  - Iniciar sesión y abrir caja con `openingAmount`.
  - Registrar movimientos `cash_in`/`cash_out`.
  - Registrar conteo de denominaciones.
  - Cerrar caja con `closingAmount` y notas.
- Resultados Esperados:
  - Sesión actual visible en `/cash-register/current`.
  - Estadísticas de sesión reflejan ventas y movimientos.

## Alta de Producto y Venta
- Pasos:
  - Crear producto con `salePrice` y `stock`.
  - Vender el producto.
- Resultados Esperados:
  - Producto aparece en inventario y bajo stock si aplica.
  - Venta refleja en reportes y rankings.

## Generación de Ranking
- Pasos:
  - Ejecutar ventas variadas.
  - Abrir `/rankings` y consultar semanal/mensual.
- Resultados Esperados:
  - Top productos/vendedores se muestran acorde a ventas.

## Reportes Básicos
- Pasos:
  - Abrir `/reports` y generar reportes de ventas/inventario.
  - Exportar CSV/Excel/PDF.
- Resultados Esperados:
  - Archivos exportados con BOM e integridad; auditoría registrada.

## Configuración Global
- Pasos:
  - Cambiar `taxRate`, `currency`, `receiptFooter`.
  - Probar impresora (`/settings/test-printer`).
- Resultados Esperados:
  - Cambios impactan Ventas y Tickets; test de impresora responde OK.

## Respaldos
- Pasos:
  - Crear respaldo manual, listar, restaurar y eliminar.
- Resultados Esperados:
  - Archivos de respaldo en la ruta configurada; restauración efectiva.

## Observabilidad y Salud
- Pasos:
  - Ejecutar ventas y operaciones; luego consultar `/observability` (eventos) y `/health`.
- Resultados Esperados:
  - Eventos registrados; health reporta `healthy=true` con detalles.

