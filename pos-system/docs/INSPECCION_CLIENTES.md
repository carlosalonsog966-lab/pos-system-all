# Inspección Módulo: Clientes

## Localización del Módulo
- Ruta: `/clients`
- Frontend: `frontend/src/pages/Clients/ClientsPage.tsx`
- Backend: `backend/src/routes/clients.ts`, `backend/src/controllers/clientController.ts`
- Esquemas: `backend/src/schemas/client.ts`

## Comportamiento Esperado
- Alta/edición/baja de clientes.
- Consulta, búsqueda por código y estadísticas por cliente.
- Asociación a ventas y reportes por cliente.

## Inspección de Flujo de Datos
- UI → `GET /api/clients` → `ClientController.getClients` → BD → Respuesta → Render.
- Creación: `POST /api/clients` (requiere JWT) → validación Zod → persistencia.
- Reportes: `GET /api/reports/customers` (ranking clientes, `reportService.ts:842-879`).

## Pruebas Concretas
- Endpoints presentes en `clients.ts:23-33` (lecturas y mutaciones).
- Reporte de clientes: `generateCustomersReport` agrega métricas y ventas en período.

## Correcciones Aplicadas
- Sin cambios necesarios en backend; frontend compila tras remoción de atributos inválidos en toasts.

## Regresión Básica
- Impacto en Dashboard: top clientes alimenta KPIs (`reportService.ts:551-590`).

## Estado del Módulo
- Estado del módulo: OK (lecturas); CON PENDIENTES (mutaciones requieren JWT para entorno de prueba).

