import { useState, useCallback } from 'react';
import { ToastData, ToastType } from '@/components/Common/Toast';

interface ToastOptions {
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface UseToastReturn {
  toasts: ToastData[];
  showToast: (type: ToastType, title: string, message?: string, options?: ToastOptions) => string;
  showSuccess: (title: string, message?: string, options?: ToastOptions) => string;
  showError: (title: string, message?: string, options?: ToastOptions) => string;
  showWarning: (title: string, message?: string, options?: ToastOptions) => string;
  showInfo: (title: string, message?: string, options?: ToastOptions) => string;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
  updateToast: (id: string, updates: Partial<ToastData>) => void;
}

export const useToast = (): UseToastReturn => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const generateId = useCallback(() => {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const showToast = useCallback((
    type: ToastType,
    title: string,
    message?: string,
    options?: ToastOptions
  ): string => {
    const id = generateId();
    const newToast: ToastData = {
      id,
      type,
      title,
      message,
      duration: options?.duration,
      persistent: options?.persistent,
      action: options?.action
    };

    setToasts(prev => [...prev, newToast]);
    return id;
  }, [generateId]);

  const showSuccess = useCallback((
    title: string,
    message?: string,
    options?: ToastOptions
  ): string => {
    return showToast('success', title, message, options);
  }, [showToast]);

  const showError = useCallback((
    title: string,
    message?: string,
    options?: ToastOptions
  ): string => {
    return showToast('error', title, message, { 
      duration: 7000, // Errores duran más tiempo
      ...options 
    });
  }, [showToast]);

  const showWarning = useCallback((
    title: string,
    message?: string,
    options?: ToastOptions
  ): string => {
    return showToast('warning', title, message, options);
  }, [showToast]);

  const showInfo = useCallback((
    title: string,
    message?: string,
    options?: ToastOptions
  ): string => {
    return showToast('info', title, message, options);
  }, [showToast]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<ToastData>) => {
    setToasts(prev => prev.map(toast => 
      toast.id === id ? { ...toast, ...updates } : toast
    ));
  }, []);

  return {
    toasts,
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeToast,
    clearAllToasts,
    updateToast
  };
};