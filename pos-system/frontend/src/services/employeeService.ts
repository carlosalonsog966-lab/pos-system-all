import { api, type ApiResponse } from '@/lib/api';

export interface Employee {
  id: string;
  code: string;
  name: string;
  phone?: string;
  isActive: boolean;
}

// Payloads
export interface CreateEmployeeInput {
  code: string;
  name: string;
  phone?: string;
}

export interface UpdateEmployeeInput {
  name?: string;
  phone?: string;
  isActive?: boolean;
}

const API_BASE = '/employees';

export const EmployeeService = {
  async listEmployees(): Promise<Employee[]> {
    const response = await api.get<ApiResponse<Employee[]>>(API_BASE, { __suppressGlobalError: true } as any);
    return response.data.data;
  },

  async createEmployee(payload: CreateEmployeeInput): Promise<Employee> {
    const response = await api.post<ApiResponse<Employee>>(API_BASE, payload);
    return response.data.data;
  },

  async updateEmployee(id: string, payload: UpdateEmployeeInput): Promise<Employee> {
    const response = await api.put<ApiResponse<Employee>>(`${API_BASE}/${id}`, payload);
    return response.data.data;
  },

  async deleteEmployee(id: string): Promise<void> {
    await api.delete(`${API_BASE}/${id}`);
  },

  // Nuevo: generación masiva de códigos de vendedores
  async bulkGenerateBarcodes(): Promise<{ totalEmployees: number; created: number; skippedExisting: number; skippedNoBranch: number; message?: string }> {
    const response = await api.post<ApiResponse<{ totalEmployees: number; created: number; skippedExisting: number; skippedNoBranch: number; message?: string }>>(
      `${API_BASE}/bulk-generate-barcodes`
    );
    return response.data.data;
  },
};

export default EmployeeService;
