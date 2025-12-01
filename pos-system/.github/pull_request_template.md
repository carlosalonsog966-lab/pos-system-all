## Resumen

- Tipo de cambio: (feature / fix / chore / docs)
- Bloques afectados: (0 Gobernanza, 1 Monorepo, 2 CI/CD, 3 Backend, 4 Frontend, 5 Tauri, 6 QA, 7 Seguridad, 8 Observabilidad, 9 Docs, 10 Distribución)
- Descripción breve:

## Checklist de Integración

- [ ] Rama base correcta (`release/*` o `develop` según corresponda)
- [ ] CI verde: lint, build, test, smoke, security scan
- [ ] Artefactos generados y adjuntos (cuando aplique)
- [ ] Compatibilidad forward/backward (expand → migrate → switch → clean)
- [ ] Feature flags habilitados para rutas/flows nuevos (si aplica)
- [ ] Observabilidad mínima: health + métricas validadas
- [ ] Documentación actualizada (README, contratos en `exports/endpoints.*`)

## Validación

- Evidencia: enlaces a `playwright-report/index.html`, `test-results/.last-run.json`, capturas, logs
- Estado readiness: último score y tendencia en `exports/status/trend.html`

## Revisores

- CODEOWNERS auto-asignados + personas clave del bloque

## Notas

- Riesgos y mitigaciones
- Plan de rollout y, si aplica, rollback

