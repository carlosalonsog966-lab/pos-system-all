# Inspección Módulo: Usuarios

## Localización del Módulo
- Ruta: `/users`
- Frontend: `frontend/src/pages/Users/UsersPage.tsx`
- Backend: `backend/src/routes/users.ts`, `backend/src/controllers/userController.ts`
- Esquemas: `backend/src/schemas/user.ts`

## Comportamiento Esperado
- Listado con filtros y paginación (roles manager/admin).
- Alta, edición, activación/desactivación, reseteo de contraseña (admin).
- Subida de avatar con validación de tipo/tamaño.
- Borrado (soft delete) y operaciones masivas.

## Inspección de Flujo de Datos
- UI → `GET /api/users` → validación → controller → BD → Respuesta.
- Mutaciones protegidas por `requireAdmin` y `authenticateToken`. Lecturas sin JWT opcionales si `ALLOW_READ_WITHOUT_AUTH=true` no aplica (por política).

## Pruebas Concretas
- Endpoints verificados en `users.ts:18-69`.
- Script de creación admin `backend/src/scripts/create_admin.ts` asegura credenciales de administración (`admin/admin123`).

## Correcciones Aplicadas
- Sin cambios requeridos.

## Regresión Básica
- Verificado que roles y RBAC están aplicados.

## Estado del Módulo
- Estado del módulo: OK (con RBAC). PENDIENTE de pruebas de mutación con JWT activo.

