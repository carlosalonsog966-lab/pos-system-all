import { Transaction, TransactionOptions } from 'sequelize';
import { sequelize } from '../db/config';

export interface TransactionConfig extends TransactionOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeoutMs?: number;
  logQueries?: boolean;
}

export interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  retries: number;
  duration: number;
}

export class TransactionService {
  private static readonly DEFAULT_CONFIG: TransactionConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    timeoutMs: 30000,
    logQueries: false,
    isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    type: Transaction.TYPES.DEFERRED,
  };

  /**
   * Ejecuta una operación dentro de una transacción con retry automático
   */
  static async executeWithRetry<T>(
    operation: (transaction: Transaction) => Promise<T>,
    config: TransactionConfig = {}
  ): Promise<TransactionResult<T>> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const startTime = Date.now();
    let lastError: Error | null = null;
    let retries = 0;

    for (let attempt = 0; attempt <= (finalConfig.maxRetries || 0); attempt++) {
      const transaction = await sequelize.transaction({
        isolationLevel: finalConfig.isolationLevel,
        type: finalConfig.type,
        logging: finalConfig.logQueries ? console.log : false,
      });

      let isFinished = false;
      
      try {
        
        // Configurar timeout si se especifica
        if ((finalConfig.timeoutMs || 0) > 0) {
          setTimeout(() => {
            if (!isFinished) {
              transaction.rollback().catch(() => {});
            }
          }, finalConfig.timeoutMs || 0);
        }

        const result = await operation(transaction);
        await transaction.commit();
        isFinished = true;

        return {
          success: true,
          data: result,
          retries: attempt,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        isFinished = true;
        await transaction.rollback().catch(() => {});
        lastError = error instanceof Error ? error : new Error(String(error));
        retries = attempt;

        // Si es el último intento, no hacer retry
        if (attempt === finalConfig.maxRetries) {
          break;
        }

        // Verificar si el error es recuperable
        if (!this.isRetryableError(lastError)) {
          break;
        }

        // Esperar antes del siguiente intento
        if ((finalConfig.retryDelay || 0) > 0) {
          await this.delay((finalConfig.retryDelay || 0) * (attempt + 1));
        }
      }
    }

    return {
      success: false,
      error: lastError || new Error('Unknown transaction error'),
      retries,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Ejecuta múltiples operaciones en una sola transacción
   */
  static async executeBatch<T>(
    operations: Array<(transaction: Transaction) => Promise<T>>,
    config: TransactionConfig = {}
  ): Promise<TransactionResult<T[]>> {
    return this.executeWithRetry(async (transaction) => {
      const results: T[] = [];
      for (const operation of operations) {
        const result = await operation(transaction);
        results.push(result);
      }
      return results;
    }, config);
  }

  /**
   * Ejecuta una operación con savepoint para rollback parcial
   */
  static async executeWithSavepoint<T>(
    operation: (transaction: Transaction) => Promise<T>,
    savepointName: string = `sp_${Date.now()}`,
    config: TransactionConfig = {}
  ): Promise<TransactionResult<T>> {
    return this.executeWithRetry(async (transaction) => {
      await sequelize.query(`SAVEPOINT ${savepointName}`, { transaction });
      
      try {
        const result = await operation(transaction);
        await sequelize.query(`RELEASE SAVEPOINT ${savepointName}`, { transaction });
        return result;
      } catch (error) {
        await sequelize.query(`ROLLBACK TO SAVEPOINT ${savepointName}`, { transaction });
        throw error;
      }
    }, config);
  }

  /**
   * Verifica si un error es recuperable y vale la pena reintentar
   */
  private static isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'SQLITE_BUSY',
      'SQLITE_LOCKED',
      'database is locked',
      'connection timeout',
      'ECONNRESET',
      'ETIMEDOUT',
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError.toLowerCase())
    );
  }

  /**
   * Función de delay para retry
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtiene estadísticas de transacciones activas
   */
  static async getTransactionStats(): Promise<{
    activeTransactions: number;
    connectionPoolSize: number;
    idleConnections: number;
  }> {
    try {
      // Nota: Las estadísticas del pool no están disponibles directamente
      // en la API pública de Sequelize
      return {
        activeTransactions: 0,
        connectionPoolSize: 0,
        idleConnections: 0,
      };
    } catch (error) {
      return {
        activeTransactions: 0,
        connectionPoolSize: 0,
        idleConnections: 0,
      };
    }
  }

  /**
   * Limpia conexiones inactivas del pool
   */
  static async cleanupConnections(): Promise<void> {
    try {
      // Usar la API pública de Sequelize para cerrar conexiones
      await sequelize.close();
    } catch (error) {
      console.error('Error cleaning up connections:', error);
    }
  }

  /**
   * Verifica la salud de la conexión a la base de datos
   */
  static async healthCheck(): Promise<{
    healthy: boolean;
    latency: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      await sequelize.authenticate();
      return {
        healthy: true,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}