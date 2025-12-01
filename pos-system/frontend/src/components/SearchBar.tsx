import React, { useRef, useEffect } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from './Common/LoadingSpinner';

interface SearchBarProps {
  value?: string;
  onChange?: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  isLoading?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  resultCount?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  dataTestId?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  value = '', 
  onChange, 
  onClear,
  placeholder = 'Buscar...', 
  isLoading = false,
  disabled = false,
  autoFocus = false,
  resultCount,
  className = '',
  size = 'md',
  dataTestId = 'search-input'
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    const handler = () => { inputRef.current?.focus() }
    window.addEventListener('shortcut:focusSearch', handler as EventListener)
    return () => window.removeEventListener('shortcut:focusSearch', handler as EventListener)
  }, [])

  const handleClear = () => {
    onChange?.('');
    onClear?.();
    inputRef.current?.focus();
  };

  const sizeClasses = {
    sm: 'pl-8 pr-8 py-2 text-sm',
    md: 'pl-10 pr-10 py-3 text-sm',
    lg: 'pl-12 pr-12 py-4 text-base',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const iconPositions = {
    sm: 'left-2',
    md: 'left-3',
    lg: 'left-4',
  };

  const clearPositions = {
    sm: 'right-2',
    md: 'right-3',
    lg: 'right-4',
  };

  return (
    <div className={`relative w-full ${className}`}>
      {/* Icono de búsqueda */}
      <div className={`absolute inset-y-0 ${iconPositions[size]} flex items-center pointer-events-none`}>
        <MagnifyingGlassIcon className={`${iconSizes[size]} text-text-muted`} />
      </div>

      {/* Campo de entrada */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        data-testid={dataTestId}
        className={`
          w-full ${sizeClasses[size]} border border-line-soft rounded-lg bg-white 
          text-text-warm placeholder-text-muted 
          focus:outline-none focus:ring-2 focus:ring-brand-gold focus:border-brand-gold 
          transition-all duration-200 font-ui
          disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-base-ivory
          ${className}
        `}
      />

      {/* Área de acciones (loading, clear, count) */}
      <div className={`absolute inset-y-0 ${clearPositions[size]} flex items-center gap-2`}>
        {/* Contador de resultados */}
        {resultCount !== undefined && value.trim() && !isLoading && (
          <span className="text-xs text-text-muted bg-base-ivory px-2 py-1 rounded">
            {resultCount} resultado{resultCount !== 1 ? 's' : ''}
          </span>
        )}

        {/* Spinner de carga */}
        {isLoading && (
          <LoadingSpinner size="xs" color="current" inline />
        )}

        {/* Botón de limpiar */}
        {value.trim() && !isLoading && (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="text-text-muted hover:text-text-warm transition-colors duration-200 disabled:opacity-50"
            aria-label="Limpiar búsqueda"
          >
            <XMarkIcon className={iconSizes[size]} />
          </button>
        )}
      </div>
    </div>
  );
};

export default SearchBar;