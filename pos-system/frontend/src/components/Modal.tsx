import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
}

const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  showCloseButton = true 
}) => {
  const location = useLocation();
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Cerrar el modal automáticamente al cambiar de ruta
  useEffect(() => {
    if (isOpen) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  if (!isOpen) return null;

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'max-w-md';
      case 'md':
        return 'max-w-lg';
      case 'lg':
        return 'max-w-2xl';
      case 'xl':
        return 'max-w-4xl';
      default:
        return 'max-w-lg';
    }
  };

  return (
    // No renderizar nada si el modal no está abierto
    // Evita que el backdrop cubra la UI cuando isOpen es false
    !isOpen ? null : (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div 
        className={`
          card relative w-full mx-4 max-h-[90vh] overflow-y-auto
          ${getSizeClasses()}
          transform transition-all duration-300 ease-out
          animate-in fade-in-0 zoom-in-95
        `}
        style={{ borderRadius: '12px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-6 pb-4">
            {title && (
              <h2 className="font-display text-xl font-semibold text-text-warm">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-line-soft rounded-lg transition-colors"
              >
                <X size={20} className="text-[#8F8F8F]" />
              </button>
            )}
          </div>
        )}
        
        {/* Content */}
        <div className={title || showCloseButton ? 'px-6 pb-6' : 'p-6'}>
          {children}
        </div>
      </div>
    </div>
    )
  );
};

export default Modal;
