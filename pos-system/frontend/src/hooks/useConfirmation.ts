import { useState, useCallback } from 'react';

export interface ConfirmationConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  itemName?: string;
  details?: string[];
}

export interface ConfirmationState extends ConfirmationConfig {
  isOpen: boolean;
  isLoading: boolean;
  onConfirm: () => void;
}

export interface UseConfirmationReturn {
  confirmationState: ConfirmationState;
  showConfirmation: (config: ConfirmationConfig, onConfirm: () => void | Promise<void>) => void;
  hideConfirmation: () => void;
  setLoading: (loading: boolean) => void;
}

export const useConfirmation = (): UseConfirmationReturn => {
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>({
    isOpen: false,
    isLoading: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    type: 'danger',
    itemName: undefined,
    details: [],
    onConfirm: () => {},
  });

  const showConfirmation = useCallback((
    config: ConfirmationConfig,
    onConfirm: () => void | Promise<void>
  ) => {
    setConfirmationState({
      ...config,
      isOpen: true,
      isLoading: false,
      confirmText: config.confirmText || 'Confirmar',
      cancelText: config.cancelText || 'Cancelar',
      type: config.type || 'danger',
      details: config.details || [],
      onConfirm: async () => {
        try {
          setConfirmationState(prev => ({ ...prev, isLoading: true }));
          await onConfirm();
          setConfirmationState(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (error) {
          setConfirmationState(prev => ({ ...prev, isLoading: false }));
          throw error;
        }
      },
    });
  }, []);

  const hideConfirmation = useCallback(() => {
    setConfirmationState(prev => ({ ...prev, isOpen: false, isLoading: false }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setConfirmationState(prev => ({ ...prev, isLoading: loading }));
  }, []);

  return {
    confirmationState,
    showConfirmation,
    hideConfirmation,
    setLoading,
  };
};

export default useConfirmation;