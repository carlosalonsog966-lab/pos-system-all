import React from 'react';
import { 
  // ChevronUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

export interface SortOption {
  id: string;
  label: string;
  field: string;
  direction?: 'asc' | 'desc';
}

interface SortSelectorProps {
  options: SortOption[];
  value?: string;
  direction?: 'asc' | 'desc';
  onChange: (sortId: string, direction: 'asc' | 'desc') => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showDirection?: boolean;
}

const SortSelector: React.FC<SortSelectorProps> = ({
  options,
  value,
  direction = 'asc',
  onChange,
  className = '',
  size = 'md',
  showDirection = true
}) => {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const handleSortChange = (sortId: string) => {
    if (value === sortId) {
      // Si es el mismo campo, cambiar dirección
      const newDirection = direction === 'asc' ? 'desc' : 'asc';
      onChange(sortId, newDirection);
    } else {
      // Si es un campo diferente, usar dirección por defecto
      const option = options.find(opt => opt.id === sortId);
      onChange(sortId, option?.direction || 'asc');
    }
  };

  const toggleDirection = () => {
    if (value) {
      const newDirection = direction === 'asc' ? 'desc' : 'asc';
      onChange(value, newDirection);
    }
  };

  const currentOption = options.find(opt => opt.id === value);

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Selector de campo */}
      <select
        value={value || ''}
        onChange={(e) => handleSortChange(e.target.value)}
        className={`
          ${sizeClasses[size]} border border-line-soft rounded-md bg-white 
          text-text-warm focus:outline-none focus:ring-2 focus:ring-brand-gold 
          focus:border-brand-gold transition-colors cursor-pointer
        `}
      >
        <option value="">Ordenar por...</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Botón de dirección */}
      {showDirection && value && (
        <button
          onClick={toggleDirection}
          className={`
            ${sizeClasses[size]} border border-line-soft rounded-md bg-white 
            text-text-warm hover:bg-base-ivory focus:outline-none focus:ring-2 
            focus:ring-brand-gold focus:border-brand-gold transition-colors
            flex items-center justify-center
          `}
          title={direction === 'asc' ? 'Ascendente' : 'Descendente'}
        >
          {direction === 'asc' ? (
            <ChevronUpIcon className={iconSizes[size]} />
          ) : (
            <ChevronDownIcon className={iconSizes[size]} />
          )}
        </button>
      )}

      {/* Indicador visual del ordenamiento actual */}
      {currentOption && (
        <span className="text-xs text-text-muted">
          {currentOption.label} ({direction === 'asc' ? '↑' : '↓'})
        </span>
      )}
    </div>
  );
};

export default SortSelector;