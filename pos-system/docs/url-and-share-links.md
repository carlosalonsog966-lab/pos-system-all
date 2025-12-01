# Sincronización de Filtros y URL y Enlaces Compartibles

## Objetivo
- Unificar la lectura y escritura de parámetros de URL para filtros del Dashboard y secciones relacionadas (p. ej., Ventas Recientes).
- Permitir la generación de enlaces compartibles consistentes que preserven parámetros existentes y apliquen sobrescrituras específicas.
- Centralizar la copia al portapapeles y el feedback de usuario (notificaciones).

## Utilidades principales

### `frontend/src/utils/url.ts`
- `buildUrlWithParams(pathname: string, search: string, overrides: Record<string, string | number | boolean | null | undefined>): string`
  - Construye una URL combinando el `pathname`, los parámetros actuales (`search`) y las sobrescrituras indicadas.
  - Elimina claves con `null`/`undefined` y preserva las existentes si no se sobrescriben.
- `mergeSearchParams(search: string, overrides: Record<string, string | number | boolean | null | undefined>): string`
  - Devuelve solo la cadena de búsqueda (`?…`), fusionando parámetros existentes y sobrescrituras.

### `frontend/src/utils/queryParams.ts`
- `parseBooleanParam(value: string | null): boolean | undefined`
  - Normaliza valores booleanos de la URL (`'true'`, `'false'`).
- `parsePeriodParam(value: string | null): string | undefined`
  - Valida el período permitido (p. ej., `today`, `week`, `month`, `year`).
- `readDashboardFiltersFromSearch(search: string)`
  - Extrae `period`, `comparison` y `showAmounts` como filtros del Dashboard.
- `readRecentSalesFiltersFromSearch(search: string)`
  - Extrae filtros de Ventas Recientes (`recentQuery`, `recentRef`).

### `frontend/src/utils/clipboard.ts`
- `copyUrlWithParams({ pathname, search, overrides, addNotification })`
  - Construye la URL con `buildUrlWithParams`, copia al portapapeles y usa `addNotification` para notificar éxito o error.

## Integración en Dashboard

- Archivo: `frontend/src/pages/Dashboard/DashboardPage.tsx`
  - Lectura de filtros desde la URL:
    - Se usan `readDashboardFiltersFromSearch` y `readRecentSalesFiltersFromSearch` en efectos ligados a `location.search`.
  - Escritura de filtros a la URL:
    - Se usa `mergeSearchParams` para actualizar la cadena de búsqueda al navegar (`navigate({ search })`).
  - Copia de enlace:
    - Los botones de "Copiar enlace" (principal del Dashboard, Ventas Recientes y modal de filtros) llaman a `copyUrlWithParams` con sobrescrituras de parámetros según el contexto.

## Beneficios
- Consistencia: Un solo lugar para formatear y validar parámetros.
- Mantenibilidad: Menos duplicación en componentes.
- Extensibilidad: Fácil de aplicar en nuevas páginas (Reportes, Ventas, etc.).

## Artefactos y enlaces del status-dashboard (CI)
- Artefacto publicado: `status-dashboard` en `Actions → Runs → Artifacts`.
- Contiene `index.html` con accesos directos a:
  - `endpoints.html` (listado filtrable por método), `endpoints.yaml`, `endpoints.csv`, `endpoints.jsonl`.
  - `contracts.html` (reporte de verificación de contratos), si fue generado en la ejecución.
- Recomendación: al compartir el estado, adjuntar el `.zip` del `status-dashboard` o un enlace al run de Actions para trazabilidad.

### Hash en endpoints.html (exports y status)
- Los listados de endpoints soportan sincronización de filtros vía `location.hash`.
- Parámetros soportados:
  - `q`: texto libre para coincidencias en método o ruta.
  - `module`: nombre de módulo (primer segmento del path, p. ej. `api/users`).
  - `method`: HTTP method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).
  - `dir`: dirección de orden de la tabla (`asc` por defecto, `desc` opcional).
- Ejemplos:
  - `endpoints.html#method=GET` filtra por método GET y orden ascendente por ruta.
  - `endpoints.html#q=users&module=api&dir=desc` aplica los tres filtros y orden descendente.
- Los botones “Copiar enlace” copian la URL con el hash actual; las exportaciones “CSV (filtros)” y “JSONL (filtros)” descargan los datos respetando filtros y orden.

## Próximos pasos recomendados
- Extraer un hook reutilizable (`useUrlParamsSync`) que encapsule lectura/escritura de parámetros por página.
- Añadir pruebas unitarias para `buildUrlWithParams` y `mergeSearchParams` con `vitest` o `jest`, si el proyecto de frontend configura un runner de tests.
- Centralizar el sistema de notificaciones para mensajes estándar de acciones compartibles.

## Integración en Observabilidad

- Archivo: `frontend/src/pages/Observability/ObservabilityPage.tsx`
  - Lectura de filtros desde la URL:
    - Eventos: `type`, `severity`, `limit`, `page`, `search`, `from`, `to`, `windowHours`.
    - Latencias: `lat_sort`, `lat_dir`, `lat_method`, `lat_route`, `lat_limit`, `lat_page`.
    - Si no hay parámetros, se intenta cargar desde `localStorage` (`obs_events_filters`, `obs_latency_filters`).
  - Escritura de filtros a la URL:
    - Efectos dedicados actualizan `location.search` con los cambios de filtros y paginación.
  - Persistencia:
    - Eventos y latencias se guardan en `localStorage` en cada cambio.
    - Preferencia `autoRefresh` se persiste en `obs_auto_refresh`.
  - Copia y compartir:
    - Botón “Copiar enlace” copia la URL actual con filtros.
    - “Compartir por email” construye un `mailto:` con resumen; existe un botón de fallback para copiar el contenido.
    - “Copiar estado” exporta un JSON con URL, filtros y preferencias para soporte.

### Parámetros de Observabilidad
- Eventos: `type`, `severity`, `limit`, `page`, `search`, `from`, `to`, `windowHours`.
- Latencias: `lat_sort`, `lat_dir`, `lat_method`, `lat_route`, `lat_limit`, `lat_page`.

### Buenas prácticas
- Al generar enlaces compartibles, preferir incluir los parámetros relevantes para asegurar reproducibilidad sin depender de `localStorage`.
- En flujos de soporte, adjuntar también el JSON de “Copiar estado” para mayor contexto.
