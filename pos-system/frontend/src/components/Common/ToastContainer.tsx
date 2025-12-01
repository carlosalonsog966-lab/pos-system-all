import React from 'react';
import Toast, { ToastData } from './Toast';

export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

interface ToastContainerProps {
  toasts: ToastData[];
  onRemoveToast: (id: string) => void;
  position?: ToastPosition;
  maxToasts?: number;
}

const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onRemoveToast,
  position = 'top-right',
  maxToasts = 5
}) => {
  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-2 right-2 sm:top-4 sm:right-4';
      case 'top-left':
        return 'top-2 left-2 sm:top-4 sm:left-4';
      case 'bottom-right':
        return 'bottom-2 right-2 sm:bottom-4 sm:right-4';
      case 'bottom-left':
        return 'bottom-2 left-2 sm:bottom-4 sm:left-4';
      case 'top-center':
        return 'top-2 sm:top-4 left-1/2 -translate-x-1/2';
      case 'bottom-center':
        return 'bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2';
      default:
        return 'top-2 right-2 sm:top-4 sm:right-4';
    }
  };

  const getFlexDirection = () => {
    // En posiciones "top-*" los más recientes arriba; en "bottom-*" abajo
    return position.includes('top') ? 'flex-col-reverse' : 'flex-col';
  };

  // Limitar el número de toasts mostrados: últimos N
  const visibleToasts = toasts.slice(-maxToasts);

  if (visibleToasts.length === 0) {
    return null;
  }

  return (
    <div
      className={`
        fixed z-50 pointer-events-none
        ${getPositionClasses()}
      `}
      aria-live="polite"
      aria-label="Notificaciones"
    >
      <div
        className={`
          flex ${getFlexDirection()} gap-2 items-stretch
          w-auto
        `}
      >
        {visibleToasts.map((toast) => (
          <Toast
            key={toast.id}
            toast={toast}
            onClose={onRemoveToast}
            position={position}
          />
        ))}
      </div>
    </div>
  );
};

export default ToastContainer;
