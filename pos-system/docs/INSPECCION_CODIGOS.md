# Inspección Módulo: Códigos QR/Barras

## Localización del Módulo
- Ruta: `/barcodes`
- Frontend: componentes en `frontend/src/pages/Codes/CodesPage.tsx`
- Backend: `backend/src/routes/barcodeRoutes.ts`, `backend/src/controllers/barcodeController.ts`
- Modelos: `Barcode`, `Guide`, `Employee`, `Agency`, `Branch`

## Comportamiento Esperado
- Generación de códigos para guías/empleados.
- Escaneo y resolución del código a la entidad activa.
- Listado, activación/desactivación, códigos imprimibles.
- Integración con Ventas: escaneo agrega entidad o producto correcto.

## Inspección de Flujo de Datos
- UI → `GET /api/barcodes/scan/:code` → `BarcodeController.scanBarcode` → BD → Respuesta con `entity`.
- Generación: `POST /api/barcodes/generate` con validaciones y secuencias.

## Pruebas Concretas
- Endpoints presentes y funcionales:
  - `scanBarcode` valida `type` y activa/inactiva (`barcodeController.ts:11-90`).
  - Listado con includes y orden (`barcodeController.ts:93-150`).
  - Generación con verificación de existentes y secuencia por agencia (`barcodeController.ts:152-219`).

## Correcciones Aplicadas
- Sin cambios necesarios; frontend compila.

## Regresión Básica
- Confirmar escaneo integra con Ventas (UI usa `SalesPage` para referencias y filtros con `hasReference`).

## Estado del Módulo
- Estado del módulo: OK.

