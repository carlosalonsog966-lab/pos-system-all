import { api, normalizeSinglePayload } from '@/lib/api';
import { SaleResultSchema, type SaleResultParsed } from './schemas';
import { useOfflineStore } from '@/store/offlineStore';

export class SalesService {
  static async tourismCheckout(data: any, idempotencyKey?: string) {
    const headers: Record<string, string> = {};
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    
    try {
      const res = await api.post('/sales/tourism/checkout', data, { headers } as any);
      const single = normalizeSinglePayload(res.data);
      return SaleResultSchema.parse(single) as SaleResultParsed;
    } catch (error: any) {
      console.error('Error en tourismCheckout:', error);
      
      // Fallback mejorado: intentar múltiples estrategias
      const fallbackStrategies = [
        // Estrategia 1: Intentar endpoint genérico
        async () => {
          const res = await api.post('/sales', data, { headers } as any);
          const single = normalizeSinglePayload(res.data);
          return SaleResultSchema.parse(single) as SaleResultParsed;
        },
        // Estrategia 2: Guardar en modo offline
        async () => {
          console.warn('Ventas offline: guardando venta para sincronización posterior');
          const offlineStore = useOfflineStore.getState();
          
          // Crear acción offline
          offlineStore.addPendingAction({
            type: 'CREATE_SALE',
            data: {
              ...data,
              idempotencyKey: idempotencyKey || `OFFLINE-${Date.now()}-${Math.random().toString(36).slice(2)}`
            },
            priority: 'high',
            maxRetries: 5
          });
          
          // Retornar respuesta simulada para mantener la UI funcional
          return {
            id: `OFFLINE-${Date.now()}`,
            saleNumber: `OFFLINE-${Date.now()}`,
            total: data.total || 0,
            subtotal: data.subtotal || 0,
            taxAmount: data.taxAmount || 0,
            status: 'completed',
            createdAt: new Date().toISOString(),
            items: data.items || [],
            client: data.client || null,
            user: data.user || null,
            offline: true // Marcar como venta offline
          } as SaleResultParsed;
        }
      ];

      // Intentar cada estrategia de fallback
      for (const strategy of fallbackStrategies) {
        try {
          return await strategy();
        } catch (strategyError) {
          console.warn('Estrategia de fallback fallida, intentando siguiente...', strategyError);
          continue;
        }
      }
      
      // Si todas las estrategias fallan, lanzar error original
      throw error;
    }
  }

  static async createSale(data: any, idempotencyKey?: string) {
    const headers: Record<string, string> = {};
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    try {
      const res = await api.post('/sales', data, { headers } as any);
      const single = normalizeSinglePayload(res.data);
      return SaleResultSchema.parse(single) as SaleResultParsed;
    } catch (error: any) {
      console.error('Error en createSale:', error);
      // Fallback: guardar offline
      const offlineStore = useOfflineStore.getState();
      offlineStore.addPendingAction({
        type: 'CREATE_SALE',
        data: { ...data, idempotencyKey: idempotencyKey || `OFFLINE-${Date.now()}-${Math.random().toString(36).slice(2)}` },
        priority: 'high',
        maxRetries: 5,
      });
      return {
        id: `OFFLINE-${Date.now()}`,
        saleNumber: `OFFLINE-${Date.now()}`,
        total: data.total || 0,
        subtotal: data.subtotal || 0,
        taxAmount: data.taxAmount || 0,
        status: 'completed',
        createdAt: new Date().toISOString(),
        items: data.items || [],
        client: data.client || null,
        user: data.user || null,
        offline: true,
      } as SaleResultParsed;
    }
  }
}
