import React from 'react';

export interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'white' | 'gray' | 'current';
  className?: string;
  text?: string;
  inline?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  color = 'primary',
  className = '', 
  text,
  inline = false
}) => {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const colorClasses = {
    primary: 'border-line-soft border-t-brand-gold',
    white: 'border-white/30 border-t-white',
    gray: 'border-line-soft border-t-text-muted',
    current: 'border-current/30 border-t-current',
  };

  const spinnerElement = (
    <div
      className={`${sizeClasses[size]} border-2 ${colorClasses[color]} rounded-full animate-spin`}
    />
  );

  if (inline) {
    return (
      <span data-testid="loading-spinner" className={`inline-flex items-center gap-2 ${className}`}>
        {spinnerElement}
        {text && <span className="text-sm text-text-muted">{text}</span>}
      </span>
    );
  }

  return (
    <div data-testid="loading-spinner" className={`flex flex-col items-center justify-center ${className}`}>
      {spinnerElement}
      {text && (
        <p className="mt-2 text-sm text-text-muted">{text}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;
