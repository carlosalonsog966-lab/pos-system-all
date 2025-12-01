# Vitest - Última corrida CI

- Fecha: 2025-11-12
- Comando: `vitest --run --reporter=verbose --pool=forks --coverage=false --bail=1`
- Node options: `--max-old-space-size=4096`

## Resultados
- Archivos de prueba: 23
- Pasaron: 7
- Fallaron: 2
- Omitidos: 13
- Errores no controlados: 1
- Duración: ~10.66s

## Suites fallidas
- `e2e/smoke.spec.ts`: conflicto de `@playwright/test` importado en entorno Vitest
- `src/components/Common/__tests__/HealthStatus.test.tsx`: error de transformación de esbuild

## Errores no controlados
- Serialización de `AxiosError` en workers: circuito abierto cuando backend está caído

## Observaciones
- OOM resuelto con `NODE_OPTIONS` y configuración de Vitest (pool threads, singleThread, jsdom, globals).
- Varias suites integracionales se omitieron por `--bail=1` tras el primer fallo de la corrida.

