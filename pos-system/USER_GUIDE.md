# Guía de Usuario - Sistema POS

## Índice
1. [Introducción](#introducción)
2. [Primeros Pasos](#primeros-pasos)
3. [Gestión de Productos](#gestión-de-productos)
4. [Proceso de Ventas](#proceso-de-ventas)
5. [Gestión de Clientes](#gestión-de-clientes)
6. [Inventario](#inventario)
7. [Reportes y Análisis](#reportes-y-análisis)
8. [Configuración](#configuración)
9. [Modo Offline](#modo-offline)
10. [Solución de Problemas](#solución-de-problemas)
11. [Preguntas Frecuentes](#preguntas-frecuentes)
12. [Observabilidad](#observabilidad)

## Pruebas y Modo de Test

### Activar `testMode` por URL
- Puedes activar el modo de prueba en cualquier página añadiendo el parámetro de consulta `testMode=1` o su alias corto `tm=1` en la URL.
- Ejemplos:
  - `#/products?testMode=1`
  - `#/sales?tm=1`

### Alias negativos intencionales
- Cualquier valor distinto de `"1"` NO activa el modo de prueba.
- Útil para verificar estados de carga en pruebas.
- Ejemplos de alias negativos:
  - `#/reports?testMode=true` → muestra spinner inicial
  - `#/products?tm=true` → muestra spinner “Cargando inventario...”
  - `#/clients?testMode=0` → muestra spinner (`data-testid="loading-spinner"`)

### Buenas prácticas en pruebas
- Usa los helpers comunes:
  - `assertRedirect(path)` para validar redirecciones protegidas.
  - `assertNoSpinner(text)` para asegurar que un texto de carga no aparece en `testMode`.
- En páginas con carga diferida (`React.lazy` + `Suspense`), el spinner de `Suspense` puede aparecer brevemente al montar. Prefiere validar elementos clave de la UI (placeholders, labels, botones) como señal de render estable.

### Botón de “Importación de prueba” en ProductsPage
- Propósito: verificar rápidamente la persistencia local del store de productos en `testMode` sin depender del backend.
- Activación: abre `#/products?testMode=1` para que aparezca el botón “Importación de prueba” en la barra de filtros.
- Funcionamiento:
  - Simula flujo offline: encola una acción `BULK_IMPORT_PRODUCTS` con dos ítems de ejemplo y fuerza la sincronización local.
  - Muestra notificación de éxito al finalizar.
- Evidencia de persistencia:
  - Tras hacer clic, el `localStorage['products-store']` debe contener al menos 2 productos nuevos.
  - Los IDs internos pueden ser generados con prefijo `imp-...`; el `sku`/`code` se conserva para búsquedas.
- Prueba dirigida (opcional):
  - Ejecuta únicamente el test de integración de ProductsPage: `npm test -- --run src/pages/Products/ProductsPage.integration.test.tsx`
- Este test valida la existencia del botón en `testMode` y la persistencia mínima en el store.

## Observabilidad

### Panel de Observabilidad
- Acceso: `#/observability`
- Contenido: Eventos recientes, métricas agregadas, latencias por ruta.

### Filtros de eventos
- Parámetros principales: `type`, `severity`, `limit`, `page`, `search`, `from`, `to`, `windowHours`.
- Persistencia: se guardan automáticamente en `localStorage` (`obs_events_filters`).
- Sincronización: cambios en filtros actualizan la URL y viceversa.
- Limpieza rápida: botón “Limpiar filtros” reinicia filtros a valores por defecto.

### Latencias por ruta
- Parámetros: `lat_sort`, `lat_dir`, `lat_method`, `lat_route`, `lat_limit`, `lat_page`.
- Persistencia: se guardan en `localStorage` (`obs_latency_filters`).
- Sincronización: cambios en latencias actualizan la URL y viceversa.
- Limpieza rápida: botón “Limpiar filtros” reinicia filtros y paginación.

### Preferencias y utilidades
- Auto-actualización (cada 30s): preferencia persistida en `localStorage` (`obs_auto_refresh`).
- Copiar enlace: copia la URL actual con filtros activos.
- Compartir por email: abre un enlace `mailto` con resumen; botón “Copiar contenido email” actúa de fallback.
- Resetear preferencias: borra persistencia de filtros y restaura valores por defecto.
- Copiar estado: copia en el portapapeles un JSON con URL, filtros y preferencias.

### Sugerencias de uso
- Para compartir un estado: usa “Copiar estado” y pega el JSON en tu herramienta de soporte.
- Para reproducir un escenario: abre el enlace compartido y, si no incluye parámetros, la página cargará los últimos filtros guardados.


## Introducción

### ¿Qué es el Sistema POS?
El Sistema POS (Point of Sale) es una solución completa para la gestión de ventas, inventario y clientes de tu negocio. Está diseñado para ser intuitivo, rápido y funcionar tanto online como offline.

### Características Principales
- ✅ **Ventas rápidas**: Proceso de venta optimizado
- ✅ **Gestión de inventario**: Control completo de productos
- ✅ **Clientes**: Base de datos de clientes integrada
- ✅ **Reportes**: Análisis detallado de ventas
- ✅ **Modo offline**: Funciona sin internet
- ✅ **Sincronización**: Datos siempre actualizados
- ✅ **Interfaz moderna**: Diseño intuitivo y responsive

## Primeros Pasos

### 1. Acceso al Sistema
1. Abre tu navegador web
2. Navega a la URL del sistema POS
3. Ingresa tus credenciales de acceso:
   - **Email**: tu-email@ejemplo.com
   - **Contraseña**: tu contraseña segura

### 2. Panel Principal
Una vez dentro, verás el **Dashboard** principal con:
- **Resumen de ventas del día**
- **Productos con stock bajo**
- **Ventas recientes**
- **Métricas importantes**

### 3. Navegación
El menú lateral te permite acceder a:
- 🏠 **Dashboard**: Resumen general
- 🛒 **Ventas**: Realizar y gestionar ventas
- 📦 **Productos**: Catálogo de productos
- 👥 **Clientes**: Base de datos de clientes
- 📊 **Reportes**: Análisis y estadísticas
- ⚙️ **Configuración**: Ajustes del sistema

## Gestión de Productos

### Agregar un Nuevo Producto

1. **Navega a Productos**
   - Haz clic en "Productos" en el menú lateral

2. **Crear Producto**
   - Haz clic en el botón "➕ Nuevo Producto"
   - Completa el formulario:

   ```
   📝 Información Básica
   ├── Nombre del producto *
   ├── Descripción
   ├── Categoría
   └── Código de barras
   
   💰 Precios e Inventario
   ├── Precio de venta *
   ├── Precio de costo
   ├── Stock inicial
   └── Stock mínimo
   
   🖼️ Imagen
   └── Subir imagen del producto
   ```

3. **Guardar**
   - Haz clic en "Guardar Producto"
   - El producto aparecerá en tu catálogo

### Editar un Producto

1. **Buscar el producto**
   - Usa la barra de búsqueda o navega por categorías
   
2. **Editar**
   - Haz clic en el ícono de edición (✏️)
   - Modifica los campos necesarios
   - Guarda los cambios

### Gestión de Stock

#### Actualizar Stock Manualmente
1. Ve al producto que deseas actualizar
2. Haz clic en "Ajustar Stock"
3. Ingresa la nueva cantidad
4. Selecciona el motivo:
   - ➕ **Entrada**: Compra, devolución
   - ➖ **Salida**: Venta, pérdida, daño
5. Confirma el ajuste

#### Alertas de Stock Bajo
- El sistema te notificará cuando un producto esté por debajo del stock mínimo
- Aparecerá un indicador rojo en el dashboard
- Recibirás notificaciones automáticas

### Categorías de Productos

#### Crear Categoría
1. En la sección de productos, haz clic en "Gestionar Categorías"
2. Haz clic en "➕ Nueva Categoría"
3. Ingresa el nombre y descripción
4. Guarda la categoría

#### Asignar Productos a Categorías
- Al crear o editar un producto, selecciona la categoría correspondiente
- Esto facilita la organización y búsqueda

## Proceso de Ventas

### Realizar una Venta Rápida

1. **Iniciar Venta**
   - Haz clic en "Nueva Venta" o usa el atajo `Ctrl + N`

2. **Agregar Productos**
   - **Método 1**: Escanea el código de barras
   - **Método 2**: Busca por nombre y haz clic en "Agregar"
   - **Método 3**: Navega por categorías

3. **Ajustar Cantidades**
   - Modifica las cantidades usando los botones +/-
   - O ingresa la cantidad directamente

4. **Aplicar Descuentos** (opcional)
   - Haz clic en "Aplicar Descuento"
   - Ingresa el porcentaje o monto fijo
   - Confirma el descuento

5. **Seleccionar Cliente** (opcional)
   - Busca el cliente existente
   - O crea uno nuevo rápidamente

6. **Procesar Pago**
   - Selecciona el método de pago:
     - 💵 **Efectivo**
     - 💳 **Tarjeta**
     - 📱 **Transferencia**
   - Ingresa el monto recibido (si es efectivo)
   - El sistema calculará el cambio automáticamente

7. **Finalizar Venta**
   - Haz clic en "Procesar Venta"
   - Se generará el recibo automáticamente
   - Opción de imprimir o enviar por email

### Gestión de Ventas

#### Ver Historial de Ventas
1. Ve a la sección "Ventas"
2. Usa los filtros para encontrar ventas específicas:
   - 📅 **Por fecha**
   - 👤 **Por cliente**
   - 💰 **Por monto**
   - 📋 **Por estado**

#### Anular una Venta
1. Encuentra la venta en el historial
2. Haz clic en "Ver Detalles"
3. Haz clic en "Anular Venta"
4. Confirma la acción
5. El stock se restaurará automáticamente

#### Reembolsos Parciales
1. Abre los detalles de la venta
2. Selecciona los productos a reembolsar
3. Haz clic en "Reembolso Parcial"
4. Confirma la operación

## Auditoría de cambios de precio (Productos)

Objetivo
- Garantizar trazabilidad cuando se modifican precios de productos.

Cómo usarlo
- En Productos, edita un producto y cambia `Precio de venta` y/o `Precio de compra`.
- Completa el campo `Motivo de actualización de precio` si hubo cambios.
- La `Moneda` se precarga automáticamente desde configuración.
- Guarda los cambios.

Resultados esperados
- Si cambiaste precio y el motivo está vacío, la página bloquea el guardado y muestra un aviso.
- Con motivo válido, el producto se actualiza y el backend registra auditoría con precios previos/nuevos, motivo y moneda.
- Si no hubo cambios de precio, no se requiere motivo y no se genera auditoría de precio.

## Gestión de Clientes

### Agregar un Cliente

1. **Acceder a Clientes**
   - Haz clic en "Clientes" en el menú

2. **Crear Cliente**
   - Haz clic en "➕ Nuevo Cliente"
   - Completa la información:

   ```
   👤 Información Personal
   ├── Nombre completo *
   ├── Email
   ├── Teléfono
   └── Fecha de nacimiento
   
   📍 Dirección
   ├── Dirección
   ├── Ciudad
   ├── Código postal
   └── País
   
   💼 Información Comercial
   ├── Tipo de cliente
   ├── Límite de crédito
   └── Descuento especial
   ```

3. **Guardar Cliente**
   - Haz clic en "Guardar Cliente"

### Historial de Compras
- Cada cliente tiene un historial completo de sus compras
- Puedes ver productos favoritos y patrones de compra
- Estadísticas de gasto total y frecuencia

### Programa de Fidelidad
- Configura puntos por compra
- Define recompensas automáticas
- Seguimiento de puntos acumulados

## Inventario

### Control de Stock

#### Vista General
- **Stock actual**: Cantidad disponible
- **Stock reservado**: Productos en órdenes pendientes
- **Stock disponible**: Stock actual - reservado
- **Valor del inventario**: Valor total del stock

#### Movimientos de Inventario
Todos los cambios de stock se registran automáticamente:
- ✅ **Ventas**: Reducen el stock
- 📦 **Compras**: Aumentan el stock
- 🔄 **Ajustes**: Correcciones manuales
- 📋 **Transferencias**: Entre ubicaciones

#### Inventario Físico
1. Ve a "Inventario" → "Conteo Físico"
2. Selecciona los productos a contar
3. Ingresa las cantidades reales
4. El sistema calculará las diferencias
5. Confirma los ajustes necesarios

### Alertas y Notificaciones

#### Stock Bajo
- Configuración de niveles mínimos por producto
- Alertas automáticas en el dashboard
- Notificaciones por email (opcional)

#### Productos Vencidos
- Seguimiento de fechas de vencimiento
- Alertas preventivas
- Reportes de productos próximos a vencer

## Reportes y Análisis

### Reportes de Ventas

#### Reporte Diario
- **Ventas totales del día**
- **Número de transacciones**
- **Ticket promedio**
- **Productos más vendidos**
- **Métodos de pago utilizados**

#### Reporte Semanal/Mensual
- **Tendencias de ventas**
- **Comparación con períodos anteriores**
- **Crecimiento porcentual**
- **Análisis por categorías**

#### Reporte por Producto
- **Productos más vendidos**
- **Productos con menor rotación**
- **Análisis de rentabilidad**
- **Tendencias de demanda**

### Reportes de Inventario

#### Valorización de Inventario
- **Valor total del stock**
- **Valor por categoría**
- **Productos de alto valor**
- **Análisis de rotación**

#### Movimientos de Stock
- **Entradas y salidas**
- **Ajustes realizados**
- **Transferencias**
- **Historial completo**

### Exportar Reportes
- **PDF**: Para impresión y archivo
- **Excel**: Para análisis adicional
- **CSV**: Para integración con otros sistemas

## Configuración

### Configuración General

#### Información de la Empresa
```
🏢 Datos de la Empresa
├── Nombre de la empresa
├── RUC/NIT
├── Dirección
├── Teléfono
├── Email
└── Logo
```

#### Configuración de Ventas
```
💰 Configuración de Ventas
├── Moneda predeterminada
├── Impuestos (IVA/IGV)
├── Métodos de pago disponibles
├── Numeración de facturas
└── Términos y condiciones
```

### Usuarios y Permisos

#### Roles de Usuario
- **👑 Administrador**: Acceso completo
- **👨‍💼 Gerente**: Gestión y reportes
- **👨‍💻 Cajero**: Solo ventas
- **👤 Usuario**: Acceso limitado

#### Gestión de Usuarios
1. Ve a "Configuración" → "Usuarios"
2. Haz clic en "➕ Nuevo Usuario"
3. Completa la información:
   - Nombre y email
   - Contraseña temporal
   - Rol asignado
   - Permisos específicos

### Configuración de Impresión

#### Configurar Impresora
1. Ve a "Configuración" → "Impresión"
2. Selecciona el tipo de impresora:
   - **Térmica**: Para recibos
   - **Láser/Inkjet**: Para facturas
3. Configura el formato de recibo
4. Prueba la impresión

#### Personalizar Recibos
- **Encabezado**: Logo y datos de la empresa
- **Cuerpo**: Formato de productos y totales
- **Pie**: Mensaje de agradecimiento y políticas

## Modo Offline

### ¿Qué es el Modo Offline?
El sistema puede funcionar completamente sin conexión a internet, permitiendo:
- ✅ Realizar ventas
- ✅ Consultar productos
- ✅ Ver información de clientes
- ✅ Generar reportes básicos

### Indicadores de Estado

#### Conectado
- 🟢 **Indicador verde**: Sistema online
- Sincronización automática activa
- Todas las funciones disponibles

#### Desconectado
- 🔴 **Indicador rojo**: Modo offline
- Datos almacenados localmente
- Sincronización pendiente

### Sincronización Automática

#### Cuando se Restaura la Conexión
1. **Detección automática** de conectividad
2. **Sincronización de datos** pendientes
3. **Resolución de conflictos** si es necesario
4. **Notificación** de sincronización completada

#### Gestión Manual
- **Forzar sincronización**: Botón en la barra de estado
- **Ver cola de sincronización**: Acciones pendientes
- **Resolver conflictos**: Interfaz de resolución manual

### Limitaciones en Modo Offline
- ❌ No se pueden agregar nuevos productos
- ❌ Reportes limitados a datos locales
- ❌ No se pueden modificar configuraciones
- ⚠️ Capacidad limitada de almacenamiento local

## Solución de Problemas

### Problemas Comunes

#### El Sistema No Carga
**Posibles causas:**
- Problemas de conexión a internet
- Servidor temporalmente no disponible
- Caché del navegador corrupto

**Soluciones:**
1. Verifica tu conexión a internet
2. Actualiza la página (F5)
3. Limpia el caché del navegador
4. Intenta en modo incógnito

#### Error al Procesar Venta
**Posibles causas:**
- Stock insuficiente
- Problemas de conectividad
- Error en el cálculo de precios

**Soluciones:**
1. Verifica el stock disponible
2. Revisa los precios de los productos
3. Intenta la venta en modo offline
4. Contacta al soporte técnico

#### Problemas de Sincronización
**Síntomas:**
- Datos no actualizados
- Conflictos de sincronización
- Errores de conexión

**Soluciones:**
1. Verifica la conexión a internet
2. Fuerza la sincronización manual
3. Resuelve conflictos pendientes
4. Reinicia la aplicación

#### Impresora No Responde
**Verificaciones:**
1. ✅ Impresora encendida y conectada
2. ✅ Papel disponible
3. ✅ Drivers instalados correctamente
4. ✅ Configuración de impresora correcta

### Contacto de Soporte

#### Información a Proporcionar
Cuando contactes al soporte, incluye:
- **Descripción del problema**
- **Pasos para reproducir el error**
- **Mensajes de error específicos**
- **Navegador y versión utilizada**
- **Hora aproximada del incidente**

#### Canales de Soporte
- 📧 **Email**: soporte@sistemapos.com
- 📞 **Teléfono**: +1 (555) 123-4567
- 💬 **Chat en vivo**: Disponible en horario laboral
- 📚 **Base de conocimientos**: help.sistemapos.com

## Preguntas Frecuentes

### Generales

**P: ¿Puedo usar el sistema en múltiples dispositivos?**
R: Sí, puedes acceder desde cualquier dispositivo con navegador web. Tus datos se sincronizan automáticamente.

**P: ¿Qué pasa si se va la luz durante una venta?**
R: El sistema guarda automáticamente el progreso. Al reiniciar, puedes continuar donde lo dejaste.

**P: ¿Puedo personalizar los recibos?**
R: Sí, puedes personalizar el formato, agregar tu logo y modificar los mensajes.

### Ventas

**P: ¿Cómo cancelo una venta en proceso?**
R: Haz clic en "Cancelar Venta" o usa el atajo Esc. Los productos se devolverán al carrito.

**P: ¿Puedo hacer descuentos por producto?**
R: Sí, puedes aplicar descuentos individuales por producto o descuentos generales a toda la venta.

**P: ¿Cómo manejo las devoluciones?**
R: Ve al historial de ventas, encuentra la venta y selecciona "Procesar Devolución".

### Inventario

**P: ¿Cómo importo mi inventario existente?**
R: Usa la función "Importar Productos" en la sección de productos. Acepta archivos Excel y CSV.

**P: ¿El sistema maneja códigos de barras?**
R: Sí, puedes escanear códigos de barras para agregar productos rápidamente a las ventas.

**P: ¿Cómo configuro alertas de stock bajo?**
R: En cada producto, establece el "Stock Mínimo". El sistema te alertará automáticamente.

### Reportes

**P: ¿Puedo programar reportes automáticos?**
R: Sí, puedes configurar reportes que se envíen automáticamente por email diaria, semanal o mensualmente.

**P: ¿Los reportes incluyen gráficos?**
R: Sí, los reportes incluyen gráficos interactivos y visualizaciones de datos.

### Seguridad

**P: ¿Mis datos están seguros?**
R: Sí, utilizamos encriptación SSL y todas las contraseñas están hasheadas. Los datos se respaldan automáticamente.

**P: ¿Puedo controlar quién accede a qué información?**
R: Sí, el sistema de roles y permisos te permite controlar exactamente qué puede hacer cada usuario.

---

## Consejos y Mejores Prácticas

### Para Maximizar la Eficiencia

1. **Usa atajos de teclado**
   - `Ctrl + N`: Nueva venta
   - `Ctrl + P`: Imprimir
   - `F1`: Ayuda
   - `Esc`: Cancelar acción

2. **Organiza tu inventario**
   - Usa categorías claras
   - Mantén descripciones consistentes
   - Actualiza precios regularmente

3. **Configura alertas**
   - Stock mínimo por producto
   - Notificaciones de ventas importantes
   - Recordatorios de tareas

4. **Realiza respaldos regulares**
   - Exporta datos importantes
   - Verifica la sincronización
   - Mantén copias de seguridad

### Para Mejorar las Ventas

1. **Conoce a tus clientes**
   - Mantén información actualizada
   - Usa el historial de compras
   - Ofrece productos relacionados

2. **Analiza los reportes**
   - Identifica productos populares
   - Detecta tendencias de venta
   - Optimiza el inventario

3. **Capacita a tu equipo**
   - Asegúrate de que todos sepan usar el sistema
   - Establece procedimientos claros
   - Revisa regularmente los procesos

---

## Verificación de Integridad de Archivos

### ¿Para qué sirve?
- Comprueba que los archivos almacenados físicamente coinciden con el checksum guardado en la base de datos.
- Útil para auditorías, detectar corrupción o pérdidas de archivos en disco.

### Endpoint disponible
- `GET /api/files/:id/verify` (requiere autenticación y rol válido)
- Respuesta incluye: `exists`, `checksumDb`, `checksumActual`, `match`, `path`.

### Ejemplo rápido con curl
- `curl -H "Authorization: Bearer <TOKEN>" http://localhost:5656/api/files/<ID>/verify`

### Script de verificación (Windows PowerShell)
- Ruta: `pos-system\scripts\verify-files.ps1`
- Ejecuta login (admin), lista archivos y verifica hasta 3 IDs.
- Guarda capturas JSON en `pos-system\captures` y un resumen en `pos-system\logs\verification-final.txt`.

#### Cómo ejecutarlo
- Abre PowerShell en la raíz del proyecto y corre:
- `powershell -ExecutionPolicy Bypass -File pos-system\scripts\verify-files.ps1`

#### Variables opcionales
- `POS_BASE_URL` (por defecto `http://localhost:5656`)
- `POS_ADMIN_USERNAME` (por defecto `admin`)
- `POS_ADMIN_PASSWORD` (por defecto `admin123`)

#### Resultados esperados
- Log con líneas tipo: `ID=<id> path=<path> checksumDb=<db> checksumActual=<actual> resultado=<MATCH|MISMATCH|MISSING>`
- Archivos de captura por verificación en `pos-system\captures\verify-<ID>-<timestamp>.json`.

### Verificación por Lote (CSV)
- Ruta: `pos-system\scripts\verify-files-batch.ps1`
- Verifica todos los archivos (o un límite con `-MaxCount`) y genera un reporte CSV.
- Salida: `pos-system\exports\verification-report.csv` y resumen en `pos-system\logs\verification-final.txt`.

#### Alertas de verificación programadas (Node)
- Ruta: `pos-system\launcher\file-verification-alerts.js`
- Función: ejecuta el script batch periódicamente, lee `exports/verification-summary.json` y registra un resumen en `logs/verification-final.txt`. Si hay discrepancias (`mismatch`, `missing` o `error` > 0), genera un archivo de alerta `exports/verification-alert-<timestamp>.json`.

##### Cómo ejecutarlo
- Único (una pasada y salir): `npm run verify:alerts:once`
- Periódico (por defecto cada 15 minutos): `npm run verify:alerts`

##### Variables opcionales (entorno)
- `VERIFY_INTERVAL_MS`: intervalo en ms (por defecto `900000`).
- `VERIFY_MAX_COUNT`: límite de archivos a verificar (por defecto `0` = todos).
- `VERIFY_ONLY_MISMATCHES`: `1|true` para filtrar solo discrepancias en el CSV.
- `VERIFY_APPEND`: `1|true` para acumular filas en el CSV existente.
- `VERIFY_OUTPUT_CSV_PATH`: ruta del CSV (por defecto `pos-system\exports\verification-report.csv`).
 - `VERIFY_SLACK_WEBHOOK_URL`: si se define, envía un mensaje a Slack cuando hay discrepancias.
 - `VERIFY_RETENTION_DAYS`: días de retención para limpiar `verification-summary-*.json` y `verification-alert-*.json` (por defecto `7`).

##### Resultados
- `logs/verification-final.txt` registra líneas tipo:
  - `VERIFY OK total=<n> match=<m> durationMs=<ms> csv=<archivo>`
  - `VERIFY ALERT total=<n> match=<m> mismatch=<x> missing=<y> error=<z> durationMs=<ms> csv=<archivo> file=<alert-json>`
- `exports/verification-alert-<YYYY-MM-DDTHH-MM-SSZ>.json` contiene el mismo `summary.json` cuando hay discrepancias.

#### Programador de Tareas (Windows)
- Script: `pos-system\scripts\register-verify-alerts-task.ps1`
- Registra una tarea que ejecuta el lanzador al iniciar sesión y cada N minutos.
- Ejemplo:
  - `powershell -ExecutionPolicy Bypass -File pos-system\scripts\register-verify-alerts-task.ps1 -IntervalMinutes 15`
  - Usa `-NodePath "C:\\Program Files\\nodejs\\node.exe"` si Node no está en `PATH`.

#### Ejemplos de ejecución
- Todo: `powershell -ExecutionPolicy Bypass -File pos-system\scripts\verify-files-batch.ps1`
- Primeros 100: `powershell -ExecutionPolicy Bypass -File pos-system\scripts\verify-files-batch.ps1 -MaxCount 100`

#### Opciones avanzadas
- `-OnlyMismatches`: exporta solo discrepancias (`MISMATCH` o `MISSING`).
- `-Append`: agrega filas al CSV existente (sin repetir cabecera).
- `-OutputCsvPath <ruta>`: define la ruta de salida del CSV.

#### Columnas del CSV
- `id`, `path`, `exists`, `checksumDb`, `checksumActual`, `match`, `status`

#### Resumen por Lote (JSON)
- El script genera un resumen en `pos-system\exports\verification-summary.json` y una versión con timestamp en `pos-system\exports\verification-summary-<YYYYMMDD-HHMMSS>.json`.
- Campos incluidos:
  - `timestamp`, `baseUrl`, `append`, `onlyMismatches`, `csvPath`
  - `counts`: `total`, `match`, `mismatch`, `missing`, `error`
  - `durationMs`
- Útil para observabilidad, métricas y automatización de alertas.

*Guía actualizada: Diciembre 2024*
*Versión del sistema: 1.0.0*

¿Necesitas ayuda adicional? Contacta a nuestro equipo de soporte técnico.
