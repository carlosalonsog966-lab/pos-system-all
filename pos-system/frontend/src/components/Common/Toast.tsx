import React, { useEffect, useState } from 'react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { playNotificationSound } from '@/lib/notificationAudio';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  // Número de repeticiones acumuladas cuando se deduplican notificaciones
  count?: number;
  // Atributos HTML personalizados para auditoría
  htmlAttributes?: Record<string, string>;
}

interface ToastProps {
  toast: ToastData;
  onClose: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

const Toast: React.FC<ToastProps> = ({ 
  toast, 
  onClose, 
  position
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const [paused, setPaused] = useState(false);
  const startTimeRef = React.useRef<number | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationRef = React.useRef<number>(toast.duration || 5000);
  const remainingRef = React.useRef<number>(durationRef.current);

  useEffect(() => {
    // Animación de entrada
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Reproducir sonido al montar el toast
  useEffect(() => {
    playNotificationSound(toast.type);
    // solo en primer render del toast
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast.persistent && toast.duration !== 0) {
      const duration = toast.duration || 5000;
      durationRef.current = duration;
      remainingRef.current = duration;
      startTimeRef.current = Date.now();
      timerRef.current = setTimeout(() => {
        handleClose();
      }, remainingRef.current);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [toast.duration, toast.persistent]);

  // Barra de progreso visual basada en duration
  useEffect(() => {
    setProgress(100);
    const t = setTimeout(() => {
      if (!paused && (toast.duration || 5000) > 0 && !toast.persistent) {
        setProgress(0);
      }
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  const onMouseEnter = () => {
    if (toast.persistent) return;
    setPaused(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (startTimeRef.current != null) {
      const elapsed = Date.now() - startTimeRef.current;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
      const pct = Math.max(0, Math.min(100, (remainingRef.current / durationRef.current) * 100));
      setProgress(pct);
    }
  };

  const onMouseLeave = () => {
    if (toast.persistent) return;
    setPaused(false);
    startTimeRef.current = Date.now();
    if (remainingRef.current > 0) {
      timerRef.current = setTimeout(() => {
        handleClose();
      }, remainingRef.current);
      setTimeout(() => setProgress(0), 20);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(toast.id);
    }, 300);
  };

  const getIcon = () => {
    const iconClasses = "h-5 w-5 flex-shrink-0";
    
    switch (toast.type) {
      case 'success':
        return <CheckCircleIcon className={`${iconClasses} text-green-500`} />;
      case 'error':
        return <XCircleIcon className={`${iconClasses} text-red-500`} />;
      case 'warning':
        return <ExclamationTriangleIcon className={`${iconClasses} text-yellow-500`} />;
      case 'info':
        return <InformationCircleIcon className={`${iconClasses} text-blue-500`} />;
      default:
        return <InformationCircleIcon className={`${iconClasses} text-blue-500`} />;
    }
  };

  const getColorClasses = () => {
    switch (toast.type) {
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'info':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-white';
    }
  };

  const getAnimationClasses = () => {
    const baseClasses = "transition-all duration-200 ease-out";
    const translateEnter = position && position.includes('bottom') ? 'translate-y-2' : '-translate-y-2';
    const translateExit = position && position.includes('bottom') ? 'translate-y-3' : '-translate-y-3';
    
    if (isExiting) {
      return `${baseClasses} opacity-0 transform ${translateExit} scale-95`;
    }
    
    if (isVisible) {
      return `${baseClasses} opacity-100 transform translate-y-0 scale-100`;
    }
    
    return `${baseClasses} opacity-0 transform ${translateEnter} scale-95`;
  };

  return (
    <div
      className={`
        relative w-full shadow-md rounded-xl border pointer-events-auto overflow-hidden
        ${getColorClasses()}
        ${getAnimationClasses()}
        max-w-[88vw] sm:max-w-[420px] md:max-w-[500px]
      `}
      role="status"
      aria-live={toast.type === 'error' || toast.type === 'warning' ? 'assertive' : 'polite'}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      {...toast.htmlAttributes}
    >
      <div className="p-2.5 sm:p-3 pr-8">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {getIcon()}
          </div>
          
          <div className="ml-2.5 flex-1 min-w-0">
            <p className="text-sm leading-snug font-semibold text-gray-900">
              {toast.title}
              {toast.count && toast.count > 1 && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-gray-200 text-gray-700 align-middle">
                  ×{toast.count}
                </span>
              )}
            </p>
            {toast.message && (
              <p className="mt-1 text-xs leading-snug text-gray-700 max-h-32 overflow-y-auto break-words whitespace-pre-line">
                {toast.message}
              </p>
            )}
            
            {toast.action && (
              <div className="mt-3">
                <button
                  onClick={toast.action.onClick}
                  className="text-sm font-medium text-brand-gold hover:text-brand-gold/80 transition-colors"
                >
                  {toast.action.label}
                </button>
              </div>
            )}
          </div>
          
          <button
            onClick={handleClose}
            className="absolute top-2 right-2 inline-flex text-gray-500 hover:text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-gold rounded"
            aria-label="Cerrar notificación"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
      {/* Barra de progreso visual con pausa */}
      {!toast.persistent && (toast.duration || 0) > 0 && (
        <div className="h-1 bg-gray-200">
          <div
            className="h-1 bg-brand-gold"
            style={{
              width: `${progress}%`,
              transition: paused ? 'none' : `width ${(toast.duration || 5000)}ms linear`,
            }}
          />
        </div>
      )}
    </div>
  );
};

export default Toast;
