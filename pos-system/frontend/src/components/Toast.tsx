import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

interface ToastProps {
  type: 'success' | 'error';
  message: string;
  isVisible: boolean;
  onClose: () => void;
  autoHide?: boolean;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ 
  type, 
  message, 
  isVisible, 
  onClose, 
  autoHide = true, 
  duration = 4000 
}) => {
  const [isShowing, setIsShowing] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsShowing(true);
      
      if (autoHide) {
        const timer = setTimeout(() => {
          setIsShowing(false);
          setTimeout(onClose, 300); // Wait for animation to complete
        }, duration);
        
        return () => clearTimeout(timer);
      }
    } else {
      setIsShowing(false);
    }
  }, [isVisible, autoHide, duration, onClose]);

  if (!isVisible && !isShowing) return null;

  const getToastStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-success-600 text-white';
      case 'error':
        return 'bg-danger-600 text-white';
      default:
        return 'bg-success-600 text-white';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={20} />;
      case 'error':
        return <XCircle size={20} />;
      default:
        return <CheckCircle size={20} />;
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      <div
        className={`
          ${getToastStyles()}
          rounded-lg px-4 py-3 shadow-lg flex items-center gap-3 min-w-[300px] max-w-[500px]
          transform transition-all duration-300 ease-in-out
          ${isShowing ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        `}
      >
        {getIcon()}
        <span className="font-ui text-sm font-medium flex-1">
          {message}
        </span>
        <button
          onClick={() => {
            setIsShowing(false);
            setTimeout(onClose, 300);
          }}
          className="hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default Toast;