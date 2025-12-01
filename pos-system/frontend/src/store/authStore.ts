import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, initializeApiBaseUrl } from '@/lib/api';

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'cashier';
  isActive: boolean;
  lastLogin?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  initializeAuth: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  setToken: (token: string | null, refreshToken?: string | null) => void;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      // Estado inicial
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Acciones
      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          // Asegurar que el baseURL esté correctamente inicializado (p. ej., '/api' en preview)
          try { await initializeApiBaseUrl(); } catch { /* noop */ }

          const response = await api.post('/auth/login', {
            username,
            password,
          });

          const { user, token } = response.data.data;
          const rt = (response.data.data as any).refreshToken ?? null;
          
          // Fijar header global para compatibilidad con pruebas y servicios legados
          try { api.defaults.headers.common['Authorization'] = `Bearer ${token}`; } catch {}
          set({
            user,
            token,
            refreshToken: rt,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Error al iniciar sesión';
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
          });
          throw new Error(errorMessage);
        }
      },

      logout: () => {
        
        try { delete (api.defaults.headers.common as any)['Authorization']; } catch {}
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },

      clearError: () => {
        set({ error: null });
      },

      initializeAuth: () => {
        const { token } = get();
        
        if (token) {
          try { api.defaults.headers.common['Authorization'] = `Bearer ${token}`; } catch {}
          set({ isAuthenticated: true });
        }
      },

      updateProfile: async (data: Partial<User>) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await api.put('/auth/profile', data);
          const updatedUser = response.data.data;
          
          set({
            user: updatedUser,
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Error al actualizar perfil';
          set({
            isLoading: false,
            error: errorMessage,
          });
          throw new Error(errorMessage);
        }
      },

      changePassword: async (currentPassword: string, newPassword: string) => {
        set({ isLoading: true, error: null });
        
        try {
          await api.post('/auth/change-password', {
            currentPassword,
            newPassword,
          });
          
          set({
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Error al cambiar contraseña';
          set({
            isLoading: false,
            error: errorMessage,
          });
          throw new Error(errorMessage);
        }
      },

      setToken: (token: string | null, refreshToken?: string | null) => {
        const next: Partial<AuthState> = { token, isAuthenticated: !!token };
        if (typeof refreshToken !== 'undefined') next.refreshToken = refreshToken ?? null;
        set(next as AuthState);
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
