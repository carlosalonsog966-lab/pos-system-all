import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../../.env') });

import app, { initializeDatabase } from './app';
import { JobQueueService } from './services/jobQueueService';
import { IdempotencyService } from './services/idempotencyService';
import { BackupService } from './services/backupService';
import { OfflineBackupService } from './services/OfflineBackupService';
import { logger } from './middleware/logger';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { sequelize } from './db/config';
import { initOTel } from './observability/otel';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validateConfig } = require('./utils/configValidator');

// Puerto del backend: preferir BACKEND_PORT (para no colisionar con PORT del sistema)
// Alineado con VITE_API_URL y proxy del frontend
const RAW_PORT = process.env.BACKEND_PORT || process.env.PORT;
const PORT = Number(RAW_PORT || 5656);
const HOST = process.env.HOST || '0.0.0.0';
const ENABLE_HTTPS = (process.env.HTTPS === '1' || process.env.HTTPS === 'true');
const PFX_PATH = process.env.HTTPS_PFX_PATH || '';
const PFX_PASS = process.env.HTTPS_PFX_PASS || '';
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || '';
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || '';

async function startServer() {
  try {
    // Inicializar OpenTelemetry opcional
    let otelSdk: any = null;
    try {
      otelSdk = await initOTel();
    } catch (e) {
      logger.warn('No se pudo inicializar OpenTelemetry', e as any);
    }
    // Inicializar base de datos
    await initializeDatabase();
    // Validación de configuración antes de iniciar el servidor
    try {
      const storagePath = (sequelize as any)?.options?.storage as string | undefined;
      const cfg = validateConfig(storagePath);
      if (cfg.errors && cfg.errors.length > 0) {
        logger.error('Config errors', cfg.errors);
        // Fail-fast: no iniciar el servidor si hay errores de configuración
        throw new Error(`Configuración inválida: ${cfg.errors.map((e: any) => `${e.key}:${e.message}`).join('; ')}`);
      }
      if (cfg.warnings && cfg.warnings.length > 0) {
        logger.warn('Config warnings', cfg.warnings);
      }
    } catch (e) {
      // Si la validación lanza error, abortar arranque
      logger.error('Fallo validando configuración en arranque', e as any);
      throw e;
    }

    // Inicializar servicio de idempotencia (crea tabla si no existe y programa limpieza)
    try {
      await IdempotencyService.initialize();
      logger.info('IdempotencyService inicializado');
    } catch (e) {
      logger.warn('No se pudo inicializar IdempotencyService', e as any);
    }

    // Inicializar servicios de respaldos (opcional por .env)
    try {
      const enableBackups = (process.env.ENABLE_BACKUPS === 'true' || process.env.ENABLE_BACKUPS === '1');
      if (enableBackups) {
        await BackupService.initialize();
        logger.info('BackupService inicializado');
        const offline = OfflineBackupService.getInstance();
        await offline.initialize();
        logger.info('OfflineBackupService inicializado');
      } else {
        logger.info('Respaldos deshabilitados por configuración (.env ENABLE_BACKUPS)');
      }
    } catch (e) {
      logger.warn('No se pudieron inicializar servicios de respaldo', e as any);
    }
    
    // Iniciar servidor
    // Depuración: traza previa al bind
    // eslint-disable-next-line no-console
    console.log('[server.ts] About to bind server', { HOST, PORT, ENABLE_HTTPS });
    let server: http.Server | https.Server;

    if (ENABLE_HTTPS) {
      try {
        let options: https.ServerOptions | undefined;
        if (PFX_PATH && fs.existsSync(PFX_PATH)) {
          options = { pfx: fs.readFileSync(PFX_PATH), passphrase: PFX_PASS };
        } else if (SSL_KEY_PATH && SSL_CERT_PATH && fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH)) {
          options = { key: fs.readFileSync(SSL_KEY_PATH), cert: fs.readFileSync(SSL_CERT_PATH) };
        }

        if (options) {
          server = https.createServer(options, app).listen(PORT, HOST, () => {
            logger.info(`Servidor HTTPS iniciado en https://${HOST}:${PORT}`);
          });
        } else {
          logger.warn('HTTPS habilitado pero no se encontró PFX o KEY/CERT válidos. Usando HTTP.');
          server = app.listen(PORT, HOST, () => {
            logger.info(`Servidor HTTP iniciado en http://${HOST}:${PORT}`);
          });
        }
      } catch (err) {
        logger.error('Error inicializando HTTPS, cayendo a HTTP:', err);
        server = app.listen(PORT, HOST, () => {
          logger.info(`Servidor HTTP iniciado en http://${HOST}:${PORT}`);
        });
      }
    } else {
      server = app.listen(PORT, HOST, () => {
        // eslint-disable-next-line no-console
        console.log('[server.ts] app.listen callback fired');
        try {
          const addr = server.address();
          // eslint-disable-next-line no-console
          console.log('[server.ts] server.address()', addr);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log('[server.ts] server.address() failed', e);
        }
        logger.info(`Servidor HTTP iniciado en http://${HOST}:${PORT}`);
      });
    }

    // Iniciar JobQueue worker
    const jobQueueEnabled = process.env.JOB_QUEUE_ENABLED !== 'false';
    if (jobQueueEnabled) {
      try {
        await JobQueueService.start();
        logger.info('JobQueue worker iniciado');
      } catch (e) {
        logger.warn('No se pudo iniciar JobQueue worker', e as any);
      }
    } else {
      logger.info('JobQueue worker deshabilitado por configuración');
    }

    // Programación diaria: escaneo de integridad y limpieza de exportaciones
    try {
      const scheduleDaily = (hour: number, minute: number, task: () => void) => {
        const now = new Date();
        const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
        if (next.getTime() <= now.getTime()) {
          next.setDate(next.getDate() + 1);
        }
        const initialDelay = next.getTime() - now.getTime();
        setTimeout(() => {
          try { task(); } catch (err) { logger.error('[Scheduler] Error ejecutando tarea diaria', err as any); }
          setInterval(() => {
            try { task(); } catch (err) { logger.error('[Scheduler] Error ejecutando tarea diaria', err as any); }
          }, 24 * 60 * 60 * 1000);
        }, initialDelay);
      };

      const integrityHour = Number(process.env.INTEGRITY_SCAN_SCHEDULE_HOUR || 2);
      const integrityMinute = Number(process.env.INTEGRITY_SCAN_SCHEDULE_MINUTE || 15);
      scheduleDaily(integrityHour, integrityMinute, async () => {
        logger.info('[Scheduler] Encolando files.integrity.scan.daily');
        await JobQueueService.enqueue('files.integrity.scan.daily', { limit: Number(process.env.INTEGRITY_SCAN_LIMIT || 1000) });
      });

      const cleanupHour = Number(process.env.EXPORTS_CLEANUP_SCHEDULE_HOUR || 3);
      const cleanupMinute = Number(process.env.EXPORTS_CLEANUP_SCHEDULE_MINUTE || 0);
      const cleanupDays = Number(process.env.EXPORTS_CLEANUP_DAYS || 14);
      scheduleDaily(cleanupHour, cleanupMinute, async () => {
        logger.info('[Scheduler] Encolando cleanup.exports');
        await JobQueueService.enqueue('cleanup.exports', { days: cleanupDays });
        logger.info('[Scheduler] Encolando cleanup.charts');
        await JobQueueService.enqueue('cleanup.charts', { days: Number(process.env.CHARTS_CLEANUP_DAYS || cleanupDays) });
      });

      logger.info(`[Scheduler] Integridad diaria programada a ${integrityHour.toString().padStart(2,'0')}:${integrityMinute.toString().padStart(2,'0')} y limpieza a ${cleanupHour.toString().padStart(2,'0')}:${cleanupMinute.toString().padStart(2,'0')} (exports y charts)`);
    } catch (e) {
      logger.warn('No se pudo configurar el scheduler diario', e as any);
    }

    // Info adicional del entorno después de iniciar el servidor
    logger.info(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Base de datos: ${process.env.DB_DIALECT || 'sqlite'}`);

    // Manejo de cierre graceful
    const gracefulShutdown = (signal: string) => {
      logger.info(`Recibida señal ${signal}, cerrando servidor...`);
      
      server.close(() => {
        logger.info('Servidor cerrado exitosamente');
        process.exit(0);
      });

      // Forzar cierre después de 10 segundos
      setTimeout(() => {
        logger.error('Forzando cierre del servidor');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Cierre del SDK de OTEL si está activo
    const shutdownOtel = async () => {
      try {
        if (otelSdk && typeof otelSdk.shutdown === 'function') {
          await otelSdk.shutdown();
          // eslint-disable-next-line no-console
          console.log('[OTel] NodeSDK shutdown');
        }
      } catch (e) {
        logger.warn('Error cerrando OpenTelemetry SDK', e as any);
      }
    };
    process.on('beforeExit', shutdownOtel);
    process.on('exit', shutdownOtel);

  } catch (error) {
    logger.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Capturar warnings del proceso para diagnóstico (no termina el proceso)
process.on('warning', (warning) => {
  try {
    logger.warn('Process Warning:', {
      name: (warning as any)?.name,
      message: (warning as any)?.message,
      stack: (warning as any)?.stack,
    } as any);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[process warning]', warning);
  }
});

startServer();
