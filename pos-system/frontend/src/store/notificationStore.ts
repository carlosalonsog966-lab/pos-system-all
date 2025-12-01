import { create } from 'zustand';
import { ToastData } from '@/components/Common/Toast';
import { useNotificationPrefsStore } from '@/store/notificationPrefsStore';

// Mapa de eventos por scope para limitación de tasa (persistente en módulo)
const scopeEventsMap: Map<string, number[]> = new Map();

export interface Notification extends ToastData {
  scope?: string;
}

interface NotificationState {
  notifications: Notification[];
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  maxNotifications: number;
}

interface NotificationActions {
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
  updateNotification: (id: string, updates: Partial<Notification>) => void;
  showSuccess: (title: string, message?: string, options?: NotificationOptions) => string;
  showError: (title: string, message?: string, options?: NotificationOptions) => string;
  showWarning: (title: string, message?: string, options?: NotificationOptions) => string;
  showInfo: (title: string, message?: string, options?: NotificationOptions) => string;
  setPosition: (position: NotificationState['position']) => void;
  setMaxNotifications: (max: number) => void;
}

export interface NotificationOptions {
  duration?: number;
  persistent?: boolean;
  action?: { label: string; onClick: () => void };
  scope?: string;
}

export const useNotificationStore = create<NotificationState & NotificationActions>((set, get) => ({
  // Estado inicial
  notifications: [],
  position: 'top-right',
  maxNotifications: 5,

  // Acciones
  addNotification: (notification) => {
    const prefs = useNotificationPrefsStore.getState();
    const scope = (notification as Notification).scope || 'general';

    // Limitación de tasa por scope
    // Mantener eventos recientes en memoria por ventana
    const now = Date.now();
    const windowMs = prefs.rateLimitWindowMs;
    const maxPerWindow = prefs.rateLimitMaxPerWindow;
    // Usamos un mapa persistente a nivel de módulo para controlar la tasa por scope
    const arr = scopeEventsMap.get(scope) || [];
    const fresh = arr.filter((ts) => now - ts < windowMs);
    if (fresh.length >= maxPerWindow) {
      // Demasiadas notificaciones para este scope en la ventana; suprimir
      scopeEventsMap.set(scope, fresh);
      return `suppressed-${scope}-${now}`;
    }
    fresh.push(now);
    scopeEventsMap.set(scope, fresh);
    // Buscar duplicado por tipo/título/mensaje
    const state = get();
    const dupIndex = state.notifications.findIndex(
      (n) =>
        n.type === notification.type &&
        (n.title || '') === (notification.title || '') &&
        (n.message || '') === (notification.message || '')
    );

    if (dupIndex !== -1) {
      const target = state.notifications[dupIndex];
      const updated: Notification = {
        ...target,
        // incrementar contador de repeticiones
        count: (target.count || 1) + 1,
        // refrescar duración si se especifica una nueva
        duration: notification.duration ?? target.duration ?? 5000,
        // mantener persistencia si alguno lo es
        persistent: target.persistent || notification.persistent || false,
        // permitir actualizar action si llega una nueva
        action: notification.action ?? target.action,
        scope,
      };

      set((s) => {
        const next = [...s.notifications];
        next[dupIndex] = updated;
        return { notifications: next };
      });

      if (!updated.persistent && updated.duration && updated.duration > 0) {
        setTimeout(() => {
          get().removeNotification(updated.id);
        }, updated.duration);
      }

      return updated.id;
    }

    // No hay duplicado: crear nuevo
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = {
      ...notification,
      id,
      count: 1,
      duration: notification.duration ?? 5000,
      scope,
    };

    set((s) => {
      const updatedNotifications = [...s.notifications, newNotification];
      // Limitar el número de notificaciones
      if (updatedNotifications.length > s.maxNotifications) {
        updatedNotifications.splice(0, updatedNotifications.length - s.maxNotifications);
      }
      return { notifications: updatedNotifications };
    });

    // Auto-remover la notificación después del tiempo especificado
    if (!newNotification.persistent && newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        get().removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  },

  removeNotification: (id: string) => {
    set((state) => ({
      notifications: state.notifications.filter(notification => notification.id !== id),
    }));
  },

  clearAllNotifications: () => {
    set({ notifications: [] });
  },

  updateNotification: (id: string, updates: Partial<Notification>) => {
    set((state) => ({
      notifications: state.notifications.map(notification =>
        notification.id === id ? { ...notification, ...updates } : notification
      ),
    }));
  },

  showSuccess: (title: string, message?: string, options: NotificationOptions = {}) => {
    return get().addNotification({
      type: 'success',
      title,
      message,
      duration: options.duration ?? 5000,
      persistent: options.persistent,
      action: options.action,
      scope: options.scope,
    });
  },

  showError: (title: string, message?: string, options: NotificationOptions = {}) => {
    return get().addNotification({
      type: 'error',
      title,
      message,
      persistent: options.persistent ?? false,
      duration: options.persistent ? undefined : (options.duration ?? 8000),
      action: options.action,
      scope: options.scope,
    });
  },

  showWarning: (title: string, message?: string, options: NotificationOptions = {}) => {
    return get().addNotification({
      type: 'warning',
      title,
      message,
      duration: options.duration ?? 6000,
      persistent: options.persistent,
      action: options.action,
      scope: options.scope,
    });
  },

  showInfo: (title: string, message?: string, options: NotificationOptions = {}) => {
    return get().addNotification({
      type: 'info',
      title,
      message,
      duration: options.duration ?? 5000,
      persistent: options.persistent,
      action: options.action,
      scope: options.scope,
    });
  },

  setPosition: (position) => {
    set({ position });
  },

  setMaxNotifications: (maxNotifications) => {
    set((state) => {
      const notifications = state.notifications.slice(-maxNotifications);
      return { maxNotifications, notifications };
    });
  },
}));

