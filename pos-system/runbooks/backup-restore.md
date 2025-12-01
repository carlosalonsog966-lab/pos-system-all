# Runbook: Backup & Restore

## Backup
- Programar copias en `BACKUP_DIR` con hashes y timestamp.
- Incluir: dump de DB, `exports/status/*`, configuraciones críticas.
- Verificar integridad y rotación (retención configurable).

## Restore
- Validar versión y compatibilidad de esquemas.
- Proceso: detener tráfico → restaurar dump → ejecutar migraciones necesarias → smoke/health.
- Canary: liberar gradualmente y monitorear métricas.

## Pruebas
- Simular restore en entorno de staging semanalmente.
- Registrar resultados y tiempos.

