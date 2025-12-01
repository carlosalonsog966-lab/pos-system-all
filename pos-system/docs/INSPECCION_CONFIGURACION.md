# Inspección Módulo: Configuración

## Localización del Módulo
- Ruta: `/settings`
- Frontend: `frontend/src/pages/Settings/SettingsPage.tsx`
- Backend: `backend/src/routes/settings.ts`, `backend/src/controllers/settingsController.ts`

## Comportamiento Esperado
- Lectura y actualización de parámetros globales: empresa, POS, notificaciones, seguridad, respaldo, tema, avanzadas.
- Endpoints públicos: `/settings/public`, `/settings/system-info` (sin JWT).
- Importación/exportación de settings y prueba de impresora.

## Inspección de Flujo de Datos
- UI → `GET /api/settings` y `PUT /api/settings` → Controller → BD → Respuesta.
- System Info rate-limited con EventLogService.

## Pruebas Concretas
- Rutas públicas funcionales; rutas protegidas requieren JWT.

## Correcciones Aplicadas
- Sin cambios requeridos.

## Regresión Básica
- Impacto sobre Ventas (IVA, moneda) y Reportes.

## Estado del Módulo
- Estado del módulo: OK (lecturas públicas y privadas). PENDIENTE: pruebas de actualización con JWT.

