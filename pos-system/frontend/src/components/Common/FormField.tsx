import React, { forwardRef } from 'react';
import { ExclamationCircleIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export interface FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  error?: string;
  touched?: boolean;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  autoComplete?: string;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  className?: string;
  showPasswordToggle?: boolean;
  helpText?: string;
  prefix?: string;
  suffix?: string;
}

export interface TextAreaFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  error?: string;
  touched?: boolean;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  className?: string;
  helpText?: string;
}

export interface SelectFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLSelectElement>) => void;
  error?: string;
  touched?: boolean;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  helpText?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
}

const FormField = forwardRef<HTMLInputElement, FormFieldProps>(({
  label,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  touched,
  required = false,
  disabled = false,
  placeholder,
  autoComplete,
  min,
  max,
  step,
  maxLength,
  className = '',
  showPasswordToggle = false,
  helpText,
  prefix,
  suffix,
}, ref) => {
  const [showPassword, setShowPassword] = React.useState(false);
  const hasError = touched && error;
  const inputType = type === 'password' && showPassword ? 'text' : type;

  const baseInputClasses = `
    input-field
    ${hasError ? 'border-danger-600 focus:border-danger-600 focus:ring-danger-600' : ''}
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    ${prefix ? 'pl-8' : ''}
    ${suffix || showPasswordToggle ? 'pr-10' : ''}
    ${className}
  `.trim();

  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block font-ui text-sm font-medium text-text-warm">
        {label}
        {required && <span className="text-danger-600 ml-1">*</span>}
      </label>
      
      <div className="relative">
        {prefix && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-[#8F8F8F] font-ui text-sm">{prefix}</span>
          </div>
        )}
        
        <input
          ref={ref}
          id={name}
          name={name}
          type={inputType}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete={autoComplete}
          min={min}
          max={max}
          step={step}
          maxLength={maxLength}
          className={baseInputClasses}
          aria-invalid={!!hasError}
          aria-describedby={hasError ? `${name}-error` : helpText ? `${name}-help` : undefined}
        />
        
        {suffix && !showPasswordToggle && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-[#8F8F8F] font-ui text-sm">{suffix}</span>
          </div>
        )}
        
        {showPasswordToggle && type === 'password' && (
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            onClick={() => setShowPassword(!showPassword)}
            disabled={disabled}
          >
            {showPassword ? (
              <EyeSlashIcon className="h-4 w-4 text-[#8F8F8F]" />
            ) : (
              <EyeIcon className="h-4 w-4 text-[#8F8F8F]" />
            )}
          </button>
        )}
        
        {hasError && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <ExclamationCircleIcon className="h-4 w-4 text-danger-600" />
          </div>
        )}
      </div>
      
      {hasError && (
        <p id={`${name}-error`} className="font-ui text-sm text-danger-600 flex items-center gap-1">
          <ExclamationCircleIcon className="h-3 w-3 flex-shrink-0" />
          {error}
        </p>
      )}
      
      {helpText && !hasError && (
        <p id={`${name}-help`} className="font-ui text-xs text-[#8F8F8F]">
          {helpText}
        </p>
      )}
    </div>
  );
});

FormField.displayName = 'FormField';

export const TextAreaField: React.FC<TextAreaFieldProps> = ({
  label,
  name,
  value,
  onChange,
  onBlur,
  error,
  touched,
  required = false,
  disabled = false,
  placeholder,
  rows = 3,
  maxLength,
  className = '',
  helpText,
}) => {
  const hasError = touched && error;

  const baseTextAreaClasses = `
    input-field
    resize-none
    ${hasError ? 'border-danger-600 focus:border-danger-600 focus:ring-danger-600' : ''}
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    ${className}
  `.trim();

  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block font-ui text-sm font-medium text-text-warm">
        {label}
        {required && <span className="text-danger-600 ml-1">*</span>}
      </label>
      
      <div className="relative">
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          className={baseTextAreaClasses}
          aria-invalid={!!hasError}
          aria-describedby={hasError ? `${name}-error` : helpText ? `${name}-help` : undefined}
        />
        
        {hasError && (
          <div className="absolute top-2 right-2 pointer-events-none">
            <ExclamationCircleIcon className="h-4 w-4 text-danger-600" />
          </div>
        )}
      </div>
      
      {maxLength && (
        <div className="flex justify-between items-center">
          <div>
            {hasError && (
              <p id={`${name}-error`} className="font-ui text-sm text-danger-600 flex items-center gap-1">
                <ExclamationCircleIcon className="h-3 w-3 flex-shrink-0" />
                {error}
              </p>
            )}
            
            {helpText && !hasError && (
              <p id={`${name}-help`} className="font-ui text-xs text-[#8F8F8F]">
                {helpText}
              </p>
            )}
          </div>
          
          <span className="font-ui text-xs text-[#8F8F8F]">
            {value.length}/{maxLength}
          </span>
        </div>
      )}
    </div>
  );
};

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  name,
  value,
  onChange,
  onBlur,
  error,
  touched,
  required = false,
  disabled = false,
  className = '',
  helpText,
  options,
  placeholder,
}) => {
  const hasError = touched && error;

  const baseSelectClasses = `
    input-field
    ${hasError ? 'border-danger-600 focus:border-danger-600 focus:ring-danger-600' : ''}
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    ${className}
  `.trim();

  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block font-ui text-sm font-medium text-text-warm">
        {label}
        {required && <span className="text-danger-600 ml-1">*</span>}
      </label>
      
      <div className="relative">
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          required={required}
          disabled={disabled}
          className={baseSelectClasses}
          aria-invalid={!!hasError}
          aria-describedby={hasError ? `${name}-error` : helpText ? `${name}-help` : undefined}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option 
              key={option.value} 
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        
        {hasError && (
          <div className="absolute inset-y-0 right-8 flex items-center pointer-events-none">
            <ExclamationCircleIcon className="h-4 w-4 text-danger-600" />
          </div>
        )}
      </div>
      
      {hasError && (
        <p id={`${name}-error`} className="font-ui text-sm text-danger-600 flex items-center gap-1">
          <ExclamationCircleIcon className="h-3 w-3 flex-shrink-0" />
          {error}
        </p>
      )}
      
      {helpText && !hasError && (
        <p id={`${name}-help`} className="font-ui text-xs text-[#8F8F8F]">
          {helpText}
        </p>
      )}
    </div>
  );
};

export default FormField;