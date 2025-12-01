import { useEntitySync } from './useEntitySync';

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface Sale {
  id: string;
  saleNumber: string;
  clientId?: string;
  clientName?: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'credit';
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  notes?: string;
  cashierId: string;
  cashierName: string;
  createdAt: string;
  updatedAt: string;
}

export const useSaleSync = () => {
  return useEntitySync<Sale>({
    entityName: 'sale',
    endpoint: '/sales',
    idField: 'id',
    timestampField: 'createdAt', // Las ventas normalmente no se actualizan, solo se crean
    priority: 'high', // Las ventas tienen alta prioridad
    maxRetries: 5, // Más reintentos para ventas
    batchSize: 10,
    conflictResolution: 'server', // Para ventas, el servidor tiene la verdad
  });
};

export const useSaleOperations = () => {
  const sync = useSaleSync();

  const createSale = async (saleData: Omit<Sale, 'id' | 'saleNumber' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const saleNumber = `SALE-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    const sale = {
      ...saleData,
      saleNumber,
      createdAt: now,
      updatedAt: now,
    };
    
    return await sync.queueCreate(sale);
  };

  const updateSaleStatus = async (id: string, status: Sale['status'], notes?: string) => {
    // En una implementación real, necesitarías la venta actual
    console.log(`Updating sale ${id} status to ${status}`, notes);
    // const updatedSale = { 
    //   ...currentSale, 
    //   status, 
    //   notes: notes || currentSale.notes,
    //   updatedAt: new Date().toISOString() 
    // };
    // await sync.queueUpdate(updatedSale);
  };

  const refundSale = async (id: string, reason?: string) => {
    await updateSaleStatus(id, 'refunded', reason);
  };

  const cancelSale = async (id: string, reason?: string) => {
    await updateSaleStatus(id, 'cancelled', reason);
  };

  const completeSale = async (id: string) => {
    await updateSaleStatus(id, 'completed');
  };

  // Función para crear una venta rápida (solo efectivo, sin cliente)
  const createQuickSale = async (items: SaleItem[], paymentMethod: Sale['paymentMethod'] = 'cash') => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * 0.16; // 16% IVA
    const total = subtotal + tax;

    return await createSale({
      items,
      subtotal,
      tax,
      discount: 0,
      total,
      paymentMethod,
      status: 'completed',
      cashierId: 'current-user-id', // En una implementación real, obtener del store de auth
      cashierName: 'Current User', // En una implementación real, obtener del store de auth
    });
  };

  // Función para crear una venta con cliente
  const createClientSale = async (
    clientId: string,
    clientName: string,
    items: SaleItem[],
    paymentMethod: Sale['paymentMethod'],
    discount: number = 0
  ) => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const discountAmount = subtotal * (discount / 100);
    const taxableAmount = subtotal - discountAmount;
    const tax = taxableAmount * 0.16;
    const total = taxableAmount + tax;

    return await createSale({
      clientId,
      clientName,
      items,
      subtotal,
      tax,
      discount: discountAmount,
      total,
      paymentMethod,
      status: paymentMethod === 'credit' ? 'pending' : 'completed',
      cashierId: 'current-user-id',
      cashierName: 'Current User',
    });
  };

  return {
    ...sync,
    createSale,
    updateSaleStatus,
    refundSale,
    cancelSale,
    completeSale,
    createQuickSale,
    createClientSale,
  };
};