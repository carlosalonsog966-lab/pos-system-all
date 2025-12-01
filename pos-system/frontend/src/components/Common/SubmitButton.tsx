import React from 'react';
import LoadingSpinner from './LoadingSpinner';
import { CheckIcon } from '@heroicons/react/24/outline';

export interface SubmitButtonProps {
  children: React.ReactNode;
  isLoading?: boolean;
  isValid?: boolean;
  disabled?: boolean;
  type?: 'submit' | 'button';
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
  loadingText?: string;
  successText?: string;
  showSuccess?: boolean;
  onClick?: () => void;
}

const SubmitButton: React.FC<SubmitButtonProps> = ({
  children,
  isLoading = false,
  isValid = true,
  disabled = false,
  type = 'submit',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  loadingText,
  successText,
  showSuccess = false,
  onClick,
}) => {
  const isDisabled = disabled || isLoading || !isValid;

  const baseClasses = `
    inline-flex items-center justify-center gap-2 font-ui font-medium
    rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
    ${fullWidth ? 'w-full' : ''}
  `.trim();

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const variantClasses = {
    primary: `
      bg-brand-gold text-white border border-brand-gold
      hover:bg-brand-gold/90 hover:border-brand-gold/90
      focus:ring-brand-gold/50
      disabled:hover:bg-brand-gold disabled:hover:border-brand-gold
    `,
    secondary: `
      bg-white text-text-warm border border-line-soft
      hover:bg-base-ivory hover:border-line-medium
      focus:ring-brand-gold/50
      disabled:hover:bg-white disabled:hover:border-line-soft
    `,
    danger: `
      bg-danger-600 text-white border border-danger-600
      hover:bg-danger-700 hover:border-danger-700
      focus:ring-danger-500/50
      disabled:hover:bg-danger-600 disabled:hover:border-danger-600
    `,
    success: `
      bg-success-600 text-white border border-success-600
      hover:bg-success-700 hover:border-success-700
      focus:ring-success-500/50
      disabled:hover:bg-success-600 disabled:hover:border-success-600
    `,
  };

  const buttonClasses = `
    ${baseClasses}
    ${sizeClasses[size]}
    ${variantClasses[variant]}
    ${className}
  `.trim();

  const renderContent = () => {
    if (showSuccess && successText) {
      return (
        <>
          <CheckIcon className="h-4 w-4" />
          <span>{successText}</span>
        </>
      );
    }

    if (isLoading) {
      return (
        <>
          <LoadingSpinner size="sm" />
          <span>{children}</span>
        </>
      );
    }

    return children;
  };

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={buttonClasses}
    >
      {renderContent()}
    </button>
  );
};

export default SubmitButton;
