import type express from 'express';

export function setupSentry(app: express.Application) {
  const dsn = process.env.SENTRY_DSN || '';
  if (!dsn) {
    return; // Sentry deshabilitado si no hay DSN
  }

  // Cargar dinámicamente para evitar errores si falta el paquete en algún entorno
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Sentry = require('@sentry/node');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ProfilingIntegration } = require('@sentry/profiling-node');

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    integrations: [new ProfilingIntegration()],
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE || 0),
  });

  app.use(Sentry.Handlers.requestHandler());
  // app.use(Sentry.Handlers.tracingHandler()); // activar si se requiere trazado

  // El error handler de Sentry debe ir antes del manejador global
  app.use(Sentry.Handlers.errorHandler());
}

