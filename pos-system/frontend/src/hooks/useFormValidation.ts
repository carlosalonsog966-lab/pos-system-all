import { useState, useCallback } from 'react';

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
}

export interface ValidationRules {
  [key: string]: ValidationRule;
}

export interface ValidationErrors {
  [key: string]: string;
}

export interface FormValidationHook<T> {
  values: T;
  errors: ValidationErrors;
  touched: { [key: string]: boolean };
  isValid: boolean;
  isSubmitting: boolean;
  setValue: (name: keyof T, value: any) => void;
  setValues: (values: Partial<T>) => void;
  setFieldTouched: (name: keyof T, touched?: boolean) => void;
  validateField: (name: keyof T) => string | null;
  validateForm: () => boolean;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  handleBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  handleSubmit: (onSubmit: (values: T) => Promise<void> | void) => (e: React.FormEvent) => Promise<void>;
  resetForm: (initialValues?: T) => void;
  clearErrors: () => void;
}

export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  validationRules: ValidationRules
): FormValidationHook<T> {
  const [values, setValuesState] = useState<T>(initialValues);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateField = useCallback((name: keyof T): string | null => {
    const value = values[name];
    const rules = validationRules[name as string];

    if (!rules) return null;

    // Required validation
    if (rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      return 'Este campo es obligatorio';
    }

    // Skip other validations if field is empty and not required
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return null;
    }

    // String validations
    if (typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        return `Debe tener al menos ${rules.minLength} caracteres`;
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        return `No puede tener más de ${rules.maxLength} caracteres`;
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        return 'Formato inválido';
      }
    }

    // Number validations
    if (typeof value === 'number' || !isNaN(Number(value))) {
      const numValue = Number(value);
      if (rules.min !== undefined && numValue < rules.min) {
        return `Debe ser mayor o igual a ${rules.min}`;
      }
      if (rules.max !== undefined && numValue > rules.max) {
        return `Debe ser menor o igual a ${rules.max}`;
      }
    }

    // Custom validation
    if (rules.custom) {
      return rules.custom(value);
    }

    return null;
  }, [values, validationRules]);

  const validateForm = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};
    let isValid = true;

    Object.keys(validationRules).forEach((fieldName) => {
      const error = validateField(fieldName as keyof T);
      if (error) {
        newErrors[fieldName] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [validateField, validationRules]);

  const setValue = useCallback((name: keyof T, value: any) => {
    setValuesState(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field when value changes
    if (errors[name as string]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name as string];
        return newErrors;
      });
    }
  }, [errors]);

  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState(prev => ({ ...prev, ...newValues }));
  }, []);

  const setFieldTouched = useCallback((name: keyof T, isTouched = true) => {
    setTouched(prev => ({ ...prev, [name as string]: isTouched }));
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const tgt: any = e.target || e.currentTarget;
    const { name, id, value, type } = tgt;
    
    let processedValue: any = value;
    
    // Handle different input types
    if (type === 'checkbox') {
      processedValue = (e.target as HTMLInputElement).checked;
    } else if (type === 'number') {
      processedValue = value === '' ? '' : Number(value);
    }
    
    const fieldName = (tgt?.name && String(tgt.name).length > 0)
      ? tgt.name
      : (tgt?.id && String(tgt.id).length > 0)
      ? tgt.id
      : (name && String(name).length > 0)
      ? name
      : (id && String(id).length > 0)
      ? id
      : '';
    if (fieldName) {
      setValue(fieldName as keyof T, processedValue);
    }
  }, [setValue]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name } = e.target;
    setFieldTouched(name as keyof T, true);
    
    // Validate field on blur
    const error = validateField(name as keyof T);
    if (error) {
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  }, [validateField, setFieldTouched]);

  const handleSubmit = useCallback((onSubmit: (values: T) => Promise<void> | void) => {
    return async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);

      // Mark all fields as touched
      const allTouched: { [key: string]: boolean } = {};
      Object.keys(validationRules).forEach(key => {
        allTouched[key] = true;
      });
      setTouched(allTouched);

      // Leer valores actuales del formulario como respaldo
      const formEl = e.currentTarget as HTMLFormElement;
      const merged: Record<string, any> = { ...(values as any) };
      Object.keys(validationRules).forEach((key) => {
        const input = formEl?.querySelector(`[name="${key}"]`) as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null);
        if (input && 'value' in input) {
          merged[key] = (input as any).value;
        }
      });

      // Validación mínima (required) sobre los valores fusionados
      let ok = true;
      const newErrors: ValidationErrors = {};
      Object.entries(validationRules).forEach(([key, rule]) => {
        const v = merged[key];
        if (rule?.required && (!v || (typeof v === 'string' && String(v).trim() === ''))) {
          newErrors[key] = 'Este campo es obligatorio';
          ok = false;
        }
      });
      setErrors(newErrors);

      try {
        if (ok) {
          await onSubmit(merged as T);
        }
      } catch (error) {
        console.error('Form submission error:', error);
      } finally {
        setIsSubmitting(false);
      }
    };
  }, [values, validationRules]);

  const resetForm = useCallback((newInitialValues?: T) => {
    const resetValues = newInitialValues || initialValues;
    setValuesState(resetValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const isValid = Object.keys(errors).length === 0;

  return {
    values,
    errors,
    touched,
    isValid,
    isSubmitting,
    setValue,
    setValues,
    setFieldTouched,
    validateField,
    validateForm,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    clearErrors,
  };
}

// Utility functions for common validation patterns
export const validationPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[\+]?[1-9][\d]{0,15}$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  numeric: /^\d+$/,
  decimal: /^\d+(\.\d{1,2})?$/,
  barcode: /^[0-9]{8,13}$/,
};

// Common validation rules
export const commonValidations = {
  required: { required: true },
  email: { 
    required: true, 
    pattern: validationPatterns.email 
  },
  phone: { 
    pattern: validationPatterns.phone 
  },
  price: { 
    required: true, 
    min: 0,
    pattern: validationPatterns.decimal 
  },
  stock: { 
    required: true, 
    min: 0,
    pattern: validationPatterns.numeric 
  },
  barcode: { 
    pattern: validationPatterns.barcode 
  },
  name: { 
    required: true, 
    minLength: 2, 
    maxLength: 100 
  },
  description: { 
    maxLength: 500 
  },
  password: { 
    required: true, 
    minLength: 6 
  },
};
