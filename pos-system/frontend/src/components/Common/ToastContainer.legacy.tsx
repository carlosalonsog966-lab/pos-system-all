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
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'top-center':
        return 'top-4 left-1/2 transform -translate-x-1/2';
      case 'bottom-center':
        return 'bottom-4 left-1/2 transform -translate-x-1/2';
      default:
        return 'top-4 right-4';
    }
  };

  const getFlexDirection = () => {
    return position.includes('bottom') ? 'flex-col-reverse' : 'flex-col';
  };

  // Limitar el número de toasts mostrados
  const visibleToasts = toasts.slice(0, maxToasts);

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
      <div className={`flex ${getFlexDirection()} space-y-2`}>
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