## Objetivos
- Validar que frontend y backend se inician y se comunican correctamente.
- Probar autenticación, rutas protegidas y flujo principal (productos/ventas).
- Confirmar salud del backend, métricas y manejo de errores/offline.

## Preparación
- Revisar `.env` en `pos-system/backend` (puerto `5757`, `JWT_SECRET`, DB).
- Revisar `.env.development` en `pos-system/frontend` (`VITE_API_URL` y proxy si aplica).
- Instalar dependencias en ambos proyectos.

## Pasos de ejecución
1. Backend:
   - Iniciar en `pos-system/backend` con `npm run dev`.
   - Verificar salud en `http://localhost:5757/api/health`.
2. Frontend:
   - Iniciar en `pos-system/frontend` con `npm run dev` (puerto `5177`).
   - Ajustar `VITE_API_URL` si es necesario (`/api` con proxy o `http://localhost:5757/api`).
3. Conexión:
   - Confirmar llamadas desde el cliente (`src/lib/api.ts`) llegan al backend.

## Validaciones funcionales
- Autenticación: probar `LoginPage` y persistencia de token (`authStore`).
- Rutas: navegar a `/dashboard`, `/products`, `/sales`; confirmar guards por rol.
- CRUD básico: listar/crear/editar productos y ventas.
- Offline/sync: simular caída de backend y verificar cola (`offlineStore`).
- Notificaciones: provocar error 401/500 y revisar toasts (`notificationStore`).

## Observabilidad y salud
- Health: revisar latencias y estado en `/api/health`.
- Métricas: validar `prom-client` en `/api/metrics/prom` si expuesto.

## Entregables
- Informe breve de estado: configuración usada, resultados de pruebas y ajustes recomendados.
- Checklist de rutas y módulos verificados.

## Riesgos y ajustes
- Puertos/proxy desalineados: documentar y proponer fix (`VITE_API_URL`/proxy Vite).
- DB: confirmar dialecto y credenciales; usar SQLite si necesario para pruebas.
- JWT y rate limit: advertencias para entornos productivos.