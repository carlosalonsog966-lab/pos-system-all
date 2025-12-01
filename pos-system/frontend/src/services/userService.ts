import { api } from '@/lib/api';

export type UserRole = 'admin' | 'manager' | 'cashier';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  avatarUrl?: string;
  lastLogin?: string;
  createdAt?: string;
}

export interface UserListResponse {
  success: boolean;
  data: User[];
  pagination: {
    page: number;
    pageSize?: number;
    limit?: number;
    total: number;
    totalPages: number;
  };
}

export interface UserQueryParams {
  page?: number;
  limit?: number;
  pageSize?: number;
  search?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface CreateUserInput {
  username: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserInput {
  username?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
}

export class UserService {
  static async getUsers(params: UserQueryParams = {}): Promise<UserListResponse> {
    // Construir parámetros limpios aceptados por el backend
    const cleanParams = {
      page: params.page,
      pageSize: params.pageSize ?? params.limit,
      search: params.search,
      role: params.role,
      isActive: params.isActive,
    };
    const response = await api.get('/users', { params: cleanParams, __suppressGlobalError: true } as any);
    return response.data as UserListResponse;
  }

  static async createUser(data: CreateUserInput): Promise<User> {
    const response = await api.post('/users', data);
    return response.data.data as User;
  }

  static async updateUser(id: string, data: UpdateUserInput): Promise<User> {
    const response = await api.put(`/users/${id}`, data);
    return response.data.data as User;
  }

  static async setStatus(id: string, isActive: boolean): Promise<User> {
    const response = await api.patch(`/users/${id}/status`, { isActive });
    return response.data.data as User;
  }

  static async resetPassword(id: string, newPassword: string): Promise<{ success: boolean }>{
    const response = await api.post(`/users/${id}/reset-password`, { newPassword });
    return response.data as { success: boolean };
  }

  static async uploadAvatar(id: string, file: File): Promise<{ id: string; avatarUrl: string }>{
    const form = new FormData();
    form.append('avatar', file);
    const response = await api.post(`/users/${id}/avatar`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data as { id: string; avatarUrl: string };
  }

  static async deleteUser(id: string): Promise<{ success: boolean; message?: string }>{
    const response = await api.delete(`/users/${id}`);
    return response.data as { success: boolean; message?: string };
  }

  static async bulkDeactivateNonAdmin(): Promise<{ success: boolean; affected: number }>{
    const response = await api.delete(`/users/bulk/non-admin`);
    return response.data as { success: boolean; affected: number };
  }
}
