import { api } from '@/lib/api';

export interface Agency {
  id: string;
  code: string;
  name: string;
  commissionRate: number;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  manager?: string;
  isActive: boolean;
  guides?: Array<{
    id: string;
    code: string;
    name: string;
    commissionFormula: 'DIRECT' | 'DISCOUNT_PERCENTAGE';
    discountPercentage?: number;
    commissionRate: number;
    isActive: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgencyInput {
  code: string;
  name: string;
  commissionRate?: number;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  manager?: string;
}

export interface UpdateAgencyInput extends Partial<CreateAgencyInput> {
  isActive?: boolean;
}

export interface AgencyQueryParams {
  isActive?: boolean;
}

export interface AgencyStats {
  agency: {
    id: string;
    code: string;
    name: string;
    commissionRate: number;
  };
  stats: {
    totalGuides: number;
    totalSales?: number;
    totalRevenue?: number;
    totalCommissions?: number;
  };
}

export class AgencyService {
  static async getAgencies(params?: AgencyQueryParams): Promise<Agency[]> {
    const response = await api.get('/agencies', { params, __suppressGlobalError: true } as any);
    return response.data.data;
  }

  static async getAgencyById(id: string): Promise<Agency> {
    const response = await api.get(`/agencies/${id}`, { __suppressGlobalError: true } as any);
    return response.data.data;
  }

  static async createAgency(data: CreateAgencyInput): Promise<Agency> {
    const response = await api.post('/agencies', data);
    return response.data.data;
  }

  static async updateAgency(id: string, data: UpdateAgencyInput): Promise<Agency> {
    const response = await api.put(`/agencies/${id}`, data);
    return response.data.data;
  }

  static async deleteAgency(id: string): Promise<void> {
    await api.delete(`/agencies/${id}`);
  }

  static async getAgencyStats(id: string, startDate?: string, endDate?: string): Promise<AgencyStats> {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    
    const response = await api.get(`/agencies/${id}/stats`, { params, __suppressGlobalError: true } as any);
    return response.data.data;
  }

  static async getActiveAgencies(): Promise<Agency[]> {
    return this.getAgencies({ isActive: true });
  }
}
