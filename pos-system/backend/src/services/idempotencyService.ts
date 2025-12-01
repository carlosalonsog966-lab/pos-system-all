import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../db/config';

export interface IdempotencyRecord {
  id: string;
  key: string;
  operation: string;
  userId: string;
  requestHash: string;
  response: any;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  expiresAt: Date;
}

export interface IdempotencyConfig {
  ttlMinutes?: number;
  maxRetries?: number;
  cleanupIntervalMinutes?: number;
}

export class IdempotencyService {
  private static readonly DEFAULT_CONFIG: Required<IdempotencyConfig> = {
    ttlMinutes: 60, // 1 hora por defecto
    maxRetries: 3,
    cleanupIntervalMinutes: 30,
  };

  private static cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Inicializa el servicio de idempotencia
   */
  static async initialize(config: IdempotencyConfig = {}): Promise<void> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    // Crear tabla de idempotencia si no existe
    await this.createIdempotencyTable();
    
    // Iniciar limpieza automática
    this.startCleanupInterval(finalConfig.cleanupIntervalMinutes);
    
    console.log('IdempotencyService initialized');
  }

  /**
   * Verifica si una operación ya fue ejecutada
   */
  static async checkIdempotency(
    key: string,
    operation: string,
    userId: string,
    requestData: any
  ): Promise<{
    exists: boolean;
    record?: IdempotencyRecord;
    shouldRetry: boolean;
  }> {
    const requestHash = this.generateHash(requestData);
    
    const records = await sequelize.query(`
      SELECT * FROM idempotency_records 
      WHERE key = :key AND operation = :operation AND userId = :userId
      ORDER BY createdAt DESC
      LIMIT 1
    `, {
      replacements: { key, operation, userId },
      type: QueryTypes.SELECT,
    }) as IdempotencyRecord[];
    
    const record = records[0];

    if (!record) {
      return { exists: false, shouldRetry: false };
    }

    // Verificar si el registro ha expirado
    if (new Date() > new Date(record.expiresAt)) {
      await this.deleteRecord(record.id);
      return { exists: false, shouldRetry: false };
    }

    // Verificar si el hash de la request coincide
    if (record.requestHash !== requestHash) {
      throw new Error('Idempotency key conflict: same key with different request data');
    }

    return {
      exists: true,
      record,
      shouldRetry: record.status === 'pending',
    };
  }

  /**
   * Crea un nuevo registro de idempotencia
   */
  static async createRecord(
    key: string,
    operation: string,
    userId: string,
    requestData: any,
    ttlMinutes?: number
  ): Promise<string> {
    const id = this.generateId();
    const requestHash = this.generateHash(requestData);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + (ttlMinutes || this.DEFAULT_CONFIG.ttlMinutes));

    await sequelize.query(`
      INSERT INTO idempotency_records (id, key, operation, userId, requestHash, status, createdAt, expiresAt)
      VALUES (:id, :key, :operation, :userId, :requestHash, 'pending', :createdAt, :expiresAt)
    `, {
      replacements: {
        id,
        key,
        operation,
        userId,
        requestHash,
        createdAt: new Date(),
        expiresAt,
      },
    });

    return id;
  }

  /**
   * Actualiza un registro de idempotencia con el resultado
   */
  static async updateRecord(
    id: string,
    status: 'completed' | 'failed',
    response?: any
  ): Promise<void> {
    await sequelize.query(`
      UPDATE idempotency_records 
      SET status = :status, response = :response
      WHERE id = :id
    `, {
      replacements: {
        id,
        status,
        response: response ? JSON.stringify(response) : null,
      },
    });
  }

  /**
   * Ejecuta una operación con idempotencia
   */
  static async executeWithIdempotency<T>(
    key: string,
    operation: string,
    userId: string,
    requestData: any,
    operationFn: () => Promise<T>,
    config: IdempotencyConfig = {}
  ): Promise<T> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    // Verificar idempotencia
    const check = await this.checkIdempotency(key, operation, userId, requestData);
    
    if (check.exists && check.record) {
      if (check.record.status === 'completed') {
        // Retornar resultado previo
        if (!check.record.response) {
          throw new Error('No response data found for completed operation');
        }
        return JSON.parse(check.record.response);
      }
      
      if (check.record.status === 'failed') {
        throw new Error('Previous operation failed');
      }
      
      if (check.shouldRetry) {
        // La operación está pendiente, esperar un poco y reintentar
        await this.delay(1000);
        return this.executeWithIdempotency(key, operation, userId, requestData, operationFn, config);
      }
    }

    // Crear nuevo registro
    const recordId = await this.createRecord(key, operation, userId, requestData, finalConfig.ttlMinutes);
    
    try {
      // Ejecutar operación
      const result = await operationFn();
      
      // Marcar como completado
      await this.updateRecord(recordId, 'completed', result);
      
      return result;
    } catch (error) {
      // Marcar como fallido
      await this.updateRecord(recordId, 'failed');
      throw error;
    }
  }

  /**
   * Limpia registros expirados
   */
  static async cleanup(): Promise<number> {
    const [result] = await sequelize.query(`
      DELETE FROM idempotency_records 
      WHERE expiresAt < :now
    `, {
      replacements: { now: new Date() },
    });

    return Array.isArray(result) ? result.length : 0;
  }

  /**
   * Obtiene estadísticas de idempotencia
   */
  static async getStats(): Promise<{
    totalRecords: number;
    pendingRecords: number;
    completedRecords: number;
    failedRecords: number;
    expiredRecords: number;
  }> {
    const [stats] = await sequelize.query(`
      SELECT 
        COUNT(*) as totalRecords,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingRecords,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedRecords,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failedRecords,
        SUM(CASE WHEN expiresAt < datetime('now') THEN 1 ELSE 0 END) as expiredRecords
      FROM idempotency_records
    `, {
      type: QueryTypes.SELECT,
    }) as any[];

    return stats || {
      totalRecords: 0,
      pendingRecords: 0,
      completedRecords: 0,
      failedRecords: 0,
      expiredRecords: 0,
    };
  }

  /**
   * Crea la tabla de idempotencia
   */
  private static async createIdempotencyTable(): Promise<void> {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS idempotency_records (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL,
        operation TEXT NOT NULL,
        userId TEXT NOT NULL,
        requestHash TEXT NOT NULL,
        response TEXT,
        status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
        createdAt DATETIME NOT NULL,
        expiresAt DATETIME NOT NULL
      )
    `);

    // Crear índices
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_idempotency_key_operation_user 
      ON idempotency_records (key, operation, userId)
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_idempotency_expires 
      ON idempotency_records (expiresAt)
    `);
  }

  /**
   * Elimina un registro específico
   */
  private static async deleteRecord(id: string): Promise<void> {
    await sequelize.query(`
      DELETE FROM idempotency_records WHERE id = :id
    `, {
      replacements: { id },
    });
  }

  /**
   * Inicia el intervalo de limpieza automática
   */
  private static startCleanupInterval(intervalMinutes: number): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(async () => {
      try {
        const cleaned = await this.cleanup();
        if (cleaned > 0) {
          console.log(`Cleaned up ${cleaned} expired idempotency records`);
        }
      } catch (error) {
        console.error('Error during idempotency cleanup:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Detiene el servicio de idempotencia
   */
  static stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Genera un ID único
   */
  private static generateId(): string {
    return `idem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Genera un hash de los datos de la request
   */
  private static generateHash(data: any): string {
    const crypto = require('crypto');
    const str = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /**
   * Función de delay
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}