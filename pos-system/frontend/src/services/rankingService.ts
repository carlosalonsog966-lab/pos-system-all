import { api } from '@/lib/api';
import { RankingDataSchema, GuideRankingSchema, EmployeeRankingSchema, ProductRankingSchema, AgencyRankingSchema, type RankingDataParsed } from './schemas';

export interface RankingPeriod {
  startDate: string;
  endDate: string;
}

export interface GuideRanking {
  id: string;
  guide: {
    id: string;
    name: string;
    agency?: {
      id: string;
      name: string;
    };
  };
  totalSales: number;
  totalRevenue: number;
  averageTicket: number;
  totalCommission: number;
  totalPeopleRegistered: number;
  closurePercentage: number;
  rank: number;
}

export interface EmployeeRanking {
  id: string;
  employee: {
    id: string;
    name: string;
    branch?: {
      id: string;
      name: string;
    };
  };
  totalSales: number;
  totalRevenue: number;
  averageTicket: number;
  totalCommission: number;
  rank: number;
}

export interface ProductRanking {
  id: string;
  product: {
    id: string;
    name: string;
    code: string;
    category: string;
  };
  totalQuantitySold: number;
  totalRevenue: number;
  rank: number;
}

export interface AgencyRanking {
  id: string;
  agency: {
    id: string;
    name: string;
    location: string;
    phone?: string;
    email?: string;
    manager?: string;
    status?: string;
  };
  totalSales: number;
  totalRevenue: number;
  totalGuides?: number;
  averageTicket: number;
  totalCommission: number;
  rank: number;
}

// Tipos dedicados para endpoints de desempeño
export interface DailyPerformancePoint {
  date: string; // ISO date (yyyy-mm-dd)
  sales: number;
  revenue: number;
}

export interface RegistrationStats {
  totalRegistrations: number;
  totalPeople: number;
  averagePeoplePerRegistration: number;
}

export interface SalesSummary {
  totalSales: number;
  totalRevenue: number;
  averageTicket: number;
  totalCommission: number;
}

export interface SalesByTypeEntry {
  saleType: string;
  count: number;
  revenue: number;
}

export interface GuidePerformance {
  sales: SalesSummary;
  registrations?: RegistrationStats;
  closurePercentage?: number;
  dailyPerformance: DailyPerformancePoint[];
}

export interface EmployeePerformance {
  sales: SalesSummary;
  salesByType: SalesByTypeEntry[];
  dailyPerformance: DailyPerformancePoint[];
}

export interface RankingData {
  guides: GuideRanking[];
  employees: EmployeeRanking[];
  products: ProductRanking[];
  agencies: AgencyRanking[];
  period: RankingPeriod;
  totalSales: number;
  totalRevenue: number;
}

class RankingService {
  async getWeeklyRankings(): Promise<RankingData> {
    const response = await api.get('/rankings/weekly', { __suppressGlobalError: true, headers: { 'x-cache-permit': '1', 'x-cache-ttl-ms': '300000' } } as any);
    return this.transformRankingsResponse(response.data);
  }

  async getMonthlyRankings(): Promise<RankingData> {
    const response = await api.get('/rankings/monthly', { __suppressGlobalError: true, headers: { 'x-cache-permit': '1', 'x-cache-ttl-ms': '300000' } } as any);
    return this.transformRankingsResponse(response.data);
  }

  async getCustomRankings(startDate: string, endDate: string): Promise<RankingData> {
    const response = await api.get('/rankings/custom', {
      params: { startDate, endDate },
      __suppressGlobalError: true as any,
      headers: { 'x-cache-permit': '1', 'x-cache-ttl-ms': '300000' },
    } as any);
    return this.transformRankingsResponse(response.data);
  }

  async getGuidePerformance(guideId: string, period?: RankingPeriod): Promise<GuidePerformance> {
    const params = period ? { startDate: period.startDate, endDate: period.endDate } : {};
    const response = await api.get(`/rankings/guide/${guideId}/performance`, { params, __suppressGlobalError: true, headers: { 'x-cache-permit': '1', 'x-cache-ttl-ms': '180000' } } as any);
    const payload = response.data?.data ?? response.data;
    const sales = payload?.sales ?? {};
    const registrations = payload?.registrations ?? undefined;
    const closurePercentage = payload?.closurePercentage ?? undefined;
    const daily = Array.isArray(payload?.dailyPerformance) ? payload.dailyPerformance : [];
    return {
      sales: {
        totalSales: Number(sales.totalSales ?? 0),
        totalRevenue: Number(sales.totalRevenue ?? 0),
        averageTicket: Number(sales.averageTicket ?? 0),
        totalCommission: Number(sales.totalCommission ?? 0),
      },
      registrations: registrations
        ? {
            totalRegistrations: Number(registrations.totalRegistrations ?? 0),
            totalPeople: Number(registrations.totalPeople ?? 0),
            averagePeoplePerRegistration: Number(registrations.averagePeoplePerRegistration ?? 0),
          }
        : undefined,
      closurePercentage: closurePercentage !== undefined ? Number(closurePercentage ?? 0) : undefined,
      dailyPerformance: daily.map((d: any) => ({
        date: String(d.date ?? ''),
        sales: Number(d.sales ?? 0),
        revenue: Number(d.revenue ?? 0),
      })),
    } as GuidePerformance;
  }

  async getEmployeePerformance(employeeId: string, period?: RankingPeriod): Promise<EmployeePerformance> {
    const params = period ? { startDate: period.startDate, endDate: period.endDate } : {};
    const response = await api.get(`/rankings/employee/${employeeId}/performance`, { params, __suppressGlobalError: true, headers: { 'x-cache-permit': '1', 'x-cache-ttl-ms': '180000' } } as any);
    const payload = response.data?.data ?? response.data;
    const sales = payload?.sales ?? {};
    const salesByType = Array.isArray(payload?.salesByType) ? payload.salesByType : [];
    const daily = Array.isArray(payload?.dailyPerformance) ? payload.dailyPerformance : [];
    return {
      sales: {
        totalSales: Number(sales.totalSales ?? 0),
        totalRevenue: Number(sales.totalRevenue ?? 0),
        averageTicket: Number(sales.averageTicket ?? 0),
        totalCommission: Number(sales.totalCommission ?? 0),
      },
      salesByType: salesByType.map((s: any) => ({
        saleType: String(s.saleType ?? ''),
        count: Number(s.count ?? 0),
        revenue: Number(s.revenue ?? 0),
      })),
      dailyPerformance: daily.map((d: any) => ({
        date: String(d.date ?? ''),
        sales: Number(d.sales ?? 0),
        revenue: Number(d.revenue ?? 0),
      })),
    } as EmployeePerformance;
  }

  async getProductPerformance(period?: RankingPeriod, limit: number = 20): Promise<ProductRanking[]> {
    const params = period ? { startDate: period.startDate, endDate: period.endDate, limit } : { limit };
    const response = await api.get(`/rankings/products/performance`, { params, __suppressGlobalError: true, headers: { 'x-cache-permit': '1', 'x-cache-ttl-ms': '180000' } } as any);
    const rows = response.data?.data ?? response.data;
    return (Array.isArray(rows) ? rows : []).map((r: any, idx: number) => ({
      id: r.productId ?? r.product?.id ?? `${idx}`,
      product: {
        id: r?.product?.id ?? r.productId ?? `${idx}`,
        name: r?.product?.name ?? 'Producto',
        code: r?.product?.code ?? '',
        category: r?.product?.category ?? '',
      },
      totalQuantitySold: Number(r.totalQuantity ?? r.totalQuantitySold ?? 0),
      totalRevenue: Number(r.totalRevenue ?? 0),
      rank: idx + 1,
    }));
  }

  async getAgencyPerformance(period?: RankingPeriod): Promise<AgencyRanking[]> {
    const params = period ? { startDate: period.startDate, endDate: period.endDate } : {};
    const response = await api.get(`/rankings/agencies/performance`, { params, __suppressGlobalError: true, headers: { 'x-cache-permit': '1', 'x-cache-ttl-ms': '180000' } } as any);
    const rows = response.data?.data ?? response.data;
    return (Array.isArray(rows) ? rows : []).map((a: any, idx: number) => ({
      id: a.agencyId ?? a.agency?.id ?? `${idx}`,
      agency: {
        id: a?.agency?.id ?? a.agencyId ?? `${idx}`,
        name: a?.agency?.name ?? 'Agencia',
        location: '',
      },
      totalSales: Number(a.totalSales ?? 0),
      totalRevenue: Number(a.totalRevenue ?? 0),
      averageTicket: Number(a.averageTicket ?? 0),
      totalCommission: Number(a.totalCommission ?? 0),
      rank: idx + 1,
    }));
  }

  // Adaptar forma del backend { success, data: { period, rankings:{...} } } a RankingData
  private transformRankingsResponse(apiResponse: any): RankingData {
    const payload = apiResponse?.data ?? apiResponse; // admitir ambas formas

    const period = payload?.period ?? { startDate: '', endDate: '' };
    const rankings = payload?.rankings ?? { guides: [], employees: [], products: [], agencies: [] };

    const guides: GuideRanking[] = (rankings.guides || []).map((g: any, idx: number) => ({
      id: g.guideId ?? g.id ?? `${idx}`,
      guide: {
        id: g?.guide?.id ?? g.guideId ?? `${idx}`,
        name: g?.guide?.name ?? 'Desconocido',
        agency: g?.guide?.agency ? {
          id: g.guide.agency.id,
          name: g.guide.agency.name,
        } : undefined,
      },
      totalSales: Number(g.totalSales ?? 0),
      totalRevenue: Number(g.totalRevenue ?? 0),
      averageTicket: Number(g.averageTicket ?? 0),
      totalCommission: Number(g.totalCommission ?? 0),
      totalPeopleRegistered: Number(g.totalPeopleRegistered ?? 0),
      closurePercentage: Number(g.closurePercentage ?? 0),
      rank: idx + 1,
    }));

    const employees: EmployeeRanking[] = (rankings.employees || []).map((e: any, idx: number) => ({
      id: e.employeeId ?? e.id ?? `${idx}`,
      employee: {
        id: e?.employee?.id ?? e.employeeId ?? `${idx}`,
        name: e?.employee?.name ?? 'Desconocido',
        branch: e?.employee?.branch ? {
          id: e.employee.branch.id,
          name: e.employee.branch.name,
        } : undefined,
      },
      totalSales: Number(e.totalSales ?? 0),
      totalRevenue: Number(e.totalRevenue ?? 0),
      averageTicket: Number(e.averageTicket ?? 0),
      totalCommission: Number(e.totalCommission ?? 0),
      rank: idx + 1,
    }));

    const products: ProductRanking[] = (rankings.products || []).map((p: any, idx: number) => ({
      id: p.productId ?? p.product?.id ?? `${idx}`,
      product: {
        id: p?.product?.id ?? p.productId ?? `${idx}`,
        name: p?.product?.name ?? 'Producto',
        code: p?.product?.code ?? '',
        category: p?.product?.category ?? '',
      },
      totalQuantitySold: Number(p.totalQuantity ?? p.totalQuantitySold ?? 0),
      totalRevenue: Number(p.totalRevenue ?? 0),
      rank: idx + 1,
    }));

    const agencies: AgencyRanking[] = (rankings.agencies || []).map((a: any, idx: number) => ({
      id: a.agencyId ?? a.agency?.id ?? `${idx}`,
      agency: {
        id: a?.agency?.id ?? a.agencyId ?? `${idx}`,
        name: a?.agency?.name ?? 'Agencia',
        location: '',
      },
      totalSales: Number(a.totalSales ?? 0),
      totalRevenue: Number(a.totalRevenue ?? 0),
      averageTicket: Number(a.averageTicket ?? 0),
      totalCommission: Number(a.totalCommission ?? 0),
      rank: idx + 1,
    }));

    // Métricas totales (aprox.): sumar por empleados; si vacío, fallback guías
    const totalSales = employees.length
      ? employees.reduce((acc, e) => acc + (Number(e.totalSales) || 0), 0)
      : guides.reduce((acc, g) => acc + (Number(g.totalSales) || 0), 0);
    const totalRevenue = employees.length
      ? employees.reduce((acc, e) => acc + (Number(e.totalRevenue) || 0), 0)
      : guides.reduce((acc, g) => acc + (Number(g.totalRevenue) || 0), 0);

    const normalized: RankingDataParsed = {
      guides,
      employees,
      products,
      agencies,
      period: {
        startDate: period.startDate,
        endDate: period.endDate,
      },
      totalSales,
      totalRevenue,
    };

    // Validación final con zod para asegurar consistencia del contrato
    return RankingDataSchema.parse(normalized);
  }
}

export const rankingService = new RankingService();
