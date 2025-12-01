# Inspección Módulo: Caja

## Localización del Módulo
- Ruta: `/cash-register`
- Componente: `frontend/src/pages/CashRegister/CashRegisterPage.tsx`
- Endpoints backend (autenticados):
  - `POST /api/cash-register/open` (apertura)
  - `POST /api/cash-register/cash-movement` (movimientos)
  - `POST /api/cash-register/denomination-count` (conteo billetes)
  - `POST /api/cash-register/close/:sessionId` (cierre)
  - `GET /api/cash-register/current`, `GET /api/cash-register/sessions`, `GET /api/cash-register/stats/:sessionId`
- Modelos: `CashRegister`, `Sale`

## Comportamiento Esperado
- Apertura con monto inicial y usuario actual.
- Registro de movimientos en efectivo (ventas, entradas/salidas manuales).
- Conteo de denominaciones y cierre con reporte.
- Impacto: las ventas en efectivo deben reflejarse en movimientos y en estadísticas de sesión.

## Inspección de Flujo de Datos
- UI → `api.post('/cash-register/open')` → `CashRegisterController.openCashRegister` → BD → Respuesta → Notificaciones.
- Lecturas de sesión y estadísticas vía `GET ...`.

## Pruebas Concretas
- Casos:
  1) Apertura de caja con `openingAmount=1000`.
  2) Registrar movimiento `cash_in` de una venta en efectivo.
  3) Registrar conteo de denominaciones.
  4) Cierre con `closingAmount` y notas.
- Requisitos: JWT activo para mutaciones.

## Correcciones Aplicadas
- Frontend: remoción de atributos inválidos en notificaciones que impedían compilar; mensajes de estado via `console.log` para auditoría visible.
- Backend: rutas presentes y validadas con Zod; lectura `GET` permitida si `ALLOW_READ_WITHOUT_AUTH=true`.

## Regresión Básica
- Cambios no afectan otros módulos; las notificaciones siguen operativas.

## Estado del Módulo
- Estado del módulo: CON PENDIENTES (se requiere sesión autenticada para validar apertura/cierre end-to-end).
- Pendiente operativo: ejecutar flujo completo con JWT y evidenciar impacto en Reportes/Dashboard.

