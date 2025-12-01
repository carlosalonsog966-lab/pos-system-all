import { useEntitySync } from './useEntitySync';

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  category: string;
  barcode?: string;
  image?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const useProductSync = () => {
  return useEntitySync<Product>({
    entityName: 'product',
    endpoint: '/products',
    idField: 'id',
    timestampField: 'updatedAt',
    priority: 'high',
    maxRetries: 3,
    batchSize: 20,
    conflictResolution: 'prompt',
  });
};

// Hook específico para operaciones de productos
export const useProductOperations = () => {
  const sync = useProductSync();

  const createProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const product = {
      ...productData,
      createdAt: now,
      updatedAt: now,
    };
    
    return await sync.queueCreate(product);
  };

  const updateProduct = async (product: Product) => {
    const updatedProduct = {
      ...product,
      updatedAt: new Date().toISOString(),
    };
    
    await sync.queueUpdate(updatedProduct);
  };

  const deleteProduct = async (id: string) => {
    await sync.queueDelete(id);
  };

  const updateStock = async (id: string, newStock: number) => {
    // Esta función requeriría obtener el producto actual primero
    // En una implementación real, podrías tener un store local de productos
    console.log(`Updating stock for product ${id} to ${newStock}`);
    // await sync.queueUpdate({ ...currentProduct, stock: newStock, updatedAt: new Date().toISOString() });
  };

  const adjustPrice = async (id: string, newPrice: number) => {
    // Similar a updateStock, requeriría el producto actual
    console.log(`Updating price for product ${id} to ${newPrice}`);
    // await sync.queueUpdate({ ...currentProduct, price: newPrice, updatedAt: new Date().toISOString() });
  };

  return {
    ...sync,
    createProduct,
    updateProduct,
    deleteProduct,
    updateStock,
    adjustPrice,
  };
};