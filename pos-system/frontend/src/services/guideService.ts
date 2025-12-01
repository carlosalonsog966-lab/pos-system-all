import { api } from '@/lib/api';

export interface Guide {
  id: string;
  code: string;
  name: string;
  agencyId: string;
  commissionFormula: 'DIRECT' | 'DISCOUNT_PERCENTAGE';
  discountPercentage?: number;
  commissionRate: number;
  phone?: string;
  email?: string;
  isActive: boolean;
  agency?: {
    id: string;
    code: string;
    name: string;
    commissionRate: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateGuideInput {
  code: string;
  name: string;
  agencyId: string;
  commissionFormula?: 'DIRECT' | 'DISCOUNT_PERCENTAGE';
  discountPercentage?: number;
  commissionRate?: number;
  phone?: string;
  email?: string;
}

export interface UpdateGuideInput extends Partial<CreateGuideInput> {
  isActive?: boolean;
}

export interface GuideQueryParams {
  isActive?: boolean;
  agencyId?: string;
}

export interface GuideStats {
  guide: {
    id: string;
    code: string;
    name: string;
    agency: {
      id: string;
      code: string;
      name: string;
    };
  };
  stats: {
    totalPeople: number;
    totalSales: number;
    totalSalesCount: number;
    averageClosingPercentage: number;
    averageTicket: number;
  };
  reports: Array<{
    id: string;
    date: string;
    totalPeople: number;
    totalSales: number;
    totalSalesCount: number;
    closingPercentage?: number;
    averageTicket?: number;
    notes?: string;
  }>;
}

export class GuideService {
  static async getGuides(params?: GuideQueryParams): Promise<Guide[]> {
    const response = await api.get('/guides', { params, __suppressGlobalError: true } as any);
    return response.data.data;
  }

  static async getGuideById(id: string): Promise<Guide> {
    const response = await api.get(`/guides/${id}`, { __suppressGlobalError: true } as any);
    return response.data.data;
  }

  static async createGuide(data: CreateGuideInput): Promise<Guide> {
    const response = await api.post('/guides', data);
    return response.data.data;
  }

  static async updateGuide(id: string, data: UpdateGuideInput): Promise<Guide> {
    const response = await api.put(`/guides/${id}`, data);
    return response.data.data;
  }

  static async deleteGuide(id: string): Promise<void> {
    await api.delete(`/guides/${id}`);
  }

  static async getGuideStats(id: string, startDate?: string, endDate?: string): Promise<GuideStats> {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    
    const response = await api.get(`/guides/${id}/stats`, { params, __suppressGlobalError: true } as any);
    return response.data.data;
  }

  static async getGuidesByAgency(agencyId: string): Promise<Guide[]> {
    return this.getGuides({ agencyId, isActive: true });
  }

  static async getActiveGuides(): Promise<Guide[]> {
    return this.getGuides({ isActive: true });
  }
}
