import { useEntitySync } from './useEntitySync';

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  creditLimit?: number;
  currentCredit?: number;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const useClientSync = () => {
  return useEntitySync<Client>({
    entityName: 'client',
    endpoint: '/clients',
    idField: 'id',
    timestampField: 'updatedAt',
    priority: 'medium',
    maxRetries: 3,
    batchSize: 15,
    conflictResolution: 'prompt',
  });
};

export const useClientOperations = () => {
  const sync = useClientSync();

  const createClient = async (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const client = {
      ...clientData,
      currentCredit: clientData.currentCredit || 0,
      createdAt: now,
      updatedAt: now,
    };
    
    return await sync.queueCreate(client);
  };

  const updateClient = async (client: Client) => {
    const updatedClient = {
      ...client,
      updatedAt: new Date().toISOString(),
    };
    
    await sync.queueUpdate(updatedClient);
  };

  const deleteClient = async (id: string) => {
    await sync.queueDelete(id);
  };

  const updateCredit = async (id: string, creditChange: number) => {
    // En una implementación real, necesitarías el cliente actual
    console.log(`Updating credit for client ${id} by ${creditChange}`);
    // const updatedClient = { ...currentClient, currentCredit: currentClient.currentCredit + creditChange };
    // await sync.queueUpdate(updatedClient);
  };

  const updateContactInfo = async (id: string, contactInfo: Partial<Pick<Client, 'email' | 'phone' | 'address'>>) => {
    console.log(`Updating contact info for client ${id}`, contactInfo);
    // const updatedClient = { ...currentClient, ...contactInfo, updatedAt: new Date().toISOString() };
    // await sync.queueUpdate(updatedClient);
  };

  return {
    ...sync,
    createClient,
    updateClient,
    deleteClient,
    updateCredit,
    updateContactInfo,
  };
};